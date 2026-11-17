# 模块化需求 M3：需求模块 UI + 应用级模板切换 + 模块对话历史（实施交接单）

日期：2026-11-13
用途：新开实施会话执行；主会话评审。
状态：**待实施**。
上游：`docs/plans/2026-11-13-module-requirements-design.md`（已定稿，§6.1 UI 信息架构、§12.1 已确认决策）、M2 交接单 `docs/plans/2026-11-13-module-m2-implementation-brief.md`（§8 实施结果、§8.11、§9）。
范围：**只做 M3**——需求阶段模块 UI、模块级文档/确认/总览、应用级需求模板切换、按模块 doc 对话历史、模块排序。
**不做**：设计表/设计 UI 模块化（M4）、设计输入/交接包/Change Set 模块化（M5/M6）、U7 模块阶段（M6）、#8 预览（M7）、登录/权限。
**不改**：数据库表结构（M3 无迁移；只新增 settings key 约定）、设计/交接包/Change Set/开发阶段后端语义、`projects/`、真实库。

风险等级：中（前端大改 + 两个后端行为变更）。实施会话只允许在临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`/端口上验证；**不得**改真实 `data/`/`projects/`，不得停/改 3300 实例。

---

## 1. 目标

1. 需求阶段改为“左侧模块列表 + 中间当前模块完整 PRD + 顶部/右侧需求总览”。
2. 模块：新增（仅需求阶段）、重命名/描述/负责人/必选、排序、归档/恢复、切换；每模块独立的文档/版本/确认。
3. 需求总览：模块卡片（状态/版本/负责人/必选）、确认进度、bundle 最新版本/hash、“完成需求阶段”入口。
4. 应用级需求模板切换（所有未归档模块一起跟随，二次确认 + 逐模块影响预览）。
5. doc 对话历史按模块拆分（旧应用级历史作为默认模块只读回退）。
6. 模块新增门禁按用户决策：设计/开发阶段不直接新增（设计阶段先“重新编辑需求”，开发阶段走 Change Set）。
7. 保持 M2 全部 API 兼容；旧单模块应用行为不变（app1 打开需求页仍是默认模块，UI 可用）。

---

## 2. 复用与基线

- 已有：`RequirementsDocView.vue`（三栏：对话/文档/大纲）、`DocChatPanel.vue`、`MarkdownView.vue`、`OutlineEditor.vue`、`AiSuggestionCard.vue`、`TemplateCenterDialog.vue`、`VersionHistoryDialog.vue`、`requirements/api.ts`。
- 已有后端（M2）：`/requirements-modules`（GET/POST/PATCH/archive/restore）、`/requirements-bundle`（GET/confirm）、需求文档全部接口支持 `moduleId`。
- 版式 token/响应式基线：V1—V3 已完成，M3 必须沿用 `shared/theme.css` 语义 token，不新增裸色值（原型白纸除外）。

---

## 3. 后端改动（API 冻结）

### 3.1 应用级需求模板切换（决策 2）

保持旧接口不变：`PUT /api/apps/:id/requirements-doc/template`（默认 `scope='module'`，只切当前模块 = 旧行为）。

新增/扩展：

1. `POST /api/apps/:id/requirements-doc/template/preview`
   body：`{ templateId, scope?: 'module' | 'app' }`（缺省 `app`；M3 UI 固定 `app`）
   **只读、不写库、不产版本**，返回：
   ```jsonc
   {
     "template": { "id": "...", "name": "..." },
     "scope": "app",
     "modules": [
       {
         "moduleId": "...", "moduleKey": "MOD-001", "title": "订单管理",
         "docStatus": "draft", "docVersion": 3,
         "fromSections": 13, "toSections": 6,
         "kept": 5, "dropped": [{"sectionKey":"...","title":"..."}],
         "added": [{"sectionKey":"...","title":"..."}],
         "warnings": ["..."]
       }
     ],
     "blockedModules": [{ "moduleId": "...", "moduleKey": "MOD-002", "title": "...", "reason": "confirmed" }],
     "canApply": false,
     "warnings": ["..."]
   }
   ```
   - 未归档模块全部列出；归档模块不参与（不列或 `skipped:true`，固定一种并注释）。
   - 任一未归档模块 `status==='confirmed'` → 该模块进 `blockedModules`，`canApply=false`（不阻塞预览返回）。
   - 无文档模块（理论不该有）→ 预览显示 `fromSections:0`，应用时按模板建 v1。
2. `PUT /api/apps/:id/requirements-doc/template` 扩展 body `{ templateId, scope?: 'module' | 'app' }`
   - `scope='app'`：单事务内对**所有未归档模块**逐模块执行现有映射逻辑（按 section key → 标题匹配；kind 一致才保留 `data`；`required` 取新模板；空内容保留为空），每模块 `version+1`、生成 `source='template-change'` 版本；
   - 任一未归档模块已确认 → 409，`issues` 列出 `{moduleId,moduleKey,title}`（提示先“重新编辑需求”）；
   - 同步应用默认模板（现有 `syncAppRequirementTemplate`）；
   - 返回 `{ appId, template, scope:'app', modules:[{moduleId,moduleKey,title,version,sectionCount,kept,dropped,added,warnings}] }`；
   - 归档模块：不改（保留历史模板），注释说明“恢复后再切换对齐”。
   - `scope='module'` 行为、返回结构保持不变（旧测试/冒烟不动）。
3. 模板不存在/其它阶段模板：沿用现有 `getRequirementTemplateOrThrow` 语义（404/400）。

### 3.2 模块排序

`PUT /api/apps/:id/requirements-modules/order`
body：`{ moduleIds: string[] }`
- 必须与“当前应用全部未归档模块 id 集合”完全一致（缺失/多余/重复/含归档 → 400，不静默）。
- 事务内按数组顺序写 `position = 0..n-1`；归档模块 position 不动。
- 返回 `{ modules }`（未归档、按新顺序）。

### 3.3 按模块 doc 对话历史（决策 3）

- settings key：`app.<appId>.requirementsDocChat.<moduleId>`；旧 key `app.<appId>.requirementsDocChat` 保留。
- `GET /requirements-doc/chat?moduleId=`：
  - 模块 key 有值 → 返回该值；
  - 否则若请求的是**默认模块**且旧 key 有值 → 返回旧值（追加 `legacyFallback:true`，只读语义由前端体现）；
  - 否则 `{ messages: [] }`。
- `PUT /requirements-doc/chat?moduleId=`：只写模块 key；**不删除/不改写旧 key**。
- chat 服务（`chat/service.ts` doc 模式）读写历史用模块 key，prompt 上下文仍用 `loadDocChatContext(appId, templateId, focus, moduleId)`。
- 无迁移脚本；旧数据保留。

### 3.4 模块新增门禁（决策 1）

- `createModule` 继续只在 `app.status === 'requirements'` 放行（M2 已实现）。
- 409 文案改为明确路径：设计阶段先“重新编辑需求”；开发/完成阶段先发起“需求+设计”变更（模块选择 M5 接入）。
- 不新增“设计阶段直接新增模块”的 API/UI。
- 需求页 UI：非 requirements 阶段时“新增模块”禁用并给出 tooltip/提示；设计阶段“重新编辑需求”入口保持可用（现有接口 `POST /requirements-doc/reopen`，不传 moduleId = 默认模块；M3 按当前模块传）。

---

## 4. 前端（需求阶段模块化）

新增（`frontend/src/requirements/`）：

- `RequirementModuleRail.vue`：模块列表（position 顺序；状态 chip：draft/review/confirmed/archived；`vN`；必选标记；负责人/描述摘要）；选中态；操作：新增、上移/下移、归档/恢复、编辑。
- `ModuleEditDialog.vue`：title（≤120）/description/ownerLabel/required；PATCH 保存。
- `RequirementOverview.vue`（或顶部 strip + 弹窗）：总览卡片、`confirmed/required` 进度、bundle latest `vN` + 短 hash、pending 模块列表、“完成需求阶段”按钮与结果反馈。
- `AppTemplateSwitchDialog.vue`：展示 3.1 preview 结果（逐模块 from→to、dropped/added、warnings、blocked），二次确认后调用 `scope='app'`。
- `module-helpers.js`（+ `.test.mjs`）：初始模块选择（localStorage → defaultModuleId → 第一个未归档）、进度计算、blocked 判断、排序移动、归档后回退。

修改：

- `RequirementsDocView.vue`：
  - 增加模块 rail 与总览；所有文档读写/预览/AI 应用/版本/回滚/手动保存/模板/确认/导出/chat 都带 `moduleId`；
  - 切换模块前先 flush 未保存编辑；切换后重置 focus/outline/建议状态与滚动；
  - 头部显示当前模块名 + 模板 badge + 状态 + 版本 + 保存态；
  - 确认按钮 = 模块确认（不传 moduleId 以外语义）；“完成需求阶段”走 bundle confirm；
  - 多模块确认后不自动离开需求页（appConfirmed=false 时提示 pending）；bundle confirm 成功后刷新 app 状态并进入设计阶段（沿用现有阶段切换行为）；
  - 已确认/归档模块只读；应用非 requirements 阶段整页只读并提示“设计/开发阶段的需求变更走重新编辑/变更单”。
- `DocChatPanel.vue`：新增 `moduleId`、`moduleTitle` props；`getDocChat/saveDocChat` 带 moduleId；头部显示模块名；切模块时重载历史。
- `requirements/api.ts`：全部文档函数尾部可选 `moduleId`；新增模块 API（list/create/update/archive/restore/order）、bundle（get/confirm）、模板 preview/app 切换、chat moduleId；类型补 `RequirementModule`、`RequirementBundle`。
- `TemplateCenterDialog.vue`：在需求模块视图里选择“应用到全部模块”时走 preview + `AppTemplateSwitchDialog`；单模块切换保留（内部/测试可用）。
- `AppShell.vue` / `App.vue`：如需把 `requirementModules` 传入需求视图（可用 view 内自取，避免大改 shell）。

布局（≥1280）：模块 rail（约 220—240px）| 对话（现有 300px 可折叠）| 文档（flex）；大纲沿用现有抽屉/开关；总览用顶部 strip + 弹窗，避免第四列。
≤1024：模块 rail 与对话都变抽屉（遮罩/Esc/互斥），文档全宽；总览 strip 换行。
≤768：单栏 + 三个抽屉互斥；Composer/工具栏不溢出。

状态：
- 选中模块持久化 `localStorage: workbench:app:<appId>:requirementsModuleId`；失效/归档 → 回退默认模块并提示。
- 切模块不写入文档（只切换视图）；未保存编辑先 flush，失败则中止切换。

---

## 5. 兼容与边界

- 旧单模块应用（含 app1）打开需求页：仅 1 个模块，rail 显示“订单管理”，行为与今天一致（确认仍进入设计）。
- 旧前端/冒烟脚本不用 `moduleId`：全部落默认模块，M2 语义不变。
- 不新增数据库列/表；不写 `app_stage_events` 新事件类型可复用现有（module-created/archived/restored 已有）。
- 设计/开发页不改（除阶段切换后的状态刷新）；不做 M4+。
- 归档模块只读（后端已 409），UI 不提供写入口。
- 模块数量大时 rail 内部滚动；不做虚拟列表（>50 记已知限制）。

---

## 6. 测试

### 6.1 后端（`npm test --prefix backend`，基线 178）

新增/扩展测试（放 `requirements/modules.test.ts` 或新 `requirements/module-ui-support.test.ts`）：

1. 应用级模板切换 preview：不写库/不产版本；逐模块 from/to/dropped/added；有 confirmed 模块 → blockedModules + canApply=false。
2. 应用级模板切换应用：两模块都切到精简 PRD（6 节），各 `version+1` 且 `source='template-change'`；同 section key 内容保留；默认模块旧内容不串到另一模块；应用默认模板更新；归档模块不变。
3. 应用级切换被已确认模块阻塞：409 + issues 列出模块；不写任何模块。
4. `scope='module'` 旧行为回归（现有测试/冒烟保持）。
5. 排序：合法顺序写 position；缺失/多余/重复/含归档 → 400 且不改库。
6. 按模块 chat：两模块历史互不影响；默认模块无模块 key 时回退旧 key 且 `legacyFallback=true`；PUT 写模块 key 且旧 key 仍在；非默认模块不回退旧 key。
7. 模块新增门禁文案（design/development 409 提示路径）。

### 6.2 前端单测（`npm test --prefix frontend`，基线 96）

- `module-helpers.js`：初始选择（stored/默认/归档回退）、进度、blocked、上移/下移边界、归档回退。
- `api.ts` 的 moduleId 拼接（可用纯函数抽出）。
- 现有测试全绿（改动 `api.ts` 签名时保持默认参数，避免大面积改调用点断言）。

### 6.3 Playwright（临时 data/projects，端口自定，不碰 3300）

场景（浅/深 × 1440/1024/768，关键页截图）：

1. 新建应用 → 需求页显示默认模块（MOD-001）→ 新增第 2 个模块（标题/负责人）→ rail 顺序/状态/版本正确。
2. 两模块分别编辑同一章节互不影响；版本列表按模块独立。
3. 模块 1 确认 → 仍停留需求阶段（多模块），总览 pending 显示模块 2；模块 2 确认 → “完成需求阶段”可用 → 点击 → 应用进入设计（阶段条更新），需求页只读。
4. 模板切换（确认前）：预览对话框逐模块影响；应用后两模块都 6 节、版本各 +1；已确认一个模块时切换被阻止并列出模块。
5. chat：模块 A 发一条（可 mock 模型或只验证历史 API/空态），切模块 B 历史为空，切回 A 仍在；旧 key 回退仅默认模块。
6. 排序上移/下移、归档/恢复、归档只读、编辑负责人/必选。
7. 应用在 design/development 时需求页只读 + “新增模块”禁用提示；设计阶段“重新编辑需求”可用（回需求后可新增）。
8. 1024/768：模块 rail/对话/大纲抽屉互斥、Esc/遮罩关闭、无横向溢出；深色无白底。
9. 0 console error / 0 非预期 API>=400。

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

基线：后端 178、前端 96；M3 后按实际回传。真实 app1 不要用于测试。

---

## 7. 文档

- 本交接单追加 `## 8. 实施结果`（改动文件、API、测试数、Playwright 截图/错误数、偏差、未验证、已知限制）。
- 更新 `docs/STATUS.md`（M3 完成 + 测试数）。
- 更新设计稿 M3 状态（仅状态文字）。
- 不改 `AGENTS.md`（主会话评审后统一更新）、不改接续单（主会话负责）。

