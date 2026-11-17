# 模块化 M6：应用级交接包模块化 + U7 两层阶段（实施交接单，分 M6a/M6b）

日期：2026-11-16
用途：新开实施会话执行；主会话评审。**先做 M6a，评审通过后再做 M6b**（同一会话接续）。
状态：**M6a 已通过主会话评审；M6b 已实施（2026-11-16，待主会话评审）。**
上游：`docs/plans/2026-11-13-module-requirements-design.md`（§4.7/§4.8/§6.3/§8/§12.1）、`docs/plans/2026-11-12-u7-phased-development-design.md`、M2—M5 交接单、`docs/STATUS.md`「2026-11-13 政策」。
范围：M6a = 应用级交接包按模块（00—05/manifest/prototypes/生成门禁/变更 diff）；M6b = U7 模块 + Epic 两层阶段。**不做** M7 #8 预览、登录/权限、旧数据兼容。

真实库 `apps=0`；M6 不新增表（M6b 只加列），无迁移/legacy/回填。验证只用临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`/端口；**不启停 3300**、不改真实 `data/`/`projects/`、不读 `.env`、不调真实模型。

---

## M6a：应用级交接包模块化

### 1. 目标

1. 交接包仍是**一个应用级包**，内部按模块组织 00—05/manifest/prototypes；开发仍是一个应用/代码库。
2. 生成门禁按模块：全部必选未归档模块设计 confirmed、无 stale、所有页面 PNG 齐全；跨模块 FK 提示不阻塞。
3. Change Set #2+ 的 `05-CHANGES` 按模块 diff：选中模块输出真实 diff，未选模块标“未变更”。
4. 保持单模块旧行为与现有 `smoke:design-handoff` 通过。

### 2. 类型与数据

`handoff/design-types.ts` 扩展（保留旧字段做聚合兼容）：

```ts
export interface DesignHandoffModule {
  id: string; key: string; title: string; position: number;
  requirements: { version: number; docHash: string; title: string; templateId: string;
                  templateName: string; confirmedAt: string | null; contentMd: string;
                  input: DesignInputBundle }
  design: { version: number; status: string; confirmedAt: string | null; templateId: string; templateHash: string }
  entities: DesignHandoffEntity[]
  pageSets: DesignHandoffPageSet[]
  coverage: DesignCoverage
  warnings: string[]
  changeReport?: DesignChangeReport | null
}
```

`DesignHandoffBundle` 增加：

- `modules: DesignHandoffModule[]`
- `requirementsBundle: { version: number; hash: string } | null`（最新需求 bundle）
- 旧 `requirements/design/entities/pageSets/coverage/changeReport` **保留为聚合兼容**：
  - `requirements` = 默认模块（或第一个模块）；
  - `design` = `{ version: max(modules.design.version), status: 全部 confirmed ? 'confirmed' : 'draft', confirmedAt: max }`；
  - `entities/pageSets` = 各模块顺序拼接；
  - `coverage` = 汇总（storyCount 等求和；rate 按汇总）；
  - `changeReport` = 聚合（保持旧结构）。
- `template/templateHash`：应用级 `prototype-template.json` 使用默认模块/应用模板；模块模板 id/hash 记录在 `modules[].design` 与 manifest；模块模板不一致仅 warning（不阻塞）。

新增 loader（`handoff/design-service.ts` 或 `design-bundle.ts`）：`loadHandoffModules(appId)`：

- 非归档模块（`app_modules`，按 position）；
- 每模块必须有设计项目与设计输入（缺失 → 校验 issue）；
- 返回 `{ module, payload }`，payload 用 `getDesign(appId, moduleId)`（会确保项目存在；交接包生成只读，不建项目）；
- 不读取归档模块。

### 3. 校验（按模块）

`validateDesignHandoff` 改为遍历全部模块：

- 任一必选未归档模块：需求未确认/设计未确认/设计输入未绑定/stale/readiness issues/引用无效/页面无 PNG → issue，消息前缀 `[MOD-001 订单管理]`；
- 页面/实体引用：全局实体 ID；跨模块目标 warning；
- 表名跨模块重复：warning；
- 模块原型模板不一致：warning；
- 无模块/全部归档 → issue；
- 旧单模块行为保持（messages 大致不变，smoke 不依赖前缀可忽略）。

### 4. 渲染（按模块）

`handoff/design-render.ts`：

- `00-README.md`：模块索引表（key/title/需求 v/设计 v/实体/页面集/页面/阶段数），规模/总量，跨模块依赖提示。
- `01-REQUIREMENTS.md`：应用标题 + 模块索引 + 每模块 `## 模块：<title>（<key> · 需求 vN）` + 该模块 `contentMd`（按模块顺序）。
- `02-DATA-MODEL.md`：每模块 `## 模块：<title>` + 该模块 ER/实体/字段/关系/DDL 说明；跨模块 FK 单列提示；`schema.sql` 汇总全部模块表（表名重复 warning；主键/FK 用全局实体 ID）。
- `03-PAGES.md`：每模块 `## 模块：<title>` + 页面集/页面规格/验收；PNG 路径 `prototypes/<moduleKey>/<ps-XXX>/page-XXX.png`。
- `04-PLAN.md`：每模块 `## 模块：<title>` + 模块目标/完成标准 + 该模块 Epic 阶段（M6b 写入实际阶段；M6a 先保留现有按 Epic 的段落并在模块标题下组织）。
- `05-CHANGES.md`：
  - seq=1（初始开发）：保持现有“初始开发”说明 + 模块索引；
  - seq>1：每选中模块 `## 模块：<title>` + 现有 diff 内容；未选模块列“未变更（本次变更未包含）”；模块不在基线（变更中新增）标“新增模块”。
