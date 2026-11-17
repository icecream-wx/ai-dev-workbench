# C1 完整变更循环实施交接单

日期：2026-11-11
用途：**新开实施会话**使用；主会话负责设计/评审。
状态：**设计已确认（2026-11-11）；C1a（后端）已实施并完成评审收口，C1b（前端）已完成**。
上游方案：`docs/plans/2026-11-11-iterative-change-design.md`（已定稿）、`docs/plans/2026-11-11-design-to-development-handoff.md`（D5 已实施并评审）。
范围：**C1**——发起 Change Set #2+、需求/设计 reopen、`05-CHANGES` 真实 diff、变更历史面板、取消变更、变更会话。**不包含** R2、I-09/I-10、R4。

---

## 1. 本轮已确认的决策

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | 取消变更的时机 | 只有**本次变更已确认（存在与基线不同的已确认需求/设计版本）**且**尚未生成新交接包**时，才显示/允许取消；“改一半”（文档/设计仍是 draft、未确认）没有取消逻辑，继续编辑即可。 |
| 2 | 取消的动作 | **恢复基线**：需求文档、设计、应用状态回到变更前的已确认版本与上一版交接包；变更单标记 `cancelled`。变更中产生的新版本保留在版本历史，不物理删除。 |
| 3 | 会话策略 | 每个 Change Set **新开开发会话**；发起变更时归档当前 active 会话（旧会话只读）。“小改动继续当前会话”**不做**，留给 I-10。纯代码修复不发起变更。 |
| 4 | 历史面板 | C1 只做**应用头部 chip + “变更历史”弹窗**：列表（编号/标题/状态/基线-当前版本/交接包/会话数），展开看 `05-CHANGES` 与版本链接。逐版本全文浏览/并排 diff、阶段内版本标签留 C1b/R2。 |
| 5 | 数据库迁移 | **不加工作台门禁**。删除代码/迁移 SQL 由开发 agent 执行并在完成总结中列出，用户“确认完成”即视为确认。保持 D5 边界。 |
| 6 | 变更中直接重新生成交接包 | **没有 active Change Set 时拒绝生成**（除首次创建 #1）：开发/完成阶段纯代码修复不需要新交接包；要改需求/设计必须先发起变更。 |

> 取消语义补充：只要**需求**或**设计**任一方已确认且与基线不同，就允许取消；取消时把两者都恢复到基线（未确认的一方直接丢弃 draft）。

---

## 2. 必读

1. `AGENTS.md`、`docs/STATUS.md`（含「D5 评审」「must-fix 修复」）
2. `docs/plans/2026-11-11-iterative-change-design.md`（§2—§9、§12 已确认）
3. `docs/plans/2026-11-11-design-to-development-handoff.md` §9
4. 代码：
   - `backend/src/handoff/design-{types,bundle,render,service,routes}.ts`
   - `backend/src/design/{service,routes,input,types}.ts`
   - `backend/src/requirements/{doc,outline,routes}.ts`
   - `backend/src/dev/{service,routes}.ts`
   - `backend/src/apps/routes.ts`、`backend/src/db.ts`
   - `frontend/src/workbench/AppShell.vue`、`frontend/src/requirements/RequirementsDocView.vue`、`frontend/src/design/DesignStudio.vue`、`frontend/src/dev/DevView.vue`

---

## 3. 数据模型（全部为增量列，旧库自动补列）

```sql
app_change_sets 增加：
  base_app_status   TEXT,      -- 变更前应用状态（development | completed）
  base_completed_at TEXT,      -- 变更前 completed_at（用于取消恢复）
  base_change_set_id TEXT,     -- 变更前 current_change_set_id（取消恢复）
  base_session_id   TEXT,      -- 变更前 active 开发会话（取消时恢复 active）
  changes_md        TEXT       -- 生成时可读的 05-CHANGES 摘要（历史面板用）
  summary_json      TEXT       -- 新增/修改/删除计数（历史面板用）

app_requirement_doc_versions 增加：change_set_id TEXT
app_design_inputs            增加：change_set_id TEXT
app_design_versions          增加：change_set_id TEXT
```

