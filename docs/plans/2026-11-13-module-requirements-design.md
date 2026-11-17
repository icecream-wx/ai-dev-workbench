# 模块化需求 + 设计（#6）设计稿（讨论稿）

日期：2026-11-13
状态：**已定稿（2026-11-13）；M2、M3、M4、M5 已实施并评审；app1 已按“开发前期不做旧数据兼容”政策删除，真实库 apps=0、需求/设计表均已模块化；M4 及后续不做旧数据迁移（见 §9）**。M2 实施交接单：`docs/plans/2026-11-13-module-m2-implementation-brief.md`（§8 实施结果、§8.11 评审 must-fix、§9 约束）；M3 交接单：`docs/plans/2026-11-13-module-m3-implementation-brief.md`（§8 实施结果、§8.9 评审 must-fix）；M4 交接单：`docs/plans/2026-11-13-module-m4-implementation-brief.md`（§10 实施结果）；M5 交接单：`docs/plans/2026-11-16-module-m5-implementation-brief.md`（§10 实施结果）。
上游：`docs/plans/2026-11-10-requirements-stage-doc-design.md`、`docs/plans/2026-11-12-u7-phased-development-design.md`、`docs/plans/2026-11-13-app-templates-brief.md`、`docs/STATUS.md`。
关联：#7 创建应用选模板（已实现，提供模板解析）；#8 需求阶段原型预览（依赖本文模块 UI）。

---

## 1. 已确认决策

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | 模块粒度 | 每个模块是一份**完整 PRD**：应用创建时选的模板每一节都复制一份 |
| 2 | 设计模块 | **设计阶段同样按模块**：需求模块与设计模块一一对应；每个模块有自己的实体、页面集/页面原型、版本、确认 |
| 3 | 模板 | 所有模块共用应用创建时选的需求模板 + 设计原型模板；暂不支持每模块不同模板 |
| 4 | 版本 | 每个模块独立的**需求版本 + 设计版本**；应用层维护聚合 bundle/handoff |
| 5 | 需求确认门禁 | 每个模块独立确认；全部必选模块确认后，用户显式点“完成需求阶段”才进入设计 |
| 6 | 设计确认门禁 | 每个模块独立确认；全部必选模块设计确认后，才允许生成应用级开发交接包 |
| 7 | 变更范围 | 发起变更时选择受影响模块，默认全选；未选模块需求和设计版本都不动 |
| 8 | ID | `SCENE/EPIC/STORY`、实体/页面/页面集 ID 全应用全局唯一；模块只做归属/分组 |
| 9 | 模板与预览 | 需求阶段原型预览使用 #7 的模板解析（设计项目 > 应用默认 > 全局默认） |
| 10 | 多人协作 | 先做模块负责人/状态标签；真正权限/锁/并发控制等登录/角色接入 |
| 11 | 存量 | app1 迁移为“默认模块”，需求与设计都归入该模块；保留内容/版本/ID；不物理删除 |
| 12 | 交接包形态 | 应用级一个聚合交接包，内部按模块组织；开发仍是一个应用/代码库 |
| 13 | 实体/页面归属 | 实体、页面集、页面归属单模块；允许实体关系跨模块引用（全局 ID），页面集不跨模块 |
| 14 | U7 开发阶段 | **模块阶段 + 模块内 Epic 阶段**（分层）；不再只做 base + Epic 平铺 |
| 15 | 部分模块变更 | 设计过期**按模块**：只 stale 选中模块；应用级交接包整体 stale，等全部模块重新确认后重生成 |
| 16 | U7 模块阶段 | 模块阶段仅分组/里程碑，**不单独开会话**；实际会话只绑 Epic 阶段 |
| 17 | 模块摘要 | 不单独调模型生成模块摘要；模块阶段聚合展示各 Epic 摘要/进度 |
| 18 | 跨模块 FK | 允许实体关系引用其它模块实体；设计校验提示但不阻塞 |
| 19 | 实施 | 先设计稿评审，再分阶段实施；#8 在模块 UI 之后 |

---

## 2. 术语

- **模块（Module）**：业务域/业务场景的统一容器，例如“商品管理”“订单管理”。一个模块同时拥有：
  - 一份完整需求 PRD；
  - 一组实体/关系；
  - 页面集/页面/原型截图；
  - 需求版本 + 设计版本 + 确认状态。
