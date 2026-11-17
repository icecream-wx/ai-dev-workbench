# U7-3 真实模型全链路验证交接单

日期：2026-11-12
用途：**新开验证会话**执行；主会话负责评审与最终记录。
状态：**待执行**。
上游：`docs/plans/2026-11-12-u7-phased-development-design.md` §10.3、`docs/plans/2026-11-12-u7-1-implementation-brief.md` §8.8、`docs/plans/2026-11-12-u7-2-implementation-brief.md` §8.6、`docs/STATUS.md`「真实模型 E2E（2026-11-12）」。
范围：**只验证，不改产品代码**。若发现缺陷，停止并回传证据（文件/日志/接口响应/截图），不要自行修改后端/前端/表/接口。**不做**新的功能、不做门禁/批次/证据/Git、不迁移数据。

---

## 1. 本轮要回答的问题

1. **U7-3 真实模型摘要**：`complete` 阶段时 `design`/`req` 只读 agent + 真实模型能否生成摘要（`summarySource='model'`）？摘要是否可用于下一阶段 brief？
2. **真实 fallback**：应用目录缺少 `design`/`req` agent 时，完成阶段是否回退到最后 assistant 文本（`summarySource='fallback'` + warning），阶段仍 `completed`？
3. **U7 全链路真实模型**：新应用真实模型需求 → 设计 → 交接包（large）→ 生成 6 阶段 → 开始/切换/完成/跳过/重新打开 → 会话 chip/只读，是否符合 U7 设计。
4. **P2 回归**：真实模型生成的需求/实体下，默认页面集主实体匹配是否正确（EPIC-001 书目、EPIC-002 读者、EPIC-003·004 借阅记录、EPIC-005 罚款单；不出现 EPIC-001 → 借阅记录、EPIC-005 → 提醒记录）。
5. **无回归**：0 console/page error、0 非预期 API>=400、应用状态不被阶段完成自动改变、真实数据未污染。

## 2. 已完成（主会话，2026-11-12）

- 后端 `npm run build` + `npm test` **145/145**。
- 前端 `npm test` **78/78**、`typecheck`/`build`/`check:vue`。
- 完整冒烟回归 **8 支全部通过**：`smoke:dev-phases`、`dev-sessions`、`dev-health`、`requirements`、`design`、`design-handoff`、`change-set`、`handoff-input`（真实 opencode 2.2.5；不调模型）。
- 本交接单只需执行真实模型验证，不必重复上述检查。

## 3. 环境与边界

- 仓库：`E:\work_space_primeton\ai-dev-workbench`（后端先 `npm run build --prefix backend`，前端 `npm run build --prefix frontend`，后端托管 `frontend/dist`）。
- 临时根目录：`C:\Users\icecream\AppData\Local\Temp\opencode\u7-3-real-e2e`（`data/`、`projects/`、`shots/`、脚本、`summary.json`）。
- **严禁**使用仓库 `data/`、`projects/`、`.env`；不得读取/打印/提交真实凭据。
- 端口：后端 **3451**、opencode **4451**（`OPENCODE_AUTO_START=true`、`OPENCODE_DEFAULT_MODEL=packycode-deepseek/deepseek-flash`）。执行前确认端口空闲；结束后停止 serve/后端。
- 真实模型：`packycode-deepseek/deepseek-flash`；`/api/health` 的 `runtime.ready=true` 才继续。
- Playwright：`file:///C:/Users/icecream/AppData/Local/Temp/opencode/c1b-e2e/node_modules/playwright-core/index.mjs`；Chromium `C:\Users\icecream\AppData\Local\ms-playwright\chromium-1223\chrome-win64\chrome.exe`。
- 参考脚本（只读）：`C:\Users\icecream\AppData\Local\Temp\opencode\i09b-real-e2e\run.mjs`（真实模型需求/设计/交接包/首会话）、`p2-replay.mjs`（P2 断言写法）。**复制到临时根目录后修改**，不要直接改参考脚本。

## 4. 执行流程

### 4.1 启动与准备

