# 创建应用选模板 + 模板解析交接单（#7）

日期：2026-11-13
用途：新开实施会话执行；主会话评审。
状态：**待实施**。
上游：用户确认“创建应用时选需求模板 + 设计原型模板”，且需求阶段原型预览（#8）必须跟随当前设计原型模板。
范围：
- 创建应用时可选**需求模板**（stage=requirements）和**设计原型模板**；
- 存为应用级默认值；首次需求文档/设计项目初始化时使用；
- 之后在需求/设计阶段切换模板时同步应用默认值；
- 提供只读模板解析（设计项目当前模板 > 应用默认 > 全局默认），供 #8 需求原型预览使用。
**不做 #8 原型预览本身、不做 #6 模块化、不改现有设计/需求语义。**

**重要**：真实工作台可能在运行（app1 用户数据）。不修改/删除真实 `data`/`projects/app1`；Playwright 用临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` + 新应用。不读取/打印 `backend/.env` 或凭据。

---

## 1. 数据与 API

### 1.1 `apps` 新列

`backend/src/db.ts` 用 `ensureColumn` 增加（旧应用为 null，回退默认）：

- `requirement_template_id TEXT`
- `prototype_template_id TEXT`

不建新表、不做数据迁移。

### 1.2 创建应用

`POST /api/apps` body 新增可选：

- `requirementTemplateId?: string` → 必须 `getRequirementTemplateOrThrow(id)`（stage=requirements）
- `prototypeTemplateId?: string` → 必须 `getPrototypeTemplateOrThrow(id)`

要求：
- 校验在 scaffold/写库前完成；非法/不存在的模板 → 400，不创建目录/登记。
- 未提供时保存 `null`（读取时回退默认），或保存解析后的默认 ID；二选一，但行为要稳定、测试覆盖。
- INSERT 写入新列。
- `apps/scaffold` 不改模板渲染；模板只影响需求文档/设计项目。

### 1.3 初始化使用应用默认

- `requirements/doc.ts#ensureRequirementDoc(appId, templateId?)`：
  - 显式 `templateId` 优先（预览/测试用）；
  - 否则 `apps.requirement_template_id`（存在且 stage=requirements）；
  - 否则 `defaultRequirementTemplate()`；
  - 无效/已删除 → 回退默认（可 warning/事件，不阻塞）。
  - 已存在文档时保持现有 `doc.template_id` 逻辑，不用应用默认覆盖。
- `design/service.ts#ensureDesignProject(appId)`：
  - 新建项目时 `apps.prototype_template_id` 优先，否则 `defaultPrototypeTemplate()`；
  - 无效/已删除 → 回退默认；
  - 已存在项目保持 `app_design_projects.prototype_template_id`。

### 1.4 切换模板同步应用默认

- `requirements/doc.ts#switchDocTemplate` 成功后更新 `apps.requirement_template_id = template.id`。
- `design/service.ts#switchProtoTemplate` 成功后更新 `apps.prototype_template_id = template.id`（与设计项目模板一致）。
- 不改变现有“切换后设计回到草稿/需求生成 template-change 版本”的语义。

### 1.5 模板解析（给 #8 用）

新增只读端点（建议 `GET /api/apps/:id/templates`，或挂在现有 app payload；实现二选一，但要有稳定契约）：

```ts
{
  requirement: { id, name },
  prototype: { id, name },
  prototypeSource: 'design-project' | 'app-default' | 'global-default'
}
```

解析顺序：
1. 设计项目存在 → `app_design_projects.prototype_template_id`；
2. 否则 `apps.prototype_template_id`；
3. 否则全局默认。
需求模板：应用默认（有效）→ 全局默认；若已有文档，返回文档当前模板（建议以文档为准，避免与编辑中的文档不一致）。

- **只读，不创建设计项目/需求文档**。
- 供 #8 需求阶段预览直接使用。

### 1.6 应用 payload

`apps/payload.ts` 返回（便于前端展示/后续预览）：

- `requirementTemplateId/Name`（解析后有效值）
- `prototypeTemplateId/Name`
- 可选 `prototypeTemplateSource`

模板删除/损坏时返回 fallback 默认 + 不抛 500。

## 2. 前端 NewAppDialog

- 打开弹窗时加载：
  - `listTemplates({ stage: 'requirements' })`
  - `listPrototypeTemplates()`
- 新增两个下拉：
  - **需求模板**：默认选中 `builtin-prd`（不存在则列表第一项），显示名称/分类/描述；只允许 requirements 阶段模板。
  - **设计原型模板**：默认选中 `builtin-prototype-enterprise`（不存在则列表第一项），显示名称/分类/描述。
