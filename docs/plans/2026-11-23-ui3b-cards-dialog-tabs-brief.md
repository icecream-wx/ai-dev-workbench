# UI-3b 交接单：卡片/面板 + dialog + tabs 统一（2026-11-23）

> 方向：沿用 UI-1/UI-2/UI-3a 的 **A+B 混合、中等密度**。本轮只做前端 shared/workbench/dev 的卡片/面板、Element Plus 与自定义对话框壳、顶层 tabs；**不改**后端/DB/API/依赖/`templates/**`，不改业务逻辑/数据流，不改消息/工具/权限/表单卡片 DOM（UI-4/5）、表格/表单内部、`design-preview`/`template-preview` 渲染、Studio/模板中心内部布局。
>
> 结论：**已实施（待评审）**。所有既有 testid、按钮文字/可访问名称、URL/导航、会话/权限/表单/停止/compact 行为保持不变。

## 1. 统一口径

### 1.1 卡片 / 面板（`frontend/src/shared/ui.css`）

- `.rg-card`：`padding 18px`（`--sm` 16 / `--lg` 20）、`border-radius 12px`、`1px border`、`box-shadow: var(--rg-shadow-1)`、`display:flex; flex-direction:column; gap:12px`、`min-width:0`。
- 变体：`.rg-card--sm|--lg|--flat|--sub|--interactive`；`.rg-card__head/__title/__body/__foot`。
- `.rg-panel`：区域容器（padding 16、radius 12、border、shadow-1）；变体 `--sub|--flat|--flush|--warn|--danger`。
- **hover 只对 `.rg-card--interactive`** 提升 border/底色；静态卡片不抖动。
- 全部复用现有 `--rg-*` token；深浅色自动跟随；**不新增颜色**。

### 1.2 弹窗 / 抽屉

- Element Plus（仅工作台主入口加载 `ui.css`）：
  - `.el-dialog`：header `18/20/12`、body `4/20/16`、footer `14/20/18` + 顶部 hairline + 按钮 `gap 8`；关闭按钮 28×28、圆角 6、hover 底色、focus-visible 焦点环；标题 15/600；窄屏（≤768）16 边距。
  - `.el-message-box` 同步（标题 15/600、关闭按钮、按钮区间距）。
  - `.el-drawer` 头部/内边距（16/18 + 头部分割线），不破坏移动端。
- 自定义壳：
  - `NewAppDialog.vue`：header 18/20/12、body 4/20/16、footer sticky + 顶部 hairline（14 顶距）、关闭按钮 hover/focus；字段/提交逻辑未动。
  - `NewDesignTemplateDialog.vue`：同样的 header/body/actions 间距与关闭按钮焦点。
  - `TemplateLibraryDialog.vue`：走 EP 全局；分类 tabs 统一。
  - `DesignTemplateCenter.vue`：仅分类 tabs；内部布局不动。

### 1.3 Tabs（与 AppShell 视图导航一致）

- `.rg-tabs`（`--wrap|--fill`）+ `.rg-tab`：高 **34px**、文字 13、active 600 + **2px 墨色下划线**、hover 底色、focus-visible 焦点环；`.rg-tab__count` 计数 chip（active 用 AI 紫软底）。
- 替换：
  - `DesignView` ER/原型 tab（`.rg-tabs`，testid 不变）；
  - `DesignTemplateCenter` 分类 tabs（全部/平台/运营/数据/工具/自定义，计数 chip）；
  - `TemplateLibraryDialog` 分类 tabs；
  - `StudioView` ≤1180 窄屏「页面/对话/预览」tabs（仅视觉；Studio 三栏布局未动）。

## 2. 替换点

