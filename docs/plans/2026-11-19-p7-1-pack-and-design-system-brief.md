# P7-1 实施单：设计模板包 + 设计系统解析（2026-11-19）

> 上游：`2026-11-19-design-template-and-dev-linkage-p7-design.md`。
> 本轮只做 **P7-1**：内置设计模板包、pack loader、只读 API、应用级设计系统解析与创建/更新支持。
> **不做**：模板中心 UI（P7-3）、全量预览（P7-3）、MF remote 脚手架（P7-5）、蓝图分发/skill（P7-5）、自定义 builder（P7-7）。
> 不改：`backend/src/requirements/**`、`TemplateLibraryDialog.vue`、需求模板表/逻辑；不做 git；不启停真实 3300；不读写真实 `data/`/`projects/`/`.env`。

---

## 0. 出口标准

1. `templates/design-system/afcenter-app-templates-v1/` 存在：
   - `pack.json`（4 应用类型、4 风格、25 页面、页面元数据/组件/配方/defaultStyle）；
   - `application-types/<type>/structure.css` + `pages/*.vue`；
   - `styles/shared.css` + 4 套 `styles/<style>/style.css`；
   - `operations-management/assets/ledger-workflow.svg`（页面依赖）。
2. 后端新增 pack loader 与只读 API：
   - `GET /api/design-system`：返回 4 个应用类型摘要 + 4 个风格（或一个 pack 的完整数据）；
   - `GET /api/design-system/:packId`：返回完整 pack（页面/风格/配方/组件映射）；
   - `GET /api/apps/:id/design-system`：返回应用级解析结果（pack/applicationType/style/页面库），旧应用回退 legacy。
3. 新建/更新应用支持设计系统字段并落 `app_settings`：
   - `design.pack`、`design.applicationType`、`design.style`；
   - 校验 pack/应用类型/风格存在；
   - **不改表**；旧 `apps.prototype_template_id` 仍可用。
4. 全部现有测试保持通过；新增 pack loader/API/应用解析测试。
5. 不引入 `prototype_templates` 的 4 条内置 seed（内置 pack 直接从文件读，避免污染旧列表）。

---

## 1. 资产复制

来源：

