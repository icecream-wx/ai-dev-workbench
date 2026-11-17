# AI Dev Workbench 工作约定

本项目是三阶段智能开发工作台：**需求 → 设计 → 开发**。开始工作前先读：

1. `docs/STATUS.md`（当前状态与接续）
2. `docs/plans/2026-11-09-workbench-v2-design.md`（当前唯一有效设计）
3. `docs/plans/2026-11-09-implementation-tasks.md`（P0—P5 任务拆分）
4. `README.md`
5. `templates/eos-app/README.md`

`docs/plans/2026-11-04-*` 是 requirements-grooming 的历史计划，不代表新方向。

## 当前首项（2026-11-09）

方向已确认：**需求/设计 A（短暂 opencode 会话 + 专用 req/design agent + prompt + SSE），开发 B（原生 build 会话）**；其余按推荐默认。不要重复讨论 A/B。

**P0—P5 已完成**（旧 dev 停用、骨架、`OpencodeRuntime`、配置/密钥边界；应用表/API、EOS 模板渲染、应用级 workspace、三阶段、首页创建；req/design agent、短暂会话 chat + SSE、模型选择、decompose/testgen 迁移；交接包；开发会话 API + `app_sessions`、原生 build agent、开发页时间线/工具卡/diff/权限/表单/Composer/文档大纲/文件变化、完成与恢复；真实应用 `quarterly-reporting` 的 EOS + Vue3 + MySQL 实现、H2 测试、真实 MySQL 空/非空 E2E、脱敏修复、用户确认完成），验证记录见 `docs/STATUS.md`。

**2026-11-10 R1 已完成**：需求阶段改为“左侧 AI 对话/构建活动 + 右侧模板化 Markdown 文档”，文档按章节持久化；模板表/文档章节表/版本表、内置模板 seed（标准 PRD 13 节/精简 PRD 6 节/业务策略/QA）、模板 API、文档 API、chat doc 模式、模板中心/章节编辑器/章节问 AI/确认需求/删除应用已落地；真实模型用 `packycode-deepseek/deepseek-flash` 跑通 Playwright E2E。设计阶段读取文档/Epics 与交接包改用文档属 R3，未接通；R2/R3/R4 方案见 `docs/plans/2026-11-10-requirements-stage-doc-design.md` 与 `docs/plans/2026-11-10-requirements-r1-implementation-brief.md`。

**2026-11-11 H1—H4 已完成**：需求 Scene/Epic/Story 结构化章节 + 稳定 ID；DesignInputBundle（版本/hash/历史）与设计项目绑定；实体/页面 `requirementRefs`、页面集 `epicId/storyIds`；需求覆盖度视图；需求变更 diff/重新同步/重新编辑需求。验证记录见 `docs/STATUS.md`「H1—H4 完成」。

**2026-11-11 D5 已完成并评审**：设计确认后确定性生成开发交接包（`00-README`、`01-REQUIREMENTS`、`02-DATA-MODEL`、`03-PAGES`、`04-PLAN`、`05-CHANGES`、`schema.sql`、`prototype-template.json`、`manifest.json`、`prototypes/`），校验（需求/设计/输入未过期/引用/每页 PNG）→ 创建 Change Set #1（初始开发）→ 写盘/版本/hash → 应用进入 development；DesignStudio 主按钮“生成交接包并进入开发”；开发会话记录 handoff 版本/hash。主会话评审结论：主链路可验收；3 项 must-fix（重新生成文案、预览/历史 PNG URL、首包变更单状态）**已修复并复验**，见 `docs/STATUS.md`「D5 评审」→「must-fix 修复」。

**2026-11-11 C1 已完成并评审**：Change Set #2+#N、需求/设计 reopen 门禁、`05-CHANGES` 真实 diff、变更历史/取消（恢复基线）/仅设计→需求+设计范围升级、变更首条提示；后端 100 测试、前端 35 测试、typecheck/build、`smoke:change-set` 与回归冒烟、Playwright（API 预置）通过，见 `docs/STATUS.md`「C1a 完成」「C1b 完成」「C1 评审」。

**2026-11-11 R2a 已完成**：需求 AI 建议“先预览（不写库/不产版本）→ 章节勾选/行级 diff → 应用选中/忽略”、建议随消息持久化并带 `baseVersion`、`removeSectionKeys` 仅删自定义可选章节、doc 路由/doc 对话 mode 守卫、使用中模板删除保护、模板章节 key 编辑规则；后端 110 测试、前端 44 测试、typecheck/build、`smoke:requirements` 扩展与 4 项回归、真实模型 Playwright 通过，见 `docs/STATUS.md`「R2a 完成」。

**2026-11-11 R2b 已完成**：需求文档版本 checkpoint 化（自动保存不产版本；模板切换/AI 应用/确认需求/回滚/取消恢复/手动保存为来源化版本）、`POST /requirements-doc/versions` 手动保存版本、确认需求必产 `confirm` 版本供变更单基线、版本列表 `changeSetSeq`、建议消息裁剪（持久化去 lineDiff、加载 hydrate）、R2a 两项 UX 修复；后端 115 测试、前端 46 测试、typecheck/build、`smoke:requirements` 扩展与 4 项回归、Playwright（API 预置）通过，见 `docs/STATUS.md`「R2b 完成」。

**2026-11-11 I-10 已完成**：开发页左侧会话列表（按变更单分组/搜索/重命名/归档/恢复/归档只读）、`app_sessions.title/note`、会话列表/切换/归档 API、`?sessionId=` 只读时间线、切换/归档前 best-effort interrupt、旧交接包恢复提示；后端 116 测试、前端 54 测试、typecheck/build、`smoke:dev-sessions`（真实 opencode）+ `smoke:dev`/`smoke:change-set`/`smoke:design-handoff`/`smoke:requirements` 回归、Playwright（API 预置）通过，见 `docs/STATUS.md`「I-10 完成」。

