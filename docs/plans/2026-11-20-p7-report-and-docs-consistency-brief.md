# P7-A 实施单：P7 汇报材料 + 文档口径收口（2026-11-20）

> 上游：P7 设计稿 `2026-11-19-design-template-and-dev-linkage-p7-design.md`（第 14—24 节）、P7-1～P7-6c 实施单、`docs/plans/evidence/2026-11-19-p7-6b/`、`docs/plans/evidence/2026-11-20-p7-6b-rerun/`。
> 本轮只做 **文档与汇报材料**：把 P7 已实施内容、基线、证据、未验证项写进 STATUS/README/AGENTS/plans/ops/report，并重新生成 HTML/PDF/流程图/截图。
> **不做产品行为变更**：不改 `backend/src/**`、`frontend/src/**`、`templates/**`、DB 表结构、API 语义；不实现 P7-4b/P7-7；不跑真实模型。
> 不改需求模板中心；不启停真实 3300；不读写真实 `data/`、`projects/`、`.env`；不做任何 git 操作。

---

## 0. 出口标准

1. 下列文档口径一致，全部只写“当前有效事实”：
   - P7-1/P7-2/P7-3a/P7-3b/P7-4a/P7-5a/P7-5b/P7-6a/P7-6b/P7-6c = **已实施（待评审）**，P7-6b 记“首跑部分通过 + 2026-11-20 复跑通过”；
   - P7-4b、P7-7 = 未实施；
   - 基线：后端 **132/132**、前端 **85/85**；`e2e:preview` **77**、`e2e:p7-3b` **45**、`e2e:p7-6a` **15**、`e2e:p2/p3/p4` **116/126/128**；
   - 真实 3300 现状按 §1.0 的事实写。
2. `docs/report/ai-dev-workbench-overview.md` 更新到 **P7**（设计模板 pack/预览/模板中心、design.json 页面契约、MF remote 脚手架、开发关联与 ui-check、一致性检查、真实模型证据、未验证项），且不与 STATUS 冲突。
3. HTML / PDF / 流程图 SVG+PNG / 截图按新正文重新生成；`build:report` 自检通过（0 console error、1440/1024/768 无横向溢出、流程图打印单页）。
4. 无产品代码 diff、无 DB 改动、无真实数据读写、无 git 操作、未调模型。

---

## 1. 必须遵守的事实（不要自行推断/夸大）

### 1.0 真实 3300 现状（2026-11-20 09:26 +08:00 只读核对）

- 端口 **3300 / 4771 均无监听**（`netstat -ano` 全量、`Test-NetConnection 3300`=False、`GET /api/health` 连接失败），无 `node.exe` 后端进程。
- 磁盘构建**已是 P7-6c**：`backend/dist`（2026-11-19 17:57:25，含 `opencode/session-state.js`、`dev/fidelity.js`）、`frontend/dist`（17:52:18，含 `preview.html`）。
- 因此文档不能再写“真实 3300 目前仍运行旧构建”。统一写为：**“真实 3300 当前未运行（2026-11-20 只读核对）；磁盘 dist 已是 P7-6c 构建；是否切换由用户按 `docs/ops/switch-to-agent-first.md` 执行，工作台不自动切换/回滚。”**
- 切换前提醒：真实库若仍有旧应用（如 app1/app2，`apps>0`），新版会 fail-closed 拒绝启动，必须先备份后删除应用或重置库；旧 `projects/` 目录由用户自行清理。这条写进 ops 文档与报告边界，不要写成“已验证”。

### 1.1 P7 能力（写进报告的内容边界）

