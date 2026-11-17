# 模块化需求 M2：数据底座 + 默认模块迁移 + 模块 API（实施交接单）

日期：2026-11-13
用途：新开实施会话执行；主会话评审。
状态：**待实施**。
上游：`docs/plans/2026-11-13-module-requirements-design.md`（已定稿）。
范围：**只做 M2**——`app_modules`、需求文档/章节/版本按模块、需求 bundle 快照、模块/需求 API 兼容、默认模块迁移。
**不做**：模块 UI（M3）、设计表/设计 UI 模块化（M4）、设计输入/交接包/Change Set 模块化（M5/M6）、#8 预览。
**不改**：设计表、交接包、Change Set、开发阶段、原型预览。

**风险最高的一批**：涉及真实 app1 的 SQLite 表重建/数据迁移。实施会话**只允许在临时 DB/项目副本上迁移验证**；不得在真实 `data/`/`projects/app1` 上执行迁移，不得读取/打印 `.env`。真实迁移由主会话在备份后单独执行。

---

## 1. 目标

1. 建立统一模块表 `app_modules`；需求文档/章节/版本归属模块。
2. 存量单文档应用（包括 app1）迁移为一个默认模块，内容和版本保持不变。
3. 现有需求 API 全部兼容：不传 `moduleId` 时使用默认模块，旧前端/冒烟脚本不改也能跑。
4. 提供模块 CRUD、模块级需求文档/确认/版本、需求 bundle 快照 API，为 M3 UI 做准备。
5. 保证 `SCENE/EPIC/STORY` ID 在全应用（跨模块）仍然唯一。

---

## 2. 数据模型

### 2.1 `app_modules`（新表）

```sql
CREATE TABLE IF NOT EXISTS app_modules (
  id            TEXT PRIMARY KEY,          -- randomUUID
  app_id        TEXT NOT NULL,
  module_key    TEXT NOT NULL,             -- MOD-001 / MOD-002
  title         TEXT NOT NULL,
  description   TEXT,
  owner_label   TEXT,
  required      INTEGER NOT NULL DEFAULT 1,
  position      INTEGER NOT NULL,
  archived_at   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE(app_id, module_key)
);
CREATE INDEX IF NOT EXISTS idx_modules_app ON app_modules(app_id, position);
```

- 默认模块：`module_key='MOD-001'`，`title=应用名`，`required=1`，`position=0`。
- 新模块：`module_key` 按现有未归档+归档模块顺序生成 `MOD-00N`；`id=randomUUID()`。
- `owner_label` 仅标签，不做权限。

### 2.2 需求表加 `module_id`（需要重建主键）

目标结构：

- `app_requirement_docs`：PK `(app_id, module_id)`；其余列不变。
- `app_requirement_doc_sections`：PK `(app_id, module_id, section_key)`；唯一/索引按模块。
- `app_requirement_doc_versions`：`module_id` 列；唯一 `(app_id, module_id, version)`。
- `app_requirement_bundles`（新）：

```sql
CREATE TABLE app_requirement_bundles (
  id            TEXT PRIMARY KEY,
  app_id        TEXT NOT NULL,
  version       INTEGER NOT NULL,
  modules_json  TEXT NOT NULL,
  bundle_hash   TEXT NOT NULL,
  change_set_id TEXT,
  created_at    TEXT NOT NULL,
  UNIQUE(app_id, version)
);
```

SQLite 不能直接改 PK：采用“新表 `*_v2` → copy → rename old 为 `*_legacy` → rename 新表”的事务；旧表保留到验证通过。迁移函数需幂等（已迁移则跳过）。

---

## 3. 迁移（最高风险）

### 3.1 迁移步骤（单事务）

1. 创建 `app_modules`、`app_requirement_bundles`、新需求表。
2. 对每个已有 `app_requirement_docs` 行且没有默认模块的 app：
   - 插入默认模块（`MOD-001`，title=app.name，required=1，position=0）；
   - 复制旧 docs/sections/versions 到新表，写入 `module_id`；
   - 生成 bundle v1（模块版本/hash；hash 可用现有文档 content_md 的确定性 sha256，或模块 JSON 的 sha256；需在代码中固定算法）；
   - 历史版本全部保留。
3. 无文档的 app 不强行创建模块；首次 `ensureRequirementDoc` 时懒创建默认模块。
4. 旧表改名为 `*_legacy`（保留）；新表接管查询。
5. 迁移只改需求域表，不碰设计/交接包/Change Set 表。
6. 迁移完成后记录事件（可选：`app_stage_events` event=`requirement-modules-migrated`）。

### 3.2 安全要求

- 迁移函数必须有 dry-run/只读检查能力（例如 `MODULE_MIGRATION_DRY_RUN=1`）或至少单元测试可在副本上跑。
- 实施会话验证：**复制真实 DB 到临时目录**（用 `better-sqlite3` backup 或文件复制前先停写），在副本上跑迁移；不得直接跑真实 `data/requirements.db`。
- 备份：主会话在真实迁移前执行 `copy data/requirements.db data/requirements.db.pre-modules-YYYYMMDD.bak`（并确认 WAL 状态）；实施会话只验证副本。
- 回滚：保留 `*_legacy` 表 + DB 备份；失败可恢复。

---

## 4. 服务/API

### 4.1 模块服务（建议 `backend/src/requirements/modules.ts` 或 `modules/service.ts`）

- `listModules(appId, includeArchived=false)`
- `defaultModule(appId)` / `moduleOrThrow(appId, moduleId)`
- `createModule(appId, { title, description?, ownerLabel? })`
  - 复制应用需求模板章节；生成空文档 v1；`module_key` 下一个；position 末尾。
  - 只在需求阶段或 Change Set 需求范围允许（M2 先只做基础校验；设计后拦截由 M5 完善）。
- `updateModule(appId, moduleId, patch)`（title/description/ownerLabel/required/position）
- `archiveModule(appId, moduleId)` / `restoreModule`
  - 至少保留 1 个未归档模块；被设计/交接包引用的拦截留 M4/M5。
- 所有操作写 `app_stage_events`（可选）。

### 4.2 需求文档 API 加 `moduleId`

