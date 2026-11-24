# AI Dev Workbench

三阶段（**需求 → 设计 → 开发**）的 agent 开发工作台。

> **当前状态（2026-11-23）**：**第一阶段功能收尾，进入细化/优化/打磨；P7-7a、P7-7b-1、P7-7b-2a、P7-7b-2b、P7-7c-1、P7-7c-2 已实施（待评审）**（用户已跑通主流程；不等于“全部评审通过”）。Agent-First 版本 **P1—P6-4 已评审**；**P7-1～P7-6c + P7-4b + P8-1（移除旧版设计模板，DB 4 表）+ P8-2（被 P9 取代）+ P9（设计产物模板原生真实渲染，Y2 一期）+ P10（detail/dashboard 模板化 + 真实模板风格 PNG）+ P10b（所有显式契约页面模板兜底）+ P11（设计视图移除线框切换，只保留设计产物）+ P12（启动脚本构建拆两步 + 一键 restart）+ P7-7a（模板工作室底座）+ P7-7b-1（后端工作室：会话/资产/studio API/authoring SKILL）+ P7-7b-2a（StudioView/template-preview/preview 结构覆盖/测试守卫）+ P7-7b-2b（模板中心自定义入口/`e2e:p7-7b`/清理）+ P7-7c-1（新建应用 picker 列自定义 pack、scaffold contract 闭环、应用内自定义 structure、`e2e:p7-7c`）+ P7-7c-2（真实 opencode 2.2.5 + `deepseek-flash` 工作室→发布→应用→预览/PNG→fidelity 闭环，临时 3487/4787）已实施（待评审）**。**真实 3300 人工验收已于 2026-11-23 由用户确认全部通过（P7-7 评审仍待定；验收明细待补）**。打磨批 1（mock 枚举多样性 / 模板中心内置预览 embed / pm-steps 点击步条同步）已实施（待评审，2026-11-23）；**打磨批 2（ui-check 文案/状态区分：开发视图 pending 提示与 fidelity hint 按未生成/已生成未填区分）已实施（待评审，2026-11-23）；打磨批 3（移动端 <768 审计与修复：390/414/768 实测，Studio ≤1180 单栏「页面/对话/预览」tab、模板中心/picker ≤560 头部响应式）已实施（待评审，2026-11-23）**；**打磨批 5（B）开发视图真实模型复跑：通过**——临时 3488/4788 + 真实 `deepseek-flash`，自定义模板→应用→agent 实现**自动收尾 8m34s / 74 消息 / 108 工具**，ui-check 已填、**fidelity 12 pass / 1 warn / 0 fail**、0 权限拒绝、仓库与真实 data/projects 越界 hash 0 变化；应用前端未构建/未运行属未验证；**D2（PNG 像素级 diff）暂不做、pm-sheet 暂不动**（2026-11-23）。**UI-1a（设计 token + 应用外壳 + 首页）已实施（待评审，2026-11-23）**：type scale/spacing + `body` 14px/1.6、56px 三区应用栏（返回/三段视图导航/模型·主题·更多，删除收进「更多」）、首页概览式两栏（最近应用 + 快捷开始 + 运行状态 compact）；`e2e:p2/p3/p4` 仍 **116/126/130**、`e2e:p7-3b` **55→77**；证据 `docs/plans/evidence/2026-11-23-ui1a/`。**UI-1b（三视图排版/层级 + 去重复 chip + 技术摘要人话化 + 状态文案统一）已实施（待评审，2026-11-23）**：需求/设计/开发视图去掉重复「X 视图」chip，需求摘要改「X 个模块 · Y 个设计」、错误独立「N 处待处理」，开发头部去掉 app 名与 `build · 模型` 原始行（改模型 chip/tooltip），模块/会话列表与文档/ER/时间线字号上浮一档（正文 13.5），`statusLabel` 统一为 **需求中/设计中/开发中/已完成**；`e2e:p2/p3/p4/p7-3b/p7-7b` 仍 **116/126/130/77/73**；证据 `docs/plans/evidence/2026-11-23-ui1b/`。**UI-2a（统一空态/加载/错误 + 骨架）已实施（待评审，2026-11-23）**：新增共享 `StatePanel`（empty/error/loading；list/doc/canvas/timeline 骨架；`role=alert`/`role=status`；raw error 收进「技术详情」折叠）；需求大纲/文档、设计模块/画布/实体、开发会话/时间线、首页应用列表统一空态与加载骨架，开发开始卡改为「任务清单/下一步」版式（保留 textarea/testid/首条提示逻辑）；`e2e:p2/p3/p4/p7-3b/p7-7c` 仍 **116/126/130/77/116**；证据 `docs/plans/evidence/2026-11-23-ui2a/`。详见 `docs/STATUS.md`、本批证据 `docs/plans/evidence/2026-11-23-dev-view-real-model/` 与 `docs/plans/evidence/2026-11-21-p7-7-real-model/`。**UI-2b（AI 面板空态/示例/头部/加载/错误）已实施（待评审，2026-11-23）**：`AgentChatPanel` 空态改用 `StatePanel`（无会话「开始与 AI 协作」/ 有会话「发送第一条消息」+ CTA + 上下文 pill：视图/模块/工作室 pack；**顶部对齐**）+ 按视图 3 条示例（需求视图为 **AI 专属、与中央空态不重复**；点击只填输入框、不发送）+ 头部压成两行（会话下拉/压缩/新会话同排，窄屏换行）+ 会话加载时间线骨架（`chat-loading` 3 行）+ 错误条 `role="alert"` 与「重试」；`e2e:p2` **120**、`e2e:p3` **131**、`e2e:p4` **130**、`e2e:p7-3b` **77**、`e2e:p7-7b` **73**、`e2e:p7-7c` **116**；证据 `docs/plans/evidence/2026-11-23-ui2b/`。**UI-3a（按钮/图标/chip 原语）已实施（待评审，2026-11-23）**：新增共享 `RgButton`（variant/size 28·32·36/icon/iconOnly/loading）与 `RgChip`（tone/size 22·24/dot），`ui.css` 统一 `.el-button` 32/8/13；顶层替换 AppShell/HomeShell/Requirements(View/Outline)/DesignView/DevView/AgentChatPanel/SessionList，`←`→ArrowLeft、`⋯`→MoreFilled、`☰/▤`→Fold/Expand+Memo、`›`→ArrowRight；消息/工具/权限/表单卡片 DOM、Studio/模板中心内部与预览渲染未动；`e2e:p2/p3/p4/p7-3b/p7-7b/p7-7c` = **120/131/130/77/73/116**；证据 `docs/plans/evidence/2026-11-23-ui3a/`。**UI-3b（卡片/面板 + dialog + tabs）已实施（待评审，2026-11-23）**：`ui.css` 新增 `.rg-card`/`.rg-panel`（padding 16—20、radius 12、shadow-1，hover 只对可点击卡片）与 `.rg-tabs`/`.rg-tab`（34 高、active 2px 墨色下划线、计数 chip），并统一 Element Plus `.el-dialog`/`.el-message-box`/`.el-drawer` 的 header/body/footer 间距与关闭按钮；顶层替换首页三卡 + 应用卡、需求模块卡/警告条/文档卡、设计模块卡/ER 画布/实体表/原型面板、开发开始卡/侧栏分组/fidelity 面板、会话 item、AI 面板容器/头部；自定义壳 `NewAppDialog`/`NewDesignTemplateDialog` 统一间距与按钮区；模板中心/模板库分类 tabs 与工作室窄屏 tabs 改用 `.rg-tab`（Studio/模板中心内部布局未动）；`e2e:p2/p3/p4/p7-3b/p7-7b/p7-7c` = **120/131/130/77/73/116**；24 张截图 + 23 次无溢出 + 29 次口径测量，证据 `docs/plans/evidence/2026-11-23-ui3b/`。
> 需求/设计/开发都是**视图**，不是门禁；产物是工作区文件。旧方向（模块确认 / 版本 / Change Set / 交接包 / U7 阶段 / M7-2）相关代码与文档已删除。
> **2026-11-23（D0/D1/D2/D3）**：去模块 + 三份设计产物 + 接口设计（D0 设计稿待评审）；**D1（单需求文档 + `entities.json`/`pages.json` + 去模块底座，fidelity 13 项）、D2（`docs/design/api-design.md` 固定模板/校验 + `adw-api-design` skill + `generate-api-design` command + 设计视图「接口设计」Tab + digest/ui-check 引用 + fidelity 14 项）、D3（残留 testid/CSS 清理 + 历史 UI 截图脚本更新 + 全量回归 + 文档/汇报更新）已实施（待评审）**；真实模型闭环未执行（需用户另行授权）。
> **2026-11-23（O1—O3）**：**布局优化 + 接口同轮生成已实施（待评审）**——需求=左对话（可拖拽）+右文档（删除左侧大纲，保留 `doc-toc`）；设计=左对话+中页面集/实体+右主区三 Tab；≤1024 对话/页面集左抽屉互斥；`generate-design` 同轮生成 entities/pages/api-design，`generate-api-design` 仅补/更新。详见 `docs/plans/2026-11-23-layout-and-api-generation-polish-brief.md`。
> **2026-11-24（O4）**：**设计视图页面集 Tabs + 总览已实施（待评审）**——删除设计中栏「页面集/实体」，设计=左对话+右主区；页面集 Tabs + 页面 Tabs（总览 + 页面）；总览 2 列卡片 +「导出页面集总览 PNG」（下载，不写 prototypes）；≤1024 仅对话左抽屉；ER 完整一张图。详见 `docs/plans/2026-11-24-design-pageset-tabs-and-overview-brief.md`。
> **2026-11-24（B1—B3）**：**需求文档「问 AI」+ ER 缩放 + 总览在线画布已实施（待评审）**——h2/h3 标题「问 AI」+ 可移除「定位章节」chip + 隐藏章节上下文；ER 去页面集 chips、字段面板上下分栏、Ctrl/⌘+滚轮/捏合缩放 + 适应窗口；页面集总览改为点阵画布（1440×900 artboard、缩放/平移/适应窗口），导出仍为 2 列拼图。详见 `docs/plans/2026-11-24-requirements-ask-ai-er-zoom-overview-canvas-brief.md`。
> **2026-11-24（B4—B5）**：**ER 右上浮层 inspector + 设计预览交互层已实施（待评审）**——ER 默认全图、点实体右上浮层（收起胶囊/点空白与 Esc 收起/关闭清除）、缩放移画布右下角、图例折叠、首次超可视区自动适应一次；设计预览（单页原型）按 recipe 驱动：dialog-form 弹窗、page-form/wizard/detail 父层切页、delete 确认、无目标页明确提示；显示「交互预览 · 不保存」，不写数据/不调接口。新增 `e2e:design-interaction`（24 断言）；前端 **213**、后端 **238**，e2e p2/p3/p9/p10/p7-4b/p7-7c/api-design/p7-6a **105/177/69/81/57/118/26/21**。详见 `docs/plans/2026-11-24-er-inspector-and-design-preview-interaction-brief.md`。
> **2026-11-24（B6—B7）**：**动作目标 `actionTargets` + 临时表单 + 接口「让 AI 修」一键发送已实施（待评审）**——`main-sub` 纳入 create/edit 表单目标（app1 的 `goods-form(main-sub)` 不再提示“未设计新增页”）；`pages.json` 新增页面级可选 `actionTargets`（显式优先、同页面集；create/edit 用 `dialog-form/page-form/main-sub/wizard`，detail 只做详情）；无表单页时打开**临时表单**并标注「临时表单 · 未设计表单页」+ 原因/候选；接口设计「让 AI 修」改为**一键发送**并显示「正在修复 / 修复完成：警告 6 → 2」，完成后刷新产物。回归 后端 **243** / 前端 **230**、`e2e:design-interaction` **30** / `e2e:api-design` **28**；p2/p3/p4/p9/p10/p7-4b/p7-7c/p7-6a **105/177/135/69/81/47/118/21**，ui3b 23 截图。详见 `docs/plans/2026-11-24-action-targets-and-api-fix-state-brief.md`。
> 真实 3300/4771：**2026-11-20 曾监听**（PID 40704/41744，启动 16:15:08）；**2026-11-21 只读核对已无 LISTEN、`/api/health` 连接失败、PID 不存在**；**2026-11-23 09:10 曾运行**（3300 PID **39828** `node dist/index.js` 启动 09:10:41；4771 PID **19608** `opencode serve` 2.2.5 启动 09:10:42），用户已确认真实 3300 人工验收**全部通过**（P7-7 评审仍待定）。**2026-11-23 14:00 左右只读核对（当时运行）**：3300 LISTEN PID **23668**（`node dist/index.js`，启动 **2026-11-23 13:32:38**）、4771 LISTEN PID **9092**（`opencode serve` 2.2.5，启动 **13:32:38**），`/api/health` 200（`ok:true`、`runtime.ready:true`、`pendingSessions:0`）；**2026-11-23 17:35 左右只读核对（当时运行）**：3300 LISTEN PID **19900**（`node dist/index.js`，启动 **2026-11-23 17:00:43**）、4771 LISTEN PID **13484**（`opencode serve` 2.2.5，启动 **17:00:43**），`/api/health` 200（`ok:true`、`runtime.ready:true`、`pendingSessions:0`）；`backend/dist` **2026-11-23 17:31:07**、`frontend/dist` **2026-11-23 17:27:02**（O1—O3 构建）。**结束核对（2026-11-24 09:31）已无 3300/4771 LISTEN（用户停止，非本轮启停）**。**运行时（17:00 启动）的进程早于本轮构建，当时运行的是 O1—O3 之前的后端代码；前端 dist 已更新但新 UI 依赖新后端 API，不能只刷新，必须由用户执行 `restart.cmd`/`restart.sh` 后再验收**。历史：14:17（14988/27968）、14:00（23668/9092）、13:12（15992/19208）、09:10（39828/19608）等为旧口径。库为 4 表新结构，`apps>0` 正常；fail-closed 仅针对旧 5 表结构 + `apps>0`。**设计/实施不启停真实实例**；改代码后用 `restart.cmd` / `restart.sh`（stop → 构建 → start → 健康检查），切换/重启由用户按 [`docs/ops/switch-to-agent-first.md`](docs/ops/switch-to-agent-first.md) 执行，工作台不自动切换/回滚；以实际为准。e2e 只用临时目录/端口，未读写真实 `data/`/`projects/`/`.env`。