- 设计模板 = 应用类型 × 视觉风格 + 页面库：内置 pack `templates/design-system/afcenter-app-templates-v1/`（4 应用类型 × 4 风格 × 25 页面 + 蓝图/structure/shared/style）。
- 预览：同一 Vite 构建第二入口 `preview.html?type=&style=&page=`，pm-v3 子集 + mock + 模板页面，iframe 嵌入；后端仅放行 `/preview.html` 静态文件。
- 模板中心：首页「设计模板」入口、4 类型卡片/分类/搜索、风格切换、页面集 iframe 预览、picker；新建应用「设计模板」选择；设计视图徽标/「模板页面库」。需求模板中心（「模板库」）保持不变。
- 页面契约：`design.json` 顶层 `designSystem` + 页面 `recipe/catalogRef/blueprint/filters/rowActions/toolbarActions/selection/pagination/form/tree/subTables/components`；全部可选，旧 design.json 继续可读；新字段问题只 warning/不阻断。
- 开发关联：新应用生成独立 MF remote（`templates/afc-remote`：webpack + Module Federation，暴露 `./index`）+ PageTemplates + GlobalPreference；工作区生成 `docs/design/design-system.json`、`docs/design/template/<type>/{pages,structure.css,assets}`、`docs/design/template/styles/{shared.css,<styleId>/style.css}`；分发团队 skill（`afcenter-page-generation`、`pm-components-usage`）与设计模板 skill `adw-template-proto-<applicationType>`。
- 开发提示：`buildViewPrompt('development')` + 应用 AGENTS + `adw-frontend-implementation` skill + design digest（约 6KB）+ 模块上下文 + `docs/design/<MOD>/ui-check.md` 软门禁（缺失生成、不覆盖、状态只读）+ 开发视图「设计参考」。
- 一致性检查：共享规则 `fidelity-core.cjs` + CLI `check-fidelity.mjs` + command `check-design-fidelity` + `POST /api/apps/:id/design-fidelity` + 开发视图只读报告；12 项；只报告不阻断；PNG 只校验 manifest/designHash，无像素比对。
- 扩展资产：2 方法 skill + 1 开发方法 skill + 2 团队 skill + 每个应用模板 skill；**5 个 command**（`update-requirements`、`generate-design`、`preview-app`、`check-consistency`、`check-design-fidelity`）。
- DB：仍是 5 张表（`apps`、`app_settings`、`app_sessions`、`requirement_templates`、`prototype_templates`），无 ALTER；内置设计 pack 不 seed，风格存 `app_settings`。

### 1.2 真实模型证据（只能这样写）

| 轮次 | 结果 |
| --- | --- |
| 首跑 2026-11-19 | **部分通过**：设计 90,474ms；开发 265,196ms，被另一个会话调用 `/development/interrupt` 中止（产物完整，无最终文字汇报）；fidelity 11 pass / 1 warn / 0 fail（warn = PNG 未导出） |
| 复跑 2026-11-20 | **通过（工具链/产物/收尾）**：设计 93,327ms、开发 234,491ms、`done=true`、无 error、无人工 interrupt；ui-check filled；`OrganizationView.vue` 17,931B/532 行；fidelity 11/1/0；validate 1 条 `toolbarActions[2]=batchAssignRole` warning（保留原值、不阻断）；风格 `styles/platform-blue/style.css` |

证据目录：`docs/plans/evidence/2026-11-19-p7-6b/`、`docs/plans/evidence/2026-11-20-p7-6b-rerun/`。

### 1.3 未验证 / 明确不做（报告「边界与未验证」必须保留）

- 生成物 `frontend/` 的 `npm install` / `dev` / `build:prod`、页面真实渲染与截图比对；
- 真实 AFCenter 宿主 `pm-*`、`v-auto-height` 实际效果、EOS 后端构建/运行态、真实 401/403、`<768` 移动端；
- PNG 像素级比对（fidelity 只查 manifest/designHash）；
- P7-4b 渲染器树/弹窗视觉；P7-7 自定义模板 builder；
- 已知小问题：`pm-sheet` 预览占位；模板中心 iframe 内保留预览自带风格切换器（与中心顶部重复）；`AppShell.vue` 顶部状态行可能仍显示旧原型模板名。

---

## 2. 文档修正清单（逐文件）

### 2.1 `docs/plans/2026-11-19-design-template-and-dev-linkage-p7-design.md`

- 第 3 行状态行改为：P7-1～P7-6c 已实施（待评审），P7-6b 首跑部分通过、2026-11-20 复跑通过（第 22—24 节）；**P7-4b、P7-7 未实施**；P7-6 不再是“待实施”。
- 其它正文不动；如与 STATUS 冲突，以第 21—24 节实施记录为准。