---

## 8. 实施结果

实施日期：2026-11-13（实施会话）。状态：**已实施，待主会话评审**。范围严格按本交接单 §1—§9（只做 M3；未改数据库表结构、设计/交接包/Change Set/`app_dev_phases`）。

### 8.1 后端改动（API）

- `PUT /api/apps/:id/requirements-doc/template` 扩展 `scope`：不传/`module` = 旧行为（只切当前模块，返回结构不变）；`scope='app'` = 应用级切换（单事务遍历全部未归档模块，按 section key → 标题映射，kind 一致才保留 `data`，每模块 `version+1` 且 `source='template-change'`，同步应用默认模板）。任一未归档模块已确认 → 409 + `issues:[{moduleId,moduleKey,title}]`，**不写任何模块**；归档模块不参与、不改。
- 新增只读 `POST /api/apps/:id/requirements-doc/template/preview`：body `{templateId}`（`scope` 接受但固定按 app），返回 `{template,scope:'app',modules[],blockedModules[],canApply,warnings}`；每模块含 `docStatus/docVersion/fromSections/toSections/kept/dropped/added/warnings`。**不写库、不产版本、不建文档**；无文档模块显示 `fromSections:0`，应用时按模板建 v1。
- 新增 `PUT /api/apps/:id/requirements-modules/order`：`moduleIds` 必须与全部未归档模块 id 集合完全一致（缺失/多余/重复/含归档 → 400 且不改库），事务写 `position=0..n-1`，归档模块 position 不动；返回 `{modules}`。
- doc 对话历史按模块：settings key `app.<appId>.requirementsDocChat.<moduleId>`；旧 key `app.<appId>.requirementsDocChat` **保留**。`GET /chat?moduleId=`：模块 key 有值直接返回；默认模块且无模块 key 时回退旧 key 并追加 `legacyFallback:true`；非默认模块不回退。`PUT /chat?moduleId=` 只写模块 key（未知模块 404、归档 409）；不删除/改写旧 key；没有模块的旧应用不传 moduleId 时仍写旧 key（不懒创建模块）。
- `createModule` 非需求阶段 409 文案改为明确路径：设计阶段先「重新编辑需求」；开发/完成阶段先发起“需求+设计”变更。

