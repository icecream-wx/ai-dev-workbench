# AI Dev Workbench

三阶段（**需求 → 设计 → 开发**）的 agent 开发工作台。

> **当前状态（2026-11-23）**：**第一阶段功能收尾，进入细化/优化/打磨；P7-7a、P7-7b-1、P7-7b-2a、P7-7b-2b、P7-7c-1、P7-7c-2 已实施（待评审）**（用户已跑通主流程；不等于“全部评审通过”）。Agent-First 版本 **P1—P6-4 已评审**；**P7-1～P7-6c + P7-4b + P8-1（移除旧版设计模板，DB 4 表）+ P8-2（被 P9 取代）+ P9（设计产物模板原生真实渲染，Y2 一期）+ P10（detail/dashboard 模板化 + 真实模板风格 PNG）+ P10b（所有显式契约页面模板兜底）+ P11（设计视图移除线框切换，只保留设计产物）+ P12（启动脚本构建拆两步 + 一键 restart）+ P7-7a（模板工作室底座）+ P7-7b-1（后端工作室：会话/资产/studio API/authoring SKILL）+ P7-7b-2a（StudioView/template-preview/preview 结构覆盖/测试守卫）+ P7-7b-2b（模板中心自定义入口/`e2e:p7-7b`/清理）+ P7-7c-1（新建应用 picker 列自定义 pack、scaffold contract 闭环、应用内自定义 structure、`e2e:p7-7c`）+ P7-7c-2（真实 opencode 2.2.5 + `deepseek-flash` 工作室→发布→应用→预览/PNG→fidelity 闭环，临时 3487/4787）已实施（待评审）**。**真实 3300 人工验收已于 2026-11-23 由用户确认全部通过（P7-7 评审仍待定；验收明细待补）**。打磨批 1（mock 枚举多样性 / 模板中心内置预览 embed / pm-steps 点击步条同步）已实施（待评审，2026-11-23）；**打磨批 2（ui-check 文案/状态区分：开发视图 pending 提示与 fidelity hint 按未生成/已生成未填区分）已实施（待评审，2026-11-23）；打磨批 3（移动端 <768 审计与修复：390/414/768 实测，Studio ≤1180 单栏「页面/对话/预览」tab、模板中心/picker ≤560 头部响应式）已实施（待评审，2026-11-23）**；**打磨批 5（B）开发视图真实模型复跑：通过**——临时 3488/4788 + 真实 `deepseek-flash`，自定义模板→应用→agent 实现**自动收尾 8m34s / 74 消息 / 108 工具**，ui-check 已填、**fidelity 12 pass / 1 warn / 0 fail**、0 权限拒绝、仓库与真实 data/projects 越界 hash 0 变化；应用前端未构建/未运行属未验证；**D2（PNG 像素级 diff）暂不做、pm-sheet 暂不动**（2026-11-23）。详见 `docs/STATUS.md`、本批证据 `docs/plans/evidence/2026-11-23-dev-view-real-model/` 与 `docs/plans/evidence/2026-11-21-p7-7-real-model/`。
> 需求/设计/开发都是**视图**，不是门禁；产物是工作区文件。旧方向（模块确认 / 版本 / Change Set / 交接包 / U7 阶段 / M7-2）相关代码与文档已删除。
> 真实 3300/4771：**2026-11-20 曾监听**（PID 40704/41744，启动 16:15:08）；**2026-11-21 只读核对已无 LISTEN、`/api/health` 连接失败、PID 不存在**；**2026-11-23 已恢复运行**（3300 PID **39828** `node dist/index.js` 启动 09:10:41；4771 PID **19608** `opencode serve` 2.2.5 启动 09:10:42；`/api/health` 200、`runtime.ready:true`、`pendingSessions:0`），用户已确认真实 3300 人工验收**全部通过**（P7-7 评审仍待定）。`backend/dist` **2026-11-23 10:08:23**、`frontend/dist` **2026-11-23 10:08:49**（2026-11-21 21:34/21:31 为 P7-7c-2 修复/回归构建，原 2026-11-20 16:14/16:15），Express 静态托管**即时生效**（设计视图「原型」只展示设计产物，不再有可点线框；刷新即可）；后端进程比 dist 早约 58 分钟，09:10 后若有后端改动需用户自行 restart（本轮未启停、未验证）。库为 4 表新结构，`apps>0` 正常；fail-closed 仅针对旧 5 表结构 + `apps>0`。**设计/实施不启停真实实例**；改代码后用 `restart.cmd` / `restart.sh`（stop → 构建 → start → 健康检查），切换/重启由用户按 [`docs/ops/switch-to-agent-first.md`](docs/ops/switch-to-agent-first.md) 执行，工作台不自动切换/回滚；以实际为准。e2e 只用临时目录/端口，未读写真实 `data/`/`projects/`/`.env`。