- `design_handoffs.change_set_id`、`app_sessions.change_set_id/handoff_version/handoff_hash` 已有。
- 变更单序号：`max(seq)+1`；一个应用同时只允许一个 active（`status NOT IN ('completed','cancelled')`）。

---

## 4. 生命周期与状态

### 4.0 查询

- `GET /api/apps/:id/change-sets`：返回变更单列表（新→旧）与 active 单；字段：`id/seq/title/description/scope/status/baseRequirementsVersion/baseDesignVersion/baseHandoffVersion/currentRequirementsVersion/currentDesignVersion/currentHandoffVersion/createdAt/completedAt/summary/changesMd`（`changesMd` 仅当前/已完成单有值）。
- `GET /api/apps/:id` 增加 `activeChangeSet`（`status NOT IN ('completed','cancelled')` 的最新一单）与 `changeSet`（保持现有，来自最新交接包）。

### 4.1 发起变更 `POST /api/apps/:id/change-sets`

请求：`{ title, description?, scope: 'requirements' | 'design' }`。

前置（否则 409/400）：

- `requirements_mode='doc'`。
- 应用 `status` 为 `development` 或 `completed`。
- 没有 active 变更单。
- 需求文档已确认、设计已确认、存在交接包（`design_handoffs` 最新一行）。

动作（事务）：

1. 记录基线：`base_requirements_version/docHash`、`base_design_version`、`base_handoff_version`、`base_input_id`、`base_app_status`、`base_completed_at`、`base_change_set_id`、`base_session_id`。
2. `scope=requirements`：需求文档 → `draft`、`requirements_confirmed_at=NULL`；设计项目 → `draft`、`confirmed_at=NULL`；应用 → `requirements`。
   `scope=design`：需求文档保持 `confirmed`；设计项目 → `draft`、`confirmed_at=NULL`；应用 → `design`。
3. 归档当前 active 开发会话（`status='archived'`）。
4. 建变更单：`status=requirements|design`；`apps.current_change_set_id=新单`；保留 `completed_at` 作为“上一版完成时间”。
5. 阶段事件：`change-set-started`（scope/base 版本）。

返回：应用详情 + 变更单。

### 4.2 阶段推进

- 需求确认（`confirmRequirementDoc`）成功且存在 active 变更单 → 变更单 `status='design'`。
- 设计确认（`confirmDesign`）成功 → 变更单保持/置 `design`。
- 生成交接包 → 变更单 `status='development'`、`current_*_version` 更新、`changes_md/summary_json` 写入。
- 确认完成 → 只关闭 **当前 active/最新** 变更单（改掉现在 `status<>'completed'` 全关的写法），`completed_at` 更新。

### 4.3 取消 `POST /api/apps/:id/change-sets/:id/cancel`

允许条件（否则 409）：

- 变更单是该应用 active 变更单。
- 该变更单**没有**生成过交接包（`design_handoffs WHERE change_set_id=cs` 为空）。
- 存在**已确认**的基线差异：需求 `confirmed` 且 `version/docHash != 基线`，或设计 `confirmed` 且 `version != 基线`。

动作（事务）：

1. 需求文档恢复到 `base_requirements_version` 的内容，生成新版本，状态 `confirmed`、`confirmed_at=now`；`apps.requirements_confirmed_at=now`（若基线需求已确认）。
2. 设计恢复到 `base_design_version` 的实体/页面集，生成新版本，`status='confirmed'`、`confirmed_at=now`。
   - 复用 D1—D4 的快照数据；**不能**直接调 `rollbackDocVersion`/`rollbackDesignVersion`（它们有 confirmed 只读守卫），需在 requirements/design 服务内新增内部 `restore*` 方法或等价实现。
