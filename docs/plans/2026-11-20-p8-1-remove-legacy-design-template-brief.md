# P8-1 实施单：彻底移除旧版设计模板（1b）（2026-11-20）

> 用户决策（2026-11-20）：**不再兼容旧版设计模板**，设计阶段全部走「设计模板 = 应用类型 × 视觉风格 + 页面库」；旧版原型模板（`prototype_templates` / `builtin-prototype-*` / `adw-template-proto-<legacy-id>` / 新建应用“旧版兼容” / 设计视图旧徽标）**彻底删除**。
> 本单覆盖此前“不改 DB 表”的约定（用户明确授权 1b）：DB 由 5 表改为 **4 表**（`apps`、`app_settings`、`app_sessions`、`requirement_templates`），`prototype_templates` 表删除；`apps.prototype_template_id` 列删除。
> 上游：P7 设计稿、P7-3b/P7-4b、`docs/STATUS.md`。下一单 P8-2 才做“设计视图原型真实模板预览（Y）”。

---

## 0. 出口标准

1. 代码/DB 中不再有旧原型模板概念：
   - 无 `prototype_templates` 表、无内置 seed、无 `/api/prototype-templates` 路由、无 `builtin-prototype-*` 数据、无 `prototype_template_id` 列/字段、无 `legacyPrototypeTemplate`、无 `adw-template-proto-<legacy-id>` skill 生成/清理分支。
   - 需求模板中心（`requirement_templates` / `TemplateLibraryDialog` / `adw-template-req-*`）**保持不变**。
   - 设计模板 skill `adw-template-proto-<applicationType>`（pack 型）与 pack 风格**保留**（只是不再用旧原型模板）。
2. 新应用：
   - `POST /api/apps` 只接受需求模板 + 设计系统（`designPack/designApplicationType/designStyle` 或 `designSystem`）；请求里带 `prototypeTemplateId` 被忽略（或 400？见 §3；建议忽略并 warning，避免旧客户端报错）。
   - payload 不再返回 `prototypeTemplateId/Name/Source` 与 `legacyPrototypeTemplate`；`designSystem` 始终解析（无设计三键 → 默认 pack/类型/风格，`global-default`）。
3. 设计视图：
   - 徽标只显示 `<应用类型名> · <风格名>`（不再出现“企业级专业管理”等旧名）。
   - 原型渲染皮肤（tokens/shell）由应用设计系统的 **风格** 构造，不再从旧原型模板取；`tokens.json` / `_manifest.json` / `artifacts.tokens` 用 **`styleId`**（写风格 tokens + 名称；`shell` 概念移除）。
4. 升级/兼容：
   - 新库：只建 4 表。
   - 旧库 + `apps` 为空：重建为 4 表，保留 `requirement_templates`（不再保留/seed `prototype_templates`）。
   - 旧库 + `apps` 非空：fail-closed（不变）。
5. 现有功能回归：需求模板中心、设计模板中心/预览、开发视图/digest/ui-check/fidelity、P7-4b 渲染器（树/弹窗/分页/操作）均保持可用；e2e/冒烟全绿（断言数会变化，如实更新）。

---

## 1. DB 与后端清理

### 1.1 DB（`backend/src/db-migrate.ts` / `db-guards.ts` / tests）

- `NEW_TABLES` 改为 4 张：`apps`、`app_settings`、`app_sessions`、`requirement_templates`。
- `PRESERVED_TABLES` 只保留 `requirement_templates`。
- 删除 `prototype_templates` 的 `CREATE TABLE` / index；删除 `apps.prototype_template_id` 列。
- 旧库重建分支：drop 旧应用域表 + 仍存在的 `prototype_templates`；保留 `requirement_templates`。
- `db-guards`：表名/空库/旧库判定按 4 表更新；`apps>0` 仍 fail-closed。

### 1.2 删除旧原型模板模块与路由