1. 清理/新建临时 `data`、`projects`、`shots`；启动后端（`dist/index.js`）并等待 `/api/health` + `runtime.ready`。
2. 创建新应用 `u73-real-e2e`（名称如“U7-3 真实模型全链路”）；若已存在先 `DELETE ?confirm=true`。

### 4.2 真实模型需求（UI）

1. 打开 `/#/apps/u73-real-e2e/requirements`，等待 doc chat 与默认模板。
2. 用真实模型发送需求提示（沿用 `run.mjs` 的图书借阅域，便于 P2 断言）：
   - 至少 4 场景 / 4 Epic / 12 Story，稳定 ID（SCENE/EPIC/STORY）；
   - `epics` 章节必须返回 `sections[].data`（scenes/epics/stories），不要只给 Markdown；
   - 必须输出 `<<<DOC_JSON>>>`，其他章节按模板填写、避免 TODO。
3. 等待 `.suggestion`（超时 ≥ 360s），截图 → 点击“全部应用” → 等待“已应用 AI 修改”通知。
4. `GET requirements-doc` 记录结构化数量；若模型输出不足，允许按 `run.mjs#ensureStructuredRequirements` 确定性补齐到 ≥4 Epic/≥12 Story（**必须在报告中标注哪些是模型、哪些是补齐**）；确认需求前补齐必填空章节。
5. `POST requirements-doc/confirm` → 记录文档版本/Epic/Story；截图。

### 4.3 真实模型设计 + P2 断言

1. 打开设计页，`AI 生成实体`（真实模型；超时 ≥ 300s）。失败/为空才允许确定性兜底，并在报告标注 `entities.fallback`。
2. 确认全部实体；记录实体数（期望 ≥8，真实模型上次为 10）。
3. “按场景生成页面集”（确定性）→ 每页切“原型”并“截图存档”，记录页面集/页面数（期望 ≥5 集 / ≥12 页；真实模型上次 20 页）。
4. **P2 断言**（`GET /design`，实体 id→name）：
   - 每个页面集都有 `epicId`；
   - EPIC-001 页面集实体不含 `借阅记录`，只应为基础书目/副本类；
   - EPIC-002 含 `读者`；
   - EPIC-003 / EPIC-004 含 `借阅记录`；
   - EPIC-005 含 `罚款单`，不含 `提醒记录`。
   - 把 `pageSets` 映射写入 `p2.json`（epicId/title/实体名/页面标题）。
5. API 确认所有页面集/页面 + `POST /design/confirm`；截图。

### 4.4 交接包

1. `POST /design/handoff/preview` → 断言 `scale.level='large'`、`scale.suggested=true`、`scale.phaseCount>=4`、`04-PLAN.md` 含“建议分阶段开发”、`00-README.md` 含规模提示。
2. UI 生成交接包并进入开发；记录 handoff v1 / Change Set #1。
3. `GET /design/handoff` → `manifest.phases` 数量与 key（`base` + `epic:*`），记录。

### 4.5 分阶段开发 + 真实模型摘要（UI + API）

1. 开发页：确认未生成阶段时有“按阶段开发”；点击 → 二次确认（含阶段数/不门禁/不自动发送）→ 生成；阶段条出现 `已完成 0/N`。
2. 开始阶段 1（UI）：断言会话创建、Composer 有阶段 brief **且未发送**、列表项阶段 chip、右侧阶段行。
3. 通过 Composer 发送一条**最小**真实模型提示（只读/不改文件），例如：
   `只回复一句话：阶段 1 数据模型已初始化。不要修改任何文件，不要运行命令。`
   - 等待 assistant 文本出现（超时 ≥ 300s）；记录耗时、工具数（应为 0 或极少）。
4. 打开阶段弹窗 → 完成阶段 1：
   - 等待完成（摘要最长 60s）；断言 `phase.status='completed'`、`summarySource='model'`、`summary` 非空、5—10 行中文（允许轻微差异）；
   - 断言阶段完成**未归档**当前会话（会话仍 active）；
   - 记录摘要原文（脱敏后）与耗时；截图 `phase-dialog-summary-model.png`。
