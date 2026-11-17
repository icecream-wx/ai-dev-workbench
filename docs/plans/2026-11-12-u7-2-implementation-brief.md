# U7-2 前端：分阶段开发实施交接单

日期：2026-11-12
用途：**新开实施会话**使用；主会话负责设计/评审；同一时间只一个会话改文件。
状态：**待实施**（U7-1 后端已完成并评审）。
上游：`docs/plans/2026-11-12-u7-phased-development-design.md` §8、`docs/plans/2026-11-12-u7-1-implementation-brief.md` §8、`docs/plans/2026-11-09-stage-ux-and-dev-session-design.md` §4.3.3。
范围：**只做前端**——阶段类型/API、按阶段开发入口、阶段条/弹窗、开始/完成/跳过/重新打开、会话 chip、右侧阶段行、只读/历史只读、响应式/深浅色、纯逻辑单测、Playwright 验证。
**不改后端语义/接口/表**；不做 U7-3 真实模型摘要验证；不改需求/设计/交接包/Change Set/`05-CHANGES`/AI 页面集。

---

## 0. 当前基线（实施前）

| 项 | 状态 |
| --- | --- |
| 后端 | 145/145；U7-1 阶段 API 已就绪（`app_dev_phases`、`manifest.phases`、generate/start/complete/skip/reopen） |
| 前端 | 69/69、`typecheck`/`build`/`check:vue` 通过 |
| 真实数据 | `apps=0`、`projects/` 空；**不要**在仓库 `data/`、`projects/` 下跑 E2E |
| 主题/断点 | 视觉 V1—V3 已定 token 与 1440/1280/1024/768 响应式；开发页 ≤1024 会话/右侧为抽屉，≤768 单栏 |

---

## 1. 后端契约（U7-1 实际返回，**以代码为准**）

代码：`backend/src/dev/phases.ts`、`backend/src/dev/service.ts`、`backend/src/dev/routes.ts`。

### 1.1 `GET /api/apps/:id/development/phases?handoffVersion=`

```ts
{
  handoffVersion: number | null
  changeSet: { id: string; seq: number; title: string; status: string } | null
  canGenerate: boolean   // 最新交接包 large + manifest.phases 非空 + 该版本尚未生成
  generated: boolean
  phases: Array<{
    id: string; key: string; title: string; order: number   // order 1-based
    status: 'not_started' | 'in_progress' | 'completed' | 'skipped'
    goal: string
    scope: { kind: 'base'|'epic'|'other'|'pageSets'|'all'; storyIds: string[]; pageSetCodes: string[]; pageCodes: string[]; note?: string }
    summary: string | null            // 后端已脱敏
    summarySource: 'model' | 'fallback' | 'none' | null
    startedAt: string | null; completedAt: string | null
    handoffVersion: number; changeSetId: string | null
    createdAt: string; updatedAt: string
    session: { id: string; title: string | null; displayTitle: string; status: string; createdAt: string } | null
    sessionCount: number
  }>
}
```

- 默认最新交接包；`handoffVersion` 只用于历史只读查看。历史交接包阶段 `start/complete/skip/reopen` 统一 **409**。
- `canGenerate` 只在最新版本、未生成时可能为 true。

### 1.2 `POST .../phases/generate`

- 无 body；返回同 §1.1。
- 旧交接包/非 large → 409 `当前交接包缺少阶段数据，请重新生成交接包`；开发未就绪 → 409。

### 1.3 `POST .../phases/:phaseId/start`

- 返回 `DevStateResponse & { phase: PhaseView }`（顶层多一个 `phase`，`session.phase` 同步）。
- 无会话时创建 build 会话并返回 `defaultPrompt`（阶段 brief）；**不自动发送**；有 active 会话直接返回；archived 会话复用 I-10 activate；completed → 409 `阶段已完成；如需继续请先“重新打开”`；skipped 可直接 start。

### 1.4 `POST .../phases/:phaseId/complete | skip | reopen`

- `complete` → `{ phase: PhaseView, warnings: string[] }`；**不归档会话**；有会话+assistant 时同步 best-effort 摘要（最长 60s；失败 fallback，`warnings` 非空）；已 completed 幂等返回（`warnings: []`）。
- `skip` / `reopen` → 直接返回 `PhaseView`。
- 三者都不改 `apps.status`、Change Set、交接包。

### 1.5 会话/状态

- `GET /development` 增加 `phases: DevPhaseRef[]`（最新交接包摘要，可能为空）与 `session.phase: DevPhaseRef | null`。
- `GET /development/sessions` 每项增加 `phaseId/phaseKey/phaseTitle/phaseOrder/phaseStatus`（旧会话为 null）。
- `POST /development/prompt` 返回 `{ ok: true; phase?: DevPhaseRef; warning?: string }`；向 completed/skipped 阶段发消息会自动置 in_progress 并返回 warning。