- `manifest.json`：
  ```jsonc
  {
    "app": {...}, "version": 3, "hash": "...", "generatedAt": "...",
    "requirementsBundle": { "version": 4, "hash": "..." },
    "designModules": [{ "id","key","title","version","hash","status","confirmedAt",
                        "entityCount","pageSetCount","pageCount","coverageRate" }],
    "modules": [{ "id","key","title","position",
                  "requirements": { "version","docHash" },
                  "design": { "version","hash","templateId" },
                  "counts": {...}, "coverage": {...} }],
    "totals": {...},
    "scale": {...},           // U6：按全部模块汇总
    "changeSet": {...},
    "baselineHandoffVersion": 2,
    "phases": [...]           // M6b；M6a 可先沿用现有 phases 或省略，M6b 补齐
  }
  ```
  - `designModules.hash` 用 `designStateHash`（M5）确定性哈希；manifest 顶层 hash 仍由写盘文件计算（现有逻辑）。
- `prototype-template.json`：应用级（默认模块模板），说明多模块共享；模块差异 warning。
- 原型文件：`prototypes/<moduleKey>/<ps-XXX>/page-XXX.png`（+ `.html`），模块 key 用 `MOD-001` 等（安全字符）；文件 meta/read/download 路径按新结构。

### 5. Change Set / 基线

- `changeReportFor` 改为按模块：
  - 基线来自上一交接包 `source_design_json` 的模块快照（M6a 起保存 `{ modules: [{ moduleId,key,entities,pageSets }] }`，同时保留旧 `{entities,pageSets}` 兼容单模块旧包）；
  - 选中模块（`app_change_set_modules` 行）做 diff；未选模块 `changeReport: null` 且 `05-CHANGES` 标“未变更”；
  - 新模块（基线无）标“新增模块”，diff 视为全新增；
  - 聚合 `changeReport` 保持旧结构（合并各模块 counts/items）。
- `source_requirements_json` 也保存模块需求快照（`[{moduleId,version,docHash,title}]`），供变更/审计。
- 生成时 `ensureChangeSet`：首个交接包创建 Change Set #1（沿用 D5）；Change Set 模块绑定取 `app_change_set_modules`（若无则全部未归档模块）。
- 生成后 `apps.design_confirmed_at` 等旧行为保持；`apps.status='development'` + Change Set #1/#N 逻辑不变。
- 交接包 stale：任一模块设计/需求版本变化 → 整体 stale（现有 `designHandoffSummary`/前端提示扩展为模块明细，不改变整体语义）。

### 6. API / 读 / 摘要

- `POST /design/handoff/preview`、`POST /design/handoff/generate`：移除多模块 409；返回增加 `modules` 摘要（key/title/版本/计数/PNG 缺失/warnings）与聚合 issues。
- `GET /design/handoff`（read）、`GET /design/handoff/file?name=`：支持 `prototypes/<moduleKey>/...` 路径与文件 meta；路径穿越防护保持。
- `designHandoffSummary`/`designHandoffManifest`：增加 `modules`、`requirementsBundle`、规模；旧字段保留。
- `manifest.scale` 统计按全部模块汇总；`phaseCount` M6a 暂沿用现有（M6b 两层阶段）。

### 7. 前端（M6a）

