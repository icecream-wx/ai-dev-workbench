# 模块化设计 M4：设计表/设计 UI 模块化（实施交接单，无旧数据迁移）

日期：2026-11-13
用途：新开实施会话执行；主会话评审。
状态：**已完成（2026-11-13，待主会话评审）**；实施结果见 §10。
上游：`docs/plans/2026-11-13-module-requirements-design.md`（§4.3/§5.2/§6.2/§12.1）、M2 交接单（`docs/plans/2026-11-13-module-m2-implementation-brief.md` §8/§8.11）、M3 交接单（`docs/plans/2026-11-13-module-m3-implementation-brief.md` §8/§8.9）、`docs/STATUS.md`「2026-11-13 政策」。
范围：**只做 M4**——设计表按模块、设计服务/路由 `moduleId`、模块级设计版本/确认/输入 stale、设计 UI 模块切换与总览、原型模板应用级切换、多模块交接包/变更单门禁。
**不做**：设计输入 v2/bundle（M5）、应用级交接包模块化与 U7 模块阶段（M6）、#8 预览（M7）、登录/权限。
**不做旧数据迁移**（政策）：真实库当前 `apps=0`；旧设计 schema + 0 应用 → 重建空表；旧 schema + 有应用/设计数据 → **fail-closed**，不写行级迁移、不建 `*_legacy`。

---

## 1. 目标

1. 每个需求模块对应一个设计项目：独立的实体/页面集/页面/版本/确认/需求输入 stale。
2. 现有设计 API 全部兼容：不传 `moduleId` 时使用默认模块（第一个未归档模块）。
3. 设计 UI 支持模块切换；模块级设计确认；应用级设计总览（各模块状态/版本/PNG 完整性）。
4. 原型模板切换保持应用级一致（所有未归档模块一起，二次确认；任一已确认 → 409）。
5. 多模块时阻止应用级交接包生成（M6 接入），避免只带默认模块的“半成品交接包”。
6. 实体关系允许跨模块引用（全应用实体 ID），校验/覆盖度提示不阻塞。
7. 需求模块 reopen 只把该模块设计项目退回 draft（不再应用级）。

---

## 2. 数据模型（目标结构；无迁移）

### 2.1 目标 DDL（`db.ts` 基础 schema 直接使用）

```sql
CREATE TABLE app_design_projects (
  app_id                TEXT NOT NULL,
  module_id             TEXT NOT NULL,
  prototype_template_id TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'draft',
  version               INTEGER NOT NULL DEFAULT 1,
  source_doc_version    INTEGER,
  source_input_id       TEXT,
  source_input_hash     TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  confirmed_at          TEXT,
  PRIMARY KEY (app_id, module_id)
);
CREATE INDEX idx_design_projects_app_module ON app_design_projects(app_id, module_id);

-- 以下表加 module_id（NOT NULL），其余列不变：
app_design_entities   + module_id；索引 idx_design_entities_app_module(app_id, module_id, position)
app_design_page_sets  + module_id；索引 idx_design_page_sets_app_module(app_id, module_id, position)
app_design_pages      + module_id；索引 idx_design_pages_app_module(app_id, module_id, position)
app_design_versions   + module_id；唯一索引 idx_design_versions_app_module_version(app_id, module_id, version)
app_design_inputs     + module_id；唯一索引 idx_design_inputs_app_module_hash(app_id, module_id, doc_hash)
```

- 实体/页面集/页面 ID 仍为全局主键（全应用唯一），模块只做归属/分组。
- 页面集归属于单模块；页面的 `module_id` 与所属页面集一致（查询用，写入时以页面集为准）。
- 现有设计图片/HTML 路径不改（按 page id 区分，无冲突）。
- `apps`/需求/交接包/Change Set/开发阶段表不改。

### 2.2 启动升级（`backend/src/design/module-migration.ts`）

导出 `ensureDesignModuleSchema(database)`（接收 better-sqlite3 `Database`，**不 import `../db`**）与 `designModuleSchemaStatus(database)`：