### 2.2 `docs/STATUS.md`

- 第 25 行（P7-6a 节末尾）“P7-6b 已另行跑通（见下节，部分通过）” → “P7-6b 已于 2026-11-20 复跑通过（见 P7-6b 复跑节）”。
- 第 27 行“P1—P7-6b 全部在临时目录与独立端口验证” → 补 P7-6c，并加一句真实 3300 现状（§1.0 口径）。
- 第 29 行“待用户执行”保留，但补：当前 3300 未运行、磁盘 dist 已是 P7-6c、旧库有应用会 fail-closed。
- 「下一步」第 497 行：P7 列表补“P7 汇报材料/文档已更新到 P7（2026-11-20）”。
- 新增一节「P7 汇报材料与文档收口（2026-11-20）」：改了哪些文档/报告、验证命令与结果、偏差、未验证（不要重复大段流水账）。

### 2.3 `docs/plans/README.md`

- 标题“P6 于 2026-11-19 完成” → “P6 完成；P7 实施中（P7-1～P7-6c 已实施待评审，P7-4b/P7-7 未做）”。
- 第 17 行“见第 14—23 节” → “见第 14—24 节”。
- P7 条目状态统一为“已实施（待评审）”；新增本实施单条目。
- 需求模板中心“保持不动”的表述保留。

### 2.4 `README.md`

- 状态行：P1—P6-4 已评审；P7-1～P7-6c 已实施（待评审）；P7-4b/P7-7 未做。
- 真实 3300：改成 §1.0 口径（当前未运行、dist 已 P7、切换由用户执行）。
- 「目标形态」补：设计模板中心（应用类型 × 风格 + 页面库 + 预览）、design.json 页面契约、MF remote 脚手架、开发关联/ui-check/一致性检查。
- 「目录」补 `templates/afc-remote/`、`templates/design-system/`（若已有则核对描述）。
- 「开发命令」：基线改为后端 132、前端 85；补 `e2e:preview`、`e2e:p7-3b`、`e2e:p7-6a`；`smoke:assets` 说明改 5 command。
- 「汇报材料」链接补 P7 设计稿与本实施单。

### 2.5 `AGENTS.md`

- 「项目」：P1—P6-4 已评审 → 补 P7-1～P7-6c 已实施（待评审）、P7-4b/P7-7 未做。
- 「开始工作前先读」：加 P7 设计稿、P7-6b 证据、最新 P7 实施单（本文件）；把“最近一期交接单”指向本文件。
- 「当前方向」：补设计模板中心/预览/页面契约/MF remote/开发关联/ui-check/一致性检查；说明 PNG 是草图、蓝图/预览是视觉事实。
- 「工程边界」：补真实 3300 现状与 fail-closed 提醒。
- 只保留当前有效约定，不写历史流水账。

### 2.6 `docs/ops/switch-to-agent-first.md`

- 标题/前言改成 P1—P7-6c；前提检查基线改为后端 132、前端 85、`e2e:preview/p7-3b/p7-6a/p2/p3/p4` = 77/45/15/116/126/128。
- 前提检查加一条：确认真实 3300 当前状态（2026-11-20 只读核对为未运行）；并提示磁盘 dist 已是 P7-6c。
- 验收 §5 补 P7 项：设计模板中心/预览、新建应用选设计模板、`docs/design/design-system.json` + `template/` 蓝图、团队/开发方法/设计模板 skill、开发视图设计参考/u i-check、一致性检查报告。
- 回退说明不变（不做自动回滚）。

### 2.7 `docs/report/README.md`

- 版本行改 P7（P7-1～P7-6c 待评审；P7-4b/P7-7 未做），并写真实 3300 现状。
- 文件表补新截图（见 §3），说明截图来自临时 stub 实例、不含真实项目数据。
- “P6 内容”改为“P7 内容”（或 P6 + P7 两段，P6 折叠为一句）。
- 内容原则里的数字改为 132/85 与新的 e2e 数字；command 数 4 → 5。

---