- 提示文案：
  `设计原型模板也会用于需求阶段的粗略原型预览；之后在设计阶段切换模板，需求预览会同步更新。`
- 创建请求带上 `requirementTemplateId/prototypeTemplateId`。
- 加载失败：不阻塞创建；使用默认/空选择并在表单内提示“模板列表加载失败，将使用默认模板”。
- 创建中禁用；创建成功清空/关闭逻辑不变。
- `CreateAppInput`/`AppInfo` 类型补字段；首页应用卡片如需显示模板名可后续做（本批至少创建弹窗 + 类型）。

## 3. 测试

### 3.1 后端

新增/扩展测试覆盖：
1. 创建应用带两个模板 → `apps` 两列写入；payload 返回解析后的 id/name。
2. 未带模板 → null/默认；需求文档初始化用默认；设计项目用默认。
3. 带自定义/非默认内置模板（如 `builtin-prd-lite` + `builtin-prototype-minimal`）→ 需求文档 `template.id` 正确；`ensureDesignProject` 模板正确。
4. 非法 id / QA 模板（stage=test）→ 400 且不创建目录/登记。
5. 切换需求模板 → `apps.requirement_template_id` 同步；切换原型模板 → `apps.prototype_template_id` 同步。
6. 解析端点：无设计项目 → app-default/global-default；有设计项目（模板不同于 app 默认）→ design-project 优先；不创建项目。
7. 模板被删除/无效时 fallback 默认，不 500（可 mock/删除私有模板）。
8. 回归全部后端测试（基线 150）。

### 3.2 前端/Playwright（临时应用）

- 创建应用弹窗显示两个下拉、默认选中、提示文案；切换模板后创建成功。
- 创建后 `GET /api/apps/:id` 返回所选模板；进入需求阶段，文档模板 badge/名称与所选需求模板一致。
- 进入设计（可 API 预置需求确认）后，设计项目模板与所选原型模板一致；解析端点 `prototypeSource=design-project`。
- 设计阶段切换原型模板后，解析端点/应用 payload 跟随新模板（需求预览后续使用）。
- 默认不选时使用默认模板。
- 1440/1024/768 弹窗不溢出、深色可读；0 console/page/API 错误。
- 真实 app1/data 不变；临时后端停止、端口释放。

## 4. 验证命令

```powershell
npm run build --prefix backend
npm test --prefix backend
npm test --prefix frontend
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm run check:vue --prefix frontend
```

- 后端基线 150；前端基线 96（按新增测试回传）。
- Playwright 临时目录：`C:\Users\icecream\AppData\Local\Temp\opencode\app-templates\`。

## 5. 边界

- 不实现 #8 预览；只保证模板解析可用。
- 不做每模块不同模板、不做模板内容复制、不做版本迁移。
- 不改需求/设计/交接包/Change Set 语义；不改真实 app1。
- 模板删除保护：现有“使用中模板不可删”逻辑保持；新增应用默认引用不阻塞删除模板（解析时 fallback）。

## 6. 文档

- 本交接单追加 `## 7. 实施结果`。
- `docs/STATUS.md` 新增 #7 小节 + 摘要表行；更新基线测试数。
- 不改 `AGENTS.md`（主会话评审后统一更新）。

## 7. 实施结果

实施日期：2026-11-13。状态：**已完成，待评审**。

### 7.1 文件

后端：
- 新增 `backend/src/apps/template-resolution.ts`：应用级默认模板解析（只读）——需求（已有文档 → 文档模板 → 应用默认 → 全局默认）、原型（设计项目 → 应用默认 → 全局默认）、`prototypeTemplateSource`、新项目默认模板、切换同步。
- `backend/src/db.ts`：`ensureColumn` 增加 `apps.requirement_template_id` / `apps.prototype_template_id`（不建表、不迁移）。
- `backend/src/apps/routes.ts`：`POST /api/apps` 接受可选 `requirementTemplateId` / `prototypeTemplateId`，scaffold/写库前校验（需求阶段模板 + 原型模板存在，非法/QA/不存在统一 400），INSERT 写入两列；新增只读 `GET /api/apps/:id/templates`。
- `backend/src/apps/payload.ts`：`AppRow` 两列；payload 增加 `requirementTemplateId/Name`、`prototypeTemplateId/Name`、`prototypeTemplateSource`（模板删除/损坏回退默认，不抛 500）。
- `backend/src/requirements/doc.ts`：新建文档模板 = 显式 `templateId` > `apps.requirement_template_id`（有效）> 默认；已有文档保持 `doc.template_id`；`switchDocTemplate` 成功后同步应用默认。`previewBaseline` 新建基线同规则（见偏差）。
- `backend/src/design/service.ts`：`ensureDesignProject` 新建项目用应用默认（无效回退默认），已有项目保持；`switchProtoTemplate` 成功后同步应用默认；原有“切换回草稿/产 template-change 版本”语义不变。
- 新增 `backend/src/apps/templates.test.ts`（7 项）；`backend/package.json` test 脚本加入该文件。
- 测试隔离：`backend/src/requirements/doc.test.ts`、`backend/src/design/service.test.ts` 的 fresh 辅助重置两个新列（切换模板现在会同步应用默认，避免用例间耦合；非产品行为变更）。