### 8.2 前端改动

- 需求页三栏改为 **模块 rail | 对话 | 文档**（≥1280）；总览用顶部 strip + `RequirementOverview` 弹窗（不占第四列）。≤1024 模块/对话/大纲均为抽屉（遮罩/Esc/三抽屉互斥）；≤768 单栏 + 抽屉。
- 新增 `RequirementModuleRail.vue`（列表/选中/新增/上移下移/编辑/归档/恢复/已归档折叠；状态 chip、`vN`、必选、负责人/描述；模块多时内部滚动）。
- 新增 `ModuleEditDialog.vue`（title ≤120 / description / ownerLabel / required；PATCH）。
- 新增 `RequirementOverview.vue`（必选进度、全部模块是否确认、bundle latest 版本/短 hash、实时 hash 与“内容已变化”、pending 列表、“完成需求阶段”）。
- 新增 `AppTemplateSwitchDialog.vue`（打开即 preview；逐模块 from→to、kept、dropped/added、warning、blocked；二次确认后 `scope='app'`）。
- 新增 `module-helpers.js` + `.test.mjs`：初始模块（stored → default → 第一个未归档，失效/归档回退并说明原因）、进度、排序移动、归档回退、新增门禁、preview 可用性、短 hash/状态/版本标签。
- 新增 `api-query.js` + `.test.mjs`（`moduleQuery` 纯函数）。
- `RequirementsDocView.vue`：模块初始化/切换（先 flush 未保存编辑，失败中止切换）、模块 CRUD/排序/归档恢复、模块级确认（多模块确认后**不离开**需求页，自动跳到下一个 pending）、bundle confirm 后刷新并 `emit('confirmed')`、只读/历史只读（已确认、归档、设计/开发阶段；非需求阶段模板入口也拦截）、模板应用级切换、所有文档/版本/导出/聊天调用带 `moduleId`、localStorage `workbench:app:<appId>:requirementsModuleId`。
- `DocChatPanel.vue`：`moduleId/moduleTitle` props；历史按模块读写；旧历史回退提示条；AI preview/apply/stream 带 `moduleId`；仅在真正产生新消息/建议变更时落库（打开模块不隐式写模块 key，归档/已确认只读不写）。
- `VersionHistoryDialog.vue`：`moduleId/moduleTitle`，版本列表/详情/手动保存/回滚按模块；父组件按模块 key 重挂载。
- `TemplateCenterDialog.vue`：`applyScope`（默认 module = 旧行为；需求页传 app），应用级时按钮文案“应用到全部模块”+说明。
- `AppShell.vue`：向需求页传 `app-status`（非 requirements 整页只读）。
- 未新增 Pinia store、未新增依赖；未改 `shared/theme.css`（现有 token 足够）。

