# Agent-First 工作台 P2「需求视图」实施交接单（2026-11-18）

> 上游：`docs/plans/2026-11-18-agent-first-workbench-design.md` v3（§3 文件契约、§5 commands、§7 变化检测、§8 视图行为/会话/上下文、§9.2 接口）。
> P1 已完成并通过评审（后端 71/71、前端 23/23、`smoke:workspace`/`smoke:assets` 通过）。
> 本单只做 **需求视图**（替换占位页）；设计视图仍为占位（P3），开发视图不动（P4）。
> 真实 3300 保持旧构建、不重建不重启；全部验证用临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` + 独立端口。

---

## 0. 出口标准

1. 需求视图不再是占位页：**模块大纲 + 文档渲染 + AI 对话** 三栏（≥1280）；1024/768 用互斥抽屉。
2. 模块操作全部直接操作文件、**不写 DB**：新建（按模板生成 frontmatter+章节）、改名、排序（上/下）、切换模板；刷新后保持；UI **不提供删除**。
3. 文档渲染：选中模块标题 + 章节正文（`MarkdownView`），章节 TOC 可点击定位；显示文件名/模板徽标。
4. artifacts 错误/警告可读：顶部黄条列出 `文件 · 字段 · 说明（期望）`，带「让 AI 修」；模块级错误/警告在列表与文档头可见。
5. 对话可用：流式文本、工具/命令活动、权限卡、表单卡、停止、上下文健康度 + compact、历史下拉（最近 5 个 + 新建）、85% 红线的「压缩后继续 / 开新会话继续」。
6. 对话能带上下文：`view=requirements` + 当前模块 + 命令（`update-requirements` / `check-consistency`）。
7. `docs/` 文件变化后 **≤1.5s** 视图自动刷新（SSE），外部改文件也生效。
8. 模板库入口可用（需求模板 CRUD + 「同步到应用」；原型模板本批只读/走 API）。
9. 测试：前端单测 + Playwright（stub 后端；浅/深 × 1440/1024/768，0 console/page error、0 意外 API≥400）；后端/前端 `build`/`typecheck`/`check:vue` 通过。
10. 不改 P1 已定的文件契约、不引入版本/确认/变更单/交接包/协议 JSON。

## 1. 不做

- 设计视图 UI、ER/原型渲染（P3）；开发视图改动（P4）。
- 版本、确认、变更单、交接包、覆盖度、stale、阶段门禁。
- 模块删除（UI 不提供；由用户在对话里让 agent 删）。
- 原型模板 CRUD UI（走 API；P3 再评估）。
- `<768` 移动端；MCP/插件/自定义 tool。

## 2. 复用与少量后端扩展

### 2.1 后端（只做两件事）

1. `backend/src/dev/service.ts#promptDevSession`：
   - 入参新增 `module?: unknown`、`command?: unknown`；
   - `command` 存在时走 `opencode.runCommand(sessionId, command, text)`；
   - 否则 **requirements/design 视图**用 `buildViewPrompt(view, text, module)` 组 prompt（development 保持原文，P4 再统一）；
   - 返回 `{ ok, warning?, command? }`（沿用现有形状即可）。
2. `backend/src/dev/routes.ts#POST /prompt`：body 透传 `module`、`command`。
3. 测试：`dev/service.test.ts` 增加 command 分支 + requirements 视图 prompt 含产物路径/模块的断言（stub opencode，不调模型）。

> 会话 API 仍沿用 `/api/apps/:id/development` + `view`（P1 已有）；事件 `/development/events?view=requirements`；状态 `/development?view=requirements`；compact `/development/compact`；权限/表单回复带 `view`。

### 2.2 前端复用

- 直接复用：`shared/MarkdownView.vue`、`dev/{StepCard,ToolCard,PermissionCard,FormCard,Composer}.vue`、`dev/api.ts`（会话/事件/权限/表单/compact）、`workbench/api.ts`（artifacts/模块/连接事件）、`workbench/TemplateLibraryDialog.vue`、`shared/theme.css` 的 token。
- 需要新增：`workbench/AgentChatPanel.vue`（可被 P3 复用）与需求视图组件。

## 3. 需求视图布局