`DevPhaseRef = { id, key, title, order, status }`。

---

## 2. 前端类型与 API

### 2.1 `frontend/src/dev/types.ts`

按 §1 增加：

- `DevPhaseStatus`、`DevPhaseKind`、`DevPhaseSummarySource`。
- `DevPhaseRef`（§1.5）。
- `DevPhaseScope`（§1.1 scope）。
- `DevPhaseSessionSummary`（`DevPhaseView.session`）。
- `DevPhaseView`（§1.1 完整项）。
- `DevPhasesResponse`（§1.1）。
- `DevPhaseStartResponse = DevStateResponse & { phase: DevPhaseView }`。
- `DevPhaseCompleteResponse = { phase: DevPhaseView; warnings: string[] }`。
- `DevSessionInfo` 增加 `phase: DevPhaseRef | null`（必填；后端总会返回）。
- `DevSessionListItem` 增加 `phaseId/phaseKey/phaseTitle/phaseOrder/phaseStatus`（均可 null，必填字段）。
- `DevStateResponse` 增加 `phases: DevPhaseRef[]`。
- 注意：`DevView.restoreCurrent` 里手工构造的 `DevSessionListItem` 也要补 5 个 phase 字段（null），否则 typecheck 失败。

### 2.2 `frontend/src/dev/api.ts`

```ts
getDevPhases(appId, handoffVersion?): Promise<DevPhasesResponse>   // GET /phases?handoffVersion=
generateDevPhases(appId): Promise<DevPhasesResponse>
startDevPhase(appId, phaseId): Promise<DevPhaseStartResponse>
completeDevPhase(appId, phaseId): Promise<DevPhaseCompleteResponse>
skipDevPhase(appId, phaseId): Promise<DevPhaseView>
reopenDevPhase(appId, phaseId): Promise<DevPhaseView>
promptDevSession(...): Promise<{ ok: true; phase?: DevPhaseRef; warning?: string }>
```

- 继续走既有 `request()`，错误 → `DevApiError`（保留 HTTP status 供 UI 区分 409）。

### 2.3 纯逻辑 `frontend/src/dev/phase-labels.js`（新建）

不依赖 Vue/DOM，供组件与 `node --test` 复用。建议导出并按此语义实现：

| 函数 | 语义 |
| --- | --- |
| `phaseStatusLabel(status)` | `not_started→未开始` / `in_progress→进行中` / `completed→已完成` / `skipped→已跳过` / 其他 `未知状态` |
| `phaseStatusClass(status)` | `not_started→not-started` / `in_progress→in-progress` / `completed→completed` / `skipped→skipped` / 其他 `unknown`（仅作 CSS class 后缀） |
| `phaseOrderLabel(order, total)` | 合法正整数 → `阶段 2/6`；非法 → `阶段 —` |
| `phaseRefLabel(phase, opts?)` | `阶段 2 · 标题`；`opts.short` → `阶段 2`；无 phase → `''` |
| `phaseChipLabel(session, opts?)` | 读 `phaseOrder/phaseTitle`；无阶段 → `''`；`opts.short` → `阶段 2`；否则 `阶段 2 · 标题` |
| `phaseScopeLabel(scope)` | 非空项按 `Story 3 · 页面集 2 · 页面 5`（数量）；全空 → `按 04-PLAN.md 阶段章节` |
| `phaseScopeDetail(scope)` | 弹窗用：`Story STORY-001、STORY-002；页面集 PS-001；页面 PAGE-001…`；全空 → `按 04-PLAN.md 阶段章节` |
| `phaseProgress(phases)` | `{ total, completed, skipped, done }`：`completed` 仅 completed；`done = completed + skipped`；非法输入 → 全 0 |
| `phaseCompletionHint(phases)` | 全 completed → `全部阶段已完成，可确认完成开发（不会自动完成）。`；全部 completed/skipped 且含 skipped → `阶段均已处理（含跳过），可确认完成开发。`；否则 `''` |
| `phaseActionState(phase, currentHandoffVersion, readOnly)` | 返回 `{ canStart, canComplete, canSkip, canReopen, reason }`，见下 |
| `phaseGenerateConfirmText(count)` | 二次确认文案（含阶段数、不门禁、可单会话/跳过、不自动发送/不自动完成） |
| `phaseStartConfirmText(phase, total, opts)` | 二次确认文案；`opts.hasActiveSession` 提示归档当前会话；`opts.running` 前置“Agent 正在执行，会先请求停止” |

`phaseActionState` 矩阵（**必须与后端语义一致**）：