- `C:\Users\icecream\Desktop\ai优化建议\appTemplateDemo\appTemplateDemo\src\views\application-page-templates\application-types\`
- 同目录 `styles\`
- 元数据：`C:\Users\icecream\Desktop\ai优化建议\appTemplateDemo\appTemplateDemo\src\views\ai-template-demo\application-template-config.js`

目标：

```text
templates/design-system/afcenter-app-templates-v1/
  pack.json
  application-types/
    enterprise-application-platform/{structure.css,pages/*.vue}
    operations-management/{structure.css,assets/ledger-workflow.svg,pages/*.vue}
    data-governance-workbench/{structure.css,pages/*.vue}
    incident-response-console/{structure.css,pages/*.vue}
  styles/
    shared.css
    platform-blue/style.css
    classic-warm/style.css
    data-cyan/style.css
    high-contrast-tool/style.css
```

`pack.json` 要点：

- `schemaVersion: 1`、`id: afcenter-app-templates-v1`、`version: 1.0.0`；
- `applicationTypes[]`：id/name/category/description/structure/defaultStyle/pages[]；
- `pages[]`：id/name/type/recipe/preview/description/blueprint/components/blocks；
  - `type/recipe` 用 demo 的形态（list/tree-list/form/dashboard/detail 等）；
  - `blueprint` 为 pack 相对路径（如 `application-types/enterprise-application-platform/pages/OrganizationUsers.vue`）；
  - `components` 从页面实际 `<pm-*>` 标签扫描生成；
- `styles[]`：id/name/className/css/description/signature/tokens（主色/强调色/背景/圆角/密度）；
- `defaultApplicationType`、`defaultStyle`；
- `skills: ["afcenter-page-generation","pm-components-usage"]`；
- `pageRecipes`、`componentMap`、`conformance` 按设计稿第 3.2 节填写。

校验：

- 所有 `blueprint/structure/css/assets` 路径必须存在且位于 pack 内；
- 页面 id 在应用类型内唯一；应用类型/风格 id 全局唯一；
- 4 应用类型页面数为 5/8/8/4（企业/运营/数据/工具）。

---

## 2. 后端实现

### 2.1 pack loader

新增 `backend/src/design/pack.ts`：

- 根目录：`templates/design-system`（仓库，内置）；自定义根：`path.join(config.dataDir, 'design-system')`（后续用，本期至少读路径安全）。
- `listPacks()`：扫描内置根下的 `pack.json`，返回摘要（id/name/version/applicationTypes/styles）。
- `getPack(packId)`：读取/校验/缓存；路径安全（禁止 `..`、绝对路径、越界）。
- `getApplicationType(pack, id)`、`getStyle(pack, id)`、`getPage(pack, type, id)`。
- 错误：统一 `DesignError` 或本地错误，API 映射 400/404。
- 不要修改 `prototype_templates` 的表结构或内置 enterprise/minimal。

### 2.2 API

在 `backend/src/templates/routes.ts` 或新 `backend/src/design/system-routes.ts`：

- `GET /api/design-system` → `{ packs: [...] }`（摘要）或默认 pack 完整数据；建议返回 `{ packs: [{ id,name,version,defaultApplicationType,applicationTypes:[...],styles:[...] }] }`。
- `GET /api/design-system/:packId` → 完整 pack。
- `GET /api/apps/:id/design-system`（放在 apps routes 或 system routes）：
  - 读取应用 `app_settings` 的 `design.pack/applicationType/style`；
  - 缺省：默认 pack + `defaultApplicationType` + `defaultStyle`；
  - 旧应用无设计系统：返回 `{ legacy: true, prototypeTemplateId, prototypeTemplateName }`；
  - 返回 `{ pack, applicationType, style, pages, skills, resolved: {...} }`。
- 错误处理：pack/应用类型/风格不存在 → 404/400，带清晰中文。

### 2.3 应用创建/更新

- `POST /api/apps` 支持 `designPack`/`designApplicationType`/`designStyle`（或 `designSystem: {pack, applicationType, style}`）；未传用默认。
- `PATCH /api/apps/:id/design-system`（新）更新 `app_settings`，校验后写入。
- `apps` payload 增加 `designSystem`（pack/applicationType/style/pages? 摘要即可）与 `legacyPrototypeTemplate`（旧应用）。
- 不改 `apps` 表结构；`prototype_template_id` 继续用于旧应用。
- 新建应用时不要把内置 pack 写入 `prototype_templates`。

### 2.4 测试

- `backend/src/design/pack.test.ts`：
  - 4 应用类型/4 风格/25 页面；页面数 5/8/8/4；
  - blueprint/structure/css 路径存在；
  - 越界路径/重复 id/缺字段报错；
  - 自定义根路径不越界。
- `backend/src/apps/templates.test.ts` 或新测试：
  - `GET /api/design-system`、`GET /api/design-system/:id`；
  - `GET /api/apps/:id/design-system` 默认/自定义/旧应用；
  - `POST /api/apps` 带设计系统；`PATCH /api/apps/:id/design-system`；
  - 非法 pack/应用类型/风格 → 4xx；
  - 需求模板相关测试保持通过。

---

## 3. 前端（仅类型/API，不做 UI）

- 在 `frontend/src/shared/template-api.ts` 或新 `frontend/src/shared/design-system-api.ts` 增加类型与函数：
  - `DesignSystemPack`、`DesignApplicationType`、`DesignStyle`、`DesignPageMeta`、`AppDesignSystem`；
  - `listDesignPacks()`、`getDesignPack(id)`、`getAppDesignSystem(appId)`、`updateAppDesignSystem(appId, payload)`。
- 不改 `NewAppDialog`/`DesignView`/`TemplateLibraryDialog`（P7-3 做）。
- 现有前端测试保持 59/59；如需可加纯函数测试（可选）。

---

## 4. 验证

| 命令 | 要求 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | 现有 88+ 新增通过 |
| `npm run build --prefix frontend` | 通过（含 preview 入口） |
| `npm test --prefix frontend` | 59/59 |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace` | 通过（临时目录/端口） |

如新增 API 测试需要临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`，使用临时目录；不要读写真实 `data/`/`projects/`。

---

## 5. 收尾

- 更新 `docs/plans/2026-11-19-design-template-and-dev-linkage-p7-design.md` 的 P7-1 实施记录（结果/偏差/未验证）。
- 更新 `docs/STATUS.md` 的 P7 状态（只写 P7-1 完成，不宣称 P7 全部完成）。
- 回报：复制资产清单/数量、pack 校验结果、API 路由、应用字段、测试命令与结果、偏差、未验证项、环境确认（未动真实 3300/未 git/未调模型）。
