# U7 分阶段开发方案（定稿，2026-11-12）

用途：U7（I-09b-2）设计与实施依据。上游：`docs/plans/2026-11-09-stage-ux-and-dev-session-design.md` §4.3.3、`docs/STATUS.md`「真实模型 E2E（2026-11-12）」。
状态：**方案定稿；U7-1 后端已实施并评审（2026-11-12），U7-2 前端已实施并评审（2026-11-12），U7-3 真实模型全链路已验证（2026-11-12）**。

---

## 1. 背景与真实数据

真实模型 E2E（2026-11-12）产出了可用的真实大交接包：**15 Story / 20 页面 / 119KB / 6 阶段**（基础 + 5 Epic），U6 已把阶段草案写进 `04-PLAN.md`，`manifest.scale.suggested=true`。U7 不再缺真实数据。

目标：把 U6 的“建议分阶段”变成**可选的阶段会话组织**，不做门禁、不改变完成语义。

---

## 2. 已确认决策

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | 阶段何时生成 | **按需**：U6 判定 large 后，开发页显示“按阶段开发”；用户点击才写入 `app_dev_phases`。普通交接包不建阶段。 |
| 2 | 阶段完成与会话 | **完成不归档**：`阶段完成` 只改状态；开始下一阶段时才归档当前 active。 |
| 3 | 上一阶段摘要 | **模型生成**：阶段完成时用 `generateText` 生成 5—10 行摘要；失败/超时回退到最后 assistant 文本；状态仍完成。 |
| 4 | 会话列表 | 保持**按变更单分组**，会话项加 `阶段 N / 标题` chip。 |
| 5 | 阶段来源 | 与 `04-PLAN` 完全一致：`数据模型与基础框架` + 每个 Epic 一阶段 + `其他页面与收尾`。 |
| 6 | 会话数 | 同一时间仍只有一个 active 会话；阶段是会话标签，不并发。 |
| 7 | 门禁 | 无 Git/证据/测试/阶段门禁；不自动完成应用；阶段全部完成只提示。 |
| 8 | Change Set | 阶段绑定 `change_set_id + handoff_version`；新变更单/新交接包重新生成阶段，旧阶段保留为历史。 |
| 9 | 阶段 ID | 全局唯一随机 ID；避免 P1 类跨应用冲突。 |
| 10 | 存量 | 当前 `apps=0`；旧交接包缺 `manifest.phases` 时需重新生成；不迁移旧阶段。 |

---

## 3. 阶段模型

### 3.1 阶段来源

复用 U6 `assessHandoffScale` 的 `phases`：

- `base`：数据模型与基础框架；
- `epic:<EPIC-ID>`：每个 Epic 一阶段；
- `other`：未归属 Epic 的页面集（如有）；
- 无 Epic 时按页面集分组；无页面集时“全量实现”。

U7 需要给 `DesignHandoffPhaseDraft` 增加稳定 `key`（`base` / `epic:EPIC-001` / `other` / `pageSets:1` / `all`），并写入 `manifest.phases`。

### 3.2 阶段范围

`scope_json`：

```ts
{
  kind: 'base' | 'epic' | 'other' | 'pageSets' | 'all'
  storyIds: string[]
  pageSetCodes: string[]
  pageCodes: string[]
  note?: string
}
```

### 3.3 状态

`not_started | in_progress | completed | skipped`

- 开始阶段 → `in_progress`；
- 阶段完成 → `completed`（不归档会话，生成摘要）；
- 跳过 → `skipped`（不生成摘要）；
- 重新打开 → `in_progress`（保留/可重生成摘要）；
- 向已完成/已跳过阶段的会话发送消息 → 自动回到 `in_progress`（提示“阶段已重新打开”）。
- 阶段状态不影响 `apps.status`、`/complete`、Change Set。

---

## 4. 数据模型

### 4.1 `app_dev_phases`（新表）

```sql
CREATE TABLE IF NOT EXISTS app_dev_phases (
  id              TEXT PRIMARY KEY,
  app_id          TEXT NOT NULL,
  change_set_id   TEXT,
  handoff_version INTEGER NOT NULL,
  phase_key       TEXT NOT NULL,
  title           TEXT NOT NULL,
  goal            TEXT,
  scope_json      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'not_started',
  summary         TEXT,
  summary_source  TEXT,              -- 'model' | 'fallback' | 'none'
  started_at      TEXT,
  completed_at    TEXT,
  ord             INTEGER NOT NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE(app_id, handoff_version, phase_key)
);
CREATE INDEX idx_dev_phases_app ON app_dev_phases(app_id, handoff_version, ord);
```