- `readOnly` 或 `!phase` → 全 false，`reason='会话只读'`。
- `phase.handoffVersion !== currentHandoffVersion` → 全 false，`reason='历史交接包阶段只读'`。
- `not_started` / `in_progress` → `canStart/canComplete/canSkip=true`，`canReopen=false`。
- `completed` → 仅 `canReopen=true`（start 返回 409、skip 不提供入口）。
- `skipped` → `canStart/canReopen=true`，`canComplete/canSkip=false`。

### 2.4 单测

新增 `frontend/src/dev/phase-labels.test.mjs`（`node --test`），加入 `frontend/package.json` 的 `test` 列表。至少覆盖：

1. 状态标签/class 全映射 + 未知值。
2. `phaseOrderLabel` 合法/非法（0、负数、NaN、null）。
3. `phaseRefLabel`/`phaseChipLabel`：有/无阶段、`short`。
4. `phaseScopeLabel`/`phaseScopeDetail`：全空、仅 Story、三类齐全、`note` 不丢。
5. `phaseProgress`/`phaseCompletionHint`：空、部分、全 completed、含 skipped。
6. `phaseGenerateConfirmText`：含阶段数、`不设门禁`、`单会话`、`不会自动发送`。
7. `phaseActionState` 上述矩阵（含 readOnly、历史版本）。
8. `phaseStartConfirmText`：无会话/有 active/运行中三种文案。

---

## 3. 组件与交互

### 3.1 新建 `PhaseBar.vue`

位置：`timeline` 内、`timeline-scroll` 上方（`flex-shrink: 0`，始终显示于已生成阶段时）。Props：

```ts
{
  phases: DevPhaseView[]
  currentPhaseId: string | null
  currentHandoffVersion: number | null
  readOnly: boolean
  busy: boolean
}
```

Emits：`open`（打开阶段弹窗/选择阶段）、`start`、`complete`、`skip`、`reopen`（带 `phase`）。

展示：

- 主行：`阶段 2/6 · EPIC-001 客户管理` + 状态 chip（`phaseStatusClass`）+ 右侧 `已完成 3/6`。
- 无当前阶段：`按阶段开发 · 选择阶段开始`。
- 有 `phaseCompletionHint` 时显示提示行（`ok` 色）。
- 按钮：`选择阶段`（始终）、`查看范围`（打开弹窗定位当前）、`完成`/`跳过`/`重新打开`（按 `phaseActionState`，readOnly 禁用）。
- 全部完成时仍允许“选择阶段”查看；不自动完成应用。
- `data-testid`：`phase-bar`、`phase-bar-open`、`phase-bar-complete`、`phase-bar-skip`、`phase-bar-reopen`、`phase-bar-hint`。

### 3.2 新建 `PhaseDialog.vue`

仿 `design/DesignHandoffDialog.vue`：`Teleport to="body"` + `.mask` + `.dialog`（`role="dialog"`、`aria-modal`、`Esc`/遮罩关闭），token 化，内部滚动。

Props：

```ts
{
  modelValue: boolean
  phases: DevPhaseView[]
  currentPhaseId: string | null
  currentHandoffVersion: number | null
  handoffVersion: number | null
  readOnly: boolean
  busy: boolean
  busyAction: '' | 'start' | 'complete' | 'skip' | 'reopen'
}
```

Emits：`update:modelValue`、`start`/`complete`/`skip`/`reopen`（带 `phase`）。

布局：

- 左侧阶段列表（宽 260—300px，≤820px 变上下堆叠、列表可横向滚动或压缩）：每项 `阶段 N · title` + 状态 chip + `会话` 标记；当前高亮；按钮 `data-testid="phase-item"`。
- 右侧详情：goal、范围（`phaseScopeDetail`）、阶段状态/起止时间、摘要（`summary` + `summarySource` 标签：模型/回退/无摘要）、会话（`session.displayTitle` + 会话状态；`sessionCount`）、`handoffVersion`、`changeSetId`。
- 摘要生成中：`busy && busyAction==='complete'` 且当前阶段 → 详情显示“正在生成阶段摘要…”并禁用按钮。
- 操作按钮：开始/继续、完成、跳过、重新打开（按 `phaseActionState`；历史版本/只读时禁用并显示 `reason`）。
- 底部：`已完成 x/n` + `phaseCompletionHint` + 关闭。
- `data-testid`：`phase-dialog`、`phase-detail`、`phase-scope`、`phase-summary`、`phase-start`、`phase-complete`、`phase-skip`、`phase-reopen`、`phase-readonly-reason`。

### 3.3 `DevView.vue` 接入

新增状态：

```ts
phasesData = ref<DevPhasesResponse | null>(null)
phasesLoading = ref(false)
phaseDialogOpen = ref(false)
selectedPhaseId = ref<string | null>(null)
phaseBusy = ref(false)
phaseBusyAction = ref<'' | 'start' | 'complete' | 'skip' | 'reopen'>('')
phaseWarnings = ref<string[]>([])
plainStartOpen = ref(false)   // 有阶段时“普通会话”入口，默认折叠
```