- `DesignHandoffDialog.vue`：生成前展示模块表（key/title/需求 v/设计 v/实体/页面集/页面/缺图/确认状态）、聚合规模、issues/warnings（按模块分组）；全部模块确认才可生成；stale 模块高亮；生成后展示交接包版本/模块清单。
- `DesignStudio.vue`：多模块时生成按钮不再提示 M6；改为“全部模块确认后可生成”（未确认时禁用并提示 pending）。
- 交接包查看/文件列表：显示模块目录（原型路径）、模块版本；下载/预览保持。
- 历史交接包/变更单：显示模块数与版本映射（已有 ChangeSet 模块行，复用）。
- 不新增依赖、不新增主题 token。

### 8. M6a 测试（基线 215/120）

后端：

1. 两模块设计确认 + PNG 齐全 → 生成成功：文件 00—05/schema/template/manifest/prototypes 存在；`01` 含两模块标题；`02` 两模块实体/DDL；`03` 两模块页面；`04` 两模块计划；manifest `modules/designModules/requirementsBundle` 正确；`prototypes/MOD-001/...` 与 `MOD-002/...` 文件存在。
2. 任一模块未确认/缺 PNG/stale → 400 且 issues 带模块前缀；不写盘。
3. 跨模块 FK/表名重复/模板不一致 → warning 不阻塞。
4. 单模块旧行为回归（现有 `smoke:design-handoff` 必须过；必要时更新其断言，说明原因）。
5. Change Set #1 创建；Change Set #2（只选 A）生成：`05-CHANGES` 只含 A diff，B 标“未变更”；manifest 模块版本映射正确；未选模块设计/需求未变。
6. 读/预览/摘要包含 modules；删除应用清理交接包/文件。
7. 规模统计按全部模块汇总。

前端/Playwright（临时数据、fixture 或 API 预置 PNG）：

- 设计页两模块全部确认 → 交接包弹窗模块表/规模/生成 → 生成后文件列表含模块目录；缺图/未确认时按钮禁用与提示；1024/768 不溢出；0 console/0 意外 API≥400。

### 9. M6a 交付

- 本交接单追加 `## M6a 实施结果`。
- 更新 `docs/STATUS.md`（M6a）。
- 不改 `AGENTS.md`/接续单（主会话负责）。
- 完成后停，等主会话评审；评审通过后再做 M6b。

---

## M6b：U7 模块 + Epic 两层阶段（评审后实施）

（本节先定方向，M6a 评审时再细化）

1. `app_dev_phases` 加 `module_id`/`parent_key`/`phase_kind`（`ensureColumn`，无回填）。
2. `DesignHandoffPhaseDraft` 增加 `moduleId/moduleKey/parentKey/kind`；manifest.phases 生成：`base`（app 级）→ 每模块 `module:<MOD-KEY>`（kind=module）→ 其下 `epic:<EPIC-ID>`（parentKey=module key）→ `other/all`（app 级）。
3. `04-PLAN`：每模块目标/完成标准 + Epic 阶段列表；模块阶段只做分组/里程碑，不单独开会话/不调模型摘要；会话只绑 base/epic/other/all 可执行阶段；模块阶段 start/complete/skip/reopen → 409。
4. 模块阶段状态按子阶段派生（completed/in_progress/not_started；全 skipped → skipped）；视图 `phases` 返回 kind/moduleId/moduleKey/parentKey + `modules` 分组汇总；Epic 阶段摘要/previous summary 在模块内计算。
5. 前端 PhaseBar/PhaseDialog 按模块分组（折叠/里程碑/当前 Epic 高亮）；开发页 chip 显示模块；仅 Epic/base 可操作。
6. `smoke:dev-phases` 扩展多模块 manifest fixture；单模块回归。
7. 完成后主会话跑真实模型全链路 E2E（新建应用 → 多模块需求 → 设计 → 交接包 → 开发阶段），临时应用删除；通过后交用户新建应用。

---

## 约束（M6a/M6b 共同）

1. 不做旧数据迁移/兼容；不建 legacy/回填；真实库 apps=0。
2. 单模块/旧 API 行为零回归；`smoke:design-handoff`、`smoke:change-set`、`smoke:dev-phases` 必须过。
3. 不启停 3300、不改真实 `data/`/`projects/`、不读 `.env`、不调真实模型（E2E 由主会话）。
4. 文件路径防穿越；不把凭据写进交接包。
5. 不新增依赖；不扩 M7。

---

## 实施结果

### M6a 实施结果

状态：**M6a 已通过主会话评审（含 MF-M6a-1 修复）。** 未启停 3300、未触碰真实 `data/`/`projects/`、未读 `.env`、未调真实模型。

#### 改动文件

后端：