**2026-11-11 I-09a 已完成（待评审）**：开发会话上下文健康度（按模型 `limit.context` 的百分比，60% 黄 / 85% 红）+ opencode 原生 compact + 时间线压缩提示；`DevProgress.context`、`POST /development/compact`、`dev-health.js`、模型 limit 60s 缓存、chip/提示条/右侧会话卡；后端 123 测试、前端 60 测试、typecheck/build、`smoke:dev-health`（真实 opencode）+ 5 项回归、Playwright（真实 opencode + 路由注入 warn/danger）通过，见 `docs/STATUS.md`「I-09a 完成」。

**2026-11-11 R2c 已完成（待评审）**：设计版本 checkpoint 化（自动保存/单实体、页面集确认不产版本；确认设计/模板切换/AI 生成/同步设计输入/版本回滚/变更取消恢复/手动保存为来源化版本）、确认设计必产 `confirm` 版本供 C1 基线/取消恢复、`POST /design/versions` 手动保存版本（confirmed 409）、版本列表/详情 `changeSetSeq/changeSetTitle`、版本弹窗来源标签/变更单号/保存版本/截图提示；顺带修正 I-09a compact toast 文案；后端 126 测试、前端 63 测试、typecheck/build、`smoke:design` 扩展 + 5 项回归、Playwright（API 预置）通过，见 `docs/STATUS.md`「R2c 完成」。

**2026-11-11 R4a 已完成（待评审）**：安全清理——删除 `legacy/`（旧 dev 后端/前端 UI）、未挂载的 `DesignPending.vue`、未注册的 `designErrorHandler`，以及一批零引用死导出（apps/changesets/design/handoff/requirements）；修正 `DesignHandoffDialog` 的 `props.mode` “初始开发” chip；无行为/接口/数据库/交接包变更；后端 126 测试、前端 63 测试、typecheck/build/check:vue、`smoke:design`/`design-handoff`/`handoff-input`/`change-set`/`requirements`/`dev-sessions`/`dev-health` 回归通过，见 `docs/STATUS.md`「R4a 完成」。

**2026-11-11 R4b-1 已完成（待评审）**：前端 shared 抽取 + 旧 structured UI 删除——`theme.css`/`pinia`/`storage`/`app-context`/`protocol-output` → `frontend/src/shared/`；模型设置 → `frontend/src/settings/`；原型线框 + `spec/types`（裁剪）→ `frontend/src/design/prototype/`；删除整个 `frontend/src/requirements-grooming/`、`workbench/HandoffDialog.vue`（旧 P3）、`e2e-flow.ts` 与未用依赖 `ajv`/`monaco-editor`；`App.vue`/`AppShell`/`HomeShell`/`workbench/api.ts` 收敛为 doc/design/dev 单模式（移除 `MainApp`/`docMode`/`ui.activeView`/structured 统计/旧 Handoff 类型）。未改后端/接口/数据库/应用登记；后端 126 测试、前端 63 测试、typecheck/build/check:vue、临时数据目录 Playwright（首页/需求文档/设计原型 wireframe/开发页/变更历史/模型设置，0 console error / 0 意外 API>=400）通过，见 `docs/STATUS.md`「R4b-1 完成」。

**2026-11-11 R4b-2 已完成（待评审）**：后端 structured 移除 + 旧应用/数据删除——删除旧 P3 交接包（`handoff/{bundle,render,service,validate,routes,types}.ts`、`smoke:handoff`）、`/api/workspace`、`/api/modules/*`、`/api/settings/*`、`/api/agents/*`、旧 `agents/{decompose,prompts,queue,routes,types}.ts`、旧 spec 对话与 `buildChatPrompt`、`requirements_mode` 全部分支与列；drop `modules`/`module_docs`/`handoffs` 表并清理旧全局设置键；`apps` 创建/详情/删除收敛为文档模式；旧应用 `quarterly-reporting`/`app1` 已备份到仓库外并删除。后端 113 测试、前端 63 测试、typecheck/build/check:vue、`smoke:requirements`/`design`/`design-handoff`/`handoff-input`/`change-set`/`dev-sessions`/`dev-health`/`dev` 与临时目录 Playwright 通过；真实 DB `apps` 空、无 `modules`/`handoffs`、`projects/` 空，见 `docs/STATUS.md`「R4b-2 完成」。

**2026-11-11 R4c 已完成（待评审）**：收尾——MySQL demo 清理 SQL `docs/ops/cleanup-demo.sql`（工作台**不连接数据库、不执行**，由用户自行执行）；移除未使用依赖 `@element-plus/icons-vue`（前端直接依赖，仍随 element-plus 传递安装）与 `ai-dev-workbench: file:..`（backend/frontend 的 package.json + lock + `node_modules` junction），根 `concurrently` 保留；因本机 npm 10.8.2 的 `npm install --prefix <子包>` 会把仓库根包写成该子包的 `file:..` 依赖，`install:all`、`start.cmd`、`start.sh` 改为在各自包目录内安装；后端 113 测试、前端 63 测试、typecheck/build/check:vue、根 build、`smoke:requirements`/`smoke:design-handoff` 通过；`apps` 空、`projects/` 空、无旧表，见 `docs/STATUS.md`「R4c 完成」。

**2026-11-11 视觉 V1 已完成（待评审）**：主题系统（`shared/theme.css` 语义 token + Element Plus 深色变量 + `color-scheme`）、`setTheme/toggleTheme`（localStorage → `prefers-color-scheme` → light）、AppShell/HomeShell 顶栏主题按钮 + SettingsDialog「外观」分段控件，以及 HomeShell/AppShell/NewAppDialog/SettingsDialog/ChangeSetStart/History/DesignHandoff/VersionHistory/DesignVersions/MarkdownView 的 token 化 + 1280/1024/768 响应式 + 弹窗内部滚动；未改后端/接口/数据，未改需求文档/设计 Studio/开发页（V2/V3）；前端 63 测试、typecheck/build/check:vue、Playwright（浅/深 × 1440/1024/768，0 console error / 0 意外 API>=400 / 0 深色白底 / 0 横向溢出）通过，见 `docs/STATUS.md`「视觉 V1 完成」。