## 目标形态

- **工作台 = 共享工作区 + 模板 + 会话 + 产物视图 + 执行过程。**
- agent 使用 opencode 原生能力（会话、工具、skills、commands、权限），自主检索材料、判断范围、修改产物并检查结果。
- 需求/设计/开发只是**视图**，不是门禁；没有确认、版本、变更单、交接包。
- 产物是**文件**（单一事实源）：
  - `docs/requirements/requirements.md`（单文档；Epic `EP-001`/Story `US-001`，模板生成骨架）
  - `docs/design/entities.json`（全局实体/关系；字段 `code`/`name`/`type`）
  - `docs/design/pages.json`（页面集 = Epic + 页面契约，供 ER/原型渲染）
  - `docs/design/api-design.md`（接口设计固定模板：索引/覆盖矩阵/详情/错误码/权限；索引与详情含 `操作`）
  - `docs/design/design-brief.md` + `tokens.json` + `prototypes/*.png`（应用级设计参考包；PNG 是**模板风格截图**，无显式契约的旧设计/截图失败为线框）
  - `docs/design/design-system.json` + `docs/design/template/`（应用类型/风格、蓝图与结构/风格样式）
  - `docs/design/ui-check.md`（应用级开发前后对照表，软门禁；按 Epic 分节）
  - 代码、截图等