- `backend/src/handoff/design-types.ts`：`DesignHandoffModule`（requirements/design/entities/pageSets/coverage/warnings/changeState/changeReport）、`DesignHandoffModuleSummary/Counts`、`DesignHandoffModuleChangeState`；bundle 增加 `modules/requirementsBundle`；meta 增加 `modules/requirementsBundle`；`DesignHandoffChangeSet` 增加可选 `modules`。
- `backend/src/handoff/design-bundle.ts`：按模块构建 bundle；全局连续编号（ENT/PS/PAGE，表名 fallback 全局序号）；原型路径 `prototypes/<MOD-KEY>/<ps-XXX>/page-XXX.png`；聚合兼容字段（默认/第一个模块 + 全部拼接 + 汇总覆盖度）；`mergeDesignInputs/mergeCoverage/mergeChangeReports/handoffModuleCounts/moduleSummariesOf`。
- `backend/src/handoff/design-render.ts`：00—05/schema/template/manifest 按模块渲染；README 模块索引 + 跨模块依赖；01 每模块完整 PRD；02 每模块实体/DDL + 跨模块引用；03 每模块页面集/页面 + 新 PNG 路径；04 每模块目标/Epic/页面集清单；05 选中模块 diff、未选“未变更”、新模块“新增模块”；manifest `app/version/requirementsBundle/designModules/modules/totals/scale/changeSet/phases/files`。
- `backend/src/handoff/design-service.ts`：`loadHandoffModules`（未归档模块按 position；缺项目不创建）；`validateDesignHandoff` 遍历模块（前缀 `[MOD-xxx 标题]`；跨模块 FK/表名重复/模板不一致 warning）；移除多模块 409；preview/generate 共用 `prepareHandoff`；按模块变更基线（旧 `{entities,pageSets}` 视为默认模块）+ 选中模块 diff；`source_design_json/source_requirements_json` 存模块快照并保留单模块兼容字段；**Change Set #1 同一事务写 `app_change_set_modules`（preview 合成模块行）**；read/summary/manifest 带 modules/requirementsBundle；生成门禁用全部未归档模块的版本/确认时间最大值（旧字段兼容）。
- `backend/src/design/module-design.test.ts`：M4 的“多模块 409”用例改为 M6a 可生成；HTTP 用例改为缺图 400 + 模块前缀。
- `backend/src/handoff/design-handoff.test.ts`：单模块原型路径断言更新为 `prototypes/MOD-001/...`（路径契约变化，见偏差）。
- `backend/src/handoff/design-handoff-modules.test.ts`（新增 6 项）。
- `backend/scripts/design-handoff-smoke.ts`：单模块原型路径断言更新。
- `backend/package.json`：测试清单加入新文件。

前端：

- `frontend/src/design/api.ts`：模块摘要/计数/变更状态类型；Meta/Preview 增加 `modules/requirementsBundle`。
- `frontend/src/design/DesignHandoffDialog.vue`：模块表（key/标题/需求 v/设计 v/实体/页面集/页面/缺图/状态/变更状态）、聚合规模（生成前实时计数，预览/生成后完整 scale）、未就绪原因、stale 提示；`enter` 模式全部必选模块确认且 PNG 齐全才可生成；沿用 theme token，表格内部滚动，1024/768 不溢出。
- `frontend/src/design/DesignStudio.vue`：移除 M6 禁用/提示；交接包按钮始终可开；把需求模块 + 设计模块摘要传入弹窗；确认文案改为“可生成应用级交接包”。
- `frontend/src/design/DesignOverviewDialog.vue`：去掉 M6 文案。
- `frontend/src/changesets/module-scope.js` / `ChangeSetHistoryDialog.vue`：`moduleVersionRange(module, changeSet)` 区分 #1 首次基线；#1 历史模块行显示“需求 vN · 设计 vM（首次基线）”而不是“变更中新增”。

#### bundle / manifest / 文件结构

- `DesignHandoffBundle.modules[]`：`{ id,key,title,position,required,requirements{version,docHash,title,templateId,templateName,confirmedAt,contentMd,input}, design{version,status,confirmedAt,templateId,templateHash,hash}, entities,pageSets,coverage,warnings,changeState,changeReport }`。
- 聚合兼容：`requirements` 第一个模块、`design` 最大版本 + 全 confirmed 判定、`entities/pageSets` 顺序拼接、`coverage` 汇总。
- `manifest.json`：`app{id,name}`、`version`、`requirementsBundle`、`designModules[]`（id/key/title/version/hash/status/confirmedAt/entityCount/pageSetCount/pageCount/coverageRate）、`modules[]`（摘要含 requirements/design/counts/coverageRate/missingImages/stale/warnings/changeState）、`totals`、`scale`（全部模块汇总）、`changeSet`（聚合 changes）、`phases`（M6a 仍为现有全局草案）、`files`、`warnings`；旧 `requirements/design/counts` 字段保留。
- 文件：`00—05.md`、`schema.sql`、`prototype-template.json`、`manifest.json`、`prototypes/<MOD-KEY>/<ps-XXX>/page-XXX.png|.html`。
- Change Set #1 保持“初始开发”；#2+ 只对 `app_change_set_modules` 选中模块输出 diff，未选模块标“未变更”，基线无模块标“新增模块”。

