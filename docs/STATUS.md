# 当前状态（2026-11-23）

> P1—P6-4 已全部完成并通过评审；**P7-1（设计模板包 + 设计系统解析）、P7-2（预览 spike）、P7-3a（25 页 × 4 风格全量预览宿主）、P7-3b（设计模板中心 UI/新建应用/设计视图）、P7-4a（design.json 页面契约）、P7-4b（线框渲染器消费契约：树/弹窗/分页/操作/控件/子表）、P7-5a（MF remote 脚手架 + 设计系统/蓝图/团队 skill 分发）、P7-5b（开发 prompt/AGENTS/开发方法 skill/digest/模块/ui-check 软门禁/开发视图参考）、P7-6a（设计一致性检查脚本/command/API/开发视图报告）、P7-6b（真实模型闭环，2026-11-20 复跑通过）、P7-6c（SSE 生命周期 + 契约枚举/风格路径小修）、P8-1（彻底移除旧版设计模板：DB 5 表→4 表、原型皮肤改由设计系统风格构造）、P8-2（设计视图原型：catalogRef → preview.html embed iframe + 线框双视图，已被 P9 取代）、P9（设计产物模板原生真实渲染 Y2 一期）、P10（detail/dashboard 配方模板化 + 设计参考包 PNG 改为模板风格真实截图）、P10b（所有显式契约页面模板通用兜底）、P11（设计视图移除线框切换、只保留设计产物）、P12（启动脚本构建拆两步 + 一键 restart）、P7-7a（模板工作室底座：pack 模型/共享控件映射/生成核心/catalog/草稿-发布-删除 API/buildTreeRows 修复）已实施（待评审）**，**P7-7b-1（后端工作室：SessionView/ChatTarget/工作室资产/studio 会话与 API/authoring SKILL）已实施（待评审）**，**P7-7b-2a（Studio UI/template-preview/preview 结构覆盖/测试守卫）已实施（待评审）**，**P7-7b-2b（模板中心自定义入口/`e2e:p7-7b`/清理）已实施（待评审）**，**P7-7c-1（应用闭环 + `e2e:p7-7c`）、P7-7c-2（真实模型闭环，临时 3487/4787，证据 `evidence/2026-11-21-p7-7-real-model/`）已实施（待评审）**。**第一阶段功能收尾（2026-11-20）**：用户已跑通主流程（创建应用 → 设计 → 模板风格原型/PNG → 开发链路），进入细化/优化/打磨；**不是“全部评审通过”，P7-7 仍待评审**（见「第一阶段收尾」节）。真实 3300/4771：**2026-11-20 曾监听**（PID 40704/41744，启动 16:15:08）；**2026-11-21 只读核对已无 LISTEN、`/api/health` 连接失败、PID 不存在**；`backend/dist` 16:14:38、`frontend/dist` 16:15:07 为当时 restart 构建，Express 静态托管即时生效（设计视图「原型」只展示设计产物、无切换按钮，刷新即可）。本文件/实施**不启停真实实例**，后续由用户 `restart.cmd`/`restart.sh`；以实际为准。
> **2026-11-23**：真实 3300 人工验收已由用户确认**全部通过**（验收明细本轮未采集；**P7-7 评审仍待定**）；3300/4771 当前在运行（PID 39828/19608，启动 09:10:41/09:10:42，`/api/health` 200），详见「真实 3300 人工验收（2026-11-23）」节。打磨批 1、打磨批 2（ui-check 文案/状态区分）、打磨批 3（移动端 <768 审计与修复）已实施（待评审，2026-11-23）；**打磨批 5（B）开发视图真实模型复跑：通过**（自动收尾 514s、74 消息/108 工具、fidelity 12 pass/1 warn/0 fail、0 权限拒绝、仓库与真实 data/projects 越界 hash 0 变化；应用前端未构建/未运行属未验证）；**D2（PNG 像素级 diff）暂不做、pm-sheet 暂不动**（用户 2026-11-23 决定）。
> 历史细节见 `docs/plans/2026-11-18-agent-first-workbench-p1-brief.md` ～ `p5-brief.md`；P6 见 `2026-11-18-agent-first-workbench-p6-design.md` 与 P6-1/2、P6-3、P6-4 交接单。

## 结论

- **方向**：Agent-First（共享工作区 + 三个视图 + opencode 原生 agent + skills/commands）。设计稿 v3 有效。
- **P1「底座 + 全量清理」已完成并通过评审**：4 表数据层（P8-1 后；原 5 表已删除原型模板表）、工作区布局、skills/commands 资产、模板分发/同步、模块文件 API、统一 chat、artifacts + 文件监听、运行时扩展；旧后端模块/旧路由/旧表/旧测试/旧前端组件/旧冒烟已一次性删除。
- **P2「需求视图」已完成并通过评审**：模块大纲（新建/改名/排序/切模板/错误徽标）+ 文档渲染（TOC + Markdown）+ AI 对话（流式/工具/权限/表单/停止/compact/历史/85% 横幅/命令）+ artifacts 错误条与「让 AI 修」+ 模板库入口；`docs/` 变化 ≤1.5s 自动刷新。
- **P3「设计视图」已完成并通过评审**：模块列表（需求模块 + 设计状态）+ ER/原型两个 Tab + AI 对话；design.json → 渲染契约 adapter；ER/原型渲染、缩放与 PNG 导出；错误条 +「让 AI 修」；跨模块引用/未知实体降级为 warning；孤儿设计只读列出。
- **P4「开发视图收口」已完成并通过评审**：三视图统一 `buildViewPrompt`；开发空态/首条提示/Composer 文案一致；`smoke:dev` 与 `e2e:p4` 补齐；用户气泡只显示原文。
- **P5「收尾」已完成并通过评审**：汇报材料（md / 单文件离线 HTML / A4 PDF / 流程图 SVG+PNG / 三视图截图）；一致性清理；真实实例切换清单；全链路真实模型 E2E 通过。
- **P6-1/P6-2 已实施并通过评审**：聊天占位/失败与中断/reasoning + 统一中文指令；模板即 skill（`adw-template-req-<id>` / `adw-template-proto-<id>`），方法 skill 按 id 加载。
- **P6-3 已实施并通过评审**：设计参考包（`design-brief.md` + `tokens.json` + `prototypes/_manifest.json + *.png`）；自动/手动导出、过期提示、失败不阻塞；开发 prompt/AGENTS/skill 参考与只读一致性检查；**真实模型验证开发实际读取并使用了设计参考**。
- **视图现状**：需求/设计/开发均为真实视图；交接包/阶段/变更单等旧流程已清零。
- **P6-4 已完成并通过评审**：汇报材料更新到 P6（聊天/中文、模板即 skill、设计参考包、开发参考）；HTML/PDF/流程图/截图重新生成；README/AGENTS/plans/ops/report 文档校对；全量回归通过。
- **P7-1 已实施（待评审）**：内置设计模板包 `afcenter-app-templates-v1`（4 应用类型 × 4 风格 × 25 页面蓝图）、pack loader、`/api/design-system` 只读 API、应用级设计系统解析/创建/更新（`app_settings` 三键，不改表、不 seed 原型模板）。
- **P7-2 已实施（spike，待评审）**：`preview.html` + 复制的 pm-v3 子集，`OrganizationUsers.vue` 真实渲染成功（P7-3 做全量预览/风格切换）。
- **P7-3a 已实施（待评审）**：`preview.html?type=&style=&page=` 全量预览 4 应用类型 × 25 页面 × 4 风格；模板/风格/结构样式直接来自 P7-1 pack（生成脚本 + 静态 registry）；pm-v3 组件补齐、重组件懒加载（pm-sheet 占位）；mock 扩充；后端 `/preview.html` 静态托管；`pm-tree` 当前节点高亮修复。
- **P7-3b 已实施（待评审）**：设计模板中心（应用类型 × 风格 + 页面库 + iframe 预览）、新建应用选择设计模板（picker）、首页/设计视图入口与徽标；需求模板中心保持不变。
- **P7-4a 已实施（待评审）**：`design.json` 页面契约（designSystem / recipe / catalogRef / blueprint / filters / rowActions / toolbarActions / selection / pagination / form / tree / subTables / components）；schema/validate/adapter/设计 skill+command/测试；旧 design.json 与现有渲染不变。
- **P7-4b 已实施（待评审）**：线框渲染器消费页面契约——树列表（左树右表/选中样式/树头脚动作）、弹窗表单（宽度 clamp/单列/分组）、分页 bar|split|three-part、多选与批量条、行/工具栏动作、`pm-*` 控件映射、子表页签；旧 design.json 视觉不变（`e2e:p3` 126），新增 `e2e:p7-4b` 48。
- **P7-5a 已实施（待评审）**：新建应用生成独立 MF remote（`templates/afc-remote`：webpack + Module Federation，暴露 `./index`）+ PageTemplates/GlobalPreference；写 `docs/design/design-system.json` 与选中应用类型蓝图/风格副本；分发两个团队 skill 与 `adw-template-proto-<applicationType>`（pack 型模板 skill）。
- **P7-5b 已实施（待评审）**：开发 prompt 重写（设计系统/契约/蓝图/团队+开发 skill/ui-check/优先级/冲突与 MF 边界）、应用 AGENTS 开发规则、`adw-frontend-implementation` skill、后端 design digest（约 6KB）、模块上下文（DevView 选择/持久化/传后端）、`docs/design/<MOD>/ui-check.md` 骨架（缺失生成、不覆盖、状态只读）与开发视图设计参考（当轮 P7-6/P7-7 未做；后续见 P7-6a/P7-6c；P7-7 后续已实施）。
- **P7-6a 已实施（待评审）**：一致性静态检查（共享核心 `.cjs` + CLI `check-fidelity.mjs` + command `check-design-fidelity` + `POST /api/apps/:id/design-fidelity` + 开发视图「检查一致性」只读报告）；12 项检查（设计系统/页面契约/蓝图/实现视图与路由启发式/PageTemplates/pm-*/表单/列表/GlobalPreference/结构风格/ui-check/PNG stale）；只报告、不阻断；P7-6b 已于 2026-11-20 复跑通过（见 P7-6b 复跑节）；截图自动像素比对未做。
- **P7-6c 已实施（待评审）**：对话 SSE 增加 2s watchdog（最后事件后 10s 读取会话/消息确认 idle 后补 `done`，20 分钟总超时，幂等收尾），开发视图按末条 idle/outcome 收敛“运行中”；动作/树枚举改为软 warning（保留原值，validate 与后端一致）；新应用风格路径统一为 `docs/design/template/styles/<styleId>/style.css`（design-system.json 增 `styleId`），fidelity 兼容旧路径并只提示。
- **P8-1 已实施（待评审）**：彻底移除旧版设计模板（1b）——`prototype_templates` 表/内置 seed、`/api/prototype-templates`、旧原型模板 CRUD、`builtin-prototype-*`、`apps.prototype_template_id` 列、payload 的 prototype/legacy 字段、新建应用「旧版兼容」、设计视图旧徽标、旧原型模板 skill 生成/期望/断言全部删除；DB 5 表→**4 表**；原型皮肤改由应用设计系统 `style` 构造（`skinFromStyle`，topbar shell + 风格 tokens），`tokens.json`/`_manifest.json`/`artifacts.tokens` 用 `styleId`。
- **P8-2 已实施（待评审）**：设计视图「原型」Tab 双视图——有 `catalogRef` 且解析到所选应用类型的模板页面时**默认** iframe 展示 `preview.html?type=&style=&page=&embed=1` 真实模板页（embed 隐藏预览自带风格切换器/角标，风格固定为应用设计系统）；无 catalogRef/解析失败回退 P7-4b 线框 + 提示；头部「模板预览/线框」切换；预览模式禁用 PNG 导出（PNG 仍是线框草图），`DesignView` 隐藏导出画布保持线框；`e2e:p7-4b` 先切线框再断言（仍 48），`e2e:preview` 77→83，新增 `e2e:p8-2` 28。真实预览只代表模板视觉基准，**不按 design.json 字段重绘 pm-v3（Y2 未做）**。**（已被 P9 取代：模板自带页面预览与 `e2e:p8-2` 已删除）**
- **P9 已实施（待评审，2026-11-20）**：设计产物模板原生渲染（Y2 一期）——新增 `design-preview.html` 独立入口（`app/module/page/type/style/embed/v`），按 `design.json` 该页用**所选模板结构/组件/视觉**渲染（`optimized-suite` + `visual-style-*` + `application-type-*`、`structure.css`/`shared.css`/`style.css`、`pm-search/pm-toolbar/pm-table/pm-pagination/pm-tree/pm-form-dialog/pm-*`）；覆盖 **list / tree-list / page-form / dialog-form**，其余配方回退线框；契约驱动列/查询/操作/选择/分页/树/表单分组，确定性 mock，缺失列/字段跳过并提示；**P11 起设计视图不再提供「模板风格/线框」切换（只展示设计产物；结构草图仅无契约/调试）**。（PNG 语义由 P10 更新为模板风格截图。）
- **P10 已实施（待评审，2026-11-20）**：① 模板渲染支持集合扩展为 **list / tree-list / page-form / dialog-form / detail / dashboard**（main-sub/wizard 仍回退线框）；dashboard 用 `page-heading`+`metrics-grid/metric-card`+`panel`+`pm-echarts`+最近记录 `pm-table`，detail 用 `page-heading/title-line/status-chip`+`detail-hero`+`info-grid/info-item`+`timeline`+可选子表 `pm-table`；`buildDashboardModel`/`buildDetailModel` 纯函数 + 确定性 mock。② `prototypes/*.png` 改为**模板风格真实截图**：`design-preview` 支持 `capture=1`（隐藏 notes/角标、禁用动画、加载完成后 postMessage `ready`，父窗口请求后在 iframe 内 html2canvas 自截并回 `png`/`error`）；新增 `design/template-capture.ts` 动态隐藏 iframe（1440×900、离线）逐页截图，>5MB 用 scale=1 重试；`DesignView#runExport` 模板页走截图、不支持配方/旧设计/截图失败回退线框并记警告；PNG 导出改为整包（面板按钮 emit 给 DesignView），自动/手动同一逻辑。新增 `e2e:p10`（54 条，端口 3447，含 PNG 宽高与 data-cyan 主色像素采样）。
- **P7-7a 已实施（待评审，2026-11-21）**：模板工作室底座——① `design/pack.ts` 扩展 `DesignPageMeta`（kind/source/contract/sampleEntity/sampleSubEntities/origin），内置页缺省 kind=blueprint 兼容，自定义 pack（origin.kind=custom）页面必须显式 reference/contract，contract 页无蓝图；导出权威 `validatePackDir(dir, expectedId?)`（生成/发布/运行时唯一权威）；② 共享映射 `templates/design-system/component-controls.json`（20 键，前端 `contract-view.js` import、后端 catalog 读同一文件；39 组件 ∩ 20 键 = 13 可映射控件）；③ 生成核心 `templates/workshop/skills/adw-design-template-authoring/scripts/lib/{spec,css,generator}.cjs` + 薄 CLI `generate.cjs`/`validate.cjs`（CSS 合并 793→514/去重 279/3 冲突可复现）；④ 后端 `design-template/**`（paths/core/spec/draft/generator/catalog/publish/routes）：catalog（25 页/39 组件/4 风格/8 配方 + examples）、草稿 CRUD、生成、发布（1.0.0→1.0.1、spec-changed 409、原子替换）、删除保护（内置 403、被 `app_settings` 引用 409 + 应用列表）；⑤ `GET /api/design-system/:packId/asset`、`DELETE /api/design-system/:packId`、`GET /api/design-templates/*`；⑥ 前端 `buildTreeRows` 修复（重复子节点标签不再重复 push roots）+ 回归单测。**P7-7b-1（后端工作室：SessionView/ChatTarget/工作室资产/studio 会话与 API/authoring SKILL）、P7-7b-2a（Studio UI/template-preview/preview 结构覆盖/测试守卫）、P7-7b-2b（模板中心自定义入口/`e2e:p7-7b`/清理）已实施（待评审，2026-11-21），P7-7c-1（应用闭环）与 P7-7c-2（真实模型闭环）也已完成**；picker/scaffold 自定义模板已开放。
- **P7-7b-1 已实施（待评审，2026-11-21）**：后端模板工作室——① `SessionView = AppView | 'template'`（`AppView` 仍三值；`app_sessions.view='template'` 只是新值，不改表）；② `ChatTarget`/`handleChat`/`handleAppChat` 等价包装、`ensureTargetSession`/`verifyTargetAssets`；③ `design-template/workshop.ts`（AGENTS/opencode.json V2 权限/workshop.json、skill/command/scripts 受管副本、`catalog/builtin/<packId>` 36 文件只读镜像按版本/mtime/hash 刷新、catalog 刷新、reloadLocations best-effort）；④ `studio.ts` + `studio-routes.ts`（§13.3 全部接口：state/sessions/prompt/interrupt/compact/events/权限/表单/model，`app_id=__template__:<packId>`、模型 stage=`template` 不继承应用）；⑤ `templates/workshop` 补 `SKILL.md` + `references/contract-recipes.md` + `commands/generate-design-template.md`；⑥ 后端 **217/217**（+26），`e2e:p2/p3/p4` 116/126/128、`smoke:workspace/assets` 通过。**本记录为 7b-1 当时结论；后续 7b-2a/2b 已完成（Studio UI/template-preview/模板中心自定义入口），7c（真实工具权限/真实模型/应用闭环）当时未做（P7-7c-1/c-2 已于 2026-11-21 完成，见后节）**。
- **P7-7b-2a 已实施（待评审，2026-11-21）**：模板工作室前端 + 自定义模板预览 + 测试守卫——① `StudioView`（`#/studio/<packId>`，`App.vue` 新路由）：返回/模板名/版本/状态/模型选择、左页面清单/spec 校验/首条提示、中 `AgentChatPanel`（工作室 API）、右 `template-preview.html` iframe（页面下拉/刷新/新窗口/空态）、底部生成/发布（二次确认）/丢弃草稿/CSS 冲突与最后生成时间；草稿不存在/加载失败/opencode 未就绪有错误态。② `AgentChatPanel` 可选 `api`/`commands` prop（默认 `dev/api.ts`/`commandsForView`，三视图行为不变）；`dev/types.ts` 增 `SessionView = AppView | 'template'`（AppView 仍三值）；`studio/api.ts#studioChatApi` 适配 `/api/design-templates/drafts/:id/studio/*`（状态映射 `view=template`、SSE、错误透传）。③ 新增 `template-preview.html` + `src/template-preview/**`：`?draft=&page=&embed=1` / `?pack=&page=`；reference 用 `preview.html?...&structureDraft|Pack=<packId>` iframe，contract 用 synthetic design（sampleEntity+sampleSubEntities + `flattenContract`）→ `adaptDesign` → `ContractPage`；注入 pack `structure.css`、内置风格类、`baseApplicationType` 短类；不写 PNG。④ `preview.html` 支持 `structurePack/structureDraft`（替换 `#preview-structure-css`，失败回退+提示，URL 保留；无参数行为不变，`e2e:preview` 仍 83）。⑤ `runtime.ts` 新增 `assertSafeTestServePort`：`NODE_TEST_CONTEXT` + 默认 4771 且非 `RG_ALLOW_REAL_OPENCODE=1` 拒绝启动真实 serve（`ensureStarted/start` 均调用）。⑥ `DraftDetail` 附带权威 `pack`（草稿预览不再走 pack.json 资产）。⑦ 后端 **219/219**（+2 守卫）、前端 **170/170**（+24）；`e2e:p2/p3/p4` 116/126/128，`e2e:preview/p7-3b/p7-4b/p9/p10` 83/38/48/70/79；手工 Playwright 54 条断言 0 错误。**本记录为 2a 当时结论；后续 2b 已完成模板中心自定义入口与 `e2e:p7-7b`，picker/scaffold/真实模型/真实实例（7c）当时未做（P7-7c-1/c-2 已于 2026-11-21 完成，见后节）**。
- **P7-7b-2b 已实施（待评审，2026-11-21）**：模板中心自定义入口 + 全链路 e2e + 清理——① browse 增加「自定义」分类：未发布草稿 + 已发布自定义 pack 合并去重，卡片显示名称/风格/版本/状态/`页面 N（reference a · contract b）`/引用应用数；动作：进入工作室/编辑（已发布无草稿时 `POST /packs/:id/draft` 反写）、预览（`template-preview.html?draft|pack=&page=&embed=0`）、删除（内联二次确认；409 `pack-referenced` 展示应用列表）；内置不可删。② 新建对话框（名称/风格/base 应用类型）→ `POST /api/design-templates/drafts` → 跳 `#/studio/<packId>`（只创建草稿）。③ `GET /api/design-system` 摘要增加 `referencedApps`（自定义 pack；内置为空）。④ 新增 `e2e:p7-7b`（stub opencode/临时目录 3429/4429）：创建→工作室→fixture spec→生成→reference/contract 预览→发布 1.0.0→中心可见/编辑→picker 不列自定义→删除 409/解除引用删除；编辑覆盖草稿存在直接进入与丢弃后由已发布 pack 反写；**50 条断言**、0 非预期 console error/pageerror/请求失败/外部请求。⑤ `e2e:p7-3b` 更新为自定义入口/空态/新建（**39 条**，原 38）。⑥ 清理 `template-preview#packJsonUrl`（后端资产只允许 css/svg/png/jpg）、修正 SKILL §6 为 13 个控件（补 `pm-select-tree`）。⑦ 后端 **219/219**、前端 **172/172**（+2），回归 e2e 与 smoke 通过。**新建应用 picker 列自定义 pack、scaffold contract 闭环、应用内自定义 structure、真实工具权限/真实模型/真实 3300/4771 仍留给 P7-7c**。
- **P7-7c-1 已实施（待评审，2026-11-21）**：自定义模板应用闭环 + e2e（**不调真实模型**）——① `design/system-file.ts`：自定义 pack 摘要写 `origin`/`preview`、`pages[].kind/source/contractFile`；contract 页不写 `.vue`、写 `contracts/<page>.json`；合并 `structure.css` 原样复制；幂等。② `apps/design-system.ts`/`routes.ts`：应用解析补 `origin`/`preview`（base/结构 URL/styleClass/kind）/`contractFile`；新增 `GET /api/apps/:id/design-system/asset?path=`（相对 `docs/design/template`，只允许 css/svg/png/jpg/jpeg，路径安全）。③ scaffold/distribution：应用 AGENTS/README + 设计模板 skill 页面 kind/契约段 + manifest `templateKind/packVersion`；`ensureWorkspaceAssets` 对齐 contract/structure/styles/skill（不碰 frontend/docs 正文）。④ digest/ui-check：契约页“无蓝图，按契约实现”、页面表含类型/来源/契约；ui-check 缺失生成/不覆盖/只读不变。⑤ fidelity：**13 项**新增 `template-contract`；`blueprint-files` 契约页跳过并校验契约文件（缺失 warn 不 fail）；`check-fidelity.mjs`/command/`fidelity.test.ts`/`smoke:workspace`/`e2e:p7-6a` 同步（15→**18**）。⑥ 前端：`DesignPreviewApp` 读 `preview` 用 base 短类 + 应用内 structure（失败回退 registry + warning，`data-structure-fallback`），PNG 协议不变；`DesignView` 徽标自定义带版本；`DesignTemplateCenter` picker 列已发布自定义 pack（草稿不列）、页面库显示 kind/来源、自定义详情用 `template-preview.html`；`NewAppDialog` 选择自定义后载入详情；`design-system-api.ts`/`design-template-helpers.js` 类型/纯函数。⑦ 新增 `e2e:p7-7c`（stub，端口 3430/4430 起）：API 创建→fixture spec（reference 运营 list + contract dialog-form）→生成→发布 1.0.0→picker 已发布可见/未发布草稿不列→API 新建应用→工作区文件/资产接口/对齐→设计视图自定义 structure+base 类+contract dialog→PNG（宽高+主色像素）→开发 digest/ui-check/fidelity 13 项；**108 条断言**、0 console error/pageerror/请求失败/外部请求。⑧ 基线：后端 **230/230**、前端 **178/178**；`e2e:p7-7b` **51**（原 50；picker 改为列已发布自定义）、`e2e:p7-3b` **39**、`p2/p3/p4` **116/126/128**、`preview/p7-4b/p9/p10` **83/48/70/79**；`build`/`typecheck`/`check:vue`/`smoke:workspace`/`smoke:assets` 通过。**真实工具权限/真实模型 `deepseek-flash`/真实 3300/4771 验收（P7-7c-2）当时未做（已于 2026-11-21 完成，见后节）**；本会话不启停真实实例、未读写真实 `data/`/`projects/`/`.env`、未调模型、未做 git。
- **P7-7c-2 已实施（待评审，2026-11-21）**：真实模型闭环（临时 3487/4787，真实 opencode 2.2.5 + `packycode-deepseek/deepseek-flash`）——模型读 AGENTS/catalog/skill 后写 3 页 spec（reference + 2 contract）、自行生成/校验（0 error/0 warning）、中文汇报；发布 1.0.0 → 新建应用 → 设计预览/PNG（2880×1800，data-cyan）→ fidelity **13 项 pass 5 / warn 8 / fail 0**（`template-contract` pass）。真实权限：`shell Get-ChildItem` 被 `permission.rejected`，模型改用 read/glob 继续；catalog/.opencode/projects/仓库源码前后 hash 无变化。**真实模型驱动修复**：首轮 8.7s/10 read 被误判 `succeeded`，根因 `session-state.ts` 把 `finish=tool-calls` 当收尾、未识别数值型 `time.busy`；已最小修复 + 3 条单测。证据 `docs/plans/evidence/2026-11-21-p7-7-real-model/`；后端 230/230、前端 178/178，e2e 全部通过。
- **真实实例**：**2026-11-20 曾监听**（PID **40704** `node`（工作台后端）、**41744** `opencode serve`，启动 **2026-11-20 16:15:08**）；**2026-11-21 只读核对已无 LISTEN、`/api/health` 连接失败、PID 不存在**；**2026-11-23 只读核对已恢复运行**：3300 PID **39828**（`node dist/index.js`，启动 **09:10:41**）、4771 PID **19608**（`opencode serve` 2.2.5，启动 **09:10:42**），`/api/health` 200（`ok:true`、`runtime.ready:true`、`pendingSessions:0`）。`backend/dist` **2026-11-23 10:08:23**、`frontend/dist` **2026-11-23 10:08:49**（2026-11-21 21:34/21:31 为 P7-7c-2 修复/回归重新构建，原 2026-11-20 16:14:38/16:15:07）；Express 静态托管**即时生效**——设计视图「原型」只展示设计产物、无切换按钮（无契约自动结构草图），PNG 为模板风格，**刷新即可用**；后端进程比 dist 早约 58 分钟，09:10 后若有后端改动需用户自行 restart（本轮未启停、未验证运行进程内后端是否为最新源码）。库为 4 表新结构，`apps>0` 正常；fail-closed 只针对「旧 5 表结构 + `apps>0`」。历史 P9/P10/P11 验证均在临时目录与独立端口（3444/3446/3447）；本会话未读写真实 `data/`/`projects/`/`.env`。**本文件/实施不启停真实实例，后续由用户 `restart.cmd`/`restart.sh`；以实际为准**。
- **不做任何 git 操作**；未执行 init/commit/revert，未写 `.gitignore`。
- **待用户执行**：切换/重启始终由用户执行（`restart.cmd` / `restart.sh`）。当前 `backend/dist`、`frontend/dist` 已与源码一致（2026-11-21 21:34/21:31 构建），**无需再手动构建**；如需重启按 `docs/ops/switch-to-agent-first.md` 执行，工作台不自动切换/回滚。