### 8.3 测试数与命令结果（实际执行）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过（tsc） |
| `npm test --prefix backend` | **187/187 通过**（基线 178，+9：`requirements/module-ui-support.test.ts` 8 项 + must-fix chat 守卫 1 项） |
| `npm run smoke:requirements --prefix backend` | 通过（旧 API 默认模块） |
| `npm run smoke:modules --prefix backend` | 通过（已扩展 M3：排序/preview+apply/blocked/按模块 chat） |
| `npm run smoke:change-set --prefix backend` | 通过 |
| `npm run smoke:design-handoff --prefix backend` | 通过 |
| `npm run smoke:design --prefix backend` | 通过 |
| `npm test --prefix frontend` | **107/107 通过**（基线 96，+11：module-helpers 9 + api-query 2） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过（全部 SFC 导入完整） |

新增后端测试（9）：preview 只读/逐模块影响；应用级切换（两模块 6 节、version+1、template-change、内容不串、归档不动、默认模板同步）；已确认模块 409 + issues 且不写库；`scope='module'` 回归；排序合法/缺失/多余/重复/含归档 400 不改库；新增门禁文案；按模块 chat（隔离/旧 key 回退/写不删旧 key/未知 404）；按模块 chat 守卫（must-fix：未知 GET/PUT 404、归档读允许/写 409、缺省仍走默认）；HTTP 路由接线（preview 只读、scope=app、order 400）。smoke:modules 扩展覆盖同类 API 全链路。