1. 目标结构已就绪（`PRAGMA table_info(app_design_projects)` 含 `module_id` 且其余五表含 `module_id`）→ no-op。
2. 旧结构且**无应用/无设计数据**（`apps` 为空且六表行数为 0）→ 单事务：`DROP TABLE` 旧设计六表（及旧索引）→ 建目标表 + 新索引。记录 `[db] 设计表已升级为模块化结构（空库）`。
3. 旧结构且**存在应用或设计数据** → 抛错阻止启动（fail-closed）：
   `检测到旧设计表且存在应用/设计数据；按当前政策不做数据迁移，请先删除应用或重置 data/requirements.db 后重启。`
4. 失败抛错由 `db.ts` 阻止启动；不建 `*_legacy`、不写回填。

`db.ts` 在需求模块迁移之后调用；目标表索引在基础 DDL/升级后创建。

---

## 3. 服务/API（全部设计接口尾部可选 `moduleId`）

通用解析：query（GET）/ body 或 query（POST/PUT）；空/缺省 → 默认模块（`app_modules` 第一个未归档）；未知 → 404「模块不存在」；归档模块：读允许、写 409「模块已归档」。实现建议复用 `requirements/modules.ts` 的 `resolveModule/defaultModule/assertModuleWritable`（新增依赖方向 design → requirements/modules，不得反向）。

### 3.1 项目/读取

- `GET /api/apps/:id/design?moduleId=` → 单模块载荷（`project/entities/pageSets/readiness/requirement/input/stale/coverage/warnings/chat`），与现结构兼容；新增：
  - `module: { id, key, title, status: 'draft'|'confirmed' }`
  - `otherModuleEntities: [{ id, name, tableName, moduleId, moduleKey, moduleTitle }]`（只读，供跨模块关系选择）
  - `allModulesConfirmed: boolean` + `pendingModuleIds: string[]`（应用级设计门禁）
- `GET /api/apps/:id/design/templates`（#7）：原型模板解析按模块项目 → 应用默认 → 全局默认（`appPrototypeTemplate(appId, moduleId?)`）。
- `PUT /api/apps/:id/design/template`：
  - `scope='module'`（缺省）→ 只切当前模块项目（旧行为）；
  - `scope='app'` → 预览/确认后切全部未归档模块：每模块 `prototype_template_id` 更新、`status='draft'`、`confirmed_at=NULL`、`version+1`、`source='template-change'` 快照；任一未归档模块已确认 → 409 + `issues`（moduleId/key/title），不写任何模块；归档不参与；同步应用默认原型模板。
  - 新增 `POST /api/apps/:id/design/template/preview` body `{ templateId }`：**只读**，返回逐模块 `{ moduleId,moduleKey,title,status,version,fromTemplateId,toTemplateId,blocked }`、`blockedModules`、`canApply`。
- `PUT /design/entities`、`POST /design/generate-entities`、`PUT /design/page-sets`、`POST /design/page-sets/generate`、`PUT /design/page-sets/:pageSetId`、`PUT /design/pages/:pageId`、`POST /design/pages/:pageId/snapshot`、`GET /design/pages/:pageId/image|html`：全部按模块作用域读写；页面/页面集跨模块操作 → 404 或 409（不得写入其它模块）。
- `GET /design/input` / `POST /design/input/sync`：按模块；`buildDesignInput(appId, moduleId)` 只读该模块需求文档；`app_design_inputs` 唯一 `(app_id, module_id, doc_hash)`；`DesignInputBundle` 增加 `moduleId/moduleKey/moduleTitle`（bundleVersion/hash 留 M5）。
- `GET /design/coverage?moduleId=`：模块内覆盖度 + 该模块 Story 未覆盖列表；应用级汇总（各模块覆盖率）可同时返回，但不得改变旧字段。
- `GET /design/versions?moduleId=` / `POST /design/versions` / `GET /design/versions/:v` / `POST /design/versions/:v/rollback`：按模块；版本快照只含该模块实体/页面集；回滚只恢复该模块。
- `POST /design/confirm?moduleId=`：只校验/确认该模块（实体/页面集/页面/PNG、stale）；确认产 `confirm` 版本（该模块）；响应追加 `appConfirmed`（全部必选未归档模块设计 confirmed）、`pendingModuleIds`。
- `POST /design/reopen?moduleId=`：只把该模块项目退回 draft；不触碰其它模块。
- `GET/PUT /design/chat?moduleId=`：聊天历史按模块（settings key `app.<appId>.designChat.<moduleId>`，旧 key 仅默认模块只读回退，不删不改）。
- 模块创建（M3 `createModule`）：设计项目**懒创建**（首次 `GET /design?moduleId` 或设计写操作时 `ensureDesignProject(appId, moduleId)`），使用应用默认原型模板、空实体/页面集、v1 + `template-change` 快照；需求阶段不写设计表。