## 真实 3300 人工验收（2026-11-23）

> 只写已确认事实；未采集项明确标注，不补写验收细节。

| 项 | 事实 |
| --- | --- |
| 结论 | 用户确认真实 3300 人工验收**全部通过**（2026-11-23）；**P7-7 评审仍待定** |
| 3300 | LISTEN，PID **39828**（`node dist/index.js`），启动 **2026-11-23 09:10:41** |
| 4771 | LISTEN，PID **19608**（`opencode serve` 2.2.5），启动 **2026-11-23 09:10:42** |
| 健康检查 | `GET /api/health` **200**：`ok:true`、`runtime.ready:true`、`pendingSessions:0` |
| 构建产物 | `backend/dist` **2026-11-23 10:08:23**、`frontend/dist` **2026-11-23 10:08:49** |

- **未采集（本轮未提供，不做推断）**：验收用的 appId / packId / 模板名、fidelity 计数、耗时、权限拒绝/越界检查、截图与日志。
- **运行态 caveat**：后端进程（09:10 启动）早于 `backend/dist`（10:08）约 58 分钟——**前端静态托管即时生效**；若 09:10 之后后端有改动，运行进程内的后端不一定是最新源码，需用户自行 `restart.cmd` / `restart.sh`。本轮未启停实例、未验证运行进程内后端与源码一致。
- **基线**：后端 **230/230**、前端 **178/178**、e2e 各项数字为 2026-11-21 口径，**本轮未重跑**。

## 打磨批 1（2026-11-23）：mock 枚举多样性 + 预览 embed + pm-steps

> 交接单：[`docs/plans/2026-11-23-polish-batch1-a-f1-f2-brief.md`](plans/2026-11-23-polish-batch1-a-f1-f2-brief.md)。只改前端源码/前端测试/必要 e2e 断言与文档；**未改** backend 源码/DB/templates/依赖，未启停真实实例，未调模型，未做 git。

- **A. mock 枚举多样性**：`frontend/src/design-preview/contract-preview.js` —— `mockFieldValue(field,index,offset=0)` 枚举取值改为 `options[(i+offset)%len]`（非枚举类型行为不变，两参调用兼容）；`mockRowsForEntity` 按实体枚举字段出现顺序计算 offset（首个枚举字段 0，其后 1..n），同一行多个枚举列不再同值；确定性、无随机。`statusClassOfValue`/dashboard/detail 模型逻辑未改（dashboard 饼图取首个枚举字段，分布不变）。
- **F1. 模板中心内置预览 embed**：`frontend/src/workbench/design-template-helpers.js#buildPreviewUrl` 增加可选 `embed`（true 追加 `embed=1`，默认 false 向后兼容）；`DesignTemplateCenter.vue` 内置 pack 预览传 `embed:true`，隐藏预览自带风格切换器/角标（模板中心自己的风格切换保留）。未改 `preview.html`/`PreviewApp.vue` 语义。
- **F2. pm-steps 点击步条同步 v-model**：`frontend/src/design-system/pm-v3/components/pm-steps/pc.vue#clickFun` 先 `emit('update:modelValue', data?.value ?? index)` 再 `emit('clickStep', ...)`（预览适配，注释已标注与上游行为差异）；覆盖模板页 value=1..4 与 ContractPage wizard value=0..n-1。
- **单测**：`frontend/src/design-preview/contract-preview.test.mjs` 增 3 条（枚举 offset/两参兼容、同行多枚举不同值 + 首个枚举分布/确定性、既有商品实体状态列回归）；`frontend/src/workbench/design-template-helpers.test.mjs` 增 1 条（embed 默认无 / true 含 `embed=1` 且保留 type/style/page）。
- **e2e 断言**：`backend/scripts/preview-e2e.ts` 新增第 8 段（enterprise-application-platform/application-form 点击步条第 2/3/1 步断言分组切换，**83→93**）；`backend/scripts/design-template-e2e.ts` 内置预览断言 iframe 含 `embed=1` 且 frame 内无 `.preview-style-switch`/`.preview-badge`（**39→42**）；`backend/scripts/template-png-e2e.ts` wizard 段点击步条第 2/1 步断言当前分组切换（**79→82**）。
- **命令与结果**：`npm test --prefix frontend` **182/182**（原 178，+4）；`typecheck` 通过；`check:vue` 通过（全部 SFC 导入完整）；`build --prefix frontend` 成功（exit 0）。e2e（临时目录 + 独立端口 + stub opencode）：`e2e:preview` **93**、`e2e:p7-3b` **42**、`e2e:p7-7b` **51**、`e2e:p9` **70**、`e2e:p10` **82**、`e2e:p7-7c` **108**，全部通过；结束核对 3420—3455 / 4400—4500 无残留监听。未跑 `e2e:p3`（未改 P3 相关路径）。
- **未验证/偏差**：真实 3300/4771 未启停（仍需用户 `restart.cmd`/`restart.sh` 后人工验收本批视觉变化）；PNG 仅宽高 + 主色采样；`pm-steps` 与上游行为差异属预览适配，未回写上游组件；模板中心 iframe 内重复风格切换器问题随 F1 消除。

## 打磨批 2（2026-11-23）：ui-check 文案/状态区分（C1）

> 交接单：[`docs/plans/2026-11-23-polish-batch2-c1-ui-check-brief.md`](plans/2026-11-23-polish-batch2-c1-ui-check-brief.md)。纯文案/状态区分；**未改** DB/表/API 语义/依赖、未改 `ui-check.ts` 生成与状态判定、未改 digest `ui-check：已生成未填` 口径、未新增按钮/API（C3 未做）；未启停真实 3300/4771，未调模型，未读写真实 `data/`/`projects/`/`.env`，未做 git。