3. 应用：`status=base_app_status`、`completed_at=base_completed_at`、`current_change_set_id=base_change_set_id`。
4. 变更单：`status='cancelled'`、`completed_at=now`。
5. 若恢复后应用为 `development` 且 `base_session_id` 存在 → 该会话 `status='active'`（其余 active 归档）。
6. 阶段事件：`change-set-cancelled`。

返回：应用详情 + 变更单。

### 4.4 reopen 门禁

- `POST /requirements-doc/reopen`：`development/completed` 时**仅当**存在 active 变更单且 `scope=requirements` 才允许；否则 409「请先在应用头部“发起变更”」。
- `POST /design/reopen`：`development/completed` 时**仅当**存在 active 变更单才允许（`scope` 不限）；否则 409。
- 需求/设计重新确认成功后，按 §4.2 推进变更单状态。

### 4.5 交接包生成

- 有 active 变更单 → 绑定该单：`version = 最新+1`、`baseline_handoff_version = 该单 base_handoff_version`、写入 `change_set_id`。
- 无 active 变更单且**没有任何交接包** → 首次：#1「初始开发」（D5 行为）。
- 无 active 变更单但已有交接包 → 409「如需修改需求/设计，请先发起变更；纯代码修复请直接在开发会话进行」。
- 预览始终允许（不写盘），预览结果按“若有 active 变更单则绑定该单，否则按 #1/当前最新”渲染，并提示是否可生成。

---

## 5. `05-CHANGES.md` 真实 diff

新增 `backend/src/handoff/design-changes.ts`（确定性，不调模型）。

基线来源：

- 需求：`base_input_id` → `app_design_inputs.input_json`（scenes/epics/stories）；当前：`project.input`。
- 设计：`base_handoff_version` → `design_handoffs.source_design_json`（entities/pageSets）；当前：`project.entities/pageSets`。
- 模板：基线 handoff `manifest.prototypeTemplate.hash` vs 当前 `templateHash`。
- 需求文档 hash：基线 `base_requirements_version` 的 docHash vs 当前。

匹配键：

- Scene/Epic/Story：稳定 ID；`archived=true` 视为删除。
- 实体：内部 id（快照保留 id），缺失时按 `tableName`/名称兜底。
- 字段：实体内 `name`；关系：`name + target`（展示用目标实体名称/表名，**不输出内部 id**）。
- 页面集：id，缺失按标题；页面：id，缺失按「标题+类型」。
- 修改判定：对固定字段集合做归一化后比较（标题/目标/优先级/验收、表名/字段类型/必填/唯一/默认/选项/引用、页面类型/mode/字段/动作/状态/验收/需求依据）。

`05-CHANGES.md` 结构（`seq>1`）：

1. 变更单编号/标题/范围/说明/基线-当前交接包；
2. 需求：新增/修改/删除（Scene/Epic/Story，ID+标题）；`docHash` 变但无结构化差异时写「需求文档其他章节有更新，请查看 01-REQUIREMENTS.md」；
3. 设计：实体/表/字段/关系、页面集/页面、原型模板是否变化；
4. 影响提示：引用被删/改 Story 的实体/页面；
5. 删除/迁移：列出删除项；说明 DB 删表/删列需先生成迁移 SQL 并等待用户确认；
6. 实现要求：在现有代码上增量修改、保留未变更功能、不重写整个项目。

首次（`seq=1 && version=1`）沿用「初始开发（无基线差异）」；同变更单重新生成（`seq=1 && version>1`）沿用 D5 已修复的「同一变更单内重新生成」文案。

`manifest.json` 增加：`changeSet.changes`（计数）、`changeSet.baselineHandoffVersion`、`changeSet.currentHandoffVersion`；`00-README.md` 显示「变更 #N · 基线 vZ」。

---

## 6. 首条提示与会话

`DEFAULT_DEV_PROMPT` 改为按应用/变更单生成：