## 目标形态

- **工作台 = 共享工作区 + 模板 + 会话 + 产物视图 + 执行过程。**
- agent 使用 opencode 原生能力（会话、工具、skills、commands、权限），自主检索材料、判断范围、修改产物并检查结果。
- 需求/设计/开发只是**视图**，不是门禁；没有确认、版本、变更单、交接包。
- 产物是**文件**（单一事实源）：
  - `docs/requirements/MOD-xxx-*.md`（按模板生成，人看）
  - `docs/design/<MOD>/design.json`（实体/页面 + P7 页面契约，供 ER/原型渲染）
  - `docs/design/<MOD>/design-brief.md` + `tokens.json` + `prototypes/*.png`（设计参考包；PNG 是**模板风格截图**，无显式契约的旧设计/截图失败为线框）
  - `docs/design/design-system.json` + `docs/design/template/`（应用类型/风格、蓝图与结构/风格样式）
  - `docs/design/<MOD>/ui-check.md`（开发前后的页面对照表，软门禁）
  - 代码、截图等
- **设计模板**：应用类型 × 视觉风格 + 页面库（内置 pack 4 类型 × 4 风格 × 25 页）；工作台内 `preview.html` 可预览模板页面，设计模板中心/新建应用 picker/设计视图徽标与「模板页面库」；**自定义设计模板（P7-7）**：模板工作室 `#/studio/<packId>`（页面/spec 校验 + agent 对话 + 草稿预览 + 生成/发布/丢弃），自定义模板预览入口 `template-preview.html?draft=|pack=&page=&embed=1`（reference 复用 `preview.html` iframe，contract 用 synthetic design 原生渲染），`preview.html` 支持 `structurePack/structureDraft` 覆盖结构样式；**设计视图「原型」Tab 用所选模板（应用类型 structure + 视觉风格）原生渲染 `design.json` 该页**（独立入口 `design-preview.html?app=&module=&page=&type=&style=&embed=1`，结构与组件来自模板：`optimized-suite`/`template-stage`/`business-page`/`page-heading`/`panel` + `pm-search`/`pm-toolbar`/`pm-table`/`pm-pagination`/`pm-tree`/`pm-form-dialog`/`pm-echarts`/`pm-steps`/`pm-*`），覆盖 **list / tree-list / page-form / dialog-form / detail / dashboard / main-sub / wizard**；未知配方按 `page.type` 映射到通用模板页，**设计视图只展示设计产物，不再提供「模板风格/线框」切换**；**无显式契约的旧设计自动显示「结构草图（无契约）」并提示补齐契约**（调试入口仅 `?prototype=wireframe`，内部/测试用）；线框渲染器仍消费页面契约（树/弹窗/分页/操作/控件映射，P7-4b），皮肤由所选风格构造（P8-1；`tokens.json`/manifest 用 `styleId`）。**PNG 是模板风格截图**（`design-preview` iframe 内 html2canvas 自截；无显式契约旧设计/截图失败回退线框），自动与手动导出共用同一逻辑。
- **设计 → 开发关联**：新应用前端是独立 MF remote（`templates/afc-remote`：webpack + Module Federation + PageTemplates + GlobalPreference）；开发 prompt/AGENTS/`adw-frontend-implementation` skill/design digest/模块上下文/ui-check/一致性检查共同约束实现。
- **自定义模板应用闭环（P7-7c-1）**：新建应用 picker 列**已发布**自定义 pack（草稿不列）；scaffold 生成 `design-system.json`（`origin`/`preview`/`pages[].kind/source/contractFile`）、reference 蓝图与 `contracts/<page>.json`（contract 页不写 `.vue`）、合并 `structure.css` + 风格 + 设计模板 skill；设计视图 `design-preview` 通过应用内资产接口加载自定义 structure（base 短类 + 内置风格），PNG 截图协议不变；开发 digest/ui-check/fidelity（**13 项**，含 `template-contract`）识别契约页。
- **真实模型闭环（P7-7c-2）**：临时 3487/4787 + 真实 opencode 2.2.5 + `packycode-deepseek/deepseek-flash`，工作室 prompt → agent 写 spec（reference + 2 contract）→ 自行生成/校验 → 发布 1.0.0 → 新建应用 → 设计预览/PNG → fidelity **0 fail**；真实 `shell` 越权被 `permission.rejected`，catalog/.opencode/仓库/应用工作区无越界。证据 `docs/plans/evidence/2026-11-21-p7-7-real-model/`（含真实模型驱动的完成判定修复记录）。
- **一致性检查**：CLI `check-fidelity.mjs` 与 `POST /api/apps/:id/design-fidelity` 共用 **13 项**只读规则（第 13 项 `template-contract`；契约页跳过蓝图、校验 `contracts/<page>.json`），开发视图展示报告；只报告、不阻断、不做像素比对。
- 扩展能力：2 个方法 skill + 开发方法 skill（含一致性检查脚本）+ 2 个团队 skill + 需求模板 skill（`adw-template-req-*`）+ 设计模板 skill（`adw-template-proto-<applicationType>`）+ 5 个 command；需求模板库在 DB（4 表），应用内自动分发/同步。
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