- **前端**：`frontend/src/dev/design-ref.js` 新增导出 `uiCheckHint(status)`——missing：`未生成：在开发视图选中模块并发送首条开发消息后自动生成；实现前先填。`；skeleton：`已生成未填：先填「实现前」对照表再写代码；未填不阻断。`；filled/其它：空串。`DevView.vue` 的 `dev-ui-check-pending` 改为渲染 `uiCheckHint(uiCheckStatus)`（保留 testid、`muted warn` 样式与 `uiCheckFlowPending` 显示条件）；`uiCheckLabel`/`uiCheckTone` 未改（短文案 `未生成`/`已生成未填` 不变）。
- **fidelity**：`fidelity-core.cjs#uiCheckCheck` 保持 `status:'warn'`，13 项与 `id/label/status/evidence` 不变，仅 hint 按情况区分：仅 missing → “未生成：打开开发视图选择模块并发送首条开发消息会自动生成骨架；实现前先填。”；仅 skeleton → “已生成未填：先填 docs/design/<MOD>/ui-check.md 的「实现前」表再写代码；未填不阻断。”；两者都有 → 两段合并。
- **单测**：`frontend/src/dev/design-ref.test.mjs` 新增 `uiCheckHint` 的 missing/skeleton/filled/空值断言（**183/183**，原 182）；`backend/src/dev/fidelity.test.ts` 新增 1 条（missing hint 含“自动生成”；skeleton/混合 hint 差异 + evidence 仍列各模块状态 + 仍 13 项，**231/231**，原 230）。
- **e2e 断言**：`p4-e2e.ts` 新增 1b.6b（初始 pending 含“自动生成”）与 2b.27（已生成未填 pending 含“实现前”），**128→130**；`fidelity-e2e.ts` 新增 2.7b（ui-check 缺失项 hint 含“自动生成/未生成”），**18→19**。既有精确 label 断言（`未生成` / `已生成未填`）与 digest 断言未改。
- **命令与结果**：`npm test --prefix frontend` 183/183；`typecheck` 通过；`build --prefix frontend` 成功；`check:vue` 通过；`npm test --prefix backend` 231/231（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`）；`tsc -p backend/tsconfig.json --noEmit` 通过；`build --prefix backend` 成功；`e2e:p4` **130**、`e2e:p7-6a` **19**、`e2e:p7-7c` **108**、`smoke:workspace` 通过（全部临时目录/独立端口/stub）；结束核对 3400—3500 / 4400—4500 无残留监听，未触碰 3300/4771。
- **未验证/偏差**：真实 3300/4771 未启停，新文案需用户 `restart.cmd`/`restart.sh` 后人工查看；未跑 `e2e:p2/p3`（未改相关路径）；`ui-check.md` 仍由开发 prompt 在模块明确时自动生成（无显式“生成”按钮，C3 未做）。

## 打磨批 3（2026-11-23）：移动端 <768 审计与修复（E）

> 交接单：[`docs/plans/2026-11-23-polish-batch3-mobile-brief.md`](plans/2026-11-23-polish-batch3-mobile-brief.md)。先测量（390×844 / 414×896 / 768×1024）后修复，再加永久断言。只改前端 `StudioView`/`DesignTemplateCenter` 与 3 个 e2e 脚本、文档；**未改** DB/API 语义/依赖/backend `src`/`templates/**`；未启停真实 3300/4771，未调模型，未读写真实 `data/`/`projects/`/`.env`，未做 git。

- **实测（修复前）**：页面级横向溢出（`documentElement.scrollWidth` vs `innerWidth`）在全部 surface × 3 viewport 均为 **0**；**唯一硬问题是 Studio**：`@media (max-width:1180)` 仅 `display:none` 预览，390/414/768 下预览面板与预览页下拉均不可见/不可达，左栏固定 240px 导致 390 下对话仅 150px 宽。模板中心/picker 390 下无溢出、`使用此模板`/关闭/搜索均可见可点，但标题列被「当前：…」挤成窄列（可读性差）。设计视图「原型」与 `template-preview.html`（embed=0/1）在 3 个 viewport 均无整页横向溢出，iframe 内 `scrollWidth == clientWidth`（表格容器自身可横向滚动）。
- **修复 1（Studio）**：`StudioView.vue` 新增窄屏（**≤1180**）单栏 tab「页面 / 对话 / 预览」（`data-testid=studio-tab-pages|chat|preview`，默认对话），三个面板加 `pane-active` + `data-testid=studio-pane-pages|chat|preview`；`.studio-body` 窄屏改单列，仅激活面板显示，**预览可达**且对话获得整栏宽/高；桌面 **>1180 三栏行为不变**（tab 隐藏，三栏同时可见）。未改 `AgentChatPanel` 内部。
- **修复 2（模板中心/picker）**：`DesignTemplateCenter.vue` 增加 `@media (max-width:560px)`：头部换行、标题占满整行、`当前` 与关闭按钮独占第二行（关闭靠右）、搜索框撑满剩余宽度；390 下标题列由窄列恢复可读。无行为/API 变化。
- **修复后实测**：390/414/768 下 Studio 三个 tab 均在视口内，页面清单 2 页、预览 iframe 与预览页下拉可见，`studio-preview-frame` 宽 = 视口宽且 iframe 内无横向溢出，生成/发布/丢弃按钮在视口内；模板中心/picker 390 标题列宽 > 200、`使用此模板` 可点、无整页溢出；设计视图与 template-preview 维持无溢出（**无改动**）。
- **e2e 断言**：`design-template-studio-e2e.ts`（p7-7b）增桌面三栏/tab 隐藏 + 390×844 Studio 三块可达/template-preview embed=1/0（**51→73**）；`design-template-e2e.ts`（p7-3b）增 390×844 模板中心/picker 无溢出、标题列宽、按钮可点（**42→55**）；`custom-template-app-e2e.ts`（p7-7c）增 390×844 设计视图原型 iframe 可见/无溢出、契约页无溢出（**108→116**）。断言数按本轮实跑记录，不沿用旧基线。
- **命令与结果**：`npm test --prefix frontend` **183/183**；`typecheck` 通过；`build --prefix frontend` 成功（exit 0）；`check:vue` 通过。e2e（临时目录+独立端口+stub，除 p7-3b 沿用 `OPENCODE_AUTO_START=false`）：`e2e:p7-3b` **55**、`e2e:p7-7b` **73**、`e2e:p7-7c` **116**、`e2e:p9` **70**、`e2e:p10` **82**，全部通过。结束核对：测试端口（3420—3500 / 4400—4900）无残留监听；仅真实 4771（PID 19608，用户实例）与无关 WPS 4709；真实 3300（PID 39828）/4771 未启停。未跑后端单测（未改 backend `src`）；未跑 `e2e:p2/p4`（工作台外壳未改）、未跑 `e2e:p3`（DesignView/原型面板未改）。
- **截图**：修复前 `%TEMP%\workbench-mobile-qbEIYe\`、修复后 `%TEMP%\workbench-mobile-G1vwRM\`（每个 viewport × surface）；e2e 新增移动截图在 `%TEMP%\workbench-p77b2b-shots\p7-7b2b-studio-mobile.png`、`%TEMP%\workbench-p77c-shots\p7-7c-design-mobile.png|p7-7c-design-form-mobile.png`、`%TEMP%\opencode\p7-3b-mobile-picker.png`（临时，不入库）。
- **未验证/偏差**：真实 3300/4771 未重启，移动端视觉需用户 `restart.cmd`/`restart.sh` 后在真实设备/浏览器复核；断言覆盖 390/414/768 的 no-overflow/可达性，未做像素级视觉回归（未加视觉快照）；iframe 内表格按“容器横向滚动”处理，未改 `ContractPage`（本轮实测无整页溢出，故不改）；未验证 320px 及更窄视口。

## 打磨批 5（2026-11-23）：开发视图真实模型复跑（B）

> 交接单：[`docs/plans/2026-11-23-dev-view-real-model-brief.md`](plans/2026-11-23-dev-view-real-model-brief.md)；证据：[`docs/plans/evidence/2026-11-23-dev-view-real-model/`](plans/evidence/2026-11-23-dev-view-real-model/README.md)。临时实例（后端 3488 / opencode 4788）+ 真实 opencode 2.2.5 + `packycode-deepseek/deepseek-flash`；**未启停真实 3300/4771**（PID 39828/19608 前后一致），**未读写真实 `data/`/`projects/`/`.env`**，**未做 git**，**未改产品代码**（仓库源码/模板前后 hash 0 变化）。

- **链路**：自定义模板 `goods-hub`（reference `goods-list`←`operations-management/list` + contract `goods-form` `dialog-form`；data-cyan；base=operations-management）→ 草稿写 spec → 生成 **errors 0 / warnings 0** → 发布 **1.0.0** → 新建应用 `p77-dev-real`（design-system/蓝图/契约/structure/styles/skill 齐全）→ 需求 `MOD-001` + `design.json` fixture（2 页）→ `PUT model` development=`packycode-deepseek/deepseek-flash` → 开发会话 + 中文实现 prompt。
- **开发会话**：**自动收尾**（`succeeded`，连续稳定 2 次；**无需 interrupt**）；**514,242ms ≈ 8m34s**；**74 消息 / 108 工具**（read 47、shell 29、edit 25、grep 4、write 3）；0 待处理权限/表单；上下文 208,878/1,048,576（19.9%）。
- **实现产物**（仅应用工作区）：`frontend/src/views/goods/GoodsList.vue`（BusinessListPage/QueryPanel/RowActions/ThreePartPagination + `pm-table` + `v-auto-height`）、`GoodsForm.vue`（`pm-form-dialog` + `FormSection` + pm-*）、`router/index.js`（`/goods`）、`build/mfp.config.js`（暴露 `./goods-list`）、`frontend/README.md`、`docs/design/MOD-001/ui-check.md`；两页均用 `GlobalPreference`（页面 computed 合并）与 `visual-style-data-cyan` 风格类。
- **ui-check**：**filled**（实现前/实现后/未实现与待确认均补；保留骨架 marker，fidelity 判定「已填」）。
- **fidelity 13 项**（`POST /apps/p77-dev-real/design-fidelity` `{module:'MOD-001'}`）：**pass 12 / warn 1 / fail 0**；唯一 warn = **`prototypes`（MOD-001: 未导出）**——fixture 未提供 PNG，属预期，不影响静态一致性结论；`template-contract` pass。
- **Playwright（开发视图）**：状态「本轮完成」、ui-check「已填」、13 张 fidelity 卡片、最终汇报与工具卡可见；**0 console error / 0 pageerror / 0 请求失败 / 0 外部请求**；截图 6 张（开发视图/时间线/设计参考/fidelity）。
- **权限/越界**：`permission.rejected` **0**；4 个失败工具均为工具/驱动侧（便携 shell 扫描器拒绝复杂单行 `node -e`；`edit` oldString 不匹配已重试；fidelity CLI 管道调用退出码 1，单独运行正常）。仓库 `backend/src`(90)/`frontend/src`(251)/`templates/**`(210)/`frontend/dist`(97)/`backend/dist`(182) **sha256 全部一致**；真实 `data/`（122 项元数据）与 `projects/`（28,968 文件 / 828,471,575 B 指纹）**无变化**；应用外仅模型在 `%TEMP%\opencode\check-vue-tags.cjs` 写了临时自检脚本。
- **清理**：`POST /api/opencode/stop` + 结束临时后端；3488/4788 **无 LISTENING**，临时 PID 消失；真实 3300/4771 PID/启动时间一致、`/api/health` 200。
- **偏差/未验证**：按要求未 `npm install`/`npm run build`/dev server，应用前端**未编译、未运行、未做交互截图**（只做静态实现 + `check-fidelity` CLI 自查；不能声称视觉已还原）；需求“批量操作”未进 `design.json` `batchActions`，模型按需求+模板默认补批量删除并标注待确认（契约缺口，非阻断）；reference 页检索从蓝图中左栏移到表格上方 `QueryPanel`、未实现“导出台账”，文案改为商品语义（模型已记录取舍）；未验证真实 AFCenter `pm-*` 运行态、EOS 构建、真实 401/403、应用 <768px 布局。
- **无阻塞性产品 bug**，本轮停止实施、不改产品代码；**D2（PNG 像素级 diff）暂不做、pm-sheet 暂不动**（用户 2026-11-23 决定）。

## 第一阶段收尾（2026-11-20）

> 交接单：[`docs/plans/2026-11-20-phase1-handover-and-next-session-prompt.md`](plans/2026-11-20-phase1-handover-and-next-session-prompt.md)（含可直接复制的新会话话术）

- **结论**：第一阶段**功能收尾**；用户已跑通主流程（创建应用 → 设计 → 模板风格原型/PNG → 开发链路）。进入**功能细化 / 优化 / 打磨**，等待用户需求；**不是“全部评审通过”**，P7-1～P7-6c、P7-4b、P8-1、P8-2、P9、P10、P10b、P11、P12 均为已实施（待评审）；**P7-7a、P7-7b-1、P7-7b-2a、P7-7b-2b、P7-7c-1、P7-7c-2 已实施（待评审）**。
- **基线（P7-7c-2 后）**：后端 **230/230**、前端 **178/178**；`e2e:p7-7c/p7-7b/p7-6a/preview/p7-4b/p9/p10` = **108/51/18/83/48/70/79**；`e2e:p2/p3/p4` = **116/126/128**；`build`/`typecheck`/`check:vue`/`smoke:workspace`/`smoke:assets` 通过；报告 HTML 沿用 P7-A（**739,859 B**）、PDF **1,154,252 B**（15 页，未重跑 build:report）。
- **未完成/风险**：真实 3300/4771 人工验收（仍由用户执行）、真实 AFCenter 宿主 `pm-*`、EOS 运行态、真实 401/403、<768 移动端未验证；PNG 仅宽高 + 主色采样（无像素级 diff，>5MB 仅 `scale=1` 重试）；`pm-sheet` 占位、模板中心 iframe 内重复风格切换器、`pm-steps` 点击步条不更新 v-model；真实模型对新配方（main-sub/wizard/detail/dashboard）完整产出未复跑；P7-7 全部记录**待评审**。

## P8-1 实施（2026-11-20）：彻底移除旧版设计模板（1b）

| 项 | 位置 / 说明 |
| --- | --- |
| DB | `db-migrate.ts`：`NEW_TABLES` 4 张（`apps`/`app_settings`/`app_sessions`/`requirement_templates`）；删除 `prototype_templates` DDL/索引与 `apps.prototype_template_id` 列；`PRESERVED_TABLES` 只保留需求模板；旧结构（旧应用域表/`prototype_templates`/旧列）判定后重建；`apps>0` 仍 fail-closed |
| 删除模块 | `backend/src/design/builtin-templates.ts`、`design/templates.ts`、`design/types.ts`；`DesignError` 迁到 `design/errors.ts`；`/api/prototype-templates` 路由、`prototypeTemplateRoutes`、旧原型模板 CRUD/seed 全部删除 |
| 应用/解析 | `POST /api/apps` 只接受需求模板 + 设计三键；旧客户端 `prototypeTemplateId` 忽略并 warning；`payload` 不再返回 prototype/legacy 字段；`designSystem` 始终解析（无三键 → 默认 pack/类型/风格 `global-default`）；`GET /apps/:id/templates` 只返回需求模板 |
| 参考包 | `POST /apps/:id/design/:module/prototypes` 入参 `styleId`（校验属于应用 pack 的风格，非法 400）；`_manifest.json` 与 `tokens.json` 写 `{styleId, name, tokens}`；`artifacts.tokens` 用 `styleId` |
| 分发 | 删除旧原型模板 skill 生成（`writePrototypeTemplateSkill`）与 `expectedSkillIds` 旧模板分支；保留需求模板 skill、设计模板 skill（`adw-template-proto-<applicationType>`，manifest kind `design-system`）、团队/方法 skill |
| 前端 | `NewAppDialog` 删除「旧版兼容（原型模板）」；`HomeShell`/`AppShell` 摘要显示设计模板；`DesignView` 徽标只显示 `类型 · 风格`；皮肤由 `skinFromStyle(designSystem.style)` 构造（`frontend/src/design/prototype/skin.js`，3 例单测）；`DesignPrototypePanel`/`PrototypeCanvas` `template` → `skin`；`design-export.js` 用 `styleId`；删除 `pickPrototypeTemplate`/`listPrototypeTemplates`/`PrototypeTemplate` |
| 测试 | 后端 **133/133**（+1：5 表重建/4 表断言）；前端 **104/104**（-1 pickPrototypeTemplate +3 skin）；`e2e:p7-3b` **38**（原 45，删除旧版兼容/legacy 场景）；其余 e2e 保持 |

验证（实跑）：

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **133 / 133** |
| `npm test --prefix frontend` | **104 / 104** |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过（2800 modules） |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416；4 表/无旧列/设计模板 skill） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型；2 方法 + 开发 + 2 团队 + 设计模板 + 需求模板 skill + 5 command） |
| `npm run e2e:preview / p7-3b / p7-4b / p7-6a --prefix backend` | **77 / 38 / 48 / 15** |
| `npm run e2e:p2 / p3 / p4 --prefix backend` | **116 / 126 / 128** |
| `npm run build:report --prefix backend` | 通过：HTML 735,580B（718.3KB，离线、0 console error、三档无横向溢出）；PDF 1,095,036B（14 页）；flow PNG 567,720B（截图未重截，沿用 P7-A） |

偏差/说明：

1. `db-migrate.ts` 为删除旧表/旧列仍需写 `prototype_templates` / `prototype_template_id` 字符串（仅用于识别并删除旧库）；负数断言（测试/smoke 断言“不存在”）保留旧名称作为验收证据。
2. 旧客户端带 `prototypeTemplateId` 时忽略并返回 warning（不 400），避免旧页面报错。
3. 设计视图仍是线框渲染（皮肤改由风格 tokens 驱动）；真实模板预览（iframe）留给 P8-2（已实施，见 P8-2 节）。
4. `templates/design-system/**`、`templates/afc-remote/**`、`templates/agent/**` 与需求模板中心未改。
5. `e2e:p2` 3.2/3.2b 改为 `waitFor` 模板 skill 落盘（原有竞态；断言数保持 116）。

未验证：真实 3300 切换后的运行态；真实浏览器下新皮肤的视觉验收（结构/缩放/PNG 导出已由 e2e 覆盖）；旧库 `apps>0` 的 fail-closed 只在单测覆盖（未对真实库执行）。

## P8-2 实施（2026-11-20）：设计视图原型真实模板预览（Y）

| 项 | 位置 / 说明 |
| --- | --- |
| embed | `preview-params.js#embedEnabled`（`embed=1/true`）；`PreviewApp.vue` 嵌入时 `v-if="!embed"` 隐藏 `.preview-style-switch`/`.preview-badge`，`updateLocation` 保留 `embed`；type/style/page 语义不变 |
| 纯函数 | `design-template-helpers.js`：`resolvePreviewTarget(page, applicationType, templatePages)` → `{pageId, valid, reason}`（no-catalog-ref/invalid-catalog-ref/no-application-type/type-mismatch/page-not-found）；`buildEmbedPreviewUrl` = `buildPreviewUrl` + `&embed=1`；单测 +6 |
| 面板 | `DesignPrototypePanel.vue`：props `applicationType/styleId/templatePages`；`mode` preview/wireframe；catalogRef `<type>/<pageId>` 且 type 与页面库都匹配才可预览；预览 `<iframe data-testid=prototype-preview-frame>`，线框原 `PrototypeCanvas`；无 catalogRef 回退 + 提示“未认领模板页面…”；预览隐藏缩放组、禁用导出并提示；切换只换面板内容 |
| 视图/导出 | `DesignView.vue` 传设计系统摘要；隐藏导出画布保持线框（PNG/tokens/manifest 不受预览模式影响，仍用 `styleId`） |
| e2e | 新增 `backend/scripts/prototype-preview-e2e.ts` + `e2e:p8-2`（临时根/3445/stub；28 条：默认预览/iframe URL/模板内容/embed 无切换器角标/切线框/切回预览/无 catalogRef 回退/导出禁用/0 console·pageerror·请求失败·外部请求）；`e2e:p7-4b` 进入原型先点 `prototype-mode-wireframe`（仍 48）；`e2e:preview` 增加 embed 段（77→83） |

验证（实跑）：

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | **111 / 111**（原 104 + target/embed URL 6 + embed 参数 1） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过（2800+ modules；`dist/preview.html` 正常） |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **133 / 133**（未改后端） |
| `npm run e2e:p8-2 --prefix backend` | **28 条断言**；端口 3445 已关闭 |
| `npm run e2e:p7-4b --prefix backend` | **48 条断言**（先切线框） |
| `npm run e2e:p3 --prefix backend` | **126 条断言**（fixture 无 catalogRef，默认线框） |
| `npm run e2e:preview --prefix backend` | **83 条断言**（77 + embed 6） |
| `npm run e2e:p7-3b / p2 / p4 --prefix backend` | **38 / 116 / 128 条断言** |
| `npm run build:report --prefix backend` | 通过：HTML 719.4KB（736,639B）、PDF 1,079.9KB（1,105,831B，14 页）、flow PNG 567,720B；截图/流程图沿用 P7-A 未重截 |

偏差/说明：

1. **真实预览只代表模板视觉基准**：iframe 展示模板 pack 页面（如 `enterprise-application-platform/organization`），不按 `design.json` 字段/列/操作重绘 pm-v3；字段差异仍由线框体现。完全所见即所得（Y2）未做。
2. `catalogRef` 只认当前应用类型页面库；跨类型/页面不存在 → 线框 + 提示；页面 chips 仍来自 `design.json`。
3. 预览模式风格固定为应用设计系统（原型 Tab 内不改风格）；缩放组仅线框显示；预览禁用 PNG 导出，自动导出（隐藏画布）不受影响。
4. 未改后端 `src/**`、DB/表、`templates/**`、需求模板中心、P7-4b 线框渲染逻辑（除模式切换/导出禁用）；未新增依赖/未 npm install；未启停 3300/4771；未读写真实 `data/`、`projects/`、`.env`；未调模型；未做 git。

未验证：真实 AFCenter 宿主 `pm-*`、EOS 运行态、真实 3300 上的 P8-2 人工验收（用户截图已显示真实预览可用；本会话未复验）；<768 移动端原型面板与 iframe 内交互（mock 数据）；预览页面与 `design.json` 的字段级自动比对（Y2）。

## P9 实施（2026-11-20）：设计产物模板原生真实渲染（Y2 一期）

> 结论：设计视图「原型」Tab 默认用**创建应用时选择的设计模板**（应用类型 structure + 视觉风格）**原生渲染 `design.json` 该页**；覆盖 **list / tree-list / page-form / dialog-form**（正好覆盖 app1 四页），其余配方回退 P7-4b 线框；PNG 仍是线框草图。P8-2 的「模板自带页面预览」已删除。

| 项 | 位置 / 说明 |
| --- | --- |
| 新入口 | `frontend/design-preview.html` + `src/design-preview/main.ts` + `DesignPreviewApp.vue`；`vite.config.ts` 多入口 `design-preview`；后端 `GET /design-preview.html`（与 `/preview.html` 同一独立入口分支：缺失 404 文案、**不回落 index**，`/assets/*` 仍由 static 托管） |
| URL / 数据 | `?app=&module=&page=&type=&style=&embed=1&v=<designHash>`；同源 `GET /api/apps/:id/artifacts` → `design-adapter.js#adaptDesign` → 指定 page/entity；另读 `GET /api/apps/:id/design-system`（只用于配方推断，失败不阻断）；`embed=1` 隐藏底部角标 |
| 模板原生外观 | 外层 `visual-style-host visual-style-<styleId>` + 内层 `optimized-suite application-type-<短类名>`（另带 `application-type-<full-id>`）；注入 `structureLoaders[type]` 的 `structure.css`，复用 `preview/registry.ts` 的 `shared.css` 与 4 套 `style.css`；风格/结构完全取自 pack（`templates/design-system/**` 只读） |
| 结构类 / 组件 | `template-stage`/`business-page`/`page-heading`/`panel`/`org-ledger-shell`/`org-tree-panel`；`pm-search`、`pm-toolbar`、`pm-toolbar-item`、`pm-table`、`pm-pagination`、`pm-tree`、`pm-form-dialog`、`pm-input/pm-select/pm-number/pm-switch/pm-datepicker/pm-textarea`（契约 `components` 可覆盖为 pm-radio/pm-checkbox/pm-upload/pm-image/pm-select-user/pm-select-org）；tree-list 的网格/树面板规则按模板同款在渲染器内声明（未改 pack） |
| 契约渲染（纯函数） | `src/design-preview/contract-preview.js`：`resolveContractRecipe`/`supportsTemplateRender`/`prototypeModeFor`、`buildColumns/buildFilters/buildToolbar/buildRowActions/buildTreeRows/buildForm/controlOf`；**确定性 mock**（无 `Math.random`，按索引/类型/options）；**实体不存在的列/查询/字段跳过并提示**；tree 无 `parentField` 或匹配不到 → 按 `titleField` 去重扁平 + 提示 |
| 设计视图 | `DesignPrototypePanel` props 增加 `appId/designHash/designLabel`；默认模式 `supportsTemplateRender && 有显式 recipe/catalogRef` → 「模板风格」，否则「线框」；`buildDesignPreviewUrl` 纯函数；`prototype-mode-preview`/`prototype-mode-wireframe` testid 沿用；模板模式禁用 PNG 导出；删除 P8-2 `resolvePreviewTarget`/`buildEmbedPreviewUrl`；`DesignView` 传 `app-id`/`design-hash`/`design-label` |
| 模板中心不变 | 模板中心/页面库仍用 `preview.html`（`embed=1` 保留）；`PreviewApp`/registry 未改语义；PNG 导出仍走隐藏线框画布（自动导出不变） |
| e2e | 新增 `backend/scripts/design-preview-e2e.ts` + `e2e:p9`（临时根/3446/stub；**57 条**：iframe URL/模板结构类/pm 组件/data-cyan 主色/标题列/树节点/切 list/两个 dialog-form/切线框/无契约回退/0 console·pageerror·请求失败·外部请求）；删除 `e2e:p8-2` 与 `prototype-preview-e2e.ts`（模板页面预览已过时）；`e2e:p7-4b` 每次切页后先点「线框」（仍 48） |

验证（实跑）：

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **133 / 133**（未改后端业务代码，只加静态路由） |
| `npm test --prefix frontend` | **131 / 131**（新增 `design-preview/contract-preview.test.mjs` 24 + helper URL/模式 3，替换 P8-2 target/embed 5） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过；`dist/design-preview.html` + `assets/design-preview-*.{js,css}` 产出 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npx tsc -p backend/tsconfig.json --noEmit` | 通过 |
| `npm run e2e:p9 --prefix backend` | **57 条断言**；端口 3446 已关闭；截图见 `%TEMP%/workbench-p9-shots` |
| `npm run e2e:p7-4b --prefix backend` | **48 条断言** |
| `npm run e2e:p3 --prefix backend` | **126 条断言**（旧设计无 recipe/catalogRef → 默认线框） |
| `npm run e2e:preview / p7-3b --prefix backend` | **83 / 38 条断言** |
| `npm run e2e:p2 / p4 --prefix backend` | **116 / 128 条断言** |
| 临时后端（`tsx src/index.ts`，端口 3448）`GET /design-preview.html` / `/preview.html` | 均 **200 text/html**（缺失 404 分支与 `preview.html` 同一段代码，未模拟缺失） |
| `npm run build:report --prefix backend` | 通过：HTML **720.3 KB**（737,636B）、PDF **1,105.8 KB / 15 页**（P9 新增一节；`build-report.ts` 页数守卫 14→15）、flow PNG 567,720B；截图/流程图沿用 P7-A 未重截（P9 证据见 `workbench-p9-shots`） |

偏差/说明：

1. **本期覆盖 list / tree-list / page-form / dialog-form**；detail / dashboard / main-sub / wizard 仍回退线框并提示“该配方暂未支持模板风格渲染”。
2. **PNG 仍是线框草图**（自动/手动导出走隐藏线框画布）；「真实产物 PNG 截图」未做（Y2 二期）。
3. tree-list 的 `org-ledger-shell`/`org-tree-panel`/`ledger-*` 外观规则在渲染器 scoped CSS 内按模板同款声明（模板页面的这些规则原在组件 scoped 中，未进 `structure.css`）；模板页 `org-ledger-shell` 断点为 1080px、`structure.css` 通用网格为 960px，在 ~800px 的 iframe 内都会单列，渲染器把网格断点降到 720px 以保证双栏可读。
4. 动作按钮/搜索/分页为**本地 mock 交互**（ElMessage 提示），不写数据、不连平台/EOS；表单单选/多选/日期等控件只做展示与本地状态。
5. `pm-form-dialog` 以 `dialogVisible=true` + `modal=false` + `append-to-body=false` 渲染，避免遮罩挡住背后的页面与 CSS 变量丢失；关闭按钮在当前实现下不会真正关闭（预览态）。
6. 未改：DB/表、API 语义、`templates/design-system/**`、`templates/afc-remote/**`、需求模板中心、`preview.html` 业务（`embed` 保留）；未新增依赖/未 npm install；未启停 3300/4771；未读写真实 `data/`、`projects/`、`.env`；未调真实模型；未做 git。

未验证：真实 AFCenter 宿主/EOS 运行态的 pm-* 表现；真实 3300 上 P9 的人工验收（运行实例的入口与 assets 已实测 200，但未在真实实例上打开设计视图做人工视觉验收；后端显式 404 路由需重建+重启后才生效）；detail/dashboard 等未支持配方的模板化（Y2 二期）；真实产物 PNG 截图与像素比对。

## P10 实施（2026-11-20）：detail/dashboard 模板化 + 真实模板风格 PNG

> 结论：设计视图「原型」的模板风格支持集合扩展为 **list / tree-list / page-form / dialog-form / detail / dashboard**；`prototypes/*.png` 已从线框草图改为**所选模板的真实截图**（`design-preview` iframe 内 html2canvas 自截 → postMessage 回工作台）。不支持配方（main-sub/wizard）/旧无契约设计/截图失败仍用线框兜底。

| 项 | 位置 / 说明 |
| --- | --- |
| 支持集合 | `design-preview/contract-preview.js#TEMPLATE_RENDER_RECIPES` + `RECIPE_LABELS` 增加 `detail`/`dashboard`；`supportsTemplateRender`/`prototypeModeFor`/`DesignPrototypePanel` 默认模式同步；main-sub/wizard 仍回退线框 |
| dashboard 渲染 | `ContractPage.vue`：`page-heading` + `metrics-grid`/`metric-card` + `panel` + `pm-echarts`（枚举饼图优先，否则数值柱图；无字段空态）+ 最近记录 `pm-table`；指标=记录总数 + 数值字段合计（最多 2）+ 枚举种类；图表 option `animation:false` 保证截图稳定 |
| detail 渲染 | `page-heading`/`title-line`/`status-chip` + `detail-hero` + `detail-grid` + `info-grid`/`info-item` + `timeline` + 可选子表 `pm-table`（多个子表用本地页签）；无实体给空态；子表按 `layout.subTables.target` 在模块实体池解析 |
| 纯函数 | `buildDashboardModel({page,entity,rows,primary})` / `buildDetailModel({page,entity,row,subTables,entities})` / `statusClassOfValue`；确定性 mock，无 `Math.random`；单测 +10 例（含无实体/枚举/数值/状态/时间线/子表） |
| 截图协议 | `design-preview` 支持 `capture=1&rid=`：隐藏 `.contract-notes`/角标、`is-capture` 禁用动画、整页展开；加载完成（structure CSS + fonts + 2×rAF + 图表 + ~300ms）后 `postMessage ready`；父窗口发 `capture` 后在 iframe 内 html2canvas 截 `.optimized-suite`，回 `png`/`error`；`onclone` 把 html2canvas 不支持的 `color(srgb …)`（模板 `color-mix` 计算值）替换为可解析颜色 |
| 导出服务 | 新增 `design/template-capture.ts`：`shouldTemplateCapture` + `captureTemplatePage`（隐藏 iframe 1440×900、ready→capture→png、20s 超时、清理；解码后 >5MB 用 scale=1 重试）；`DesignView#runExport` 逐页模板截图，失败回退该页线框并 `console.warn`，手动模式提示；hash 比对/409 防抖/自动导出不变 |
| PNG 按钮 | `DesignPrototypePanel` 模板/线框模式都允许「导出 PNG」；按钮 emit `export` 由 DesignView 整包导出（不再本地只导当前页）；提示“导出 PNG 使用模板风格截图，不支持配方的页面为线框” |
| e2e | 新增 `backend/scripts/template-png-e2e.ts` + `e2e:p10`（临时根/端口 3447/stub；**54 条**：dashboard/detail/list 模板结构、pm 组件、data-cyan 主色、manifest 3 页、PNG 宽高与主色像素采样、切线框、0 console·pageerror·请求失败·外部请求）；`e2e:p9`/`p7-4b`/`p3` 的 PNG 导出断言改为整包导出（PNG 重写 + 状态文案），断言数不变 |

验证（实跑）：

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **133 / 133**（未改后端业务代码） |
| `npm test --prefix frontend` | **141 / 141**（原 131 + dashboard/detail 10） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过（2818 modules；`dist/design-preview.html` 与 assets 产出） |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run e2e:p10 --prefix backend` | **54 条断言**；端口 3447 已关闭；overview.png **2880×1996**、data-cyan 主色像素 > 0；截图目录 `%TEMP%/workbench-p10-shots` |
| `npm run e2e:p9 --prefix backend` | **67 条断言**（脚本当前实际 67；本单只改 1.4/6.3 文案与等待，未增删数量；STATUS/README 旧记 57 已按实际更新） |
| `npm run e2e:p7-4b --prefix backend` | **48 条断言**（PNG 导出改为整包重写断言） |
| `npm run e2e:p3 --prefix backend` | **126 条断言**（无 recipe → 仍线框 PNG） |
| `npm run e2e:preview / p7-3b --prefix backend` | **83 / 38 条断言** |
| `npm run e2e:p2 / p4 --prefix backend` | **116 / 128 条断言** |
| `npm run build:report --prefix backend` | 通过：HTML **721.5 KB**（738,852B）、PDF **1,117.6 KB**（1,144,446B，约 15 页）、flow PNG 567,720B；离线/0 console error/三档无横向溢出；截图/流程图沿用 P7-A 未重截 |

偏差/说明：

1. **PNG 语义已变**：`prototypes/*.png` 现在是模板风格截图；main-sub/wizard 与旧无契约设计仍是线框（页面级混合允许，manifest 不区分渲染器）。
2. 模板截图在 iframe 内完成；html2canvas 1.4.1 不支持 `color(srgb …)`（模板 `color-mix` 计算值），已在截图克隆节点时替换为等价可解析颜色（只影响截图，不改预览）。截图依赖字体/图表就绪等待 + 300ms；失败回退线框，不伪造成功。
3. `DesignPrototypePanel` 的 PNG 按钮不再直接下载当前页，而是整包导出到 `docs/design/<MOD>/prototypes/`（与自动导出一致）；`e2e:p9`/`p7-4b`/`p3` 已按新行为改断言。
4. 硬边界遵守：未改后端 `src/**`、DB/表、`templates/**`、需求模板中心、模板中心/`preview.html` 业务、P9 的 list/tree/form 行为；未新增依赖、未 npm install、未做 git、未启停真实 3300/4771、未读写真实 `data/`/`projects/`/`.env`、未调真实模型。
5. **未能按 §2.3 更新开发 prompt/应用 AGENTS/skill 的“PNG 线框草图”文案**：这些字符串在 `backend/src/chat/service.ts`、`backend/src/apps/scaffold.ts`、`templates/agent/**` 内，属于本单硬边界（不改后端 src/templates）；只更新了 `AGENTS.md`/`README`/`docs` 的语义。后续需要单独放行才能改这些生成源。
6. `e2e:p9` 仓库脚本当前实际 67 条断言（旧记录 57 与实际脚本不符）；本单未增删断言，只在 PNG 导出按钮相关 2 条上调整等待/文案。

未验证：真实 AFCenter 宿主/EOS 运行态的 pm-*；真实 3300 上的人工视觉验收（前端静态托管即时生效，但本会话未打开真实实例）；PNG 像素级模板比对（只做宽高 + 主色采样）；长表/超大页面模板截图的稳定性（>5MB 自动降 scale，未做长表专项）；main-sub/wizard 模板化。

## P10b 实施（2026-11-20）：所有显式契约页面模板风格兜底 + PNG 文案同步

> 用户要求：**不支持配方也要尽量跟模板风格一致**，不要默认灰阶线框；PNG 文案一致。
> 结论：**任何有显式契约（`recipe` / `catalogRef` / `blueprint`）的页面都走模板风格渲染与模板截图**；`main-sub`/`wizard` 有了模板结构，未知/无映射配方按 `page.type` 映射到通用模板页；**只有无任何显式契约的旧设计才用线框兜底**（P11 起自动显示「结构草图（无契约）」，UI 不再提供手动切换）；无契约/截图失败才用线框兜底。

| 项 | 位置 / 说明 |
| --- | --- |
| 支持判定 | `design-preview/contract-preview.js`：`TEMPLATE_RENDER_RECIPES` 增加 `main-sub`/`wizard`；`hasExplicitContract` = `recipe || catalogRef || blueprint`；`supportsTemplateRender` = 有显式契约即可；`resolveContractRecipe` 对未知/不受支持配方按 `page.type` 映射（form→page-form、list/tree-list→list、dashboard→dashboard、其余→detail），保证返回值总在支持集合内 |
| main-sub 渲染 | `ContractPage.vue`：`page-heading` + `panel.form-panel`（`ContractFormFields` 分组）+ 子表 `panel`（`pm-table`；多子表用 `contract-subtabs` 页签，testid `contract-main-sub-subtables`/`-tab-N`/`-table-N`）；无实体/无子表给空态 |
| wizard 渲染 | `ContractPage.vue`：`page-heading` + `pm-steps`（`contract-wizard-steps`，选项来自 `form.groups`）+ 当前分组 `panel.form-panel`（`ContractFormFields` 新增 `onlyGroup`）+ 底部上一步/下一步/提交（`contract-wizard-footer`，本地 notify） |
| 通用兜底 | `ContractPage.vue` 的 `v-else` 改为模板 detail 通用页（`page-heading` + `panel` + `info-grid`/空态）；不再出现 `wf-*`，也不再出现“该配方暂未支持模板风格渲染” |
| 面板/导出 | `DesignPrototypePanel` 提示改为“无显式契约默认线框；模板风格需要 recipe/catalogRef/blueprint”，导出提示改为“模板风格截图；无显式契约的旧设计为线框”；`template-capture.ts#shouldTemplateCapture` 跟随新判定，main-sub/wizard/未知契约页都走模板截图 |
| 文案同步 | `backend/src/apps/scaffold.ts`（应用 AGENTS 3 处）、`backend/src/chat/service.ts`（开发 prompt 3 处）、`backend/src/dev/service.ts`、`backend/src/dev/ui-check.ts`、`backend/src/templates/distribution.ts`、`templates/agent/skills/adw-frontend-implementation/SKILL.md`（3 处）+ `scripts/lib/fidelity-core.cjs` + `scripts/check-fidelity.mjs`、`templates/agent/commands/check-design-fidelity.md`、`templates/agent/skills/adw-design-artifacts/SKILL.md`、`templates/afc-remote/README.md`：PNG 由“线框草图”改为“模板风格截图（无显式契约的旧设计为线框）”，优先级/断言口径不削弱 |
| e2e | `backend/scripts/template-png-e2e.ts` + `e2e:p10`：fixture 增 main-sub（2 分组/2 子表）、wizard（3 分组）、未知类型 `kanban` + 仅 blueprint 三页；断言 main-sub 分组/子表页签/切页签、wizard `pm-steps`/步骤标题/当前分组/下一步切换/上一步/提交、通用兜底 `contract-page-detail` + `page-heading` + `panel` + **无 `wf-page`**、manifest 6 页、main-sub PNG 宽高与 data-cyan 主色像素；`e2e:p9` 无契约提示断言按新文案更新（断言数不变） |

验证（实跑）：

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | **142 / 142**（原 141 + 未知配方映射/blueprint 契约 1 组） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过（2818 modules；`dist/design-preview.html` 与 assets 产出） |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **133 / 133**（只改文案字符串） |
| `node node_modules/typescript/bin/tsc -p backend/tsconfig.json --noEmit` | 通过 |
| `npm run e2e:p10 --prefix backend` | **78 条断言**；端口 3447 已关闭；overview **2880×1996**、main-sub **2880×2002**，data-cyan 主色像素 > 0 |
| `npm run e2e:p9 --prefix backend` | **67 条断言**（无契约提示断言按新文案） |
| `npm run e2e:p7-4b --prefix backend` | **48 条断言** |
| `npm run e2e:p3 --prefix backend` | **126 条断言**（旧设计无契约 → 仍线框） |
| `npm run e2e:p2 / p4 --prefix backend` | **116 / 128 条断言** |
| `npm run e2e:preview / p7-3b --prefix backend` | **83 / 38 条断言** |
| `npm run smoke:workspace / smoke:assets --prefix backend` | 均通过（临时目录 + 3416/3419；opencode 2.2.5、不调模型） |
| `npm run build:report --prefix backend` | 通过：HTML **722.1 KB**（739,418B，离线/0 console error/三档无横向溢出）、PDF **1,123.6 KB**（1,150,579B，约 15 页）、flow PNG 567,720B；截图/流程图沿用旧版未重截 |

偏差/说明：

1. **未知显式配方的真实路径是 `blueprint` + `page.type`**：`design-adapter.js` 会把不在 `PAGE_RECIPES` 的 `recipe` 丢弃（soft warning）并保留 `blueprint`，因此设计预览侧看到的是“仅蓝图页”，`resolveContractRecipe` 按 type 映射；未知 recipe 的映射本身由单测覆盖。
2. `ContractPage` 的 `v-else` 已改为模板 detail 通用页；`resolveContractRecipe` 保证不会落到“未支持”，该分支仅作防御。
3. 全部显式契约页默认模板风格 + 模板截图；PNG/manifest 仍不记录渲染器（页面级混合只发生在无契约旧设计或截图失败时）。
4. 硬边界遵守：未改 DB/表、PNG 写入 API、`templates/design-system/**`、需求模板中心、模板中心/`preview.html` 业务、P9/P10 已通过的 list/tree/form/detail/dashboard 行为（除支持判定扩展）；未新增依赖、未 npm install、未做 git、未启停真实 3300/4771、未读写真实 `data/`/`projects/`/`.env`、未调真实模型；e2e 临时目录/端口均清理。
5. 真实 3300 的后端文案需用户自行 `npm run build --prefix backend` + 重启后生效；前端 `dist` 已重建，静态托管刷新即可。

未验证：真实 AFCenter 宿主/EOS 运行态的 `pm-steps`/`pm-table`；真实 3300 上 main-sub/wizard 的人工视觉验收；`pm-steps` 点击步骤本身不发 `update:modelValue`（当前用底部按钮切换，模板一致但点击步条不作为验收项）；真实模型按 main-sub/wizard 写页面后的渲染效果；长表/超大页面截图的稳定性。

## P11 实施（2026-11-20）：设计视图移除「线框」切换，只保留设计产物

> 用户决策（方案 A）：设计视图里不再让用户在线框/模板之间选，**只有「设计产物」**。旧灰阶线框只作为无显式契约的自动兜底与内部调试（`?prototype=wireframe`），不在 UI 暴露。

| 项 | 位置 / 说明 |
| --- | --- |
| 面板 | `DesignPrototypePanel.vue`：删除 `prototype-mode-preview`/`prototype-mode-wireframe` 按钮与 `setMode`；`mode` 改为 computed（`debugWireframe` → wireframe，否则 `previewable ? template : wireframe`）；头部只读状态 `data-testid="prototype-render-mode"`（`设计产物 · 模板风格` / `结构草图（无契约）` / `调试 · 结构草图`；缺应用设计模板时为 `结构草图（缺设计模板）`） |
| 调试入口 | 仅 URL query `?prototype=wireframe`（hash 前）强制结构草图并显示「调试 · 结构草图」；`e2e:p7-4b` 用该入口，正常 UI 不出现任何模式按钮 |
| 文案 | 模板：`当前为设计产物（按所选模板渲染，<类型 · 风格>）；导出 PNG 使用模板风格截图。`；无契约：`该页面没有显式设计契约（recipe/catalogRef/blueprint），显示结构草图；补齐契约后自动套模板。`；导出按钮 title `导出 PNG（模板风格；无契约/失败为线框）` |
| 缩放 | 缩放组只在结构草图（无契约/调试）显示；设计产物不显示（与 P10 一致） |
| 不变 | `supportsTemplateRender`（有显式契约）判定、`design-preview` 渲染、PNG 导出服务与整包模板截图（无契约/失败线框）、`DesignView` 自动/手动导出均未改；`DesignView` 传参完整 |
| e2e | `e2e:p7-4b` 改为 `?prototype=wireframe` 进入（48，合并“无模式按钮/调试标识”断言）；`e2e:p9` 删除切线框段、改为断言只读状态/iframe/无 `wf-page`/无按钮/无契约自动结构草图（**70**）；`e2e:p10` 删除切线框段、同一类断言（**79**）；`e2e:p3` 无契约仍 `prototype-paper`（126 不变） |

验证（实跑）：

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm test --prefix frontend` | **142 / 142**（未改纯函数/单测） |
| `npm run build --prefix frontend` | 通过（2818 modules；`dist/design-preview.html` 正常） |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **133 / 133**（未改后端） |
| `npm run e2e:p7-4b --prefix backend` | **48 条断言**（端口 3444 已关闭） |
| `npm run e2e:p9 --prefix backend` | **70 条断言**（端口 3446 已关闭） |
| `npm run e2e:p10 --prefix backend` | **79 条断言**（端口 3447 已关闭；overview 2880×1996、main-sub 2880×2002，data-cyan 主色像素 > 0） |
| `npm run e2e:p3 --prefix backend` | **126 条断言**（无契约自动结构草图，仍 `prototype-paper`） |
| `npm run e2e:preview / p7-3b --prefix backend` | **83 / 38 条断言** |
| `npm run e2e:p2 / p4 --prefix backend` | **116 / 128 条断言** |
| `npm run build:report --prefix backend` | 通过：HTML **722.5 KB**（739,859B，离线/0 console error/三档无横向溢出）、PDF **1,127.2 KB**（1,154,252B，约 15 页）、flow PNG 567,720B；截图/流程图沿用旧版未重截 |

偏差/说明：

1. **设计视图不再有可点「线框」**：契约页只显示 `design-preview` iframe；无契约页自动结构草图 + 文案；调试参数仅内部/测试。
2. `p9` 从 67 → 70、`p10` 从 78 → 79（删除切换段、增加只读状态/无按钮/无 `wf-page`/无契约标识断言；以实际脚本为准）。
3. `e2e:p7-4b` 保持 48：把“无模式按钮/调试标识”并入原有 1.1/1.2 断言，不新增计数。
4. 硬边界遵守：未改模板/线框渲染器行为、PNG 导出服务、后端 `src/**`/DB/API、`templates/**`、需求模板中心、模板中心/`preview.html`；未新增依赖、未 npm install、未做 git、未启停真实 3300/4771、未读写真实 `data/`/`projects/`/`.env`、未调真实模型；e2e 临时目录/端口均清理。
5. 前端静态托管刷新即生效；`backend/dist` 未重建（本期无后端改动）。

未验证：真实 3300 上人工打开设计视图确认“无线框按钮”（前端已重建、静态托管即时生效，本会话未打开真实实例）；真实无契约旧应用的结构草图视觉（e2e fixture 覆盖）；`?prototype=wireframe` 之外的其他调试参数未设计。

## P12 实施（2026-11-20）：启动脚本构建可见化 + 一键 restart

> 用户反馈：希望启动脚本自动编译前后端，不用每次手动敲多条命令。
> 核对结论：`start.cmd` / `start.sh` **本来就每次启动都构建**（`npm run build` = backend tsc + frontend vite），缺的是：构建只有一行日志且失败不区分前后端、已在运行时 start 直接退出、没有「停止 + 重建 + 启动」。

| 项 | 位置 / 说明 |
| --- | --- |
| start.cmd | 构建拆两步：`构建 backend (tsc)` → `npm run build --prefix backend`，失败打印 `backend build failed` 后中止；再 `构建 frontend (vite)` → `--prefix frontend`，失败打印 `frontend build failed`。依赖安装/PORT 解析/端口占用/PID/健康检查/失败清理均未改 |
| start.sh | 同样拆两步（`npm run build --prefix backend \|\| fail "后端构建失败（tsc），已中止"`、`--prefix frontend`）；`set -e` 下任一步失败即退出 |
| restart.cmd（新增） | `stop.cmd` → 失败则 `abort restart` 并返回 1；成功则 `call start.cmd`（含两步构建 + 健康检查），透传其退出码；不额外杀进程、不改 PID 逻辑 |
| restart.sh（新增） | `stop.sh` → `exec start.sh`；`set -euo pipefail` 下 stop 失败即中止 |
| 已在运行提示 | `start.cmd`：`already running (PID x). Run restart.cmd to rebuild and restart (or stop.cmd then start.cmd).`；`start.sh`：`工作台已在运行（PID x），如需重建并重启请执行 ./restart.sh（或先 ./stop.sh 再 ./start.sh）` |
| README | 「一键启动 / 停止」补 `restart`、start 每次构建后端+前端（失败指明哪端）、更新代码用 restart、`frontend/dist` 静态托管刷新即生效但源码改动仍需 restart、后端改动必须 restart；Linux `chmod +x start.sh stop.sh restart.sh` |

验证（实跑）：

| 命令 | 结果 |
| --- | --- |
| `npm run build`（根） | 通过（后端 tsc + 前端 vite 均成功；会更新 `backend/dist`、`frontend/dist`，不重启 3300） |
| `bash -n start.sh` | 通过（语法） |
| `bash -n restart.sh` | 通过（语法） |
| `bash -n stop.sh` | 通过（未改动，回归） |
| 静态审查 `start.cmd` / `restart.cmd` | 含两步构建、各自失败分支、restart 建议提示；restart 先 stop 且 stop 失败中止 |

偏差/说明：

1. 未改变端口/PID/健康检查/依赖安装/防重复启动逻辑；未改 `package.json` build 脚本、`backend/src/**`、`frontend/src/**`、DB、templates。
2. `restart.cmd`/`restart.sh` 只串联现有 stop/start，不自行 kill 进程、不写 PID 文件。
3. 构建失败时仍走原 `:fail` / `fail` 收尾（`start.cmd` 会额外追加通用 “dependency install or build failed” 一行），但前后端各自有明确错误行。
4. Windows 下未给 `restart.sh` 设置 git 可执行位（不做 git 操作）；README 已写 `chmod +x`。

未验证：**未真实执行 `start.cmd` / `restart.cmd` / `start.sh` / `restart.sh` 的完整流程**（会停/起真实 3300 并覆盖真实 `data/workbench.pid`）；未在真实 3300 上验证 restart 的端到端耗时与日志；未启停真实 3300/4771，未读写真实 `data/`/`projects/`/`.env`，未调模型，未做 git。

## P7-7a 实施（2026-11-21）：模板工作室底座（pack 模型 / 生成核心 / catalog / 发布 API）

> 结论：按 `docs/plans/2026-11-21-p7-7-custom-design-template-agent-design.md` §15.1 完成 **P7-7a**：pack 三种 page kind、共享控件映射、spec→pack 生成核心 + 薄 CLI、catalog、草稿/生成/发布/删除 API、`buildTreeRows` 修复。**本记录为 P7-7a 当时结论；后续 7b-1/2a/2b 已完成（工作室会话/UI/template-preview/模板中心自定义入口），7c（应用闭环/真实模型）当时未做（P7-7c-1/c-2 已于 2026-11-21 完成）**；picker/scaffold 当时未开放自定义模板；不改 DB 表。

| 项 | 位置 / 说明 |
| --- | --- |
| pack 模型 | `backend/src/design/pack.ts`：`DesignPageMeta` 增加 `kind/source/contract/sampleEntity/sampleSubEntities`，`blueprint` 可选；内置/非自定义页缺省 kind=blueprint（无 source）；自定义 pack（`origin.kind=custom`）必须显式 reference/contract，contract 无蓝图、必须 contract+sampleEntity；`origin` 可选并校验 kind/draftId/builtFrom/baseApplicationType/style/revision/specHash/publishedAt；自定义 pack 单 applicationType（id=pack id）单风格；新增 `validatePackDir(dir, expectedId?)`（**权威**，不走 mtime 缓存，暂存目录 `pack` 可传 expectedId）+ `getBuiltinPack`/`pageKindOf`；`summarizePack`/`listPacks` 增加 `origin`/`templateKind`；contract 软校验复用 `workspace/design-contract.ts`（未知列/字段/子表/树只 warning，另给 `page-field-unknown`/`sample-sub-entity-missing`/`tree-parent-missing`） |
| 共享映射 | `templates/design-system/component-controls.json`（**20 键** `pm-*`→控件，键/值沿用旧 `contract-view.js#COMPONENT_CONTROLS`）；前端 `frontend/src/design/prototype/contract-view.js` 改为 `import ... with { type: 'json' }` 并额外导出 `COMPONENT_CONTROLS`；后端 `design-template/spec.ts#readComponentControls` 读同一文件（不解析前端 JS） |
| 生成核心 | `templates/workshop/skills/adw-design-template-authoring/scripts/lib/{spec,css,generator}.cjs`（CommonJS，无外部依赖）：spec 规范化/校验（§8.2 错误码 + warning）、structure.css 合并（`@media+选择器+规则体` 三元组去重、保留首次原文、冲突记录）、spec→pack 暂存目录（复制 reference 蓝图字节+sha256、assets 并集/冲突、shared+style、合并 structure、确定性 pack.json、失败清理）；薄 CLI `scripts/generate.cjs`（核心生成+原子替换 draft pack+写 generation.json，再调后端 validate 预检）与 `scripts/validate.cjs`（仅调后端 validate，不可达退出 2）；`references/spec.schema.json` |
| 后端模块 | 新增 `backend/src/design-template/{paths,core,spec,draft,generator,catalog,publish,routes}.ts`：目录/资产路径安全（`.css/.svg/.png/.jpg/.jpeg`、拒绝 `..`/绝对/保留 id）、仓库路径 require 共享核心（同 `fidelity-core.cjs` 模式）、草稿 CRUD（starter spec/反写已发布 pack）、生成（单飞锁 409、权威校验、原子替换、generation.json）、catalog（25 页/39 组件/4 风格/8 配方 + examples，`readPath`/`structureReadPath` 指向 `catalog/builtin/<packId>/...`，确定性排序+原子写+sourceHash 刷新）、发布（specHash 比对 409 `spec-changed`、revision+1/version `1.0.<rev-1>`、publishedAt、暂存+原子替换、clearDesignPackCache）、删除（内置 403、被 `app_settings` 引用 409 `pack-referenced` + 应用列表、删草稿/归档 `__template__:` 会话） |
| API | `GET /api/design-templates/catalog`、`GET/POST /api/design-templates/drafts`、`GET/DELETE /drafts/:id`、`GET /drafts/:id/asset`、`POST /drafts/:id/generate|validate|publish`、`POST /packs/:packId/draft`；`GET /api/design-system/:packId/asset?path=`（内置 403）、`DELETE /api/design-system/:packId`；错误统一 `{error, code?, details?}`；`backend/src/index.ts` 挂载 `/api/design-templates` |
| 前端修复 | `frontend/src/design-preview/contract-preview.js#buildTreeRows`：重复子节点标签不再重复 push roots（有父节点时始终 `continue`，已挂载子节点从 roots 移除；正常嵌套/扁平回退不变） |
| 测试 | 后端 **191/191**（原 133 + 新增 58：pack +10、spec 16、css 5、generator 7、catalog 6、publish 7、routes 7）；前端 **146/146**（原 142 + buildTreeRows 回归 3 + component-controls 一致性 1） |

验证（实跑）：

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `node backend/node_modules/typescript/bin/tsc -p backend/tsconfig.json --noEmit` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **191 / 191** |
| `npm run build --prefix frontend` | 通过（多入口产物正常；`contract-view.js` import JSON 通过 Vite） |
| `npm test --prefix frontend` | **146 / 146** |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run e2e:p9 / p10 / p7-4b / p3 / preview / p7-3b / p7-6a / p2 / p4 --prefix backend` | **70 / 79 / 48 / 126 / 83 / 38 / 15 / 116 / 128**（临时端口 3446/3447/3444/3423/…/3427/3422/3425，均用完关闭） |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型；2 方法 + 开发 + 2 团队 + 设计模板 + 需求模板 skill + 5 command） |
| CLI 手测（临时工作室，无后端） | `generate.cjs` 生成 pack 成功、重跑字节一致；`validate.cjs` 后端不可达退出 2（`generate.cjs` 退出 0 + warning） |

偏差/说明（详见设计稿「P7-7a 实施记录」）：

1. `@keyframes`（2 条）原样保留输出但**不计入** 793/514 基线（spike D 口径只统计普通规则 + @media 内规则），单独记 `atRules=2`；793→514、去重 279、3 条真冲突可复现。
2. 自定义 pack 的严格页面规则以 `origin.kind=custom` 为判据：无 `origin` 的旧自定义目录（P7-1 测试/手工目录）仍按 `blueprint` 兼容，不破坏既有读取。
3. contract 页的应用工作区复制（`design/system-file.ts`）在 P7-7a 明确抛 400（P7-7c 做 `contracts/<page>.json` + 合并 structure）；当前新建应用 picker 未开放自定义模板，现有应用行为不变。
4. 生成阶段 `pack.json` 不含时间戳；`version` 由已发布 revision 决定（未发布 `1.0.0`，已发布 rev=1 时生成 `1.0.1`），发布再 +1 并写 `publishedAt/revision/version/specHash`；同 spec 重跑 pack 字节一致（仅 `generation.json.generatedAt` 变化）。
5. `catalog/builtin/` 只读镜像本身留给 P7-7b `ensureStudioAssets`；P7-7a 只固定 `readPath`/`structureReadPath` 口径并生成 catalog/examples。
6. CLI 只作 agent 快速反馈：`generate.cjs` 后端不可达时给 `backend-validate-unavailable` warning（本地生成成功仍退出 0），`validate.cjs` 不可达退出 2；**发布权威仍是 `publishDraft` → `validatePackDir`**。
7. 硬边界遵守：未改 DB 表/列、需求模板中心、`templates/design-system/**` 内置内容、scaffold/应用创建、真实 3300/4771；未新增依赖、未做 git、未读写真实 `data/`/`projects/`/`.env`、未调模型（e2e/smoke 均临时目录与独立端口）。
8. **评审收口（2026-11-21）**：保留 id 加固（`spec.cjs` 不再放行 `packId === draftId` 的内置/保留 id；`pack.ts` 新增 `isBuiltinPackId`/`listBuiltinPackIds`，新建草稿/发布/删除统一按所有内置 pack id 拒绝；`normalizeDraftSpec` 默认把内置 pack id 并入保留列表）+ 文档运行态校正（STATUS/AGENTS/README 统一“2026-11-20 曾监听 / 2026-11-21 只读核对无 LISTEN、`/api/health` 失败、PID 不存在，实施不启停、以实际为准”；README 顶部改 P7-7a；交接单文首加后继说明）。验证：后端 build/tsc 通过、`npm test --prefix backend` **191/191**（+1 保留 id 用例）、前端 **146/146**。

未验证（P7-7a 当时口径；后续 7b-1/2a/2b 已完成部分见对应记录，7c 当时未做（P7-7c-1/c-2 已于 2026-11-21 完成））：工作室会话/权限/会话资产（P7-7b）；模板中心自定义列表/新建/工作室入口/picker 与 `template-preview.html`（P7-7c）；scaffold 对 reference/contract 页、`design-system.json`、skill、digest/ui-check/fidelity 13 项的应用闭环（P7-7c）；真实模型按 catalog/spec 产出模板；真实 3300/4771 上的人工验收与重启；`buildTreeRows` 修复仅在单测与 p9/p10 树/列表渲染回归，无新增树页专项 e2e 断言。

## P7-7b-1 实施（2026-11-21）：后端模板工作室（会话/资产/studio API/SKILL）

> 结论：按 `docs/plans/2026-11-21-p7-7-custom-design-template-agent-design.md` §9/§13.3/§15.2 完成 **P7-7b-1 后端部分**：会话视图 `template`、`ChatTarget` 抽象、工作室资产/镜像、studio 会话与 API、authoring SKILL/command。**未做** Studio UI/template-preview/模板中心自定义入口/新建应用 picker（P7-7b-2），真实工具权限/真实模型（P7-7c），真实 3300/4771 启停；不改 DB 表。**本记录为 7b-1 当时结论；后续 7b-2a/2b 已完成 Studio UI/template-preview/模板中心自定义入口，7c 当时未做（后续 P7-7c-1/c-2 已完成）**。

| 项 | 位置 / 说明 |
| --- | --- |
| 会话视图 | `backend/src/sessions/store.ts`：`SessionView = AppView \| 'template'`、`SESSION_VIEWS`、`isSessionView`；`viewOf` 对 template 返回自身；`activeSessionRow/listSessionRows/createSessionRow/archiveActiveSessions` 接受 SessionView；应用 chat/model 路由仍 `isAppView`（拒绝 template） |
| ChatTarget | `backend/src/chat/service.ts`：`ChatTarget` + `handleChat`；`handleAppChat`/`appChatTarget` 等价包装；`ensureTargetSession`/`ensureViewSession`/`verifyTargetAssets`；`ModelStage = SessionView`，template 不继承应用模型；应用 command 期望补 `check-design-fidelity`（5 个） |
| 共享底层 | 新增 `backend/src/dev/session-support.ts`（会话类型/时间线/上下文/pending 共用）；`backend/src/dev/service.ts` 改为复用，导出签名/响应/错误语义不变 |
| 工作室资产 | 新增 `backend/src/design-template/workshop.ts`：`ensureStudioAssets` 写 AGENTS.md/opencode.json/workshop.json（差异才写）、复制 skill/command/scripts、刷新 `catalog/builtin/<packId>`（36 文件/594,145B）只读镜像（版本/mtime/内容 hash + 原子替换）、`catalog/component-controls.json`、ensureCatalog、reloadLocations best-effort；workshop.json 仅 `{builtinRoot,customRoot,draftRoot,workbenchPort}` 绝对路径 |
| 工作室 API | 新增 `backend/src/design-template/studio.ts` + `studio-routes.ts`：`GET /studio`、sessions（list/new/activate/PATCH/archive）、prompt/interrupt/compact、events（SSE hello/事件/心跳）、permission/form reply、GET/PUT model（stage=template）；`routes.ts` 挂载 `/drafts/:id/studio/*`；404/409/400/502 语义按设计 |
| Skill/command | `templates/workshop/skills/adw-design-template-authoring/SKILL.md`、`references/contract-recipes.md`（8 配方/字段/sampleEntity/组件边界）；`templates/workshop/commands/generate-design-template.md`；不放入 `templates/agent`（不随应用分发） |
| 测试 | 新增 `sessions/store.test.ts`、`chat/target.test.ts`、`design-template/{workshop,studio,studio-routes}.test.ts`；`backend/package.json` test 列表 |

验证（实跑）：

| 命令 | 结果 |
| --- | --- |
| `npx tsc -p backend/tsconfig.json --noEmit` | 通过 |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **217 / 217**（原 191 + 26） |
| `npm test --prefix frontend` | **146 / 146**（未改前端） |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型；应用 command 仍 5） |
| `npm run e2e:p2 / p3 / p4 --prefix backend` | **116 / 126 / 128** 条断言 |

偏差/说明（详见设计稿「P7-7b-1 实施记录」）：

1. `dev/service.ts` 采用“抽出共享底层 `dev/session-support.ts`”而非整体 target 化重写；对外行为不变（217 + e2e p2/p3/p4 验证）。
2. `ensureStudioAssets` 为 async（reloadLocations 失败可返回 warning）；`ChatTarget.beforeSession` 允许 Promise（应用仍同步）。
3. 工作室 command/skill 不随应用分发；`smoke:assets` 应用 command 期望仍 5。
4. 未验证（7b-1 当时口径；后续 7b-2a/2b 已完成 Studio UI/`template-preview.html`/模板中心自定义入口，7c 当时未做（P7-7c-1/c-2 已于 2026-11-21 完成））：Studio UI/`template-preview.html`/模板中心/新建应用 picker（7b-2）；真实工具调用下 edit/shell 权限路径与真实模型按 catalog 写 spec（7c）；真实 3300/4771 人工验收。

## P7-7c-1 实施（2026-11-21）：自定义模板应用闭环 + e2e（不调模型）

> 范围：设计稿 §15.3（`design/system-file.ts`、scaffold/AGENTS、设计模板 skill/manifest、digest/ui-check/fidelity 13 项、前端 design-preview/picker/徽标、应用内资产接口、`e2e:p7-7c`）。
> **不做**：真实模型（7c-2）、真实 3300/4771 启停、真实 `data/`/`projects/`/`.env`、DB 表变更、需求模板中心、git。

| 项 | 位置 / 说明 |
| --- | --- |
| system-file | `backend/src/design/system-file.ts`：`DesignSystemSummary` 增 `origin`/`preview`/`pages[].kind/source/contractFile`（`schemaVersion` 仍 1，内置页 `kind=blueprint`）；contract 页写 `contracts/<pageId>.json`（`{schemaVersion,pageId,name,recipe,contract,sampleEntity?,sampleSubEntities?}`），不写 `.vue`；reference 复制 pack 蓝图；合并 `structure.css` 原样复制；`buildDesignSystemSummary(selection,{appId?})` / `writeDesignSystemWorkspace(appDir,selection,{appId?})`；幂等（`writeFileIfChanged`） |
| 应用解析/API | `apps/design-system.ts`：`origin`/`preview`（baseApplicationType/structure/structureUrl/styleClassName/packVersion/kind）/`pages[].contractFile`；`apps/routes.ts`：`GET /api/apps/:id/design-system/asset?path=`（相对 `docs/design/template`，`resolveAssetFile` 只允许 css/svg/png/jpg/jpeg、禁 `..`/绝对路径） |
| scaffold/distribution | `apps/scaffold.ts`：AGENTS/README 识别契约页（无蓝图、读 contracts + PageTemplates，base 根类）；`syncTemplatesInto({appId})`；`templates/distribution.ts`：skill 页面表增 `kind` 列、reference 显示 `source=pack/type/page`、contract “契约（无蓝图）”、新增“契约页实现（无蓝图）”段；manifest 增 `templateKind`/`packVersion`（旧 manifest 缺省兼容）；`ensureWorkspaceAssets` 覆盖受管副本（contract/structure/styles/skill），不碰 `frontend/`/`docs` 正文 |
| digest/ui-check | `dev/digest.ts`：页面摘要 `kind/source/contractFile`；契约页“无蓝图，按契约实现”+ 契约摘要（列/筛选/行/工具栏/表单/树/分页/样例实体）；自定义模板标 `base=`；6KB 截断不变。`dev/ui-check.ts`：页面表 `设计页/类型·来源/蓝图/契约/字段·列/操作/布局/差异`；contract 页蓝图 `无（契约页）` + 契约文件；缺失生成/不覆盖/只读不变 |
| fidelity 13 项 | `templates/agent/skills/adw-frontend-implementation/scripts/lib/fidelity-core.cjs`：`normalizeDesignSystem` 读 kind/contractFile/source/origin；`blueprint-files` 跳过 contract、校验契约文件（缺失 **warn** 不 fail）；`page-contract` 接受契约文件；新增第 **13** 项 `template-contract`（文件存在/recipe 一致，只报告；无契约页引用时 pass）；`check-fidelity.mjs` 用法、`templates/agent/commands/check-design-fidelity.md`、`fidelity.test.ts`、`workspace-smoke.ts`、`e2e:p7-6a` 同步（15→18） |
| 前端 | `DesignPreviewApp.vue`：读 `design-system.preview`，自定义用 base 短类 + `preview.structureUrl` 注入合并 CSS（失败回退 registry + `console.warn` + `data-structure-fallback=1`），风格类优先 `preview.styleClassName`；类型名优先 API；`design-preview/custom-preview.js` 纯函数。`DesignView.vue` 徽标自定义带版本；`DesignTemplateCenter.vue` picker 增加「自定义模板（已发布）」分组（`design-template-custom-pick-<id>`，草稿不列）、页面库显示 kind/来源、自定义详情预览走 `template-preview.html?pack=`、返回恢复内置 pack；`NewAppDialog.vue` 选择自定义后载入详情并标注“自定义模板”；`HomeShell`/`AppShell` 摘要带版本/（自定义）；`shared/design-system-api.ts` 类型 |
| e2e | 新增 `backend/scripts/custom-template-app-e2e.ts` + `e2e:p7-7c`（stub opencode；端口 3430/4430 起；临时根）：API 创建草稿→fixture spec（reference `operations-management/list` + contract `dialog-form`）→生成→发布 1.0.0；picker 已发布可见/未发布草稿不列；API 新建应用；工作区 design-system.json/reference 蓝图/contract JSON/合并 structure/styles/skill/受管副本对齐；资产接口 200/400/404；设计视图自定义 structure + base 短类 + data-cyan + contract dialog；PNG 宽高+主色；开发 digest/ui-check/fidelity 13 项；**108 条断言**、0 非预期 console error/pageerror/请求失败/外部请求 |
| 回归 e2e | `p7-7b` **51**（原 50；picker 改列已发布自定义、草稿不列）、`p7-3b` **39**、`p7-6a` **18**（原 15）、`p2/p3/p4` **116/126/128**、`preview/p7-4b/p9/p10` **83/48/70/79** |

验证（实跑）：

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` / `npx tsc -p backend/tsconfig.json --noEmit` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **230 / 230**（原 219；+system-file 4、digest/ui-check 4、fidelity 1、distribution 1、design-system 1） |
| `npm test --prefix frontend` | **178 / 178**（原 172；+custom-preview 4、picker/徽标 1、新建应用摘要加载态 1） |
| `npm run typecheck --prefix frontend` / `check:vue` / `build` | 通过（build exit 0） |
| `npm run e2e:p7-7c --prefix backend` | **108 条断言**；端口 3430 已关闭；临时根已清理；**连跑 3 次均通过（108/108/108）** |
| `npm run e2e:p7-6a / p7-7b / p7-3b --prefix backend` | **18 / 51 / 39 条断言** |
| `npm run e2e:p2 / p3 / p4 --prefix backend` | **116 / 126 / 128 条断言** |
| `npm run e2e:preview / p7-4b / p9 / p10 --prefix backend` | **83 / 48 / 70 / 79 条断言** |
| `npm run smoke:workspace / smoke:assets --prefix backend` | 通过（临时目录 + 3416/4719；opencode 2.2.5；不调模型） |

手工/自动截图（0 非预期 console error；目录 `%TEMP%\workbench-p77c-shots`）：

- `p7-7c-picker.png`（新建应用 picker：自定义模板已发布分组 + 4 内置类型）
- `p7-7c-design-list.png`（设计视图：自定义模板徽标 `供应商管理模板 v1.0.0 · 数据蓝青` + 列表契约）
- `p7-7c-design-form.png`（契约页 dialog-form：基本信息分组/字段/提交）
- `p7-7c-supplier-list.png`（模板风格 PNG；2880×~2000，data-cyan 主色像素 >0）
- `p7-7c-development.png`（开发视图 fidelity 13 项报告）
- `p7-7c-design-system.json` / `p7-7c-ui-check.md`（应用摘要与 ui-check 页面表留档）

偏差/说明：

1. **`preview` 只写自定义 pack**；内置 pack 不写 `preview`/`origin`，读取方继续走 `preview/registry`（旧应用字段缺失可读）。
2. **contract 页根类按设计稿用 `baseApplicationType` 短类**；合并 `structure.css` 已含 reference 来源类型规则，页面内 `application-type-<custom>` 仅作调试标记。
3. **`template-contract` 无契约页时返回 pass**（“无契约页引用”），避免给所有内置模板应用新增 warning；空设计报告仍为 2 项（不变）。
4. picker 使用新的 testid `design-template-custom-pick-<id>`（与 browse 自定义卡片 `design-template-custom-item-<id>` 区分）；`e2e:p7-7b` 的 picker 断言已改为“列已发布自定义、草稿不列”。
5. 自定义结构加载失败回退 registry 并在 `#design-preview-structure-css` 上方给出 warning 条（`embed`/`capture` 时不显示，避免进入 PNG）。
6. **picker 异步摘要加载态（评审修复，2026-11-21）**：`NewAppDialog#applyDesignSelection` 切换 pack 时先清空 `designPack` 并进入加载态（摘要“加载中…”），失败只留 `designNotice`，不再用旧内置 pack 回退；内置同一 pack 快速路径不变。`describeNewAppDesignSelection` 纯函数覆盖 ready/loading/failed/default（前端 +1 用例）。`NewAppDialog`/`DesignTemplateCenter.load`/`loadCustom` 增加请求 token，关闭/改选会丢弃迟到结果；`e2e:p7-7c` 在“使用此模板”后先 `waitForText` 摘要出现自定义模板名/标签，并补充页面库/开发首条提示等待；harness 状态文件读取增加容错（半截 JSON 返回 null 重试），消除偶发 `Unexpected end of JSON input`。**连跑 3 次均通过（108 条断言/次）**，未再复现偶发失败。
7. 未改 DB 表、`templates/design-system/**`、`templates/afc-remote/**`、需求模板中心、scaffold MF remote 骨架；未新增依赖、未 npm install、未做 git、未启停真实 3300/4771、未读写真实 `data/`/`projects/`/`.env`、未调模型。

未验证：真实 opencode 工具权限（edit/shell 拒绝路径）、真实模型 `packycode-deepseek/deepseek-flash` 按 catalog/skill 写 spec、真实 3300/4771 人工验收（P7-7c-2）；真实 AFCenter 宿主/EOS 运行态的 pm-*；<768 移动端 picker/设计视图；PNG 像素级模板比对（仍只宽高 + 主色采样）。

## P7-7c-2 实施（2026-11-21）：真实模型闭环（临时目录/端口）

> 范围：设计稿 §17。真实 opencode 2.2.5 + `packycode-deepseek/deepseek-flash`；临时根 `%TEMP%\workbench-p7-7-real-s8BRUr`、
> 后端 **3487** / opencode **4787**。**不做**：真实 3300/4771 启停/人工验收、DB 表变更、需求模板中心、git；
> 未读写真实 `data/`/`projects/`/`.env`。

| 项 | 结果 |
| --- | --- |
| 工作室真实运行 | 首条 prompt → 收尾 **64,149ms**；21 条消息 / **29 次工具**；模型自行 `generate.cjs` + `validate.cjs` |
| spec | 3 页：`supplier-list`（reference `operations-management/list`）、`supplier-form`（contract `dialog-form`）、`supplier-detail`（contract `detail`）；`data-cyan`；模型选 `baseApplicationType=operations-management` |
| 生成/发布 | **0 error / 0 warning**（212 CSS 规则、0 冲突）；发布 **1.0.0**；`GET /api/design-system` 可见 |
| 应用/预览/PNG | `p77c2-real` 工作区齐全；自定义 structure + base 短类 `application-type-operations` + data-cyan；PNG 3 页 2880×1800、主色 2011；0 console/pageerror/外部请求 |
| fidelity | **13 项 pass 5 / warn 8 / fail 0**；`template-contract` pass、`blueprint-files` pass、`prototypes` pass |
| 真实权限 | `shell Get-ChildItem ...` → `permission.rejected`（模型改用 read/glob 继续）；spec/notes `write`、generate/validate `shell` 允许 |
| 越界检查 | `catalog/**`（48）、`.opencode/**`（9）、`projects/**`、仓库源码（474）前后 hash 均无变化 |
| 真实模型修复 | 首轮 8.7s/10 read 后被误判 `succeeded`（spec 0 页）：`session-state.ts` 把 `finish=tool-calls` 当收尾、未识别数值型 `time.busy`；最小修复 + `chat/service.test.ts` 3 断言，修复后同一 prompt 正常完成 |
| 回归 | 后端 **230/230**、前端 **178/178**；`e2e:p7-7c/p7-7b/p7-6a/preview/p7-4b/p9/p10/p2/p3/p4` = **108/51/18/83/48/70/79/116/126/128**；`build`/`typecheck`/`check:vue`/`smoke:workspace`/`smoke:assets` 通过 |
| 证据 | `docs/plans/evidence/2026-11-21-p7-7-real-model/`（spec/generation/pack/design-system/contracts/design.json/fidelity/shots/hash + `pre-fix-early-stop/`） |

偏差/未验证：

1. 草稿初始 base 为 `enterprise-application-platform`；模型按技能 §7 选择 `operations-management`（reference 同源），属合理默认。
2. 驱动脚本分两段执行（证据目录复制 / Playwright 路径 / tokens 白名单为驱动侧问题，非产品失败）；续跑复用同一临时根，**未重复调用模型**。
3. 未验证：真实 3300/4771 人工验收、AFCenter 宿主/EOS 运行态、开发视图真实模型实现、<768 移动端、PNG 像素级 diff；`edit`/`write` 越界未被真实触发（只命中 `shell` 拒绝）。
4. `ui-check` 为 warn（本轮不启动开发会话）；digest/ui-check 契约页识别由 `e2e:p7-7c`（108）覆盖。
5. P7-7 全部分批（a/b-1/b-2a/b-2b/c-1/c-2）已完成首轮实施并跑通真实模型闭环；仍**待用户评审**，不代表“全部评审通过”。

## P7 实施（2026-11-19，进行中）

### P7-1 设计模板包 + 设计系统解析

| 项 | 位置 / 说明 |
| --- | --- |
| 内置 pack | `templates/design-system/afcenter-app-templates-v1/`：`pack.json` + 4 应用类型 + 4 风格 + 25 页面蓝图 + `styles/shared.css` + `ledger-workflow.svg`（35 个资产文件） |
| pack loader | `backend/src/design/pack.ts`：`listPacks/getPack/getApplicationType/getStyle/getPage`；内置根 `templates/design-system`、自定义根 `<dataDir>/design-system`；路径安全（拒绝绝对路径/盘符/`..`/越界）；blueprint/structure/css/assets 必须存在 |
| API | `GET /api/design-system`（摘要）、`GET /api/design-system/:packId`（完整 pack）、`GET /api/apps/:id/design-system`（应用解析）、`PATCH /api/apps/:id/design-system`（校验后写）；路由 `backend/src/design/system-routes.ts` + `backend/src/apps/routes.ts` |
| 应用字段 | `POST /api/apps` 支持 `designPack/designApplicationType/designStyle` 或 `designSystem`；未传用默认；payload 增加 `designSystem`（P8-1 后不再有 prototype/legacy 字段） |
| 存储 | **不改表**；`app_settings` 三键 `app.<id>.design.pack` / `.applicationType` / `.style`；内置 pack 不写数据库（P8-1 已删除 `prototype_templates` 表与 `apps.prototype_template_id` 列） |
| 前端 | `frontend/src/shared/design-system-api.ts` 类型 + 4 个请求函数；未改 NewAppDialog/DesignView/TemplateLibraryDialog |
| 测试 | 后端新增 `design/pack.test.ts`、`apps/design-system.test.ts`（共 12 条）；需求模板测试全部保留 |

验证：`build`（后端）通过；`npm test --prefix backend` **100/100**；前端 `build` 通过、`test` **59/59**、`typecheck`/`check:vue` 通过；`smoke:workspace` 通过（临时目录 + 3416）。

未验证：模板中心 UI/全量预览（P7-3）、`design-system.json`/蓝图复制/skill（P7-5）、自定义 builder（P7-7）、真实 3300 与 EOS 运行态。

### P7-3a 全量预览宿主（25 页 × 4 风格）

| 项 | 位置 / 说明 |
| --- | --- |
| 模板接入 | `frontend/scripts/generate-preview-templates.mjs` 原名复制 pack 的 4 类型 × 25 页面 + 4 `structure.css` + 4 风格 `style.css` + `shared.css` + svg 到 `frontend/src/preview/templates/afcenter-app-templates-v1/`；生成 `frontend/src/preview/registry.ts`（`type/pageId` → 动态 import、`structure.css?inline`、风格 CSS、页面/风格元数据）；`npm run gen:preview` 可重跑 |
| 预览入口 | `preview.html?type=&style=&page=`；`preview-params.js` 纯函数 + 7 例单测；缺省 `enterprise-application-platform/platform-blue/organization`；只给 type 用该类型默认风格/首页；非法值回退 + 提示条；标题/URL 同步 |
| 风格切换 | 4 套风格 CSS 静态引入，切根节点 `visual-style-*` 类；**不重建页面**（Playwright 验证输入态保留）；底部风格切换器 + 右下 mock 角标 |
| 结构样式 | 当前应用类型 `structure.css` 以 `?inline` 注入 `<style id="preview-structure-css">`，避免 4 类型互相覆盖 |
| 组件 | 补齐 27 个 pm-v3 组件 + composables/utils/common/mixins/i18n；`@/` 改相对路径；echarts/tinymce/markdown/calendar/upload/select-tree/OCR 真实接入并懒加载；**pm-sheet 占位（未接入）** |
| mock | dict/dictTypes/user/org/position/entity（含 `marketingPlan`）、generateNumber/attachments/OCR 占位；不连接平台/后端 |
| 后端托管 | `backend/src/index.ts` 增加 `GET /preview.html`；缺失时 404 + 提示（不回落 index.html）；`/assets/*` 由 static 托管；不改 API |
| pm-tree | 高亮选择器改为直接子节点，非当前节点不再被染色 |
| 验收脚本 | `backend/scripts/preview-e2e.ts`（`npm run e2e:preview --prefix backend`）：静态托管/404、4 类型代表页、4 风格切换、树高亮、非法参数、structure.css 注入，共 **77 条断言** |

### P7-3a 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix frontend` | 通过；`dist/preview.html` 存在；`dist` 合计 8.01 MB |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm test --prefix frontend` | **66 / 66**（原 59 + preview-params 7） |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **100 / 100** |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416） |
| `npm run e2e:preview --prefix backend` | 通过：**77 条断言**（临时端口 + 临时数据目录） |
| 临时全量扫描（不入库） | 25 页 × 默认风格：0 console error / 0 pageerror / 0 外部请求 |

截图：`C:\Users\icecream\AppData\Local\Temp\opencode\p7-3a-*.png`（4 类型代表页 + 4 风格 + 非法参数）。

偏差：pm-sheet 未接入（Luckysheet iframe 静态资源缺失，页面显示“预览占位（组件未接入）”）；TinyMCE 使用内联 skin（无外链）；`pm-calendar` 使用自身月历布局；Element Plus 2.14 存在非阻断 warning。

未验证：真实 AFCenter 宿主/EOS 运行态/真实 3300；design.json 契约（P7-4）。

### P7-3b 设计模板中心 UI + 新建应用/设计视图集成

| 项 | 位置 / 说明 |
| --- | --- |
| 模板中心 | 新增 `frontend/src/workbench/DesignTemplateCenter.vue`：browse/picker；分类 tabs + 搜索 + 4 应用类型卡片（页面数/组件数/CSS 缩略图）+ 自定义“即将支持”；详情左侧类型/风格、中部页面集、右侧 iframe 预览；切风格/页面重载 `/preview.html?type=&style=&page=`；预览先探测入口，失败提示 + 重试 |
| 首页 | 保留「模板库」（需求模板中心），新增「设计模板」browse 入口；应用摘要显示 `设计模板：类型 · 风格`（P8-1 起不再有旧原型模板分支） |
| 新建应用 | 「需求模板」select/说明原样；「设计原型模板」改为「设计模板」（摘要 + picker）；表单新增 `designPack/designApplicationType/designStyle` 并随 `createApp` 透传（P8-1 起「旧版兼容」入口已删除） |
| 设计视图 | `getAppDesignSystem(appId)`；徽标 `<类型> · <风格>`（点击打开模板中心并定位）；新增「模板页面库」入口（P8-1 起旧应用 legacy 徽标已删除） |
| 类型/纯函数 | `workbench/api.ts` 增加 `designSystem/legacyPrototypeTemplate` 与创建字段；`design-template-helpers.js`：默认/非法回退、展示描述、picker 结果、组件去重、分类/筛选、页面分组、预览 URL |
| 边界 | `TemplateLibraryDialog.vue`、`requirement_templates`、`adw-template-req-*`、模块 frontmatter、DB 表结构均未改；未 seed 原型模板 |

验证（实跑）：

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix frontend` | 通过 |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm test --prefix frontend` | **76 / 76**（原 66 + design-template-helpers 10） |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **100 / 100** |
| `npm run e2e:preview --prefix backend` | **77 条断言**（保持 P7-3a 基线） |
| `npm run e2e:p7-3b --prefix backend` | **45 条断言**（临时端口 + 临时数据目录，不占 3300） |

`e2e:p7-3b` 覆盖：需求模板中心仍可打开；4 应用类型卡片/分类/搜索/自定义“即将支持”；企业级 4 风格 + 页面集 + organization/audit iframe；picker 选择运营 + 经典暖色并在创建时透传；首页摘要与设计视图徽标、旧应用 legacy 徽标；0 console error / 0 pageerror / 0 外部请求。

截图：`C:\Users\icecream\AppData\Local\Temp\opencode\p7-3b-*.png`（gallery / 企业级详情 / audit / picker / 新建应用 / 首页摘要 / 设计视图 / 旧应用）。

偏差：
1. 模板中心为单组件（未拆 `DesignTemplatePicker.vue`），picker/browse 共用 UI。
2. 带选择打开时直接定位到应用类型详情；首页 browse 从列表开始。
3. 旧原型模板折叠保留，新应用默认不指定；`AppShell.vue` 顶部状态行未改（不在本轮范围）。
4. 预览 iframe 保留 P7-3a 底部风格切换器（预览工具），与中心顶部切换功能重叠。

未验证（当轮）：P7-4b 后续已实施（见 P7-4b 节）；P7-5/P7-6 开发关联与一致性验收、P7-7 自定义 builder；真实 AFCenter/EOS/3300。

### P7-4a design.json 页面契约（schema / adapter / design skill）

| 项 | 位置 / 说明 |
| --- | --- |
| Schema | `templates/agent/skills/adw-design-artifacts/references/design.schema.json`：顶层 `designSystem{pack,applicationType,style}`；页面 `recipe`（list/tree-list/dialog-form/page-form/main-sub/detail/dashboard/wizard）/`catalogRef`/`blueprint`/`filters`/`rowActions`/`toolbarActions`/`selection`/`pagination{layout,pageSize}`/`form{presentation,columns,width,fields,groups}`/`tree{titleField,parentField,actionStyle,selectionStyle}`/`subTables[{entity,title,columns,mode}]`/`components`。全部可选，`required` 未变 |
| 示例 | `design-example.json`：`designSystem` + `product-list` 契约 + `category-tree`（tree-list）+ `product-form`（dialog-form） |
| validate.mjs | 新契约字段标记 `x-adw-warning`，类型/枚举问题只进 `warnings[]` 且退出 0；旧字段仍是 `errors[]` 并退出 1；支持 `additionalProperties`（`components` 值） |
| 后端 schema | `workspace/schema.ts` 增加通用 `additionalProperties` 校验；artifacts 对新字段问题仍按现有行为列出 `errors[]`，但 HTTP 200、设计与页面照常返回（不阻断）；`designs[]` 透传可选 `designSystem`（旧设计无字段） |
| Adapter | `design-adapter.js`：保留 `designSystem`；页面顶层 `recipe/catalogRef/blueprint`；`layout.table.searchFields=filters`、`table.pageSize=pagination.pageSize`、`pagination/selection/rowActions/toolbarActions/form/tree/subTables(target=entity,mode)/components`；`spec` 增加 filters/selection/fields/components；`actions` 缺省时按 `toolbarActions+rowActions` 去重合并；非法新字段 warning 后忽略；旧页面 layout 仍只有 `table/toolbar` |
| 类型 | `design/types.ts` + `design/prototype/spec-types.ts`：契约字段与 `PageLayout/SpecPage` 可选字段；渲染器暂不消费 |
| Skill / Command | `adw-design-artifacts/SKILL.md`：design-system/模板页面库/蓝图读取、designSystem+页面契约写法、无模板页面的写法、brief 页面契约表/冲突决策、validate errors/warnings 自查；`generate-design.md` 同步；`check-consistency.md` 对照需求/design-system/design.json/brief/原型/蓝图/代码，只报告缺失页面/字段/操作/表单形态/蓝图/冲突 |
| 测试 | 后端 `design/contract.test.ts` 5 条（新字段通过、旧设计不变、非法字段不阻断、validate.mjs warning/error、示例通过）；前端 adapter +3 条（契约映射、旧行为、designSystem 保留/非法 warning） |

验证（实跑）：

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **105 / 105**（原 100 + contract 5） |
| `npm run build --prefix frontend` | 通过（2797 modules） |
| `npm test --prefix frontend` | **79 / 79**（原 76 + adapter 3） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416） |
| `npm run e2e:preview --prefix backend` | **77 条断言**（保持） |
| `npm run e2e:p7-3b --prefix backend` | **45 条断言**（保持） |
| `npm run e2e:p2 / p3 / p4 --prefix backend` | **116 / 126 / 97 条断言**（保持） |

偏差：
1. 新字段问题在 `validate.mjs` 是 warnings，在后端 artifacts 仍是 errors（但 HTTP 200、不阻断）；两边都非门禁。
2. 线框渲染器未接线 form/tree/selection/行操作/组件等新 layout 字段（P7-4b 范围），本轮视觉输出不变。
3. 页面 `type` 未扩模板类型（tree-list 等），配方由 `recipe` 表达。
4. `tree.actionStyle/selectionStyle` 保持自由字符串；`form.groups[]` 未设 required。
5. e2e 无需更新断言（未依赖 skill/command 文本或新契约字段）。

未验证：真实模型按 design-system/蓝图写页面契约与 brief 冲突决策；设计视图展示契约/蓝图/认领状态；蓝图/catalogRef 自动校验；真实 AFCenter/EOS/3300。

### P7-4b 线框渲染器消费页面契约（2026-11-20）

| 项 | 位置 / 说明 |
| --- | --- |
| 纯函数 | 新增 `frontend/src/design/prototype/contract-view.js`：`controlFromComponent`（pm-* → 控件）、`resolveSelection`、`resolveRowActions`、`resolveToolbarActions`、`paginationModel`（bar/split/three-part）、`pagerSelectionText`（three-part 左统计）、`treeModel`（titleField/parentField、最多 12 节点、选中/动作样式）、`formView`（dialog/columns/width clamp 360–900/groups）、`subTableView`、`fieldSpanWithColumns`；单测 `contract-view.test.mjs` 15 例 |
| 接线 | `layout.ts#controlOf` 接入 `components`（优先级 `fieldOverrides.control` > `components` > 类型/命名推断）；`design-adapter.js` 把 `form.groups` 映射到 `layout.groups`（无 groups 时不产生该键）；`PrototypeCanvas.vue` 透传 `pagination/selection/rowActions/toolbarActions/form/groups/tree/subTables/components` 与 `recipe/selection/components`，并把本模块全部实体传给渲染器（子表目标解析） |
| 列表页 | `WireframeTable.vue`：树面板 `wf-tree` + 右表（`wf-split`，节点点击只改高亮）；selection=false 隐藏勾选列/批量条；选中后 `wf-batch-bar`；行操作/工具栏按动作码渲染（create 主按钮、batch* 进批量条、未知码原样）；分页三形态；移动端不渲染树 |
| 表单页 | `WireframeForm.vue`：`form.presentation=dialog` 或 `recipe=dialog-form` → 假列表背景 + 居中 `wf-dialog`（宽度 inline、标题=页面标题、底部取消/提交）；`form.columns=1` 单列；`layout.groups` 分组；`components` 经 FieldControl 生效；`subTables` 多个且 mode=tab → 页签；移动端保持整页表单 |
| 样式 | `wireframe.css`：树面板（platform/dot/background）、批量条、三段分页、弹窗遮罩/骨架/单列、子表页签；保持灰阶线框，不引入 Element Plus |
| e2e | 新增 `backend/scripts/renderer-e2e.ts` + `e2e:p7-4b`：临时根/端口 3444/stub opencode；写树列表 + 弹窗表单 fixture；覆盖树/三段落分页/批量条/disable 行操作/720 宽弹窗/两分组/pm-switch/pm-select-user/子表页签/两页 PNG 导出/0 console·pageerror·请求失败·外部请求，共 **48** 条断言 |

验证（实跑）：

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix frontend` | 通过（2799 modules；`dist/preview.html` 正常） |
| `npm test --prefix frontend` | **102 / 102**（原 85 + contract-view 15 + adapter 2） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **132 / 132**（未改后端） |
| `npm run e2e:p7-4b --prefix backend` | **48 条断言**（端口 3444 已关闭） |
| `npm run e2e:p3 --prefix backend` | **126 条断言**（旧 design.json 视觉保持） |
| `npm run e2e:preview / p7-3b / p7-6a --prefix backend` | **77 / 45 / 15**（保持） |
| `npm run e2e:p2 / p4 --prefix backend` | **116 / 128**（保持） |

截图/证据：`C:\Users\icecream\AppData\Local\Temp\workbench-p7-4b-shots\`（树页/弹窗页截图 + 导出的 `MOD-001-org-list.png` / `MOD-001-org-form.png`）。

偏差：
1. 树节点只改高亮，不改变表格数据（保证 PNG 稳定）；分页/批量条只是线框演示，不做真实翻页/删除。
2. 子表目标解析新增“本模块实体池”参数（`subTableModels(..., pool)`），设计视图用 `PrototypeCanvas` 传入的全部实体；原 `findEntityInModule` 恒空的行为保留。
3. 表单字段控件仍按 `fieldOverrides > components > 类型/命名推断`；`机构名称/机构编码` 因含“机构”仍被推断为组织选择控件（P7-4a 前规则，不属本轮变更）。
4. 弹窗页字段较多时高度较长（单列），PNG 按完整纸面导出，不做裁剪。
5. 未改 PNG 导出语义、preview 业务、开发视图/一致性检查规则、后端 schema/API/DB、需求模板中心或 `templates/**`。
6. 汇报材料只更新正文与 `build:report` 生成物（HTML 734,783B / PDF 1,086,602B / 14 页 / flow PNG 567,720B）；截图与流程图仍为 P7-A 版本，未重截。
7. 评审修正（2026-11-20）：three-part 在 `selection=false` 时左统计显示“共 N 条”（不再出现“已选 0 项”）；批量条只显示已声明的批量动作（默认组合仍含 batchDelete；页面只声明 create/import 时只显示“已选 N 项”）。

未验证：真实模型按契约生成树/弹窗页面后的视觉；真实 AFCenter 宿主 `pm-*` 渲染、EOS 运行态、真实 3300；PNG 像素级比对；移动端（<768）树/弹窗的视觉验收（本轮桌面 + stub）。

### P7-5a MF remote 脚手架 + 设计系统/蓝图/团队 skill 分发（2026-11-19）

| 项 | 位置 / 说明 |
| --- | --- |
| MF remote 种子 | 新增 `templates/afc-remote/`：`package.json`（vue3/element-plus/vue-router/webpack/MF/sass）、`setting.json`（`app.name` 占位，scaffold 写入应用 ID）、`build/mfp.config.js`（name/filename/exposes `./index`/shared vue+vue-router+element-plus/base remote）、`webpack.config/dev/prod`、`public/index_app.html`、`src/main.js`、`bootstrap.js`、`App.vue`、`router/index.js`、`views/AppIndex.vue`（占位入口）、`preferences/GlobalPreference.js`、README；不含 demo 业务页/actions/store |
| PageTemplates | `templates/afc-remote/src/components/PageTemplates/`：`index.js` + 12 个 `.vue`（List/TreeList/TreePanel/Form/FormSection/FormSectionCard/FormSectionDivider/QueryPanel/RowActions/ThreePartPagination/BlueListPage）+ `utils.js` + `style.css`/`appearance.css` + `table-white/table-blue/toolbar-blue/list-blue.css`；不含 examples/docs/verify/install |
| 团队 skill | `templates/agent/skills/afcenter-page-generation/`（68 文件，assets+references+scripts+agents）、`pm-components-usage/`（6 文件）；原样复制、同级相对链接可用 |
| scaffold | `scaffoldApp` 新增 `designSystem`（pack/applicationType/style）：创建前校验（非法不建目录）→ 复制 afc-remote 到 `frontend/` 并替换 `setting.json app.name`/`package.json name` → 写 `docs/design/design-system.json` → 复制 `docs/design/template/<type>/{pages/*.vue,structure.css,assets}` 与 `docs/design/template/styles/{shared,style}.css`（只复制选中类型）→ 分发团队 skill → 生成设计模板 skill |
| design-system.json | `schemaVersion/pack/packVersion/applicationType/style/blueprintRoot/templateDir/structure/styles/pages[]/skills`；页面含工作区蓝图路径与 pack 原始路径；无时间戳、幂等 |
| 模板 skill | `backend/src/templates/distribution.ts` 生成 `adw-template-proto-<applicationType>/`：SKILL.md（pack/类型/风格、页面库/蓝图表、页面配方、组件映射、conformance、设计/开发读取顺序、ui-check 要求、冲突上报）+ `assets/design-system.json` + `_manifest.json`（kind=`design-system`、sourceId=应用类型、templateName、hash） |
| 期望/清理 | `expectedSkillIds` = 2 方法 + 2 团队 + 需求模板 +（新应用：设计模板 skill；旧应用：旧原型模板 skill）；设计 skill 按独立 kind 白名单清理，不碰团队/用户/旧模板 skill；旧 legacy 生成逻辑保留 |
| 工作区同步 | `ensureWorkspaceAssets` 幂等对齐 design-system.json/蓝图（覆盖受管副本），不改 frontend、docs/requirements、docs/design 正文；`installAgentAssets` 改为内容不同才复制（避免每次打开重写 70+ 文件） |
| 边界 | 不改 DB 表、不 seed `prototype_templates`；旧应用无设计三键 → 不生成 frontend/design-system；需求模板中心/旧 design.json 渲染不变 |

验证（实跑）：

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **109 / 109**（原 105 + scaffold 2 + distribution 2） |
| `npm run build --prefix frontend` | 通过（2797 modules） |
| `npm test --prefix frontend` | **79 / 79**（未改前端代码） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416；MF/蓝图/设计 skill/团队 skill/setting 替换） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型）：2 方法 + 2 团队 + 设计模板 + 需求模板 skill + 4 command |
| `npm run e2e:preview --prefix backend` | **77 条断言**（保持） |
| `npm run e2e:p7-3b --prefix backend` | **45 条断言**（保持） |
| `npm run e2e:p2 / p3 / p4 --prefix backend` | **116 / 126 / 97 条断言**（保持） |

偏差：
1. 团队 skill 全量原样复制（不裁剪 assets）；PageTemplates 同时存在于团队 skill assets 与 `templates/afc-remote/src/components/PageTemplates/`。
2. 蓝图复制额外带上应用类型 `assets/`（operations 的 svg 被页面 import）；brief 只列 pages+structure.css。
3. 设计模板 skill 的 manifest kind 用 `design-system`（与旧 `prototype` 区分，避免误清理）；skill id 仍用 `adw-template-proto-<applicationType>`。
4. 新应用即使传了 `prototypeTemplateId` 也不再生成旧原型模板 skill（DB 列仍记录）；旧应用保持旧逻辑。
5. `design-system.json` 比 brief 示例多 packVersion/名称/templateDir/styles/packBlueprint 等定位字段。
6. 生成物未 `npm install`/构建（`pm-*` 由宿主提供）；只保证文件/JSON/配置完整。
7. `e2e:p2` 3.3 改为等待徽标更新（≤6s），避免新增对齐后的竞态；断言数不变。
8. 已有应用切换设计模板（PATCH）只更新 `design-system.json`/蓝图/设计模板 skill，不补建 `frontend/`、不清理旧类型蓝图目录；本轮只覆盖新建应用。

未验证：生成 `frontend/` 的 npm install/dev/build、真实 AFCenter 宿主与 pm-* 全局组件、开发 prompt/digest/ui-check 生成（P7-5b）、一致性验收（P7-6）、自定义 builder（P7-7）、EOS 构建/真实 3300。

### P7-5b 开发 prompt/AGENTS/开发方法 skill/digest/模块/ui-check（2026-11-19）

| 项 | 位置 / 说明 |
| --- | --- |
| 开发 prompt | `chat/service.ts#buildViewPrompt('development')`：设计系统/`design-system.json`/`design.json`/brief/tokens/prototypes/蓝图/团队 skill/开发 skill/ui-check；优先级 **需求 > design-system/design.json 契约 > 蓝图（布局/组件） > brief/tokens（视觉变量） > PNG（线框草图）**；冲突先报告、偏离说明、MF remote/pm-* 宿主、EOS 不吃风格；`DEFAULT_DEV_PROMPT` 同步 |
| 应用 AGENTS | `apps/scaffold.ts#appAgentsMd` 新增「设计系统与开发规则」：读取顺序/优先级/先填 ui-check（软门禁）/蓝图复制适配/PageTemplates/pm-*/GlobalPreference/conformance/冲突/PNG 草图/EOS 边界；`templates/afc-remote/README.md` 同步 |
| 开发 skill | 新增 `templates/agent/skills/adw-frontend-implementation/SKILL.md`（读取顺序、对照表、蓝图复制/适配、组件规范、截图比对、冲突/偏离、完成汇报、失败边界）；`installAgentAssets` 分发，`expectedSkillIds`/`smoke:assets` 增加 |
| digest | 新增 `backend/src/dev/digest.ts`：pack/类型/风格/页面库/蓝图根、模块页面（id/name/recipe/blueprint）、字段/列/操作/表单/树/分页、实体字段、brief/tokens/PNG（过期）、ui-check、团队/开发 skill；约 6KB 截断；缺失模块/设计给提示不抛 500；开发 prompt 注入 |
| 模块上下文 | `POST /apps/:id/development/session` 接受 `module`；`createDevSession`/`promptDevSession` 传模块；DevView 从 artifacts 取模块、单模块自动选中、`localStorage` 持久化，未改会话/流式/停止/compact |
| ui-check 软门禁 | 新增 `backend/src/dev/ui-check.ts`：`docs/design/<MOD>/ui-check.md` 缺失生成骨架（实现前/实现后/未实现项，页面/字段/操作来自 design.json + 页面库），已存在不覆盖，设计缺失/模块非法跳过；`missing/skeleton/filled` 状态（骨架哈希判断）；artifacts `design.uiCheck` 只读；开发视图显示状态；不阻断 |
| 开发视图参考 | DevView 顶部模块下拉 + 侧栏「设计参考」（应用类型/风格/页面数/模块/ui-check/蓝图根/打开模板中心）；未改时间线/工具卡/权限卡/Composer |

