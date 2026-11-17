# 模块化 M5：设计输入 v2 + 需求 bundle + 覆盖度 + Change Set 模块选择（实施交接单）

日期：2026-11-16
用途：新开实施会话执行；主会话评审。
状态：**待实施**。
上游：`docs/plans/2026-11-13-module-requirements-design.md`（§4.5/§4.6/§5.3/§8/§12.1）、M2/M3/M4 交接单（§8/§8.9/§10）、`docs/STATUS.md`「2026-11-13 政策」「M4 完成」。
范围：**只做 M5**——设计输入 v2（模块 + 需求 bundle 版本/hash）、需求 bundle 语义完善、覆盖度模块化 + 应用汇总、Change Set 模块选择/`app_change_set_modules`/只改选中模块/取消恢复选中模块/设计 stale 按模块。
**不做**：应用级交接包模块化与 U7 模块阶段（M6）、#8 预览（M7）、登录/权限。
**不做旧数据迁移**（政策）：真实库 `apps=0`；新表 `CREATE TABLE IF NOT EXISTS`；旧库有应用数据按政策删除/重置，不写回填。

---

## 1. 目标

1. 设计输入绑定模块 + 需求 bundle 版本/hash（v2），stale 仍按模块需求文档，不被其它模块变化误伤。
2. 需求 bundle 成为应用级聚合快照（模块版本/hash/确认 + changeSetId），供设计输入/交接包/变更单引用。
3. 覆盖度按模块计算 + 应用级汇总（只读）。
4. Change Set 创建时选择模块（默认全选）；只允许编辑选中模块；未选模块需求/设计版本、确认、输入、会话都不动；取消只恢复选中模块并重新生成需求 bundle。
5. 移除 M4 的“多模块变更 409”，改为真正的模块范围变更。
6. 保持单模块旧行为与现有 204/114 回归。

---

## 2. 数据模型

### 2.1 新表 `app_change_set_modules`（无迁移）

```sql
CREATE TABLE IF NOT EXISTS app_change_set_modules (
  change_set_id            TEXT NOT NULL,
  module_id                TEXT NOT NULL,
  req_base_version         INTEGER,
  req_base_hash            TEXT,
  req_current_version      INTEGER,
  req_current_hash         TEXT,
  design_base_version      INTEGER,
  design_base_hash         TEXT,
  design_base_template_id  TEXT,
  design_current_version   INTEGER,
  design_current_hash      TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  PRIMARY KEY(change_set_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_cs_modules_change_set ON app_change_set_modules(change_set_id);
```

- 固定哈希：
  - `reqHash(module) = sha256(content_md)`（与需求 bundle docHash 一致）；
  - `designHash(module) = sha256(JSON.stringify({ entities, pageSets }))`，entities 按 position、pageSets 按 position、pages 按 position 序列化（写进代码注释；测试固定）。
- 写入时机：`startChangeSet` 为每个选中模块插入一行（base = 当前已确认版本/hash/template；current 同 base）；模块确认/设计确认/同步输入时更新该模块 `*_current_*`。
- 删除应用时一并清理（`apps` 删除事务）。

### 2.2 需求 bundle

- M2/M3 已有 `app_requirement_bundles` 与 `modules_json/bundle_hash`；M5 增加只读 helper：
  - `latestRequirementBundle(appId)`：最新 bundle（version/hash/modules/changeSetId/createdAt）或 null；
  - `requirementBundleEntries(appId)`：当前聚合 entries（不写库，供预览/校验）。
- bundle 生成时机保持：单模块确认 / `POST /requirements-bundle/confirm`；M5 取消变更后**重新生成** bundle（新增版本）。

### 2.3 设计输入 v2

- `DesignInputBundle` 增加：`bundleVersion: number | null`、`bundleHash: string | null`（构建时取最新 bundle；无则 null）。
- `input_json` 落库包含这些字段；表结构不变。
- **stale 只比模块 `docHash`**；新增 `bundleDrift: boolean`（`input.bundleHash !== latest.bundleHash`）仅提示、不阻塞、不让其它模块设计过期。
- `GET /design/input` 返回 `bundle: { version, hash }`（最新）+ 当前 input 的 bundle 信息 + `bundleDrift`。
- 同步输入（`POST /input/sync`）记录当前最新 bundle 版本/hash。