- 初次（#1 v1）：保持 `请阅读 docs/handoff/00-README.md...`。
- 同单重新生成（#1 v2+）：「交接包已在同一变更单内重新生成……在现有代码上增量修改，不要重写」。
- 变更（#N）：「这是第 N 次变更（变更单：标题），基线交接包 vZ，当前 vZ+1。请先读 `docs/handoff/05-CHANGES.md`，再读 `00-README.md` 和相关章节；在现有代码上增量实现，保留未变更部分，不要重写整个项目。完成后总结变更点、影响文件、自测结果、未解决事项。」

开发会话创建时记录 `change_set_id/handoff_version/handoff_hash`（已有）；变更中旧会话 `archived`，只读（现有 `activeRow` 逻辑天然拒绝写入）。

---

## 7. UI

- `AppShell.vue` 头部：
  - chip：`初始开发` / `已完成` / `变更 #N · 需求|设计|开发`；
  - `发起变更` 按钮（仅 `development/completed` 且无 active 变更单）；
  - `变更历史` 按钮 → 弹窗。
- 发起变更弹窗：标题（必填）、说明、范围（需求+设计 / 仅设计）、基线摘要、提示“会归档当前开发会话、需求/设计进入 draft”。
- 变更历史弹窗：变更单列表（编号/标题/状态/范围/基线→当前版本/交接包/session 数）；当前项展开显示 `changes_md`；已完成项可查看对应需求/设计版本（复用现有版本弹窗）；取消按钮按 §4.3 条件显示。
- `RequirementsDocView` / `DesignStudio`：变更中显示 `变更 #N（基于 vX）`；确认后按 §4.2 推进。
- `DesignStudio` 交接包弹窗：有 active 变更单时按钮为“生成变更交接包并进入开发”，显示基线/当前；无 active 单且已有交接包时，隐藏“重新生成”，提示“如需修改请发起变更”。
- `DevView`：顶部 `变更 #N · handoff vZ`（`changeSetLabel` 已有，补 #N 语义）；首条提示按 §6。
- `HomeShell` 应用行：`已完成` / `变更中 #N · 阶段`。

---

## 8. 验证

后端：

- 单测：发起变更（基线捕获/归档会话/状态切换）、取消（门禁/恢复基线/会话恢复）、reopen 门禁、生成绑定 active CS、无 active CS 时拒绝生成、`05-CHANGES` diff（需求+设计+模板+删除）、`complete` 只关当前单、`ensureChangeSet` 状态过滤。
- `npm run build --prefix backend`、`npm test --prefix backend`（新增测试后计数更新）。
- 新增 `smoke:change-set`：创建应用 → 需求/设计/交接包 v1 → 完成 → 发起变更 #2（需求+设计）→ 改需求+设计 → 确认 → `05-CHANGES` diff → 生成 v2（基线 v1）→ 新会话 handoff v2/CS#2 → 完成 → 发起 #3（仅设计）→ 取消（恢复基线）→ 校验应用/版本/会话 → 删除应用。
- 回归：`smoke:design-handoff`、`smoke:design`、`smoke:handoff-input`、`smoke:requirements`。

前端：`npm test`、`npm run typecheck`、`npm run build`；Playwright E2E（真实模型）：完成应用 → 发起变更 #2 → 改需求/设计 → 生成变更交接包 → 开发页显示 `变更 #2` 和 `05-CHANGES` → 变更历史弹窗 → 取消路径 → 0 console error / 0 API >=400。

文档：更新 `docs/STATUS.md`、本交接单状态、`docs/plans/2026-11-11-iterative-change-design.md`（实施结果）。

---

## 9. 边界与风险

