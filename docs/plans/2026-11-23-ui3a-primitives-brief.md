# UI-3a：按钮 / 图标 / chip 原语（实施交接单）

> 日期：2026-11-23。延续 UI-1/UI-2 的 **A+B 混合、中等密度、轻量图标式**。本批新增共享原语并把**顶层**按钮/图标/chip 统一到原语；不碰消息/工具/权限/表单卡片 DOM（UI-3b/UI-4）、不碰 Studio/模板中心内部（UI-4）、不改 `design-preview`/`template-preview` 渲染。用户已确认：按钮 **32 高 / 圆角 8 / 13 字**、图标替换为 Element Plus 图标、状态 chip **24 高 / 11.5 字 / 圆点 + 文案**。

## 1. 范围与硬约束

**做**

- 新增 `frontend/src/shared/RgButton.vue`、`frontend/src/shared/RgChip.vue`、`frontend/src/shared/ui.css`（`App.vue` 全局引入）。
- 顶层替换：`AppShell`、`HomeShell`、`RequirementsView`、`RequirementsOutline`、`DesignView`、`DevView`、`AgentChatPanel`、`SessionList`。
- 文本符号图标替换：`←`→`ArrowLeft`、`⋯`→`MoreFilled`、`☰/▤`→`Fold`/`Expand`+`Memo`、`›`→`ArrowRight`。
- 新增 `backend/scripts/ui3a-shots.ts`（独立端口 + stub）+ 文档。

**不做**

- 不改后端/DB/API/依赖/`templates/**`；不改业务逻辑/数据流。
- 不改消息/工具/权限/表单卡片 DOM（UI-3b/UI-4）；不改 `StudioView`/`DesignTemplateCenter`/`NewAppDialog` 内部（UI-4）。
- 不改 `design-preview`/`template-preview` 渲染；`⇄` 仅保留在消息/时间线 notice。
- 不启停真实 3300/4771；不调模型；不读写真实 `data/`/`projects/`/`.env`；不做任何 git 操作。
- 不改既有 testid、按钮文字/可访问名称、URL/导航、会话/权限/表单/停止/compact 行为。

## 2. 共享原语 API

### `RgButton`

| prop | 取值 | 说明 |
| --- | --- | --- |
| `variant` | `primary` / `secondary` / `ghost` / `danger` | 默认 `secondary` |
| `size` | `sm` / `md` / `lg` | **28 / 32 / 36** 高；`md` 默认 |
| `icon` | Element Plus 图标组件 | 渲染在文字前；`iconOnly` 时只显示图标 |
| `iconOnly` | `boolean` | 加 `.rg-btn--icon`（正方形）；必须有 `aria-label`/`title` |
| `ariaLabel` | `string` | `iconOnly` 时优先作为可访问名称，否则回退 `title` |
| `loading` | `boolean` | 显示 spinner + 原文字；`iconOnly` 时仅 spinner |
| `disabled` | `boolean` | `disabled || loading` 均禁用 |
| `title` | `string` | tooltip |
| `type` | `button` / `submit` / `reset` | 默认 `button` |

- 渲染 `<button class="rg-btn rg-btn--<variant> rg-btn--<size> [rg-btn--icon]">`；`v-bind="$attrs"` 透传 `data-testid`/aria/class/style（`inheritAttrs:false`）。
- 统一 hover/active/focus-visible/disabled；暗色主按钮由 `--rg-ink`/`--rg-ink-contrast` token 自动反转为「浅墨 + 深字」。
- 返回入口保留 `<a>`，套 `.rg-btn rg-btn--ghost rg-btn--icon rg-btn--sm` + `ArrowLeft`（仍是 link 角色，`aria-label=返回应用列表`）。

### `RgChip`