#### 测试（实际执行）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **222/222 通过**（基线 215 + `handoff/design-handoff-modules.test.ts` 7；`design/module-design.test.ts` 2 项语义更新；含 MF-M6a-1 与 #2 需求变更 sync regenerate 路径） |
| `npm run smoke:requirements` / `smoke:modules` / `smoke:change-set` / `smoke:design-handoff` / `smoke:design` | 全部通过（`smoke:design-handoff` 仅更新单模块原型路径断言） |
| `npm test --prefix frontend` | **120/120 通过**（未新增前端单测；交互用 Playwright） |
| `npm run typecheck` / `build` / `check:vue`（frontend） | 全部通过 |

新增后端覆盖：两模块生成（文件/模块标题/全局编号/原型路径/manifest modules+designModules+requirementsBundle+totals/快照）；未确认/缺 PNG/stale 按模块 400 + 前缀且不写盘；跨模块 FK/表名重复/模板不一致仅 warning；Change Set #1 写 2 条模块行（base=null、current 版本/hash）且预览合成模块行、同单重新生成不重复插行；`listChangeSets` #1 `modules.length=2`；Change Set #2 只选 A（05 只含 A，B“未变更”，manifest 模块映射，B 版本不动）；**#2 需求变更路径**（改 A 需求 → 确认 → bundle confirm → `syncDesignInput(...,'regenerate')` → 确认设计 → v2，A 有修改项、B 不动、#1 仍 2 行/#2 1 行）；读/摘要带 modules；规模按全部模块汇总（10 Story → large）；删除清理（含 `app_change_set_modules`）。

#### Playwright 证据（临时数据，端口 3432 / 5199，`OPENCODE_AUTO_START=false`）