- 删除 `backend/src/design/builtin-templates.ts`。
- 删除 `backend/src/design/templates.ts`（原型模板 CRUD/seed/default）；如仍有被引用的通用错误类型（`DesignError`），迁到 `design/errors.ts` 或复用现有 `DesignError` 位置（保持 API 状态码语义）。
- `backend/src/templates/routes.ts`：删除 `/api/prototype-templates*` 全部路由；需求模板路由不变。
- `backend/src/design/types.ts`：删除 `PrototypeTemplate`/`PrototypeTokens`/`PrototypeShell` 等旧模板类型；保留设计系统/pack 类型。
- `backend/src/design/prototypes.ts`：
  - `POST /api/apps/:id/design/:module/prototypes` 入参 `templateId` → **`styleId`**；
  - 校验 `styleId` 属于内置/自定义 pack 的 style（默认 pack），非法 400；
  - `_manifest.json` 写 `styleId`（不再 `templateId`）；
  - `tokens.json` 写 `{ styleId, name: style.name, tokens: style.tokens }`（不再写旧模板 `shell`/`templateId`）；
  - 旧 PNG 清理、hash/魔数/大小校验逻辑不变。
- `backend/src/workspace/artifacts.ts`：`tokens` 摘要字段 `templateId` → `styleId`。

### 1.3 应用/模板解析/payload

- `backend/src/apps/routes.ts`：删除 `prototypeTemplateId` 校验与写列；`POST /api/apps` 只处理需求模板 + 设计系统；`GET /api/apps/:id/templates` 只返回需求模板（可保留端点，响应删 prototype 字段）；其它路由不动。
- `backend/src/apps/template-resolution.ts`：只解析需求模板；删除 prototype 解析/`prototypeSource`。
- `backend/src/apps/payload.ts`：删除 `prototypeTemplateId/Name/Source`、`legacyPrototypeTemplate`；`designSystem` 始终返回。
- `backend/src/apps/design-system.ts`：
  - 删除 `legacy` 分支与 `prototypeTemplateId/Name` 字段；无设计三键 → 默认 pack（`global-default`）；
  - 删除对 `design/templates` 的依赖；
  - `appDesignSystemPayload` 只返回 `{ designSystem }`。
- `backend/src/templates/distribution.ts`：
  - 删除旧原型模板 skill 生成（`writePrototypeTemplateSkill` / legacy selectedPrototypeTemplate / `kind='prototype'` 分支）与 `expectedSkillIds` 中的旧模板 skill；
  - 保留设计模板 skill（`adw-template-proto-<applicationType>`，manifest `kind='design-system'`）、团队/方法 skill、需求模板 skill；
  - 清理逻辑只按 manifest 白名单（不变）。
- `backend/src/apps/scaffold.ts` / 其它引用：删除 `prototype_template_id`、旧模板 skill 期望；工作区生成逻辑不变。
- 全仓 grep 清理：`prototype_templates`、`prototype_template_id`、`prototypeTemplate`、`PrototypeTemplate`、`builtin-prototype`、`legacyPrototype`、`adw-template-proto-<legacy>`。**保留** `adw-template-proto-<applicationType>` 设计 skill 与 pack style。

---

## 2. 前端清理与“按所选设计模板出原型”

### 2.1 新建应用/首页

- `NewAppDialog.vue`：
  - 删除「旧版兼容（原型模板）」`<details>`、`prototypeTemplateId` 表单字段、`listPrototypeTemplates` 调用与相关提示；
  - 保留「需求模板」下拉（不动）+「设计模板」选择（picker/默认 pack 类型×风格）；
  - `createApp` 只传需求模板 + 设计三个字段。
- `HomeShell.vue`：应用摘要只显示设计模板（类型 · 风格），删除旧原型模板分支。
- `api.ts`：`AppInfo`/`CreateAppInput`/`AppTemplatesResponse` 删除旧原型模板字段；`getAppTemplates` 只取需求模板（或删除该调用，见 2.3）。

### 2.2 设计视图（不引入 iframe，真实预览留给 P8-2）

- `DesignView.vue`：
  - 删除 `prototypeTemplates`/`listPrototypeTemplates`/`pickPrototypeTemplate`/legacy 徽标；
  - 徽标只显示 `designSystem.applicationType.name · designSystem.style.name`；
  - 原型皮肤改为 `skinFromStyle(designSystem.style)`（见 2.4）；`DesignPrototypePanel` 传 `skin`；
  - PNG 导出/自动导出 payload 用 `styleId`。