- **设计模板**：应用类型 × 视觉风格 + 页面库（内置 pack 4 类型 × 4 风格 × 25 页）；工作台内 `preview.html` 可预览模板页面，设计模板中心/新建应用 picker/设计视图徽标与「模板页面库」；**自定义设计模板（P7-7）**：模板工作室 `#/studio/<packId>`（页面/spec 校验 + agent 对话 + 草稿预览 + 生成/发布/丢弃），自定义模板预览入口 `template-preview.html?draft=|pack=&page=&embed=1`（reference 复用 `preview.html` iframe，contract 用 synthetic design 原生渲染），`preview.html` 支持 `structurePack/structureDraft` 覆盖结构样式；**设计视图「原型」Tab 用所选模板（应用类型 structure + 视觉风格）原生渲染 `pages.json` 该页**（独立入口 `design-preview.html?app=&page=&type=&style=&embed=1&v=<designHash>`，结构与组件来自模板：`optimized-suite`/`template-stage`/`business-page`/`page-heading`/`panel` + `pm-search`/`pm-toolbar`/`pm-table`/`pm-pagination`/`pm-tree`/`pm-form-dialog`/`pm-echarts`/`pm-steps`/`pm-*`），覆盖 **list / tree-list / page-form / dialog-form / detail / dashboard / main-sub / wizard**；未知配方按 `page.type` 映射到通用模板页，**设计视图只展示设计产物，不再提供「模板风格/线框」切换**；**无显式契约的旧设计自动显示「结构草图（无契约）」并提示补齐契约**（调试入口仅 `?prototype=wireframe`，内部/测试用）；线框渲染器仍消费页面契约（树/弹窗/分页/操作/控件映射，P7-4b），皮肤由所选风格构造（P8-1；`tokens.json`/manifest 用 `styleId`）。**PNG 是模板风格截图**（`design-preview` iframe 内 html2canvas 自截；无显式契约旧设计/截图失败回退线框），自动与手动导出共用同一逻辑。
- **设计 → 开发关联**：新应用前端是独立 MF remote（`templates/afc-remote`：webpack + Module Federation + PageTemplates + GlobalPreference）；开发 prompt/AGENTS/`adw-frontend-implementation` skill/design digest（应用级）/ui-check（应用级）/一致性检查共同约束实现。
- **自定义模板应用闭环（P7-7c-1）**：新建应用 picker 列**已发布**自定义 pack（草稿不列）；scaffold 生成 `design-system.json`（`origin`/`preview`/`pages[].kind/source/contractFile`）、reference 蓝图与 `contracts/<page>.json`（contract 页不写 `.vue`）、合并 `structure.css` + 风格 + 设计模板 skill；设计视图 `design-preview` 通过应用内资产接口加载自定义 structure（base 短类 + 内置风格），PNG 截图协议不变；开发 digest/ui-check/fidelity（**14 项**，含 `template-contract`/`api-design`）识别契约页。
- **真实模型闭环（P7-7c-2）**：临时 3487/4787 + 真实 opencode 2.2.5 + `packycode-deepseek/deepseek-flash`，工作室 prompt → agent 写 spec（reference + 2 contract）→ 自行生成/校验 → 发布 1.0.0 → 新建应用 → 设计预览/PNG → fidelity **0 fail**；真实 `shell` 越权被 `permission.rejected`，catalog/.opencode/仓库/应用工作区无越界。证据 `docs/plans/evidence/2026-11-21-p7-7-real-model/`（含真实模型驱动的完成判定修复记录）。
- **一致性检查**：CLI `check-fidelity.mjs` 与 `POST /api/apps/:id/design-fidelity` 共用 **14 项**只读规则（第 13 项 `template-contract`、第 14 项 `api-design`；契约页跳过蓝图、校验 `contracts/<page>.json`；接口文档缺文件/覆盖缺口 warn，errors fail），开发视图展示报告；只报告、不阻断、不做像素比对。
- 扩展能力：3 个方法 skill（需求/设计/接口设计）+ 开发方法 skill（含一致性检查脚本）+ 2 个团队 skill + 需求模板 skill（`adw-template-req-*`）+ 设计模板 skill（`adw-template-proto-<applicationType>`）+ 6 个 command；需求模板库在 DB（4 表），应用内自动分发/同步。
- 工作台只负责：应用与工作区生命周期、会话与模型、产物解析/校验/变化通知、三个视图的呈现。