验证（实跑）：

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **115 / 115**（原 109 + `dev/linkage.test.ts` 5 + `dev/service.test.ts` 1） |
| `npm run build --prefix frontend` | 通过（2798 modules） |
| `npm test --prefix frontend` | **83 / 83**（原 79 + `dev/design-ref.test.mjs` 4） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型） |
| `npm run e2e:preview --prefix backend` | **77 条断言**（保持） |
| `npm run e2e:p7-3b --prefix backend` | **45 条断言**（保持） |
| `npm run e2e:p2 / p3 / p4 --prefix backend` | **116 / 126 / 128 条断言**（p4 原 97，新增模块/设计参考/ui-check/新 prompt） |

偏差：
1. ui-check 状态用骨架标记哈希判断：未编辑=已生成未填，编辑后=已填；手工创建（无标记）视为已填；已存在永不覆盖。
2. digest 只做摘要（页面最多 12 页、字段/列/操作有上限，超 6KB 截断），完整事实仍要求读 design.json/蓝图。
3. 模块选择持久化在 `localStorage`（`adw.dev.module.<appId>`），后端会话表不加列（不改表）。
4. ui-check 仅在开发 prompt 且模块明确时生成；command 分支不写对照表；设计缺失跳过。
5. `e2e:p4` 在临时应用目录写入需求/设计 fixture 用于模块/digest/ui-check 断言；不改产品路径。

