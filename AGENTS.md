# AI Dev Workbench 工作约定

## 项目

三阶段智能开发工作台：**需求 → 设计 → 开发**。Agent-First 重写已完成 **P1—P6-4**（2026-11-19，已评审）；**P7-1～P7-6c + P7-4b + P8-1 + P8-2 + P9 + P10 + P10b + P11 + P12 + P7-7a + P7-7b-1 + P7-7b-2a + P7-7b-2b + P7-7c-1 + P7-7c-2 已实施（待评审）**，P7-7 全部分批已完成首轮实施并跑通真实模型闭环（临时 3487/4787）；真实 3300/4771 人工验收仍由用户执行。**第一阶段功能收尾（2026-11-20），进入细化/优化/打磨**；用户已跑通主流程（不等于“全部评审通过”）。

## 开始工作前先读

1. `docs/plans/2026-11-18-agent-first-workbench-design.md`（**唯一有效设计**）
2. `docs/plans/2026-11-18-agent-first-workbench-p6-design.md`（P6：聊天/模板即 skill/设计参考包）
3. `docs/plans/2026-11-19-design-template-and-dev-linkage-p7-design.md`（P7：设计模板/页面契约/开发关联；第 14—31 节为实施记录，第 26 节 P8-1、第 27 节 P8-2、第 28 节 P9、第 29 节 P10、第 30 节 P10b、第 31 节 P11）
4. `docs/plans/2026-11-21-p7-7-custom-design-template-agent-design.md`（P7-7：自定义设计模板/模板工作室；§9/§11/§13.3/§14.2/§15.2 与文末 P7-7a/b-1/b-2a/b-2b/c-1/c-2 实施记录）
5. `docs/STATUS.md`（当前状态与接续）
6. `docs/plans/2026-11-20-phase1-handover-and-next-session-prompt.md`（最近一期交接单：第一阶段收尾 + 新会话话术；P1—P12 在同目录）
7. `docs/plans/evidence/2026-11-19-p7-6b/`、`docs/plans/evidence/2026-11-20-p7-6b-rerun/`、`docs/plans/evidence/2026-11-21-p7-7-real-model/`（真实模型证据与数字口径）
8. `README.md`、`templates/eos-app/README.md`、`templates/afc-remote/README.md`
9. `docs/ops/switch-to-agent-first.md`（真实实例切换，只写步骤）

`docs/plans/README.md` 说明了哪些文档有效；历史设计稿已删除，需要时从 GitHub 历史恢复。

## 当前方向（必须遵守）