- 不做“继续当前会话”；不做逐版本并排 diff UI；不做独立顶级“变更”导航。
- 不做代码删除自动化/DB 迁移执行；`05-CHANGES` 只给要求与清单。
- 取消是“恢复基线 + 追加恢复版本”，不是物理删除版本；`rollback*` 的 confirmed 只读守卫不能绕过给普通用户，只能用内部 restore。
- 一次只允许一个 active 变更单；并发用 409 保护。
- 生成交接包前必须校验 active 变更单归属，不可把变更内容写进旧单。
- 不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交。

---

## 10. 待实施会话回传

完成后更新 `docs/STATUS.md`「C1 完成」，列出：命令/结果、真实验证与未验证项、与本文档的偏差（如有）。主会话再评审。

---

## 11. 实施结果（C1a 后端，2026-11-11）

范围：只做后端（C1a）。`frontend/`、`templates/eos-app`、`projects/`、`data/`、`.env` 未改动。

实现：

- 数据模型（`backend/src/db.ts`）：`app_change_sets` 增加 `base_app_status/base_completed_at/base_change_set_id/base_session_id/changes_md/summary_json`；`app_requirement_doc_versions/app_design_inputs/app_design_versions` 增加 `change_set_id`（新建库写入建表语句，旧库用 `ensureColumn` 自动补列）。版本快照写入时自动标记当前 active 变更单。
- 新增 `backend/src/changesets/`
  - `query.ts`：只依赖 `db` 的轻量查询/更新（active/latest/byId/list/nextSeq/update/`markChangeSetGenerated`），供需求/设计/交接包服务引用，避免循环 import；
  - `service.ts`：`startChangeSet`（§4.1 前置校验、基线捕获、需求/设计回 draft、归档 active 会话、事件 `change-set-started`）、`cancelChangeSet`（§4.3 门禁 + 恢复基线 + 会话恢复 + `change-set-cancelled`）、`listChangeSets`；
  - `routes.ts`：`GET/POST /api/apps/:id/change-sets`、`POST /api/apps/:id/change-sets/:csId/cancel`；错误经 `appsErrorHandler`。
- 应用详情：抽出 `backend/src/apps/payload.ts`（避免 apps/change-sets 路由循环 import），`appPayload` 增加 `activeChangeSet`，`changeSet`/`handoff` 语义不变；顺手合并 D5 的重复 `designHandoffSummary` 查询。
- 阶段推进（§4.2）：需求确认 → 变更单 `design`；设计确认 → 保持/置 `design`；生成交接包 → `development` + `current_*` + `changes_md/summary_json`；`completeActiveChangeSet` 只关当前 active 单（不再批量关闭）；完成后继续发消息只恢复最近一单。
- reopen 门禁（§4.4）：开发/完成阶段无 active 单时需求/设计 reopen 返回 409「请先发起变更」；需求 reopen 额外要求 active `scope=requirements`（仅设计变更中不允许改需求）。
- 交接包（§4.5）：有 active 单 → 绑定该单（baseline=该单 `base_handoff_version`、version=最新+1、写 `change_set_id`）；无 active 且无交接包 → 首次 #1；无 active 但已有交接包 → `generate` 409、`preview` 允许并提示且 `canGenerate=false`；`ensureChangeSet` 不再复用 completed/cancelled。
- `05-CHANGES`（§5）：新增 `backend/src/handoff/design-changes.ts`（确定性）：基线需求=`base_input_id` 的 `input_json`、基线设计=`base_handoff_version` 的 `source_design_json`、模板 hash=基线 manifest；输出需求/实体/字段/关系/页面集/页面/模板的新增-修改-删除、影响提示、删除/迁移要求、增量实现要求，**不输出实体/页面/页面集内部 ID**（输出名称/表名/标题/稳定需求 ID）。`manifest.changeSet` 增加 `changes` 计数 + `baselineHandoffVersion/currentHandoffVersion`；`00-README` 显示「变更 #N · 基线 vZ」；`seq=1` 仍是“初始开发/同单重新生成”文案。
- 开发首条提示（§6）：`DEFAULT_DEV_PROMPT` 保留初次文案；新增 `buildDevPrompt`（同单重新生成 / 变更 #N 三种），会话仍记录 `change_set_id/handoff_version/handoff_hash`。
- 取消实现：需求/设计新增内部恢复方法（`restoreRequirementDocVersionConfirmed` / `restoreDesignVersionConfirmed`），绕过普通用户的 confirmed 只读守卫，恢复内容并追加新版本（source=`restore`）+ 保持 confirmed；取消后重新绑定等价设计输入，避免恢复后 docVersion 变化导致误判 stale。