**2026-11-11 视觉 V2 已完成（待评审）**：需求文档 + 设计 Studio 的 token 化/深浅色/响应式——需求三栏在 1024/768 折叠为对话+大纲抽屉（遮罩/关闭/Esc），工具栏不溢出，章节卡/结构化 OutlineEditor/AI 建议卡行级 diff/气泡/模板中心/版本/只读横幅统一 token；设计 Studio 顶栏/Tab/实体表/ER SVG/页面原型/页面集树/覆盖度/同步/原型模板/交接包/版本 token 化，≤1024 设计对话与页面集树抽屉、≤768 实体列表抽屉与画布+规格纵向堆叠；原型线框保持“白纸”语义（`.proto-skin/.proto-paper/.proto-image` 不改深色）；`theme.css` 仅新增 `--rg-accent`/`--rg-accent-soft`；未改后端/接口/数据/版本/交接包；前端 63 测试、typecheck/build/check:vue、Playwright（浅/深 × 1440/1024/768 共 120 张，0 console error / 0 意外 API>=400 / 0 深色白底 / 0 横向溢出）通过，见 `docs/STATUS.md`「视觉 V2 完成」。

**2026-11-11 视觉 V3 已完成并评审**：开发页 token 化/深浅色/响应式——`DevView` 顶栏换行（1440/1280 单行、1024/768 两行）+ 上下文 chip/压缩按钮/连接与运行状态、只读/完成/失败/上下文横幅、时间线 user/assistant/reasoning/compaction/流式/空/加载/错误态、`SessionList` 分组/选中/hover/搜索、`StepCard`/`ToolCard` 的 diff（`--rg-diff-*`）/shell（`--rg-terminal-*`）/exit/参数折叠、`PermissionCard`/`FormCard`、`Composer`、右侧会话信息/交接文档/文件变化；≤1024 会话栏与 right aside 折叠为抽屉（遮罩/Esc/互斥）+ 右侧折叠按钮，≤768 单栏 + 顶栏两行 + Composer 贴底；`theme.css` 仅新增终端输出/diff 行底色 token 与深色开关圆点；未改后端/接口/数据；前端 63 测试、typecheck/build/check:vue、**全量截图 270 张**（浅/深 × 1440/1280/1024/768 × 首页/新建应用/需求/设计/开发 12 态/交接包/变更历史/模型设置，0 console/page error / 0 意外 API>=400 / 0 深色白底 / 0 横向溢出）+ 真实 opencode 功能回归（建会话/列表/SSE/只读/恢复/主题持久化/1024 抽屉）通过，见 `docs/STATUS.md`「视觉 V3 完成」「视觉 V3 评审」。视觉 V1—V3 已完成并评审。

下一步 **I-09b-1（U6）已完成并评审（2026-11-12）**：交接包规模识别 + `04-PLAN` 建议分阶段 + 提示。**U7-1 后端已完成并评审（2026-11-12；安全 must-fix #1/#2 已修）**：`manifest.phases`（稳定 key）+ `app_dev_phases` + 按需生成 + start/complete/skip/reopen + phase brief + 摘要/fallback（只读 `design`/`req` agent，全链路脱敏）+ 会话/状态/列表 phase 字段 + `smoke:dev-phases`。**U7-2 前端已完成并评审（2026-11-12）**：按阶段开发入口、阶段条/弹窗、开始/完成/跳过/重新打开、会话 chip、只读/历史只读、响应式 + Playwright；主会话复核 must-fix（`loadPhases` 并发序号）已修。**U7-3 真实模型全链路已验证（2026-11-12）**：真实模型需求→设计→large 交接包→6 阶段；阶段 1 摘要 `model`（486 字/5.1s）、阶段 2 `fallback`（移走 agent + 重启 opencode）+ warning；P2 主实体映射、只读/恢复、应用保持 development；0 console/API 错误。视觉 V1/V2/V3 已完成并评审。

**2026-11-12 启动/停止脚本修复（B1+B2，已实施并验证）**：`start.cmd`/`stop.cmd` 读取 `backend/.env` 改为 `for /f "usebackq ..."`，PORT 优先级与 dotenv 一致（进程环境变量 > `.env` > 3300）、值去空格/引号/行内注释、1—65535 校验（`start.cmd` 非法即退出，`stop.cmd` 仅禁用端口兜底仍按 PID 停止）；`stop.cmd`/`stop.sh` 的 PID 文件与端口兜底都校验目标是本工作台（Windows `node.exe` + `dist\index.js`；Linux `/proc/<pid>/cmdline` + cwd=`backend`），不符时只提示不杀、端口兜底 `exit 1`。默认 3300 启停、非默认 `.env`/环境变量、重复启动、非法端口、dummy/无关 PID 拒绝、正常端口兜底与 Linux 拒绝路径均实测通过；真实数据未污染。验证见 `docs/plans/2026-11-12-start-stop-script-verification.md` 与 `docs/STATUS.md`「一键启动/停止脚本」。M1/M2/M3/M4/O1/O3 仍未修。

**2026-11-13 创建应用选模板 + 模板解析（#7，已实施并评审）**：`apps` 新增 `requirement_template_id`/`prototype_template_id`；创建应用可选需求模板（requirements 阶段）+ 设计原型模板，创建前校验、非法/QA 模板 400 且不建目录；需求文档/设计项目初始化优先应用默认，旧应用回退全局默认；需求/设计切换模板同步应用默认；新增只读 `GET /api/apps/:id/templates`（需求：已有文档 > 应用默认 > 全局；原型：设计项目 > 应用默认 > 全局，带 `prototypeSource`），供 #8 需求阶段原型预览使用；模板删除/损坏静默回退，不 500。NewAppDialog 增加两个下拉/说明（设计模板也用于需求阶段粗略预览）。后端 157 测试（基线 150，+7）、前端 96、typecheck/build/check:vue、临时 Playwright（UI 创建非默认模板/默认/加载失败、文档模板 badge、设计项目模板与切换跟随、resolver 优先级、11 张截图 0 错误/溢出/白底）通过；见 `docs/plans/2026-11-13-app-templates-brief.md` §7、`docs/STATUS.md`「创建应用选模板 + 模板解析（#7）完成」。