计算：

- `phases = phasesData?.phases ?? []`；`phasesGenerated = phasesData?.generated === true`。
- `currentPhaseId = session?.phase?.id ?? (active 阶段?.id) ?? null`；`currentPhase = phases.find(id)`。
- `phaseTotal = phases.length`；`phaseIndex = currentPhase?.order`。
- `canGeneratePhases = !readOnly && handoffScale?.suggested === true && phasesData?.canGenerate === true`。
- `phaseReadOnlyReason = phaseActionState(...).reason`（无则 ''）。

加载：

- `loadPhases(handoffVersion?)`：`getDevPhases`；失败静默保留上次值（不覆盖主时间线错误）；`phasesLoading` 防重。
- `refresh()` 内当 `next.app.handoff` 存在时 `void loadPhases()`（一次轻量查询；`handoffVersion` 不变也刷新状态）；`loadSessions()` 保持。
- `applyData`/切换会话/SSE 刷新后阶段条自然跟随 `session.phase`。
- `appId` 变化时清空 `phasesData/selectedPhaseId/phaseDialogOpen/phaseWarnings`。

入口：

- **未生成**：`handoffScale.suggested && canGeneratePhases` 时，顶栏 `.dev-actions` 显示 `按阶段开发` 按钮（`data-testid="phase-generate-btn"`），开始卡片也显示同一按钮；点击 `ElMessageBox.confirm(phaseGenerateConfirmText(handoffScale.phaseCount || 0))` → `generateDevPhases` → 刷新 `phases`/`sessions`/state → `ElMessage.success('已生成 N 个开发阶段')`。失败（409）原样 toast，并提示“请重新生成交接包”。
- **已生成**：`PhaseBar` 固定显示；开始卡片优先显示阶段快捷列表（每项 `阶段 N · title` + 状态 + `开始/继续` + `查看范围`），下方折叠“普通会话（不关联阶段）”（`plainStartOpen`）保留原 `开始开发` textarea/按钮；不自动发送。`newSession` 二次确认文案在已生成阶段时追加一句“新会话不会关联阶段；建议用阶段列表开始阶段”。

操作（全部 `emit('app-changed')` 视情况，不自动完成应用）：

- `startPhase(phase)`：若 `session` 存在 → 确认 `phaseStartConfirmText(phase, total, { hasActiveSession: true, running: isRunning })`；否则 `{ hasActiveSession: false }`。调用 `startDevPhase` → `selectedSessionId = next.session?.id` → `applyData(next)` → `composer.value = next.defaultPrompt`（阶段 brief，**不发送**）→ `ensureEvents()` → `refresh` + `loadPhases` + `loadSessions` → 关闭弹窗 → `ElMessage.success('已进入阶段 N，首条提示已放入输入框（未发送）')` → focus composer。
- `completePhase(phase)`：确认文案 `完成阶段 N「title」只更新阶段状态，不归档会话、不检查 Git/测试；会尝试生成阶段摘要（失败回退最后一条回复）。`；`phaseBusyAction='complete'`；调用 `completeDevPhase`；`phaseWarnings = warnings`；刷新 phases/state；`warnings.length ? ElMessage.warning(warnings.join('；')) : ElMessage.success('阶段已完成')`。摘要生成期间按钮文案 `生成摘要中…`。
- `skipPhase(phase)`：确认“不会删除会话/代码，可稍后重新开始”；调用 `skipDevPhase`；刷新。
- `reopenPhase(phase)`：确认“不会自动创建/切换会话”；调用 `reopenDevPhase`；刷新。
- `openPhaseDialog(phaseId?)`：设置 `selectedPhaseId` 并打开；`PhaseBar` 的“选择阶段”传入当前阶段。
- 409 处理：`DevApiError.status === 409` 时直接显示后端 message，并刷新 phases（历史只读/已完成后重新打开等状态可能已变）。

`send()`：

- `promptDevSession` 返回 `warning` 时 `ElMessage.warning(warning)`，并 `loadPhases()`（后端已把阶段置 in_progress）；phase bar 自动更新。
- 发送后若当前阶段为 completed/skipped，UI 不再显示“重新打开”，改为 in_progress。

只读/历史：

- `readOnly` 时阶段条/弹窗操作全禁用（`phaseActionState`），但可查看范围/摘要；会话只读逻辑不变。
- 历史交接包阶段（`phase.handoffVersion !== handoff.version`）按钮禁用 + `phase-readonly-reason` 显示“历史交接包阶段只读”；正常阶段列表来自最新交接包，历史场景由 Playwright 路由注入验证。
- 顶部无“阶段”一级导航；三栏结构不变。

### 3.4 `SessionList.vue` + 右侧会话卡