### 8.4 Playwright（临时 data/projects，端口 3421）

- 环境：`RG_DATA_DIR`/`RG_PROJECTS_DIR` 指向 `C:\Users\icecream\AppData\Local\Temp\opencode\m3-e2e\`，`PORT=3421`、`OPENCODE_AUTO_START=false`；后端托管已构建 `frontend/dist`；`playwright` 1.59.0（`E:\work_space_primeton\node_modules`）；脚本为仓库根 `.tmp-m3-e2e.cjs`（跑完删除）。
- 场景（UI 真实 API，不调模型）：UI 新建应用 → 默认模块 MOD-001；新增模块（标题/负责人/描述）；两模块编辑同一章节互不影响；版本按模块独立（模块一手动保存 v2，模块二仍 v1）；模板应用级预览（13→6，两模块）→ 二次确认应用（两模块 6 节、version+1、template-change、应用默认模板同步）；填必填（API）后模块 1 确认 → 仍 requirements + pending + 无“完成需求阶段”；已确认模块阻塞应用级切换（预览列出、按钮 disabled）；总览 1/2；模块 2 确认 → 完成需求阶段 → design + 需求页只读 + 新增禁用/提示；设计阶段“重新编辑需求”回到 requirements 且可新增；上移排序；编辑负责人；归档当前模块 → 回退 + 归档只读 + 恢复；按模块 chat 头部/空态；浅/深 × 1440/1024/768 截图矩阵（含总览、模板预览、设计/开发只读、1024/768 三抽屉）。
- 结果：**43 项断言全部通过；48 张截图**；**0 console error / 0 pageerror / 0 非预期 API≥400 / 0 横向溢出 / 0 深色白底块**。
- 另做一次性 Playwright 校验（临时数据复用）：设计阶段点击模板入口被拦截（提示+不打开模板中心）、新增模块禁用+提示，0 console/API 错误。
- 截图目录：`C:\Users\icecream\AppData\Local\Temp\opencode\m3-e2e\shots\`；`summary.json` 为断言/错误汇总（临时目录，评审后可删）。

### 8.5 与交接单的偏差（逐条）

1. **`template/preview` 的 `scope`**：接口接受 `scope` 但固定按 `app` 返回（交接单允许缺省 app、M3 UI 固定 app）；未实现 module 级 preview。
2. **`RequirementOverview` 形态**：按交接单允许的“顶部 strip + 弹窗”实现，未做成常驻第四列。
3. **`TemplateCenterDialog` 单模块入口**：保留 `applyScope='module'` 默认值（内部/测试可用），需求页传 `app`；未删除 `switchDocTemplate` 单模块 API。
4. **排序**：只做上移/下移（未做拖拽），符合 §4 约束。
5. **旧 key 回退语义**：`legacyFallback` 只影响展示提示；模块历史写入后旧 key 仍在库中但不再返回（按决策“只读回退、不删除”）。
6. **`app.requirementDoc` 摘要**：AppShell 顶栏仍显示默认模块摘要（M2 既有行为，未改 payload）。
7. **开发阶段只读截图**：临时库用 `better-sqlite3` 把准备应用状态置 `development`（仅临时数据；未新增测试专用 API）。
8. **smoke:modules**：在原脚本追加 M3 段，并把“模板切换不传播”的日志改为“scope=module 只影响当前模块；scope=app 另行验证”。
9. **chat 落库时机**：初版在“打开模块/加载历史”时也会触发一次保存（会把旧历史隐式复制到模块 key，并在归档模块上产生 409 console 噪音）；已改为只在真正新增消息/修改建议时落库，并跳过只读/归档模块。端到端复跑后 0 console / 0 非预期 4xx。

### 8.6 未验证项

- 未在真实 3300 / app1 上验证（按要求未停/未改真实实例；真实库未写入）。
- 未用真实模型跑多模块 doc 聊天（只验证历史 API 与 UI 空态/头部；`OPENCODE_AUTO_START=false`）。
- 未验证 >50 模块（无虚拟列表，rail 内部滚动）；未验证多人并发编辑同一模块。
- 未验证开发阶段“发起变更”时的模块选择（M5）；设计模块化（M4）与交接包/Change Set 模块化（M5/M6）不在本批。
- 未验证 <768 移动端（本批按交接单到 768）。
- 未验证归档模块在应用级切换后“恢复再对齐”的真实操作（行为按设计：归档不动，恢复后需再次应用级切换）。

### 8.7 已知限制

- 负责人/必选只是标签/进度语义，不是权限；无编辑锁/冲突提示。
- 应用非需求阶段整页只读（含模块信息编辑/排序/归档/恢复），需先「重新编辑需求」（设计）或走 Change Set（开发）。
- 预览的 `dropped` 列出所有被移除章节（包括空章节），有内容时另给 warning。
- 需求聚合版本只在模块确认（单模块）/bundle confirm 时落库；自动保存/模板切换不产 bundle（M2 既有）。
- AppShell 顶栏状态仍按默认模块文档摘要展示；多模块明细在需求页总览。
- 归档模块的文档/版本永久保留、只读；无物理删除入口。
- 对话框截图受动画影响；E2E 使用 `reducedMotion` 稳定截图（不改变产品行为）。

### 8.8 改动文件清单

新增（后端）：

- `backend/src/requirements/module-ui-support.test.ts`（9 项 M3 单测）

新增（前端）：

- `frontend/src/requirements/RequirementModuleRail.vue`
- `frontend/src/requirements/ModuleEditDialog.vue`
- `frontend/src/requirements/RequirementOverview.vue`
- `frontend/src/requirements/AppTemplateSwitchDialog.vue`
- `frontend/src/requirements/module-helpers.js` + `module-helpers.test.mjs`（9 项）
- `frontend/src/requirements/api-query.js` + `api-query.test.mjs`（2 项）

修改（后端）：

- `backend/src/requirements/doc.ts`（`mapSectionsToTemplate` 抽取 + `previewAppDocTemplate` / `switchDocTemplateForApp`）
- `backend/src/requirements/modules.ts`（`reorderModules` + `createModule` 409 文案）
- `backend/src/requirements/routes.ts`（template preview / `scope=app`、模块排序、按模块 chat key）
- `backend/scripts/modules-smoke.ts`（追加 M3 段、更新日志）
- `backend/package.json`（test 脚本加入新测试文件）

修改（前端）：

- `frontend/src/requirements/api.ts`（模块/bundle/preview/apply 类型与函数；文档/版本/导出/chat 全部可选 `moduleId`）
- `frontend/src/requirements/RequirementsDocView.vue`（模块 rail/总览/切换/CRUD/排序/归档恢复/确认/完成需求阶段/只读/响应式）
- `frontend/src/requirements/DocChatPanel.vue`（module props、按模块历史、落库时机、AI 调用带 moduleId）
- `frontend/src/requirements/VersionHistoryDialog.vue`（按模块版本）
- `frontend/src/requirements/TemplateCenterDialog.vue`（`applyScope` 应用级文案 + `hasDivergentTemplates` 对齐入口）
- `frontend/src/workbench/AppShell.vue`（传 `app-status`）
- `frontend/package.json`（test 脚本加入 2 个新测试文件）

未改：数据库表结构/迁移、`shared/theme.css`、`App.vue`、设计/交接包/Change Set/`app_dev_phases`、`projects/`、`AGENTS.md`、M2 接续单。


### 8.9 主会话评审 must-fix（2026-11-13）

主会话评审结论：主路径通过（独立复跑 186/186、106/106、5 支冒烟与自有 Playwright）；以下 3 项 must-fix 已修，未扩大范围。

**MF-M3-1（数据丢失风险）应用级模板切换前必须 flush（已修）**

- `RequirementsDocView.vue`：`useTemplate` 改为 async；只读/“模板相同且无差异模块”先判断并直接返回（**不 flush、不写库**）；否则先 `flushAll()`（Markdown + 结构化章节），失败弹“当前模块还有未保存内容，已取消切换；请先处理保存失败”并中止，成功后打开 preview 弹窗。
- Playwright（确定性）：测试页注入只阻断 1000ms 定时器的脚本，模拟“防抖未落盘”；在 `#doc-sec-problem textarea` 输入唯一文本后打开模板中心（断言仍为“未保存”）→ 点击“应用到全部模块”（触发 flush）→ 二次确认。结果：切换后 `problem` 仍包含该文本、最新版本 `source=template-change`、网络顺序为 `PUT /sections/problem` 先于 `PUT /template`、UI 仍显示输入内容。

