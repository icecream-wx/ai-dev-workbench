# Spike F：会话/对话从“app 强绑定”抽 `ChatTarget` 的评估（只读）

## 目的

P7-7 工作室需要“每个自定义模板一个独立会话”，但不能改 DB 表、也不能破坏现有应用三视图。
本文件只做**代码只读评估**：列出强绑定点、建议抽象、受影响测试/e2e、风险与推荐路线。

## 现状：强绑定清单

### 1) `backend/src/chat/service.ts`（SSE 对话入口）

| 位置 | 现状 | 抽取影响 |
| --- | --- | --- |
| `ChatApp { id; name }` | 只有 app id/name | `ChatTarget` 需要 `directory`、`view`、`title`、`beforeSession`、`expectedAssets`、`buildPrompt` |
| `handleAppChat()` | `const directory = appDirOf(app.id)`；`ensureWorkspaceAssets(app.id)`；`resolveChatModel(app.id, view, directory)` | 目录、工作区对齐、模型键都按 app 写死 |
| `ensureViewSession()` | `activeSessionRow(app.id, view)`；`createSessionRow({appId: app.id})`；title `${app.name} · ${viewLabel(view)}`；`verifyProjectAssets(app.id, directory)` | 会话键、标题、资产校验按 app |
| `verifyProjectAssets()` | `expectedSkillIds(appId)` + 固定 `EXPECTED_COMMANDS` | 工作室需要 `adw-design-template-authoring` + `generate-design-template` |
| `buildViewPrompt()` | `Record<AppView, string[]>`，只有需求/设计/开发 | 工作室需要独立 prompt（catalog/spec/边界） |
| `modelKey()` / `storedModelFromOtherStages()` | 三视图固定数组 | `template` 视图不参与“继承其它视图模型”，避免污染 |
| `agentForView()` / `viewLabel()` | 写死三视图 | 需要 `template` 分支 |

### 2) `backend/src/sessions/store.ts`

| 位置 | 现状 | 说明 |
| --- | --- | --- |
| `AppView = 'requirements' \| 'design' \| 'development'` | 类型层三视图 | **保持三值**；新增 `SessionView = AppView \| 'template'` 与 `isSessionView`；`app_sessions.view` 是 TEXT，无迁移 |
| `isAppView()` | 三值判断 | **保持三值判断**（应用 chat/model 路由继续用它，拒绝 `template`）；工作室用 `isSessionView` |
| `viewOf()` | 旧行 `view IS NULL` → `development` | 对 `template` 返回自身；studio 新行写 `template` |
| `activeSessionRow/listSessionRows` | 以 `app_id + view` 查询 | `app_id` 可用合成 id `__template__:<draftId>`；**无 FK，无需改表** |
| `createSessionRow` | `stage = view` | 模型 stage 也会是 `template`，键 `app.__template__:<id>.model.template` 可用 |

### 3) `backend/src/dev/service.ts`（前端实际使用的会话/时间线/prompt 入口）

**重要**：当前前端 `AgentChatPanel` 调用的是 `/api/apps/:id/development/*`（`getDevState`、
`listDevSessions`、`promptDevSession`、`interrupt`、`compact`、权限/表单回复），不是 `handleAppChat` 的 SSE。
所以只抽 `chat/service.ts` 不够；工作室若要复用 `AgentChatPanel`，还应抽 `dev/service.ts` 的会话路径。

强绑定点：

- `appOrThrow(appId)`（每个导出函数入口）；
- `assertWorkspaceReady(app)`、`appDirOf(appId)`；
- `registerAppSecrets(appId, dir)`（工作室不需要、也不应读取应用密钥）；
- `resolveChatModel(appId, view, dir)`、`createSessionRow({appId})`；
- `defaultDevPrompt(module)` / `developmentDigestForPrompt(appId, module, dir)`；
- `stateFor(app,row)`、`sessionItemOf(app,row,...)` 的 app 摘要；
- `activeOpencodeSessionId(appId, view)` 与 `/development/events` 的 `appDirOf`；
- `listDevSessions` 的 `opencode.listSessions(appDirOf(appId))` 目录。

### 4) 路由

- `apps/routes.ts`：`apps.post('/:id/chat', ...)`、`apps.use('/:id/development', devRoutes)`；
- `dev/routes.ts`：`appIdOf(req)` 直接读 `req.params.id`；
- 工作室若用 `/api/design-templates/drafts/:draftId/studio/*`，需要自己的 target 解析器，
  不能走 `appOrThrow`。

### 5) 前端

- `AgentChatPanel.vue` props 只有 `appId/view/moduleKey`；内部全部调用 `dev/api.ts` 的
  `/apps/<appId>/development/*`；
- `frontend/src/dev/types.ts#AppView` 仍三值，新增 `SessionView`；
- `view-helpers.js#APP_VIEWS/isAppView/viewLabel` 为三视图；
- 工作室如果复用面板，需要给 `AgentChatPanel` 增加 API 适配层（或新面板），否则会请求应用路由。

## 建议的 `ChatTarget` 抽象