```
┌ 工具栏：模板库 · 刷新 · 同步状态 · 错误数 ───────────────────────────┐
├ 模块大纲(260) ┬ 文档（flex） ─────────────────┬ AI 对话(380) ───────┤
│ + 新建模块    │ # 模块标题  [模板徽标] [file]  │ 会话下拉 / 新会话    │
│ MOD-001 商品  │ 章节 TOC（sticky）             │ 健康度 chip / compact│
│ MOD-002 订单  │ Markdown 正文（按章节）         │ 时间线（工具/权限）  │
│ 上移/下移     │ 设计摘要：实体 N / 页面 N      │ Composer + 命令按钮  │
└───────────────┴───────────────────────────────┴──────────────────────┘
```

- 模块项显示：`key`、标题、章节数、模板徽标、错误/警告点；选中高亮。
- 「+ 新建模块」弹窗：标题 + 模板（默认应用默认模板）→ `POST /requirements-modules`；成功后选中新模块并刷新。
- 改名：弹窗 → `PATCH title`；上/下移：与相邻项交换 `order`（`PATCH order`）。
- 切模板：选择模板 → `PATCH template`；提示「模板已切换；如需按新模板重排章节，请发送 /update-requirements」。
- 空态：无模块 → 说明 + 「新建模块」+ 三个示例指令（可点击填入 Composer）。
- 设计摘要：只用 `artifacts.designs` 统计（实体/页面数），点击「去设计」切到设计视图（P3 前是占位页）。

## 4. AgentChatPanel（view + module + 命令）

- 状态：`GET /development?view=requirements&sessionId?` → `steps`（归一化时间线）、`pending.permissions/forms`、`context`、`activeSession`。
- 事件：`connectDevEvents(appId, onEvent, onConnection, view)`；收到任意事件 400ms 防抖刷新状态；`session.idle`/`execution.*` 立即刷新。
- 发送：`promptDevSession(appId, text, view, { module, command? })`（扩展 `dev/api.ts` 签名）。
- 停止：`interruptDevSession(appId, view)`；compact：`compactDevSession(appId, view)`。
- 权限/表单：复用 `PermissionCard`/`FormCard`，回复时带 `view`。
- 历史：轻量下拉 = `listDevSessions(view)` 最近 5 个 + 「新建会话」（`createDevSession({new:true, view})`）；切换 `activateDevSession`。
- 命令按钮：「更新需求」→ command `update-requirements`（参数为当前模块 key）；「检查一致性」→ `check-consistency`；发送前若正在生成则禁用。
- 上下文：chip 显示百分比；`context.level === 'danger'`（≥85%）显示非阻塞横幅：
  - **[压缩后继续]** → compact；
  - **[开新会话继续]** → 新建会话 + **把确定性衔接文案填进 Composer（不自动发送）**。
- 只读/禁用：SSE 进行中禁用重复发送与命令；错误帧显示可关闭错误条。
- 渲染：assistant 文本用 `MarkdownView`；工具/命令活动用 `StepCard`/`ToolCard`（折叠默认收起）；用户消息右对齐。

## 5. 文档渲染与错误

- 选中模块 → `# title` + 每个 section 用 `##/### title` + `markdown` 拼成整篇，交给 `MarkdownView`；TOC 点击滚动到对应标题锚点。
- 顶部错误条（`data-testid="artifact-warning-strip"`）：合并 artifacts.errors + 当前模块 warnings（去重）；「让 AI 修」把 `文件 · 字段 · 说明（期望）` 截断后填入 Composer（不自动发送）。
- 文件变化：SSE 后刷新 artifacts；若当前模块被删除/改名，回退到第一个模块并提示。

## 6. 模板库

- 工具栏「模板库」打开 `TemplateLibraryDialog`（P1 已有）；关闭后刷新 artifacts 与当前模块模板徽标。
- 切模板只改 frontmatter + 确保副本存在（P1 API）；不自动重写正文。

## 7. 响应式 / 主题

- ≥1280：三栏；1024：大纲抽屉 + 对话抽屉（互斥、遮罩、Esc）；768：单栏 + 顶部两个抽屉按钮；Composer 贴底。
- 深浅色全部用 `--rg-*` token；文档/对话区内部滚动，页面无横向溢出。

## 8. 测试与验收