- `SessionList` 列表项在 `.item-top` 或 `.item-meta` 增加阶段 chip：`phaseChipLabel(item, { short: false })`，无阶段不渲染；`title` 属性放完整标签；`data-testid="session-phase-chip"`。视觉用 `--rg-ai-soft/--rg-ai` token，保持现有字号；不改变分组/搜索/归档/恢复逻辑（搜索仍按标题/备注，阶段不参与搜索）。
- `DevView` 右侧“会话”卡新增一行：`<dt>阶段</dt><dd>{{ session?.phase ? phaseRefLabel(session.phase) : '—' }}</dd>`（`data-testid="aside-phase"`）；`title` 用完整标签，超出省略。

### 3.5 样式/响应式/深浅色

- 全部使用 `--rg-*` token；不新增一级导航、不重排三栏。
- 阶段条：`display:flex; flex-wrap:wrap; gap`，≤1024 按钮换行、≤768 两行；主标题 `min-width:0` + 省略，避免横向溢出。
- 弹窗：`width:min(1000px, calc(100vw-32px)); height:min(760px, calc(100vh-48px)); overflow:hidden`，列表/详情各自 `overflow:auto`；≤820px 宽高 `calc(100vw-20px)/calc(100vh-20px)`，列表在上、详情在下，内部滚动；不出现页面级横向滚动。
- 状态色：in_progress → `--rg-ai`/`--rg-ai-soft`；completed → `--rg-ok`/`--rg-ok-soft`；skipped → `--rg-fill-2`/`--rg-text-3`；not_started → `--rg-text-3`；warn 提示沿用 `--rg-warn*`。
- 深色模式不得出现白底块（除既有“白纸”原型语义）。

---

## 4. Playwright 验证（不调模型）

环境沿用既有做法（仓库无 playwright 依赖）：