未验证：真实模型“读 digest/蓝图 → 填 ui-check → 复制页面 → 截图比对”的完整还原；生成物 `frontend/` 的 install/dev/build、真实 AFCenter 宿主/pm-*、EOS 运行态；一致性脚本/截图自动比对（P7-6）、自定义 builder（P7-7）；真实 3300 与真实 `data/`、`projects/`、`.env` 均未读写；未执行 git；未调用模型。

### P7-6a 设计一致性检查（脚本/命令/API/开发视图）（2026-11-19）

| 项 | 位置 / 说明 |
| --- | --- |
| 共享规则 | `templates/agent/skills/adw-frontend-implementation/scripts/lib/fidelity-core.cjs`：Node 内置依赖；CLI 与后端共用，输出统一 `checks[] {id,label,status,evidence,hint}` + `summary` |
| 脚本 | `.../scripts/check-fidelity.mjs`：`--app`（默认 cwd）、`--module`、`--json`、`--strict`；默认人类摘要 + JSON，exit 0；`--strict` 仅 fail 时 exit 1；参数/目录错误 exit 2 |
| 检查项（12） | `design-system`、`page-contract`、`blueprint-files`、`implementation`（视图启发式 + 路由）、`page-templates`、`pm-components`、`form-dialog`、`auto-height`、`global-preference`、`style-imports`、`ui-check`、`prototypes`（PNG 缺失/过期/空 manifest） |
| Command | `templates/agent/commands/check-design-fidelity.md`：运行脚本、汇总 pass/warn/fail、给修复建议、只报告；command 数 4 → 5 |
| API | `backend/src/dev/fidelity.ts` + `POST /api/apps/:id/design-fidelity`（body `{module?}`）：返回 `appId/schemaVersion/ok/empty/reason/generatedAt/module/modules/designSystem/checks/summary`；无应用 404、目录缺失 409、模块非法 400、无设计 200 `empty`，不 500 |
| 开发视图 | `DevView.vue` 设计参考面板「检查一致性」按钮 + 只读报告（总体状态/计数/模块/时间/逐项证据/建议）；切换模块清空旧报告；不自动改代码、不影响会话/时间线 |
| 前端类型/纯函数 | `dev/types.ts` 报告类型；`dev/api.ts#checkDesignFidelity`；`dev/design-ref.js` 状态/文案/摘要纯函数；`design-ref.test.mjs` +2 |
| 测试 | 后端 `dev/fidelity.test.ts` 8 条（脚本 pass/warn/fail/缺设计/缺模块/`--module`/参数错误 + 服务 200/404/400/409/empty）；新增 `e2e:p7-6a` 15 条；`smoke:workspace` 增加 command/脚本/API 断言；`smoke:assets` 期望 5 command |