---

## 3. 服务/API

### 3.1 Change Set 创建（模块选择）

`POST /api/apps/:id/change-sets` body 增加 `moduleIds?: string[]`：

- 缺省/空数组 → 全部未归档模块；显式数组必须非空、无重复、全部为未归档模块（否则 400）。
- 权限/前置条件（沿用 C1）：应用 development/completed、存在交接包、所选模块需求与设计均 confirmed；多模块不再 409。
- 单事务：
  1. 写 `app_change_sets`（base 需求/设计版本取**选中模块的 max** 以兼容旧字段，`base_input_id` 取默认模块；`base_handoff_version` 不变）；
  2. 为每个选中模块写 `app_change_set_modules`（req/design base + current + design 模板）；
  3. scope=requirements：选中模块需求 docs → draft、确认清空；选中模块设计 projects → draft、确认清空；`apps.status='requirements'`、`requirements_confirmed_at=NULL`；
  4. scope=design：只把选中模块设计 projects → draft/清确认；`apps.status='design'`；
  5. 归档当前 active 开发会话（C1）；`apps.current_change_set_id`；事件记录 `moduleIds`。
- 未选模块：文档/设计项目/版本/确认/输入/session 都不动。
- `StartChangeSetInput`/`StartChangeSetResult`、`ChangeSetView` 增加模块信息（见 3.4）。

### 3.2 编辑门禁（选中模块才能写）

新增 helper（`changesets/module-scope.ts` 或 query.ts）：`activeChangeSetModuleIds(appId): Set<string> | null`（无 active → null）、`assertModuleInActiveChangeSet(appId, moduleId)`。

- 需求写路径（saveSection/saveDoc/preview 不需要、template/rollback/manual version/confirm/reopen/restore/outline rebuild/bundle confirm）：
  - 有 active 变更单时，非选中模块 → 409「本次变更未包含模块「…」」；选中模块按原逻辑。
  - 需求 scope 的变更单下，`requirements-bundle/confirm` 只校验/推进选中模块？应用级完成需求要求全部必选确认（未选模块保持 confirmed，选中模块重新确认后即可通过）。
- 设计写路径（entities/page-sets/pages/snapshot/confirm/reopen/template module 级/input sync）：有 active 变更单时只允许选中模块；非选中 409。
- 模块管理：
  - `createModule` 仅 `app.status==='requirements'`；若有 active scope=requirements 变更单，新模块自动写入 `app_change_set_modules`（base=null、current=doc v1）并视为选中；scope=design/无变更单但非需求阶段 → 409（沿用）。
  - `updateModule`（title/description/owner/required/position）/`order`：仅需求阶段；有 active 变更单时允许（元数据），但不改版本。
  - `archiveModule`/`restoreModule`：仅需求阶段；有 active 变更单时禁止归档任何模块（避免范围歧义），恢复允许。
- 单模块旧行为不变（选中=唯一模块）。

### 3.3 取消 / 完成 / 升级

- 取消（`POST /change-sets/:id/cancel`）：
  - 门禁改为按选中模块：任一选中模块需求/设计已确认且版本≠base（且该变更单未产交接包）→ 可取消。
  - 逐个选中模块：需求恢复到 `req_base_version`（`restoreRequirementDocVersionConfirmed(appId, v, moduleId)`，仅当需求变化）；设计恢复到 `design_base_version`（`restoreDesignVersionConfirmed(appId, v, moduleId)`，仅当设计变化）；恢复 `design_base_template_id`；重新绑定该模块设计输入（避免 stale）。
  - 未选模块不动；恢复 app status/completed/current_change_set_id/确认时间/session（沿用）。
  - 取消后**重新生成需求 bundle**（`createRequirementBundleSnapshot(appId, {requireConfirmed:true})`，要求全部必选确认；失败回滚整个取消事务并 409）。
  - 返回 `restored.modules: [{moduleId,key,title,requirementsVersion,designVersion,templateId}]`。