保持现有路径，新增可选 `moduleId`；**不传=默认模块**：

- `GET /api/apps/:id/requirements-doc?moduleId=`
- `PUT /api/apps/:id/requirements-doc/sections/:key?moduleId=`
- `POST /api/apps/:id/requirements-doc/confirm?moduleId=`
- `GET/POST /api/apps/:id/requirements-doc/versions?moduleId=`
- 模板切换、rollback、restore、export、chat context 同样接受 moduleId（不传默认）。
- 所有现有服务函数增加可选 `moduleId` 参数；默认解析默认模块。

兼容行为：
- 单模块应用（含迁移后的 app1）确认需求仍按现有语义：模块 confirmed + 所有必选模块 confirmed → 设置 `apps.requirements_confirmed_at` 并进入 design（保持旧前端行为）。
- 多模块应用：`POST /requirements-doc/confirm` 只确认该模块，**不自动进入 design**；M3 UI 会调用新的 bundle confirm。
- 新增 `POST /api/apps/:id/requirements-bundle/confirm`：全部必选未归档模块 confirmed → 生成 bundle + 设置应用确认/进入 design；M2 先提供，M3 UI 使用。

### 4.3 模块与 bundle API

- `GET /api/apps/:id/requirements-modules?includeArchived=`
- `POST /api/apps/:id/requirements-modules`
- `PATCH /api/apps/:id/requirements-modules/:moduleId`
- `POST /api/apps/:id/requirements-modules/:moduleId/archive`
- `POST /api/apps/:id/requirements-modules/:moduleId/restore`
- `GET /api/apps/:id/requirements-bundle`（模块版本/确认/聚合 hash；不创建模块/文档）
- `POST /api/apps/:id/requirements-bundle/confirm`

命名可按现有风格调整，但语义固定。

### 4.4 app payload / summary

- `appPayload` 增加 `requirementModules` 摘要（id/key/title/status/version/required/archived/position），用于 M3 UI。
- 保持现有 `requirementDoc` 字段可读（默认模块摘要）。
- 不改变设计/交接包字段。

### 4.5 ID 全局唯一

- `collectOutlineIds` 要收集**全应用所有模块**的 scenes/epics/stories（含 archived）。
- `nextOutlineId` 在应用级 used 集合上分配；不同模块不能出现相同 `SCENE/EPIC/STORY` ID。
- 保存某模块章节时，global 合并要考虑其它模块数据；新增测试覆盖：两个模块都新增 Story → ID 不重复。

---

## 5. 不做 / 边界

- 不做模块 UI（M3）、设计表/设计 UI（M4）、设计输入/交接包/Change Set（M5/M6）、#8。
- 不改设计/交接包/Change Set 表。
- 不改真实 app1；不改现有前端页面（除类型兼容必要字段）。
- 不物理删除旧表/旧数据；保留 `*_legacy`。
- 不读取/打印 `.env`/凭据。

---

## 6. 测试

### 6.1 迁移（副本）

1. 复制一个含需求文档/章节/多版本/确认状态的应用 DB 到临时目录；跑迁移：
   - 默认模块创建；docs/sections/versions 数量/内容/版本/确认状态一致；
   - 旧 API 无 moduleId 读取结果与迁移前一致；
   - bundle v1 生成，hash 稳定；
   - 旧表 `*_legacy` 存在，新表接管；
   - 重复跑迁移幂等。
2. app1 副本（仅只读复制）：`GET requirements-doc`、版本列表、rollback 在临时后端通过。

### 6.2 模块/需求

- 模块 CRUD、默认模块、归档保留至少一个。
- 两模块各自保存同 section key（如 `problem`）互不影响；版本列表独立。
- 两模块新增 Story → 全局 ID 不重复。
- 模块确认：单模块仍进入 design；多模块不自动进入，bundle confirm 后进入。
- bundle 包含模块版本/hash/confirmed；确认前后 hash 变化；不创建文档/模块。
- 模板切换/rollback/export/chat context 按 moduleId 工作；不传默认。
- 旧 API/旧冒烟脚本兼容。

### 6.3 回归

```powershell
npm run build --prefix backend
npm test --prefix backend
npm run smoke:requirements --prefix backend
npm test --prefix frontend
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm run check:vue --prefix frontend
```

- 后端基线 157；前端 96；`smoke:requirements` 必须通过（旧 API 兼容）。
- 其他冒烟按时间跑 `design-handoff`/`change-set`（不涉及设计表变化）确认无回归。

### 6.4 真实迁移（不在实施会话执行）

- 主会话评审后：停止工作台 → 备份 `data/requirements.db`（含 WAL）→ 启动/执行迁移 → 验证 app1 需求/版本/设计/change set → 可回滚。
- 实施会话只提供迁移脚本/测试，不碰真实库。

---

## 7. 文档

- 本交接单追加 `## 8. 实施结果`（迁移/测试/偏差/未验证）。
- 更新 `docs/STATUS.md`：M2 完成 + 测试数 + 真实迁移状态。
- 更新 `docs/plans/2026-11-13-module-requirements-design.md` M2 状态。
- 不改 `AGENTS.md`（主会话评审后统一更新）。

## 8. 实施结果

实施日期：2026-11-13（实施会话）。状态：**已实施，待主会话评审**。范围严格按本交接单 §1—§9（只做 M2）。

### 8.1 schema（目标结构）

- `app_modules`（新）：`id/module_key/title/description/owner_label/required/position/archived_at/created_at/updated_at`，`UNIQUE(app_id, module_key)`，`idx_modules_app(app_id, position)`。
- `app_requirement_bundles`（新）：`id/app_id/version/modules_json/bundle_hash/change_set_id/created_at`，`UNIQUE(app_id, version)`，`idx_req_bundles_app_version`。
- `app_requirement_docs`：PK `(app_id, module_id)`（`module_id` 紧跟 `app_id`），其余列不变。
- `app_requirement_doc_sections`：PK `(app_id, module_id, section_key)`；`idx_req_sections_app_module(app_id, module_id, position)`。
- `app_requirement_doc_versions`：新增 `module_id`；唯一索引 `idx_req_versions_app_module_version(app_id, module_id, version)`；`id` 仍为 `INTEGER PRIMARY KEY AUTOINCREMENT`。
- `db.ts` 的基础 DDL 直接是目标结构：DDL 常量集中在 `requirements/module-migration.ts`（`MODULE_TABLE_DDL`/`REQUIREMENT_BUNDLE_DDL`/`REQUIREMENT_DOC_TABLE_DDL`），db.ts 与迁移共用，避免新旧库结构漂移；依赖 `module_id` 的索引（`REQUIREMENT_MODULE_INDEX_DDL`）在迁移之后创建（旧库迁移前还没有该列）。