**2026-11-13 开发/需求 UX 小改批（#1/#2/#4/#5，已实施并评审）**：开发 Composer 移入 timeline 并与消息区 880px 对齐（不再铺满整页）；Enter 发送、Shift+Enter 换行、Ctrl/Cmd+Enter 兼容，含输入法 `isComposing`/229 防误发；开发首条提示/阶段 brief/新应用 AGENTS.md 增加“中文回复与思考”要求（模型不保证 100%）；变更单 #2+ 进入需求阶段时按变更单预填需求对话（有历史也预填一次、每变更单 localStorage 仅一次、已有草稿不覆盖、不自动发送）。#3 阶段条遮挡经用户确认已自行消失，本批未改。后端 150 测试、前端 96 测试、typecheck/build/check:vue、临时 Playwright（Composer 0px 对齐、Enter/Shift/Ctrl/IME、有历史预填、无自动发送、10 张截图）通过；见 `docs/plans/2026-11-13-dev-ux-batch-brief.md` §7、`docs/STATUS.md`「开发/需求 UX 小改批完成」。

**2026-11-12 需求/原型修复（#4/#5/#1.1/#1.2/#2，已实施并验证）**：原型截图/导出 PNG 统一 `captureFromAnyView()`（图片视图临时切回原型、等待 `paperRef` 非零尺寸、恢复视图），图片视图空态/顶部截图/导出均可；readiness 新增“N 页缺少原型截图”非阻塞 warning + 原型页常驻提示条；Epic 目标改多行 textarea（2—6 行）；模型 prompt 明确 goal 不得写 Story、每 Epic 至少 1 Story/top-level stories；后端归一化展开 `epic.stories/userStories/user_stories`（按 raw id 全局、标题按 Epic 去重），并给“Epic 无 Story”warning（保存/预览/编辑器可见，确认门禁不变）；场景说明为非 1:1（可选、一个场景多 Epic、一个 Epic 最多一个场景）。后端 149 测试、前端 79 测试（随后 ER +8 → 87）、typecheck/build/check:vue、临时 Playwright（20 张，0 错误/溢出/白底）通过；见 `docs/plans/2026-11-12-requirements-design-fixes-brief.md` §7、`docs/STATUS.md`「需求/原型修复」。

**2026-11-12 ER 图专业化（#3，已实施并验证）**：新增 `frontend/src/design/er-layout.js` 纯布局（240 宽表卡片、动态高度、字段 ≤12 + `+N`、连通分量 BFS 分层、循环/自引用/多组件、无关系网格、贝塞尔边 + 基数/关系标签）；`ErGraph.vue` 重写为专业表卡片（实体名/表名/状态、PK/FK/*/U、类型/FK 目标、图例、缩放 75/100/125、点击/键盘选中、空状态），token 深浅色、内部滚动、1024/768 响应式；新增 8 项布局单测，前端 87/87；临时 Playwright 13 张截图，0 错误/页面级溢出/白底。见 `docs/plans/2026-11-12-er-graph-redesign-brief.md` §6、`docs/STATUS.md`「ER 图专业化」。

**P1 设计 ID 跨应用冲突修复 + U6 变更单 caveat 已完成并评审（2026-11-12）**：实体/页面集/页面 ID 改为“已有对象保留原 ID；新对象 raw id 仅当全局未被占用（`ID_PATTERN` + 本应用 used + 目标表 `idExists=false`）时保留，否则生成全局唯一 ID”；每次确定 ID 后无条件登记 used（同一 payload 重复 raw id 的后续对象换新）；默认页面集不再用 `ps-<hash(sceneKey)>`；`writeEntities`/`writePageSets`（含回滚/取消恢复）事务化；`changeSet.seq>1` 的 `04-PLAN`/`00-README` 明确以 `05-CHANGES.md` 增量范围为准（seq=1 不出现）。新增 `backend/src/design/id-collision.test.ts`（8 项）+ caveat 单测；后端 131 测试（基线 122）、`smoke:design`/`design-handoff`/`change-set`/`handoff-input`/`requirements`、前端 69 测试/typecheck/build/check:vue 通过；见 `docs/STATUS.md`「设计 ID 跨应用冲突修复完成」与 `docs/plans/2026-11-12-design-id-collision-fix-brief.md` §7。

**P2 设计默认页面集主实体匹配修复已完成并评审（2026-11-12）**：`deriveRequirementScenes` 的 PRD/Epic 分支改用 `entitySceneMatch` 分量 + **严格字典序**排序（`storyHits` → `epicHit` → `sceneHit` → `textScore`（title×10 + text）→ 实体顺序）；不再用加权和，Story 引用必然优先、不受实体名长度影响；无引用时退化为旧文本逻辑；真实错位（EPIC-001「图书档案管理」→「借阅记录」）纠正为「书目」。新增 `backend/src/design/scene-entity-matching.test.ts`（5 项，含 32 字符长名称 + 文本分 >1000 的回归）；后端 136 测试（基线 131）、5 支冒烟、前端 69 测试/typecheck/build/check:vue 通过；见 `docs/STATUS.md`「页面集主实体匹配修复完成」与 `docs/plans/2026-11-12-design-scene-entity-matching-fix-brief.md` §6。

