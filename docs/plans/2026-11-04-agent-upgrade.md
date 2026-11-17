# 智能体能力升级（需求分析任务层）实施计划

> **For Claude:** 按任务顺序逐个执行；每完成一个任务运行三道闸验证（frontend: `npm run typecheck` + `npm run check:vue`；backend: `npm run build`）。本目录不是 git 仓库，跳过 commit。

**Goal:** 把 AI 从"单轮对话输出器"升级为**可并发的需求工程智能体**：后端任务层（Task Layer）承载拆解/评审/分析等智能体任务，前端提交任务并订阅进度，需求分析管理成为智能体能力的核心应用场。

**Architecture:** 新增后端 `agents` 任务层（泛化 dev/agents 的 run+SSE 模式）：任务 = { kind, payload }，执行器按类型路由（轻任务 = llm-direct 直调 + 结构化校验；重任务 = 现有 AgentDriver）。批次拆解改为"规划 → 按点扇出（并发 3）→ 逐点产出 envelope"的任务流；前端新增 agent 任务 store（提交/SSE 订阅/结果应用/取消），设计页显示子任务进度。opencode 保持专职开发阶段（现状不动）。

**Tech Stack:** better-sqlite3 + node fetch（后端已有 getLlmConfig）、SSE（复用 dev/events 模式）、Pinia setup store、现有 envelope schema 校验。

**全局约束：**
- 不引入新依赖；不破坏现有对话流（单轮 patches 保留为 fallback）
- 每个任务后跑：frontend `npm run typecheck` + `npm run check:vue`；backend `npm run build`
- 项目无 git；每个文件改完更新尾部 `Modified by AI` 标记（仓库惯例）
- 智能体产出 = **提案**，应用仍走前端 `applyReply`（确认流/版本历史/撤销不旁落）

---

## 总体契约（先定接口，再写实现）

### 后端任务生命周期

```
POST /api/agents/tasks            { kind, payload }        → { id }
GET  /api/agents/tasks/:id                                 → AgentTask（含 result）
GET  /api/agents/tasks/:id/events   (SSE)                  → 事件流
DELETE /api/agents/tasks/:id                             → 取消
```

### 任务事件协议（SSE data 帧）

```ts
{ type: 'task-status', status: 'running' | 'done' | 'failed', progress: { done: number, total: number } }
{ type: 'point-start', pointNo: string, pointName: string }
{ type: 'point-result', pointId: string, envelope: ReplyEnvelope }   // 原始 LLM JSON，由前端校验并应用
{ type: 'point-error', pointNo: string, message: string }
{ type: 'plan', sharedEntities: Array<{ id: string, name: string, ownerPointNo: string, summary: string }>, notes: string }
```

### 任务类型与 payload

| kind | payload | 产出 |
|---|---|---|
| `decompose-batch` | `{ batchId: string }` | `{ plan, envelopes: [{ pointTarget, patch, openIssues }] }` |
| `review-batch` | `{ batchId: string }` | `{ report: string, issues: [{ pointTarget, question }] }` |

### 拆解两步式（后端编排）

1. **规划调用（1 次 LLM）**：输入 = 批次内全部需求点卡片 JSON + 现有规格摘要 + 已有跨点实体清单 → 输出计划 JSON：`{ sharedEntities: [...], order: ["A-1","A-2"...] }`（共享实体定稿，防各点重复定义漂移）
2. **按点扇出（并发 3）**：每个点一次 LLM 调用，上下文 = 该点卡片 + 共享实体清单 + 该点现有规格 → 输出单点 envelope `{ patch: {...}, openIssues: {...} }`；JSON 解析失败重试 1 次
3. 汇总：任务 result = `{ envelopes }`；事件流逐点推送 `point-result`

---

### Task 1: 任务层骨架（types + queue）

**Files:**
- Create: `backend/src/agents/types.ts`
- Create: `backend/src/agents/queue.ts`

**Step 1:** `types.ts`：

```ts
export type TaskKind = 'decompose-batch' | 'review-batch'

export interface AgentTask {
  id: string
  kind: TaskKind
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
  payload: Record<string, unknown>
  progress: { done: number; total: number; current?: string }
  /** 逐点结果：envelope 为该点的结构化提案（前端负责校验与应用） */
  results: Array<{ pointId?: string; pointTarget: string; envelope: Record<string, unknown> }>
  report?: string
  error?: string
  createdAt: string
}

export type TaskEvent =
  | { type: 'task-status'; id: string; status: AgentTask['status']; progress: AgentTask['progress'] }
  | { type: 'point-start'; pointTarget: string }
  | { type: 'point-result'; pointTarget: string; envelope: Record<string, unknown> }
  | { type: 'point-error'; pointTarget: string; message: string }
  | { type: 'plan'; sharedEntities: Array<{ id: string; name: string; ownerPoint: string; summary: string }>; note: string }
  | { type: 'log'; line: string }
```