5. 开始阶段 2（UI）：断言阶段 1 会话归档、阶段 2 active、阶段 2 brief 的“上一阶段摘要”包含阶段 1 摘要片段（截取前 20 字）或说明“无上一阶段摘要”（若模型摘要为空则视为失败）。
6. 发送阶段 2 最小提示（同上，等待 assistant 文本）。
7. **真实 fallback**：在临时应用目录 `.opencode/agents/` 中临时移走 `design.md`/`req.md`（或重命名为 `.bak`，仅临时应用目录），然后完成阶段 2：
   - 断言 `summarySource='fallback'`、`warnings` 非空、`summary` 等于最后 assistant 文本的截断（允许 800 字截断）、阶段仍 `completed`、会话未归档；
   - 恢复 agent 文件。
   - 若应用目录实际没有这两个文件/结构不同，记录实际 agent 列表与结论，不要改仓库模板。
8. 跳过阶段 3；重新打开阶段 1；断言状态/按钮切换、阶段条提示。
9. 选择阶段 1 归档会话只读：断言只读横幅、阶段操作禁用 + 原因；恢复为当前会话；断言阶段条跟随。
10. 断言应用状态仍 `development`（阶段完成/跳过/重新打开不改变应用状态）；截图阶段条/弹窗/会话 chip。
11. `GET /apps/u73-real-e2e/development/phases` 与 `GET /development/sessions` 记录最终阶段状态与会话 phase 字段。

### 4.6 证据与清理

- 截图至少：需求建议/应用、实体、页面截图存档、交接包规模、阶段条进行中、阶段弹窗模型摘要、阶段弹窗 fallback、会话 chip、归档只读。
- `summary.json` 至少包含：
  - requirements `{version, epicCount, storyCount, modelSupplemented}`；
  - entities `{count, fallback}`；pages `{setCount, pageCount}`；
  - scale `{level, suggested, textBytes, phaseCount, triggers}`；
  - phases `{count, keys, finalStatuses}`；
  - summaries `{phase1: {source, chars, seconds, textPreview}, phase2: {source, warningsCount, seconds}}`；
  - session `{phase1ArchivedAfterPhase2Start, phase1ActiveAfterComplete, finalAppStatus}`；
  - `consoleErrors`、`apiErrors`、`durations`。
- 停止后端/opencode，确认 3451/4451 释放；确认仓库真实 `data`/`projects` 未变化（`apps=0`、`projects/` 空）。
- 临时目录保留脚本/截图/summary 供主会话复核。

## 5. 断言红线

- `summarySource='model'` 的阶段摘要必须非空且不是错误文本；阶段仍 completed。
- fallback 阶段必须 `summarySource='fallback'` + warning，且不阻塞完成。
- 阶段完成不归档；开始下一阶段才归档当前 active；同一时间仅一个 active。
- 应用状态不因阶段操作变化；不自动发送首条提示、不自动完成应用。
- P2 主实体映射符合 §4.3；不符合即失败，不忽略。
- 0 console/page error；0 非预期 API>=400（预期 409 需显式标注）。
- 不打印/提交真实凭据；不污染真实 data/projects。

## 6. 不做

- 不修改产品代码/表/接口/模板/冒烟脚本；发现缺陷只回传。
- 不做新的 UI 功能/视觉打磨；不跑全量截图矩阵（U7-2 已覆盖）。
- 不迁移旧应用/旧交接包；不读取真实 `.env`/凭据。

## 7. 回传（验证会话）

1. 在 `docs/plans/2026-11-12-u7-3-real-model-e2e-brief.md` 追加 `## 8. 执行结果`：命令、耗时、模型输出统计、摘要原文（脱敏）、fallback 结论、P2 映射、错误、未验证、需决策。
2. 更新 `docs/STATUS.md`：新增「U7-3 真实模型全链路验证」小节 + 摘要表一行；写明通过/失败与实际数字。
3. 不改 `AGENTS.md`/U7 设计稿（主会话评审后统一更新）。
4. 最终回复：临时目录、summary.json 路径、截图数、关键断言结果、未验证项。

## 8. 执行结果

验证会话：2026-11-12（U7-3）。**只验证，未改产品代码/表/接口/模板/冒烟/现有测试**；未发现产品缺陷。

### 8.1 环境与命令