- 两模块（商品/订单）全部确认：设计页交接包弹窗模块表 2 行“全部已确认”、规模 `模块 2 / 实体 2 / 页面集 2 / 页面 8`；生成 → 进入开发；开发页重开交接包显示 `v1`、模块表 2 行、文件列表含 `prototypes/MOD-001/ps-001/page-001.png` 与 `MOD-002`；完整 scale `2 Story / 8 页面 / 29 KB`。
- 阻塞（B 设计草稿 + 缺 4 张 PNG）：模块表 1 个未就绪行、生成按钮禁用、提示“全部必选模块完成设计确认且原型 PNG 齐全后才能生成：MOD-002 订单管理（设计未确认 / 缺 4 张原型 PNG）”。
- 1440/1024/768 页面级无横向溢出；#1 变更历史行显示“2 模块”，展开后 MOD-001/MOD-002 模块行显示“需求 vN · 设计 vM（首次基线）”；**0 console error / 0 pageerror / 0 意外 API≥400**。
- 截图：`C:\Users\icecream\AppData\Local\Temp\opencode\m6a-e2e\shots\`（01—08，临时）。

#### MF-M6a-1（2026-11-16，已修）：Change Set #1 写模块行

- `ensureChangeSet` 在 `persist=true` 时，与 `app_change_sets` 插入同一事务为**全部未归档模块**写 `app_change_set_modules`：base 全 null（首次基线）、current = 当前需求版本/`sha256(contentMd)` + 设计版本/`designStateHash`；`insertChangeSetModule` 复用 M5 契约。`persist=false`（preview）不写库，但返回**合成模块行视图**（`preview.changeSet.modules`）。
- `bindingOfRow` 为 `DesignHandoffChangeSet` 附加 `changeSetModulesView`，preview/generate/`GET /change-sets` 都能看到 #1 模块；`deleteDesignHandoffData` 同步清理 `app_change_set_modules`。
- 兼容：旧 #1 没有模块行时 `modules=[]`（读写不失败）；不写回填。
- 前端 `ChangeSetHistoryDialog` 的 #1 模块行不再显示“变更中新增”，改为“需求 vN · 设计 vM（首次基线）”；`moduleVersionRange(module, changeSet)` 增加 sequence 语义（#2+ 无基线仍是“变更中新增”）。
- 测试：单模块 #1 1 行（base null/current hash 64 hex/templateId null）、两模块 #1 2 行、`listChangeSets` #1 modules=2、预览合成 modules、同单重新生成不重复插行、删除清理；新增 M6a-7 覆盖评审路径“#2 只选 A → 改 A 需求 → 确认 → bundle confirm → `syncDesignInput(mode='regenerate')` → 确认设计 → v2”，`05-CHANGES` A 有“修改”且 B“未变更”，B 需求/设计版本不变，#1 仍 2 行/#2 1 行。
- 说明：`app_change_set_modules` 没有 current template 列；#1 按交接单固定 `design_base_template_id=null`，因此 `GET /change-sets` 的 `templateId` 为 null（当前模板在 design project/manifest）。M5 模块视图字段未改。

最终测试：后端 **222/222**、前端 **120/120**；5 支冒烟 + typecheck/build/check:vue；Playwright 增验 #1 变更历史“2 模块”与模块行（MOD-001/002、首次基线），0 console/0 意外 API≥400（截图 `08-history-modules.png`）。

#### 偏差 / 未验证

- 单模块新生成包的原型路径由 `prototypes/ps-001/page-001.png` 改为 `prototypes/MOD-001/ps-001/page-001.png`（模块化契约；旧交接包仍按 DB 文件元数据读取）。因此更新了单模块测试与 `smoke:design-handoff` 断言。
- 单模块校验/文案不加 `[MOD-001 …]` 前缀（旧行为零回归）；多模块才加前缀。
- `00-README` 模块索引列为 Epic/Story 数，未列“每模块阶段数”（M6a `phases` 仍全局，M6b 两层阶段后补）；`04-PLAN` 保留全局“建议分阶段”章节 + 新增每模块目标/Epic/页面集实施清单。
- 生成前弹窗规模只显示模块/实体/页面集/页面计数；Story/文本字节等完整 scale 在“预览”或生成后显示（需要后端渲染两遍测量）。生成前模块表的 stale 无法从 appPayload 预读（只显示需求/设计未确认、缺图）；stale 在预览/生成后的模块表与后端 400 issues 中显示。
- `manifest.phases` M6a 维持现有全局 base/epic/other 草案，未带 moduleId/parentKey（M6b）。
- `designHandoffSummary` 增加 modules/requirementsBundle 为附加字段，旧调用方无需改动。
- 未验证：<768 移动端；真实模型全链路（由主会话在 M6b 后统一跑）；真实库升级/重启（M6a 无表结构变化）。

### M6b 实施结果

状态：**M6b 已实施（2026-11-16），待主会话评审。** 无旧数据迁移/legacy/回填；未启停 3300、未触碰真实 `data/`/`projects/`、未读 `.env`、未调真实模型。**单模块保持 U7 平铺阶段（key/kind 不变），多模块才生成模块 + Epic 两层。**

#### 改动文件

后端：

- `handoff/design-scale.ts`：`DesignHandoffPhaseKind` 增加 `module`；`DesignHandoffPhaseDraft` 增加 `moduleId/moduleKey/parentKey`；新增 `deriveModulePhases`（base → 每模块 `module:<MOD-KEY>` → 模块内 `epic:<EPIC-ID>`/`other:<MOD-KEY>` → 无 Epic 时 `pageSets:<MOD-KEY>:<PS>`/`all:<MOD-KEY>`）；`phaseCount` 只统计可执行阶段，新增 `modulePhaseCount`；单模块仍走 `deriveFlatPhases`（零回归）。
- `handoff/design-types.ts`：`DesignHandoffScale.modulePhaseCount?`。
- `handoff/design-render.ts`：`manifest.phases` 写 `moduleId/moduleKey/parentKey`；`04-PLAN` 模块里程碑标题不占“阶段 N”，模块章节补 `模块阶段:` / `Epic 阶段:` 标记与完成标准。
- `db.ts`：`app_dev_phases` 新库加 `module_id/parent_key/phase_kind`；旧库 `ensureColumn`（无回填，旧行 null 视为可执行原 kind）。
- `dev/phases.ts`：`DevPhaseKind` 增加 `module`；行/视图/引用增加 `kind/moduleId/moduleKey/moduleTitle/parentKey`；`parseManifestPhases` 读模块字段；生成写 `module_id/parent_key/phase_kind`；可执行 order/total 排除模块行；模块阶段 start/complete/skip/reopen → 409；模块状态由子阶段派生；`modules` 汇总 + `modulePhaseCount`；Epic 会话标题/brief 带模块；previous summary 同模块内计算；`reopenPhaseForPrompt` 模块阶段忽略；会话列表 `phaseKind/phaseModuleId/phaseModuleKey/phaseModuleTitle`。
- `dev/service.ts`：会话列表项增加模块阶段字段。
- `dev/phases.test.ts`：新增 2 项（两层生成/字段/汇总/顺序 + 模块 409；模块内 Epic 会话/标题/brief/状态派生/同模块摘要）。
- `handoff/design-handoff-modules.test.ts`：大规模两模块 manifest phases 结构、`04-PLAN` 模块阶段/Epic 阶段。
- `scripts/dev-phases-smoke.ts`：保留单模块 U7 回归，追加两模块 fixture（manifest/phases、模块 409、Epic start/标题/brief/摘要/模块状态/会话字段/删除）。

前端：

- `dev/phase-labels.js`：`moduleStatusOf/executablePhases/groupPhasesByModule/moduleLabel/moduleName`；`phaseProgress` 排除模块；模块操作禁用；`phaseRefLabel/phaseChipLabel` 带 `MOD-001 商品管理`；生成确认含模块里程碑数。
- `dev/PhaseBar.vue`：按可执行阶段计进度；新增模块 chip 行（key/状态/完成数，点击打开模块详情）；当前阶段显示模块。
- `dev/PhaseDialog.vue`：左侧按模块分组（可折叠、模块状态/进度、子 Epic 缩进）；模块里程碑详情（无开始/完成/跳过/重新打开）；Epic 显示所属模块；默认选中当前/第一个可执行阶段。
- `dev/DevView.vue`：可执行阶段列表/计数（模块里程碑单独计数）；当前阶段排除模块；chip/侧栏/会话列表显示模块；生成确认带模块数。
- `dev/types.ts`：DevPhaseKind/Ref/View、modules 汇总、会话列表模块字段。
- `design/api.ts`：`DesignHandoffScale.modulePhaseCount?`。
- `dev/phase-labels.test.mjs`：新增分组/状态汇总/可执行/模块操作/文案用例（+1 test，共 121）。

#### 两层结构

- 阶段 key：`base` → `module:<MOD-KEY>`（kind=module，聚合模块 Story/页面集/页面）→ `epic:<EPIC-ID>`（parentKey=MOD-KEY）→ `other:<MOD-KEY>`（模块内未归属页面集）/ `pageSets:<MOD-KEY>:<PS>` / `all:<MOD-KEY>`。
- `phaseCount` = base + epic/other/pageSets/all；`modulePhaseCount` = 模块里程碑数。
- `app_dev_phases`：`module_id/parent_key/phase_kind`；`phase_kind=null` 旧行按 `scope_json.kind` 视为可执行（不迁移）。
- 视图：`phases[]` 带 `kind/moduleId/moduleKey/moduleTitle`，另返回 `modules[]`（key/状态/子阶段计数）与 `modulePhaseCount`；模块状态：全 skipped→skipped；全 completed/skipped 且至少 1 completed→completed；有 in_progress→in_progress；否则 not_started。
- 模块阶段只做分组/里程碑：不建会话、不调模型摘要、四个动作 409；会话/摘要/previous summary 仅绑定可执行阶段；Epic 会话标题与 brief 带模块。

#### 测试（实际执行）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **224/224 通过**（222 + `dev/phases.test.ts` 新增 2） |
| `npm run smoke:dev-phases` | 通过（单模块 U7 回归 + 两模块两层阶段/模块 409/Epic 会话/摘要/清理） |
| `npm run smoke:design-handoff` / `smoke:change-set` | 通过 |
| `npm test --prefix frontend` | **121/121 通过**（120 + 1 分组/模块用例） |
| `npm run typecheck` / `build` / `check:vue`（frontend） | 全部通过 |

#### Playwright 证据（临时数据，端口 3436 / 5199，`OPENCODE_AUTO_START=true`，不调模型）

- 交接包：2 模块 / 10 Story / 8 页面 / 32KB → large；manifest phases `base + module:MOD-001 + epic:EPIC-001 + module:MOD-002 + epic:EPIC-002`；`phaseCount=3`、`modulePhaseCount=2`。
- 生成阶段并开始 MOD-001 的 Epic：开发页 PhaseBar 显示模块 chip 2 个、当前 `MOD-001 商品管理 · 阶段 2 · EPIC-001 ...`、已完成 0/3；右侧阶段 chip 与会话列表 chip 带模块。
- 阶段弹窗：2 个模块分组 + 3 个可执行阶段；MOD-001 折叠/展开 item 3↔2；模块里程碑详情显示“分组/里程碑”且**无开始/完成按钮**；MOD-002 Epic 开始按钮可用；当前 Epic 高亮。
- 1440/1024/768 无页面级横向溢出；深色主题生效；**0 console error / 0 pageerror / 0 意外 API≥400**。
- 截图：`C:\Users\icecream\AppData\Local\Temp\opencode\m6b-e2e\shots\`（01 浅色 1440、02 弹窗、03 模块里程碑、04 Epic 可开始、05 1024、06 768、07 深色）。

#### MF-M6b-1（2026-11-16 已修）：阶段视图补 `parentKey`

- `DevPhaseRef` 增加 `parentKey: string | null`；`refOf` 直接取 `row.parent_key`（模块行/app base 为 null），`phaseRefById/phaseRefsByIds/latestPhaseRefs` 全部继承；`withPhase` 返回也带 `parentKey`。
- 会话列表项增加 `phaseParentKey`，前端 `DevPhaseRef`/`DevSessionListItem` 类型同步；`groupPhasesByModule` 优先用 `parentKey` 分组（缺失时回退 `moduleKey`，现有行为不变）。
- 测试：`GET /development/phases` 模块行 `parentKey=null`、Epic `parentKey=MOD-001/MOD-002`、`phaseRefById` 带 parentKey、会话列表 `phaseParentKey`；smoke 也断言模块/Epic parentKey。
- **复验环境**：`DEV_PHASES_SMOKE_PORT=3795` → 后端 3795、**独立 `OPENCODE_PORT=4795` + `OPENCODE_AUTO_START=true`**（避开 3300 的 opencode 4771）；单模块 + 两模块阶段全流程通过，包含多模块 Epic start、Epic complete（无 assistant → summary none、会话不归档）、模块状态派生 completed、会话标题/ brief 模块信息、同模块摘要/跨模块不串。

最终测试：后端 **224/224**、前端 **121/121**；`smoke:dev-phases`（独立 OPENCODE_PORT=4795）/`smoke:design-handoff`/`smoke:change-set`、typecheck/build/check:vue 通过。

#### MF-M6b-2（2026-11-16 已修）：模块状态派生——部分子阶段完成应为 in_progress

- 真实模型 E2E 发现：MOD-001 有 3 个可执行子阶段，完成 1 个、其余 not_started，`modules[].status` 却是 `not_started`。
- 修复 `moduleStatusOf(children)`：无 children→not_started；全部 completed/skipped 且至少 1 completed→completed；全 skipped→skipped；**只要有 in_progress/completed/skipped（已开始/有进度）→in_progress**；否则 not_started。仍只在读取时派生，不回写 status 列。
- 前端 `phase-labels.js` 的同名派生函数同步修改（PhaseBar/PhaseDialog 使用），状态标签 `in_progress → 进行中` 已存在。
- 测试：后端直接断言 1 completed + 2 not_started → in_progress；1 skipped + 2 not_started → in_progress；全 completed/skipped→completed；全 skipped→skipped；全 not_started→not_started；另用 getDevPhases 验证 MOD-001 完成 1/3 子阶段后模块 status=in_progress。
- `smoke:dev-phases` 两模块 fixture 扩为 MOD-001 3 个 Epic：完成 1/3 后断言 `modules[MOD-001].status=in_progress`、completed=1/total=3；继续完成 MOD-002 Epic 后模块 completed。
- 复验：`DEV_PHASES_SMOKE_PORT=3795` + 独立 `OPENCODE_PORT=4795` + `OPENCODE_AUTO_START=true`；`smoke:dev-phases` 通过（单模块回归 + 两模块）。

#### 偏差 / 未验证

- 单模块保持 U7 平铺（manifest key/kind/`04-PLAN`/布局不变），以满足“单模块旧行为零回归”；两层阶段只在多模块启用。
- 模块行 `order` 字段对模块行没有“阶段 N”语义（可执行 order 已排除模块行）；前端模块分组使用 `modules[]`/`parentKey`，不展示模块行序号。
- `app_dev_phases` 没有 `module_key` 列：`moduleKey` 对模块行取 `module:<KEY>` 前缀、对子阶段取 `parent_key`；`moduleTitle` 读取 `app_modules.title`（模块被归档/删除时为 null）。
- 无 Epic 模块使用 `pageSets:<MOD-KEY>:<PS-CODE>`/`all:<MOD-KEY>`（稳定唯一）；交接单示例只列 `module/epic/other`，此处按“模块内 pageSets/all 分组”扩展。
- 模块阶段摘要不生成（按要求）；模块状态派生在读取时计算，不写回状态列。
- 未验证：<768 移动端；真实模型全链路（主会话执行）；旧库 `phase_kind=null` 的存量阶段（真实库 apps=0，仅单测兼容）。