- 完成（`POST /change-sets/:id/complete`）：关闭变更单；`app_change_set_modules.current_*` 保留最后值；单模块交接包后续仍按旧路径（M6 模块化）。
- 升级 scope design→requirements：只对**选中模块**重开需求+设计；其它模块不动；写模块 current（base 不变）。
- 历史 `GET /change-sets`：`ChangeSetView` 增加
  ```ts
  modules: Array<{ moduleId, moduleKey, title, reqBaseVersion, reqCurrentVersion, reqBaseHash, reqCurrentHash,
                   designBaseVersion, designCurrentVersion, designBaseHash, designCurrentHash, templateId }>
  ```
  单模块旧字段保留（compat）。

### 3.4 设计输入 / bundle / 覆盖度

- `buildDesignInput(appId, moduleId)` 增加 bundleVersion/bundleHash（最新 `app_requirement_bundles`）；`persistDesignInput` 落库；同 `(app,module,docHash)` 复用，但如果 bundle 变化是否新建？**不新建**（hash 复用），只在 input_json 里更新 bundle 字段？pin：同 docHash 复用时更新该行 `input_json` 的 bundleVersion/hash 与 change_set_id（UPDATE，保留 id/docVersion）。
- `computeStale` 保持模块 docHash；新增 `bundleDrift` 到 `DesignStaleState`（只读提示）。
- 新增 `GET /api/apps/:id/design/overview`（只读，不建项目/版本/输入）：
  ```jsonc
  {
    "appId": "...",
    "modules": [{
      "moduleId":"...","moduleKey":"MOD-001","title":"...","required":true,
      "status":"draft|confirmed","version":3,
      "entityCount":2,"pageSetCount":3,"pageCount":11,"missingImages":2,
      "coverage":{"storyTotal":8,"coveredStories":6,"rate":0.75,"uncovered":[{"id":"STORY-003","title":"..."}]},
      "confirmedAt":"..."
    }],
    "summary":{"moduleCount":2,"confirmed":1,"storyTotal":15,"coveredStories":11,"rate":0.73,"missingImages":2},
    "bundle":{"version":4,"hash":"..."} | null
  }
  ```
  - 覆盖度用 `buildDesignInput` + 当前模块实体/页面 `computeCoverage`；**不得**为无项目模块建项目。
- `GET /design/coverage` 仍按模块（旧字段不变）；总览走新接口。
- 需求 bundle `GET` 响应补 `latest` 已有，无需破坏；可选增加 `modules` 明细已有。

### 3.5 `appPayload` / activeChangeSet

- `activeChangeSet` 视图带 `modules`（历史/当前一致）；需求/设计视图据此禁用未选模块。
- `appPayload.designModules` 增加 `coverageRate`（或由总览接口提供，二选一，固定一种）；不建项目。

---

## 4. 前端

- **ChangeSetStartDialog**：
  - 新增“变更模块”多选（来自 `app.requirementModules`，默认全选；显示模块名/需求版本/设计版本/状态；必选标记）；
  - 至少选 1 个；scope 仍 radio；提交 body 带 `moduleIds`；
  - 说明文案：未选模块版本/确认/设计都不会变；需求范围会重开选中模块需求+设计。
- **RequirementsDocView**：
  - 顶部显示本次变更范围（N 个模块 + 列表）；当前模块未选中时：整页只读、确认/重新编辑/模板/保存禁用，提示“本次变更未包含该模块，切换或取消变更”；
  - 模块 rail 显示“本次变更”标记；
  - 完成需求阶段仍要求全部必选确认（未选模块保持 confirmed）。
- **DesignStudio**：
  - 同样显示变更范围；未选模块只读；模板切换只作用于选中模块（scope=module），应用级模板切换在多模块变更时禁用并提示；
  - 设计总览改用 `GET /design/overview`，展示各模块覆盖率/未覆盖 Story/缺图/确认进度 + 应用汇总；
  - 版本弹窗/输入同步/覆盖度按模块（已有）。