**MF-M3-2（一致性）chat 未知 moduleId 应 404（已修）**

- `routes.ts` GET `/chat`：显式 `moduleId` 用 `moduleById(appId, moduleId)` 校验，不存在 → 404「模块不存在：…」；缺省/空串仍走默认模块；归档模块读历史仍允许（写仍 409）。PUT 继续经 `resolveModule` → 未知 404。
- 新增后端测试「按模块 chat 守卫：未知 moduleId GET/PUT 404；归档模块读允许、写 409」：未知 GET/PUT 404；归档 GET 200 且返回历史、归档 PUT 409；缺省/空 `moduleId` 仍走默认模块；无模块旧应用仍写旧 key。

**MF-M3-3（决策 2 漏洞）同模板也要能“对齐全部模块”（已修）**

- `module-helpers.js` 新增 `hasDivergentTemplates(modules, currentTemplateId)`：未归档模块存在非空 `templateId` 且 `!== currentTemplateId` 即 true（归档/无文档忽略）。
- `RequirementsDocView.vue` 计算 `templatesDiverged`；`TemplateCenterDialog` 新增 `hasDivergentTemplates` prop（默认 false）：按钮 disabled 条件改为 `selected.id === currentTemplateId && !hasDivergentTemplates`；文案在“使用中”与“应用到全部模块”间切换；应用级说明增加“存在模板不一致模块时会把所有未归档模块对齐”。
- `useTemplate` 的 early-return 改为 `template.id === payload.template.id && !templatesDiverged`；本来全一致时不重复应用。
- 单测：`hasDivergentTemplates` 的 true/false（同模板、归档忽略、无文档忽略、B 单独模板、空 current）分支。
- Playwright：模块 A 标准 PRD、模块 B 单独切精简 PRD（`PUT /template {templateId, scope:'module', moduleId:B}`）→ 刷新后打开模板中心选标准 PRD，按钮可用 → 预览 A `13 → 13`、B `6 → 13` → 应用 → 两模块都 13 节、都 `builtin-prd`、最新版本 `template-change`；再次打开模板中心，同模板按钮恢复“使用中”禁用。