详细设计：[`docs/plans/2026-11-18-agent-first-workbench-design.md`](docs/plans/2026-11-18-agent-first-workbench-design.md)
P6 设计：[`docs/plans/2026-11-18-agent-first-workbench-p6-design.md`](docs/plans/2026-11-18-agent-first-workbench-p6-design.md)
P7 设计：[`docs/plans/2026-11-19-design-template-and-dev-linkage-p7-design.md`](docs/plans/2026-11-19-design-template-and-dev-linkage-p7-design.md)
最近一期交接单：[`docs/plans/2026-11-20-phase1-handover-and-next-session-prompt.md`](docs/plans/2026-11-20-phase1-handover-and-next-session-prompt.md)（第一阶段收尾 + 新会话话术；P1—P12 见同目录）
当前状态：[`docs/STATUS.md`](docs/STATUS.md)
汇报材料：[`docs/report/ai-dev-workbench-overview.md`](docs/report/ai-dev-workbench-overview.md)
真实实例切换：[`docs/ops/switch-to-agent-first.md`](docs/ops/switch-to-agent-first.md)

## 目录

```text
backend/            Express + SQLite（应用/模板/会话/产物解析/文件监听）
frontend/           Vue3 + Vite（需求/设计/开发三视图）
templates/eos-app/  脱敏 EOS 9.0.0 应用模板（应用 backend/ 的起点）
templates/afc-remote/  AFCenter 子应用 MF remote 骨架（应用 frontend/ 的起点）
templates/design-system/  内置设计模板包（应用类型/风格/页面蓝图）+ 共享 component-controls.json
templates/workshop/ 设计模板工作室资产源（skills/adw-design-template-authoring 的 SKILL.md/references + spec/css/generator + 薄 CLI、commands/generate-design-template.md；P7-7a/b-1/b-2a/b-2b/c-1/c-2 已落地）
templates/agent/    内置 skills / commands 源（分发到应用 .opencode/）
docs/plans/         设计稿、P1—P12 交接单与索引
docs/report/        汇报材料（md / 单文件离线 HTML / A4 PDF / 流程图 SVG+PNG / 截图）
docs/ops/           运维清单（真实实例切换）
projects/           运行时应用工作区（gitignored）
data/               运行时 SQLite / 日志 / PID（gitignored）
```