| 区域 | 改动 |
| --- | --- |
| `HomeShell` | 「最近应用」「快捷开始」「运行状态」改 `.rg-card`；应用卡 `.rg-card--sm--interactive`；`card-head` → `rg-card__head`；移除本地 `.card` 样式 |
| `RequirementsOutline` | 模块卡 padding 16 / radius 12 / shadow-1；hover 边框 |
| `RequirementsView` | 警告条改为 inset `.rg-panel--warn`；文档列改为卡片（`.doc` radius 12 + shadow-1、外层留白） |
| `DesignView` | 模块卡同模块卡口径；ER/原型 tabs `.rg-tabs`；警告/过期/导出错误条改 inset panel；主画布区加留白 |
| `DesignErPanel` | ER 画布 `.rg-panel`（padding 16/radius 12/shadow-1）；实体表 `.rg-panel--sub` 同口径；外层 padding 归零 |
| `DesignPrototypePanel` | 原型面板容器 card（radius 12/shadow-1）；画布/iframe wrap radius 12 |
| `DevView` | 开始卡 shadow-1；fidelity 报告 radius 12/内边距；右侧栏每个 `<section>` 卡片（radius 12/padding 14×16/shadow-1） |
| `SessionList` | 会话 item radius 10/hover 边框（列表行，不是顶层卡） |
| `AgentChatPanel` | 容器 `.rg-panel--flush`（保留自身分割线）；头部 padding 12/16、gap 8 |
| `NewAppDialog` / `NewDesignTemplateDialog` | 见 1.2；按钮/字段/testid 不变 |
| `DesignTemplateCenter` / `TemplateLibraryDialog` / `StudioView` | 分类/窄屏 tabs 改用 `.rg-tab`；布局与逻辑未动 |

## 3. 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | **189 / 189** |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过（2845 modules） |
| `npm run check:vue --prefix frontend` | 通过（全部 SFC 导入完整） |
| `npm run e2e:p2 --prefix backend` | **120** |
| `npm run e2e:p3 --prefix backend` | **131** |
| `npm run e2e:p4 --prefix backend` | **130** |
| `npm run e2e:p7-3b --prefix backend` | **77** |
| `npm run e2e:p7-7b --prefix backend` | **73** |
| `npm run e2e:p7-7c --prefix backend` | **116** |
| `npx tsx scripts/ui3b-shots.ts`（backend） | **24 张截图 / 23 次无整页横向溢出 / 29 次口径测量** |

e2e 全部使用临时目录 + 独立端口 + stub opencode；结束核对测试端口（3422/3423/3425/3429/3430/3431/3438 与 44xx）无残留监听，真实 3300/4771 未启停。

## 4. 截图

`docs/plans/evidence/2026-11-23-ui3b/`：

- 1440：`ui3b-home-1440.png`、`ui3b-new-app-dialog-1440.png`、`ui3b-template-library-1440.png`、`ui3b-design-template-center-1440.png`、`ui3b-shell-1440.png`、`ui3b-requirements-1440.png`、`ui3b-chat-panel-1440.png`、`ui3b-requirements-dialog-1440.png`、`ui3b-design-er-1440.png`、`ui3b-design-prototype-1440.png`、`ui3b-dev-1440.png`
- 1024：`ui3b-home-1024.png`、`ui3b-requirements-1024.png`、`ui3b-design-1024.png`、`ui3b-dev-1024.png`
- 390：`ui3b-home-390.png`、`ui3b-new-app-dialog-390.png`、`ui3b-template-library-390.png`、`ui3b-design-template-center-390.png`、`ui3b-requirements-390.png`、`ui3b-chat-panel-390.png`、`ui3b-design-prototype-390.png`、`ui3b-dev-390.png`、`ui3b-studio-tabs-390.png`

## 5. 偏差 / 未验证

- 卡片口径检查覆盖：首页三卡 + 应用卡、需求模块卡、需求文档卡、ER 画布卡、实体表卡、原型面板、开发开始卡、开发侧栏分组卡；**会话 item / 模块卡内部嵌套行**保持列表密度（radius 10/12、padding 8—16），不强行全部 16—20。
- `StatePanel`（空态/加载/错误）沿用 UI-2a 的视觉，不重复套 `.rg-card`；其本身已是 1px border + radius + 统一间距。
- 消息/工具/权限/表单卡片、表格/分页/表单内部、Studio/模板中心内部布局、`design-preview`/`template-preview` 渲染未动。
- 未做像素级视觉回归；真实 3300/4771 的视觉效果需用户刷新/重启后复核（本轮 `frontend/dist` 已重建，静态托管即时生效）。
- 未改 `backend/src`，未跑后端单测；未调真实模型；未做任何 git 操作。