- 仓库使用现有构建产物（`backend/dist`、`frontend/dist`，2026-11-12 11:50 构建；本轮未改后端/前端源码，未重跑 145/145、78/78 与 8 支冒烟——由主会话完成）。
- 临时根：`C:\Users\icecream\AppData\Local\Temp\opencode\u7-3-real-e2e`（`data/`、`projects/`、`shots/`、`stage*.mjs`、`*.json`）。
- 后端（在 `backend/` 目录）：
  `PORT=3451 RG_DATA_DIR=<tmp>\data RG_PROJECTS_DIR=<tmp>\projects OPENCODE_PORT=4451 OPENCODE_DEFAULT_MODEL=packycode-deepseek/deepseek-flash OPENCODE_AUTO_START=true node dist/index.js`
  `/api/health` `runtime.ready=true`、opencode **2.2.5** 后才继续；端口 3451/4451 均空闲。
- 脚本（在临时根执行，Playwright chromium-1223，1500×980）：
  `node stage1.mjs`（需求→设计→交接包→生成 6 阶段）、`node stage2.mjs`（阶段 1 开始/提示/完成/模型摘要）、`node stage3.mjs`（阶段 2 + 真实 fallback）、`node stage4.mjs`（跳过 3、重新打开 1；只读段首次被命中拦截）、`node stage4b.mjs`（只读段重试 + 汇总）、`node check-repo.mjs`（只读校验真实库）。
- 结束后 `POST /api/opencode/stop` + 停止后端；3451/4451 无监听；仓库真实 `data/requirements.db` mtime 未变（`2026-11-12T03:50:18Z`），`apps=0`、`app_sessions=0`、`app_dev_phases=0`、`projects/` 空（`repo-check.json`）。

### 8.2 结果总览

| 项 | 结果 |
| --- | --- |
| 需求（真实模型） | ✅ 文档 v3；模型结构化 **7 场景**（scenes 章节）/ **5 Epic** / **17 Story**（epics 章节）；无确定性补齐生效 |
| 实体（真实模型） | ✅ **8 个**（未走兜底）：图书分类、书目、副本、读者类型、读者、借阅证、借阅记录、罚款单 |
| 页面集 / 页面（确定性） | ✅ **5 集 / 22 页 / 22 张 PNG**（真实 html2canvas 存档） |
| P2 页面集主实体 | ✅ EPIC-001 书目·副本；002 读者·借阅证；003/004 借阅记录；005 罚款单（无提醒记录） |
| 交接包 | ✅ **large**；17 Story / 22 页面 / 118212 B（115.5KB）三阈值全命中；`phaseCount=6`；`derivedFrom=epics` |
| manifest.phases | ✅ 6 个：`base` + `epic:EPIC-001…005` |
| 阶段生成（UI） | ✅ 6 阶段，全部 `not_started`；二次确认含阶段数/不门禁/单会话/不自动发送 |
| 阶段 1 完成摘要 | ✅ **`summarySource='model'`**，486 字 / 7 行 / 5.1s；阶段 completed；会话**未归档**（active） |
| 阶段 2 开始 | ✅ 阶段 1 会话 archived、阶段 2 active（唯一 active）；brief 含阶段 1 摘要片段 |
| 真实 fallback | ✅ **`summarySource='fallback'`** + warning；摘要 = 最后 assistant 文本；阶段仍 completed；会话未归档 |
| 跳过/重新打开/只读 | ✅ 阶段 3 skipped；阶段 1 in_progress（摘要保留）；归档会话只读（无 Composer、阶段操作禁用 + “会话只读”）；恢复成功 |
| 应用状态 | ✅ 全程保持 `development`；最终仅 1 个 active 会话 |
| 错误 | ✅ **0 console error / 0 page error / 0 意外 API>=400** |
| 证据 | `summary.json`、`p2.json`、`preview.json`、`stage1-3.json`、`repo-check.json`；**23 张截图** |

### 8.3 需求（真实模型，UI）