### 3.2 交接包 / Change Set 门禁（M4）

- `POST /api/apps/:id/design/handoff/generate` 与 `.../handoff/preview`（若存在）：当未归档模块数 > 1 → 409「多模块交接包在 M6 接入；当前请先归档多余模块或等待 M6」。单模块保持旧行为（应用级交接包、设置 `apps.design_confirmed_at`）。
- 已有交接包读取/下载不变（真实库当前无交接包）。
- `POST /api/apps/:id/change-sets`：多模块（未归档 > 1）时 409「多模块变更在 M5 接入」；单模块沿用旧逻辑（默认模块设计版本/需求版本）。
- 变更单取消恢复（`restoreDesignVersionConfirmed`）：单模块保持旧行为；按模块参数化（默认模块）。
- `appPayload`：`designProject` 仍为默认模块摘要（旧字段不变）；新增只读 `designModules` 摘要 `[{moduleId,moduleKey,title,status,version,entityCount,pageSetCount,pageCount,missingImages,confirmedAt}]` 与 `designModulesConfirmed`（全部必选已确认）。不建项目/不产版本。

### 3.3 校验

- 实体关系目标改为“全应用实体 ID 集合”校验；目标属于其它模块 → 允许 + warning（`跨模块依赖`），不阻塞。
- 页面 `entityId` 允许引用其它模块实体（全局 ID），给 warning；页面集必须属于当前模块。
- 页面集/页面写入必须校验 `module_id` 与当前模块一致，防止跨模块串写。
- `validateEntities` 的表名/字段名唯一性仍按模块内校验；跨模块同名表给 warning 不阻塞（M6 交接包再统一）。

---

## 4. 前端（设计 Studio 模块化）

新增（`frontend/src/design/`）：

- `DesignModuleRail.vue`：模块列表（复用 M3 的模块数据来源 `/requirements-modules`；显示模块名、设计状态、版本；切换；只读提示；不提供新增/归档——模块 CRUD 只在需求阶段）。
- `DesignOverviewDialog.vue`：应用级设计总览：每模块设计状态/版本/实体/页面集/页面/缺图、`confirmed/total`、pending 列表、“全部模块确认后可生成交接包（M6）”提示。
- `DesignTemplateSwitchDialog.vue`：原型模板应用级切换（preview 逐模块 + 二次确认 + blocked 列表）。

修改：