- **默认模块**：存量单应用迁移后的模块；名称建议用应用名（如“订单管理”）。
- **需求 Bundle**：应用下全部模块需求文档的聚合快照（模块版本/hash 映射 + 聚合 hash）。
- **设计 Bundle / 交接包**：应用下全部模块设计（实体/页面/版本）聚合后生成的开发交接包；开发阶段仍是一个应用、一个代码库。
- **必选模块**：必须确认后才能进入下一阶段的模块；当前默认所有未归档模块都是必选。

---

## 3. 目标模型

```text
App
├── Module A（商品管理）
│   ├── Requirement Doc A（完整 PRD，v3，confirmed）
│   └── Design A（实体/页面集/页面/原型，v2，confirmed）
├── Module B（订单管理）
│   ├── Requirement Doc B（完整 PRD，v1，draft）
│   └── Design B（尚未开始）
└── Module C（...）

需求阶段：模块级确认 → 全部必选确认 → 显式“完成需求阶段”
设计阶段：模块级设计/确认 → 全部必选设计确认 → 生成应用级交接包
开发阶段：一个应用代码库；交接包内含各模块章节/阶段
```

### 3.1 模块生命周期

| 阶段 | 允许操作 |
| --- | --- |
| 需求阶段（未确认） | 新增模块、编辑、归档（未被设计/交接包引用时） |
| 需求阶段（部分确认） | 可新增模块；已确认模块需 reopen 才能改 |
| 设计阶段 | 不能直接新增/删模块；必须发起“需求+设计”变更并选择模块 |
| 开发/已完成 | 同上；变更单选择模块 |

规则：
- 模块删除 = 归档（`archived_at`），不物理删除；被设计/交接包/历史版本引用时保留历史。
- 模块在需求阶段可直接创建；设计/开发后必须走 Change Set。
- 新增模块复制应用需求模板 + 空设计项目；设计模板同样使用应用默认原型模板。
- 所有未归档模块默认必选；可选模块概念先不做（字段保留）。

### 3.2 版本模型

**模块需求版本**
- 每个模块文档独立 `version`；现有 checkpoint 语义不变（自动保存不产版本；确认/手动/模板切换/AI 应用/回滚/恢复产版本）。
- 模块需求独立 `draft/review/confirmed`。

**模块设计版本**
- 每个模块设计项目独立 `version`；实体/页面集/页面变更、确认、模板切换、AI 生成、回滚、恢复产版本。
- 模块设计独立 `draft/confirmed`；每个模块确认自己的实体/页面/PNG。

**应用聚合**
- `app_requirement_bundles`：每次需求模块确认/变更确认后生成快照（模块需求版本/hash + 聚合 hash + changeSetId）。
- 应用设计聚合不新建表（建议）：以各模块设计版本映射 + 交接包版本为准；Change Set 记录模块设计 base/current；交接包 `design_handoffs` 保存模块设计版本映射。
- 兼容字段：现有 `doc_version/doc_hash` 保留为聚合版本/聚合 hash；新代码以 bundle 为准。

---

## 4. 数据模型（建议）

### 4.1 统一模块表 `app_modules`

```sql
CREATE TABLE app_modules (
  id            TEXT PRIMARY KEY,          -- randomUUID，全局唯一
  app_id        TEXT NOT NULL,
  module_key    TEXT NOT NULL,             -- 稳定 key（MOD-001 / slug），展示/交接
  title         TEXT NOT NULL,
  description   TEXT,
  owner_label   TEXT,                      -- 先标签，不是权限
  required      INTEGER NOT NULL DEFAULT 1,
  position      INTEGER NOT NULL,
  archived_at   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE(app_id, module_key)
);
CREATE INDEX idx_modules_app ON app_modules(app_id, position);
```

> 模块是需求/设计共用的同一实体，因此不叫 `app_requirement_modules`。

### 4.2 需求表加 `module_id`

- `app_requirement_docs`：主键 `app_id` → `(app_id, module_id)`。
- `app_requirement_doc_sections`：主键 `(app_id, section_key)` → `(app_id, module_id, section_key)`。
- `app_requirement_doc_versions`：唯一 `(app_id, version)` → `(app_id, module_id, version)`。

SQLite 需“建新表 → 迁移 → 改名”事务；旧表可保留 `*_legacy` 直到验证通过。

### 4.3 设计表加 `module_id`