- **ChangeSetHistoryDialog**：
  - 每条显示模块数/模块名与各模块需求/设计版本区间；详情列出模块行（base→current）；取消确认文案列出将恢复的模块。
- **AppShell/状态**：变更中提示带模块范围；导航不受影响。
- **纯函数单测**：模块选择默认/校验、范围标签、版本区间、覆盖率格式、未选模块只读判断；新增 `changesets/module-scope.js` + `.test.mjs`（或扩展 labels）。

---

## 5. 兼容与边界

- 单模块应用：moduleIds 缺省=唯一模块；行为与 C1 一致（回归必须过）。
- 未选模块在变更期间：需求/设计版本、确认、输入、会话都不变；UI 只读；后端 409。
- 多模块交接包仍 409（M6）；因此多模块完整“开发→变更→再交接”E2E 在 M6 后才可跑。M5 的 Playwright 可用“临时库 fixture”：直接插入 fake handoff 行 + 置 app development，构造可发起变更的状态（仅测试，生产逻辑不改）。
- 设计输入 bundle 变化不使其它模块 stale；`bundleDrift` 只提示。
- 不做旧数据迁移；真实库 apps=0；`app_change_set_modules` 直接建表。
- 不新增依赖。

---

## 6. 测试

### 6.1 后端（基线 204）

新增 `changesets/module-scope.test.ts`（或扩展 service.test.ts）：

1. startChangeSet 选择子集：写 `app_change_set_modules`（base/current/hash/template）；选中模块需求/设计回 draft；未选模块文档/设计/版本/确认/输入不变；app 状态正确；事件含 moduleIds。
2. 默认全选；moduleIds 空/重复/含归档/不存在 → 400 且不写库；单模块回归。
3. 编辑门禁：未选模块 saveSection/saveDoc/template/confirm/reopen/design 写 → 409；选中模块正常。
4. 模块管理：变更中新增模块自动入范围；变更中归档 → 409；非需求阶段 update/order/archive → 409。
5. 取消子集：选中模块需求+设计+模板恢复、未选不动、追加版本、需求 bundle 重新生成、app/session 恢复；`restored.modules` 正确；交接包已生成 → 不能取消。
6. 升级 scope：只影响选中模块。
7. 历史视图 modules 字段（版本区间/hash）。
8. 设计输入 v2：bundleVersion/hash 写入；改模块 A 需求 → 仅 A stale，B 不 stale（bundleDrift 仅提示）；同 docHash 复用并更新 bundle 字段。
9. 覆盖度 overview：两模块覆盖率/未覆盖 Story/缺图 + 汇总；只读（调用前后项目/版本/输入行数不变）。
10. 需求 bundle：取消后新 bundle 版本递增、hash 变化；`latestRequirementBundle` 只读。
11. 删除应用清理 `app_change_set_modules`。

### 6.2 前端（基线 114）

- `module-scope.js`：默认全选、校验空/重复、未选模块只读、范围标签、版本区间。
- 现有测试全绿。

### 6.3 Playwright（临时 data/projects + fixture，端口 3429 起，`OPENCODE_AUTO_START=false`）

1. 两/三模块应用（API 造数据）→ 置 development + fake handoff（直接改临时 DB）→ UI 发起变更：默认全选、取消勾选一个模块、提交。
2. 需求页：未选模块只读（保存/确认/模板禁用 + 提示）；选中模块可编辑；rail 范围标记。
3. 选中模块改需求并确认 → 完成需求阶段（未选保持 confirmed）→ 设计页：选中模块设计重开、未选只读；同步输入/改实体/确认。
4. 设计总览：覆盖率/未覆盖 Story/缺图/汇总正确；单模块/多模块布局。
5. 取消变更：UI 文案列出模块；确认后选中模块需求/设计恢复、未选不动、bundle 新版本；应用回 development。
6. 历史弹窗：模块行与版本区间。
7. 1024/768：模块多选/范围条/历史弹窗不溢出；深浅色；0 console/0 意外 API≥400。