- 需求页 doc chat 发送图书借阅域提示（5 场景/5 Epic/15 Story 要求、稳定 ID、`<<<DOC_JSON>>>`、`sections[].data`），**91s** 出现 AI 建议；“全部应用”后应用成功；文档 **v3**。
- 模型实际结构化：`scenes` 章节 **7 场景**；`epics` 章节 **5 Epic / 17 Story**（EPIC-001 图书档案管理、002 读者管理、003 借阅办理、004 归还与续借、005 逾期与罚款；4/3/3/3/4 Story）。
- 确定性补齐：脚本曾按 `run.mjs` 逻辑向 `epics.data` 追加 5 个场景，但 `epics` 章节的 outline 规范化只接受 epics/stories（场景属 `scenes` 章节），**未持久化**；模型内容未被替换。`summary.json` 记为 `modelSupplemented=false` + `supplementationAttempt.scenesAdded=5`。
- 必填空章节脚本填充 0 个；`POST requirements-doc/confirm` 成功（文档 v3）。

### 8.4 设计 + P2（真实模型实体 / 确定性页面集）

- `AI 生成实体`（真实模型，**26.2s**）→ **8 个实体**，未走确定性兜底；“确认全部实体”后 8/8 confirmed。
- “按场景生成页面集”（确定性）→ **5 集 / 22 页面**；逐页“原型 → 截图存档”，**22 张 PNG** 真实写入 `docs/design/prototypes/`；设计确认成功。
- P2 映射（`p2.json`，实体 id→name）：

| Epic | 页面集实体 | 页面标题（节选） |
| --- | --- | --- |
| EPIC-001 图书档案管理 | **书目、副本** | 书目列表/创建/编辑/详情、副本详情 |
| EPIC-002 读者管理 | **读者、借阅证** | 读者列表/创建/编辑/详情、借阅证详情 |
| EPIC-003 借阅办理 | **借阅记录** | 借阅记录列表/创建/编辑/详情 |
| EPIC-004 归还与续借 | **借阅记录** | 借阅记录列表/创建/编辑/详情 |
| EPIC-005 逾期与罚款 | **罚款单** | 罚款单列表/创建/编辑/详情 |

- 断言：每个页面集都有 `epicId`；EPIC-001 不含借阅记录（仅书目/副本）；EPIC-002 含读者；EPIC-003/004 含借阅记录；EPIC-005 含罚款单且不含提醒记录。**全部通过**。
- 脚本说明：外层按页面集重复遍历了同一组 DOM 页（共 110 次点击，实际 22 页），页面/原型数取 `scale.counts` 与原型文件（22/22）；不影响 P2 与交接包结果。

### 8.5 交接包

- `POST /design/handoff/preview`：`level=large`、`suggested=true`、`phaseCount=6`、`derivedFrom=epics`；`counts = 7 scenes / 5 epics / 17 stories / 8 entities / 90 fields / 15 relations / 5 pageSets / 22 pages / 22 prototypes`；`textBytes=118212`；triggers = **stories(17≥10)、pages(22≥12)、textBytes(118212≥102400)**。
- `04-PLAN.md` 含“建议分阶段开发”；`00-README.md` 含“本交接包较大”；UI 预览显示 `[data-testid="handoff-scale"]`；UI 生成并进入开发（交接包 v1 / Change Set **#1** / 应用 `development`；53 个文件，`prototypes/ps-001…ps-005`）。
- `GET /design/handoff` → `manifest.phases` **6** 个，key：`base`、`epic:EPIC-001`、`epic:EPIC-002`、`epic:EPIC-003`、`epic:EPIC-004`、`epic:EPIC-005`。

### 8.6 分阶段开发 + 真实模型摘要（UI）