- `DesignStudio.vue`：顶部/左侧模块切换；所有 API 调用带 `moduleId`；切换前 flush 未保存（实体/页面集/页面各自保存链）；切模块重置实体选中、页面集展开、版本弹窗、聊天、滚动；只读 = 当前模块 confirmed 或应用 development/completed；模块级“确认设计/重新编辑设计”；总览入口；多模块时隐藏/禁用“生成交接包”并提示 M6。
- `design/api.ts`：全部函数尾部可选 `moduleId`；新增模块列表复用 `requirements/api.ts` 或新 `listAppModules`；新增 template preview/app switch、design overview 数据、跨模块实体选择器数据。
- `EntityDesignTab.vue`：关系目标选择器列出全应用实体（当前模块优先，其它模块分组/只读标记）；跨模块选择给提示不阻塞；保存仍只写当前模块实体。
- `PrototypeTab.vue` / `EntityDesignTab.vue` / `RequirementCoveragePanel.vue` / `DesignVersionsDialog.vue` / `DesignChatPanel.vue` / `DesignSyncDialog.vue`：按模块显示/操作；版本/覆盖度/聊天按模块。
- `AppShell.vue`：设计页传入 app status（已有 M3 模式）；关注 `designProject` 摘要不再代表全部模块，顶栏文案可显示“默认模块/多模块”提示（不阻塞）。

布局/响应式：

- ≥1280：模块 rail（约 220px）+ 现有左侧实体/页面集面板 + 画布；总览/模板切换用弹窗。
- ≤1024：模块 rail 与左侧面板折叠为抽屉（互斥、遮罩/Esc）；画布全宽。
- ≤768：单栏 + 抽屉；工具栏换行不溢出。
- 深浅色沿用 `shared/theme.css` token；不新增裸色值。

---

## 5. 兼容与边界

- 旧单模块应用/旧 API（不传 moduleId）行为不变；默认模块路径必须与 M3 前一致（单模块确认设计、版本、回滚、交接包）。
- 真实库当前 `apps=0`：M4 启动时设计表为空 → 重建目标结构（无数据迁移）；需求表已是目标结构，不动。
- 多模块：交接包/Change Set 在 M5/M6 接入前明确 409，不生成半成品。
- 需求 reopen：只影响同模块设计项目；其它模块设计确认/版本不动。
- 应用级设计总览只读，不建项目/不产版本。
- 不做旧数据兼容（无 `*_legacy`、无回填、无 app1）。

---

## 6. 测试

### 6.1 后端（基线 187）

新增 `backend/src/design/module-migration.test.ts`：

1. 旧设计 schema（无 module_id、projects PK=app_id）+ 0 应用/0 数据 → 升级为目标结构；六表空、索引/PK 正确、无 `*_legacy`；再跑幂等。
2. 旧 schema + 一条假应用/设计数据 → 抛错且不改库（fail-closed）。
3. 目标 schema → no-op。

新增/扩展 `backend/src/design/module-ui-support.test.ts`（或 `module-design.test.ts`）：

4. 两模块设计隔离：实体/页面集/页面/版本互不影响；默认模块缺省；未知 moduleId 404；归档模块设计读允许写 409。
5. 模块设计确认：只确认该模块；`appConfirmed` 仅全部必选确认后 true；pending 正确；确认产该模块 `confirm` 版本。
6. 版本：每模块独立 v1..vN；回滚只恢复该模块；手工保存版本按模块。
7. 设计输入：`buildDesignInput(appId, moduleId)` 只含该模块需求；`(app,module,docHash)` 唯一；`stale` 按模块（改模块 A 需求 → 仅 A stale）。
8. 需求 reopen 模块 A → 仅 A 设计项目 draft；B 仍 confirmed。
9. 跨模块关系：模块 B 实体 relation 指向模块 A 实体 → 允许 + warning；页面 `entityId` 跨模块允许 + warning；页面集跨模块写入拒绝。
10. 多模块交接包 generate/preview → 409；单模块交接包旧行为回归（`smoke:design-handoff` 必须过）。
11. 多模块 Change Set start → 409；单模块旧行为回归（`smoke:change-set`）。
12. 应用级模板切换 preview 只读、blocked（任一 confirmed）、apply 全模块 `template-change` 版本；`scope='module'` 旧行为。
13. `appPayload.designModules` 摘要只读、不建项目/版本。
14. 多模块 design chat 历史隔离 + 旧 key 回退（默认模块）。

### 6.2 前端单测（基线 107）