**2026-11-13 #6 M2 已完成并评审（数据底座 + 默认模块迁移 + 模块 API）**：新增 `app_modules`、`app_requirement_bundles`；需求 docs/sections/versions 加 `module_id`（SQLite 单事务重建，旧表保留 `*_legacy`，新索引 `idx_req_*`）；迁移幂等 + fail-closed + **迁移前自动 `VACUUM INTO` 备份**（MF1）；需求全部接口尾部可选 `moduleId`（缺省=默认模块，未知 404，归档读允许写 409）；新增 `/api/apps/:id/requirements-modules` 与 `/requirements-bundle`（只读聚合 + confirm）；单模块确认保持旧行为，多模块只确认本模块、由 bundle confirm 推进；`SCENE/EPIC/STORY` 全应用唯一（`global` 限本模块 + `reservedIds` 只做占用）；新增 `db-guards`（测试进程未设 `RG_DATA_DIR` 直接抛错）、`migrate:modules`、`smoke:modules`。**事故与处置**：既有 `chat/service.test.ts` 未隔离数据目录，M2 首次 `npm test` 于 07:20Z 对真实库执行了迁移（未先停写/备份）；已修测试隔离 + 加硬保护，逐行比对确认无数据丢失，用户决定接受已迁移状态；主会话随后 `stop.cmd` → `VACUUM INTO` 备份（仓库外 + `data/*.bak`）→ 新 dist 重启 → app1 需求/版本/确认/设计/交接包/变更单/会话逐项验收通过（`integrity_check=ok`、`*_legacy` 保留、bundle v1 无漂移）。最终**后端 178 测试、前端 96 测试**、5 支冒烟 + typecheck/build/check:vue 通过。详见 `docs/STATUS.md`「M2 完成」与 `docs/plans/2026-11-13-module-m2-implementation-brief.md` §8/§8.11。

当前基线：**后端 328 测试、前端 172 测试**；真实库有用户应用（未经同意勿读写；模板保留；app1 已按“不做旧数据兼容”政策删除），需求/设计/变更单/开发阶段均已模块化。U7（分阶段开发）方案已定稿（`docs/plans/2026-11-12-u7-phased-development-design.md`）；U7-1/2/3 已完成并评审（`docs/plans/2026-11-12-u7-*-brief.md` §8）。模块化需求 + 设计（#6）设计稿已定稿；**M2—M6 已完成并评审**。**真实模型全链路 E2E 已通过（2026-11-16）**：真实 opencode + `packycode-deepseek/deepseek-flash`，2 模块 / 17 Story / 7 实体 / 30 页面 / large 交接包 / 2 模块阶段 + 6 Epic / 单模块变更 v2（A changed、B unchanged），31/31 断言、约 191s；临时应用已删除（apps=0）。**RMP-1（需求首次模块规划 + 逐模块生成）已完成并复评（2026-11-16）**：`mode='doc-plan'`/`<<<MODULE_PLAN_JSON>>>`、可编辑建议卡、复用空默认模块、逐模块 SSE 生成/重试/取消/保持单模块、刷新恢复、生成中禁用 Composer；主会话 must-fix MF1—MF7 已修；真实模型 E2E 通过（用户样例 → 商品管理/订单管理 + order→product；两文档 13/13 节、draft v2、无支付模块，8/8 断言；临时应用已删除）。见 `docs/STATUS.md`「RMP-1 完成」与 `docs/plans/2026-11-16-rmp1-implementation-brief.md`。**RMP-2（随时 AI 重新规划模块）已完成并复评（2026-11-16）**：需求文档头部「AI 规划模块」、全部需求聚合预览、keep/rename/regenerate/create、未匹配归档、confirmed 重开、生成 `reason='replan'`、旧建议卡 `planKind` 门禁；主会话 must-fix MF-RMP2-1—4 已修；真实模型 E2E 通过（RMP-1 seed 商品/订单 → 商品 keep v2、订单 v3、售后重试 v2 13/13、3 模块）。**D-RMP（设计阶段模块树 + 按 Epic 生成）已完成并复评（2026-11-16）**：删除 `DesignModuleRail`，设计大纲树（模块根/数据集共享实体/Epics/页面集/未归属）；`POST /design/generate-epic` 每 Epic 生成实体（合并共享池）+ 页面集 primary（页面按 Story），每 Epic 一个版本，draft；批量/单 Epic 进度/重试/停止；confirmed 显式重开；整模块生成兜底。主会话 must-fix MF-DRMP-1—5 已修；真实模型 E2E 通过（商品 2 Epic → 2 实体/2 页面集/8 页 v3；订单 1 Epic → 2 实体/1 页面集/5 页 v2；15/15）。**真实 3300 已于 2026-11-17 08:55 由用户重建 dist 并重启**（实测监听中，dist 含 `/design/generate-epic`、`/requirements-modules/replan/*`、`/requirements-modules/plan/apply`；用户已跑通新设计阶段全流程，自述无问题），不要再按旧提示要求重启。用户可重新跑需求→设计全程。**M7（#8 需求阶段原型预览）已完成并评审（2026-11-17）**：需求大纲树每模块末尾「原型预览」节点 + Epic/Story 确定性派生 + 模板解析（`GET /api/apps/:id/requirements-prototype`，零写库/零 PNG）；**M7-2（AI 参考原型）已完成并评审（2026-11-17，替换纯骨架）**：`POST /requirements-prototype/spec` 由需求阶段 agent 从模块 PRD 生成实体/字段/页面规格（唯一写入 `app_settings` 单键），前端用设计阶段 `PrototypeRenderer` + `mockRows` 渲染真实字段，显式生成/重生成/过期提示/失败重试；明确**不进入设计阶段/交接包**。后端 295/295、前端 165/165、主会话独立 Playwright 72（含 1 项故意 502 预期偏差）。真实 3300 进程仍是 M7-2 之前的代码，需用户确认后重启才能用新端点/新前端；M7-2 真实模型质量已验证（2026-11-17，app1 商品管理 PRD 副本：15.3s / 2 实体 25 字段 / 6 页面 / Story 8/8，notes 含文档矛盾）；**已在 app1 真实生成成功**（首次一次偶发解析失败，重试成功）：MOD-001 2 实体/24 字段/6 页面/8/8，MOD-002 2 实体/13 字段/4 页面/5/5；**M7-2b 健壮性修复已完成并评审（2026-11-17）**：提示词只输出 JSON；解析容错（BOM/围栏/尾逗号/字符串内裸换行/全角引号/平衡候选从后往前/**未闭合残片 + 完整 JSON**）；失败自动重试一次（499/模型抛错不重试）；502 带 `detail`（脱敏 300 字）+ 前端可展开「模型输出片段」；后端 310/310、前端 167/167、主会话对抗性解析 13/13。真实 3300 已于 2026-11-17 11:14 由用户重启，**M7-2b 已生效**（app1 两模块 `specState=ready`）；用户正在跑全流程。**G1（需求聊天模块意图守卫 + 未知模块引用告警）已完成并评审（2026-11-17）**：聊天识别"新增/删除/改名/拆分/合并 模块"→ 不调模型/不产版本、返回指引卡（新增模块/AI 规划模块/重新编辑需求/发起变更）；Prompt 硬化（只改当前模块、不写 `MOD-xxx`）；保存/确认对"引用不存在的模块"给非阻塞 warning + 页面告警条；后端 328/328、前端 172/172、主会话 17 条意图 + HTTP/SSE 守卫通过。真实 3300 仍是 G1 之前的内存代码，需用户确认后重启生效；app1 的 v9—v12 污染内容待用户按方案 A 恢复。接续单：`docs/plans/2026-11-17-main-review-handoff.md`（最新主会话/评审交接）。