- **工作台 = 共享工作区 + 模板 + 会话 + 产物视图 + 执行过程**。agent 根据用户目标自主检索材料、判断范围、修改产物并检查结果。
- 需求/设计/开发是**视图**，不是门禁；没有确认、版本、变更单、交接包、覆盖度、stale、阶段锁定。
- **产物是文件（单一事实源）**：`docs/requirements/requirements.md`（单文档）、`docs/design/entities.json`、`docs/design/pages.json`、`docs/design/design-system.json`、`design-brief.md`、`tokens.json`、`prototypes/*.png`、`ui-check.md`、代码、截图。DB 只存应用、设置、会话、需求模板（**4 表**：`apps`、`app_settings`、`app_sessions`、`requirement_templates`；旧原型模板表/列已删除，P8-1）。
- 需求是**单文档**（无模块文件/目录）：frontmatter 只 `title`/`template`；Epic `EP-001`、Story `US-001` 稳定 ID；新建应用按需求模板纯渲染骨架（不调模型、已存在不覆盖）。需求文档 **h2/h3 标题显示「问 AI」**（DOM 后处理注入，不改共享 `MarkdownView`）：点击填入默认提问（只填不发）+ 对话区可移除「定位章节」chip，发送时携带**隐藏章节上下文**（`requirements-section`：anchor/title/level/key，后端 `buildViewPrompt` 仅在 requirements 视图注入在「用户消息：」之前）；切换/新建会话后清空。
- 需求与设计必须一致，由 **agent** 负责同步；工作台不做同步引擎。
- 设计产物：`docs/design/entities.json`（全局实体/关系；字段 `code` 英文 + `name` 中文 + `type`，enum `options:[{value,label}]`，ref 写 `ref`）、`docs/design/pages.json`（页面集 = Epic + 页面契约；字段引用一律用 `code`；不写 `actions`，由 `rowActions/toolbarActions` 派生）；接口文档 `docs/design/api-design.md`（固定模板：索引/覆盖矩阵/详情/错误码/权限；索引与详情含 `操作`）。
- **接口设计（D2）**：`docs/design/api-design.md` 固定 Markdown 模板 + 规范/示例 + 共享校验 core（`templates/agent/skills/adw-api-design/`：`SKILL.md`/`references/*`/`scripts/lib/api-design-core.cjs`/`scripts/validate-api-design.mjs`）+ command `generate-api-design`；覆盖矩阵校验页面动作（`rowActions/toolbarActions`，form 补 `submit`）与实体 CRUD（按 `操作`）；设计视图第三 Tab「接口设计」渲染/校验/覆盖/「让 AI 修」（**B7 起一键填入并发送**，面板显示「正在修复」/「修复完成：警告 6 → 2」等状态；其它视图问题条仍只填 Composer）；digest 接口摘要、ui-check「接口对照」表、fidelity 第 14 项 `api-design`；只做文档，不生成后端代码/OpenAPI。
- **去模块命名（D3）**：应用无 module/模块下拉/`requirements-modules` 路由；前端 testid 用 `requirements-chat-split`、`design-pageset-tabs`/`design-pageset-<id>`、`generate-requirements-btn`；`view-commands` 命令参数不含 module；历史 `ui*-shots` 已更新到单文档 + entities/pages + 新 testid。
- **布局与接口生成（O1—O4 / B2—B4）**：需求 = 左 AI 对话（可拖拽，默认 380/min 300，文档 ≥520）+ 右文档，**无左侧章节大纲**（文档自带 `doc-toc`）；设计 = 左对话 + 右主区（实体关系/页面集/接口三 Tab，无中栏）；页面集 Tab 内两级 Tabs（页面集 + 页面；首项「总览」）；**ER 只按搜索过滤（无页面集 chips），默认不选中实体/不显示字段卡片、画布占满主区；点实体在画布右上角浮层 inspector（`entity-inspector`，可收起为胶囊 `entity-inspector-pill`，点空白/Esc 收起、关闭清除），缩放控件移到画布右下角悬浮、图例折叠为「图例」，首次进入若图超可视区自动适应窗口一次；Ctrl/⌘+滚轮或触摸板捏合缩放（光标锚点）+ −/百分比/+/适应窗口，普通滚轮只滚动**；**总览为在线画布**（点阵 + 1440×900 artboard + 缩放/平移/适应窗口，不做自由拖拽/位置持久化），**导出仍 2 列拼图**（`composeOverviewPng`/`overviewLayout`）且先下载、不写 prototypes；≤1024 仅对话左抽屉，Esc 关闭；分隔条 `role=separator`，宽度 localStorage、双击复位、键盘 ←/→；`generate-design` 同轮生成 entities/pages/api-design，`generate-api-design` 仅补/更新接口。
- **设计模板** = 应用类型 × 视觉风格 + 页面库：内置 pack `templates/design-system/afcenter-app-templates-v1/`（4 类型 × 4 风格 × 25 页）；`preview.html?type=&style=&page=` 预览；设计模板中心/新建应用 picker/设计视图徽标与「模板页面库」；**自定义设计模板（P7-7）**：模板工作室 `#/studio/<packId>`（`StudioView`：页面/spec 校验 + `AgentChatPanel` 工作室 API + 草稿预览 + 生成/发布/丢弃）、模板中心「自定义」分类（新建/编辑/预览/删除；已发布无草稿可反写）与模板预览入口 `template-preview.html?draft=|pack=&page=&embed=1`（reference 复用 `preview.html` iframe，contract 用 synthetic design 原生渲染；不写 PNG），`preview.html` 额外支持 `structurePack/structureDraft` 覆盖合并后的结构样式（无参数行为不变）；**设计视图「原型」Tab 用所选模板（应用类型 structure + 视觉风格）原生渲染 `pages.json` 该页**（`design-preview.html?...&embed=1`，覆盖 **list/tree-list/page-form/dialog-form/detail/dashboard/main-sub/wizard**，未知配方按 `page.type` 映射到通用模板页）；**设计视图只展示设计产物，不再提供「模板风格/线框」切换**；**无任何显式契约的旧设计自动显示「结构草图（无契约）」并提示补齐契约**；调试入口仅 URL `?prototype=wireframe`（内部/测试用，UI 不可见）；**P7-7c-1 应用闭环**：新建应用 picker 列**已发布**自定义 pack（草稿不列）；scaffold 生成 `design-system.json` 的 `origin/preview/pages[].kind/source/contractFile`、reference 蓝图与 `contracts/<page>.json`（contract 页不写 `.vue`）、合并 `structure.css` + 风格 + 设计模板 skill；设计视图用应用内资产接口 `GET /api/apps/:id/design-system/asset` 加载自定义 structure（base 短类 + 内置风格）；开发 digest/ui-check/fidelity（**14 项**，含 `template-contract`/`api-design`）识别契约页；**P7-7c-2 真实模型闭环**（临时 3487/4787 + 真实 opencode 2.2.5 + `deepseek-flash`）：工作室 agent 写 spec（reference+contract）→ 自行生成/校验 → 发布 → 应用 → 设计预览/PNG → fidelity **0 fail**，真实 `shell` 越权被拒、catalog/.opencode/仓库/应用无越界；**设计阶段只有一个入口（没有旧版设计模板/legacy）**；需求模板中心（`TemplateLibraryDialog`、`requirement_templates`、`adw-template-req-*`）保持不变。
- **页面契约**：`pages.json` 页面集（=`epic`）+ 页面 `recipe/catalogRef/blueprint/filters/rowActions/toolbarActions/selection/pagination/form/tree/subTables/components/actionTargets`；全部可选，新字段/枚举问题只 warning、不阻断；线框渲染器（P7-4b）与模板风格渲染器（P9）都消费这些字段：列/查询/操作/选择/分页/树/表单分组/控件映射均来自契约，缺失列/字段跳过并提示；字段引用用 `entities.json` 的 `code`。**动作目标 `actionTargets`（B6）**：动作码 → 同页面集目标页面 id（显式优先）；`create/edit` 目标用 `dialog-form/page-form/main-sub/wizard`（`main-sub` 是合法表单目标），`detail` 只做详情、不作为 create/edit 目标；无效/跨页面集目标只 warning 并回退启发式；无表单页时交互预览打开**临时表单**（标注「临时表单 · 未设计表单页」+ 原因/候选，不写文件、不伪造正式页）。
- **设计 → 开发关联**：新应用前端是独立 MF remote（`templates/afc-remote`：webpack + Module Federation，暴露 `./index`）+ PageTemplates + GlobalPreference；工作区生成 `docs/design/design-system.json`、`docs/design/template/<type>/{pages,contracts,structure.css,assets}`、`docs/design/template/styles/{shared.css,<styleId>/style.css}`；分发团队 skill（`afcenter-page-generation`、`pm-components-usage`）与设计模板 skill `adw-template-proto-<applicationType>`。
- **开发约束**：开发 prompt + 应用 `AGENTS.md` + `adw-frontend-implementation` skill + design digest（约 6KB，应用级按 Epic/页面集摘要）+ `docs/design/ui-check.md` 软门禁（缺失生成、不覆盖、状态只读）+ 开发视图「设计参考」；优先级：需求 > design-system/pages.json 契约 > entities.json / api-design.md > 蓝图（布局/组件） > brief/tokens > PNG（模板风格截图；无显式契约的旧设计为线框）。
- **一致性检查**：`fidelity-core.cjs`（应用级 **14 项**；第 14 项 `api-design`：缺文件/覆盖缺口 warn，errors fail）+ CLI `check-fidelity.mjs` + command `check-design-fidelity` + `POST /api/apps/:id/design-fidelity` + 开发视图只读报告；只报告、不阻断；契约页跳过蓝图、校验 `contracts/<page>.json`；PNG 只校验 manifest/designHash，不做像素比对。
- **视觉事实**：蓝图页面 + `preview.html` 预览是模板视觉基准；设计视图「原型」只有**设计产物**——`pages.json` + `entities.json` 的模板风格原生渲染（`design-preview.html?app=&page=&type=&style=&embed=1&v=<designHash>`，结构/组件/视觉来自所选应用类型与风格）；**单页原型带「交互预览 · 不保存」层**（recipe 驱动：`dialog-form` 当前列表页弹表单；`page-form`/`wizard`/`detail` 通知父层切页面 Tab；`delete`/`batchDelete` 确认；无目标页提示「该页面集未设计新增/编辑页」，不伪造；不写数据/不调接口/切页或关闭后重置）；**结构草图（P7-4b 线框）只在无显式契约的旧设计自动出现（文案「结构草图（无契约）」）或调试 `?prototype=wireframe` 时出现，用户界面不提供切换**；**`prototypes/*.png` 是该模板页面的真实截图**（无显式契约的旧设计/截图失败用线框兜底），过期先说明；main-sub/wizard 走模板通用兜底（表单分组 + 子表页签 / `pm-steps` 分步），不再默认灰阶线框。
- 扩展能力：3 个方法 skill（`adw-requirements-document`、`adw-design-artifacts`、`adw-api-design`）+ 开发方法 skill `adw-frontend-implementation`（含 `check-fidelity.mjs`）+ 2 个团队 skill（`afcenter-page-generation`、`pm-components-usage`）+ 每个被选中模板一个 `adw-template-req-*` / `adw-template-proto-*` skill、6 个 command、应用级 `AGENTS.md`；模板库全局（DB），应用内自动分发/同步。
- **不做任何 git 操作**（init/commit/revert）；不设计文件丢失/回滚/并发/多实例兜底。
- 旧代码/旧测试/旧前端组件/旧冒烟在 P1 **一次性删除**，不留半套。