- 设计模块选择/回退、进度（confirmed/total）、缺图统计、跨模块实体分组、模板 preview 可用性等纯函数（新增 `design/design-module-helpers.js` + `.test.mjs`），加入 `frontend/package.json` test 脚本。
- 现有测试全绿；改 `design/api.ts` 签名时保持默认参数。

### 6.3 Playwright（临时 data/projects + 端口，`OPENCODE_AUTO_START=false`）

1. 新建应用 → 两模块需求 → 完成需求阶段 → 设计页默认模块 A：生成实体/页面集/页面 → 确认 A（A 只读）→ 切 B（空设计）→ 生成 B → 确认 B → 总览 2/2、pending 0、生成交接包禁用并提示 M6。
2. 版本：A/B 各自版本列表/回滚互不影响；A 的版本弹窗不出现 B 数据。
3. 需求 reopen A → 仅 A 设计 draft/stale；B 仍 confirmed；同步 A 输入 → 确认 A。
4. 跨模块关系：B 的实体选择 A 的实体作为关系目标 → 提示但可保存；A 数据不被改写。
5. 原型模板应用级切换：预览两模块、确认后两模块 `template-change` 版本/re-templated；任一模块 confirmed 时被阻止并列出。
6. 只读：development/completed 时设计页只读；单模块应用仍可生成交接包（旧路径）。
7. 1024/768：模块 rail/左侧面板抽屉互斥、无横向溢出、深浅色无白底；0 console/0 意外 API≥400。
8. 旧 API 兼容：不传 moduleId 的冒烟页面/接口仍工作。

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

基线：后端 187、前端 107；M4 后按实际回传。真实模型 E2E 由主会话在评审后执行（实施会话不调真实模型）。

---

## 7. 文档

- 本交接单追加 `## 10. 实施结果`（改动文件、schema/升级、API、测试数、Playwright、偏差、未验证）。
- 更新 `docs/STATUS.md`（M4 完成 + 测试数 + 真实库 apps=0 升级说明）。
- 更新设计稿 M4 状态（仅状态文字）。
- 不改 `AGENTS.md`/接续单（主会话负责）。

---

## 8. 主会话评审前置约束（实施必读）

1. **不做旧数据迁移**：不建 `*_legacy`、不写回填、不读真实 `data/`；旧 schema + 有数据必须 fail-closed。
2. 旧接口默认行为不变：不传 `moduleId`=默认模块；`PUT /design/template` 不传 `scope`=只切当前模块；旧冒烟必须过。
3. 多模块交接包 / Change Set 必须 409，不得生成只含默认模块的结果。
4. 模块级确认/版本/回滚/输入 stale 必须严格按模块隔离；需求 reopen 只影响同模块设计。
5. 跨模块关系允许 + warning，不阻塞；页面集不得跨模块写入。
6. 不新增依赖（UI 用现有 Element Plus/原生），不新增 Pinia store（除非必要），不新增裸色值。
7. 不改真实 `data/`/`projects/`、不停/改 3300、不读 `.env`；验证只用临时目录与临时端口。
8. 实施结果回传：改动文件、测试数（187/107 → ?）、Playwright 场景/截图/错误数、与本节偏差、未验证项。

---

## 9. 风险与已知限制（预期）

- 设计服务函数多、调用链长（design/service/input/handoff/changesets/payload/template-resolution）；必须全量 `tsc` + 172→187 回归，避免漏掉 app 级查询。
- 页面图片/HTML 文件不按模块迁移；按 page id 存储，路径无需变化；M6 交接包 `prototypes/<module>/` 再组织。
- 多模块交接包/变更单在 M4 是 409；用户需等 M5/M6。
- 真实库当前无应用，M4 升级无数据损失风险；若未来有应用数据，必须先按政策删除/重置（fail-closed 会提示）。
- 设计聊天历史按模块为 M4 新增 key；旧 app 级 key 仅默认模块只读回退。

---

## 10. 实施结果

**实施日期**：2026-11-13。状态：**已完成（待主会话评审）**。范围严格按 §2—§6；**未做旧数据迁移**（无 `*_legacy`、无行级回填），未触碰真实 `data/`/`projects/`、未停/改 3300、未读 `.env`、未调真实模型。