验证（实跑）：

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **123 / 123**（原 115 + fidelity 8） |
| `npm run build --prefix frontend` | 通过（2798 modules） |
| `npm test --prefix frontend` | **85 / 85**（原 83 + design-ref 2） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416；5 command + 检查脚本 + API 正常/无设计/非法模块/无应用） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型）：5 command 已加载 |
| `npm run e2e:p7-6a --prefix backend` | **15 条断言**（临时端口 + 临时数据目录；按钮/报告/ui-check/只读提示/0 console·page·API error） |
| `npm run e2e:preview --prefix backend` | **77 条断言**（保持） |
| `npm run e2e:p7-3b --prefix backend` | **45 条断言**（保持） |
| `npm run e2e:p2 / p3 / p4 --prefix backend` | **116 / 126 / 128 条断言**（保持） |

截图：`C:\Users\icecream\AppData\Local\Temp\workbench-p7-6a-shots\p7-6a-fidelity.png`。

偏差：
1. 规则只写一份：CLI 与后端 `require` 同一 `.cjs`；后端优先仓库内置副本，缺失回退应用 `.opencode` 副本。
2. 实现/路由检查是启发式：按蓝图文件名/页面 id/名称匹配视图；无法判断给 warn 并列出候选，`frontend/src` 缺失才 fail。
3. 占位 `AppIndex.vue`、PageTemplates 目录、GlobalPreference 定义本身不参与“已使用”判断，避免空应用误判通过。
4. 无设计不 500：无设计 200 `empty/no-design`；指定模块缺失 200 `empty/design-missing` + `page-contract` fail；模块 id 非法 400。
5. PNG 仅校验 manifest/designHash，不做像素比对；未导出/过期/空 manifest 均为 warn。
6. 新增独立 `e2e:p7-6a`（复用 p2 harness + 可选 `P2_DESIGN_SYSTEM`），不改 p2/p3/p4 断言数。
7. `workspace-smoke` 与 `verify-agent-assets` 的 command 期望同步为 5。