- 开发页“按阶段开发”二次确认后生成 6 阶段（`已完成 0/6`）；阶段条/开始卡片阶段列表/会话 chip/右侧阶段行正常。
- **阶段 1（base 数据模型与基础框架）**：UI 开始（1.6s）→ 创建 build 会话、阶段 `in_progress`；Composer 得到 brief **270 字**（含“无上一阶段摘要”），**未自动发送**（时间线 0 user / 0 assistant）。
- 发送最小提示（“只回复一句话…不要修改任何文件/命令”）→ 真实模型 **1s** 回复 14 字；工具卡 0 / `stats.toolTotal=0`。
- UI 完成阶段 1（确认文案含“不归档会话、不检查 Git/测试、会尝试生成摘要”）：**6.3s** 返回（摘要 **5.1s**）；`phase.status=completed`、**`summarySource='model'`**、摘要 **486 字 / 7 行**；会话仍 **active**。
- 摘要原文（已由产品 `scrubText` 脱敏）：

  > 本阶段围绕数据模型与基础框架展开，已完成实体和建表脚本的初始化工作，使后端 EOS 9.0.0（Java）的基础数据层具备可用结构。
  > 关键产出集中在 `04-PLAN.md` 阶段 1 对应的实体定义与建表/初始化脚本，参考路径为 `backend/` 下的实体与持久层配置。
  > App Shell、导航骨架与公共组件按计划应在本阶段同步实现；会话结论仅确认“数据模型已初始化”，前端外壳部分是否实现仍需回溯确认。
  > 尚未完成或存在风险：实体与建表脚本的一致性校验、字段类型/索引与后续阶段需求的匹配度、初始化脚本的可重复执行性，以及 Vue 3 前端目录结构与公共组件的约定。
  > 风险点：数据库、Nacos、Redis 等真实凭据不可提交，初始化脚本应支持本地无外部依赖启动。
  > 下一阶段注意事项：先补齐 `docs/handoff/00-README.md` 作为开发依据，再进入阶段 2；确保导航与路由配置可承接后续页面，公共组件接口提前固化避免返工。
  > 建议在阶段衔接时补充自测结论，说明建表执行结果、实体映射验证和 App Shell 启动情况，避免阶段结论信息缺口累积。

- **阶段 2（EPIC-001 图书档案管理）**：UI 开始（2s）→ 阶段 1 会话 **archived**、阶段 2 active（唯一 active）；brief **827 字**，含“上一阶段摘要”且包含阶段 1 摘要片段 `本阶段围绕数据模型与基础框架展开，已完成`；发送最小提示 → 模型 **1.6s** 回复（无文件修改）。

### 8.7 真实 fallback（阶段 2 完成）

- 临时将应用目录 `.opencode/agents/design.md`、`req.md` 改名为 `.bak`（仅临时应用目录；恢复后文件存在）。改名后 opencode 仍返回缓存的 `design`/`req` → **停止/启动 opencode serve**（产品入口 `/api/opencode/stop|start`，**未改全局配置**）后 agent 列表变为 `build/general/explore/compaction/title/summary/plan`（无 design/req）。
- UI 完成阶段 2：**3.7s**（摘要 **1s**）；`phase.status=completed`、**`summarySource='fallback'`**、warning：
  `阶段摘要生成失败，已改用最后一条回复：没有可用的只读摘要 agent（design/req）`
- fallback 摘要 = 最后一条 assistant 文本（13 字：“阶段 2 已进入读者管理。”，`summaryMatchesAssistant=true`）；阶段仍 completed；会话**未归档**（active）。
- 恢复 agent 文件成功；恢复后未再次 reload（opencode 列表未立刻出现 design/req，属预期缓存，不阻塞）。
- 结论：**真实 fallback 可触发且不阻塞完成**；前提是应用目录无 design/req 且 opencode 重新加载/重启（本机 location 缓存需重启 serve）。

### 8.8 跳过 / 重新打开 / 只读 / 应用状态

- 阶段 3（EPIC-002 读者管理）**跳过** → `skipped`；阶段条提示“阶段均已处理（含跳过）”（不自动完成应用）。
- 阶段 1 **重新打开** → `in_progress`、`completedAt=null`、模型摘要保留（486 字）。
- 选择阶段 1 归档会话：只读横幅显示、Composer 隐藏、恢复栏显示；阶段弹窗 `phase-start/complete/skip/reopen` 全部禁用，原因 **“会话只读”**。
- “恢复为当前会话”（含二次确认）→ 可写、Composer 回来；阶段条跟随到 `阶段 1/6`；此时阶段 2 会话 archived，仅 1 个 active。
- 应用状态全程 `development`（阶段完成/跳过/重新打开/恢复均未改变，也未自动完成应用）。
- 最终阶段状态：`base=in_progress`、`epic:EPIC-001=completed`、`epic:EPIC-002=skipped`、`epic:EPIC-003/004/005=not_started`。