### 8.2 迁移算法（单事务、幂等、fail-closed）

`backend/src/requirements/module-migration.ts`，**不 import `../db`**，接收 better-sqlite3 的 `Database`，导出：

- `migrateRequirementModules(database)`：执行迁移；
- `moduleMigrationStatus(database)`：只读状态（migrated/表/计数/legacy 计数/索引名），真实库副本比对与脚本 dry-run 用；
- `sha256Hex` / `bundleHashOfModules` / DDL 常量（db.ts 与脚本复用）。

步骤（`database.transaction()` 单事务）：

1. **幂等判定**：`PRAGMA table_info(app_requirement_docs)` 含 `module_id` → 直接返回（`alreadyMigrated:true`），不建模块/不改名/不插 bundle。
2. 建 `app_modules`、`app_requirement_bundles` 与三张目标结构表（`IF NOT EXISTS`），另建三张 `*_new`（显式列定义）。
3. 旧库若缺 C1/H1 后加的列，先 `ALTER TABLE` 补齐（`sections.data_json`、`versions.change_set_id`），再 copy。
4. 逐应用（`SELECT DISTINCT app_id FROM app_requirement_docs`）：
   - 有 `MOD-001` 则复用，否则插入默认模块（`randomUUID()`、`title=apps.name`、`required=1`、`position=0`）；
   - 显式列 copy docs/sections/versions 到 `*_new`（versions **显式保留 `id`**，`sqlite_sequence` 随显式最大值推进）；
   - 文档行数 ≠ 1 时中止（迁移不合并多行）。
5. 旧表 `ALTER TABLE ... RENAME TO *_legacy` → 新表 `RENAME TO` 正式名 → 建 `idx_req_*`/`idx_modules_app`。
6. 每个应用生成 bundle v1（`change_set_id=NULL`）。
7. 任何失败抛错（带“已回滚，旧表未改动”+ 原因），由 `db.ts` 直接抛出阻止启动（**fail-closed**）。

边界（§9.1.6）：只改三张需求表 + `app_modules` + `app_requirement_bundles`；**不写 `app_stage_events`**；不碰设计/交接包/变更单/会话/开发阶段表。旧表与旧索引都不 DROP：旧索引名（`idx_requirement_doc_sections_app`、`idx_requirement_doc_versions_app_version`）在表改名后仍归 legacy 表，新索引统一用 `idx_req_*`/`idx_modules_app`，不复用旧名。

固定哈希算法（代码注释已写明）：

- `docHash = sha256(content_md)`（hex 小写）；
- `bundleHash = sha256(JSON.stringify(entries))`；entries 按 `(position, module_key)` 排序，每条固定只取 `moduleId, moduleKey, docVersion, docHash, confirmed`（不含 `title`）；
- `modules_json` 落库含 `title`；无文档模块不进入 bundle（迁移只处理有文档的应用）。

只给“有 `app_requirement_docs` 行”的应用建默认模块；无文档应用由 `ensureRequirementDoc` 懒创建（`ensureDefaultModule`）。

### 8.3 API 清单

需求文档（`/api/apps/:id/requirements-doc`，**全部**支持可选 `moduleId`，缺省/空串 = 默认模块）：
`GET /`、`POST /preview`、`PUT /sections/:key`、`PUT /`、`PUT /template`、`POST /confirm`、`POST /outline/rebuild`、`POST /reopen`、`GET /versions`、`POST /versions`、`GET /versions/:v`、`POST /versions/:v/rollback`、`GET /export`、`GET|PUT /chat`（chat 历史仍应用级，见 8.9）。

`moduleId` 解析（§9.4.1）：GET 读 query；POST/PUT/PATCH 读 body 或 query（query 优先）；trim；空串/缺省 = 默认模块（懒创建）；未知 ID → 404「模块不存在」；已归档模块 **读允许、写 409「模块已归档」**（saveDocSection/saveDoc/switchDocTemplate/outline rebuild/confirm/reopen/rollback/manual version）。

模块（`/api/apps/:id/requirements-modules`，§4.3）：

- `GET /?includeArchived=` → `{ modules, defaultModuleId }`（只读；含文档摘要 docStatus/docVersion/docUpdatedAt/templateId）；
- `POST /` → 201 `{ module }`（仅需求阶段；`MOD-00N` + 空文档 v1 `source=template-change`）；
- `PATCH /:moduleId`（title/description/ownerLabel/required/position）；
- `POST /:moduleId/archive|restore`（至少保留 1 个未归档，否则 409）。

需求 bundle（`/api/apps/:id/requirements-bundle`，§4.3）：

- `GET /` → `{ bundle: { modules, bundleHash, allRequiredConfirmed, pendingModuleIds, latest } }`（**只读**：不建模块/文档/bundle、不产版本）；
- `POST /confirm` → 全部必选未归档模块 confirmed 才通过（否则 400 + `issues` 待确认模块列表），生成 bundle + 应用确认 + `status='design'` + `updateActiveChangeSet`；已确认幂等返回 `alreadyConfirmed:true`。

其他：

- `POST /api/apps/:id/chat`（`mode=doc`）接受 `moduleId`；
- `GET /api/apps/:id` 增加只读 `requirementModules` 摘要（id/moduleKey/title/required/archived/position/docStatus/docVersion）；`requirementDoc` 仍为默认模块摘要（不建文档/模块）；
- `DELETE /api/apps/:id` 事务内新增删除 `app_requirement_bundles`、`app_modules`；
- `POST /api/apps/:id/stage/confirm`（requirements）仍走默认模块。