### 10.1 改动文件

新增（后端）
- `backend/src/design/module-migration.ts`：目标设计六表 DDL/索引 + `designModuleSchemaStatus` + `ensureDesignModuleSchema`（目标 no-op / 空库重建 / 有数据 fail-closed）。
- `backend/src/design/module-migration.test.ts`（5 项）。
- `backend/src/design/module-design.test.ts`（12 项：模块隔离/确认门禁/版本/输入 stale/reopen/跨模块/交接包与变更单门禁/应用级模板/`appPayload`/chat/HTTP 接线）。

修改（后端）
- `backend/src/db.ts`：设计六表改用目标 DDL；需求迁移之后调用 `ensureDesignModuleSchema` + 目标索引；更新表头注释。
- `backend/src/design/service.ts`：全部设计读取/写入/版本/确认/reopen/输入同步/图片/chat 按 `moduleId`；`designModulesState`（只读总览）；`previewAppProtoTemplateSwitch`/`switchAppProtoTemplate`；跨模块关系/页面校验（允许 + warning）；多模块 `appConfirmed`/`pendingModuleIds`；`deleteDesignData` 仍按 app 清理。
- `backend/src/design/input.ts`：`app_design_inputs` 按 `(app,module,docHash)`；`buildDesignInput(appId, moduleId?)` 只读该模块需求；bundle 增加 `moduleId/moduleKey/moduleTitle`。
- `backend/src/design/routes.ts`：所有设计接口可选 `moduleId`（query 优先、body 其次）；`PUT /template` `scope='app'`；新增 `POST /template/preview`；confirm 返回 `appConfirmed/pendingModuleIds`；chat 模块守卫与 `legacyFallback`。
- `backend/src/design/types.ts`：`DesignProjectPayload` 增加 `module/otherModuleEntities/allModulesConfirmed/pendingModuleIds`；`DesignInputBundle` 增加模块字段；新增 `DesignModuleRef/DesignOtherModuleEntity`。
- `backend/src/requirements/doc.ts`：需求 reopen 只把**同模块**设计项目退回 draft。
- `backend/src/apps/template-resolution.ts`：`appPrototypeTemplate/resolveAppTemplates` 支持模块；`GET /api/apps/:id/templates?moduleId=`。
- `backend/src/apps/payload.ts`：新增只读 `designModules`、`designModulesConfirmed`（`designProject` 旧字段保留=默认模块摘要）。
- `backend/src/apps/routes.ts`：templates 端点接受 `moduleId`。
- `backend/src/handoff/design-service.ts`：未归档模块 > 1 时 preview/generate 409（M6）；页面绑定实体按全应用 ID 校验（跨模块 warning）。
- `backend/src/changesets/service.ts`：多模块 start 409（M5）；设计项目基线/取消恢复按默认模块。
- `backend/src/chat/service.ts`：design 模式 prompt 使用 `moduleId` 对应设计项目。
- `backend/package.json`：test 脚本加入 2 个新测试文件。

新增（前端）
- `frontend/src/design/DesignModuleRail.vue`（模块切换/设计状态/版本/缺图/总览与原型模板入口；不提供增删/归档）。
- `frontend/src/design/DesignOverviewDialog.vue`（应用级设计总览：状态/版本/实体/页面集/页面/缺图、confirmed/total、pending、M6 提示；只读）。
- `frontend/src/design/DesignTemplateSwitchDialog.vue`（原型模板应用级切换：模板选择 → 逐模块 preview → 二次确认 → blocked 列表）。
- `frontend/src/design/design-module-helpers.js` + `design-module-helpers.test.mjs`（7 项纯函数单测）。