## 开发命令

```bash
# 安装（根 + backend + frontend；不要用 npm install --prefix，
# 本机 npm 会把仓库根包写成子包的 file:.. 依赖）
npm run install:all

# 开发（后端 3300 + 前端 Vite）
npm run dev

# 构建
npm run build

# 后端测试（当前基线 243 项；使用临时 RG_DATA_DIR/RG_PROJECTS_DIR 更安全）
npm test --prefix backend

# 底座冒烟（临时库/目录 + 端口 3416，默认不启动 opencode）
npm run smoke:workspace --prefix backend

# 真实 opencode 冒烟（不调用模型）
npm run smoke:assets --prefix backend   # skills/commands 实际加载（4719；2 方法 + 1 开发 + 2 团队 + 模板 skill + 5 command）
npm run smoke:dev --prefix backend      # 会话生命周期（3424/4724）

# 前端单测（当前基线 230 项）
npm test --prefix frontend

# Playwright 验收（stub 后端，不调用模型；需先 npm run build --prefix frontend）
# 首次需安装浏览器：npx playwright install chromium
npm run e2e:p2 --prefix backend         # 105 条断言（左对话+右文档、拖拽/复位、窄屏左抽屉、章节「问 AI」+隐藏上下文）
npm run e2e:p3 --prefix backend         # 177（无中栏、页面集/页面 Tabs、总览在线画布缩放/平移/导出、ER 去 chips/右上浮层+胶囊/自动适应/Ctrl+滚轮）
npm run e2e:p4 --prefix backend         # 135
npm run e2e:preview --prefix backend    # 93（25 页 × 4 风格的预览宿主；含 embed 断言）
npm run e2e:p7-3b --prefix backend      # 77（设计模板中心/新建应用/设计视图 + 自定义入口/空态/新建 + 390×844 移动断言）
npm run e2e:p7-7b --prefix backend      # 73（模板中心自定义模板/工作室/生成/预览/发布/删除保护；picker 列已发布自定义 pack；390×844 三块可达）
npm run e2e:p7-7c --prefix backend      # 118（自定义模板 → 新建应用 → 设计预览/PNG → digest/ui-check/fidelity 闭环；390×844 原型断言）
npm run e2e:p7-4b --prefix backend      # 47（线框渲染器树/弹窗/分页/操作/控件；用 ?prototype=wireframe 调试参数进入）
npm run e2e:p9 --prefix backend         # 69（设计产物模板原生渲染：tree-list/list/dialog-form；无契约自动结构草图，无切换按钮；布局/总览断言在 p3）
npm run e2e:p10 --prefix backend        # 81（detail/dashboard/main-sub/wizard 模板化 + 模板风格 PNG 真实截图与主色采样；无切换按钮）
npm run e2e:p7-6a --prefix backend      # 21（开发视图一致性检查，14 项）
npm run e2e:api-design --prefix backend # 28（接口设计 Tab：渲染/覆盖/校验/让 AI 修一键发送+修复状态/空态/错误态）
npm run e2e:design-interaction --prefix backend # 30（交互层：dialog-form 弹窗 / main-sub+page-form 切页 / 显式 actionTargets / 临时表单 / 确认；不写数据）

# 重新生成汇报材料（md → 单文件 HTML + A4 PDF；SVG → PNG）
npm run build:report --prefix backend
```