**确认语义（§9.4.4—9.4.5，已按冻结值实现）**

- 仅 1 个未归档模块 → 与旧行为完全一致：模块 confirmed + `confirm` 版本 + `apps.status='design'` + `requirements_confirmed_at` + bundle v1 + `updateActiveChangeSet`；响应追加 `appConfirmed:true`；
- 多模块 → 只置该模块 confirmed，不改应用阶段/`requirements_confirmed_at`；响应 `appConfirmed:false` + `pendingModuleIds`；应用级由 `POST /requirements-bundle/confirm` 推进；
- `alreadyConfirmed` 幂等（不重复产 bundle/版本）；`reopen` 模块 → 模块 doc draft + 清 `apps.requirements_confirmed_at`（设计项目仍按旧行为退回 draft，M2 限制）。

### 8.4 ID 范围（§9.3）

- `normalizeOutlineSection` / `rebuildOutlineSection` 的 `global` 仍是**本模块**（引用校验 + 同标题沿用 ID），**没有**把其它模块数据塞进 `global`；
- 新增可选 `reservedIds`（全应用、含归档、跨所有模块）**只进入 `used` 占用集合**（分配新编号时跳过其它模块已占用 ID）；
- 显式 raw id 若在 `reservedIds` 但不在本模块 `global`/`previous` 中（= 属于其它模块）→ 丢弃并重新分配；
- 调用点（`saveDocSection` / `saveDoc` / `outline/rebuild` / `preview`）统一用 `modules.collectAppOutlineIds(appId)`（扫全应用 `data_json`，含归档模块）；
- 单测覆盖 §9.3 三条：①两个模块同名 Story 分配不同 ID（STORY-001 / STORY-002）；②模块 B payload 直接带模块 A 的 `STORY-001` → B 换 `STORY-003`，A 不变；③两模块同 section key 内容/版本互不影响。

### 8.5 改动文件

新增：

- `backend/src/requirements/modules.ts`（模块服务 + bundle 聚合 + 全应用 Outline ID + 新模块初始文档）
- `backend/src/requirements/module-migration.ts`（迁移/状态/哈希/共享 DDL）
- `backend/src/requirements/module-migration.test.ts`（7 项）
- `backend/src/requirements/modules.test.ts`（8 项）
- `backend/scripts/module-migration.ts`（`migrate:modules`）
- `backend/scripts/modules-smoke.ts`（`smoke:modules`）
- `backend/src/db-guards.ts` + `backend/src/db-guards.test.ts`（MF2 测试隔离硬保护）

修改：

- `backend/src/db.ts`（目标 DDL + 启动迁移 + 迁移后索引）
- `backend/src/requirements/doc.ts`（全部文档服务尾部可选 `moduleId`、模块标题、bundle/确认语义、reservedIds、归档写守卫）
- `backend/src/requirements/outline.ts`（`parseSectionData` 迁入、`reservedIds`、foreign raw id 拒绝）
- `backend/src/requirements/routes.ts`（doc `moduleId`、模块路由、bundle 路由）
- `backend/src/requirements/templates.ts`（模板使用计数改 `COUNT(DISTINCT app_id)`，文案仍“N 个应用”）
- `backend/src/requirements/types.ts`（`RequirementDoc` 追加 `moduleId/moduleKey`）
- `backend/src/apps/template-resolution.ts`（`appRequirementTemplate(appId, moduleId?)`；只读解析仍不建模块）
- `backend/src/apps/payload.ts`（`requirementModules` 摘要）
- `backend/src/apps/routes.ts`（挂载模块/bundle 路由、删除应用清理、stage/confirm 追加 `appConfirmed`）
- `backend/src/chat/service.ts`（doc 模式透传 `moduleId`）
- `backend/src/chat/service.test.ts`（**既有测试隔离修复**，见 8.8）
- `backend/package.json`（`test` 增加 3 个新测试文件；`migrate:modules`、`smoke:modules`）

未改：前端 `frontend/src`、设计表/设计服务/设计 UI、交接包、Change Set、`app_dev_phases`、`projects/`、`AGENTS.md`。

### 8.6 测试与命令结果（实际执行）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过（tsc，无输出） |
| `npm test --prefix backend` | **172/172 通过**（基线 157，+15：migration 7 + modules 8；must-fix 后最终 **178/178**，见 8.11） |
| `npm run smoke:requirements --prefix backend` | 通过（旧 API 兼容，默认模块） |
| `npm run smoke:modules --prefix backend` | 通过（端口 3419；单/多模块、隔离、ID、确认、bundle、归档、模板/rollback/export、删除清理） |
| `npm run smoke:change-set --prefix backend` | 通过（C1 变更循环无回归） |
| `npm run smoke:design-handoff --prefix backend` | 通过 |
| `npm run smoke:design --prefix backend` | 通过 |
| `npm test --prefix frontend` | 96/96 通过 |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过（全部 SFC 导入完整） |

实现过程中另做过一次“真实 app1 一致性快照副本”上的迁移/旧 API 验证（详见 8.7）；`npm test` 现不再打开仓库真实 DB（见 8.8）。

### 8.7 真实 app1 **副本**迁移比对

**重要：本次实施会话对真实 `data/requirements.db` 产生了越界写入（意外迁移）**。原因与现状：

- 既有测试 `src/chat/service.test.ts` 静态 import `./service` → 传递 import `../db`，且**没有设置 `RG_DATA_DIR`**；`npm test` 因此打开仓库真实库并执行启动 DDL。M2 在 `db.ts` 增加启动迁移后，第一次 `npm test` 于 **2026-11-13T07:20:24Z** 对真实库执行了迁移（commit 前基线/备份步骤未执行）。
- 已立即停止进一步影响：修复该测试（临时 `RG_DATA_DIR` + 动态 import，见 8.8），并验证此后 `npm test` 不再改真实库（`requirements.db-wal` mtime 未变化）。
- **内容无丢失**：真实库当前是“已迁移”状态，`*_legacy` 与目标表逐行一致（见下表）；回滚材料（legacy 表/旧索引）齐全。**未执行任何回滚写入**（遵守“不得写真实库”）。
- **运行态提醒**：3300 上运行的是旧 `dist`（进程 14:01 启动，未重启）。旧代码对需求文档的**写**路径（章节保存/确认/手动版本）会因 `module_id NOT NULL` 失败；读路径基本可用。`dist/` 已由新代码重建，按 `start.cmd` 重启即可一致（本会话未停/未重启真实实例）。