前端：
- `frontend/src/workbench/api.ts`：`AppInfo` 增加解析后的模板 id/name/source；`CreateAppInput` 增加两个可选模板 ID。
- `frontend/src/workbench/NewAppDialog.vue`：打开弹窗并行加载需求阶段模板 + 原型模板；两个下拉默认 `builtin-prd` / `builtin-prototype-enterprise`（不存在取列表第一项）、显示名称/分类/描述；提示“设计原型模板也会用于需求阶段的粗略原型预览……同步更新”；加载失败提示“模板列表加载失败，将使用默认模板”且不阻塞创建；创建请求带所选 ID；请求 token 防止关闭/重开竞态；下拉沿用 `--rg-*` token，1024/768 单列堆叠。

### 7.2 命令与结果

```powershell
npm run build --prefix backend        # 通过
npm test --prefix backend             # 157/157（基线 150，+7）
npm test --prefix frontend            # 96/96（未新增前端单测）
npm run typecheck --prefix frontend   # 通过
npm run build --prefix frontend       # 通过
npm run check:vue --prefix frontend   # 通过
```

临时环境 Playwright（`C:\Users\icecream\AppData\Local\Temp\opencode\app-templates\`，端口 3464/4799，`OPENCODE_AUTO_START=false`，未调用模型）：
- `e2e.cjs`：弹窗 2 个下拉/默认选中/提示文案/描述；非默认内置模板（`builtin-prd-lite` + `builtin-prototype-minimal`）UI 创建 → `GET /apps/:id` 两个模板正确；需求文档 badge=精简 PRD；API 确认需求后设计项目模板=简洁后台、解析 `prototypeSource=design-project`；`PUT /design/template` 切到企业级后设计 header、解析端点、应用 payload 全部跟随；默认选中创建 → 默认模板（`prototypeSource=app-default`）；API 创建未带模板 → `global-default`，解析端点不创建文档/项目；弹窗 1440/1024/768 + 浅/深无溢出、无纯白背景；**10 张截图，0 console/page/API 错误、0 横向溢出、0 深色纯白背景**。
- `e2e-failure.cjs`：路由 mock 两个模板列表 500 → 表单内提示“模板列表加载失败，将使用默认模板”、下拉为空（请求不含模板 ID）、创建成功且后端回退默认；0 非预期 console / 0 page error（仅 Chromium 对 mock 500 的 resource 日志）。
- 临时后端已停止，3464/4799 已释放；真实工作台 3300 仍在运行（`/api/health` 200），`projects/app1` 未修改（LastWriteTime 2026-11-12 16:48:37，早于本会话）。

### 7.3 与交接单的澄清/偏差

- **未提供模板时存 `null`**（交接单允许“null 或解析默认 ID”二选一）：API 创建 → 解析 `global-default`；UI 创建时下拉预选内置默认并随请求提交 → 解析 `app-default`。两种来源均被测试覆盖。
- **`previewBaseline` 也使用应用默认**：交接单只要求 `ensureRequirementDoc`；新建文档的 AI 预览若仍用全局默认，会与随后真正创建的文档模板不一致，故同步（不写库，无新语义）。
- 解析端点直接返回 `{ requirement, prototype, prototypeSource }`（不包 `{templates}`），与交接单契约一致。
- 模板被删除（应用默认引用不阻塞删除）→ payload/解析回退默认，不 500；后端单测用私有模板删除验证，Playwright 未走 UI 删除流程。
- 未改 `apps/scaffold` 模板渲染、需求/设计/交接包/Change Set 语义；未实现 #8 预览与 #6 模块化。

### 7.4 未验证 / 已知限制

- 真实 `app1` 旧行两列为 null，未在真实工作台打开/切换模板验证（仅临时目录 + 单测覆盖 `global-default`）；未对真实数据做任何写操作。
- 未调用真实模型；私有模板删除后的回退只在单测/解析层验证，未在模板中心 UI 走完整删除流程。
- 未验证多标签页并发切换模板时的最后写入者语义（当前为最后一次成功切换覆盖应用默认）。