**最终验证（must-fix 后复跑）**

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **187/187**（+1 chat 守卫） |
| `npm run smoke:requirements` / `npm run smoke:modules` | 通过 |
| `npm test --prefix frontend` | **107/107**（+1 `hasDivergentTemplates`） |
| `npm run typecheck` / `build` / `check:vue`（frontend） | 全部通过 |

- must-fix Playwright：**18 项断言、4 张截图、0 console/pageerror、0 非预期 API≥400**；截图在 `C:\Users\icecream\AppData\Local\Temp\opencode\m3-mf\shots\`（`mf1-before-apply` / `mf1-after` / `mf3-preview` / `mf3-after`）。
- 未改 `AGENTS.md`/接续单；未触碰真实 `data/`/`projects/`、未停/改 3300、未读取 `.env`。

---

## 9. 主会话评审前置约束（实施必读）

1. 决策不可回退：模块新增只在需求阶段（设计阶段先 reopen 需求；开发走 Change Set）；模板切换必须应用级；chat 历史按模块。
2. 旧接口默认行为不变：`PUT /template` 不传 `scope` = 按模块；文档接口不传 `moduleId` = 默认模块；旧冒烟必须通过。
3. 应用级模板切换必须“预览 + 二次确认”，预览只读；有已确认模块时拒绝写入（409 + 模块列表）。
4. chat 旧 key 只读回退，**不得删除/覆盖旧 key**；模块 key 拆分后不串。
5. 不新增数据库列/表；不写真实 `data/`/`projects/`；不重启/停 3300；不读/打印 `.env`。
6. 不顺手改设计/开发页（M4/M5）、不引入新的状态库/大依赖；沿用现有 Pinia/组合式写法与 `shared/theme.css` token。
7. 前端单测保持现有 `.test.mjs` + `node --test` 风格；`package.json` 的 test 脚本要包含新增测试。
8. 实施结果必须回传：改动文件、测试数（基线 178/96 → ?）、Playwright 场景/截图数/错误数、与本节偏差、未验证项。