验证方式（只读 + 副本）：`better-sqlite3` `readonly` 打开真实库 → `db.backup(临时路径)` 取一致性快照 → 在**副本**上迁移/比对/跑旧 API。快照保留在 `C:\Users\icecream\AppData\Local\Temp\opencode\m2-app1-verify\snapshot.db`（主会话评审后可删除；同目录 JSON 为计数/hash 报告）。

与 §9 顶部基线逐项一致（真实库快照，只读比对）：

| 项 | 期望 | 实际 |
| --- | --- | --- |
| `apps` | app1「订单管理」status=development，需求/设计已确认 | 一致（nameLength=4、requirementsConfirmed=true、designConfirmed=true） |
| 需求文档 | 1 行，`builtin-prd`，confirmed，v24 | 一致（moduleKey=MOD-001、templateId=builtin-prd、status=confirmed、version=24） |
| 章节 | 13 | 一致（13；legacy 13；逐行 `markdown/data_json/title/level/kind/required/position/updated_at` 完全一致） |
| 版本 | 24（v1..v24） | 一致（24；legacy 24；逐行含 `id/version/source/change_set_id/sections_json/content_md/created_at` 完全一致；latest=confirm/v24） |
| 设计 | 1 / 5 / 3 / 11 | 一致（projects 1 / entities 5 / page_sets 3 / pages 11；designVersions 7、inputs 3；status=confirmed v7） |
| 交接包 | 2 | 一致（v1 + v2） |
| 变更单 | 2 | 一致（#1 completed / #2 completed base 需求 v16、设计 v5、交接 v1） |
| 会话 | 6 | 一致；`app_dev_phases` 4 |
| 模块 | — | MOD-001、titleLength=4、required=1、position=0；bundle v1 `bundleHash=aafe2ee81358bedddcfc61777b350a9522fc9ac3c2f908f2962646e67602071e`，entry `docVersion=24`、`docHash=33fab8dae1ff27f3464ba05ad6a725f41a9a4a2d14d328301ebfc264ec517f94`、confirmed=true |
| 旧 API（无 moduleId） | 默认模块、内容不变 | `GET /apps` requirementModules=1；`GET requirements-doc` 13 章节、MOD-001、v24/confirmed、`contentMd` length 11941、hash 与迁移前一致；`GET versions` 24（latest confirm/v24）；`GET versions/22` 13 章节；`GET requirements-bundle` latest v1、allRequiredConfirmed=true；`GET design` confirmed v7；`GET change-sets` 2 |
| 回滚 | 可用 | 已确认文档回滚 409（既有只读语义）；同副本新建应用 rollback v1→v3 通过（source=rollback） |

另做“迁移重放”：由上述快照把 legacy 表改名回主表、drop 新表/模块/bundle，重建为**迁移前旧结构**（docs 1 / sections 13 / versions 24，无 `module_id`），再跑 `migrate:modules --apply`：`appsMigrated=1`、模块 MOD-001、bundle v1（hash `e562bc71d29cb40089ac97fdacfb78f79e4f939e1d5b10e1dcca21a2a360467b` —— 与真实库不同，因为 `moduleId` 是重新生成的 randomUUID，`docHash` 相同）、legacy 1/13/24、设计/交接包/变更单/会话计数不变、逐行比对仍全 true。

### 8.8 与交接单的偏差（逐条）