- `app_design_projects`：主键 `app_id` → `(app_id, module_id)`；每个模块独立 `status/version/source_input_id/source_input_hash`。
- `app_design_entities`：加 `module_id`；索引 `(app_id, module_id, position)`；实体 ID 仍全局唯一。
- `app_design_page_sets`：加 `module_id`；一个页面集只属于一个模块。
- `app_design_pages`：加 `module_id`（便于查询；也可从页面集 join）。
- `app_design_versions`：加 `module_id`；唯一 `(app_id, module_id, version)`。
- `app_design_inputs`：加 `module_id`；唯一 `(app_id, module_id, doc_hash)`；每个模块一条独立需求输入。
- 原型模板：仍应用级共享（`apps.prototype_template_id` / 全局默认），不按模块区分。

### 4.4 需求 bundle 快照（已确认建表）

```sql
CREATE TABLE app_requirement_bundles (
  id            TEXT PRIMARY KEY,
  app_id        TEXT NOT NULL,
  version       INTEGER NOT NULL,
  modules_json  TEXT NOT NULL,   -- [{moduleId,moduleKey,title,docVersion,docHash,confirmed}]
  bundle_hash   TEXT NOT NULL,
  change_set_id TEXT,
  created_at    TEXT NOT NULL,
  UNIQUE(app_id, version)
);
```

### 4.5 Change Set 的模块版本

```sql
CREATE TABLE app_change_set_modules (
  change_set_id       TEXT NOT NULL,
  module_id           TEXT NOT NULL,
  req_base_version    INTEGER,
  req_base_hash       TEXT,
  req_current_version INTEGER,
  req_current_hash    TEXT,
  design_base_version INTEGER,
  design_base_hash    TEXT,
  design_current_version INTEGER,
  design_current_hash    TEXT,
  PRIMARY KEY(change_set_id, module_id)
);
```

- 发起变更写入选中模块（默认全部未归档）。
- 需求阶段只允许编辑选中模块；未选模块保持 confirmed。
- 设计阶段只允许编辑选中模块的设计；未选模块设计保持 confirmed。
- 取消恢复只恢复选中模块的需求/设计 base 版本，并重新生成需求 bundle。
- 应用级交接包在任一模块变更后标 stale，需要重新生成。

### 4.6 设计输入 v2（按模块）

- `app_design_inputs` 每模块一条，绑定该模块需求版本/hash；
- 新增应用级 `bundle_version/bundle_hash`（引用需求 bundle）或冗余在每条输入；
- `input_json` 仍只含该模块的 Scene/Epic/Story（不塞全部模块），模块信息由 `module_id` + bundle 提供；
- 前端 `DesignInputBundle` v2 增加 `moduleId/moduleKey/moduleTitle` + `bundleVersion/bundleHash`；
- 覆盖度：按模块计算 + 应用级汇总。

### 4.7 交接包

应用级一个交接包（开发仍是一个应用/代码库），内含模块：

- `manifest.json`：
  ```json
  {
    "requirementsBundle": { "version": 12, "hash": "..." },
    "designModules": [{ "id": "...", "key": "...", "title": "...", "version": 3, "hash": "..." }],
    "modules": [...]
  }
  ```
- `01-REQUIREMENTS.md`：模块索引 + 每个模块完整 PRD（`## 模块：商品管理（需求 v3）`）。
- `02-DATA-MODEL.md`：按模块列实体/关系/DDL。
- `03-PAGES.md`：按模块列页面集/页面/页面规格；PNG 在 `prototypes/<module>/`。
- `04-PLAN.md`：按模块/Epic 给实施顺序与阶段建议。
- `05-CHANGES.md`：按模块 diff；未选模块标“未变更”。
- 历史交接包保留模块版本映射；旧交接包无模块字段 → 兼容旧逻辑/只读。

---

### 4.8 U7 开发阶段（模块 + Epic 两层）

- `app_dev_phases` 增加：
  - `module_id TEXT`
  - `parent_key TEXT`（模块阶段 key；Epic 阶段指向模块行）
  - `phase_kind TEXT`（`module` / `epic`；可选，也可从 key 推导）
- `manifest.phases` 每项增加 `moduleId/moduleKey/parentKey`；模块阶段在前，Epic 阶段在其后。
- 会话仍绑定 Epic 阶段的 `dev_phase_id`；模块阶段只做分组/里程碑展示，不单独开会话。
- 模块阶段不单独调模型摘要；展示模块进度 + 各 Epic 阶段摘要（聚合）。
- 阶段条/弹窗按模块分组；`04-PLAN.md` 每模块：模块目标/完成标准 + Epic 阶段列表。
- 交接包阶段数量/规模统计按模块汇总；U6 阈值逻辑不变（统计总数）。