| prop | 取值 | 说明 |
| --- | --- | --- |
| `tone` | `neutral` / `ai` / `ok` / `warn` / `danger` / `ink` | 默认 `neutral`；只复用现有 `--rg-*` token |
| `size` | `sm` / `md` | **22 / 24** 高；`md` 默认 |
| `dot` | `boolean` | 默认 `true`（圆点用 `currentColor`） |
| `icon` | Element Plus 图标组件 | 可选，与 `dot` 并存 |
| `title` | `string` | tooltip |

- 24 高（md）/11.5 字/圆点 + 文案；`$attrs` 透传 `data-testid`。
- 圆点是无文本 `<span>`，`innerText` 仍只含文案（不破坏 `context-chip` 含 `90%`、`chat-status` 含「本轮完成」等断言）。

### `ui.css`（仅工作台主入口）

- `.rg-btn` / `.rg-chip` 浅/深色；主按钮暗色用浅墨 + 深字。
- `.el-button` 全局统一：高度 **32**、圆角 **8**、字号 **13**、focus-visible ring；`.el-button--small` **28**、`.el-button--large` **36**；不覆盖 `--el-color-primary` 语义。
- 只在 `App.vue` 引入，`preview.html`/`design-preview.html`/`template-preview.html` 各自入口不加载。

## 3. 顶层替换点

| 文件 | 替换 |
| --- | --- |
| `AppShell.vue` | 返回 `<a>`+`ArrowLeft`；模型（Cpu+文字）；主题（Moon/Sunny，iconOnly）；更多（MoreFilled，iconOnly，`app-more`）；状态 chip（`app-status`，md 24）；模板/风格 chip（`app-design-chip`，`dot=false`） |
| `HomeShell.vue` | hero 新建应用（primary lg）/模板库/设计模板；主题 icon；快捷开始 3 项（ghost + 结构保留）；应用卡状态 chip（sm）；「打开」/更多；`›`→`ArrowRight`；运行状态 chip（`home-runtime-state`，sm，tone 按 ready/starting/失败） |
| `RequirementsView.vue` | 模块/对话/模板库/刷新（sm）；`artifact-issues` chip（danger sm）；「让 AI 修」（danger sm）；错误重试；空态「新建模块」（primary） |
| `RequirementsOutline.vue` | 「新建模块」（primary sm + `Plus`）、改名/上移/下移（sm） |
| `DesignView.vue` | 模块/对话抽屉；模板页面库；生成/更新设计（primary，loading）；重新导出（loading）；刷新；`design-fix-with-ai`；过期/导出失败重试；空态 CTA |
| `DevView.vue` | `☰`→`Fold`/`Expand`（`dev-sidebar-toggle`）；`▤`→`Memo`（`dev-aside-toggle`）；模型 chip（`dot=false`）；上下文 chip（tone=ok/warn/danger）；压缩（needsCompact 时 danger + loading）；新会话；运行状态 chip（`dev-status`）；开始开发（primary + loading）；错误重试；只读「恢复为当前会话」；侧栏刷新/检查一致性/打开模板中心 |
| `AgentChatPanel.vue` | 状态 chip（`chat-status`）、上下文 chip（`context-chip`）、压缩/新会话、错误「重试/关闭」、85% 横幅两个动作、空态 CTA、只读「切换为当前会话」、命令按钮（`chat-command-*`） |
| `SessionList.vue` | 「新会话」（primary sm）；`status-chip`（tone active=ok/archived=neutral/stale=danger）；重命名/归档/恢复（`session-*`）；`›`→`ArrowRight` |

未动：`StudioView`、`DesignTemplateCenter`、`NewAppDialog` 内部；`AppShell` 三段视图导航按钮（保留原 active 下划线语义）；`DesignView` 的 ER/原型 tab；消息/工具/权限/表单卡片、`Composer`。

## 4. 图标替换清单

| 原文本 | 替换 | 位置 |
| --- | --- | --- |
| `←` | `ArrowLeft` | AppShell 返回 |
| `⋯` | `MoreFilled` | AppShell / HomeShell 更多 |
| `☰` | `Fold` / `Expand` | DevView 会话列表开关 |
| `▤` | `Memo` | DevView 会话信息开关 |
| `›` | `ArrowRight` | HomeShell 应用卡、SessionList 分组 |