**2026-11-13 #6 M3 已完成并评审（需求模块 UI + 应用级模板切换 + 按模块对话历史）**：需求页改为“模块 rail + 当前模块完整 PRD + 顶部总览”：模块新增（**仅需求阶段**；设计阶段先“重新编辑需求”，开发走 Change Set）/编辑/负责人/必选/上移下移/归档恢复/切换、每模块独立文档/版本/确认、总览进度与 bundle 版本、“完成需求阶段”（bundle confirm 后才进入设计，多模块单个确认不推进）。应用级需求模板切换：`POST /requirements-doc/template/preview`（只读逐模块影响）+ `PUT /template {scope:'app'}`（全部未归档模块各产 `template-change` 版本；任一模块已确认 → 409 + 模块列表；归档不参与；同模板但有离散模块时可“对齐全部模块”，全一致时不重复应用）；前端切换前先 flush，避免未保存输入丢失。按模块 chat 历史：key `app.<id>.requirementsDocChat.<moduleId>`，旧应用级 key 仅默认模块只读回退、不删不改；未知 moduleId → 404。新增 `PUT /requirements-modules/order`；AI 建议/版本/回滚/导出/chat 全部带 moduleId；响应式 1024/768 三抽屉互斥 + 深浅色。**主会话评审**：must-fix 3 项（模板切换前 flush、chat 未知模块 404、同模板对齐漏洞）已修并复验；后端 **187/187**、前端 **107/107**、5 支冒烟、typecheck/build/check:vue 通过；主会话另有 2 套独立 Playwright（主路径 + must-fix 回归）全过、0 console/API 错误。详见 `docs/STATUS.md`「M3 完成」与 `docs/plans/2026-11-13-module-m3-implementation-brief.md` §8/§8.9。

**2026-11-13 #6 M4 已完成并评审（设计表/设计 UI 模块化，无旧数据迁移）**：设计六表按模块（`app_design_projects` PK `(app_id,module_id)`；entities/page_sets/pages/versions/inputs 加 `module_id`）；启动升级 `design/module-migration.ts`：目标 no-op / 旧结构+0 应用→重建空表 / 旧结构+有数据→**fail-closed**（不建 legacy、不回填）。设计接口全部可选 `moduleId`（缺省默认模块、未知 404、归档读允许写 409），项目/实体/页面集/页面/版本/确认/reopen/输入 stale/覆盖度/chat 严格按模块；需求 reopen 只影响同模块设计。跨模块实体关系/页面 entityId 允许 + warning 不阻塞，页面集禁止跨模块写入。应用级原型模板切换有 preview + `scope='app'`（任一已确认→409）；多模块 `handoff/preview|generate` 与 Change Set 起始 409（M6/M5）；`appPayload.designModules` 只读摘要。设计 UI：模块 rail/切换前 flush/模块级确认/设计总览/模板切换/跨模块实体选择/1024·768 抽屉/深浅色。**评审**：must-fix 未新增（独立复核 204/204、114/114、5 支冒烟、自有 25 项 Playwright、真实库副本空库升级与 fail-closed 实测、3300 重启升级完成）。详见 `docs/STATUS.md`「M4 完成」与 `docs/plans/2026-11-13-module-m4-implementation-brief.md` §10。

**2026-11-16 #6 M5 已完成并评审（Change Set 模块选择 + 设计输入 v2 + 覆盖度）**：新表 `app_change_set_modules`（无迁移）；`POST /change-sets` 支持 `moduleIds`（默认全选、非空/无重复/未归档），只重开选中模块需求+设计，未选模块版本/确认/输入/session 逐行不动；编辑门禁（未选写 409、应用级模板整体切换范围不完整 409、变更中禁止归档、非需求阶段模块管理 409）；取消按模块恢复需求/设计/模板/输入并在**同一事务**重生成需求 bundle；变更中新增模块自动入范围（base=null），取消时自动归档且内容保留；`ChangeSetView.modules` 版本/hash/模板历史；设计输入 v2（bundleVersion/bundleHash，stale 仍只按模块 docHash，`bundleDrift` 仅提示）；只读 `GET /design/overview`（模块覆盖率/未覆盖 Story/缺图/汇总/bundle）；前端发起变更模块多选、范围条/未选只读、历史模块行、取消归档文案。**主会话评审**：must-fix 1 项（取消含“变更中新增模块”原会 409 卡死，改为自动归档）已修并复验；最终后端 **215/215**、前端 **120/120**、5 支冒烟、自有 28+11 项 Playwright/API 断言通过；已知观察：发起变更瞬间 DevView 在途轮询有 1—2 次 `409 GET /development` 控制台资源错误（M4 起既有竞态，非 M5 接口）。详见 `docs/STATUS.md`「M5 完成」与 `docs/plans/2026-11-16-module-m5-implementation-brief.md` §10。