- ID 用 `randomUUID()`（全局唯一）。
- `change_set_id` 仅用于展示/归属；查询以 `app_id + handoff_version` 为准。
- 不建真实外键；服务层校验 app/phase 归属。

### 4.2 `app_sessions.dev_phase_id`

- `ensureColumn('app_sessions','dev_phase_id','TEXT')`；旧会话为 null。
- 会话列表返回 `phaseId/phaseKey/phaseTitle/phaseOrder/phaseStatus`。
- 删除应用时清理 `app_dev_phases`（会话随应用清理）。

### 4.3 `manifest.phases`

交接包生成时，在 `manifest.json` 增加：

```json
"phases": [
  { "key": "base", "title": "数据模型与基础框架", "goal": "...", "kind": "base", "storyIds": [], "pageSetCodes": [], "pageCodes": [], "note": "..." },
  { "key": "epic:EPIC-001", "title": "EPIC-001 图书档案管理", ... }
]
```

- 仅 `scale.suggested=true` 时写入；`phaseCount` 保留。
- `04-PLAN.md` 渲染不变（U6 已有）；U7 的 `phases/generate` 从 manifest 读取。
- 旧交接包没有 `phases` → `409 当前交接包缺少阶段数据，请重新生成交接包`。

---

## 5. 后端 API 与行为

### 5.1 生成/查询

- `POST /api/apps/:id/development/phases/generate`
  - 要求 `assertDevReady`（development/completed）+ 最新交接包；
  - 读 `manifest.phases`；`scale.suggested` 且数组非空；否则 409；
  - 若当前 handoff 已有阶段，幂等返回；
  - 事务插入阶段（`not_started`，ord 按数组顺序）；
  - 返回 `{ phases, handoffVersion, changeSet }`。
- `GET /api/apps/:id/development/phases?handoffVersion=`
  - 默认最新交接包版本；阶段 + 当前会话摘要（active/最新）+ `canGenerate`（最新 handoff 未生成阶段且 manifest 有 phases）。
  - 历史版本只读展示；不生成。

### 5.2 开始阶段

- `POST /api/apps/:id/development/phases/:phaseId/start`
  - 校验阶段属于当前 app + 当前/指定 handoff；
  - 若阶段已有会话：
    - active → 返回当前状态；
    - archived → 复用 I-10 activate（best-effort interrupt 当前 active、归档、激活目标），阶段 `in_progress`；不重发 brief。
  - 无会话：
    - 归档当前 active（best-effort interrupt）；
    - 创建 opencode build 会话，`app_sessions.dev_phase_id=phaseId`、handoff/change set 同当前；
    - 标题 `<应用名> 开发 · 阶段 N <title>`；
    - `defaultPrompt = buildPhasePrompt(phase, previousSummary)`；阶段 `in_progress`、`started_at`；
    - 返回 `DevStateResponse` + `phase`。
  - 不自动发送消息；用户在首条提示编辑后发送。
- `POST /api/apps/:id/development/phases/:phaseId/complete`
  - 阶段置 `completed`、`completed_at`；
  - **不归档会话**；
  - 若阶段有会话且有 assistant 消息：best-effort 调用模型摘要（见 §6），失败回退到最后 assistant 文本；
  - 返回 `{ phase, warnings }`。
- `POST .../skip`：`skipped`；不生成摘要。
- `POST .../reopen`：`in_progress`；清 `completed_at`（保留 summary；再次完成覆盖）。
- 以上都不改 `apps.status`、Change Set、交接包。

### 5.3 会话/提示

- `POST /development/session` 保持原义；阶段会话由 start 创建；可选 `phaseId` 可后续再加（MVP 不需要）。
- `POST /development/prompt`：若 active 会话属于 `completed/skipped` 阶段，自动阶段置 `in_progress`，返回 warning/notice。
- `GET /development`：`session.phase`（id/key/title/order/status）+ `phases` 可选摘要。
- `GET /development/sessions`：增加 phase 字段；前端列表显示 chip。
- Phase brief：