- `DesignPrototypePanel.vue` / `PrototypeCanvas.vue`：
  - `template` prop 改为 `skin`（或保留 `template` 形状但类型改名为 `PrototypeSkin`）；
  - 线框渲染、缩放、PNG 导出逻辑不变；去掉旧模板名。
- `design/types.ts`：用 `PrototypeSkin`（tokens + shell）替代 `PrototypeTemplate`；`PrototypeSkinCategory` 可删或收敛为 `'custom'`。
- 新增纯函数（建议放 `frontend/src/design/prototype/contract-view.js` 或新 `skin.js`，便于单测）：
  - `skinFromStyle(style)`：`tokens = { primary/accent/neutral/background 来自 style.tokens, font: 默认字体栈, radius: style.tokens.radius, spacing: density==='compact'?10:12, density }`；`shell = { type:'topbar', sidebarDark:false, contentWidth:1180 }`；`id=style.id`、`name=style.name`、`category='custom'`。
- `design-adapter.js`：删除 `pickPrototypeTemplate`（如无其它使用）。
- `shared/template-api.ts`：删除未使用的旧原型模板类型/函数（`listPrototypeTemplates` 等）；需求模板函数不动。
- `design-export.js`：`buildPrototypePayload` 输入/输出 `templateId` → `styleId`；manifest 解析字段同步。

### 2.3 旧逻辑残留检查

- 全前端 grep：`prototypeTemplate`、`PrototypeTemplate`、`legacyPrototypeTemplate`、`旧版兼容`、`builtin-prototype`、`pickPrototypeTemplate`；只允许 P8-2 将新增的“模板预览”命名（如 `templatePreview`）。
- 设计模板中心（`DesignTemplateCenter.vue`）本就没有旧版分组，不改；预览 iframe 不变。

---

## 3. 测试与回归（数字会变化，必须如实记录）

- 后端：
  - `db-migrate.test.ts`：4 表、旧库重建保留需求模板、`apps>0` fail-closed、无 `prototype_templates`。
  - `db-guards.test.ts` 同步。
  - `apps/templates.test.ts`：删除原型模板 CRUD 用例；需求模板用例保留。
  - `apps/design-system.test.ts`：删除 legacy 用例；默认/自定义/非法/payload 断言更新（无 prototype 字段）。
  - `design/reference.test.ts`：`styleId` + 风格 tokens（不再 templateId/shell）。
  - `templates/distribution.test.ts`：删除 legacy 原型 skill 用例；设计模板 skill/团队/需求 skill 保留。
  - `apps/scaffold.test.ts`：旧模板 skill 期望删除；设计系统产物不变。
  - 其它引用旧模板的测试同步。
- 前端：
  - `design-export.test.mjs`：`styleId`。
  - 新增 `skinFromStyle` 单测（tokens/shell/密度默认）。
  - `design-adapter.test.mjs`：删除 `pickPrototypeTemplate` 用例。
- 脚本/冒烟：
  - `workspace-smoke.ts`：4 表、无 `prototype_templates`、无旧模板 skill；设计系统/蓝图/团队/设计 skill 断言保留。
  - `verify-agent-assets.ts`：期望 skill 中删除旧原型模板 skill。
  - `p2/p3/p7-3b/p7-4b/preview` e2e：删除 legacy/旧徽标/旧 templateId 断言；p3 `design-template-badge` 断言改为设计系统徽标；`manifest.styleId`；p7-3b 删除「旧版兼容」与 legacy fixture；断言数变化记录。
- 命令：`npm run build/test --prefix backend`（临时目录）、`npm test/typecheck/build/check:vue --prefix frontend`、`smoke:workspace`、`smoke:assets`、全部 e2e、`build:report`。

---

## 4. 文档同步（5 表 → 4 表）