**2026-11-16 #6 M6 已完成并评审（应用级交接包模块化 + U7 模块/Epic 两层阶段）**：交接包内部按模块（`DesignHandoffBundle.modules` + 聚合兼容）；00—05/manifest 按模块（`requirementsBundle/designModules/modules/totals/scale`），原型 `prototypes/<MOD-KEY>/<ps-XXX>/page-XXX.png`；校验全部必选模块 confirmed/非 stale/PNG 齐全，跨模块 FK/表名重复/模板不一致仅 warning；#1 交接包同时写 `app_change_set_modules` 模块行，#2+ 按选中模块 diff、未选“未变更”；读/预览/摘要带 modules。U7 两层：多模块 `base → module:<KEY> → epic:<EPIC-ID> → other:<KEY>`，`app_dev_phases` 加 `module_id/parent_key/phase_kind`（ensureColumn 无回填），模块阶段只分组/里程碑（start/complete/skip 409、不建会话/不调摘要），Epic 阶段绑会话/摘要，视图/会话带 kind/module/parentKey，PhaseBar/PhaseDialog 按模块分组；单模块保持原平铺零回归。**评审**：must-fix 2 项（#1 Change Set 模块行、阶段视图 parentKey）已修并复验；最终后端 **224/224**、前端 **121/121**、5 支冒烟 + `smoke:dev-phases`、自有 M6a 31 项 + M6b 20 项 Playwright/API 断言通过。详见 `docs/STATUS.md`「M6a 完成」「M6b 完成」与 `docs/plans/2026-11-16-module-m6-implementation-brief.md`。

**2026-11-13 政策：开发前期不做旧应用数据兼容（用户确认）**：工作台尚未定版，**大框架调整默认删除旧应用、不做数据迁移/兼容**；只有用户明确要求兼容旧数据时才做迁移。据此已删除真实 `app1`（先停 app1 后端 8081/前端 5173 进程 → 备份 `projects/app1` 到仓库外 → `DELETE /api/apps/app1?confirm=true` → 清理 `data/requirements.db` 的三张 `*_legacy` 表），随后按用户要求删除该备份及所有 app1 临时截图/检查脚本（无 app1 数据残留）。当时真实库 `apps=0`，所有 app 级表为 0，模板保留（需求 4 / 原型 2），`integrity_check=ok`（2026-11-16 现状：用户已新建应用，未经同意勿动）。后续旧库升级只面向“无应用数据”的库；有应用数据时 fail-closed 提示删除应用/重置，不写迁移兼容。真实模型全链路 E2E 已通过，用户可新建应用跑全程。

**2026-11-12 真实模型 E2E 通过（临时数据）**：`packycode-deepseek/deepseek-flash` + 真实 opencode 2.2.5；需求 5 场景/5 Epic/15 Story、实体 10、页面集 5/页面 20、交接包 **large**（stories/pages/textBytes 三阈值全命中，6 阶段）、开发会话 v1；0 console/API 错误。观察：确定性页面集主实体匹配偏差（P2）已于 2026-11-12 修复并加测（见上）；旧页面集需重新生成。

后续（不阻塞已交付链路）：
- I-09b-1（U6，✅ 2026-11-12 完成并评审）：交接包规模阈值（Story ≥10 / 页面 ≥12 / 文本 ≥100KB）、`manifest.scale`、`04-PLAN` 建议分阶段、README/弹窗/开发页提示；preview/generate 同一套、preview 不写盘、旧 manifest 无 scale → null；不建表、不做阶段会话、不调模型。交接单 `docs/plans/2026-11-12-i09b1-implementation-brief.md` §8；验证见 `docs/STATUS.md`「I-09b-1 完成」。
- I-09b-2（U7，U7-1 后端 ✅ 2026-11-12 完成并评审，含摘要脱敏与只读 agent 安全修复；U7-2 前端 ✅ 2026-11-12 完成并评审，含并发刷新修复；U7-3 真实模型全链路 ✅ 2026-11-12 验证通过）：Epic 派生阶段 + `app_dev_phases` + 一阶段一会话/phase brief + 模型摘要/fallback（真实 model + fallback 均已实证；只读 design/req + `scrubText`）；`manifest.phases` + 阶段 API + 会话 phase 字段；前端按阶段开发入口/阶段条/弹窗/完成-跳过-重新打开/会话 chip/只读 + 响应式；`smoke:dev-phases`（真实 opencode，不调模型）。交接单 `docs/plans/2026-11-12-u7-1-implementation-brief.md` §8、`docs/plans/2026-11-12-u7-2-implementation-brief.md` §8、`docs/plans/2026-11-12-u7-3-real-model-e2e-brief.md` §8；验证见 `docs/STATUS.md`「U7-1 完成」「U7-2 完成」「U7-3 真实模型全链路验证」。
- P1 设计 ID 跨应用冲突 + U6 变更单 caveat（✅ 2026-11-12 完成并评审）：ID 全局唯一兜底（已有保留/raw 仅全局未占用/否则生成）+ 每次确定 ID 后无条件登记 used（重复 raw id 换新）+ 默认页面集去 hash + 写盘事务化；`04-PLAN`/`00-README` 变更 #2+ caveat；未改表/API/数据；后端 131 测试、5 支冒烟、前端 69 测试回归；见 `docs/plans/2026-11-12-design-id-collision-fix-brief.md` §7。
- P2 设计默认页面集主实体匹配（✅ 2026-11-12 完成并评审）：`entitySceneMatch` 分量 + 严格字典序（Story→Epic→Scene 引用→文本分，稳定排序），Story 引用必然优先；无引用零回归、与旧文本逻辑一致；真实错位纠正；真实数据回放通过（不调模型：EPIC-001 书目 / EPIC-005 罚款单）；未改 AI 页面集/UI/API/DB，不迁移已生成页面集（需重新生成）；后端 136 测试、5 支冒烟、前端 69 测试回归；见 `docs/plans/2026-11-12-design-scene-entity-matching-fix-brief.md` §6。
- MySQL demo 行（2+2 条）由用户按 `docs/ops/cleanup-demo.sql` 自行执行清理；备份 zip `r4b2-backup-20261111-155329/projects.zip` 含应用配置，用后删除。
- 真实模型需求/设计聊天重跑并重新生成交接包（P5 交付使用的是人工确认 Spec；旧应用目录已删除，如需复跑需新建应用）。
- 视环境补齐 Nacos/Redis/团队 license，验证完整 EOS 运行态。
- 接入真实登录/角色权限，验证 401/403。
- 视觉后续（非阻塞）：<768 移动端、真实长会话滚动/对比度复测、`el-table` 深色实机再确认。
- `legacy/`（R4a）、前端 structured UI（R4b-1）、后端 structured 兼容（R4b-2）、未用依赖（R4c）均已清理。
- 使用 opencode 原生 `build` agent；不做自定义 dev agent/skill/固定骨架/批次/证据/Git 门禁。