```
你现在在阶段 N/M：<title>。
目标：...
范围：Story ...；页面集 ...；页面 ...
交接包：docs/handoff/00-README.md、04-PLAN.md（阶段章节）、相关 03-PAGES/02-DATA-MODEL。
要求：只做本阶段范围；不要扩展/重写其它阶段；完成后总结已实现/未完成/关键文件/下一阶段注意。
上一阶段摘要：
<summary 或 “无上一阶段摘要”>
```

- 不注入批次/证据/Git/测试门禁。

---

## 6. 阶段摘要（模型生成）

- 触发：`complete` 且阶段有会话 + 至少一条 assistant 消息。
- 输入：阶段 title/goal/scope + 该会话最后一条 assistant 文本（截断，如 4000 字符）；不发送完整长会话。
- 调用：`opencode.generateText()`（短暂会话，模型按 development 阶段解析；**只用无工具/只读 agent `design`，兜底 `req`，不得使用 `build`**），prompt 要求 5—10 行中文摘要：已实现、关键文件、未完成/风险、下一阶段注意；只输出摘要。最后 assistant 文本、prompt、模型返回、fallback、warnings 全部 `scrubText` 脱敏；`DevPhaseView.summary` 与 brief 再做 defense-in-depth。
- 超时/失败：fallback 到最后 assistant 文本（截断 800 字符），`summary_source='fallback'`，`warnings` 返回；阶段仍 `completed`。
- 无会话/无 assistant：`summary=''`、`summary_source='none'`；不调模型。
- `summary` 写 `app_dev_phases.summary`；下一阶段 brief 读取上一阶段（按 ord 前一个）的 summary。
- 摘要调用是**同步 best-effort**（建议 60s 超时）；UI 显示“生成阶段摘要…”；失败不阻塞阶段完成。
- 成本：每阶段完成一次模型调用；用户可连续完成多个阶段，产生多次调用。

---

## 7. 会话与切换

- 同一时间只有一个 active；阶段 start/恢复用 I-10 的 activate 语义。
- 阶段完成不归档；开始下一阶段时归档当前 active（先 best-effort interrupt）。
- 归档阶段会话只读；恢复为 active 后阶段 `in_progress`。
- 同一阶段可有多个会话（用户点“新会话”再开始该阶段）；阶段列表显示当前/最新会话。
- 旧交接包阶段/会话保留；会话列表按变更单分组，阶段 chip 显示旧阶段标题。

---

## 8. 前端（U7-2）

- 未生成阶段：
  - U6 的“建议分阶段”旁边/开发页顶部显示“按阶段开发”按钮；二次确认（阶段数、不门禁、可随时单会话）；调用 generate 后加载阶段。
- 已生成阶段：
  - 时间线上方“阶段条”：`阶段 2/6 · 标题 · 进行中` + “选择阶段/完成/跳过/重新打开/查看范围”；
  - 阶段弹窗：状态、范围（Story/页面集/页面）、对应会话（打开/恢复）、按钮；当前高亮；历史/归档只读。
  - 开始阶段前若当前 active 运行中，提示会归档当前会话（best-effort 停止）。
  - 阶段完成后按钮变为“重新打开”；开始下一阶段时提示归档当前。
  - 会话列表项 phase chip；右侧“会话”卡加阶段行。
  - 所有阶段完成提示“可确认完成开发”，不自动完成。
- 响应式/深浅色：阶段条 1024/768 换行；弹窗内部滚动；沿用 token。
- 不新增“阶段”一级导航；不重排现有三栏。
- **实施备注（2026-11-12，U7-2 已完成并评审）**：入口为顶栏 `phase-generate-btn` + 开始卡片 `phase-generate-card-btn`（同一动作、避免重复 testid）；阶段条始终在时间线上方（未生成时不渲染），弹窗 `min(1000px)/min(760px)`、≤820 上下堆叠；`phase-labels.js` 承载状态/顺序/范围/进度/提示/二次确认/`phaseActionState` 矩阵；只读会话与历史交接包按钮禁用 + 原因（`phase-readonly-reason`）；开始阶段 emit `app-changed`，完成/跳过/重新打开不改应用状态；无历史版本切换入口（当前 UI 只展示最新交接包阶段，历史只读用路由注入验证）。主会话复核修复 `loadPhases` 并发序号（只应用最新响应、`appId` 切换失效旧请求）。详见 `docs/plans/2026-11-12-u7-2-implementation-brief.md` §8 与 `docs/STATUS.md`「U7-2 完成」。