未验证（P7-6a 当轮）：真实模型 agent 读报告→修复→再检查闭环（P7-6b 已另行跑通，见下节）、截图 vs 蓝图/预览自动像素比对、生成物 `frontend/` 的 install/dev/build、真实 AFCenter 宿主 pm-*、EOS 运行态；未启停真实 3300；未读写真实 `data/`、`projects/`、`.env`；未改 DB 表；未执行 git；P7-6a 当轮未调用模型。

### P7-6b 真实模型闭环（2026-11-19 首跑 + 2026-11-20 复跑，通过）

| 项 | 结果 |
| --- | --- |
| 时间/环境 | 2026-11-19 17:29:57—17:35:55；临时根 `workbench-p7-6b-RsoJCm`；后端 3441、opencode 4741；真实 opencode 2.2.5 + `packycode-deepseek/deepseek-flash`；真实 3300/4771 全程未动 |
| 应用 | `p7-6b-e2e`；设计系统 `afcenter-app-templates-v1 / enterprise-application-platform / platform-blue`；MOD-001 组织与人员 fixture |
| 设计会话 | 90,474ms；13 条消息/20 次工具；`design.json` 5,077B（3 实体/3 关系/2 页面；designSystem + 完整页面契约）；`design-brief.md` 13,079B（页面契约表/冲突决策）；validate 0 error/warning |
| 开发会话 | 265,196ms；37 条消息/82 次工具（2 error）；17:33:01 **先填 ui-check**、17:33:11 写页面；17:35:54 被另一个会话调用 `/development/interrupt` 中止，未产出最终文字汇报；`ui-check.md` 已填；`OrganizationView.vue` 18,141B/497 行 + `/organizations` 路由 |
| 开发命中 | PageTemplates（TreePanel/FormSection/RowActions/ThreePartPagination）；pm-*（pm-input/pm-tree/pm-select/pm-table/pm-form-dialog/pm-switch）；v-auto-height 1；GlobalPreference；visual-style/structure/shared/style（3 份 CSS 与蓝图副本 SHA256 一致） |
| 一致性 | `POST /design-fidelity`：**11 pass / 1 warn / 0 fail**；唯一 warn 为 PNG 未导出；无 fix round；中断后用 CLI 独立复跑结果一致 |
| 清理 | opencode stop + 进程树结束；3441/4741 无残留监听；真实 3300/4771 PID 不变；未 git、未写凭据 |
| 证据 | `docs/plans/evidence/2026-11-19-p7-6b/`（design.json / design-brief.md / ui-check.md / OrganizationView.vue / evidence.json / driver.log）；`docs/plans/2026-11-19-p7-6b-real-model-brief.md` |

偏差/问题：

1. **开发会话被外部会话中断**：17:35:54.725 另一个工作台会话（cwd=仓库根）调用 `POST /api/apps/p7-6b-e2e/development/interrupt`，最后一条自查 shell 被 `aborted`，会话 `outcome=interrupted`，因此没有开发 agent 的最终文字汇报。中断前 17:35:20 自查已是 11/1/0，产物完整；最终文件已独立 `node --check` + CLI 复跑。不是产品/模型失败，也不是 SSE 卡死。
2. **枚举口径**：模型 `rowActions/toolbarActions` 用中文标签而非动作码；`tree.actionStyle=none`、`selectionStyle=background` 不在团队约定内；fidelity 暂不校验这些枚举。
3. **风格文件路径**：`design-system.json` 正确指向 `docs/design/template/styles/style.css`；临时驱动 prompt 误写 `styles/platform-blue/style.css`（pack 相对路径），agent read 失败后 glob 找到正确文件，未影响结果；后续 prompt 应统一写法。
4. **PNG/视觉**：设计视图未打开，PNG 未导出（warn）；生成物 MF remote 未 `npm install`/构建/截图，截图 vs 蓝图仍未验证。
5. **未实现项**：批量导入弹窗、批量分配角色弹窗、员工档案独立页、机构维护动作、员工选择器（`所属员工` 暂用 `pm-input`）均已写入 ui-check 待确认，未伪造交互。
6. **宿主/EOS**：未联调真实 AFCenter 宿主 pm-*，未构建/运行 EOS。

结论：设计→开发→检查的**工具链与产物闭环已跑通**（真实模型能写页面契约、按蓝图实现、先填 ui-check、用 PageTemplates/pm-*/GlobalPreference）；首跑因外部中断未正常收尾，记部分通过。

### P7-6b 复跑（2026-11-20，通过）

| 项 | 结果 |
| --- | --- |
| 目的 | 验证 P7-6c 的 SSE 自动收尾修复；同一驱动、全新临时目录/端口、真实模型 |
| 临时根 | `workbench-p7-6b-MBbEuZ`；后端 3441 / opencode 4741 |
| 设计 | 93,327ms；无 error；design.json 2 页面 + designSystem；brief 落盘 |
| 开发 | **234,491ms；无 error；done=true；finalText 2,409 字符；未人工 interrupt** |
| ui-check/实现 | ui-check filled；OrganizationView.vue 17,931B/532 行；PageTemplates/pm-*（6）/v-auto-height 2/GlobalPreference/路由 |
| fidelity | **11 pass / 1 warn / 0 fail**；warn 为 PNG 未导出；无 fix round |
| 软校验 | validate 捕获 `toolbarActions[2]="batchAssignRole"` warning（保留原值、不阻断） |
| 风格路径 | `design-system.json.styles.style = docs/design/template/styles/platform-blue/style.css`，`styleId=platform-blue`，文件存在 |
| 清理 | 临时后端/opencode 已停止；3441/4741 无监听；真实 3300 未动；未 git |
| 证据 | `docs/plans/evidence/2026-11-20-p7-6b-rerun/`；`docs/plans/2026-11-19-p7-6b-real-model-brief.md` 第 7 节 |

结论：**P7-6b 通过（工具链/产物/收尾）**。SSE 修复有效；仍保留的未验证仅有生成物 `npm install`/构建/页面截图、真实 AFCenter 宿主 pm-*、EOS 运行态、PNG 导出与视觉比对。

### P7-6c SSE 生命周期 + 契约枚举/风格路径小修（2026-11-19）

| 项 | 位置 / 说明 |
| --- | --- |
| SSE 完成判定 | 新增 `backend/src/opencode/session-state.ts`（纯函数）：`sessionCompletion`（当前轮末条 idle/outcome/time.idle/busy=false+assistant 完成）、`shouldFallbackFinish`、`eventCompletion`（兼容 `session.status/session.updated/session.state` 显式 idle）；`lastIdleMessage` 只看最后一条 user 之后，避免沿用上一轮 |
| chat watchdog | `backend/src/chat/service.ts`：记录 `lastEventAt`/`hasActivity`；每 2s 检查，最后事件后 10s 且无待处理权限/表单时用 `opencode.session()` + `messages({order:'desc'})` 确认收尾才 `finish()`→`done`；20 分钟总超时；finish 幂等、断开/中断不重复；定时器 cleanup |
| 开发视图收敛 | `dev/timeline.ts#buildProgress` 优先采信当前轮 idle 消息/outcome；`DevView.vue` 在 GET development 收敛到非 running 后清掉“思考中”占位（事件丢失也能收口） |
| 动作/树软枚举 | schema 增加 `x-adw-recommended`（create/edit/delete/detail/batchDelete/import/export/submit/cancel/enable/disable/approve/reject/print/copy）与 `x-adw-allowed`（actionStyle header/footer/none；selectionStyle platform/dot/background）；`validate.mjs` 与 `workspace/design-contract.ts` 同口径只出 warning，保留原值；旧 design.json 继续通过 |
| 风格路径 | `design/system-file.ts` 新路径 `docs/design/template/styles/<styleId>/style.css`，`design-system.json.styles` 增加 `styleId`；同步 scaffold AGENTS/distribution skill 文案/digest/开发 prompt/开发 skill/afc-remote README/command；`fidelity-core.cjs` 兼容旧 `styles/style.css`（pass + 提示），缺失只 warn；不迁移已有应用、不删旧文件 |
| 测试 | 后端 132/132（原 123 + chat 5 + timeline 1 + contract 2 + fidelity 1）；前端 85/85 保持；新增 watchdog（只 delta 无 idle→done）、中断、总超时、客户端断开、旧/新风格路径、枚举 warning 用例 |