测试/验证：

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 100/100（C1a 96 + 收口 4 项：canCancel/取消恢复模板/输入归属/纯修复不重开单/scope 升级） |
| `npm run smoke:change-set --prefix backend` | ✅ 创建应用 → v1/CS#1 → 完成 → #2（需求+设计）→ 改需求+设计 → 确认 → 05-CHANGES 增量 → v2（基线 v1，绑定 CS#2）→ 完成 → #3（仅设计，切换模板）→ 取消（恢复模板/设计/应用）→ #4 升级 scope → 改需求确认 → 取消 → 校验 → 删除 |
| `CHANGE_SET_SMOKE_DEV=1 npm run smoke:change-set` | ✅ 真实 opencode 2.2.5 serve：开发会话记录 handoff v2 / CS#2，首条提示为“第 2 次变更” |
| `npm run smoke:design-handoff` / `smoke:design` / `smoke:handoff-input` / `smoke:requirements` | ✅ 回归通过 |
| 前端 `npm test` / `typecheck` / `build` / `check-vue-imports` | ✅ 35/35、typecheck、vite build、导入检查通过（C1b） |
| Playwright E2E（API 预置，非真实模型） | ✅ 发起 #2 → 改需求/设计 → 生成变更交接包 v2 → 开发页 `变更 #2` + 05-CHANGES → 变更历史 → 完成 → #3 仅设计 → 升级 → 取消恢复；0 console error / 0 非预期 API >=400 |

与本文档的偏差 / 待决策：

1. 基线需求 `docHash` 未单独建列：通过 `base_input_id` 对应的 `app_design_inputs.input_json.docHash` 追溯（§3 列表未包含该列）；取消门禁用“版本号变化”判断确认差异，足够区分“改了一半（draft）”与“已确认差异”。
2. `ensureChangeSet` 在“已有历史单但没有交接包”这种异常数据下会 409 而不是自动新建（正常流程不可达：取消要求尚未生成交接包，但历史交接包仍存在）。
3. 取消时若需求未离开基线（仅设计变更），只恢复设计；需求文档不追加恢复版本，避免无意义版本增长（语义与 §4.3 一致：恢复到基线）。
4. 取消时会额外恢复基线原型模板（`source_design_json.templateId`，回退 manifest），并只清当前被取消单的设计输入归属（`AND change_set_id = 当前单`）。
5. 取消后会重新绑定等价的当前设计输入（docVersion 因恢复版本而递增），否则设计会被误判 stale、无法生成交接包。
6. `preview` 在“无 active 单 + 已有交接包”时仍渲染（按当前最新单），但返回 `canGenerate=false` 并给 warning；`changesMd`/`summary` 落在变更单行上供历史面板使用。
7. 纯开发修复不再重开变更单（`resumeCompletedApp` 只改应用状态）；完成后要改需求/设计需发起新变更。
8. scope 升级：`POST /api/apps/:id/change-sets/:csId/scope`，非法目标 400、非 design/已生成交接包/非 active 409；C1b 在设计页提示条提供入口。
9. C1b 已实现 UI（chip/发起/历史/取消/scope 升级/canGenerate 门禁）；变更历史只展示 `changesMd` 摘要，不做逐版本并排 diff（R2）。
10. 已知限制：磁盘只保留最新交接包文件（D5 既有）；`05-CHANGES` 只给删除/迁移要求，不自动删代码/执行 DDL。