- `docs/STATUS.md`：新增 P8-1 节；5 表→4 表；删除“旧应用 legacy”描述；“待用户执行”切换清单同步（apps=0、4 表）。
- `docs/plans/2026-11-19-design-template-and-dev-linkage-p7-design.md`：追加 P8-1 记录（或新建 P8 设计稿；至少状态行说明旧原型模板已删除）。
- `README.md` / `AGENTS.md`：5 表→4 表；删除旧原型模板/legacy 描述；设计模板为唯一设计入口；目录/能力说明同步。
- `docs/ops/switch-to-agent-first.md`：验收 SQL/通过标准 5 表→4 表，删除“原型模板≥2”。
- `docs/report/ai-dev-workbench-overview.md` + `docs/report/README.md`：数据表、设计模板、去旧版兼容、tokens/styleId；重新 `build:report`（截图可暂不重截，注明）。
- 本实施单末尾追加「实施结果（2026-11-20）」。

---

## 5. 边界

- 只改：`backend/src/**`（本单授权改 DB 建表/列）、`frontend/src/**`、`backend/scripts/**`（测试/冒烟）、`docs/**`、`README.md`、`AGENTS.md`。
- 不动：`templates/design-system/**`、`templates/afc-remote/**`、`templates/agent/**`（团队/设计 skill 内容）、需求模板数据/UI、预览 `preview.html` 业务。
- 不启停真实 3300/4771；不读写真实 `data/`、`projects/`、`.env`；不做 git；不调真实模型。
- 临时实例只用临时目录/端口；结束清理。
- 如果某处无法安全删除（例如仍被需求模板中心共享），停下报告，不要留半套。

---

## 6. 收尾与回报

- 结果 → 验证命令与输出（后端/前端数字、e2e 各脚本数字、smoke、build:report）→ 偏差 → 未验证 → 环境确认。
- 明确列出所有被删除的文件/路由/字段/表，以及仍然保留的 `adw-template-proto-<applicationType>` 设计 skill。

---

## 实施结果（2026-11-20）

### 结果

P8-1 已按 §1—§4 完成：旧版设计模板（原型模板）从 DB、API、后端模块、分发、payload、前端入口/徽标/导出字段中彻底移除；设计视图原型皮肤改由应用设计系统风格构造；DB 为 **4 表**。需求模板中心、设计模板中心/预览、P7-4b 渲染器、开发视图/digest/ui-check/fidelity 均回归通过。

### 删除清单

- **文件**：`backend/src/design/builtin-templates.ts`、`backend/src/design/templates.ts`、`backend/src/design/types.ts`。
- **表/列**：`prototype_templates`（含索引/内置 seed）、`apps.prototype_template_id`。
- **路由**：`/api/prototype-templates`（GET/POST/GET:id/PUT/DELETE/:id/duplicate）、`kind=prototype` 的 `/api/templates/:kind/:id/sync|usage` 分支。
- **后端字段/逻辑**：`AppInfo.prototypeTemplateId/Name/Source`、`legacyPrototypeTemplate`、`DesignError` 旧位置（已迁 `design/errors.ts`）、`resolveAppTemplates().prototype`、`SyncTemplatesResult.prototypeTemplate`、`SyncTemplatesOptions.prototypeTemplateId`、`writePrototypeTemplateSkill`/`prototypeSkillMarkdown`、`expectedSkillIds` 旧原型模板分支、`scaffoldApp.prototypeTemplateId`、设计系统 `legacy` 分支/`prototypeTemplateId/Name`、`design/prototypes` 的 `templateId`（改 `styleId`）、`artifacts.tokens.templateId`（改 `styleId`）、digest legacy 行。
- **前端**：新建应用「旧版兼容（原型模板）」`<details>` 与 `prototypeTemplateId` 表单、`listPrototypeTemplates`/`deletePrototypeTemplate`/`PrototypeTemplate` 类型、`TEMPLATE_CATEGORY_LABELS` 旧类别、`pickPrototypeTemplate`、`DesignView` 旧徽标回退/旧模板拉取、`AppShell/HomeShell` 旧原型模板摘要、`design-export` 的 `templateId`（改 `styleId`）、`AppDesignSystem.legacy`。
- **skill**：`adw-template-proto-<legacy-id>`（旧原型模板 skill）的生成/期望/清理分支。
- **测试/脚本**：旧原型模板 CRUD/legacy 用例与断言；`e2e:p7-3b` 旧版兼容/legacy 场景（45→38）。