**Step 2:** `queue.ts`：内存注册表 + 并发执行器：

```ts
const tasks = new Map<string, AgentTask>()
const MAX_CONCURRENT = 3
let running = 0
const waiters: Array<() => void> = []

export function createTask(kind: TaskKind, payload: Record<string, unknown>): AgentTask
export function getTask(id: string): AgentTask | undefined
export function listTasks(): AgentTask[]
export function cancelTask(id: string): void          // 置 cancelled + AbortController.abort()
export function pump(): void                          // 取 queued 任务，workers 上限 3
```

要点：`pump()` 在任务完成/失败后自动调度下一个 queued；每个任务带 `AbortController`；注册 `runners: Record<TaskKind, (task) => Promise<void>>` 由 routes 注入（避免 queue 依赖具体业务）。

**Step 3:** 验证：`npm run build` → PASS。

### Task 2: LLM 直连调用器（复用 llm.ts）

**Files:**
- Create: `backend/src/agents/llm.ts`

**Step 1:** 从 harness 抽取非流式 chat（复用 `getLlmConfig()`，OpenAI 兼容 /chat/completions，非流式，temperature 0.2）：

```ts
export async function chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string>
```

**Step 2:** 附带 `extractJson(text): unknown` 工具函数：剥掉 markdown 围栏后 `JSON.parse`，失败抛出可读错误（供重试逻辑使用）。

**Step 3:** `npm run build` → PASS。

### Task 3: decompose-batch 执行器（规划 + 按点扇出）

**Files:**
- Create: `backend/src/agents/prompts.ts`（规划/单点拆解两段提示词，规则与前端 `prompt.ts` 意图 C 同源，文件头注释标注"与前端保持同步"）
- Create: `backend/src/agents/decompose.ts`
- Modify: `backend/src/agents/queue.ts`（注册 runner）

**Step 1:** 规划调用（planner）：输入 = 批次内全部需求点（编号/名称/卡片 JSON + 现有规格摘要）+ 已有跨点实体清单；输出 JSON：

```json
{ "sharedEntities": [ { "id": "leaveRequest", "name": "请假申请", "ownerPoint": "A-1", "note": "跨点共享：申请/审批/统计共用" } ], "order": ["A-1", "A-2"], "note": "…" }
```

解析失败重试 1 次；仍失败 → 降级为"无共享实体清单，各点独立拆解"。

**Step 2:** 按点 worker（并发 3，用 `Promise.all` + 简单信号量）：每个点一次 LLM 调用，输入 = 单点拆解提示词（规则取自意图 C：实体+页面+核心规则骨架、依据卡片、引用共享实体用 pointId:itemId、meta.name 命名）+ 该点卡片/现有规格 JSON；输出 = `{ patch: {...}, openIssues: {...} }`。解析失败重试 1 次。

**Step 3:** 组装任务结果：`results = [{ pointId, pointTarget: point.no, envelope: { patch, openIssues } }]`；进度事件：每个点 `point-start` / `point-result` / `point-error`。

**Step 4:** 冻结校验：批次状态为「提交待审」时整个任务拒绝（`Error: 批次冻结`）；未确认卡片的点跳过并在 log 说明。

**Step 5:** `npm run build` → PASS；手工冒烟：临时路由 GET `/api/agents/dev-decompose?batchId=…` 用 curl 触发一次真实调用，检查任务 result.envelopes 结构。

### Task 3: 任务路由（提交/SSE/取消/列表）

**Files:**
- Create: `backend/src/agents/routes.ts`
- Modify: `backend/src/index.ts`（挂载 `/api/agents`）

**Step 1:** 路由：

```ts
agents.post('/tasks', (req, res) => {
  const { kind, payload } = req.body
  const task = createTask(kind, payload)          // 校验 kind 合法 + payload（batchId 存在）
  queue.submit(task)                               // 入队并 pump
  res.json({ id: task.id })
})
agents.get('/tasks/:id', …)                        // 任务快照
agents.delete('/tasks/:id', …)                     // 取消（abort + 置 cancelled）
agents.get('/tasks/:id/events', (req, res) => { … SSE：task-status / point-* / log，心跳 15s，close 时退订 … })
```