修改（前端）
- `frontend/src/design/api.ts`：全部设计函数尾部可选 `moduleId`；新增 `previewDesignTemplateSwitch/switchAppDesignTemplate`；confirm 返回应用级门禁字段。
- `frontend/src/design/types.ts`：payload/input 模块字段。
- `frontend/src/design/DesignStudio.vue`：模块 rail + 切换前 flush（chat/实体/页面集/页面）、切模块重置 focus/弹窗、模块级确认/重新编辑、设计总览、原型模板应用级切换、多模块隐藏/禁用交接包并提示 M6、`appStatus` 只读（development/completed）、1024/768 模块抽屉（与对话互斥）。
- `frontend/src/design/EntityDesignTab.vue`：关系目标列出其它模块实体（分组、跨模块提示）；保存/生成带 `moduleId`。
- `frontend/src/design/PrototypeTab.vue`：页面/页面集/生成/截图/版本/单模块模板切换带 `moduleId`；图片 URL 带 `moduleId`。
- `frontend/src/design/DesignChatPanel.vue`：按模块加载/保存/流式对话；`flushSave` 暴露给切换；旧 key 回退提示。
- `frontend/src/design/DesignVersionsDialog.vue`、`DesignSyncDialog.vue`：按模块版本/输入同步。
- `frontend/src/workbench/api.ts`：`AppInfo.designModules/designModulesConfirmed` + `DesignModuleSummary`。
- `frontend/src/workbench/AppShell.vue`：向 DesignStudio 传 `app-status`。
- `frontend/package.json`：test 脚本加入 `design-module-helpers.test.mjs`。

未改：`shared/theme.css`（复用现有 token，无新增裸色值）、需求/开发/变更单/交接包渲染、EOS 模板、`projects/`、`AGENTS.md`、接续单。

### 10.2 schema / 升级

- 设计六表目标结构直接进 `db.ts`：`app_design_projects` PK `(app_id, module_id)`；entities/page_sets/pages/versions/inputs 增 `module_id`；唯一索引 `(app_id,module_id,version)`、`(app_id,module_id,doc_hash)`；新增 `idx_design_*_app_module`，保留 `idx_design_pages_set`。
- `ensureDesignModuleSchema`（db.ts 在需求迁移后调用）：目标结构 no-op；旧结构 + `apps=0` 且六表空 → 删旧表重建空表；旧结构 + 有应用/设计数据 → 抛错阻止启动（不建 `*_legacy`、不写回填）。
- 真实库当前 `apps=0`，下次启动会走“空库重建”分支（本次实施未启动 3300、未触碰真实 `data/`）。

### 10.3 API（M4）

- 设计全部接口：`GET /design?moduleId=`、`/input`、`/coverage`、`/versions*`、`/chat`；写接口 body 或 query 可选 `moduleId`。
- 新增 `POST /api/apps/:id/design/template/preview`（只读逐模块）；`PUT /design/template` 支持 `scope='app'`（缺省/`module`=旧行为）。
- `POST /design/confirm` 返回 `project/alreadyConfirmed/appConfirmed/pendingModuleIds/module`。
- `GET /api/apps/:id` 增加 `designModules`、`designModulesConfirmed`；`GET /api/apps/:id/templates?moduleId=`。
- 多模块 `handoff/preview|generate` → 409（M6）；多模块 `POST /change-sets` → 409（M5）。

### 10.4 测试与验证

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **204/204 通过**（基线 187 + 5 迁移 + 12 模块设计） |
| `npm run smoke:requirements --prefix backend` | 通过 |
| `npm run smoke:modules --prefix backend` | 通过 |
| `npm run smoke:change-set --prefix backend` | 通过 |
| `npm run smoke:design-handoff --prefix backend` | 通过 |
| `npm run smoke:design --prefix backend` | 通过 |
| `npm test --prefix frontend` | **114/114 通过**（基线 107 + 7） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |

新增后端测试覆盖：旧结构空库重建/幂等、旧结构有应用或有设计数据 fail-closed、目标 no-op、无表创建；两模块实体/页面集/页面/版本隔离、默认模块缺省、未知 404、归档读/写；模块确认 `appConfirmed/pending`；版本独立与回滚隔离；输入唯一与 stale 按模块；需求 reopen 单模块；跨模块关系/页面绑定 warning 且 A 不改写、页面集跨模块写入 404；多模块交接包/Change Set 409 且不落库；应用级模板 preview 只读/blocked/apply 全模块 template-change/`scope=module` 回归；`appPayload.designModules` 只读；chat 隔离/旧 key 回退/未知与归档守卫/HTTP 接线。

### 10.5 Playwright（临时 data/projects，端口 3425，`OPENCODE_AUTO_START=false`）

- 环境：`RG_DATA_DIR`/`RG_PROJECTS_DIR` 指向 `C:\Users\icecream\AppData\Local\Temp\m4-e2e-*\`，后端托管已构建 `frontend/dist`；`playwright` 1.59.0（`E:\work_space_primeton\node_modules`）；脚本为仓库根临时 `.tmp-m4-e2e.cjs`（跑完删除）。需求/设计数据用 API 预置（同 M3 做法），M4 模块切换/确认/总览/版本/跨模块关系/模板切换/只读/响应式走真实 UI。
- 场景：两模块需求确认 → 设计页默认 A（MOD-001）→ UI 生成页面集 + 确认 A（只读）→ 切 B（0 页面集）→ 生成/确认 B → 总览 **2/2、全部已确认** → 交接包按钮禁用 + M6 提示；A/B 版本弹窗与 API 数量一致；B 新增关系自动指向 A 实体（跨模块提示可见、保存成功、A 未被改写）；模板应用级 preview 在 A confirmed 时列出阻止且 apply 禁用；解除后应用到全部模块（两模块 template-change、版本 +1、应用默认模板同步）；需求 reopen A 仅 A draft、B confirmed，确认+同步+重确认 A 后回设计；单模块 development 设计只读且交接包弹窗可打开；1024 模块 rail 抽屉+遮罩+对话互斥；768 抽屉；深色无白底；不传 moduleId 的旧 API 仍为默认模块。
- 结果：**46 项断言全部通过、12 张截图、0 console error / 0 pageerror / 0 非预期 API≥400**。截图与 `summary.json`：`C:\Users\icecream\AppData\Local\Temp\m4-e2e-v0B909\shots\`（临时目录，可删）。

### 10.6 与交接单的偏差 / 已知限制

1. **templates 端点**：新增只读 `GET /api/apps/:id/design/templates?moduleId=`（与 #7 的 `GET /api/apps/:id/templates` 同一解析）；`/api/apps/:id/templates` 也接受可选 `moduleId`。显式未知 moduleId 在只读解析中回退应用默认（不 404），与“模板删除/损坏静默回退”一致。
2. **应用级模板切换对“无设计项目”的模块**：只更新已有项目的模块（版本 +1 + `template-change`），未预建项目；这些模块后续懒创建时使用新的应用默认模板。预览中它们显示 version 0 / `fromTemplateId=null`。
3. **`PUT /design/template` `scope='app'` 返回**：`{ template, modules, changedModuleIds }`（不返回单模块 payload）；前端应用后整页重拉。
4. **`GET /design/coverage`**：仍返回模块内覆盖度（旧字段不变）；应用级各模块汇总通过 `appPayload.designModules`/设计总览提供，未塞进该响应。
5. **设计 rail**：只列未归档模块（不提供新增/归档/恢复）；归档模块设计仍可按 `moduleId` 读取，但设计页无入口（需求页可查看归档）。
6. **单模块模板切换入口**：保留 PrototypeTab 既有“模板库”单模块切换（`scope=module` 旧行为），另在 rail 提供应用级切换入口。
7. `_designInputs` 的 id 增加 app 短 hash + moduleKey，避免跨应用/跨模块同内容主键冲突（hash/版本语义不变）。
8. 未验证：<768 移动端、真实长对话滚动/对比度、多人并发；真实模型 E2E（按交接单由主会话评审后执行）；真实 3300 启动升级（本次未动真实 `data/`）。