| 项 | 要求 |
| --- | --- |
| 前端单测 | 模块排序/交换、文档拼装与锚点、错误行拼接、会话下拉状态、85% 文案（纯函数抽到 `requirements-helpers.js` / 复用 `view-helpers.js`） |
| 后端单测 | `dev/service` 的 command 分支、requirements/design 视图 prompt 含路径与模块；不调模型 |
| Playwright（stub 后端） | 见下；浅/深 × 1440/1024/768，0 console/page error、0 意外 API≥400、0 横向溢出 |
| 真实模型 E2E | 主会话另跑（临时实例）：新建应用 → 需求对话让 agent 生成模块文档 → 视图渲染 → 修改后刷新 |

Playwright 场景（≥35 断言）：
1. 空态 → 新建模块（标题+模板）→ 文件出现、大纲/文档渲染、`docs/requirements/MOD-001-*.md` frontmatter 正确。
2. 新建第二个模块 → 上/下移 → 重新加载顺序保持；改名 → 文件名与 H1 同步。
3. 切模板 → frontmatter `template` 变化 + 提示文案；模板副本存在。
4. 文档 TOC 点击定位；章节标题与 `##` 一致。
5. 错误：写入非法 frontmatter/design.json → 错误条出现、内容含文件/字段/期望；「让 AI 修」把摘要填入 Composer。
6. 对话：发送 → 流式文本逐段出现 → 完成后状态刷新；工具卡出现且可展开。
7. 权限卡：stub 触发 → 允许/拒绝 → 卡片消失、后续文本继续。
8. 命令：点「更新需求」→ 后端收到 `command=update-requirements`（stub 断言）；生成中重复点击被禁用。
9. 停止：生成中点击停止 → 时间线显示中止且可继续输入。
10. 上下文：stub 注入 90% → 红 chip + 横幅；「压缩后继续」调用 compact；「开新会话继续」新建会话并填充衔接文案（不自动发送）。
11. 历史：新建第二个会话 → 下拉切换 → 时间线切换。
12. 外部改文件（Node fs）→ ≤1.5s 文档自动刷新。
13. 模板库弹窗打开/关闭、同步按钮可用。
14. 1024/768 抽屉互斥与 Esc；1440/1024/768 × 浅/深截图。

stub 后端建议：新增 `backend/scripts/p2-e2e-harness.ts`（tsx，仅测试用）：临时 `RG_*`、端口 3422、`OPENCODE_AUTO_START=false`、进程内 stub `opencode`（createSession/subscribe/prompt/runCommand/compact/permission reply），按用户文本触发固定事件序列（文本/工具/权限/表单/90% 上下文/中止）。**不进生产路由**。

## 9. 交付

- 完成后回填 `docs/STATUS.md` 与 P2 brief 的「实施结果」：改动文件、测试数、命令、偏差、未验证项。
- 主会话复核通过后再开 P3（设计视图：ER + 原型 + `/generate-design` 接线）。

## 10. 风险

1. 时间线归一化依赖 `/development` 状态；大文档/长会话刷新成本高 → 防抖 400ms、只在必要时全量刷新。
2. stub 事件与真实 opencode 事件形状可能不完全一致 → stub 必须复用 P1 真实事件名（`session.text.delta`/`session.text.ended`/`session.execution.succeeded`/`permission.asked`/`form.*`）。
3. 抽屉 + 三栏同时存在时滚动冲突 → 各面板独立滚动容器。
4. 模块排序用交换 order，可能出现相同 order → 排序再按文件名稳定兜底（P1 已实现）。
5. 模板切换不重排章节 → 必须在 UI 明示，避免用户误以为已按新模板改写。

---

## 实施结果（2026-11-18，P2）

### 改动文件

**后端（2 处 + 测试）**
- `src/dev/service.ts`：`promptDevSession(appId, text, {view, module?, command?})`；command → `opencode.runCommand`；requirements/design → `buildViewPrompt`（当前视图 + 模块 + 产物路径 + skill）；development 保持原文；返回 `{ok, command?}`。
- `src/dev/routes.ts`：`POST /prompt` 透传 `module`/`command`（兼容 query `view`）。
- `src/dev/service.test.ts`：+2 个用例（command 分支/空文本规则；requirements/design prompt 含路径与模块、development 原文）。