验证（实跑）：

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **132 / 132** |
| `npm run build --prefix frontend` | 通过（2798 modules） |
| `npm test --prefix frontend` | **85 / 85**（保持） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416；新风格路径/JSON） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型） |
| `npm run e2e:p4 --prefix backend` | **128 条断言** |
| `npm run e2e:p7-6a --prefix backend` | **15 条断言** |
| `npm run e2e:preview --prefix backend` | **77 条断言** |
| `npm run e2e:p7-3b --prefix backend` | **45 条断言** |

偏差：
1. 后端 artifacts 对 P7-4a 已有软字段（recipe/form/pagination/components 等）仍按 errors 返回（既有口径），本轮只新增动作/树枚举 warning；两端对**新增枚举**一致。
2. watchdog 仅在“末条 idle/outcome/time.idle 或 busy=false 且 assistant 完成”时收尾；若 opencode 会话信息一直 busy=true 且不写 idle 消息，仍由 20 分钟总超时兜底（不猜测完成）。
3. 旧应用不迁移、不删除 `styles/style.css`；打开应用时受管副本会按新路径重写 `design-system.json`（仍兼容旧文件）。
4. P7-6b 证据目录只读未改；临时驱动脚本/真实应用未复用。

未验证：真实模型下“模型完成但 idle 事件丢失”的端到端收尾（本轮不跑真实模型）；宿主/浏览器长时间运行收敛；生成物 `frontend/` 的 install/build；EOS/真实 3300。真实 3300 未启停；未读写真实 `data/`、`projects/`、`.env`；未执行 git；未改需求模板中心。

## P7 汇报材料与文档收口（2026-11-20）

| 项 | 位置 / 说明 |
| --- | --- |
| 文档口径 | P7 设计稿状态行、`docs/plans/README.md`、`README.md`、`AGENTS.md`、`docs/ops/switch-to-agent-first.md`、本文件统一为：P7-1～P7-6c 已实施（待评审）；P7-6b 首跑部分通过 + 2026-11-20 复跑通过；P7-4b 随后已实施、P7-7 当时未做（2026-11-21 已实施 P7-7a/b-1/b-2a/b-2b/c-1/c-2）；真实 3300 当前未运行（当轮口径；P7-4b 的更新见其专节） |
| 报告正文 | `docs/report/ai-dev-workbench-overview.md` 更新到 P7：能力一览、设计模板 pack/预览/模板中心、design-system.json + 页面契约、MF remote + PageTemplates/GlobalPreference、开发提示/digest/ui-check、一致性检查、5 接口新增、P7 演示脚本、P7-6b 两轮证据；25,732B，数字与 STATUS 一致 |
| 流程图 | `docs/report/assets/flow-overview.svg` 1280×880：补设计模板 pack → 模板中心/preview → design-system/契约 → 开发提示/ui-check → MF remote/fidelity；PNG 2560×1760 |
| 报告生成 | `npm run build:report --prefix backend`：HTML 734,783B（717.6KB，0 外链/0 console error，1440/1024/768 无横向溢出）；PDF 1,086,602B（1,061KB，14 页）；打印版心流程图 688×499px 单页；flow PNG 567,720B |
| 截图 | 6 张：需求/设计浅色/设计深色/开发视图 4 张旧图重截 + 新增 `view-design-template-center.png`、`view-dev-fidelity.png`；临时 stub 实例（`report-app`，临时根 `workbench-p7a-report-*`，端口 3433，stub opencode）；0 console error / 0 pageerror / 0 外部请求；端口无残留 |
| 边界 | 只改文档与 `docs/report/**`；未改 `backend/src/**`、`frontend/src/**`、`templates/**`、DB/API/产物格式；未启停真实 3300/4771；未读写真实 `data/`、`projects/`、`.env`；未调模型；未做 git |

### P7-A 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **132 / 132** |
| `npm test --prefix frontend` | **85 / 85** |
| `npm run build:report --prefix backend` | 通过（尺寸/页数/自检见上表） |
| 数字一致性抽查 | 报告/README/ops 的后端 132、前端 85、e2e 77/45/15/116/126/128 与本节一致 |

### P7-A 偏差 / 未验证

1. 本轮按要求**未复跑 e2e**；报告中的 e2e 数字引用既有基线。
2. 截图为 stub 数据：`view-dev-fidelity.png` 报告为 **5 通过 / 7 警告 / 0 失败**（未实现页面导致），不是 P7-6b 的 11/1/0 真实模型结果；图注已写明示例。
3. 截图脚本放临时目录（不入库）；设计视图深色图只作为文件列出，未在正文内嵌（控制 PDF 页数）。
4. PDF 为 14 页（脚本上限 14）；后续增补正文需同步压缩。
5. 未验证（保持不变）：生成物 `frontend/` 的 install/dev/build/截图比对、真实 AFCenter 宿主 `pm-*`、EOS 构建/运行态、真实 401/403、<768 移动端、PNG 像素比对、P7-7（P7-4b 后续已实施，见其专节）；真实 3300 切换后的运行态。
6. 评审修正（2026-11-20）：报告 §3.2 示例改为通用列表（`recipe=list`、移除该页 `catalogRef`）；需求视图截图说明去掉“设计模板徽标”；`view-dev-fidelity.png` 重截（先把右侧设计参考置顶再展示报告，顶部标题完整、5 通过/7 警告/0 失败；临时根 `workbench-p7a-report-bRmNMK`、端口 3433）；`build:report` 重跑为 HTML 733,408B（716KB）、PDF 1,063,342B（14 页）。

## P6-4 实施（2026-11-19）

> 以下为 P6-4 当轮记录；当前报告尺寸/页数/流程图以「P7 汇报材料与文档收口（2026-11-20）」为准。

| 项 | 位置 / 说明 |
| --- | --- |
| 报告正文 | `docs/report/ai-dev-workbench-overview.md` 更新到 P6：聊天占位/reasoning/中文、模板即 skill、设计参考包（brief/tokens/prototypes + 自动导出/过期）、开发参考与一致性检查；基线 88/59/116/126/97 |
| HTML / PDF | `docs/report/ai-dev-workbench-overview.html`（单文件离线，325,196B）、`.pdf`（A4，750,667B，约 11 页；流程图打印版心 688×434px 单页） |
| 流程图 | `docs/report/assets/flow-overview.svg` 更新：方法 skill + `adw-template-*`、设计参考包与 PNG 写入、模板库 → 模板 skill；PNG 重新生成（453,918B，2560px 宽） |
| 截图 | `view-requirements-light.png`、`view-design-light.png`、`view-design-dark.png` 用临时 stub `report-app` 重新生成；设计截图含 brief/tokens/原型导出状态/导出时间；未使用真实项目数据 |
| 文档校对 | `README.md`（状态/P6 链接/目录/基线 88/59/126）、`AGENTS.md`（P6-4、设计参考包、模板 skill）、`docs/plans/README.md`（P6-4 完成）、`docs/ops/switch-to-agent-first.md`（模板 skill/设计参考包/apps=0/验收）、`docs/report/README.md`（P6 内容/11 页/基线） |
| 报告生成 | `npm run build:report --prefix backend`：HTML 离线（1 个本地请求、0 console error）、1440/1024/768 无横向溢出；PDF 11 页；SVG→PNG 正常 |

### P6-4 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **88 / 88** |
| `npm test --prefix frontend` | **59 / 59** |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace` | 通过 |
| `npm run smoke:assets` | 通过（真实 opencode 2.2.5 / 4719，不调模型）：2 方法 skill + 2 模板 skill + 4 command |
| `npm run smoke:dev` | 通过（真实 opencode 2.2.5 / 4724，不调模型） |
| `npm run e2e:p2` | **116** |
| `npm run e2e:p3` | **126** |
| `npm run e2e:p4` | **97** |
| `npm run build:report` | 通过：HTML 325,196B / PDF 750,667B / 11 页 / PNG 453,918B |

### P6-4 偏差 / 说明

1. 只改报告生成内容、文档与截图；未改产品行为/接口/表/工作区契约。
2. 需求/设计截图用临时 stub `report-app` 重新生成；开发视图沿用既有空态示例截图（避免展示 stub 模型名）。
3. 报告 HTML/PDF 由 `build-report.ts` 生成并自检；PDF 页数为脚本 `/Type /Page` 近似统计（11 页）。
4. 旧历史 STATUS 细节已收敛为摘要并指向 P1—P5 brief（P6-3 文档重写时的记录）；P6-4 最终版以本文件为准。

### P6-4 未验证项

- 真实 3300 切换后的运行态、EOS 应用构建/运行态。
- 真实 401/403 权限流转、非 headless 浏览器截图/PNG 导出。
- 用户完成切换后的人工验收。

## P6-3 实施（2026-11-19）

| 项 | 位置 / 说明 |
| --- | --- |
| 工作区结构 | `docs/design/<MOD>/design-brief.md`（设计 agent 维护）、`tokens.json` + `prototypes/_manifest.json` + `<page>.png`（工作台生成） |
| 新接口 | `POST /api/apps/:id/design/:module/prototypes`：`designHash + templateId + pages[]`；hash 不匹配 409、模板/页面/PNG 魔数/大小/路径校验 4xx、模块/设计缺失 404；写 PNG/manifest/tokens，删除旧 PNG/残留 PNG |
| 后端模块 | 新增 `backend/src/design/prototypes.ts`（`decodePngDataUrl` / `writePrototypePackage` / manifest/brief/tokens 只读） |
| artifacts | `backend/src/workspace/artifacts.ts`：`designs[]` 增加 `prototypes{designHash,templateId,exportedAt,stale,pages[]}`、`brief{exists,file}`、`tokens{exists,templateId}`（只读） |
| 前端导出逻辑 | 新增 `frontend/src/design/design-export.js` + `design-export.test.mjs`：payload、页面 id 安全化/去重、hash 查找、manifest 解析、stale/needExport |
| 设计视图 | `DesignView.vue`：可见 + hash 变化 → 1s 防抖自动逐页离屏渲染（隐藏 `PrototypeCanvas` + `captureElementPng` scale=2）→ 批量上传；手动「重新导出」；过期黄条；失败条 + 重试；brief/tokens/页数/导出时间状态 |
| API 客户端 | `frontend/src/workbench/api.ts`：`DesignArtifact` 参考包类型 + `savePrototypePackage` |
| 开发参考 | `buildViewPrompt('development')` 明确必读设计参考包、优先级与 EOS 边界；`DEFAULT_DEV_PROMPT` 同步；应用 `AGENTS.md` 新增“设计参考（开发）”段 |
| 设计 skill / command | `adw-design-artifacts/SKILL.md`：维护 brief、tokens/PNG 受管；`generate-design.md` 同步要求；`check-consistency.md` 增加设计 vs 代码差异清单（只报告、不门禁） |
| 测试 | 后端 `design/reference.test.ts`（写入/manifest/tokens/409/4xx/超限/旧 PNG/stale）；前端 design-export 5 用例；`e2e:p3` 自动导出/过期/手动重导/失败提示；`e2e:p4` 开发 prompt 设计路径与优先级 |

### P6-3 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend`（临时目录） | **88 通过 / 0 失败**（P6-1/2 82 + P6-3 6） |
| `npm test --prefix frontend` | **59 通过 / 0 失败**（P6-1/2 54 + design-export 5） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过（3416） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型） |
| `npm run smoke:dev --prefix backend` | 通过（真实 opencode 2.2.5 / 4724，不调模型） |
| `npm run e2e:p2 --prefix backend` | 通过：**116 条断言** |
| `npm run e2e:p3 --prefix backend` | 通过：**126 条断言**（新增自动导出/过期/手动重导/失败提示） |
| `npm run e2e:p4 --prefix backend` | 通过：**97 条断言**（新增开发 prompt 设计参考断言） |

### P6-3 偏差 / 说明

1. 自动导出在 `DesignView` 内用隐藏的 `PrototypeCanvas` 逐页离屏渲染；不新增浏览器端并发，导出中禁用重复导出。
2. `runExport` 开始前重新读取 artifacts；渲染后再次比对 design hash，变化则放弃本次（避免 409 与旧图覆盖）。
3. 导出失败保留旧 PNG/manifest，显示错误条与重试；自动导出失败后同一 hash 不自动重试（手动可重试）。
4. `design-brief.md` 不由工作台生成或校验；缺失只显示“未生成”，不阻塞导出/开发。
5. `tokens.json` 在每次导出时按 `templateId` 覆盖写入（`{templateId,name,tokens,shell}`）。
6. e2e 的“导出失败”通过 Playwright 拦截接口 500 验证，并只在该窗口忽略对应 console/API 错误；其余错误仍审计。

### P6-3 未验证项

- ~~真实模型全链路（需求 → 设计含 PNG/brief/tokens → 开发）~~ **已由主会话验证，见下**；人工截图“风格一致”仍需在有前端运行态时做。
- 真实浏览器（非 headless）的离屏 html2canvas 导出效果。
- 真实 3300 与 EOS 应用构建/运行态。

## 主会话 P6-3 复核（2026-11-19，通过）

### 独立复跑

- 后端 **88/88**、前端 **59/59**、`typecheck`/`check:vue`/`build`、`e2e:p2/p3/p4` = **116/126/97** 全部通过。

### 真实模型全链路（临时实例，真实 opencode 2.2.5 + `deepseek-flash`；未碰真实环境）

| 步骤 | 结果 |
| --- | --- |
| 需求生成 | 精简 PRD（MOD-001 商品管理） |
| 设计生成（`generate-design`） | `design.json` + **`design-brief.md`（agent 写）** + **`tokens.json`** + `prototypes/` |
| 设计视图自动导出（真实浏览器渲染） | **3 页 PNG**（product-list/form/detail）+ `_manifest.json`（designHash/templateId/pages）；0 console error |
| 开发实现 | **47.7s**：读取 `design.json`、`design-brief.md`、`tokens.json`、`prototypes/_manifest.json`、`prototypes/product-list.png`，再创建 `frontend/src/views/ProductList.vue`（12.5KB） |
| 一致性证据 | 代码包含设计列 `商品编码/商品名称/商品状态`；引用 tokens/颜色变量；工具目标包含全部设计参考路径 |

### 结论与观察

- **P6-3 通过评审**：设计参考包被开发 agent 实际读取并使用，不再是自由发挥。
- 人工"截图 vs 原型"视觉比对尚未做（需要把生成的前端跑起来）；当前以读取轨迹 + 字段/tokens 断言作为验收证据。
- 沿用 P6-1/2 观察：模型 reasoning 仍可能英文（正文中文）。

## P6-1 / P6-2 实施（2026-11-19）

| 项 | 说明 |
| --- | --- |
| 聊天占位 | `frontend/src/workbench/chat-status.js`（纯函数：`awaiting / failed / interrupted`）+ `AgentChatPanel` / `DevView` 共用；发送即占位，首个 delta/assistant 消息或 failed/interrupted 时替换 |
| reasoning | 共享 `frontend/src/shared/reasoning.css`：`<details class="rg-reasoning">` 折叠块“思考”；`AgentChatPanel` 默认折叠，`DevView` 展开 |
| 中文 | `backend/src/chat/prompts.ts#CHINESE_INSTRUCTION` 注入 `buildViewPrompt` 三个视图、`DEFAULT_DEV_PROMPT`、应用 `AGENTS.md`、4 个 command |
| 模板 skill | `backend/src/templates/distribution.ts`：`adw-template-req-<id>`（SKILL.md + assets/template.md + _manifest.json）、`adw-template-proto-<id>`（SKILL.md + assets/template.json + assets/tokens.json + _manifest.json）；`expectedSkillIds` / manifest 白名单清理 / legacy 清理 |
| 同步 / 删除 | 全局保存同步引用应用（幂等）；创建/打开/会话启动幂等对齐；删除模板按引用检查后移除模板 skill；不碰方法/用户 skill |
| 方法 skill | 需求按模块 `template` → 对应 skill → 应用默认 → 缺失说明；设计先加载 `adw-template-proto-<id>` |
| 校验 / UI | `chat/service.ts#verifyProjectAssets` 期望“方法 2 + 当前模板 skill”；模板库显示同步应用数/skill/告警 |
| 验证 | 后端 82/82、前端 54/54；`smoke:assets` 实测 2 方法 skill + 2 模板 skill + 4 command；e2e p2/p3/p4 = 116/104/91 |

## P5 基线（已完成并通过评审）

- 汇报材料：`docs/report/ai-dev-workbench-overview.md` / `.html` / `.pdf`、`assets/flow-overview.svg/png`、三视图截图；生成脚本 `backend/scripts/build-report.ts`。
- 一致性清理：移除未使用依赖 `@antv/x6` 与零引用导出；`install:all` 含根依赖；`SessionList` 旧样式删除。
- 切换清单：`docs/ops/switch-to-agent-first.md`（只写步骤，未执行）。
- 基线验证：后端 77/77、前端 49/49、`build`/`typecheck`/`check:vue`、`smoke:workspace/assets/dev`、`e2e:p2/p3/p4` 104/67/83。
- 主会话真实模型 E2E（临时实例）：需求 41.0s → 设计 50.8s → 开发 11.5s；三视图 Playwright 校验通过（0 console error）。

## P4 / P3 / P2 / P1（摘要）

- **P4**：开发视图统一 `buildViewPrompt`、首条提示、用户气泡只显示原文、孤儿设计/designs warnings 合并；`smoke:dev` 与 `e2e:p4` 83 条断言。
- **P3**：design.json → 渲染契约 adapter、ER/原型渲染、缩放/PNG 导出、错误条、跨模块/未知实体 warning；`e2e:p3` 67 条断言。
- **P2**：需求模块大纲/文档渲染/对话/权限/表单/停止/compact/历史/85% 横幅/命令；`e2e:p2` 104 条断言。
- **P1**：5 表数据层、工作区脚手架、skills/commands、模板分发/同步、模块文件 API、统一 chat、artifacts + watcher；旧流程一次性删除。
- 各阶段 brief 在 `docs/plans/`，本文件不再重复流水账。

## 下一步

- **等待用户提出细化 / 优化 / 打磨需求**；AI 不自行开工。每次先只读定位代码与影响面、给方案与分批，等用户确认后再派唯一实施会话。
- **P7-7 自定义模板 builder**：**P7-7a、P7-7b-1、P7-7b-2a、P7-7b-2b、P7-7c-1、P7-7c-2 已实施（待评审，2026-11-21）**；真实模型闭环证据在 `docs/plans/evidence/2026-11-21-p7-7-real-model/`；其余 P7-1～P7-6c、P7-4b、P8-1、P8-2、P9、P10、P10b、P11、P12 已实施（待评审）。
- **真实 3300 人工验收**：**已于 2026-11-23 由用户确认全部通过**；**P7-7 评审仍待定；验收明细待补**（未采集 appId/packId/模板名、fidelity 计数、耗时、越界检查等）。当前 3300 PID **39828**（启动 09:10:41）、4771 PID **19608**（启动 09:10:42），`/api/health` 200；`backend/dist` 2026-11-23 10:08:23、`frontend/dist` 10:08:49（后端进程早于 dist 约 58 分钟，09:10 后若有后端改动需用户自行 restart）。重启/切换仍按 `docs/ops/switch-to-agent-first.md` 由用户执行，工作台不提供自动切换/回滚；fail-closed 仅针对旧 5 表结构 + `apps>0`；历史 PID/构建时间（2026-11-20 16:15:08、2026-11-21 21:34/21:31）保留在「真实实例」条。
- **未做/未验证**：PNG 像素级模板比对（P10 已做宽高 + 主色采样）；真实 AFCenter 宿主 `pm-*`/EOS、真实 401/403、<768 移动端；真实 3300 上 main-sub/wizard 人工视觉验收；真实模型对新配方（main-sub/wizard/detail/dashboard）的完整产出复跑。
- 需要接续时先读交接单 `docs/plans/2026-11-20-phase1-handover-and-next-session-prompt.md`（含新会话话术），再只读复核 `/api/health`、4 表、`apps>0`。

## 工程事实

- 工作台自身只读写 SQLite（4 表：应用/设置/会话/需求模板），不连接/不启动 MySQL；需求模板库在 DB，应用内模板 skill 由工作台自动分发/同步；设计阶段只用设计模板（文件 pack，不入库）。
- 新应用前端骨架来自 `templates/afc-remote`（MF remote）；页面蓝图来自 `templates/design-system` 选中应用类型，复制到 `projects/<app>/docs/design/template/` 供开发参考。
- 设计参考包由前端渲染 PNG（html2canvas）后上传；不调用图片生成模型。
- 设计一致性检查是静态只读报告：脚本 `.opencode/skills/adw-frontend-implementation/scripts/check-fidelity.mjs` 与 `POST /api/apps/:id/design-fidelity` 共用规则；不做截图像素比对、不阻断开发。
- 依赖安装：`npm run install:all`（不要用 `npm install --prefix`）。
- 环境：Node 20.20.1 / npm 10.8.2 / Java 17 / Maven 3.9.14 / opencode 2.2.5；真实模型 `packycode-deepseek/deepseek-flash`。