### 6.4 回归

```powershell
npm run build --prefix backend
npm test --prefix backend
npm run smoke:requirements --prefix backend
npm run smoke:modules --prefix backend
npm run smoke:change-set --prefix backend
npm run smoke:design-handoff --prefix backend
npm run smoke:design --prefix backend
npm test --prefix frontend
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm run check:vue --prefix frontend
```

基线：后端 204、前端 114；M5 后按实际回传。真实模型全链路 E2E 留到 M6 后由主会话执行。

---

## 7. 文档

- 本交接单追加 `## 10. 实施结果`（改动文件、表/API、测试数、Playwright、偏差、未验证）。
- 更新 `docs/STATUS.md`（M5 完成 + 测试数）。
- 更新设计稿 M5 状态（仅状态文字）。
- 不改 `AGENTS.md`/接续单（主会话负责）。

---

## 8. 主会话评审前置约束

1. 纯模块范围：选中模块才可写；未选模块需求/设计/版本/确认/输入/session 一律不变（后端 409 + 前端只读）。
2. 取消只恢复选中模块，且先恢复再生成需求 bundle；任一步失败整体回滚。
3. 设计 stale 只按模块 docHash；bundle 变化只 `bundleDrift` 提示，不让其它模块过期。
4. 单模块 C1 行为零回归（`smoke:change-set` 必须过）。
5. 不做旧数据迁移；不建 legacy；真实库 apps=0；验证只用临时目录/端口。
6. 不改真实 `data/`/`projects/`、不启停 3300、不读 `.env`、不调真实模型。
7. 不新增依赖；不扩到 M6（交接包模块化/U7 模块阶段）。
8. 回传：改动文件、测试数（204/114 → ?）、Playwright 场景/截图/错误数、偏差/未验证。

---

## 9. 风险

- Change Set 编排是最容易出数据问题的部分：所有版本恢复/bundle 生成/状态更新必须在**单事务**内；失败回滚。
- 取消恢复会追加新版本（不物理删版本），`app_change_set_modules` 保留历史。
- `query.ts` 的 `cancelabilityOf` 目前按 app 单行查询需求/设计（M2/M4 后多行），M5 必须改为按模块行；单模块仍兼容。
- 多模块交接包仍 409（M6）；Playwright fixture 只用于测试，不改变生产门禁。

---

## 10. 实施结果

状态：**已实施，待主会话评审**（2026-11-16）。范围严格按 §2—§6；未做旧数据迁移、未启停 3300、未触碰真实 `data/`/`projects/`、未读 `.env`、未调真实模型。

### 10.1 改动文件

后端：
- `backend/src/db.ts`：`app_change_set_modules`（`CREATE TABLE IF NOT EXISTS` + `idx_cs_modules_change_set`）。
- `backend/src/changesets/query.ts`：模块行类型/视图；`changeSetModuleRows`/`changeSetModulesView`/`insertChangeSetModule`/`touchChangeSetModule`；`activeChangeSetModuleIds`、`assertModuleInActiveChangeSet`、`assertAllModulesInActiveChangeSet`；`cancelabilityOf` 改按模块行（旧单回退）；`ChangeSetView.modules`。
- `backend/src/changesets/service.ts`：`startChangeSet` 模块选择/校验/模块行/只改选中模块；取消按模块恢复 + 同事务 bundle；scope 升级只影响选中模块；移除多模块 409。
- `backend/src/requirements/modules.ts`：`latestRequirementBundle`/`requirementBundleEntries`；`createRequirementBundleSnapshot({changeSetId})`；需求变更中新增模块自动入范围；`confirmRequirementBundle` 仅校验选中模块；update/order/archive/restore 阶段门禁（变更中禁止归档）。
- `backend/src/requirements/doc.ts`：需求写路径未选模块 409；确认 gate 提前；版本快照同步模块 `req_current_*`；应用级模板切换范围不全 409。
- `backend/src/design/types.ts`：`DesignInputBundle.bundleVersion/bundleHash`；`DesignStaleState.bundleDrift`。
- `backend/src/design/input.ts`：构建取最新 bundle；同 docHash 复用 UPDATE bundle/change_set_id；`computeStale` 只按 docHash + `bundleDrift`。
- `backend/src/design/service.ts`：设计写路径未选模块 409；应用级模板切换范围门禁；`designStateHash`/`currentDesignStateHash`；版本快照同步模块 `design_current_*`；`designOverview`（只读）。
- `backend/src/design/routes.ts`：`GET /design/overview`；`GET /design/input` 增加 `bundle`/`bundleDrift`。
- `backend/src/apps/routes.ts`：删除应用清理 `app_change_set_modules`。
- `backend/src/changesets/module-scope.test.ts`（新）；`backend/src/design/module-design.test.ts`（旧“多模块变更 409”改为 M5 语义）；`backend/scripts/modules-smoke.ts`（模块管理前置状态按阶段门禁调整）；`backend/package.json`（test 脚本）。