## 3. 汇报正文与图表

### 3.1 `docs/report/ai-dev-workbench-overview.md`（源文件）

按现有章节结构增量更新，至少覆盖：

1. 版本/状态行 → 2026-11-20，P7 实施中；基线 132/85；3300 现状。
2. 一页摘要/业务能力 → 设计模板中心 + 预览 + 页面契约 + MF remote + 开发关联 + 一致性检查（用表格列“能力/位置/边界”）。
3. 架构与数据流/文件契约 →
   - 新增 `docs/design/design-system.json`、`docs/design/template/`（蓝图/structure/styles）、`docs/design/<MOD>/ui-check.md`；
   - 新增应用 `frontend/` = MF remote（webpack/MF/PageTemplates/GlobalPreference）；
   - `design.json` 页面契约字段表（可直接引用设计稿附录 A，控制篇幅）。
4. 扩展能力 → 2 方法 + 1 开发方法 + 2 团队 skill + 模板 skill；5 command 表（新增 `check-design-fidelity`）。
5. 主要接口 → 加 `GET /api/design-system`、`GET /api/design-system/:packId`、`GET/PATCH /api/apps/:id/design-system`、`GET /preview.html`、`POST /api/apps/:id/design-fidelity`；表仍 5 张、不改表。
6. 视图与开发流程 → 模板中心/picker、设计视图徽标/页面库、开发视图模块选择/设计参考/ui-check/检查一致性。
7. 演示脚本 → 改成 P7 流程（新建应用选设计模板 → 设计写契约 → 开发先填 ui-check 再复制蓝图 → 一致性检查）。
8. 边界与未验证 → §1.3 全量保留（不要删旧项）。
9. 完成度/仓库验证 → P7-1～6c、基线、`smoke:workspace/assets`、e2e 数字、P7-6b 两轮证据。
10. 环境/术语 → opencode 2.2.5、Node/npm 版本不变；新增 pack/预览/契约/MF/ui-check/fidelity 的简短术语。

要求：数字必须与 `docs/STATUS.md` 一致；**不要把“已实施（待评审）”写成“已评审/已完成”**；不要声称宿主/EOS/截图比对已验证。

### 3.2 流程图 `docs/report/assets/flow-overview.svg`

- 在现有分层上补：设计模板 pack（4 类型/4 风格/25 页）→ 模板中心/`preview.html`；`design-system.json` + `design.json` 页面契约 → 开发 prompt/digest/ui-check；MF remote + PageTemplates/pm-*/GlobalPreference → fidelity（脚本/API/视图）。
- 保持可编辑 SVG（文本节点），比例适合 A4 打印单页；PNG 由 `build:report` 重新截图生成（2560px 宽）。

### 3.3 截图（临时 stub 实例，端口不得用 3300/4771）

用 `backend/scripts/p2-e2e-harness.ts` 起临时实例（`P2_ROOT` 临时目录、`P2_PORT` 自选如 3433、`P2_APP_ID=report-app`、`P2_APP_NAME` 示例名、`P2_DESIGN_SYSTEM='{"pack":"afcenter-app-templates-v1","applicationType":"enterprise-application-platform","style":"platform-blue"}'`），Playwright 截图：

| 文件 | 内容 |
| --- | --- |
| `assets/view-requirements-light.png` | 需求视图（保留现有构图，重新截） |
| `assets/view-design-light.png` | 设计视图：新应用徽标「企业级应用管理平台 · 平台蓝白」+ 模板页面库入口 |
| `assets/view-design-dark.png` | 同上深色 |
| `assets/view-development-light.png` | 开发视图：模块下拉 + 设计参考（ui-check/蓝图根）+ 一致性检查报告 |
| `assets/view-design-template-center.png`（新） | 设计模板中心：4 类型卡片 + 企业级详情 + 组织与用户 iframe 预览 |
| `assets/view-dev-fidelity.png`（新） | 开发视图一致性报告（11/1/0 或 stub 结果，标注示例） |