## 工作方式

- 主会话/评审会话**不直接改代码**；实施派**唯一**实施会话；同一时间只允许一个会话改文件。
- 设计未确认前不改核心实现；先更新设计稿/交接单，再动代码。
- 行为变更先补有价值的测试；真实 opencode/真实模型/EOS 构建验证与静态检查分开记录。
- **测试进程禁止隐式启动真实 serve**：`NODE_TEST_CONTEXT` 下默认端口 **4771** 会被 `assertSafeTestServePort` 拒绝（`ensureStarted/start` 均守卫）；单测必须 stub `opencode`，smoke/e2e 用独立 `OPENCODE_PORT`，确需真实 4771 的验收脚本显式 `RG_ALLOW_REAL_OPENCODE=1`。
- 完成后更新 `docs/STATUS.md` 与交接单的"实施结果"，写明命令、结果、偏差、未验证项。
- 不要把历史流水账写回 `AGENTS.md`；`AGENTS.md` 只保留**当前有效约定**。

## 工程边界

- 不要提交真实凭据；`projects/`、`data/`、`.env` 已在 `.gitignore` 中忽略。
- 安装依赖用 `npm run install:all`；**不要**用 `npm install --prefix backend|frontend`（本机 npm 会把仓库根包写成子包的 `file:..` 依赖）。
- 应用创建表单里的 EOS sys-key、DB/邮件信息只写 `projects/<app-id>/`，**不写入工作台数据库**；未填写的写为 `CHANGE_ME`。
- 不要修改 `templates/eos-app/src/META-INF/_srv/primetonlicense.xml` 为个人 license；正式环境替换为团队 license。
- 工作台自身只读写 SQLite，**不连接/不启动 MySQL**。
- 内部 Maven 仓库、EOS 制品、Nacos/MySQL/Redis 是外部前提；未验证前不宣称可构建/可运行。
- **真实 3300**：**2026-11-20 曾监听**（PID **40704** `node`（工作台后端）、**41744** `opencode serve`，启动 **16:15:08**）；**2026-11-21 只读核对已无 LISTEN、`/api/health` 连接失败、PID 不存在**；**2026-11-23 09:10 曾运行**（3300 PID **39828** `node dist/index.js` 启动 **09:10:41**；4771 PID **19608** `opencode serve` 2.2.5 启动 **09:10:42**），用户已确认真实 3300 人工验收**全部通过**（P7-7 评审仍待定；本条为最新口径，本文其它处“人工验收仍由用户执行”属历史表述）。**2026-11-23 14:00 左右只读核对（当时运行）**：3300 LISTEN PID **23668**（`node dist/index.js`，启动 **2026-11-23 13:32:38**）、4771 LISTEN PID **9092**（`opencode serve` 2.2.5，启动 **13:32:38**）；**2026-11-23 17:35 左右只读核对（当时运行）**：3300 LISTEN PID **19900**（`node dist/index.js`，启动 **2026-11-23 17:00:43**）、4771 LISTEN PID **13484**（`opencode serve` 2.2.5，启动 **17:00:43**），`GET /api/health` **200**（`ok:true`、`runtime.ready:true`、`pendingSessions:0`）；`backend/dist` **2026-11-23 17:31:07**、`frontend/dist` **2026-11-23 17:27:02**（O1—O3 构建）。**结束核对（2026-11-24 09:31）已无 3300/4771 LISTEN（用户停止，非本轮启停）**。**运行时（17:00 启动）的进程早于本轮构建，当时运行的是 O1—O3 之前的后端代码；前端 dist 已更新但新 UI 依赖新后端 API，不能只刷新，必须由用户执行 `restart.cmd`/`restart.sh` 后再验收**。历史：14:17（14988/27968）、14:00（23668/9092）、13:12（15992/19208）、09:10（39828/19608）等为旧口径。库为 4 表新结构，`apps>0` 正常；fail-closed 仅针对旧 5 表结构 + `apps>0`。**设计/实施不启停真实实例，后续由用户执行**（`restart.cmd` / `restart.sh` = stop → 构建前后端 → start → 健康检查；`start` 每次也会构建），按 `docs/ops/switch-to-agent-first.md` 操作，工作台不自动切换/回滚；以实际为准。**P7-7c-2 真实模型验证只在临时 3487/4787 运行并已停止（无监听），未启停 3300/4771。**
- **不做旧应用数据兼容**：旧库有应用数据时 fail-closed，提示删除应用或重置，不写迁移/legacy/回填。