**Step 2:** SSE 订阅实现照抄 `backend/src/dev/routes.ts` 的 events 路由模式（subscribe/heartbeat/close）。

**Step 3:** `npm run build` → PASS；冒烟：`curl -X POST localhost:3300/api/agents/tasks -d '{"kind":"decompose-batch","payload":{"batchId":"…"}}'` → 返回 id；`curl /api/agents/tasks/:id` 能看到 status 推进与 results。

### Task 4: 前端任务 store（提交/订阅/应用）

**Files:**
- Create: `frontend/src/requirements-grooming/agent/store.ts`

**Step 1:** `useAgentTasksStore`：

```ts
interface AgentTaskView {
  id: string
  kind: TaskKind
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
  progress: { done: number; total: number }
  results: Array<{ pointId: string; envelope: Record<string, unknown> }>
}
```

- `submitDecomposeBatch(batchId)` → POST /tasks；打开 SSE 订阅
- SSE 处理：`point-result` → `validateEnvelopeData(envelope)`（复用前端校验）→ `specStore.applyReply(envelope, before, pointId)` → `conversation.pushAgentResult(pointId, reply)`（在对话中插入该点的 diff 卡消息）→ 进度 +1；`point-error` → 任务面板标红
- `cancel(id)` → DELETE
- 任务列表持久化：**不持久化**（V1；批次拆解幂等可重跑）

**Step 2:** conversation store 暴露结果插入方法：

```ts
/** 智能体任务结果进对话：一条汇总 + 每点 diff 卡（复用现有 DiffCard 渲染与撤销） */
function pushAgentResult(pointId: string, text: string, extra?: { diff?: SpecDiff; version?: number }): void
```

（内部复用 pushMessage；notice 用现有通道。）

**Step 3:** `npm run typecheck` → PASS。

### Task 5: 设计页接入（按钮切到任务路径 + 进度 UI）

**Files:**
- Modify: `frontend/src/requirements-grooming/ui/design/SpecPoolPanel.vue`

**Step 1:** 头部「AI 拆解」按钮改为提交任务：`agentTasks.submitDecomposeBatch(batchId)`；按钮 loading 绑定任务运行中状态；点击后对话自动展开。

**Step 2:** 详情区顶部加**任务进度条**（任务运行时显示）：`拆解中 3/6 · A-2 分级审批 ⏳`，每个点一个小徽标（成功绿/失败红可点击重试单点）。

**Step 3:** 规格树节点在任务进行中同样显示子任务状态（复用任务 store 的 results 映射）。

**Step 4:** 保留对话 fallback：用户在对话里说"开始拆解"仍走 patches 单轮流程（不删）。

**Step 5:** 三道闸 + 手工验收：点「AI 拆解」→ 进度逐点亮起 → 树/图谱实时更新 → 对话出现每点 diff 卡。

### Task 6: 评审任务（review-batch）

**Files:**
- Modify: `backend/src/agents/prompts.ts`（评审提示词：完整性/二义性/一致性/可测性四维检查清单）
- Create: `backend/src/agents/review.ts`
- Modify: `backend/src/agents/queue.ts` / `routes.ts`（注册 kind）

**Step 1:** 评审 runner：输入批次 → 按点并发评审（每点一次 LLM，输入卡片+规格+共享实体）→ 输出 `{ report, issues: [{ pointTarget, question }] }`。

**Step 2:** BatchBar「提交待审」确认弹窗里加选项「提交前先跑 AI 评审」→ 提交 review 任务，报告进对话 + issues 转 openIssues.add（draft）。

**验收**：任务完成后对话出现评审报告 + 待澄清问题列表新增。

### Task 7（后续，不在本轮）：影响分析 / 覆盖缺口 agent

预留 TaskKind 扩展位，接口不变。

---

## 验收标准（Definition of Done）

1. 设计页点「AI 拆解」→ 任务提交 → SSE 进度逐点亮起 → 每个需求点的规格出现在规格树（树/图谱实时刷新）
2. 单点失败可重试，不影响其他点；冻结批次上提交任务被拒绝
3. 「确认全部骨架」后批次自动进「待开发」（复用现有规则二）
4. 对话保留完整时间线：每个子任务完成插 diff 卡，可撤销
5. 后端并发度 ≤3；任务可取消；前端刷新后任务列表丢失可接受（幂等重跑）