## 5. 确认门禁

### 5.1 需求

- 模块确认：现有 `confirmRequirementDoc` 按模块；校验该模块必填/Story/验收。
- 应用级“完成需求阶段”：
  - 条件：全部必选未归档模块 `confirmed`；
  - 动作：生成需求 bundle 快照、`apps.requirements_confirmed_at`、进入 design；
  - 显式按钮（不自动跳转）。

### 5.2 设计

- 模块设计确认：校验该模块实体/页面集/页面/PNG（沿用现有 readiness + PNG 硬校验，但按模块过滤）。
- 跨模块 FK：允许实体关系引用其它模块实体；设计校验/覆盖度提示“跨模块依赖”，不阻塞确认。
- 应用级“完成设计 / 生成交接包”：
  - 条件：全部必选模块设计 `confirmed`、无模块 stale、所有页面 PNG 齐全；
  - 动作：生成应用级交接包并进入 development；
  - 交接包生成后任一模块变更 → 交接包 stale，需要重新生成。

### 5.3 变更

- 发起变更选择模块；需求+设计都围绕选中模块。
- 选中模块：需求 reopen → 确认 → **该模块设计输入 stale** → 同步 → 模块设计确认。
- 未选模块：需求/设计版本、设计输入、确认状态都不动。
- 应用级交接包在选中模块需求/设计变化后 stale；全部模块设计确认后重新生成。
- 应用级“设计总览”显示每个模块的 stale/确认/PNG 状态，不因单个模块变化让其它模块重新确认。

---

## 6. UI 信息架构

### 6.1 需求阶段

```text
左侧：模块列表（新增/排序/负责人/状态/版本/必选）
中间：当前模块完整 PRD（章节/预览/源码/AI 对话/版本/确认）
右侧/顶部：需求总览（模块卡片、确认进度、聚合 bundle 版本、“完成需求阶段”）
```

### 6.2 设计阶段

- 顶部/左侧模块切换，与需求同一组模块；
- 当前模块显示现有 Design Studio 全部内容：实体设计、页面原型、覆盖度、版本、确认；
- 应用级“设计总览”：每个模块的设计版本/确认状态/缺失 PNG；
- 全部模块设计确认后显示“生成交接包并进入开发”；
- 设计模板应用级共享；切换模板影响所有模块（二次确认，设计回草稿）。

### 6.3 开发阶段

- 开发页仍是一个应用、一个原生 build 会话；
- U7 阶段改为**两层**：
  - 模块阶段（分组/里程碑，不单独开会话）；
  - 模块内 Epic 阶段（实际执行/会话/摘要）；
  - 交接包 `04-PLAN` 按模块组织：模块目标/完成标准 + 该模块 Epic 阶段；
  - 阶段条/弹窗按模块分组显示，当前 Epic 阶段高亮；
  - 会话仍绑定 Epic 阶段；模块阶段聚合展示各 Epic 摘要/进度。
- 会话可显示当前模块/阶段（后续可选）。

### 6.4 #8 需求原型预览

- 模块 tab；当前模块粗略线框 + “全部模块”切换；
- 使用 #7 resolver 的原型模板（设计项目模块模板 > 应用默认 > 全局默认）；
- 不调模型、不产 PNG、不参与交接包；文档版本变化自动刷新。

> **2026-11-17 调整（用户决策）**：原型预览定位为"提前到需求阶段的页面集产物"（Epic→页面集、Story→页面），入口改为**需求大纲树每个模块下的独立节点「原型预览」**，不做单独的全模块聚合视图，线框为纯骨架。详见 `docs/plans/2026-11-17-m7-requirements-prototype-preview-design.md` §0。

---

## 7. API 草案

保持现有路径，新增 module 维度；未传 moduleId 时回退默认模块（兼容旧脚本）：

**模块**
- `GET /api/apps/:id/modules`
- `POST /api/apps/:id/modules`（需求阶段；设计后仅 Change Set）
- `PATCH /api/apps/:id/modules/:moduleId`（title/description/owner/required/position）
- `POST /api/apps/:id/modules/:moduleId/archive|restore`

**需求**
- `GET /api/apps/:id/requirements-doc?moduleId=`
- `PUT /api/apps/:id/requirements-doc/sections/:key?moduleId=`
- `POST /api/apps/:id/requirements-doc/confirm?moduleId=`
- `GET/POST /api/apps/:id/requirements-doc/versions?moduleId=`
- `GET /api/apps/:id/requirements-bundle`
- `POST /api/apps/:id/requirements-bundle/confirm`（全部必选确认 → 进入设计）