## 一键启动 / 停止

工作台以「后端托管 `frontend/dist`」的方式运行：检查 Node/npm → 缺依赖自动安装 → 构建后端与前端 → 后台启动 → 健康检查。

```bat
:: Windows
start.cmd    :: 启动（每次构建后端 tsc + 前端 vite；默认 http://localhost:3300）
restart.cmd  :: 停止 → 重建前后端 → 启动（更新代码后用）
stop.cmd     :: 停止（连同 opencode serve 子进程）
```

```bash
# Linux
chmod +x start.sh stop.sh restart.sh
./start.sh
./restart.sh
./stop.sh
```

说明：

- `start` **每次启动都会构建前后端**（后端 tsc、前端 vite 两步；任一步失败会明确报后端还是前端），不需要手动 `npm run build`。
- 已更新代码时用 `restart`：停止旧实例 → 重建前后端 → 启动 → 健康检查；已在运行时 `start` 只提示，请改用 `restart`。
- `frontend/dist` 由后端静态托管，已构建的静态资源刷新即生效；但**源码改动仍需 `restart` 重新构建**，**后端改动必须 `restart`**。
- 端口优先级：环境变量 `PORT` > `backend/.env` 的 `PORT` > 默认 `3300`。
- PID 在 `data/workbench.pid`，日志在 `data/logs/`。
- 重复启动会提示已在运行；停止优先按 PID 结束进程树，PID 丢失时按端口查找，并校验目标确实是本工作台。