1. **`chat/service.test.ts` 既有测试隔离修复**（未改任何断言）：该文件此前在 `npm test` 时打开真实 `data/requirements.db`（§8.7 事故根因）。改为临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` + `before()` 动态 import `./service`，并在 `after()` 关闭 DB、清理临时目录。属于安全修复，非业务行为变更。
2. **未 DROP 旧索引**：§9.1.4 的“删除旧索引”与 §9.1.5/“旧索引保留”存在张力；实现遵循 §9.1.5（新索引换名）+ 保留回滚材料，因此旧索引随表改名留在 `*_legacy` 上、全程未 DROP。迁移后 `PRAGMA index_list` 已由单测断言：新表只有 `idx_req_*`/`idx_modules_app`，legacy 表保留旧索引名。
3. **迁移不写 `app_stage_events`**：§3.1.6 标注“可选”，§9.1.6 明确迁移范围不含事件表，故未写事件；改用 `migrate:modules` 输出 + STATUS 记录。
4. **模板删除计数改 `COUNT(DISTINCT app_id)`**：模块化后一个应用可能有多行文档；文案仍是“N 个应用”（既有测试断言不变），避免把“模块数”当“应用数”。
5. **`smoke:modules` 默认端口 3419**（非 3411）：3411 已被 `design-ai-smoke` 默认占用，改用未占用端口（仍可 `MODULE_SMOKE_PORT` 覆盖）。
6. **`migrate:modules` 默认 dry-run**：只给 `--apply` 才写库；默认拒绝仓库真实库（`--allow-live` 且 `--apply` 才放行），避免误用。
7. **实施过程事故（编码）**：实施中一次 PowerShell 重写把 `requirements/doc.ts` 的非 ASCII 文本破坏（BOM/编码），随即用 `dist/requirements/doc.js`（迁移前构建产物，含全部中文注释/运行字符串）+ 本会话的完整改动记录**整文件重写复原**；已核对 46 条中文运行字符串与构建产物逐字一致，且 tsc/172 测试/全部冒烟通过。`doc.ts` 现为 UTF-8 无 BOM、LF。

未修改任何既有测试断言。

### 8.9 已知限制

- **设计阶段仍应用级**：设计项目/实体/页面集/版本/`app_design_inputs` 仍一行/应用，读取需求默认模块（M4 才按模块）；`reopen` 模块仍沿用“单设计项目退回 draft”（§9.4.6 M2 限制）。
- **模板切换不传播**：`PUT /template?moduleId=` 只重写该模块文档并同步应用默认模板；其它模块文档不动（M3 待定：是否切换时传播到所有模块）。
- **需求 doc 对话历史仍应用级**：`app_settings` key 未按模块拆分；`moduleId` 只影响 prompt 上下文。M3 可再按模块拆分。
- **Change Set 未按模块**：发起/取消/升级仍用默认模块（M5）；M2 不记录 `app_change_set_modules`。
- **交接包/设计输入/覆盖度**：仍按默认模块构建（M5/M6）。
- **需求 bundle 只在“模块确认（单模块）/bundle confirm”时生成**；自动保存/模板切换不产 bundle。`GET /requirements-bundle` 的 `bundleHash` 是当前内容实时聚合（可能未持久化），`latest` 是最近落库快照。
- **`POST /stage/confirm`（requirements）** 仍只确认默认模块；多模块应用应使用模块/bundle API。
- **`app_modules`/bundle 无软删除**：归档模块的文档/版本永久保留（设计如此）；删除应用才物理清理。
- **`moduleSummaries` 含归档模块**（payload 全量返回，M3 自行过滤）。
- **旧 API 写路径**：多模块应用不传 `moduleId` 的写入落到**默认模块**，可能不是用户以为的模块（M3 UI 必须显式传）。

### 8.10 未验证项

- **真实库的“停写 + 备份 + 主会话迁移”流程未按计划执行**（已被 8.7 的意外迁移取代）；主会话需决定：接受当前已迁移状态（推荐，内容已逐行校验）或另行回滚/重建。
- 未在**真实 3300 实例**上验证 M2 新代码（未重启/未停真实实例）；真实实例当前仍是旧 dist。
- 未做真实模型（需求/设计聊天）在**多模块**下的 E2E（M2 不含模型 prompt 改动；`smoke:modules` 不调模型）。
- 未做前端 UI（M3）：模块列表/切换/新增/归档/总览均未实现，`requirementModules` 字段暂无消费方。
- 未验证多模块 + Change Set + 交接包组合（M5/M6）。
- 未验证 SQLite 版本兼容性下限（依赖 `ALTER TABLE RENAME`/部分索引，SQLite ≥3.25；本机 better-sqlite3 自带版本通过）。
- 未评估大模块量（>50 模块）时的 `collectAppOutlineIds` 全表扫描性能。

### 8.11 主会话评审 must-fix（2026-11-13）

主会话评审结论：M2 架构/迁移/ID 范围/确认语义/路由均符合交接单；独立复跑 `npm run build/test --prefix backend`（172/172）、前端 96/96 + typecheck/build/check:vue、5 支冒烟全过，并用 canary 确认 `npm test` 不再改真实 `data/requirements.db`。真实库由实施会话意外迁移，用户已决定**接受并补正式验收**（主会话执行）。以下 4 项 must-fix + 2 项收尾已按要求完成，未扩大范围。

**MF1 迁移前自动备份（已修）**

- `module-migration.ts` 新增 `backupBeforeMigration(database, dataDir, options?)`：已迁移（`docs` 有 `module_id`）/无 `app_requirement_docs` 表/表为空 → `{ path: null, skipped }`，**不写文件**；否则同步 `VACUUM INTO` 生成 `requirements.db.pre-modules-<YYYYMMDD-HHmmss>.bak`（时间戳固定 **UTC**；同名依次 `-2`/`-3`，绝不覆盖），校验文件存在且 `size > 0` 后返回绝对路径；SQL 路径单引号双写转义；不 import `../db`、不打印正文。
- `db.ts` 在 `migrateRequirementModules(db)` **之前**调用；成功打印 `[db] 迁移前已备份需求库： <path>`；抛错直接 throw 阻止启动；已迁移/新库静默跳过（不刷日志）。
- 实测（临时旧库 fixture，`npx tsx` 脚本，只输出路径/大小）：首次 `requirements.db.pre-modules-20261113-074402.bak`（36864 B）；同一秒再次调用 → `...-2.bak`（36864 B，原文件未覆盖）；备份 readonly 打开 `hasModuleId=false`、docs 1 / versions 2、内容可查；迁移后再调用 → `path=null`、`skipped=已迁移（app_requirement_docs 已有 module_id）`、`bytes=0`、不新建 `.bak`。`db.ts` 接线实测（临时 `RG_DATA_DIR`）打印 `[db] 迁移前已备份需求库： ...pre-modules-20261113-074412.bak`，迁移后 `hasModuleId=true` 且备份 `hasModuleId=false`。

**MF2 测试隔离硬保护（已修）**

- 新增 `src/db-guards.ts`：`assertTestDataDirIsolation(env, dataDir)`；`NODE_TEST_CONTEXT` 存在且 `RG_DATA_DIR` 为空/未设置 → 抛错（含“未设置 RG_DATA_DIR”“拒绝打开仓库默认数据目录”），其它情况无操作；不 import 业务模块。
- `db.ts` 在解析 `dataDir` 后、打开数据库前调用。
- 新增 `src/db-guards.test.ts`（3 项：`NODE_TEST_CONTEXT`+无 `RG_DATA_DIR`（含空串/空格）抛错；有值不抛；无 `NODE_TEST_CONTEXT` 不抛），已加入 `package.json` test。
- 手工验证：`NODE_TEST_CONTEXT=child-v8` 且无 `RG_DATA_DIR` 时 import `src/db` → 抛“测试进程（NODE_TEST_CONTEXT=child-v8）未设置 RG_DATA_DIR，拒绝打开仓库默认数据目录（…\data）”，**未打开真实库**。

**MF3 取消变更恢复的多模块一致性（已修）**

- `restoreRequirementDocVersionConfirmed`：恢复模块后改用 `allRequiredModulesConfirmed(appId)` 判断；true 才写 `apps.requirements_confirmed_at`，否则显式置 NULL（单模块行为不变）。
- `modules.test.ts` 新增用例：两模块只确认模块一 → 恢复模块一后 `requirements_confirmed_at` 仍为 NULL 且 `allRequiredModulesConfirmed=false`；单模块确认 + 恢复后仍置位。

**MF4 老库缺列迁移用例（已补）**

- `module-migration.test.ts` 新增独立临时库 fixture：旧 DDL **不含** `sections.data_json` / `versions.change_set_id`；迁移后不报错、两列补齐、`data_json` 全 NULL、`change_set_id` 全 NULL、docs 1 / sections 2 / versions 2、版本行（`id/version/source/content_md`）逐行不变、doc `confirmed`/v6、默认模块 `MOD-001`、bundle 1 行；再次迁移 `alreadyMigrated=true` 且计数不变。

**收尾 A 文案准确性（已改）**

- `modules.createModule` 非需求阶段 409 文案：「当前阶段（X）不能直接新增模块；设计/开发阶段的模块变更入口将在 M3/M5 后续接入」（保留 `不能直接新增模块`，既有断言不变）。

**收尾 B 文档（已完成）**

- 本节 + `docs/STATUS.md` M2 段落（评审结论、最终测试数、真实库“已迁移 + 接受”、3 个 M3 待决项）；未改 `AGENTS.md` 与 `2026-11-13-main-review-handoff-module-m2.md`（主会话负责）。

**最终验证（must-fix 后复跑）**

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **178/178 通过**（原 172 + `db-guards` 3 + MF1/MF4 2 + MF3 1） |
| `npm run smoke:requirements` | 通过 |
| `npm run smoke:modules` | 通过 |
| `npm run smoke:change-set` / `smoke:design-handoff` / `smoke:design` | 通过 |
| `npm test --prefix frontend` / `typecheck` / `build` / `check:vue` | 96/96 + 全部通过（本轮未改前端，复核） |

新增测试：`src/db-guards.test.ts`（3）；`module-migration.test.ts`「MF1 迁移前备份…」「MF4 老库缺列…」；`modules.test.ts`「MF3 取消变更恢复…」。

---

## 9. 主会话评审前置约束（2026-11-13，实施前必读）

主会话已复核基线（后端 157/157、前端 96/96 实测通过）与真实 app1 只读清单：

```text
apps: app1「订单管理」status=development, requirements_confirmed_at=2026-11-13T02:00:38.609Z,
      design_confirmed_at=2026-11-12T08:35:07.316Z