保留：`⇄` 在 `DevView`/`AgentChatPanel` 的消息/时间线 notice（属 UI-3b 范围）；`×` 是文案「应用类型 × 视觉风格」的乘号，不是图标。

## 5. 截图证据

脚本 `backend/scripts/ui3a-shots.ts`。前置 `npm run build --prefix frontend`；运行（backend 目录）：

```bash
npx tsx scripts/ui3a-shots.ts
```

- 复用 `p2-e2e-harness.ts`（真实后端 + 临时 SQLite/projects + `OPENCODE_AUTO_START=false` + stub opencode）；端口 **3436**（opencode 4436），不占用真实 3300/4771。
- 每屏校验 `documentElement.scrollWidth`/`body.scrollWidth` 不超视口；外壳额外断言更多按钮 32 高、状态 chip 24 高、模型按钮 32 高。
- 输出 `docs/plans/evidence/2026-11-23-ui3a/`（可用 `UI3A_SHOTS_DIR` 覆盖）。

| 截图 | 说明 |
| --- | --- |
| `ui3a-home-1440.png` | 首页（hero CTA / 应用卡 chip / 快捷开始 / 运行状态） |
| `ui3a-shell-1440.png` | 应用外壳 + 需求工具栏（返回/模型/主题/更多/状态与模板 chip/按钮） |
| `ui3a-requirements-1440.png` | 需求视图 |
| `ui3a-chat-panel-1440.png` | AI 对话面板（头部 chip + 命令按钮） |
| `ui3a-design-1440.png` | 设计视图 |
| `ui3a-dev-1440.png` | 开发视图 |
| `ui3a-shell-1024.png` / `ui3a-requirements-1024.png` / `ui3a-dev-1024.png` | 1024 外壳/需求/开发 |
| `ui3a-home-390.png` / `ui3a-shell-390.png` / `ui3a-requirements-390.png` / `ui3a-dev-390.png` | 390 首页/外壳/需求/开发 |

## 6. 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | **189 / 189** |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 成功 |
| `npm run check:vue --prefix frontend` | 通过（全部 SFC 导入完整） |
| `npm run e2e:p2 --prefix backend` | **120** 条断言，通过 |
| `npm run e2e:p3 --prefix backend` | **131** 条断言，通过 |
| `npm run e2e:p4 --prefix backend` | **130** 条断言，通过 |
| `npm run e2e:p7-3b --prefix backend` | **77** 条断言，通过 |
| `npm run e2e:p7-7b --prefix backend` | **73** 条断言，通过 |
| `npm run e2e:p7-7c --prefix backend` | **116** 条断言，通过 |
| `npx tsx scripts/ui3a-shots.ts`（backend） | **13 张截图 + 12 次无溢出校验**，通过 |

结束核对：测试端口无残留监听；真实 3300（PID 14988）/4771（PID 27968）未启停。未跑后端单测（未改 `backend/src`）。

## 7. 偏差与未验证

- 只替换**顶层**；表格/分页/表单内部保持 EP 全局规则（`.el-button` 尺寸统一），深层组件统一留后续批次。
- 应用外壳视图导航仍是原按钮（active 2px 下划线语义），未套 `RgButton`；设计视图 ER/原型 tab 也未改（分段控件语义）。
- `AppShell` 返回入口保留 `<a>`（link 角色）而非 `RgButton`，以免破坏 e2e 的 `getByRole('link', { name: '返回应用列表' })`。
- `⇄` 保留在消息/时间线 notice（UI-3b）；Studio/模板中心内部未动（UI-4）。
- 真实 3300/4771 视觉需用户刷新/重启后复核（本轮 `frontend/dist` 已重建，静态托管即时生效）；未做像素级视觉回归；未验证 320px 及更窄视口。