### 保留清单

- 需求模板中心：`requirement_templates`、`TemplateLibraryDialog.vue`、`/api/requirement-templates`、`adw-template-req-*`、`POST /api/templates/requirement/:id/sync|usage`。
- 设计模板：内置 pack `templates/design-system/**`、`/api/design-system*`、设计模板中心/`preview.html`、`adw-template-proto-<applicationType>` 设计模板 skill（manifest kind `design-system`）。
- 团队/方法 skill、5 个 command、设计参考包（`design-brief.md`/`tokens.json`/`prototypes/*.png`，其中 tokens/manifest 用 `styleId`）、P7-4b 渲染器、开发关联与 fidelity。
- `templates/afc-remote/**`、`templates/agent/**` 内容未改。

### 验证命令与数字（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **133 / 133**（原 132；db-migrate 新增 5 表重建用例，distribution 删除旧原型用例） |
| `npm test --prefix frontend` | **104 / 104**（原 102；-1 `pickPrototypeTemplate` +3 `skinFromStyle`） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过（2800 modules；`dist/preview.html` 正常） |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416；新增 4 表/无 `prototype_template_id`/设计 skill manifest 断言） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型；skill/command 加载正常） |
| `npm run e2e:preview --prefix backend` | **77**（保持） |
| `npm run e2e:p7-3b --prefix backend` | **38**（原 45；删除旧版兼容 2 条 + legacy 场景 5 条） |
| `npm run e2e:p7-4b --prefix backend` | **48**（保持） |
| `npm run e2e:p7-6a --prefix backend` | **15**（保持） |
| `npm run e2e:p2 / p3 / p4 --prefix backend` | **116 / 126 / 128**（保持；p3 徽标断言改为设计系统徽标、manifest/styleId/tokens 无 shell） |
| `npm run build:report --prefix backend` | 通过：HTML 735,580B（718.3KB，离线/0 console error/三档无横向溢出）、PDF 1,095,036B（14 页）、flow PNG 567,720B |

### 偏差

1. `db-migrate.ts` 仍保留 `prototype_templates`/`prototype_template_id` 字面量（仅用于识别并删除旧库）；测试/smoke 的负数断言保留旧名作为“已删除”证据。
2. 旧客户端 `POST /api/apps` 带 `prototypeTemplateId` 时忽略并返回 warning（不 400）。
3. 设计视图仍为线框渲染，皮肤由 `skinFromStyle(designSystem.style)` 构造（topbar shell、风格 tokens、compact→spacing 10 / comfortable→12）；真实模板 iframe 预览留 P8-2。
4. `frontend/dist`/`backend/dist` 已按本单重建（仓库工作区产物）；截图未重截（`docs/report` 截图仍为 P7-A 版本，已在 report README 注明）。
5. `docs/report` PDF 因新增 P8-1 内容接近页数上限，已压缩正文至 14 页。
6. `e2e:p2` 的 3.2/3.2b（模板 skill / manifest 已生成）由“立即检查”改为 `waitFor` 文件出现（原有竞态；断言数仍 116）。

### 未验证

- 真实 3300 切换后的运行态（本单未启停 3300/4771）。
- 真实浏览器下新皮肤的人工视觉验收（结构/缩放/PNG 导出已由 `e2e:p3/p7-4b` 覆盖）。
- 旧库 `apps>0` 的 fail-closed 仅单测覆盖（未对真实库执行）。
- 生成物 `projects/<app>/frontend/` 的 install/build、真实 AFCenter 宿主 `pm-*`、EOS 构建/运行态。

### 环境确认

- 仅改 `backend/src/**`、`frontend/src/**`、`backend/scripts/**`、`docs/**`、`README.md`、`AGENTS.md`；未改 `templates/design-system/**`、`templates/afc-remote/**`、`templates/agent/**`、需求模板数据/UI。
- 所有测试/e2e 使用临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` 与临时端口（3416/3419/3422/3423/3425/3427/3444 等），结束清理；未启停真实 3300/4771。
- 未读写真实 `data/`、`projects/`、`.env`；未调用真实模型；未执行任何 git 操作；未新增依赖、未 `npm install`。
