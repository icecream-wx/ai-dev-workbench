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
- **产物是文件（单一事实源）**：`docs/requirements/MOD-xxx-*.md`、`docs/design/<MOD>/design.json`、`docs/design/<MOD>/design-brief.md`、`tokens.json`、`prototypes/*.png`、代码、截图。DB 只存应用、设置、会话、需求模板（**4 表**：`apps`、`app_settings`、`app_sessions`、`requirement_templates`；旧原型模板表/列已删除，P8-1）。
- 模块 = 需求文档分组单位 + 大纲导航；每模块一个文件，frontmatter 记 `module/title/order/template`。
- 需求与设计必须一致，由 **agent** 负责同步；工作台不做同步引擎。
- 设计参考包：结构以 `design.json` 为准；`design-brief.md`/`tokens.json`/`prototypes/*.png` 供开发参考（tokens/PNG 只约束 Vue3 前端，EOS 后端不吃风格；`tokens.json`/manifest 用 `styleId`）；PNG 是**模板风格截图**（无显式契约的旧设计/截图失败为线框），过期先说明，不盲从。
- **设计模板** = 应用类型 × 视觉风格 + 页面库：内置 pack `templates/design-system/afcenter-app-templates-v1/`（4 类型 × 4 风格 × 25 页）；`preview.html?type=&style=&page=` 预览；设计模板中心/新建应用 picker/设计视图徽标与「模板页面库」；**自定义设计模板（P7-7）**：模板工作室 `#/studio/<packId>`（`StudioView`：页面/spec 校验 + `AgentChatPanel` 工作室 API + 草稿预览 + 生成/发布/丢弃）、模板中心「自定义」分类（新建/编辑/预览/删除；已发布无草稿可反写）与模板预览入口 `template-preview.html?draft=|pack=&page=&embed=1`（reference 复用 `preview.html` iframe，contract 用 synthetic design 原生渲染；不写 PNG），`preview.html` 额外支持 `structurePack/structureDraft` 覆盖合并后的结构样式（无参数行为不变）；**设计视图「原型」Tab 用所选模板（应用类型 structure + 视觉风格）原生渲染 `design.json` 该页**（`design-preview.html?...&embed=1`，覆盖 **list/tree-list/page-form/dialog-form/detail/dashboard/main-sub/wizard**，未知配方按 `page.type` 映射到通用模板页）；**设计视图只展示设计产物，不再提供「模板风格/线框」切换**；**无任何显式契约的旧设计自动显示「结构草图（无契约）」并提示补齐契约**；调试入口仅 URL `?prototype=wireframe`（内部/测试用，UI 不可见）；**P7-7c-1 应用闭环**：新建应用 picker 列**已发布**自定义 pack（草稿不列）；scaffold 生成 `design-system.json` 的 `origin/preview/pages[].kind/source/contractFile`、reference 蓝图与 `contracts/<page>.json`（contract 页不写 `.vue`）、合并 `structure.css` + 风格 + 设计模板 skill；设计视图用应用内资产接口 `GET /api/apps/:id/design-system/asset` 加载自定义 structure（base 短类 + 内置风格）；开发 digest/ui-check/fidelity（**13 项**，含 `template-contract`）识别契约页；**P7-7c-2 真实模型闭环**（临时 3487/4787 + 真实 opencode 2.2.5 + `deepseek-flash`）：工作室 agent 写 spec（reference+contract）→ 自行生成/校验 → 发布 → 应用 → 设计预览/PNG → fidelity **0 fail**，真实 `shell` 越权被拒、catalog/.opencode/仓库/应用无越界；**设计阶段只有一个入口（没有旧版设计模板/legacy）**；需求模板中心（`TemplateLibraryDialog`、`requirement_templates`、`adw-template-req-*`）保持不变。
- **页面契约**：`design.json` 顶层 `designSystem` + 页面 `recipe/catalogRef/blueprint/filters/rowActions/toolbarActions/selection/pagination/form/tree/subTables/components`；全部可选，旧 design.json 继续可读；新字段/枚举问题只 warning、不阻断；线框渲染器（P7-4b）与模板风格渲染器（P9）都消费这些字段：列/查询/操作/选择/分页/树/表单分组/控件映射均来自契约，缺失列/字段跳过并提示。
- **设计 → 开发关联**：新应用前端是独立 MF remote（`templates/afc-remote`：webpack + Module Federation，暴露 `./index`）+ PageTemplates + GlobalPreference；工作区生成 `docs/design/design-system.json`、`docs/design/template/<type>/{pages,contracts,structure.css,assets}`、`docs/design/template/styles/{shared.css,<styleId>/style.css}`；分发团队 skill（`afcenter-page-generation`、`pm-components-usage`）与设计模板 skill `adw-template-proto-<applicationType>`。
- **开发约束**：开发 prompt + 应用 `AGENTS.md` + `adw-frontend-implementation` skill + design digest（约 6KB）+ 模块上下文 + `docs/design/<MOD>/ui-check.md` 软门禁（缺失生成、不覆盖、状态只读）+ 开发视图「设计参考」；优先级：需求 > design-system/design.json 契约 > 蓝图（布局/组件） > brief/tokens > PNG（模板风格截图；无显式契约的旧设计为线框）。
- **一致性检查**：`fidelity-core.cjs`（13 项）+ CLI `check-fidelity.mjs` + command `check-design-fidelity` + `POST /api/apps/:id/design-fidelity` + 开发视图只读报告；只报告、不阻断；契约页跳过蓝图、校验 `contracts/<page>.json`；PNG 只校验 manifest/designHash，不做像素比对。
- **视觉事实**：蓝图页面 + `preview.html` 预览是模板视觉基准；设计视图「原型」只有**设计产物**——`design.json` 的模板风格原生渲染（`design-preview.html`，结构/组件/视觉来自所选应用类型与风格）；**结构草图（P7-4b 线框）只在无显式契约的旧设计自动出现（文案「结构草图（无契约）」）或调试 `?prototype=wireframe` 时出现，用户界面不提供切换**；**`prototypes/*.png` 是该模板页面的真实截图**（无显式契约的旧设计/截图失败用线框兜底），过期先说明；main-sub/wizard 走模板通用兜底（表单分组 + 子表页签 / `pm-steps` 分步），不再默认灰阶线框。
- 扩展能力：2 个方法 skill（`adw-requirements-document`、`adw-design-artifacts`）+ 开发方法 skill `adw-frontend-implementation`（含 `check-fidelity.mjs`）+ 2 个团队 skill（`afcenter-page-generation`、`pm-components-usage`）+ 每个被选中模板一个 `adw-template-req-*` / `adw-template-proto-*` skill、5 个 command、应用级 `AGENTS.md`；模板库全局（DB），应用内自动分发/同步。
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
- **真实 3300**：**2026-11-20 曾监听**（PID **40704** `node`（工作台后端）、**41744** `opencode serve`，启动 **16:15:08**）；**2026-11-21 只读核对已无 LISTEN、`/api/health` 连接失败、PID 不存在**；**2026-11-23 只读核对已恢复运行**（3300 PID **39828** `node dist/index.js` 启动 **09:10:41**；4771 PID **19608** `opencode serve` 2.2.5 启动 **09:10:42**；`/api/health` 200、`runtime.ready:true`、`pendingSessions:0`），且用户已确认真实 3300 人工验收**全部通过**（P7-7 评审仍待定；本条为最新口径，本文其它处“人工验收仍由用户执行”属历史表述）。`backend/dist` **2026-11-23 10:08:23**、`frontend/dist` **2026-11-23 10:08:49**（2026-11-21 21:34/21:31 为 P7-7c-2 修复/回归构建，2026-11-20 16:14/16:15 为当时 restart 构建），Express 静态托管**即时生效**——设计视图「原型」只展示设计产物（无切换按钮），**刷新即可见**；后端进程比 dist 早约 58 分钟，09:10 后若有后端改动需用户自行 restart（本轮未启停、未验证运行进程内后端是否为最新源码）。库为 4 表新结构，`apps>0` 正常；fail-closed 仅针对旧 5 表结构 + `apps>0`。**设计/实施不启停真实实例，后续由用户执行**（`restart.cmd` / `restart.sh` = stop → 构建前后端 → start → 健康检查；`start` 每次也会构建），按 `docs/ops/switch-to-agent-first.md` 操作，工作台不自动切换/回滚；以实际为准。**P7-7c-2 真实模型验证只在临时 3487/4787 运行并已停止（无监听），未启停 3300/4771。**
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