### 8.9 证据

- 临时根 `C:\Users\icecream\AppData\Local\Temp\opencode\u7-3-real-e2e`：
  `summary.json`（含 requirements/entities/pages/scale/phases/summaries/session/fallback/readonly/console/api/durations/totals）、`p2.json`、`preview.json`、`phase-generate-confirm.txt`、`stage1.json`、`stage2.json`、`stage3.json`、`repo-check.json`、`stage1.mjs`—`stage4b.mjs`、`check-repo.mjs`、`ref-*.mjs`。
- 截图 **23 张**（`shots/`）：需求建议/应用/确认、实体生成/确认、页面集原型、设计确认、交接包规模、开发页规模、阶段条生成、阶段 1 brief/回复/模型摘要弹窗/完成条、阶段 2 brief/回复/fallback 弹窗/警告、阶段 3 跳过、阶段 1 重新打开、归档只读、只读阶段禁用、恢复后阶段条。

### 8.10 错误 / 脚本问题（均非产品缺陷）

- **0 console error / 0 page error / 0 意外 API>=400**（四段脚本累计）。
- 脚本层 3 处重试：①页面截图循环按页面集重复遍历 DOM 页（110 次，实际 22 页）；②`stage4` 点击归档会话项被 `.timeline-scroll` 命中判定拦截 → 改用 `dispatchEvent('click')` 触发同一 handler（`stage4b`）；③恢复会话需二次确认弹窗，脚本首版漏点 → 补点“恢复”。均为脚本问题，产品 API/行为正常。
- 未发现产品缺陷，未修改任何产品文件。

### 8.11 未验证 / 需决策

- 未重跑后端 145/145、前端 78/78、8 支冒烟（主会话已完成）；本轮只做真实模型/真实 opencode UI 验证。
- fallback 需 opencode 重新加载 agent 配置（本机需重启 serve）。若希望“删除 agent 后下一次 complete 立即 fallback”，可考虑在摘要前 reload location（当前未做，属产品决策，不在本轮范围）。
- 真实摘要仅验证两段短会话（模型摘要 486 字/fallback 13 字）；长会话摘要质量、60s 超时边界未实测（摘要实际 5.1s/1s）。
- 页面原型截图 UI 循环按页面集重复遍历（脚本层）；已用 `scale.counts.pages/prototypes=22` 与原型文件核对。
- <768 移动端、EOS 构建/运行态、MySQL/Nacos/Redis/license、真实 401/403 不在 U7-3 范围，未验证。

## 9. 主会话复核（2026-11-12）

**结论：U7-3 可以验收。** 独立复核（不依赖验证会话的结论）：

- 重启临时后端（`OPENCODE_AUTO_START=false`）直接读 `u73-real-e2e` 持久化数据：应用 `development` / handoff v1；6 阶段状态 `base=in_progress`、`epic:EPIC-001=completed`、`epic:EPIC-002=skipped`、其余 `not_started`；`summarySource` 分别 `model`（486 字）与 `fallback`（13 字）；恰好 1 active + 1 archived；页面集 `entityIds` 映射与 `p2.json` 一致。
- 主会话确认：仓库 `backend/src`/`frontend/src`/package 在验证期间无改动；真实 `data`（`apps=0`/`app_sessions=0`/`app_dev_phases=0`）与 `projects/` 未变；3451/4451 已释放。
- 脚本层问题（非产品）：①阶段 2 最小提示误写“读者管理”，导致 fallback 摘要文本与阶段标题不一致；brief 本身正确（见 `15-phase2-started-brief.png`）；②页面截图循环按页面集重复遍历 DOM（110 次点击，实际 22 页）；③归档会话点击/恢复确认的脚本重试。均已在 §8.10/STATUS 记录。
- 观察/后续（不阻塞，等用户完整体验后决定）：fallback 依赖 opencode 重新加载/重启 agent 配置（正常使用不删 agent，不影响主路径）；长会话摘要质量与 60s 超时边界未实测（实测 5.1s/1s 短会话）；摘要失败重试入口、阶段条“确认完成开发”快捷入口、<768 移动端。