**设计**
- `GET /api/apps/:id/design?moduleId=`
- 现有实体/页面集/页面/版本/确认/交接包接口加 moduleId（缺省默认模块）
- `POST /api/apps/:id/design/handoff/generate`（应用级；校验全部模块确认）

**Change Set**
- 创建 body 增加 `moduleIds`（默认全选）
- 历史/取消返回模块需求/设计版本映射

**模板**
- `GET /api/apps/:id/templates`（#7 已实现；需求返回当前模块/应用模板，原型返回设计项目/应用/全局解析）

兼容：
- 旧 API 无 moduleId → 默认模块；
- 旧前端/冒烟脚本可工作；
- 迁移后默认模块 ID 稳定。

---

## 8. 设计输入 / 覆盖度 / 交接包细节

- `buildDesignInput(appId, moduleId)`：只读该模块需求 + bundle 元信息；
- 模块设计输入 stale：该模块需求版本/hash 与 `app_design_inputs` 不一致；
- 覆盖度：模块内 + 应用级汇总（模块列表显示覆盖率/未覆盖 Story）；
- `requirementRefs` 全局 ID；页面集/页面绑定 moduleId；
- 交接包只包含已确认模块；未确认/缺失 PNG 阻塞；
- 设计变更单 `05-CHANGES` 按模块 + 实体/页面 diff；
- U7 交接包规模/阶段：
  - 规模统计按全部模块汇总；
  - 阶段按“模块阶段 + 模块内 Epic 阶段”生成：模块行是分组/里程碑，Epic 行是可执行阶段；
  - `app_dev_phases` 增加 `module_id` + `parent_key`（或 `parent_id`），`manifest.phases` 带 `moduleId/moduleKey/parentKey`；
  - 阶段条/弹窗按模块分组；会话绑定 Epic 阶段；模块阶段只展示进度/汇总，不单独开会话、不单独调模型摘要；
- 跨模块 FK：允许实体关系引用其它模块实体；设计校验/交接包提示跨模块依赖，不阻塞；DDL/实体按全局 ID 生成。

---

## 9. 旧应用迁移（政策更新：不兼容，2026-11-13）

**政策（2026-11-13，用户确认）**：工作台开发前期未定版，**大框架调整默认删除旧应用、不做数据迁移/兼容**；只有用户明确要求兼容时才迁移。原先的 app1 迁移方案作废：

- app1 已删除（`projects/app1` 有仓库外 zip 备份；DB 中 app1 全部数据与 `*_legacy` 已清理），当前 `apps=0`。
- M2 的需求模块迁移代码保留为“旧库安全网”（空库/无应用可用；真实库已无应用），不再为 app1 回滚保留 legacy/bak。
- M4 起设计表升级：目标 schema 已存在 → no-op；旧 schema + 0 应用 → 重建空表；旧 schema + 有应用/设计数据 → **fail-closed** 提示删除应用/重置 DB，不写行级迁移。
- 真实 E2E 用新建应用；用户会在全链路通过后重新创建应用跑全程。

---

## 10. 多人协作（边界）

- 当前无登录/角色：`owner_label` 只是标签，不能阻止他人编辑，不能做“每人只能看自己模块”。
- 接入登录/角色后：
  - 模块 owner 用户 id；
  - 模块读写权限、编辑锁/租约；
  - 模块版本乐观锁/冲突提示；
  - 审计日志。
- 本期先保证模块独立版本 + 操作边界，不承诺权限隔离。

---

## 11. 分阶段实施