app_requirement_docs: 1 行（template_id=builtin-prd, status=confirmed, version=24）
app_requirement_doc_sections: 13
app_requirement_doc_versions: 24（v1..v24）
app_design_projects: 1 / entities: 5 / page_sets: 3 / pages: 11
design_handoffs: 2 / app_change_sets: 2 / app_sessions: 6
```

真实迁移的验收基线就是上表；迁移后必须逐项一致（设计/交接包/变更单/会话表**完全不改**）。

以下为实现必须遵守的补充约束，与本交接单正文同等效力；如有冲突以本节为准：

### 9.1 schema 与迁移架构

1. `backend/src/db.ts` 基础 DDL 直接改成**目标结构**（`module_id` + 新主键/新索引名），新库不再走重建。迁移模块只处理“旧库”。
2. 迁移实现放 `backend/src/requirements/module-migration.ts`，导出 `migrateRequirementModules(database)` 与 `moduleMigrationStatus(database)`；参数是 `better-sqlite3` 的 `Database` 实例，**不得** `import '../db'`（否则与 `db.ts` 循环依赖）。`db.ts` 在 `ensureColumn` 之后同步调用一次；失败必须抛错并阻止启动（fail-closed，不要静默降级）。
3. 幂等判定：读 `PRAGMA table_info(app_requirement_docs)`，有 `module_id` 即视为已迁移并直接返回；重复调用不得再建模块/再改名/再插 bundle。
4. 重建顺序（**单事务**，`db.transaction()`）：建新表（`*_new`）→ copy（显式 copy 全部列，versions 的 `id` 也显式保留）→ 删除旧索引 → 旧表 `RENAME TO *_legacy` → 新表 `RENAME TO` 正式名 → 建新索引。旧表/旧索引保留，禁止 DROP `*_legacy`。
5. **索引名不能复用**（SQLite 索引名全局唯一，rename 后旧索引仍在 legacy 表上）：新索引统一换名，例如 `idx_req_docs_app_module`、`idx_req_sections_app_module`、`idx_req_versions_app_module_version`、`idx_modules_app`。不要依赖 `CREATE ... IF NOT EXISTS` 覆盖定义变化。
6. 迁移范围只限三张需求表 + `app_modules` + `app_requirement_bundles`；不碰设计/交接包/变更单/会话/开发阶段表。
7. 只给“有 `app_requirement_docs` 行”的应用建默认模块（`MOD-001`、title=`apps.name`、required=1、position=0、id=`randomUUID()`）；无文档应用不建模块，由 `ensureRequirementDoc` 懒创建。多个应用各自独立迁移。
8. 迁移时生成 bundle v1：`modules_json` 为 `[{moduleId,moduleKey,title,docVersion,docHash,confirmed}]`，`change_set_id=NULL`。

### 9.2 固定哈希算法（写进代码注释）

- `docHash = sha256(content_md)`（hex 小写；与 design input 的 docHash 语义不同，M5 再接）
- `bundleHash = sha256(JSON.stringify(modules))`，`modules` 按 `(position, module_key)` 排序后序列化，字段固定为 `moduleId,moduleKey,docVersion,docHash,confirmed`
- 必须有用例：同内容重复生成 hash 相同；内容变化 hash 变化。

### 9.3 全局 ID：必须区分“引用范围”和“占用范围”

这是本批最容易写出隐蔽 bug 的点。`normalizeOutlineSection` / `rebuildOutlineSection` 目前只有一个 `global`：

- `global` 还参与**同标题匹配**（`findTitleMatch`）。若把其它模块数据塞进 `global`，模块 B 新建同名 Story「查看列表」会继承模块 A 的 `STORY-xxx` → 跨模块 ID 冲突/归属错乱。
- 正确做法：`global` 保持**本模块**范围（用于引用校验、同标题沿用 ID）；新增可选 `reservedIds`（全应用、含 archived、跨所有模块）只用于 `collectOutlineIds` 的 used 集合，保证新分配的编号跳过其它模块已占用的 ID。
- `used` 的来源顺序：本模块 `global` + `previous` + 全应用 `reservedIds`。
- 必测：①两个模块各新增同名 Story → ID 不同；②模块 B 的 payload 直接带模块 A 的 `STORY-001` → B 换新 ID，A 不变；③两个模块分别保存同 section key（`problem`）内容/版本互不影响。

### 9.4 API 与确认语义（冻结）

1. `moduleId` 解析：query（GET）/ body 或 query（POST/PUT/PATCH）取，trim；空串/缺省 → 默认模块（懒创建）。未知 ID → 404「模块不存在」。已归档模块：**读允许、写 409「模块已归档」**。
2. 现有路径/响应字段不变；默认模块的 `GET requirements-doc` 响应与迁移前一致（新增模块字段只能追加）。服务函数用**尾部可选参数** `moduleId?: string` 扩展，避免改动现有调用点顺序。
3. 模块路由按 §4.3 挂在 `/api/apps/:id/requirements-modules`；`requireApp` 之后做应用存在性校验。
4. 模块确认：只校验/确认该模块。全部必选未归档模块确认后：
   - **仅 1 个未归档模块** → 与今天完全一致：`apps.status='design'`、`requirements_confirmed_at`、`updateActiveChangeSet`；响应追加 `appConfirmed:true`。
   - **多模块** → 只置该模块 confirmed，**不改**应用阶段/`requirements_confirmed_at`，响应 `appConfirmed:false` + `pendingModuleIds`；由 `POST /requirements-bundle/confirm` 推进应用级。
5. `requirements-bundle/confirm`：全部必选确认才通过（否则 400 + pending 列表）；生成 bundle 快照 + 应用确认 + `updateActiveChangeSet`；`alreadyConfirmed` 语义保留。
6. reopen 模块：该模块 doc → draft，清 `apps.requirements_confirmed_at`；沿用现有“单设计项目退回 draft”的行为（M2 限制，M4 再按模块），并在实施结果里写明该限制。scope 门禁逻辑不变。
7. `GET /requirements-bundle` **只读**：不创建模块/文档/bundle，不产版本。

### 9.5 模块服务

`backend/src/requirements/modules.ts`：`listModules / defaultModule / ensureDefaultModule / createModule / updateModule / archiveModule / restoreModule / moduleSummaries`。

- `module_key`：现有（含归档）最大 `MOD-00N` + 1；position 取末尾。
- 新模块立即按应用需求模板建空文档 v1（`source=template-change`），标题 `${app.name} · ${module.title} 需求文档`；**默认模块**标题保持 `${app.name} 需求文档`（旧行为/测试不变）。
- 归档：至少保留 1 个未归档模块，否则 409；归档默认模块仅在存在其它未归档模块时允许；不物理删除文档/版本。
- 切换模板：沿用现有 `syncAppRequirementTemplate`（应用级默认），**不重写其它模块文档**；把“模板切换是否应传播到所有模块”列为 M3 待定项写进实施结果。

### 9.6 删除应用 / payload 收尾

- `DELETE /api/apps/:id` 事务内新增删除 `app_requirement_bundles`、`app_modules`。
- `appPayload` 增加只读 `requirementModules` 摘要（不建文档、不建模块、不产版本）。
- `apps.post('/:id/stage/confirm', stage=requirements)` 保持走默认模块。

### 9.7 迁移验证脚本（必须有）

新增 `backend/scripts/module-migration.ts` + `package.json` `"migrate:modules": "tsx scripts/module-migration.ts"`：

- 用法 `--db <path> [--dry-run|--apply]`；打开**指定文件**，不经过 `db.ts`（不要在脚本里 import db/config）。
- 默认拒绝作用在仓库内 `data/requirements.db`（解析成绝对路径比较）；确需真实库时另加 `--allow-live` 且必须显式同时给 `--apply`（主会话真实迁移优先用“停服后重启触发”，脚本只用于副本比对）。
- 输出仅计数/长度/hash/表名/模块摘要，**不打印文档正文、不打印 `.env`/凭据**。

### 9.8 必测清单（最低）

1. `module-migration.test.ts`：旧结构 fixture（在临时库手写旧 DDL）→ 迁移后 docs/sections/versions 逐行一致（含 `id`/`version`/`source`/`change_set_id`/`confirmed_at`/`data_json`）；`*_legacy` 存在；**二次迁移幂等**；旧索引名已被替换且新索引存在；bundle v1 内容/hash 正确；无文档应用不建模块；多应用互不影响。
2. `modules.test.ts`：CRUD/归档/恢复/≥1 模块/懒创建默认模块/两模块隔离/§9.3 三条 ID 用例/模块确认单 vs 多/bundle confirm/bundle GET 不写库/hash 稳定性/模板切换/rollback/export/chat context 按模块。
3. 真实 app1 **副本**迁移一次性验证（不进 `npm test`）：用 `better-sqlite3` 的 `db.backup(tmp)` 从 live 库取一致性快照（WAL 下不要裸 copy .db）→ 迁移副本 → 与 §9 顶部清单逐项比对（13/24/v24/confirmed/builtin-prd；设计 1/5/3/11；交接包 2；变更单 2）→ 旧 API 读默认模块内容 hash 与迁移前一致 → rollback/版本列表可用 → bundle v1 hash 记录。
4. 回归：后端 157 + 新增全绿；前端 96/96；typecheck/build/check:vue；`smoke:requirements`、新增 `smoke:modules`、`smoke:change-set`、`smoke:design-handoff`、`smoke:design` 全过（临时实例、临时端口，跑完释放）。
5. 实施结果必须回传实际测试数（基线 157 → ?）、每条命令结果、与本节偏差、未验证项。

### 9.9 明令禁止

- 不得对仓库内真实 `data/requirements.db` 跑迁移/写入；不得改 `projects/`；不得停/改 3300 上的真实工作台。
- 不得读取/打印 `.env` 或任何凭据；不得把文档正文/真实业务内容贴进日志或文档。
- 不得改前端 UI（M3）、设计表/设计 UI（M4）、设计输入/交接包/Change Set 模块化（M5/M6）、`app_dev_phases`、#8 预览。
- 不得删除/改名 `*_legacy` 表；不得物理删除模块/版本。