**前端（新增/改）**
- 新增：`workbench/AgentChatPanel.vue`、`workbench/RequirementsView.vue`、`workbench/RequirementsOutline.vue`、`workbench/RequirementsDocument.vue`、`workbench/requirements-helpers.js` + `requirements-helpers.test.mjs`。
- 修改：`workbench/AppShell.vue`（requirements → 新视图）、`dev/api.ts`（`promptDevSession(text, view, {module, command})`）、`package.json`（测试清单）。
- 复用未改：`shared/MarkdownView.vue`、`dev/{Composer,StepCard,ToolCard,PermissionCard,FormCard}.vue`、`workbench/api.ts`、`workbench/TemplateLibraryDialog.vue`、`dev/api.ts` 既有接口。

**测试脚本 / 依赖**
- 新增 `backend/scripts/p2-e2e-harness.ts`（测试专用 stub 后端，不进生产路由）与 `backend/scripts/p2-e2e.ts`（Playwright 14 场景）。
- `backend/package.json` 增加 `e2e:p2`；根 `package.json` 增加 devDependency `playwright@^1.65.1`（下载 chromium-headless-shell 1255）。

### 验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend`（临时目录） | **73 / 73** |
| `npm test --prefix frontend` | **32 / 32**（新增 9 项纯函数测试） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过 |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode / 4719，不调模型） |
| `npm run e2e:p2 --prefix backend` | **104 条断言通过**；14 个场景；浅/深 × 1440/1024/768；0 console/page error、0 意外 API≥400、0 横向溢出；外部改文件 ≤1.5s（实测约 0.6—0.9s） |

### 14 个 Playwright 场景（实现对应）

1. 空态 → 新建模块（标题 + 模板）→ 文件/大纲/文档/frontmatter/6 章节。
2. 第二模块 → 上移/下移（文件 order 保持）→ 改名（文件名 + H1 同步）。
3. 切模板 → frontmatter 变化 + 文档头徽标 + 模板副本存在。
4. TOC 点击 + `#sec-1` 锚点与章节标题一致。
5. 写入非法 design.json → 错误条（文件/期望）≤1.5s → 「让 AI 修」填入 Composer → 删除后消失。
6. 慢速流式：先出现部分文本、完成后完整；工具卡出现。
7. 权限卡：允许一次 → 卡片消失 → 后续文本继续。
8. 表单卡：填写 → 提交 → 后续文本。
9. 命令：`update-requirements`（参数 MOD-001）与 `check-consistency` 到达 stub 后端。
10. 停止：长任务 → 停止 → 显示「已中止」且输入可用。
11. 90% 上下文：红 chip + 横幅；压缩后继续调用 compact；开新会话继续填衔接文案且未自动发送。
12. 历史下拉：新会话后 ≥2 项，切换后保持选中。
13. 外部 Node fs 改文件 → 大纲 ≤1.5s 刷新。
14. 模板库弹窗打开/关闭（同步按钮可用）；1024/768 抽屉互斥 + Esc；矩阵截图。

### 偏差

1. Playwright 用 `playwright` 库脚本（`e2e:p2`）而非 `@playwright/test` runner；截图默认写到系统临时目录（`%TEMP%/workbench-p2-shots`），不进仓库。
2. harness 为测试专用进程内 stub，不新增任何生产路由；场景关键词（`慢速`/`权限`/`表单`/`长任务`/`上下文90`）只存在于 stub。
3. TOC 锚点由 `applyHeadingAnchors` 在 MarkdownView 渲染后按 h2/h3 顺序补 id；MarkdownView 仍禁用原始 HTML。
4. 历史下拉用原生 `<select>`（最近 5 个）；无活跃会话时首条消息自动建会话。
5. 切模板只改 frontmatter + 分发副本，不重写正文；UI 提示发送 `/update-requirements`。
6. `update-requirements` 命令参数为模块 key；`check-consistency` 无参数。
7. 85% 横幅与健康度仅在需求对话面板；开发视图 P4 统一。

### 未验证项

- 真实模型 E2E（主会话另跑）：新建应用 → 需求对话生成模块文档 → 渲染 → 改文件后刷新。
- 真实 opencode 事件形状下的流式/权限/表单（stub 复用 P1 事件名）。
- 真实 3300（保持旧构建，未重启）。
- EOS 运行态。

### 环境确认

- 未启停/未重启真实 3300；未读写真实 `data/`/`projects/`/`.env`；全部使用临时目录与 3422/3416/3419/4719 端口。
- 未执行任何 git 操作；未调用真实模型（e2e 与单测均为 stub）。