- 新增截图要写进 md 与 `docs/report/README.md`。
- 截图必须是真实渲染（stub 数据可以），**不得 PS/伪造**；若某项截不到（如 iframe 预览、fidelity 报告），记录偏差并保留旧图，不要假装更新。
- 截图后停止临时实例，确认无残留端口；不得读写真实 `data/`/`projects/`。

---

## 4. 验证

| 命令 | 要求 |
| --- | --- |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **132/132**（用于确认报告数字） |
| `npm test --prefix frontend` | **85/85** |
| `npm run build:report --prefix backend` | 通过；记录 HTML/PDF/PNG 大小、PDF 页数、自检输出（console error=0、1440/1024/768 无横向溢出、流程图单页） |
| HTML 离线检查 | 0 外链/0 外部请求（脚本自带断言） |
| 数字一致性抽查 | report md 内所有数字 vs `docs/STATUS.md` 无冲突 |

- 本轮不改产品代码，**不要求**重跑 e2e；报告中的 e2e 数字引用既有基线，并在回报里写明“未复跑 e2e”。
- 若后端/前端测试数字与 132/85 不符：停止，先报告差异，不要改数字糊过去。

---

## 5. 边界（硬约束）

- 只改：`docs/**`、`README.md`、`AGENTS.md`、`docs/report/**`（含 assets）、`docs/plans/**`。
- 不改：`backend/src/**`、`frontend/src/**`、`templates/**`、DB 表/迁移、API 语义、`docs/requirements`/`docs/design` 产物格式。
- 不启停真实 3300/4771；不读写真实 `data/`、`projects/`、`.env`；不做任何 git 操作；不调用真实模型。
- 截图/临时实例只用临时目录与临时端口；结束必须清理（stop + 进程树 + 端口确认）。
- 不新增依赖；报告生成复用根 `playwright` 与 `frontend/node_modules/markdown-it`。

---

## 6. 收尾与回报

- 在本文件末尾追加「实施结果（2026-11-20）」：改动的文件清单、报告生成结果（大小/页数/自检）、截图清单与端口/临时目录、测试结果、偏差、未验证项、环境确认（3300 未动/未 git/未调模型/未读写真实 data·projects·.env）。
- 更新 `docs/STATUS.md` 的收口节与「下一步」。
- 回报格式：结果 → 验证命令与输出摘要 → 偏差 → 未验证 → 环境确认。

---

## 实施结果（2026-11-20）

### 改动文件

| 类别 | 文件 |
| --- | --- |
| 设计稿/索引 | `docs/plans/2026-11-19-design-template-and-dev-linkage-p7-design.md`（状态行）、`docs/plans/README.md`（P7 状态/本条实施单） |
| 状态/约定 | `docs/STATUS.md`（旧口径 + 「P7 汇报材料与文档收口」+ 下一步）、`README.md`、`AGENTS.md` |
| 运维 | `docs/ops/switch-to-agent-first.md`（P1—P7-6c 基线、3300 现状、P7 验收项、已有应用改模板边界） |
| 报告 | `docs/report/ai-dev-workbench-overview.md`、`docs/report/README.md`、`docs/report/assets/flow-overview.svg` |
| 生成物 | `ai-dev-workbench-overview.html/.pdf`、`assets/flow-overview.png`、6 张截图（见下） |

未改 `backend/src/**`、`frontend/src/**`、`templates/**`、DB/API/需求与设计产物格式；未改 `backend/scripts/**`。

### 报告生成（实跑）

`npm run build:report --prefix backend` 通过：

- HTML：733,408B（716KB）；请求 1（均本地）；0 console error；1440/1024/768 无横向溢出。
- PDF：1,063,342B（1,038KB），14 页；流程图单独起页，打印版心 688×499px（A4 单页）。
- flow PNG：567,720B，2560×1760（1280×880 @2x）。
- 报告正文 25,732B；数字与 `docs/STATUS.md` 一致（后端 132、前端 85、e2e 77/45/15/116/126/128）。

### 截图（临时 stub 实例）

驱动：`backend/scripts/p2-e2e-harness.ts`（stub opencode，不调模型）+ Playwright；脚本放在 `C:\Users\icecream\AppData\Local\Temp\opencode\p7a-report-shots.cjs`（未入库）。