环境已核验：Node 20.20.1 / npm 10.8.2 / Java 17.0.18 / Maven 3.9.14 / opencode 2.2.5；`backend`/`frontend` 依赖已安装（backend 的 `better-sqlite3` 用 npmmirror 预编译包补齐，见 `docs/STATUS.md`）；EOS 模板 offline `mvn dependency:resolve` + `compile` 通过，运行态（Nacos/MySQL/Redis/license）未验证。真实模型测试使用 `packycode-deepseek/deepseek-flash`；opencode 默认免费模型可能限额。

旧项目 `E:\work_space_primeton\primeton-agent-capabilities` 已冻结，只读参考；新成果只落本目录。

## 已明确方向

- 需求阶段是“对话 + 模板化 Markdown 文档 + Scene/Epic/Story”；设计阶段是“实体设计 + 页面原型（线框）”；requirements-grooming 只作为代码来源，其旧 structured UI（R4b-1）与后端 structured 兼容（R4b-2）均已删除。开发阶段重新写。
- 用户先创建应用；一个应用一个独立目录；顶部三段渐进：需求 → 设计 → 开发；前一阶段用户确认后才能进入下一阶段。
- 需求/设计/开发统一使用 opencode 作为模型运行时；不保留第二套 OpenAI 兼容 LLM 配置。
- 需求/设计聊天：短暂 opencode 会话 + prompt + SSE；协议分隔符为 `<<<DOC_JSON>>>`（需求文档）与 `<<<DESIGN_JSON>>>`（设计），旧的 `<<<SPEC_JSON>>>` structured 协议已随 R4b-1 删除。
- 设计完成：确定性生成开发交接包（`00-README.md`、`01-REQUIREMENTS.md`、`02-DATA-MODEL.md`、`03-PAGES.md`、`04-PLAN.md`、`05-CHANGES.md`、参考 DDL `schema.sql`、`prototype-template.json`、`manifest.json`、`prototypes/`；OpenAPI 暂无确定性契约）。
- 开发：opencode 原生 `build` agent + 原生会话；不做自定义 dev agent、skill、固定骨架、批次、证据、Git 强制流程、测试门禁。
- 应用后端参考 `templates/eos-app`（EOS 9.0.0，`src/` 结构，eos-pom parent，最小依赖）；前端只告知 Vue3，不强制结构。
- 开发界面参考 Codex App / opencode-web 的个人 vibe coding 体验；不复用旧工作台三栏 UI。

## 工程边界

- 不要提交真实凭据；`templates/eos-app` 已脱敏，`projects/`、`data/`、`.env` 已在 `.gitignore` 中忽略。
- 工作台自身只读写 SQLite，**不连接/不启动 MySQL**；P5 demo 行的清理 SQL 在 `docs/ops/cleanup-demo.sql`，由用户自行执行；备份 zip `r4b2-backup-20261111-155329/projects.zip` 含应用配置，用后删除、不要解压/打印/提交。
- 安装依赖用 `npm run install:all`（内部进入 backend/frontend 目录执行 `npm install`）；不要用 `npm install --prefix backend|frontend`——本机 npm 10.8.2 会把仓库根包写成该子包的 `file:..` 依赖。
- 应用创建表单里填写的 EOS sys-key、DB/邮件信息只用于渲染 `projects/<app-id>/` 配置文件，**不写入工作台数据库**；未填写的写为 `CHANGE_ME`。
- 不要修改 `templates/eos-app/src/META-INF/_srv/primetonlicense.xml` 为个人 license；正式环境替换为团队 license。
- 内部 Maven 仓库、EOS 制品、Nacos/MySQL/Redis 是外部前提；未验证前不宣称可构建/可运行。
- 旧开发模块（`backend/src/dev/codegen.ts`、`runner.ts`、`agents/harness.ts`、`agents/opencode.ts` 与旧前端 `ui/dev/`）已删除（`legacy/` R4a、前端 structured UI R4b-1）；不要在 `backend/src/dev` 上加批次/证据/Git 逻辑。
- 旧 `workbench-stub` 只读参考；不复用批次/证据/Git 面板。

## 工作方式

- 设计未确认前不改核心实现；先更新设计稿/任务拆分，再动代码。
- 行为变更先补有价值的测试；真实 opencode/真实模型/EOS 构建验证与静态检查分开记录。
- 完成后更新设计稿或 `docs/STATUS.md`（如建立），写明验证命令、结果、未验证项。