前端：
- `frontend/src/changesets/module-scope.js` + `.test.mjs`（新）：默认全选/校验/范围/只读/版本区间/取消文案。
- `frontend/src/changesets/ChangeSetStartDialog.vue`：模块多选（默认全选、至少 1、版本/状态、提交 `moduleIds`）。
- `frontend/src/changesets/ChangeSetHistoryDialog.vue`：模块数/模块行/版本区间/取消文案。
- `frontend/src/changesets/{api.ts,labels.js,labels.test.mjs}`：`moduleIds`、`restored.modules`、chip 模块数。
- `frontend/src/workbench/{api.ts,AppShell.vue}`：`ChangeSetInfo.modules`、`requirementModules` 类型、取消提示模块数。
- `frontend/src/requirements/RequirementsDocView.vue`、`RequirementModuleRail.vue`：范围条、未选只读、rail 标记、变更中归档禁用、应用级模板切换拦截。
- `frontend/src/design/DesignStudio.vue`、`DesignModuleRail.vue`、`DesignOverviewDialog.vue`、`DesignTemplateSwitchDialog.vue`、`design-module-helpers.js/.test.mjs`、`api.ts`、`types.ts`：范围条/未选只读/rail 标记、设计总览新接口（覆盖率/未覆盖/缺图/汇总/bundle）、部分范围时仅模块级模板切换、`bundleDrift` 类型。
- `frontend/package.json`（test 脚本）。

文档：本交接单 §10、`docs/STATUS.md`「M5 完成」、设计稿 M5 状态。

### 10.2 表 / API

- 新表 `app_change_set_modules`（`change_set_id + module_id` 主键；需求/设计 base/current 版本+hash；`design_base_template_id`；无迁移）。
- `POST /api/apps/:id/change-sets { moduleIds? }`；取消返回 `restored.modules/bundleVersion`；`GET /change-sets` 每单 `modules`。
- `GET /api/apps/:id/design/overview`（只读）；`GET /api/apps/:id/design/input` 增加 `bundle`/`bundleDrift`。
- 编辑门禁（409）覆盖需求写、设计写、模块管理；应用级需求/原型模板切换在范围不全时 409。

### 10.3 测试数

- 后端：**215/215**（基线 204 + 新增 11）。
- 前端：**120/120**（基线 114 + 新增 6）。

### 10.4 Playwright

临时 `RG_DATA_DIR/RG_PROJECTS_DIR`（`C:\Users\icecream\AppData\Local\Temp\opencode\m5pw`）+ 生产构建 + 端口 3429 + `OPENCODE_AUTO_START=false`；DB fixture：2 可用模块 + 1 归档、两模块需求/设计确认、fake handoff v1、变更单 #1、`apps.status='development'`（仅测试；生产多模块交接包仍 409）。