```ts
export type AppView = 'requirements' | 'design' | 'development'
export type SessionView = AppView | 'template'

export interface ChatTarget {
  /** 应用 id 或 `__template__:<packId>`；会话表 app_id 直接使用 */
  id: string
  /** 展示名（会话标题用） */
  name: string
  /** opencode location / 工作目录 */
  directory: string
  /** 会话视图；AppView 保持三值，SessionView = AppView | 'template' */
  view: SessionView
  /** 每轮前的幂等准备（应用：ensureWorkspaceAssets；工作室：ensureStudioAssets + 校验草稿存在） */
  beforeSession?(): { warnings: string[] }
  /** 期望加载的 skill/command（替代 expectedSkillIds/EXPECTED_COMMANDS 写死） */
  expectedSkills(): string[]
  expectedCommands(): string[]
  /** 视图 prompt；应用复用 buildViewPrompt，工作室用工作室 prompt */
  buildPrompt(text: string, options: { module?: string; digest?: string }): string
  /** 开发视图 digest（工作室返回 catalog/spec 摘要或 undefined） */
  digest?(module?: string): string | undefined
  /** 是否需要 module 语义（工作室用 draftId，但 UI 不传 module） */
  allowModule: boolean
}
```

### 迁移方式（低风险）

1. `sessions/store.ts` **保持 `AppView` 三值**，新增 `SessionView = AppView | 'template'` 与 `isSessionView`；
   `viewOf()` 对 `template` 返回自身；应用路由继续 `isAppView`，工作室路由用 `isSessionView`（DB 不变）；
2. `chat/service.ts` 新增内部 `handleChat(target, req, res)`；`handleAppChat(app, req, res)` 保留为
   **完全等价包装**（`targetForApp(app)`），保证现有行为与测试不变；
3. `dev/service.ts` 内部把 `appOrThrow`/`appDirOf`/`ensureWorkspaceAssets` 替换为
   `targetForApp(appId)`（或 `targetForDraft(draftId)`）；导出的 app 函数签名不变；
4. 工作室新增 `targetForDraft(packId)`：`id=__template__:<packId>`、`directory=<dataDir>/design-system/_workshop`、
   `view='template'`、prompt/catalog/expected assets 由工作室提供；
5. `verifyProjectAssets` 改为 `verifyTargetAssets(target)`（轮询 `/api/skill`/`/api/command` 直到出现或超时）；
6. 前端 `AgentChatPanel` 增加可选 `api` prop（默认现 `dev/api.ts`）；工作室传入 studio API 适配器。

## 受影响测试/e2e（评估）

| 测试 | 影响 |
| --- | --- |
| `backend/src/chat/service.test.ts`（12 条，21 处使用 handleAppChat/ensureViewSession/buildViewPrompt/sessionsForView） | 若保留包装函数且行为不变，**理论上不改断言**；但要新增 `template` prompt/模型键/资产校验用例 |
| `backend/src/dev/service.test.ts`（9 条） | 同样靠包装函数保持不变；新增 studio target 用例 |
| `backend/src/dev/linkage.test.ts`（5 条） | 不涉及会话抽取；回归即可 |
| `backend/src/dev/timeline.test.ts` | 只依赖 opencode 事件，不改 |
| `backend/src/db-migrate.test.ts` / `db-guards.test.ts` | 不改表，理论上不受影响 |
| `e2e:p2/p3/p4`（116/126/128，前端 + stub） | 前端仍走 `/apps/:id/development/*`，只要路由与响应不变，**断言数不变**；p4 覆盖会话列表/重命名/归档/compact，必须回归 |
| `e2e:p7-6a`（15） | 不涉及对话；回归 |
| 真实模型 P7-6b 驱动 | 走真实 `/development/*`，抽取后应复跑（P7-7c 一起） |
| `smoke:assets` / `verify-agent-assets` | `expectedSkillIds` 若改签名，需同步 |

## 风险与建议

1. **主要风险在 `dev/service.ts` 的 `stateFor`/timeline**：它读取 opencode 会话与 app 摘要；抽取时容易把
   “应用不存在/目录缺失”的 404/409 语义改掉。建议先抽 `ChatTarget` 的**只读字段 + 目录/名称**，
   保持每个导出函数的入口校验顺序不变。
2. **不建议 P7-7b 一次性重写 `dev/service.ts`**：先做 `ChatTarget` + `targetForApp` 包装，
   再用它实现工作室会话；工作室可以复用 `timeline` 的纯函数，但事件 SSE 路由单独挂。
3. **`handleAppChat` 的 SSE 目前不是前端主路径**，但仍被 API/测试使用；保留并包一层最安全。
4. **工作室会话 view=`template`**：`storedModelFromOtherStages` 不应把应用模型带进工作室；模型键独立。
5. **合成 app_id**：`app_sessions.app_id` 无 FK，`__template__:<packId>` 安全；删除模板时可归档会话，
   不要物理删除 DB 行（`app_sessions` 无迁移/级联逻辑）。
6. **前端面板适配**：如果不想改 `AgentChatPanel`，可复制一个 `StudioChatPanel`，但会分叉
   （停止/compact/权限/表单/时间线都要复制）。推荐给 `AgentChatPanel` 增加 API 适配 prop，默认行为不变。