## 环境

Node 20.20.1 / npm 10.8.2 / Java 17.0.18 / Maven 3.9.14 / opencode 2.2.5；真实模型 `packycode-deepseek/deepseek-flash`。

## 目录

```text
backend/            Express + SQLite（应用/模板/会话/产物解析/文件监听）
frontend/           Vue3 + Vite（需求/设计/开发三视图 + 模板工作室 `src/studio/`）
templates/eos-app/  脱敏 EOS 9.0.0 应用模板
templates/afc-remote/  AFCenter 子应用 MF remote 骨架（应用 frontend/ 起点）
templates/design-system/  内置设计模板包（应用类型/风格/页面蓝图）+ 共享 `component-controls.json`
templates/workshop/ 设计模板工作室资产源（skills/adw-design-template-authoring 的 SKILL.md/references + spec/css/generator + 薄 CLI、commands/generate-design-template.md；P7-7a/b-1/c-2 已落地）
templates/agent/    内置 skills / commands 源（分发到应用 .opencode/）
docs/plans/         当前有效设计与 P1—P12 交接单
docs/report/        汇报材料（md / 单文件 HTML / A4 PDF / 流程图与截图）
docs/ops/           运维清单（真实实例切换）
projects/           运行时应用工作区（gitignored）
data/               运行时 SQLite / 日志（gitignored）
```