## 配置

复制 `backend/.env.example` 为 `backend/.env`（该文件被 gitignore）：

| 变量 | 说明 |
| --- | --- |
| `PORT` | 工作台后端端口，默认 3300 |
| `RG_DATA_DIR` | SQLite/运行态目录，默认 `<repo>/data` |
| `RG_PROJECTS_DIR` | 应用目录根，默认 `<repo>/projects` |
| `OPENCODE_BIN` | opencode 可执行文件；默认从 PATH 查找 |
| `OPENCODE_PORT` | 工作台管理的 serve 端口，默认 4771，仅监听 127.0.0.1 |
| `OPENCODE_DEFAULT_MODEL` | 可选，`provider/model`；默认取 opencode `/api/model/default` |

模型/provider 由 opencode 自身配置管理；工作台不保存、不代理模型 API Key。

## 安全

- `templates/eos-app/` 已把示例中的 DB 密码、Nacos 密码、Redis 地址、`eos.application.sys-key`、邮件账号替换为占位符。
- 不要提交任何真实凭据；`projects/`、`data/`、`.env` 已在 `.gitignore` 中忽略。
- serve 随机密码只存在内存；日志与 API 响应统一脱敏。
- 应用创建时填写的 EOS sys-key / DB / 邮件信息只写入 `projects/<app-id>/`，不写入工作台数据库；未填写项为 `CHANGE_ME`。
- `templates/eos-app/src/META-INF/_srv/primetonlicense.xml` 是示例 license，正式使用前替换为团队 license。
- 内部 Maven 仓库、EOS 制品、Nacos/MySQL/Redis 是应用构建/运行的外部前提，尚未做运行态验证。

## 汇报材料

`docs/report/` 按 Agent-First 架构维护：`ai-dev-workbench-overview.md`（完整说明，已更新到 **P11**）、`.html`（单文件离线，内联 CSS/SVG/截图）、`.pdf`（A4）、`assets/flow-overview.svg|png`、三视图与设计模板中心/一致性检查示例截图（设计产物模板化、模板风格 PNG 与 P11 移除线框切换用文字+数字说明；截图沿用 P7-A，未重截）。
重新生成：`npm run build:report --prefix backend`（依赖根 `playwright`，不新增依赖）。
真实实例切换：`docs/ops/switch-to-agent-first.md`（只写步骤，由用户执行）。