| 阶段 | 内容 | 依赖 |
| --- | --- | --- |
| M1 | 设计稿评审 + 迁移/备份方案 | 本文 |
| M2 | `app_modules` + 需求表重建 + 默认模块迁移 + 模块 API（兼容旧无 moduleId）✅ 2026-11-13 已实施并评审（app1 后按政策删除；`docs/STATUS.md`「M2 完成」「2026-11-13 政策」） | M1 |
| M3 | 需求模块 UI（列表/切换/新增/归档/负责人/总览/模块确认/完成需求阶段）✅ 2026-11-13 已实施并评审（交接单 §8/§8.9） | M2 |
| M4 | 设计表加 module_id + 设计项目/实体/页面集/页面/版本/设计输入按模块 + 设计模块 UI（**无旧数据迁移**：空库重建/有数据 fail-closed）✅ 2026-11-13 已实施并评审，真实库空库升级完成（交接单 §10） | M2/M3 |
| M5 | 需求 bundle + 设计输入 v2 + 覆盖度模块化 + Change Set 模块选择/取消 ✅ 2026-11-16 已实施并评审（交接单 §10） | M4 |
| M6 | 应用级交接包模块化（01—05/manifest/prototypes）+ U7 模块/Epic 两层阶段 + 全部模块设计确认门禁 | M5 |
| M7 | #8 需求阶段确定性原型预览（模块 tab，复用 #7 模板解析） | M3/M4 |
| M8 | 登录/角色后的模块权限/锁（后续） | 外部 |

每阶段单独交接单；M2/M5/M6 涉及迁移/下游，必须主会话评审后再继续。

---

## 12. 已定稿的默认值（2026-11-13）

以下按推荐值定稿，不再逐条讨论：

- 设计聚合表先不加；靠模块设计版本 + 交接包/Change Set 记录映射。
- app1 默认模块用应用名“订单管理”。
- 模块负责人先做自由文本标签（不是权限）。
- #8 预览支持“当前模块 + 全部模块”切换。（2026-11-17 调整为：每模块一个「原型预览」节点，不做全模块聚合视图；见 M7 设计稿 §0）
- 所有未归档模块默认必选、按 position 排序；可选模块先不做。
- `04-PLAN` 模块阶段包含“模块目标/完成标准 + Epic 阶段”。
- 设计原型模板切换时所有模块设计回草稿、二次确认（保持全应用模板一致）。

仍可在实施中调整的点（不阻塞 M2）：模块阶段 UI 的呈现细节、模块摘要展示形式、跨模块依赖提示文案。

---

## 12.1 M3 已确认决策（2026-11-13 用户确认，覆盖原“M3 待决项”）

1. **模块新增只能在需求阶段**。设计阶段不提供“直接新增模块”；需要新增模块时走同一条变更/回退流程：**先回到需求阶段 → 加模块并确认 → 设计 → 开发**。
   - 设计阶段：使用“重新编辑需求”（现有 reopen，应用回到 requirements）后再新增模块。
   - 开发/完成阶段：走 Change Set（范围=需求+设计），模块选择在 M5 接入。
   - 后端 `createModule` 继续只在 `app.status === 'requirements'` 放行；其它阶段 409 并如实提示上述路径。
2. **需求模板切换必须应用级**：切换后当前应用的**所有未归档模块**一起跟随新模板（每模块生成 `template-change` 版本），并做二次确认 + 逐模块影响预览。
   - 有任何未归档模块已确认（只读）时拒绝应用级切换（409 列出模块），需先重新编辑需求。
   - 归档模块不参与切换（保留历史模板），恢复后可用应用级切换再对齐。
3. **doc 对话历史按模块拆分**：每个模块独立历史（settings key 带 `moduleId`）；旧的应用级历史作为默认模块历史的只读回退，首次写入后落到模块 key，不删除旧数据。

以上三条进入 M3 实施交接单：`docs/plans/2026-11-13-module-m3-implementation-brief.md`。

---

## 13. 非目标

- 不做每模块不同模板（本期所有模块共用应用模板）。
- 不做实时协同/编辑锁/权限（等登录/角色）。
- 不物理删除历史模块/版本/交接包。
- 不改变开发阶段“一个应用、一个代码库、原生 build 会话”的语义。
- 不把模板内容复制进版本历史（只存模板 id/hash）。

---

## 14. 下一步

1. ✅ 设计稿已定稿（2026-11-13）。
2. ✅ M2 已实施并评审（2026-11-13），must-fix 已修，真实 app1 已迁移并通过正式验收：`docs/plans/2026-11-13-module-m2-implementation-brief.md` §8 实施结果 / §8.11；验收证据见 `docs/STATUS.md`「M2 完成」。
3. ✅ M3 已实施并评审（2026-11-13）；✅ M4 已实施并评审（2026-11-13）；✅ M5 已实施并评审（2026-11-16）：需求 bundle + 设计输入 v2 + 覆盖度模块化 + Change Set 模块选择/取消，见 `docs/plans/2026-11-16-module-m5-implementation-brief.md` §10；⏭ 下一步 M6（应用级交接包模块化 + U7 模块/Epic 两层阶段）。