- Playwright：`require('E:/applications/nodejs20/node_global/node_modules/@playwright/mcp/node_modules/playwright')`。
- 临时根目录：`C:\Users\icecream\AppData\Local\Temp\opencode\u7-2\`（`data/`、`projects/`、`shots/`、脚本、`summary.json`），**不得**指向仓库 `data/`/`projects/`。
- 后端：`PORT=3431`、`RG_DATA_DIR=<tmp>\data`、`RG_PROJECTS_DIR=<tmp>\projects`、`OPENCODE_AUTO_START=true`、`OPENCODE_PORT=4431`；`node backend/node_modules/tsx/dist/cli.mjs backend/src/index.ts`（或 `dist`）。
- 预置应用：复用 `backend/scripts/dev-phases-smoke.ts` 的需求→设计→交接包构造（3 Epic / 10 Story / 3 实体 / ≥12 页面 / 每页 PNG / 确认设计 / 生成交接包），应用 id 如 `u72-phases`；确认 `manifest.scale.suggested=true`、`manifest.phases` 4 个。
- 阶段操作通过真实 API（不调模型）：`phases/generate` → `start` 阶段 1/2（真实 opencode 2.2.5 建会话，不发送消息）→ `complete`（无 assistant → `summarySource='none'`）→ `skip` → `reopen`；会话列表/只读/恢复走真实接口。不要为了摘要调模型。

脚本建议：

| 文件 | 内容 |
| --- | --- |
| `setup.cjs` | 建临时目录/启动后端/API 预置 large 交接包 + 打印 appId |
| `e2e.cjs` | UI 主流程 + 截图矩阵 + 错误/溢出/白底检查 + `summary.json` |
| `README.md` | 复跑命令与端口（放临时目录） |

UI 用例（真实后端）：

1. 未生成阶段：开发页出现“按阶段开发”（顶栏 + 开始卡片），点击 → 确认弹窗含阶段数/不门禁/不自动发送 → 生成 → 阶段条出现、`已完成 0/4`。
2. 开始阶段 1：确认弹窗 → 会话创建（时间线空、Composer 有阶段 brief 且未发送）→ 列表项 `阶段 1 · 数据模型与基础框架` chip → 右侧阶段行。
3. 开始阶段 2：提示会归档当前会话 → 阶段 1 会话 archived、阶段 2 active；阶段条显示 `阶段 2/4`；列表两枚阶段 chip。
4. 完成阶段 1（无 assistant，不调模型）：状态 completed、当前会话不归档；重复完成幂等可选；`phase-bar-hint` 文案按 `phaseCompletionHint`。
5. 跳过阶段 3、重新打开阶段 1；状态与按钮切换正确。
6. 阶段会话归档只读：选中阶段 1 归档会话 → 只读横幅/Composer 只读；阶段操作禁用（`phaseActionState` reason）。
7. 恢复阶段 1 会话 → active；阶段条跟随。
8. 历史交接包只读：`page.route('**/development/phases*', ...)` 注入 `handoffVersion:1` + 阶段 `handoffVersion:1`，并注入 `GET /development`（`handoff.version=2`）→ 打开阶段弹窗 → 四个操作禁用且 `phase-readonly-reason` 可见（不请求真实后端改状态）。
9. 空状态：普通（非 large）交接包 → 不显示“按阶段开发”/阶段条（可用第二个小交接包或 route 注入 `canGenerate:false, generated:false`）。

截图矩阵：浅/深 × 1440/1024/768，覆盖：未生成入口、阶段条（进行中/已完成/全部完成提示）、阶段弹窗（列表+详情+摘要+只读）、开始卡片阶段列表、会话列表 chip、只读会话、历史只读。断言：

- 0 console error / 0 pageerror；
- 0 非预期 API >= 400（历史只读用 route 注入，不产生 409；若真实触发 409，需在脚本显式标记预期）；
- 0 横向溢出（`scrollWidth > clientWidth + 1`）；
- 深色下无白底块（允许既有原型白纸元素）；
- 弹窗在视口内、内部滚动可用。

---

## 5. 验证命令

```powershell
npm test --prefix frontend
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm run check:vue --prefix frontend
npm run build --prefix backend
npm test --prefix backend
```

- 前端测试基线 69，新增 `phase-labels.test.mjs` 后应 69 + N（N≥8）；后端保持 145/145（未改后端）。
- Playwright 结果写入临时目录 `summary.json`，回传 totals（截图数/错误数/溢出数/白底数）。

---

## 6. 不做 / 边界

- 不改后端任何文件（`backend/src/dev/**`、表、manifest、API、冒烟）；若发现契约缺口，停止并回传，不自行改后端。
- 不做 U7-3 真实模型摘要验证；完成阶段时若真实会话已有 assistant 文本会触发后端摘要模型调用，**Playwright/回归避免**（用无 assistant 的新会话或 route mock）。
- 不自动生成阶段、不自动发送阶段 brief、不自动完成应用、不加阶段门禁/Git/证据/批次。
- 不新增第二套会话模型/并发会话；不改需求/设计/交接包/Change Set/`05-CHANGES`/AI 页面集。
- 不迁移旧阶段/旧会话；旧交接包无阶段 UI。
- 不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交；不污染真实 `data`/`projects`。

---

## 7. 回传模板（实施完成后填 §8）

实施完成后：

1. 本交接单新增 `## 8. 实施结果`：改动文件、命令/结果、与交接单偏差、未验证项、需决策。
2. 更新 `docs/STATUS.md`：摘要表 U7-2 行 + 总状态/前端测试数；U7-3 待验证。
3. 更新 `docs/plans/2026-11-12-u7-phased-development-design.md` 状态表（U7-2 已实施）与 §8 实施备注。
4. 更新 `docs/plans/2026-11-09-stage-ux-and-dev-session-design.md` §4.3.3 状态。
5. 回传主会话：文件、命令、Playwright 路径与 totals、未验证、偏差、需决策。

**不要**更新 `AGENTS.md`/主交接单（由主会话评审后统一更新）。

---

## 8. 实施结果

实施会话：2026-11-12（U7-2 前端）。**后端零改动**（未改 `backend/**`、表、API、manifest、冒烟）。

### 8.1 改动文件

| 文件 | 内容 |
| --- | --- |
| `frontend/src/dev/types.ts` | 新增 `DevPhaseStatus/DevPhaseKind/DevPhaseSummarySource/DevPhaseRef/DevPhaseScope/DevPhaseSessionSummary/DevPhaseView/DevPhasesResponse/DevPhaseStartResponse/DevPhaseCompleteResponse`；`DevSessionInfo.phase`、`DevSessionListItem.phaseId/phaseKey/phaseTitle/phaseOrder/phaseStatus`、`DevStateResponse.phases` 必填 |
| `frontend/src/dev/api.ts` | `getDevPhases/generateDevPhases/startDevPhase/completeDevPhase/skipDevPhase/reopenDevPhase`；`promptDevSession` 返回 `{ ok, phase?, warning? }`；全部走既有 `request()`/`DevApiError` |
| `frontend/src/dev/phase-labels.js` | 新建：状态文案/class、`phaseOrderLabel`、`phaseRefLabel`、`phaseChipLabel`、`phaseScopeLabel/Detail`、`phaseProgress`、`phaseCompletionHint`、`phaseActionState`、`phaseGenerateConfirmText`、`phaseStartConfirmText`、`phaseSummarySourceLabel` |
| `frontend/src/dev/phase-labels.test.mjs` | 新建 9 项单测（状态映射/序号/ref+chip/范围/进度/提示/生成确认/action 矩阵/开始确认/摘要来源） |
| `frontend/package.json` | `test` 列表加入 `src/dev/phase-labels.test.mjs` |
| `frontend/src/dev/PhaseBar.vue` | 新建：时间线上方阶段条（当前阶段/状态/`已完成 x/y`、选择阶段/查看范围/完成/跳过/重新打开、全部处理提示、只读或历史交接包的禁用 + 原因） |
| `frontend/src/dev/PhaseDialog.vue` | 新建：左阶段列表 + 右详情（goal/范围/状态/起止/摘要+来源/会话/handoff/变更单）、操作按钮、只读原因、内部滚动、≤820 上下堆叠、Esc/遮罩关闭 |
| `frontend/src/dev/DevView.vue` | 接入 PhaseBar/PhaseDialog；未生成“按阶段开发”（顶栏 + 开始卡片）；生成后开始卡片阶段快捷列表 + 折叠普通会话；开始/完成/跳过/重新打开（二次确认、409 提示、`phaseWarnings`）；`send()` 提示 warning 并刷新；右侧“阶段”行；`appId` 切换清空；阶段样式/响应式 |
| `frontend/src/dev/SessionList.vue` | 会话项阶段 chip（`phaseChipLabel`，`title` 完整标签，`--rg-ai-soft/--rg-ai`）；搜索仍只按标题/备注 |

### 8.2 命令/结果

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | ✅ **78/78**（基线 69，+9） |
| `npm run typecheck --prefix frontend` | ✅ |
| `npm run build --prefix frontend` | ✅ |
| `npm run check:vue --prefix frontend` | ✅ |
| `npm run build --prefix backend` | ✅（未改后端） |
| `npm test --prefix backend` | ✅ **145/145**（未改后端） |

Playwright（临时目录 `C:\Users\icecream\AppData\Local\Temp\opencode\u7-2`，`data/`+`projects/` 均在临时目录；真实后端 `PORT=3431`、opencode 2.2.5 `4431`，**不调模型**）：

- 预置 `u72-phases`（3 Epic / 10 Story / 3 实体 / 12 页面 → large，4 阶段）与 `u72-small`（1 Epic / 3 Story / 2 实体 / 4 页面 → normal，无阶段）。
- 功能流程（浅色 1440）：未生成入口 → 确认文案（阶段数/不门禁/单会话/不自动发送）→ 生成 → 开始阶段 1（brief 进 Composer、未发送、时间线空、chip/右侧阶段行）→ 开始阶段 2（确认提示归档；阶段 1 归档、阶段 2 active）→ 完成阶段 1（无 assistant → 无摘要、不归档）→ 完成 2/4、跳过 3 → `阶段均已处理（含跳过）` → 重新打开 1 → 归档阶段会话只读（阶段操作禁用 + `会话只读`）→ 恢复阶段 1 → 阶段条跟随；应用状态仍 `development`（不自动完成）。
- 截图矩阵：浅/深 × 1440/1024/768；覆盖未生成入口、开始卡片阶段列表、阶段条（进行中/全部处理）、阶段弹窗（摘要回退/历史只读）、会话列表 chip（1024 抽屉）、只读会话、普通交接包无阶段。
- 结果：**73 张截图**，`totals = { shots: 73, consoleErrors: 0, pageErrors: 0, unexpectedApiErrors: 0, whiteSurfaces: 0, overflows: 0, failures: 0 }`；`summary.json` 在临时目录（`shots/`、`summary.json`、`snapshots/`、`setup.cjs`、`e2e.cjs`）。

### 8.3 与交接单的偏差

1. 开始卡片的“按阶段开发”用 `data-testid="phase-generate-card-btn"`（顶栏为 `phase-generate-btn`）。交接单写“同一按钮”，但两者可同时可见，重复 testid 会让 Playwright 选择器歧义；动作同一个 `generatePhases()`。
2. 阶段条“查看范围”额外带 `data-testid="phase-bar-scope"`（交接单未列，便于验证）。
3. 补了 `phaseSummarySourceLabel`（交接单 §2.3 未列），供弹窗摘要来源（模型/回退/无摘要）展示并加单测。
4. 完成/跳过/重新打开**不** `emit('app-changed')`（不改 `apps.status`）；开始阶段 emit（外壳刷新）。交接单写“全部 emit（视情况）”。
5. `phaseWarnings` 除 toast 外增加时间线提示条 `data-testid="phase-warnings"`（摘要失败原因可见；不阻塞）。
6. 当前 UI **没有**历史交接包版本切换入口：阶段数据固定取最新交接包；历史只读（`phase.handoffVersion !== handoff.version`）由 Playwright 路由注入验证（与交接单 §4 用例 8 一致）。
7. 阶段条 `phase-bar-reason` 仅在存在当前阶段时显示（无当前阶段时不显示“会话只读”，仅显示“按阶段开发 · 选择阶段开始”）。

### 8.4 未验证 / 需决策

- 未做 U7-3：未重跑 `smoke:dev-phases`/`smoke:dev-sessions` 等 7 支回归；真实 opencode 2.2.5 只通过 UI 走“建阶段会话/切换/归档只读/恢复”，未覆盖 complete 时的真实摘要模型调用（按交接单避免成本）。
- 真实模型摘要质量、60s 超时 fallback、`design`/`req` 只读 agent 可用性未实机验证（后端 U7-1 已用 stub 覆盖）。
- <768 移动端、真实长会话滚动/对比度未专项复测；深色/浅色仅在 1440/1024/768 三档截图。
- 需决策（不阻塞）：是否加“摘要失败重试”入口（当前 reopen→complete 可重生成）；全部阶段完成时是否在阶段条再加“确认完成开发”快捷入口（当前只提示，主按钮在 AppShell 顶栏）。

### 8.5 主会话复核修复

主会话复核发现 1 项 must-fix（仅前端）：

- **问题**：`DevView.vue` 的 `loadPhases()` 用 `if (phasesLoading.value) return` 丢弃并发请求。`refresh()` 每 5s 会 `void loadPhases()`，而 `refreshAfterPhaseChange()`/`startPhase()`/`send()` 也会调用；若轮询或旧请求在飞行中，完成/跳过/重新打开或 prompt 自动重开后的刷新会被静默丢弃，阶段条/弹窗可能保持旧状态直到下一次轮询；慢 `complete`（摘要最长 60s）时旧响应还可能最后返回并覆盖新数据。
- **修复**：改为请求序号——`let phasesSeq = 0`；`loadPhases()` 内 `const seq = ++phasesSeq`，响应只在 `seq === phasesSeq` 时写入 `phasesData`；删除 `phasesLoading` 及“加载中丢弃”的判断；`appId` watch 中 `phasesSeq += 1` 并清空阶段数据，确保上一应用的挂起响应不会落到新应用。无接口/行为/后端改动。
- **验证**：`npm test --prefix frontend` **78/78**、`typecheck`/`build`/`check:vue` 通过；`npm test --prefix backend` **145/145**（未改后端）；重置应用后重跑 `C:\Users\icecream\AppData\Local\Temp\opencode\u7-2\e2e.cjs`（真实 opencode 2.2.5，不调模型）：`totals = { shots: 73, consoleErrors: 0, pageErrors: 0, unexpectedApiErrors: 0, whiteSurfaces: 0, overflows: 0, failures: 0 }`（`e2e-after-fix.log` / `summary.json` 在临时目录）。
- 未验证：并发竞态的极端时序（慢响应最后到达）没有专门的自动化注入用例，仅由序号逻辑保证；其余未验证项同 §8.4。

### 8.6 主会话评审结论（2026-11-12）

**结论：U7-2 可以验收。** 主会话独立复核（未复用实施会话输出）：

- 前端 `npm test` **78/78**、`typecheck`/`build`/`check:vue` 通过；后端 `build` + `npm test` **145/145**（后端零改动）；`smoke:dev-phases`/`smoke:dev-sessions`/`smoke:dev-health`（真实 opencode 2.2.5，不调模型）通过。
- 临时目录 `C:\Users\icecream\AppData\Local\Temp\opencode\u7-2` 重置临时数据后 `setup.cjs` → `e2e.cjs`：**73 张截图**，`consoleErrors=0/pageErrors=0/unexpectedApiErrors=0/whiteSurfaces=0/overflows=0/failures=0`；功能流程覆盖生成、开始 1/2、完成、跳过、重新打开、归档只读、恢复、普通交接包无阶段，应用保持 `development`。
- 代码复核：类型/API 与 U7-1 契约一致；开始阶段不自动发送；完成不归档；`phaseActionState` 与后端状态语义一致；只读/历史禁用有原因；`--rg-*` token、1024/768 折行、≤820 弹窗堆叠、内部滚动；无一级导航变化。
- 评审 must-fix（1 项，已修并复验）：`loadPhases` 并发丢弃/旧响应覆盖 → 请求序号 + `appId` 失效（§8.5）。
- 接受偏差：双 testid、`phase-bar-scope`、`phaseSummarySourceLabel`、无历史版本切换入口、完成/跳过/重新打开不 emit `app-changed`。
- 未验证（不阻塞验收）：长会话摘要/60s 边界、<768 移动端、真实历史交接包版本切换（当前 UI 不提供，后端 409 已覆盖）。U7-3 已于 2026-11-12 验证通过（真实 model 摘要 + fallback + P2）。
- 可选后续（不阻塞）：摘要失败重试入口；全部阶段完成时阶段条加“确认完成开发”快捷入口。

仓库真实数据未污染：`apps=0`、`projects/` 空；未读取/打印/提交真实凭据。