| 文件 | 内容 |
| --- | --- |
| `view-requirements-light.png` | 需求视图（设计模板徽标 + 2 模块 + 设计摘要） |
| `view-design-light.png` | 设计视图（企业级 · 平台蓝白、模板页面库、ER、tokens/PNG 导出状态） |
| `view-design-dark.png` | 同上深色 |
| `view-development-light.png` | 开发视图（模块下拉 MOD-001、设计参考 ui-check 已填/蓝图根） |
| `view-design-template-center.png`（新） | 4 应用类型切换 + 企业级详情 + 组织与用户 iframe |
| `view-dev-fidelity.png`（新） | 一致性报告（示例 stub：5 通过 / 7 警告 / 0 失败） |

环境：最终临时根 `C:\Users\icecream\AppData\Local\Temp\workbench-p7a-report-pl0INc`；后端 3433；opencode 端口 4433（stub，未启动）；0 console error / 0 pageerror / 0 外部请求；结束 `taskkill /T /F` 后端口 3433 无残留监听，临时根已删除。

### 测试

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` = `...\Temp\adw-p7a-test-3d463fd2\data|projects`） | **132 / 132** |
| `npm test --prefix frontend` | **85 / 85** |

按要求未复跑 e2e；报告中的 e2e 数字为既有基线。

### 偏差

1. `view-dev-fidelity.png` 是 stub 数据（5 通过/7 警告/0 失败，警告来自未实现页面），不是 P7-6b 的 11/1/0；图注已标注示例。
2. 设计视图深色图只在文件表/正文注释中引用，正文未内嵌（PDF 14 页上限）。
3. 报告正文首次因 `design.json` 契约字段长串导致 1024px 溢出，已改为分词写法；首次 PDF 15 页，已压缩正文/去深色内嵌后为 14 页。
4. 截图实例的 `report-app` 设计/需求/`ui-check.md` 为临时目录内的 stub 示例（真实渲染，非 PS）。
5. 流程图高度由 760 调整为 880，新增 P7 链路条；PNG 尺寸相应为 2560×1760。

### 未验证（保持不变）

生成物 `frontend/` 的 install/dev/build 与截图比对、真实 AFCenter 宿主 `pm-*`/`v-auto-height`、EOS 构建/运行态、真实 401/403、<768、PNG 像素比对、P7-4b/P7-7、真实 3300 切换后的运行态；本轮未复跑 e2e、未调真实模型。

### 环境确认

- 真实 3300/4771：未启停、未监听变更（仅只读沿用 09:26 核对结论）。
- 未读写真实 `data/`、`projects/`、`.env`；截图/测试均在临时目录。
- 未调用真实模型（harness stub opencode）；未执行任何 git 操作；未 npm install；未新增依赖。

### 评审修正（2026-11-20）

| # | 修正 |
| --- | --- |
| 1 | 报告 §3.2 `design.json` 示例：商品列表页改为 `"recipe": "list"`，移除该页 `catalogRef`（商品页不认领模板页），其余字段与字段说明表不变 |
| 2 | 需求视图截图说明改为“模块大纲/文档/设计摘要/对话”（`docs/report/README.md` 与报告 §6.6 alt）；不再写“设计模板徽标” |
| 3 | `view-dev-fidelity.png` 重截：先把右侧 `.dev-side` 置顶，再展示一致性报告；顶部“设计参考”标题/说明完整，报告标题与前几项可见；1440×900、0 console error；示例 **5 通过 / 7 警告 / 0 失败** |

重截环境：临时根 `C:\Users\icecream\AppData\Local\Temp\workbench-p7a-report-bRmNMK`；后端 3433；opencode stub 4433（未启动）；结束端口无残留、临时根已删除；截图脚本仍在临时目录，未入库。未改 `frontend/src`、未改产品代码。

重跑 `npm run build:report --prefix backend`：HTML **733,408B（716KB）**、PDF **1,063,342B（1,038KB，14 页）**、flow PNG 567,720B（2560×1760）；0 console error、1440/1024/768 无横向溢出、打印版心流程图 688×499px 单页。