# 后端测试（当前基线 231 项；使用临时 RG_DATA_DIR/RG_PROJECTS_DIR 更安全）
npm test --prefix backend

# 底座冒烟（临时库/目录 + 端口 3416，默认不启动 opencode）
npm run smoke:workspace --prefix backend

# 真实 opencode 冒烟（不调用模型）
npm run smoke:assets --prefix backend   # skills/commands 实际加载（4719；2 方法 + 1 开发 + 2 团队 + 模板 skill + 5 command）
npm run smoke:dev --prefix backend      # 会话生命周期（3424/4724）

# 前端单测（当前基线 183 项）
npm test --prefix frontend

# Playwright 验收（stub 后端，不调用模型；需先 npm run build --prefix frontend）
# 首次需安装浏览器：npx playwright install chromium
npm run e2e:p2 --prefix backend         # 116 条断言
npm run e2e:p3 --prefix backend         # 126（无页面契约自动结构草图，仍 prototype-paper）
npm run e2e:p4 --prefix backend         # 130
npm run e2e:preview --prefix backend    # 93（25 页 × 4 风格的预览宿主；含 embed 断言）
npm run e2e:p7-3b --prefix backend      # 55（设计模板中心/新建应用/设计视图 + 自定义入口/空态/新建 + 390×844 移动断言）
npm run e2e:p7-7b --prefix backend      # 73（模板中心自定义模板/工作室/生成/预览/发布/删除保护；picker 列已发布自定义 pack；390×844 三块可达）
npm run e2e:p7-7c --prefix backend      # 116（自定义模板 → 新建应用 → 设计预览/PNG → digest/ui-check/fidelity 闭环；390×844 原型断言）
npm run e2e:p7-4b --prefix backend      # 48（线框渲染器树/弹窗/分页/操作/控件；用 ?prototype=wireframe 调试参数进入）
npm run e2e:p9 --prefix backend         # 70（设计产物模板原生渲染：tree-list/list/dialog-form；无契约自动结构草图，无切换按钮）
npm run e2e:p10 --prefix backend        # 82（detail/dashboard/main-sub/wizard 模板化 + 模板风格 PNG 真实截图与主色采样；无切换按钮）
npm run e2e:p7-6a --prefix backend      # 19（开发视图一致性检查，13 项）

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