---

## 9. Change Set / 版本 / 完成

- 阶段绑定 `change_set_id + handoff_version`；新变更单/新 handoff → 重新 generate 阶段；旧阶段保留历史。
- 同一变更单重新生成交接包 v2：旧 v1 阶段保留；当前 v2 需重新 generate；会话列表仍按变更单分组，旧会话 chip 显示 v1 阶段标题。
- C1 取消要求“未生成交接包”，因此不存在取消已生成阶段的主路径；不做阶段级取消。
- “确认完成开发”不受阶段状态影响；完成后继续发消息沿用现有 resume；阶段仍在。
- 删除应用清理 `app_dev_phases` + `app_sessions.dev_phase_id`。

---

## 10. 测试与验收

### 10.1 后端

- 阶段生成：manifest.phases → rows；幂等；缺失/非 large 409；唯一约束；ord/key。
- 开始阶段：无会话新建（归档旧 active、tag、handoff/CS、brief、status）；已有 active 返回；已归档 activate；跨应用/错误 phase 404/409。
- 完成/跳过/重新打开：状态；完成不归档；完成后继续 prompt 自动 in_progress；摘要成功/失败 fallback/无会话 none（mock generateText）。
- Phase brief：目标/范围/交接包路径/上一阶段 summary/无摘要文案。
- 会话列表/开发状态 phase 字段；旧会话 null。
- 删除应用清理。
- 回归：全部后端测试、5 支冒烟；新增 `smoke:dev-phases`（真实 opencode，不调模型）覆盖生成/开始/切换/完成/跳过/归档只读/恢复。

### 10.2 前端

- 未生成阶段的“按阶段开发”；生成后阶段条/弹窗；开始阶段（归档提示）；会话 chip；完成/跳过/重新打开；归档只读；无阶段门禁。
- Playwright：不调模型（API 预置大交接包 + 真实 opencode 建会话），浅/深 × 1440/1024/768；0 console/意外 API。

### 10.3 真实环境

- U7-3：真实 opencode 2.2.5（不调模型）建阶段/切换/归档只读/恢复/完成/跳过；摘要模型调用仅单测 mock（避免额外成本），如需真实摘要再单独验证。

---

## 11. 不做 / 边界

- 不自动阶段化（按需按钮）。
- 不做阶段门禁、Git/证据/测试门禁、审批流、批次。
- 不自动完成应用、不自动发送首条提示。
- 不新增第二套会话模型；仍一个 active。
- 不迁移旧阶段/旧会话；旧交接包重新生成后才有 phases。
- 不改 AI 页面集、页面规格、需求/设计/交接包版本语义。
- 不读取/打印/提交真实密码。

---

## 12. 实施拆分

| 批次 | 内容 |
| --- | --- |
| U7-1 后端 ✅ 2026-11-12 已实施（待评审） | `manifest.phases` + `DesignHandoffPhaseDraft.key`；`app_dev_phases`/`dev_phase_id`；generate/GET/start/complete/skip/reopen；phase brief；摘要（模型 + fallback）；session/state/list 字段；单测 + `smoke:dev-phases`。见 `docs/plans/2026-11-12-u7-1-implementation-brief.md` §8。 |
| U7-2 前端 ✅ 2026-11-12 已实施并评审 | `phase-labels.js` + 单测、`DevPhase*` 类型/API、`PhaseBar.vue`/`PhaseDialog.vue`、DevView 入口/阶段条/开始卡片快捷列表/完成-跳过-重新打开/只读/提示、会话 chip、右侧阶段行、响应式/深浅色；Playwright（真实 opencode，不调模型，73 张截图，0 错误/0 溢出/0 白底）；主会话复核并发刷新 must-fix 已修。见 `docs/plans/2026-11-12-u7-2-implementation-brief.md` §8。 |
| U7-3 验证 ✅ 2026-11-12 已验证 | 真实模型需求→设计→large 交接包→6 阶段；阶段摘要 `model`（486 字/5.1s）与 `fallback`（缺少 design/req + opencode 重启，warning，最后 assistant）均实证；P2、只读/恢复、应用保持 development；0 console/API 错误；23 张截图。见 `docs/plans/2026-11-12-u7-3-real-model-e2e-brief.md` §8。 |

建议先完成 U7-1 并由主会话评审，再 U7-2；同一时间只开一个实施会话。