- **17 张截图**（浅/深；1440/1024/768）：发起变更默认全选/取消勾选、需求范围条、未选模块只读、设计范围、设计总览（浅/深）、未选设计只读、确认设计、历史模块行、取消确认、取消后、回 development、768 设计。
- **0 pageerror**；控制台/网络仅 **2 次 `409 GET /api/apps/m5pw/development`**：发起变更后 DevView 在途轮询在阶段切换瞬间返回（既有行为，非 M5 接口/操作），无其它意外 API≥400。
- 断言：默认全选 2；提交后范围条只 1 模块；未选需求只读；选中确认→完成需求→设计范围；总览 2 行与汇总；未选设计只读；同步+确认；历史 `需求 v2→v3 · 设计 v3→v5`；取消确认列出恢复模块；取消后 app development/无 active/bundle 版本递增且 hash 变化/overview 2 模块 2 confirmed。
- 截图与 `result.json`：`C:\Users\icecream\AppData\Local\Temp\opencode\m5pw\shots\`（临时）。

### 10.5 偏差

- `appPayload.designModules` 不加 `coverageRate`；覆盖率只由 `GET /design/overview` 提供（§3.5 允许二选一）。
- 设计状态 hash 取稳定字段（去时间戳）并按 position 排序后 `sha256(JSON.stringify({entities,pageSets}))`；已注释并测试。
- 变更中新增模块（base=null）取消时**自动归档**（内容/版本/设计数据保留，`restored.modules` 标 `archived:true`）；若归档后无未归档模块则 409 整体回滚（MF-M5-1，已修）。
- 部分范围变更下，原型模板只允许当前模块级切换（应用级 409/前端提示）。
- `modules-smoke.ts` 在 M5 阶段门禁下调整了“归档/更新”前置状态（先把应用拉回 requirements），断言目标未变。
- Playwright “已开发”状态用临时 DB fixture（fake handoff + status），生产多模块交接包 409 不变。

### 10.6 未验证

- 真实模型全链路（按计划 M6 后由主会话执行）。
- 多模块 + 交接包 + U7 模块阶段组合（M6）。
- <768 移动端。

### 10.7 MF-M5-1（主会话评审 must-fix，已修）

- 后端 `cancelChangeSet`：凡模块行 `req_base_version === null || design_base_version === null`（变更中新增、无基线）→ 不恢复版本，自动 `archived_at=now`（文档/章节/版本/设计数据保留）；`restored.modules` 增加 `{..., requirementsVersion:null, designVersion:null, templateId:null, archived:true}`；归档后若无未归档模块 → 409 并整体回滚；有基线模块逻辑不变，bundle 仍在本事务内重新生成（归档模块自动排除）。
- 前端 `module-scope.js`：新增 `isNewChangeSetModule`/`changeSetHasNewModules`；历史模块行对无基线模块显示“变更中新增”；取消文案补“变更中新增的模块将被归档（内容保留，可之后恢复）”；取消成功提示新增归档数量。
- 前端 `AppShell`：取消成功后若当前选中（需求/设计 localStorage）模块被归档，复用 `resolveInitialModule`/`resolveDesignModuleId` 回退默认模块并提示；仅实际发生回退时提示。
- 测试：后端新增 `M5-11 MF-M5-1 取消含“变更中新增模块”：新增模块自动归档、内容保留、bundle 排除`；前端 `module-scope.test.mjs` 新增“变更中新增模块版本区间/标签/取消文案”。
- 复跑：后端 **215/215**、前端 **120/120**、`smoke:change-set`/`smoke:requirements`/`smoke:modules` 通过。
- Playwright 回归（临时目录 3429，生产构建）：发起仅 A 变更 → API 新增 C（自动入范围）→ 填必填并确认 C → A 改动并确认 → 历史显示 `2 模块` 与 C“变更中新增” → 取消确认含归档提示 → 取消后 C `archived`、文档/版本保留、bundle v2 仅 A/B、app development、无 active；把 localStorage 当前选中设为 C 后取消，需求/设计选中均回退默认模块。**5 张截图、0 pageerror、0 意外 API≥400**（仅既有 1 次 `409 GET /development` 阶段切换竞态）。截图：`C:\Users\icecream\AppData\Local\Temp\opencode\m5pw\shots-mf1\`。

