# P7 设计：设计模板中心 + 设计 → 开发强关联（2026-11-19）

> 状态：**P7-1～P7-6c + P7-4b 已实施（待评审）**，P7-6b 首跑部分通过、2026-11-20 复跑通过（第 22—24 节）；P7-4b 记录见第 25 节；**P8-1（彻底移除旧版设计模板，DB 5 表→4 表）已实施（待评审）**，记录见第 26 节；**P7-7 已实施（见 `2026-11-21-p7-7-custom-design-template-agent-design.md`，含 P7-7c-2 真实模型闭环）**。上游：`2026-11-18-agent-first-workbench-design.md` v3、`2026-11-18-agent-first-workbench-p6-design.md`、P6-1～P6-4 交接单，以及 2026-11-19 关于设计模板/开发还原度的评审结论。
> 本轮只讨论设计模板与设计→开发关联；**需求模板中心保持不变**。
> 不做：需求模板改动、DB 表结构迁移、真实 3300 启停、真实模型调用（除验收阶段经用户授权）、git 操作、EOS 运行态、真实 401/403、移动端。

---

## 0. 已确认的决策

| # | 决策 |
| --- | --- |
| 1 | **需求模板中心完全保留**：`requirement_templates`、`TemplateLibraryDialog`、`adw-template-req-*`、模块 frontmatter `template` 均不改 |
| 2 | 设计模板改为 **应用类型 × 视觉风格 + 页面库**，应用级选择；模块从页面库认领页面 |
| 3 | 设计模板采用 **pack 文件 + DB 索引**：内置 pack 在仓库，自定义 pack 在 `data/design-system/`；**不改表**；视觉风格存 `app_settings` |
| 4 | 直接从 `primeton-form-components-v3` **复制需要的代码**到工作台前端；不做 vendoring/同步/独立预览应用；同步问题后议 |
| 5 | 预览放在工作台同一构建的 `preview.html`，iframe 嵌入；**不单独部署预览应用** |
| 6 | 生成物是 **独立微前端 remote**（类似 `appTemplateDemo`），不是 AFCenter 页面目录 |
| 7 | 开发允许 **复制/适配蓝图 Vue 页面**；必须使用模板组件/样式/偏好 |
| 8 | 开发首轮先输出 `ui-check.md` 页面对照表（软门禁，不阻断） |
| 9 | PNG 定位为 **线框草图**；真实视觉以蓝图 + 预览页为准 |
| 10 | 先做现有 4 套应用类型；自定义模板后续做，本期预留 builder/pack 能力 |

---

## 1. 现状与差距

### 1.1 现状（与本次相关的部分）

| 层 | 现状 | 代码位置 |
| --- | --- | --- |
| 设计模板 | `prototype_templates`：tokens/shell/patterns/pageSetRules，2 个内置（enterprise/minimal） | `backend/src/design/builtin-templates.ts`、`templates.ts` |
| 模板 API | `GET/POST/PUT/DELETE /api/prototype-templates` | `backend/src/templates/routes.ts` |
| 应用选择 | `apps.prototype_template_id`；新建应用下拉选原型模板 | `backend/src/apps/routes.ts`、`NewAppDialog.vue` |
| 设计产物 | `design.json` 页面只有 id/name/type/entity/columns/actions | `templates/agent/skills/adw-design-artifacts/references/design.schema.json` |
| 原型渲染 | 通用线框；adapter 只映射 columns/actions；PNG 只截 paper；mock 随机 | `frontend/src/design/*` |
| 开发提示 | PNG 被称为“风格”；无偏离说明/对照表/截图要求 | `backend/src/chat/service.ts`、`backend/src/dev/service.ts` |
| 开发视图 | 不传 module；无原型预览/一致性命令 | `frontend/src/dev/DevView.vue`、`view-commands.js` |
| 前端脚手架 | 只有 EOS 后端；前端“按需创建” | `backend/src/apps/scaffold.ts`、`templates/eos-app` |
| 验收 | 只断言路径字符串；人工截图比对未做 | `backend/scripts/p4-e2e.ts`、`docs/STATUS.md` |
| 需求模板 | 独立中心，4 个内置 + 我的；本次不动 | `TemplateLibraryDialog.vue`、`requirements/*` |

### 1.2 根因（结论）

1. 设计产物不是单一事实源：`design.json` 稀疏、`design-brief.md` 自由文本、PNG 是工作台对 design.json 的渲染，三者不同源。
2. 定义页面的能力不足：schema 没有布局/表单形态/筛选/区域；adapter 只映射列/动作。
3. 开发没有可执行的页面设计：没有模板蓝图、组件规范、页面库；提示词把页面设计降级为“风格”。
4. 开发没有强制对照动作；验收测“读过”而不是“还原”。
5. 前端运行时缺失：生成物没有 Element Plus/`pm-*`/PageTemplates/GlobalPreference，开发只能手写 UI。

P7 的解法不是“再写狠一点 prompt”，而是：**设计模板 = 可预览的页面库 + 可复制的蓝图；设计契约 = 结构化页面契约；开发 = 从蓝图施工 + 一致性验收。**

---

## 2. 目标架构

```
需求模板中心（不动）
  requirement_templates + adw-template-req-* + TemplateLibraryDialog

设计模板中心（新）
  pack 文件（应用类型/风格/页面库/蓝图）
  + DB 索引（prototype_templates）
  + 应用选择（app_settings 存风格）
  + 工作台内预览 preview.html（pm-v3 + 模板页面 + mock）

设计阶段
  design-system.json（应用级：pack/应用类型/风格/页面库）
  design.json（模块级：页面契约 + catalogRef/blueprint）
  design-brief.md / tokens.json / prototypes/*.png（草图）

开发阶段
  独立 MF remote（webpack + Module Federation）
  + 从蓝图复制页面 + PageTemplates + pm-* + GlobalPreference
  + ui-check.md 对照表 + 截图比对 + check-consistency
```

### 2.1 边界

| 项 | 需求模板中心 | 设计模板中心 |
| --- | --- | --- |
| 表 | `requirement_templates`（不改） | `prototype_templates` 仅作索引（不改结构） |
| 内容 | 章节结构 + 提示词 | 应用类型 + 风格 + 页面库 + 蓝图 |
| Skill | `adw-requirements-document` / `adw-template-req-*` | `adw-design-artifacts` / `adw-template-proto-*` |
| 选择 | 新建应用选需求模板；模块 frontmatter | 新建应用选设计模板；模块认领页面 |
| UI | `TemplateLibraryDialog` 保持 | 新增设计模板中心；旧原型模板保留 legacy |

---

## 3. 设计模板包（pack）

### 3.1 目录

```text
templates/design-system/afcenter-app-templates-v1/     # 内置（仓库，只读）
  pack.json
  application-types/
    enterprise-application-platform/
      structure.css
      pages/PlatformOverview.vue ... OrganizationUsers.vue ...
    operations-management/
    data-governance-workbench/
    incident-response-console/
  styles/
    shared.css
    platform-blue/style.css
    classic-warm/style.css
    data-cyan/style.css
    high-contrast-tool/style.css
  page-templates/            # 团队 PageTemplates（可选副本）
  skills/
    afcenter-page-generation/
    pm-components-usage/

data/design-system/<custom-id>/                        # 自定义（运行时）
  pack.json
  pages/...
  styles/...
  _manifest.json
```

### 3.2 `pack.json` 契约

```jsonc
{
  "schemaVersion": 1,
  "id": "afcenter-app-templates-v1",
  "name": "AFCenter 应用页面模板",
  "version": "1.0.0",
  "defaultApplicationType": "enterprise-application-platform",
  "defaultStyle": "platform-blue",
  "applicationTypes": [
    {
      "id": "enterprise-application-platform",
      "name": "企业级应用管理平台",
      "category": "platform",
      "description": "面向应用、组织、用户、权限、审计和平台运行概览的企业管理页面集合。",
      "structure": "application-types/enterprise-application-platform/structure.css",
      "defaultStyle": "platform-blue",
      "pages": [
        {
          "id": "organization",
          "name": "组织与用户",
          "type": "tree-list",
          "recipe": "tree-list",
          "preview": "tree",
          "description": "维护组织机构、账号、岗位与角色关联。",
          "blueprint": "application-types/enterprise-application-platform/pages/OrganizationUsers.vue",
          "components": ["pm-input", "pm-select", "pm-tree", "pm-table", "pm-form-dialog"],
          "blocks": 7
        }
      ]
    }
  ],
  "styles": [
    {
      "id": "platform-blue",
      "name": "平台蓝白",
      "className": "visual-style-platform-blue",
      "css": "styles/platform-blue/style.css",
      "description": "明亮蓝白、留白适中、圆角卡片、平台层级清楚。",
      "signature": "#1f5eff",
      "tokens": {
        "primary": "#1f5eff",
        "accent": "#22a6b3",
        "neutral": "#64748b",
        "background": "#f4f7fb",
        "radius": 10,
        "density": "compact"
      }
    }
  ],
  "skills": ["afcenter-page-generation", "pm-components-usage"],
  "componentMap": {
    "string": "pm-input",
    "text": "pm-textarea",
    "number": "pm-number",
    "decimal": "pm-number",
    "boolean": "pm-switch",
    "date": "pm-datepicker",
    "datetime": "pm-datepicker",
    "enum": "pm-select",
    "ref": "pm-select-entity",
    "ref:user": "pm-select-user",
    "ref:org": "pm-select-org",
    "ref:position": "pm-select-position",
    "ref:tree": "pm-select-tree",
    "upload": "pm-upload"
  },
  "pageRecipes": {
    "list": ["BusinessListPage", "QueryPanel", "RowActions", "ThreePartPagination"],
    "tree-list": ["TreeListPage", "TreePanel", "QueryPanel", "RowActions"],
    "dialog-form": ["pm-form-dialog", "FormSection"],
    "page-form": ["StandardFormPage", "FormSection"],
    "main-sub": ["StandardFormPage", "FormSection", "el-tabs"],
    "detail": ["detail sections", "related lists"],
    "dashboard": ["metric cards", "pm-echarts"],
    "wizard": ["pm-steps", "FormSection"]
  },
  "conformance": [
    "列表/树/表单优先使用 PageTemplates",
    "新增/编辑默认 pm-form-dialog",
    "所有 el-table 使用 v-auto-height",
    "业务字段 > 8 使用双列；多行文本 pt-field-full",
    "批量操作放 batch-actions；树节点菜单 MoreFilled",
    "统一导入 GlobalPreference；预设只在页面 computed 合并",
    "禁止自造一套表格/表单样式替代模板"
  ]
}
```

### 3.3 DB 索引与应用选择

**不改表。**

- 内置模板**不 seed 到 `prototype_templates`**：内置 pack 直接从 `templates/design-system/<pack-id>/pack.json` 读取，避免污染旧原型模板列表。
- `prototype_templates` 继续存在，只用于：
  - 旧 `builtin-prototype-enterprise/minimal`（legacy）；
  - 后续自定义模板（一条 DB 行 + `data/design-system/<id>/`）。
- 应用选择：`app_settings` 存 `design.pack`、`design.applicationType`、`design.style`；旧应用继续用 `apps.prototype_template_id`，新应用可留空。
- 解析入口：`GET /api/apps/:id/design-system` 返回 pack/应用类型/风格/页面库/skill 版本；pack 数据来自文件，应用选择来自 `app_settings`。
- `docs/design/design-system.json` 由 scaffold 生成（应用级只读摘要）。

### 3.4 自定义模板（本期只预留）

- **builder 型（后续 P7-7）**：`pack.json.pages[]` 为布局 JSON + 组件列表；预览用组件注册表实时渲染；保存时生成 Vue 源码。
- **pack 型（后续）**：复制内置 pack 到 `data/design-system/<id>/`，修改 `pages/*.vue`、`styles/*.css`；预览需构建，可标记“需构建后预览”。
- 生命周期：复制内置 → 插入 DB 行；删除前检查应用引用（409）；导出/导入 zip 后议。
- 不引入 `config_json`，元数据在 pack + DB 现有列。

---

## 4. 工作台内 pm-v3 与预览

### 4.1 直接复制

```text
frontend/src/design-system/pm-v3/
  components/        # 只复制 4 套模板用到的组件
  composables/       # useDispatchProxy / useDictDataSource / useEntityDataSource ...
  common/            # bus / dom
  utils/             # loadScript / sessionStore / treeList / url / util
  i18n/              # info
  pm-register.ts     # 注册子集
  mock/              # Controllers / dict / user / org / position / entity 静态数据
```

- 复制后直接改 `@/` 为相对路径（或统一 `@pm/`），不引入同步脚本/别名插件。
- 组件清单（按 4 套模板实际使用，约 38 个）：
  `pm-auto-number, pm-calendar, pm-card, pm-checkbox, pm-datepicker, pm-datepick-range, pm-dialog, pm-divider, pm-echarts, pm-fold, pm-fold-group, pm-form-dialog, pm-html, pm-image, pm-input, pm-lookup, pm-markdown, pm-number, pm-number-range, pm-pagination, pm-radio, pm-richtext, pm-search, pm-select, pm-select-org, pm-select-position, pm-select-tree, pm-select-user, pm-sheet, pm-split, pm-steps, pm-switch, pm-table, pm-textarea, pm-time-select, pm-toolbar, pm-toolbar-item, pm-tree, pm-upload`
- 共享依赖按需补：`echarts`、`sass`、`tinymce`/`@tinymce/tinymce-vue`、`luckyexcel`、`@vue-office/*`、`vxe-table`（若 pm-table 需要）等；先按第一批页面加，后续再补。
- 重组件动态 import；预览页懒加载。

### 4.2 平台数据 mock

- `app.config.globalProperties.Controllers` + `window.globalConfig.dispatchProxy` 返回静态数据；
- 覆盖 `dict/user/org/position/entity` 常见查询；
- 上传/图片/OCR 用本地占位；不连接真实平台；
- 统一在 `frontend/src/design-system/pm-v3/mock/`。

### 4.3 预览入口

```text
frontend/preview.html
frontend/src/preview/main.ts
frontend/src/preview/PreviewApp.vue
```

- Vite 多入口：`index.html` + `preview.html`，同一次 `vite build`，同一后端托管。
- 路由参数：`?type=<applicationType>&style=<styleId>&page=<pageId>`。
- 工作台 iframe 嵌入 `/preview.html?...`；`postMessage` 同步页面切换/高度。
- 后端静态托管需放行 `/preview.html`（现有 catch-all 只放 `index.html`）。
- 预览不依赖 AFCenter 宿主；生成物运行时仍由宿主提供 pm-*。

### 4.4 先做 spike

- 复制 `pm-input/pm-select/pm-table/pm-form-dialog` + 共享依赖；
- 用 `OrganizationUsers.vue` 一页验证：Vite 编译、Element Plus 样式、mock 表格/弹窗；
- 记录构建时间、chunk 大小、需要补的依赖、缺失 API；
- 通过后再扩到 25 页 × 4 风格。

---

## 5. 设计模板中心 UI

### 5.1 入口

- 首页新增「设计模板」入口（与现有「模板库」并列；「模板库」仍表示需求模板中心）。
- 新建应用里：保留「需求模板」下拉；「设计模板」改为选择应用类型 + 视觉风格（或打开设计模板中心）。

### 5.2 模板中心页面

- 分类：全部 / 平台管理 / 运营管理 / 数据分析 / 工具应用 / 我的模板。
- 卡片：应用类型名称、描述、页面数、组件数、缩略图。
- 详情：顶部视觉风格切换；页面集卡片（页面名/类型/描述/组件）；“进入页面”打开预览。
- 操作：“使用此模板”写入应用级设计系统；“复制为我的模板”（后续）。
- 旧原型模板放在「旧版」分组，避免与新模板混淆。

### 5.3 设计视图

- 顶部徽标：应用类型 + 视觉风格（替代单一原型模板名）。
- 侧栏/抽屉：模板页面库；显示 `catalogRef` 状态（未认领/已认领/已实现）。
- 当前模块页面：design.json 页面契约摘要；可打开预览。
- PNG 徽标/文案改为“线框草图”。

---

## 6. 页面契约

### 6.1 应用级 `docs/design/design-system.json`

```jsonc
{
  "schemaVersion": 1,
  "pack": "afcenter-app-templates-v1",
  "applicationType": "enterprise-application-platform",
  "style": "platform-blue",
  "skillVersion": "2026-11-19",
  "pages": [
    { "id": "organization", "name": "组织与用户", "recipe": "tree-list", "blueprint": "..." }
  ]
}
```

### 6.2 模块级 `design.json`

```jsonc
{
  "module": "MOD-001",
  "title": "组织与人员",
  "designSystem": {
    "pack": "afcenter-app-templates-v1",
    "applicationType": "enterprise-application-platform",
    "style": "platform-blue"
  },
  "entities": [],
  "relations": [],
  "pages": [
    {
      "id": "org-list",
      "name": "组织架构",
      "type": "list",
      "recipe": "tree-list",
      "catalogRef": "enterprise-application-platform/organization",
      "blueprint": "application-types/enterprise-application-platform/pages/OrganizationUsers.vue",
      "entity": "organization",
      "filters": ["机构名称", "机构编码", "上级机构"],
      "columns": ["机构名称", "机构编码", "上级机构", "机构负责人", "状态"],
      "rowActions": ["detail", "edit", "delete"],
      "toolbarActions": ["create", "batchAssignRole"],
      "selection": true,
      "pagination": { "layout": "three-part", "pageSize": 10 },
      "tree": {
        "titleField": "机构名称",
        "parentField": "上级机构",
        "actionStyle": "header",
        "selectionStyle": "dot"
      },
      "components": {
        "机构负责人": "pm-select-user",
        "上级机构": "pm-select-tree"
      }
    }
  ]
}
```

表单页：

```jsonc
{
  "id": "org-form",
  "type": "form",
  "recipe": "dialog-form",
  "form": {
    "presentation": "dialog",
    "columns": 2,
    "width": 800,
    "fields": ["机构编码", "机构名称", "上级机构", "机构负责人", "排序号", "状态", "备注"],
    "groups": [
      { "title": "基本信息", "fields": ["机构编码", "机构名称", "上级机构", "机构负责人"] }
    ]
  }
}
```

### 6.3 约束

- 所有新字段可选、向后兼容；旧 design.json 继续可读。
- `recipe` 来自 pack；`catalogRef/blueprint` 指向页面库；无引用时用通用 PageTemplates。
- `components` 由 pack 的 componentMap 推导；页面可覆盖。
- schema/validate 只出 warning；不阻断。
- PNG 仍是线框草图；真实视觉以蓝图/预览为准。

---

## 7. 设计 → 开发关联

### 7.1 工作区与脚手架

生成物是独立 MF remote：

```text
projects/<app>/
  frontend/
    package.json
    build/mfp.config.js       # name / filename / exposes / shared
    build/webpack.*.js
    setting.json
    src/main.js
    src/router/
    src/views/<module>/       # 从蓝图复制/适配
    src/components/PageTemplates/
    src/preferences/GlobalPreference.js
  backend/
  docs/requirements|design
```

- `shared: vue / element-plus`；`pm-*` 由 AFCenter 宿主全局提供。
- 模板来源：`templates/afc-remote/`（从 `appTemplateDemo` 抽取骨架），scaffold 复制到 `frontend/`。
- 页面来源：`docs/design/template/`（选中的应用类型页面蓝图副本）或模板 skill 的 assets；开发复制到 `src/views/`。
- 后端仍用 `templates/eos-app`。

### 7.2 开发流程（软门禁）

1. 读 `design-system.json`、`design.json`、`design-brief.md`、`tokens.json`、`prototypes/*.png`、`docs/design/template/` 蓝图。
2. 工作台生成 `docs/design/<MOD>/ui-check.md` 骨架；agent 第一轮填写“页面 → 路由 → 蓝图 → 字段/列 → 操作 → 布局/交互 → 差异”。
3. 未填写对照表就写代码：不阻断，但在会话摘要/验收中标记“流程未完成”。
4. 从蓝图复制页面到 `frontend/src/views/`，替换 mock/接口，保留结构/样式/组件。
5. 使用 PageTemplates + `pm-*` + GlobalPreference；遵守 conformance 清单。
6. 完成后启动页面截图，与蓝图/预览逐页对照，写差异说明。

### 7.3 提示词 / AGENTS / skill

- `buildViewPrompt('development')` 改为：
  - `design.json` 定数据模型/字段；
  - `design-system.json` + `design.json.layout/recipe` 定页面骨架/导航/区域/组件/交互；
  - `tokens` 定视觉变量；
  - `prototypes/*.png` 是线框草图；
  - 蓝图是视觉/结构基准；任何冲突先报告，偏离必须说明。
- 自动注入 design digest：模块、页面清单、recipe、实体/列/动作、layout 摘要、brief 摘要、tokens、blueprint 路径、PNG stale、skill 版本。
- 开发视图增加模块选择；单模块自动带上。
- 应用 `AGENTS.md` 增加设计系统、蓝图复制、conformance、ui-check、软门禁。
- 新增开发方法 skill：`adw-frontend-implementation`（对照表/冲突上报/截图比对/偏离说明）。
- `adw-template-proto-<id>` 改为设计模板 skill：pack/风格/页面库/蓝图路径/两个团队 skill 的相对引用。

### 7.4 一致性检查（只报告）

- 静态：PageTemplates 导入、`pm-form-dialog`、`v-auto-height`、`visual-style-*`、GlobalPreference、蓝图同源（diff 摘要）。
- 视觉：截图 vs 蓝图/预览；逐页差异清单。
- `check-consistency` 扩展：需求 / design.json / design-system / brief / 原型 / 蓝图 / 代码 / 截图。
- 开发视图只读展示 `ui-check.md` 状态与差异。

---

## 8. 改动清单

### 8.1 后端

| 文件/模块 | 改动 |
| --- | --- |
| `backend/src/design/pack.ts`（新） | 读/校验 pack；内置/自定义根；路径安全；缓存 |
| `backend/src/design/templates.ts` | 旧 legacy 与后续自定义行；内置 pack 不 seed，直接读文件 |
| `backend/src/templates/routes.ts` | 新增 `/api/design-system/*`；需求模板路由不动 |
| `backend/src/apps/routes.ts` | 创建/更新设计模板 + 风格；校验；payload 返回 |
| `backend/src/apps/payload.ts` | 增加 designTemplate/designStyle |
| `backend/src/apps/template-resolution.ts` | 解析 pack/应用类型/风格 |
| `backend/src/apps/scaffold.ts` | 写 design-system.json；复制蓝图；MF frontend；模板 skill |
| `backend/src/templates/distribution.ts` | `adw-template-proto-*` 从 pack 生成；分发两个团队 skill；expectedSkillIds |
| `backend/src/chat/service.ts` | 设计/开发 prompt；digest；blueprint；软门禁；module |
| `backend/src/dev/service.ts` | 开发首条提示同步 |
| `backend/src/workspace/artifacts.ts` | designSystem/页面库摘要 |
| `backend/src/design/prototypes.ts` | tokens 增加 pack/style；PNG 仍草图 |
| `backend/src/index.ts` | 放行 `/preview.html` 静态 |
| DB | 不改表；内置不 seed；`app_settings` 存 pack/应用类型/风格 |

### 8.2 前端

| 文件/模块 | 改动 |
| --- | --- |
| `frontend/src/shared/template-api.ts` | 新设计系统类型/API；需求模板函数不动 |
| `frontend/src/workbench/DesignTemplateCenter.vue`（新） | 模板中心/风格切换/页面集/预览 |
| `frontend/src/workbench/DesignTemplatePicker.vue`（新） | 新建应用/设计视图复用 |
| `frontend/src/workbench/NewAppDialog.vue` | 需求模板不动；设计模板改应用类型 + 风格 |
| `frontend/src/workbench/HomeShell.vue` | 新增「设计模板」入口；「模板库」仍需求模板 |
| `frontend/src/workbench/DesignView.vue` | 新模板徽标/页面库/蓝图/预览入口；旧模板回退 |
| `frontend/src/workbench/api.ts` | app payload design 字段 |
| `frontend/src/preview/*`（新） | `preview.html` 入口、mock、预览应用 |
| `frontend/src/design-system/pm-v3/*`（新） | 直接复制的 pm 组件/依赖/mock |
| `frontend/vite.config.ts` | 多入口；alias/路径；按需 chunk |
| `frontend/src/design/design-adapter.js` | 映射 recipe/filters/form/tree/components |
| `frontend/src/design/PrototypeCanvas.vue` 等 | 线框草图文案；必要的 layout 支持 |

### 8.3 资产与文档

| 位置 | 改动 |
| --- | --- |
| `templates/design-system/afcenter-app-templates-v1/`（新） | pack + 4 应用类型 + 4 风格 + 25 页 |
| `templates/afc-remote/`（新） | MF remote 脚手架种子 |
| `templates/agent/skills/afcenter-page-generation` | 复制团队 skill |
| `templates/agent/skills/pm-components-usage` | 复制团队 skill |
| `templates/agent/skills/adw-frontend-implementation`（新） | 开发对照/验收方法 skill |
| `templates/agent/skills/adw-design-artifacts` | 页面契约、蓝图、冲突说明 |
| `templates/eos-app` | 不改后端；README 指向 frontend |
| `docs/plans/*`、`docs/STATUS.md` | 实施后更新 |

---

## 9. 兼容与迁移

- **需求模板**：零改动；`requirement_templates`/`adw-template-req-*`/`TemplateLibraryDialog` 保持，回归必须绿。
- **旧设计**：旧 `prototype_templates`（enterprise/minimal）保留；旧应用 `prototype_template_id` 继续解析；旧 `design.json` 无新字段时走现有渲染。
- **新设计**：应用级 pack + 风格；旧应用不自动切换；需要时用户在设计视图改选。
- **DB**：无 ALTER；内置不 seed；自定义 pack 在 `data/`，随 `data/` 备份。
- **回退**：代码回退 + `data/`/`projects/` 备份；pack 文件在 git 历史；不做自动迁移。
- **大小写/ID**：pack id 仅 `[a-z0-9-]`；自定义 id `custom-<uuid>`；路径安全校验。

---

## 10. 测试与验收

### 10.1 回归基线

- 后端 88/88、前端 59/59；
- `typecheck`/`build`/`check:vue`；
- `smoke:workspace/assets/dev`；
- `e2e:p2/p3/p4` = 116/126/97；
- 现有需求模板测试全部保留。

### 10.2 新增测试

- 后端：pack 解析/路径安全/模板解析/应用创建/风格解析/skill 生成/prompt digest/ui-check 生成。
- 前端：模板中心/选择/页面库/预览入口/组件注册/design adapter/schema。
- e2e：设计模板选择 → 页面库 → 预览 iframe；旧需求模板中心回归。
- 构建：`vite build` 多入口；`preview.html` 可访问；bundle 体积记录。
- 真实模型（临时实例，用户授权）：选模板 → 设计 → 开发 → 截图对照；断言使用 PageTemplates/pm-*/GlobalPreference；差异有说明。

### 10.3 验收场景

1. 新建应用：选需求模板（原样）+ 设计模板（应用类型 + 风格）；工作区有 design-system.json、模板 skill、蓝图副本、MF frontend。
2. 模板中心：4 应用类型 × 4 风格可浏览；切换风格页面即时变化；页面集可进入预览。
3. 设计：页面契约含 recipe/blueprint/filters/form/tree/components；PNG 是草图；冲突有提示。
4. 开发：首轮输出 ui-check；从蓝图复制；使用 pm-*；完成后截图对照；差异记录。
5. 兼容：app1/app2 旧模板可继续打开；需求模板中心功能不变。

### 10.4 未验证/明确不做

- 真实 AFCenter 宿主联调、EOS 运行态、真实 401/403、移动端 `<768`；
- 自定义 builder（P7-7）；
- 所有重组件的像素级预览（按需扩展）。

---

## 11. 实施拆分

| 阶段 | 范围 | 出口 |
| --- | --- | --- |
| **P7-1 模板包与索引** | pack 目录/契约；4 应用类型 + 4 风格；25 页资产；design-system.json；`/api/design-system`（内置不 seed） | 模板数据可读；旧应用不受影响；需求模板回归绿 |
| **P7-2 pm-v3 复制 + 预览 spike** | 复制组件/依赖；mock；`preview.html`；一页 OrganizationUsers | 工作台内真实渲染一页；记录依赖/体积/耗时 |
| **P7-3 模板中心 + 全量预览** | 模板中心 UI；风格切换；25 页；iframe；新建应用选择 | 像 demo 一样浏览/切换/预览 |
| **P7-4 页面契约** | design.json 扩展；adapter/renderer；schema/validate；设计 skill；冲突说明 | 设计产出可施工契约；PNG 草图 |
| **P7-5 开发强关联** | MF remote 脚手架；蓝图复制；PageTemplates/pm-*/GlobalPreference；dev skill；digest/module；ui-check 软门禁 | 新应用开发从蓝图起步并使用模板组件 |
| **P7-6 一致性验收** | 静态检查；截图对照；check-consistency；报告/STATUS；真实模型 E2E | 一轮“模板→设计→开发→对照”通过 |
| **P7-7 自定义模板** | builder/pack 复制/保存/生成 Vue | 4 套稳定后启动 |

P7-1 与 P7-2 可并行；P7-3 依赖两者；P7-4 可与 P7-3 并行；P7-5 依赖 P7-4 与 MF 种子。

---

## 12. 风险与对策

| 风险 | 对策 |
| --- | --- |
| Vite 编译 pm-v3 不兼容 | 先 spike；直接改 import/require；必要时仅复制子集；退路是 webpack 预构建产物 |
| 重依赖导致工作台包体/构建变大 | 预览入口懒加载；只复制用到的组件；记录 chunk；按页补依赖 |
| 平台 API 缺失（dict/user/org/upload） | mock Controllers/dispatchProxy；占位；明确“预览非联调” |
| Element Plus/模板全局样式冲突 | `preview.html` + iframe 隔离 |
| 蓝图与需求冲突 | 设计阶段必须写冲突决策；开发先报告；不静默 |
| pack 与 DB 双源 | 明确优先级：内置 pack 只读、DB 只索引；自定义 pack 以文件为准 |
| 旧应用兼容 | legacy 模板/旧 design.json 回退；不自动切换 |
| 模型仍偏离 | 蓝图 + 契约 + ui-check + 截图验收；prompt 只是一层 |
| 无同步机制导致 v3 更新漂移 | 本期接受；后续再议同步/升级 |

---

## 13. 实施前确认

已确认（2026-11-19 讨论）：

1. **MF remote 种子**：直接以 `appTemplateDemo` 的 `build/`、`setting.json`、`src/main.js`、`src/router/` 为蓝本。
2. **预览形态**：`preview.html` 作为同一 Vite 构建的第二入口 + iframe，是本期最终形态。
3. **pm-v3 复制**：直接复制 38 个组件 + 共享依赖；重组件按页补齐，接受分批。
4. **自定义模板**：本期只预留 pack/DB/UI 能力，不实现 builder；4 套稳定后启动 P7-7。

待确认（仅影响 P7-6）：

5. 验收阶段是否授权在临时实例调用真实模型（不碰真实 3300）？

---

## 14. P7-2 spike 实施记录（2026-11-19）

### 14.1 结果

- `frontend/preview.html` + `frontend/src/preview/` 新增，作为同一 Vite 构建的第二入口；`OrganizationUsers.vue` 用真实 pm-v3 组件 + Element Plus + mock 渲染成功。
- 直接复制的 pm-v3 子集约 32 个文件（182KB），未整库搬运；`@/` 已改相对路径，无同步脚本/别名插件。
- 新增依赖：`@element-plus/icons-vue`、`js-cookie`、`lodash`、`store`、`sass`（均在 `frontend/` 内安装，未改根 `package.json` 的依赖语义）。
- 验证：
  - `npm run build`（frontend）：成功，1882 modules，7.70s；`dist/preview.html` 存在。
  - `npm run typecheck`：通过。
  - `npm test`：59/59。
  - `npm run check:vue`：通过。
  - Playwright（`vite preview --port 5199`，未占用 3300）：左树 6 节点、表格 4 行、状态下拉筛选、新建账号弹窗、校验/提交均正常；console error/pageerror 0；外部请求 0。
- 包体：`preview-*.js` 211.56 kB（gzip 64.50 kB）、`preview-*.css` 30.94 kB（gzip 6.18 kB）；`element-plus` 共享 chunk 1,029.95 kB（gzip 336.94 kB）。

证据截图：

- `C:\Users\icecream\AppData\Local\Temp\opencode\p7-2-preview.png`
- `C:\Users\icecream\AppData\Local\Temp\opencode\p7-2-preview-dialog.png`

### 14.2 已知问题（P7-3 处理）

1. 后端静态托管未放行 `/preview.html`（本期未改 `backend/**`）。
2. 预览固定 `platform-blue` 和 `organization` 一页；`?type/style/page` 切换未实现。
3. `pm-tree` 上游 CSS 的 `.el-tree-node.is-current .pm-tree__node--custom` 为后代选择器，当前根节点下所有节点文字变蓝；需在模板层覆盖或回改组件。
4. `pm-select` 静态导入整套 select 家族，preview chunk 会包含 dict/entity/user/org/position/lookup；P7-3 可按需改动态 import。
5. `store` 的 `json2.js` 触发 eval 警告（非阻断），来自原 `sessionStore` 依赖。
6. 类型化 select-user/org/position/lookup 只验证编译/注册，未逐一打开面板；当前页面只用了基础 `pm-select` 静态 options。
7. 未改 `docs/STATUS.md` 与交接单；P7-1/P7-3 完成后再统一更新。

### 14.3 改动边界

- 未改 `backend/**`、`data/**`、`projects/**`、`docs/requirements/**`、`TemplateLibraryDialog.vue`、需求模板相关文件。
- 未执行 git 操作；未调用真实模型；未启停真实 3300。

## 15. P7-1 实施记录（2026-11-19）

### 15.1 结果

| 项 | 结果 |
| --- | --- |
| 内置 pack | 新增 `templates/design-system/afcenter-app-templates-v1/`：`pack.json` + 4 个应用类型 `structure.css` + 25 个页面 `.vue` + 4 套风格 `style.css` + `styles/shared.css` + `operations-management/assets/ledger-workflow.svg`，共 35 个资产文件（不含 `pack.json`） |
| 页面数 | 企业 **5** / 运营 **8** / 数据 **8** / 工具 **4** = **25**；页面元数据以 `application-template-config.js` 为准，`components` 由页面实际 `<pm-*>` 标签扫描生成 |
| pack 契约 | `schemaVersion/id/name/version/defaultApplicationType/defaultStyle/applicationTypes[]/styles[]/skills/componentMap/pageRecipes/conformance`；页面含 `id/name/type/recipe/preview/description/blueprint/components`（`blocks` 仅 demo 提供时保留） |
| pack loader | 新增 `backend/src/design/pack.ts`：`listPacks/getPack/getApplicationType/getStyle/getPage` + 摘要；内置根 `templates/design-system`，自定义根 `<dataDir>/design-system`；缓存按 `mtime`；路径安全拒绝绝对路径/盘符/`..`/越界；结构/蓝图/CSS/assets 必须存在 |
| 只读 API | `GET /api/design-system`（`{packs:[摘要]}`）、`GET /api/design-system/:packId`（`{pack, source}`）；新增 `backend/src/design/system-routes.ts` 并在 `index.ts` 挂载 |
| 应用级解析 | `GET /api/apps/:id/design-system`：返回 `pack/applicationType/style/pages/skills/componentMap/pageRecipes/conformance/resolved`；旧应用（无 design 设置且有 `prototype_template_id`）返回 `{legacy:true, prototypeTemplateId, prototypeTemplateName}`；无选择且无旧模板 → 默认 pack（`global-default`） |
| 应用写入 | `POST /api/apps` 支持 `designPack/designApplicationType/designStyle` 或 `designSystem:{pack,applicationType,style}`，未传写默认；`PATCH /api/apps/:id/design-system` 校验后更新；非法参数 400/404 |
| 存储 | **不改表**；`app_settings` 三键：`app.<appId>.design.pack`、`.applicationType`、`.style`；内置 pack 不 seed `prototype_templates`，`apps.prototype_template_id` 保留 |
| payload | `designSystem`（pack/应用类型/风格/页数摘要）与 `legacyPrototypeTemplate`（仅旧应用）；旧字段 `prototypeTemplateId/Name/Source` 不变 |
| 前端 | 新增 `frontend/src/shared/design-system-api.ts`：类型 + `listDesignPacks/getDesignPack/getAppDesignSystem/updateAppDesignSystem`；**未改** `NewAppDialog`/`DesignView`/`TemplateLibraryDialog` |

### 15.2 测试与验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **100 / 100**（原 88 + pack 5 + API/应用 7） |
| `npm run build --prefix frontend` | 通过（1882 modules，含 `preview.html`） |
| `npm test --prefix frontend` | **59 / 59** |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416 端口） |

新增测试：

- `backend/src/design/pack.test.ts`：4 类型/4 风格/25 页面（5-8-8-4）、路径存在、get* 404、绝对路径/`..`/越界报错、自定义 pack 合法/重复 id/缺字段/缺蓝图 400。
- `backend/src/apps/design-system.test.ts`：列表/详情 pack、POST 默认与自定义（对象/flat）、PATCH 更新与保留、非法参数 400、旧应用 legacy、无选择默认、`prototype_templates` 仍为 2 条（未 seed）。

### 15.3 偏差 / 说明

1. `blocks` 仅企业类型在 demo 配置中提供，其余页面不编造，pack 中省略该字段（loader 支持可选 `blocks`）。
2. `PATCH` 同时接受扁平 `pack/applicationType/style` 与 `designSystem` 对象；`POST` 按实施单使用 `designPack/designApplicationType/designStyle` 或 `designSystem`。
3. 旧应用判定：无任何 `design.*` 设置且 `prototype_template_id` 非空 → legacy；无设置且无旧模板 → 默认设计系统（新应用总会写默认设置）。
4. 未生成 `docs/design/design-system.json`、未复制蓝图、未生成设计模板 skill、未改 scaffold：按 P7-5 处理（本轮出口标准不含）。
5. 自定义 pack 仅保留读取/路径安全/校验能力；builder、复制、DB 索引、删除保护均未实现（P7-7）。

### 15.4 未验证项

- 模板中心 UI、风格切换、25 页全量预览（P7-3）；`preview.html` 的 `?type/style/page` 仍未接入。
- 真实 AFCenter 宿主联调、EOS 运行态、真实 3300 启动后的运行态。
- 自定义 pack 的运行时来源（`data/design-system`）没有 UI/写入方，只通过单测临时目录验证。

### 15.5 边界确认

- 未改 `backend/src/requirements/**`、`TemplateLibraryDialog.vue`、需求模板表/逻辑；未改 DB 表结构。
- 未读写真实 `data/`、`projects/`、`.env`（全部临时目录）；未启停真实 3300；未执行 git 操作；未调用真实模型；未保存凭据。

## 16. P7-3a 实施记录（2026-11-19）

> 本轮只做「全量预览宿主」：25 页 × 4 风格接入 `preview.html`、后端静态托管、修 `pm-tree` 高亮、补齐组件/mock。
> **未做**：模板中心 UI、新建应用/设计视图集成（P7-3b）、design.json 契约（P7-4）、MF remote/蓝图分发（P7-5）、自定义 builder（P7-7）。

### 16.1 结果

| 项 | 结果 |
| --- | --- |
| 模板接入 | 新增 `frontend/scripts/generate-preview-templates.mjs`：把 pack 的 `application-types/**`（4 类型 × 25 页面 + 4 `structure.css` + `ledger-workflow.svg`）与 `styles/**`（4 风格 `style.css` + `shared.css`）**原名**复制到 `frontend/src/preview/templates/afcenter-app-templates-v1/`；同时生成 `frontend/src/preview/registry.ts`（`type/pageId → () => import(...)`、`structure.css?inline`、4 套 `style.css` 静态 import、页面/风格元数据）。`npm run gen:preview` 可重跑；`pack.json` 不复制，仍以内置 pack 为单一事实源 |
| 预览参数 | `preview.html?type=&style=&page=`；`preview-params.js` 纯函数解析 + `preview-params.test.mjs`（7 例）；缺省 `enterprise-application-platform / platform-blue / organization`；只给 type 时用该类型 `defaultStyle` 与首页；非法值回退并显示顶部提示条（不白屏）；`document.title` 与 URL 同步 |
| 页面渲染 | `PreviewApp.vue` 按 registry 手动加载页面（失败显示错误条）；当前应用类型的 `structure.css` 以 `?inline` + `<style id="preview-structure-css">` 注入；4 套风格 CSS 静态引入，切风格只改根节点 `visual-style-*` 类，不重建页面组件（保留页面输入态） |
| 风格 | 4 套（platform-blue / classic-warm / data-cyan / high-contrast-tool）+ `shared.css`；预览保留“mock 数据”角标；底部提供 4 风格切换器（仅预览工具，不是模板中心 UI） |
| 组件补齐 | 复制 pm-v3：`pm-auto-number, pm-calendar, pm-card, pm-checkbox, pm-datepicker, pm-datepick-range, pm-divider, pm-echarts, pm-fold, pm-fold-group, pm-html, pm-image, pm-markdown, pm-number, pm-number-range, pm-ocr, pm-radio, pm-richtext, pm-search, pm-select-tree, pm-split, pm-steps, pm-textarea, pm-time-select, pm-toolbar, pm-toolbar-item, pm-upload`，及 `composables/`、`utils/{treeList,loadScript,url}`、`common/{bus,dom}`、`components/mixins/{datasource,formatNullValue}`、`i18n`；`@/` 全部改相对路径；重组件 `defineAsyncComponent` 懒加载 |
| 重组件 | echarts、TinyMCE 富文本、markdown、calendar、upload、select-tree、OCR **真实接入**；**pm-sheet 用“预览占位（组件未接入）”**（依赖 Luckysheet iframe 静态资源，未随包接入） |
| 平台 mock | `mock/data.js` 扩充 dict（user_status/employee_status/org_type/gender/activity_priority/activity_channel/task_status/incident_level）、dictTypes、`marketingPlan` 实体；`mock/index.js` 增加 `DictTypeController`、`LowcodeModelController`（generateNumber / getAttachments / getAttachmentToken / getWopiCoolUrl / uploadAttachments / removeAttachment）、`LowcodeOCRGeneralController`；上传/图片/OCR 均为本地占位，不连接平台/后端 |
| 后端托管 | `backend/src/index.ts` 增加 `GET /preview.html` → `frontend/dist/preview.html`，缺失时 **404 + 清晰提示**（不回落 `index.html`）；`/assets/*` 仍由 `express.static` 托管；未改 API |
| pm-tree 高亮 | 复制组件选择器从后代 `.el-tree-node.is-current .pm-tree__node--custom` 改为直接子节点 `... .is-current > .el-tree-node__content > .pm-tree__node--custom`；Playwright 断言非当前节点 0 处被染色 |
| 预览适配（与上游差异，均已在代码注释标注） | `pm-echarts` 改 `import * as echarts from 'echarts'`；`pm-upload` 的 `_.isArray` 改显式 `isArray`、`ali-oss` 改动态 import；`pm-richtext` 适配 TinyMCE 6（移除 paste/hr/print/emoticons，`skin:false` + 内联 oxide skin/content_style）；`pm-textarea` 根节点 block 满宽；`pm-image` 支持 `img-url`；`pm-select-tree` 宽 100%；`pm-markdown` 窄容器隐藏大纲 |

### 16.2 覆盖清单

| 应用类型 | 页面（id → 名称） |
| --- | --- |
| enterprise-application-platform（5） | overview 管理驾驶舱 / applications 应用中心 / application-form 注册应用 / organization 组织与用户 / audit 审计日志 |
| operations-management（8） | treeTable 运营组织台账 / list 通知公告管理 / form 新建运营公告 / permission 部门权限 / components 运营活动配置 / dashboard 运营简报 / schedule 客服排班 / issues 订单异常处理 |
| data-governance-workbench（8） | treeTable 数据域资产检索 / list 分析任务队列 / form 新建分析任务 / dataset 数据资产目录 / monitor 调度监控中心 / advanced 数据接入工作区 / detail 任务运行详情 / members 工作区成员 |
| incident-response-console（4） | list 异常事件列表 / form 新建异常规则 / layout 处置工作区布局 / detail 异常事件详情 |

风格：platform-blue / classic-warm / data-cyan / high-contrast-tool（4 套全量可切）。

### 16.3 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix frontend` | 通过（27.79s，`dist/preview.html` 存在） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm test --prefix frontend` | **66 / 66**（原 59 + preview-params 7） |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **100 / 100** |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416） |
| `npm run e2e:preview --prefix backend` | **77 条断言通过**（临时端口 + 临时数据目录，不占 3300） |
| 临时全量扫描（未入库） | 25 页 × 默认风格：0 console error、0 pageerror、0 请求失败、0 外部请求 |

`e2e:preview` 覆盖：后端 `/preview.html` 200、`/assets/*` 200、preview 缺失 404 且不回落 index、`/` 仍为工作台入口；4 个应用类型代表页（organization / operation list / data list / incident list）标题+关键区块；4 风格切换后根节点类/主色/URL/输入态；pm-tree 仅当前节点染色；非法参数回退提示；structure.css 注入。

包体（`frontend/dist` 合计 8.01 MB；相对 P7-2 增加重组件懒加载 chunk）：

| chunk | 大小 | 说明 |
| --- | --- | --- |
| `preview-*.js` | 352.87 kB（gzip 108.47） | 预览入口（组织页仅加载入口 + element-plus + 页面/structure chunk） |
| `element-plus-*.js` | 1,077.58 kB（gzip 355.54） | 共享 chunk（与工作台入口共享） |
| `pc-*.js`（Tinymce） | 1,279.71 kB（gzip 450.60） | 懒加载，仅含 pm-richtext 的页面请求 |
| `pc-*.js`（echarts） | 1,034.58 kB（gzip 343.00） | 懒加载，仅含 pm-echarts 的页面请求 |
| `index-*.js`（@vue-office/excel） | 1,682.55 kB（gzip 503.78） | 懒加载，仅 pm-upload 预览 Excel 时请求 |
| `aliyun-oss-sdk-*.js` | 690.51 kB（gzip 188.61） | 懒加载，仅 `isOss` 上传模式请求 |
| `vuedraggable.umd-*.js` | 179.87 kB（gzip 62.87） | calendar/upload 依赖 |
| `preview-*.css` | 30.3 kB | 预览样式 |

证据截图（`C:\Users\icecream\AppData\Local\Temp\opencode\`）：`p7-3a-organization-platform-blue.png`、`p7-3a-operations-list-classic-warm.png`、`p7-3a-data-task-list-data-cyan.png`、`p7-3a-incident-list-high-contrast-tool.png`、`p7-3a-organization-classic-warm/data-cyan/high-contrast-tool.png`、`p7-3a-invalid-params.png`。

### 16.4 偏差 / 未接入

1. **pm-sheet 未接入**：Luckysheet 依赖 `components/sheet/index.html` iframe 与运行时静态资源，预览包未内置；数据接入工作区该区域显示“预览占位（组件未接入）”，未伪造表格。
2. TinyMCE 采用包内内联 skin/content 样式（`skin:false`），与真实宿主的外链 skin 可能有细微差异；未联调图片上传。
3. `pm-calendar` 渲染自身月历布局；页面 CSS 中的 `.el-calendar` 覆盖不命中（页面/组件同源差异，非预览缺陷）。
4. Element Plus 2.14 存在非阻断警告：`pm-upload` 的 `type="text"` 弃用提示、`permission` 页 `ElSwitch` 值类型提示；Playwright 仅把 error 计入失败。
5. `ali-oss`、`@vue-office/excel`、Tinymce、echarts 为懒加载 chunk，组织页不加载；不代表未打包。
6. 未做模板中心 UI、新建应用设计模板选择、设计视图徽标/页面库（P7-3b）；未改 design.json 契约（P7-4）；未做 MF remote/蓝图分发（P7-5）。

### 16.5 未验证 / 边界

- 未验证真实 AFCenter 宿主、EOS 运行态、真实 3300；未启停 3300。
- 未读写真实 `data/`、`projects/`、`.env`；未 seed `prototype_templates`；未改 DB 表结构；未执行 git 操作；未调用真实模型。
- 未做非 headless 浏览器的人工像素比对。

## 17. P7-3b 实施记录（2026-11-19）

> 本轮只做「设计模板中心 UI + 新建应用选择 + 设计视图徽标/入口」。
> **未做**：design.json 页面契约（P7-4）、MF remote/蓝图分发/开发 prompt（P7-5）、一致性验收（P7-6）、自定义 builder（P7-7）。
> **需求模板中心保持不变**：`TemplateLibraryDialog.vue`、`requirement_templates`、`adw-template-req-*`、模块 frontmatter `template` 均未改。

### 17.1 结果

| 项 | 结果 |
| --- | --- |
| 设计模板中心 | 新增 `frontend/src/workbench/DesignTemplateCenter.vue`（单文件，`browse` / `picker` 两模式）：分类 tabs（全部/平台管理/运营管理/数据分析/工具应用）+ 搜索 + 4 应用类型卡片（名称/描述/页面数/去重组件数/CSS mock 缩略图）+ 自定义卡片“即将支持”；详情为“左侧类型/风格 + 中部页面集 + 右侧 iframe 预览” |
| 风格与页面 | 4 套风格切换（signature 色点 + 描述）；切风格重载 iframe 并保留当前页面；页面卡片“进入页面”加载 `/preview.html?type=&style=&page=`；预览先 `fetch` 探测入口，失败显示提示 + 重试（不白屏）；带 15s 超时提示 |
| picker 流程 | 新建应用点「选择设计模板」→ picker 定位当前类型 → 切换类型/风格 → 「使用此模板」emit `{pack, applicationType, style, applicationTypeName, styleName}` 并关闭；取消/关闭不写入 |
| 首页 | 保留「模板库」（需求模板中心）；新增「设计模板」browse 入口；应用摘要新应用显示 `设计模板：<类型> · <风格>`，旧应用显示 `原型模板：<旧模板名>` |
| 新建应用 | 「需求模板」select 与说明原样保留；「设计原型模板」改为「设计模板」（当前摘要 + 选择按钮）；旧原型模板折叠为「旧版兼容（原型模板）」，默认不指定；表单新增 `designPack/designApplicationType/designStyle` 并随 `createApp` 透传 |
| 设计视图 | `getAppDesignSystem(appId)` 读取应用设计系统；新应用徽标按钮显示 `<类型> · <风格>`（点击打开模板中心并定位）；旧应用仍显示 `prototypeTemplate.name`；新增「模板页面库」入口；未改 prototype 渲染/导出逻辑 |
| 类型/API | `frontend/src/workbench/api.ts` 增加 `AppDesignSystemSummary`、`AppInfo.designSystem/legacyPrototypeTemplate`、`CreateAppInput` 设计字段；复用 `shared/design-system-api.ts` |
| 纯函数 | `frontend/src/workbench/design-template-helpers.js`：默认/非法回退、展示描述、picker 结果、组件去重计数、分类 tabs、筛选、页面分组、预览 URL |
| 需求模板中心 | `TemplateLibraryDialog.vue`、模板 API/表/分发未改；Playwright 回归验证「模板库」仍可打开 |

### 17.2 测试与验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix frontend` | 通过（2797 modules，`dist/preview.html` + `dist/index.html`） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm test --prefix frontend` | **76 / 76**（原 66 + design-template-helpers 10） |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **100 / 100** |
| `npm run e2e:preview --prefix backend` | **77 条断言**（保持 P7-3a 基线） |
| `npm run e2e:p7-3b --prefix backend` | **45 条断言**（临时端口 + 临时数据目录，不占 3300） |

`e2e:p7-3b`（`backend/scripts/design-template-e2e.ts`）覆盖：

1. 首页「模板库」仍打开需求模板中心；「设计模板」入口存在。
2. 模板中心 4 应用类型卡片 / 5 个分类 tabs / 搜索命中 / 自定义卡片“即将支持”且禁用。
3. 企业级：4 风格按钮、5 张页面卡片；organization 与 audit iframe 标题正确；iframe URL 的 `type/style/page` 正确；切 classic-warm 后根节点风格类生效。
4. 新建应用：需求模板 select 仍在、旧版兼容默认折叠、默认设计模板摘要、picker 选择运营 + 经典暖色并回填；创建后 `GET /api/apps/:id/design-system` 的 pack/类型/风格与选择一致。
5. 首页应用摘要显示设计系统；设计视图徽标显示“类型 · 风格”，点击可定位当前类型/风格；「模板页面库」存在。
6. 旧应用 fixture（删除 `app.<id>.design.*` 后保留 `prototype_template_id`）：design-system 返回 legacy，徽标仍为「企业级专业管理」。
7. 全程 0 console error / 0 pageerror / 0 请求失败（忽略 iframe 重载 abort）/ 0 外部请求。

截图（`C:\Users\icecream\AppData\Local\Temp\opencode\`）：

- `p7-3b-gallery.png`（4 应用类型 + 自定义卡片）
- `p7-3b-enterprise-detail.png`（企业级详情 + 组织与用户 iframe）
- `p7-3b-enterprise-audit.png`（切风格 + 切页面后 audit）
- `p7-3b-picker.png`（新建应用 picker：运营 + 经典暖色）
- `p7-3b-new-app-form.png`（需求模板保留 + 设计模板摘要）
- `p7-3b-home-app-summary.png`（首页应用摘要显示设计系统）
- `p7-3b-design-view.png`（新应用徽标 + 模板页面库）
- `p7-3b-legacy-design.png`（旧应用仍显示旧原型模板）

### 17.3 偏差 / 说明

1. 设计模板中心用一个组件承载列表/详情（未再拆 `DesignTemplatePicker.vue`）；picker 与 browse 共用同一 UI，仅底部按钮与文案不同。
2. 带 `selection` 打开时直接定位到对应应用类型详情（设计视图「模板页面库」与新建应用 picker），首页 browse 无选择时从列表开始。
3. 旧原型模板选择折叠为「旧版兼容（原型模板）」，默认值改为“不指定”；后端仍保留 `prototypeTemplateId` 与 legacy 解析。
4. 预览 iframe 仍保留 P7-3a 的底部风格切换器（预览工具本身）；模板中心顶部风格切换会重载 iframe，二者不冲突但功能重叠。
5. `AppShell.vue` 顶部状态行未改（不在本轮范围），仍显示解析后的旧原型模板名；设计视图徽标与首页摘要已按设计系统展示。
6. 新增 `e2e:p7-3b` 验收脚本与 `backend/package.json` script；未改后端业务源码。

### 17.4 未验证 / 边界

- 未接 `design.json` 页面契约/页面认领（P7-4），设计视图 prototype Tab 仍按旧 design.json + 旧原型模板渲染。
- 未做 MF remote、蓝图复制、`ui-check.md`（P7-5/P7-6）；未做自定义 builder（P7-7）。
- 未验证真实 AFCenter 宿主、EOS 运行态、真实 3300；未启停 3300。
- 未读写真实 `data/`、`projects/`、`.env`；未改 DB 表结构；未 seed `prototype_templates`；未执行 git 操作；未调用真实模型。

## 18. P7-4a 实施记录（2026-11-19）

> 本轮只做「design.json 页面契约」：schema / validate.mjs / 前端 adapter+类型 / 设计 skill+command / 测试。
> **未做**：线框渲染器的树/弹窗视觉增强（P7-4b）、开发 prompt/MF remote（P7-5）、一致性验收（P7-6）。
> 需求模板中心、旧 design.json、现有原型渲染均未破坏。

### 18.1 结果

| 项 | 结果 |
| --- | --- |
| Schema | `templates/agent/skills/adw-design-artifacts/references/design.schema.json` 新增顶层 `designSystem{pack,applicationType,style}`；页面 `recipe`（8 枚举）/`catalogRef`/`blueprint`/`filters`/`rowActions`/`toolbarActions`/`selection`/`pagination{layout:bar\|split\|three-part,pageSize}`/`form{presentation:dialog\|page,columns:1\|2,width,fields,groups}`/`tree{titleField,parentField,actionStyle,selectionStyle}`/`subTables[{entity,title,columns,mode:tab\|flow}]`/`components`（object，additionalProperties string）。全部可选，`required` 未变 |
| 示例 | `design-example.json` 增加 `designSystem`、`product-list` 契约字段、`category-tree`（tree-list）与 `product-form`（dialog-form）示例 |
| validate.mjs | 支持 `additionalProperties` 与 `x-adw-warning`：设计系统/页面契约新字段的类型/枚举问题只进 `warnings[]`（`severity:"warning"`），不影响 `ok`/退出码；旧字段错误仍进 `errors[]` 并退出 1；输出新增 `warnings` 字段，旧字段保持 |
| 后端 schema | `backend/src/workspace/schema.ts` 增加通用 `additionalProperties` 校验（用于 `components` 值类型）；未改校验器其它语义 |
| 后端 artifacts | `backend/src/workspace/artifacts.ts`：`designs[]` 透传可选 `designSystem`（原样，adapter 负责规范化）；旧设计无该字段；前端 `DesignArtifact` 类型同步 |
| Adapter | `frontend/src/design/design-adapter.js`：结果保留 `designSystem`（规范化，无内容为 null）；页面顶层新增 `recipe/catalogRef/blueprint`；`spec` 增加 `filters/selection/fields(form.fields)/components`；`layout` 新增 `table.searchFields=filters`、`table.pageSize=pagination.pageSize`、`pagination/selection/rowActions/toolbarActions/form/tree/subTables(target=entity,mode)/components`；`actions` 缺省时按 `toolbarActions + rowActions` 去重合并；非法新字段 warning 后忽略 |
| 类型 | `frontend/src/design/types.ts`：`DesignPageRecipe/DesignPagination/DesignFormContract/DesignTreeContract/DesignSubTable/DesignSystemRef`，扩展 `DesignPage/DesignPageSpec/DesignPageLayout`；`frontend/src/design/prototype/spec-types.ts`：`SpecPage/PageLayout` 增加可选契约字段（`subTables` 增 `mode`） |
| 设计 skill | `adw-design-artifacts/SKILL.md` 重写为：先读 design-system.json/模板 skill/蓝图 → 写 designSystem 与页面契约（含 catalogRef/blueprint 有无的两种写法）→ brief 页面契约表/冲突决策 → validate errors/warnings 自查 → 蓝图冲突先记录不静默 |
| Command | `generate-design.md` 同步 designSystem/页面契约/来源说明/brief 页面表/validate 自查；`check-consistency.md` 扩展为需求/design-system/design.json/brief/原型/蓝图/代码，输出缺失页面/字段/操作/表单形态/蓝图/冲突清单，只报告 |
| 边界 | 未改需求模板中心/需求 skill/DB/表；未改 P7-3a 预览页；未改渲染器视觉（PrototypeCanvas 未接线新 layout 字段）；未启停 3300；未读写真实 data/projects/.env；未做 git；未调模型 |

### 18.2 测试与验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **105 / 105**（原 100 + `design/contract.test.ts` 5） |
| `npm run build --prefix frontend` | 通过（2797 modules，`dist/index.html` + `dist/preview.html`） |
| `npm test --prefix frontend` | **79 / 79**（原 76 + adapter 契约 3） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416） |
| `npm run e2e:preview --prefix backend` | **77 条断言**（保持 P7-3a 基线） |
| `npm run e2e:p7-3b --prefix backend` | **45 条断言**（保持 P7-3b 基线） |
| `npm run e2e:p2 --prefix backend` | **116 条断言**（保持） |
| `npm run e2e:p3 --prefix backend` | **126 条断言**（保持；旧 design.json 渲染未回归） |
| `npm run e2e:p4 --prefix backend` | **97 条断言**（保持） |

新增测试：

- `backend/src/design/contract.test.ts`：含契约字段通过；旧 design.json 不变；非法新字段在 artifacts 中结构化列出但设计与页面仍返回；`validate.mjs` 新字段 warnings 不阻断、旧字段 errors 阻断；`design-example.json` 通过。
- `frontend/src/design/design-adapter.test.mjs`：designSystem 保留；filters/columns/pageSize/selection/行与工具栏操作/form/tree/subTables/components 映射；旧页面无新字段时 `layout` 仅 `table/toolbar`、无多余 spec 字段；非法枚举/类型 warning 且不抛错。

### 18.3 偏差 / 说明

1. **warning 落点不同**：`validate.mjs` 把新契约字段问题放入 `warnings[]` 且不阻断；后端 artifacts 仍按现有 schema 校验行为放入 `errors[]`，但 HTTP 200、设计与页面照常返回（不阻断）。两者都非门禁；最终以前端 artifacts 展示为准。
2. 渲染器未消费新 `layout.form/tree/selection/rowActions/toolbarActions/pagination/components`（P7-4b），本轮只保证 adapter 输出与类型存在，**线框视觉不变**；`layout.table.searchFields/pageSize` 沿用现有渲染器能力。
3. 页面 `type` 未扩展 `tree-list/permission/workspace` 等模板类型，仍由 `recipe` 表达配方，避免破坏旧枚举与渲染降级逻辑。
4. `tree.actionStyle/selectionStyle` 按 brief 保持自由字符串（未定义枚举）；`form.groups[]` 未设 required，保持宽容。
5. `designSystem` 只保留 `pack/applicationType/style` 三字段；其它字段不进入 adapter 输出。
6. e2e 无需更新断言：p3/p4 均未依赖设计 skill/command 文本或新契约字段；p2/p3/p4 全部保持原条数。

### 18.4 未验证 / 边界

- 未用真实模型跑“读 design-system/蓝图 → 写页面契约 → brief 页面表/冲突”的完整设计生成；只验证 schema/脚本/adapter/prompt 资产。
- 设计视图尚未展示页面契约摘要/蓝图/认领状态（P7-4b/P7-6 范围）；线框树的树/弹窗视觉增强未做。
- 蓝图路径存在性、`catalogRef` 与页面库匹配、brief 冲突记录完整性未做自动校验（check-consistency 只报告）。
- 未验证真实 AFCenter 宿主、EOS 运行态、真实 3300。
- 未读写真实 `data/`、`projects/`、`.env`；未改 DB 表结构；未 seed 原型模板；未执行 git 操作；未调用真实模型。

## 19. P7-5a 实施记录（2026-11-19）

> 本轮只做「独立 MF remote 脚手架 + 设计系统/蓝图/团队 skill/PageTemplates 分发 + pack 型模板 skill」。
> **未做**：开发 prompt/digest/module/ui-check 生成机制（P7-5b）、一致性验收（P7-6）、自定义 builder（P7-7）。
> 需求模板中心、旧应用 legacy 行为、现有 design.json 渲染均未破坏。

### 19.1 结果

| 项 | 结果 |
| --- | --- |
| MF remote 种子 | 新增 `templates/afc-remote/`：`package.json`、`setting.json`（`app.name = {{APP_ID}}`）、`babel.config.js`、`.npmrc`、`build/{mfp.config,webpack.config,webpack.dev,webpack.prod,utils}.js`、`public/index_app.html`、`static/`、`src/{main.js,bootstrap.js,App.vue,router/index.js,views/AppIndex.vue,preferences/GlobalPreference.js}`；`mfp.config.js` 暴露 `./index`，`vue/vue-router/element-plus` singleton；无 demo 业务页/actions/store |
| PageTemplates | `templates/afc-remote/src/components/PageTemplates/`：`index.js`、12 个 `.vue`（List/TreeList/TreePanel/Form/FormSection/FormSectionCard/FormSectionDivider/QueryPanel/RowActions/ThreePartPagination/BlueListPage）、`utils.js`、`style.css`、`appearance.css`、`table-white/table-blue/toolbar-blue/list-blue.css`；不含 `examples/docs/verify.cjs/install.js` |
| GlobalPreference | `src/preferences/GlobalPreference.js`：`reactive` 单例 + `common/blocks/templates/tableConfig/text/textarea` 默认值；页面统一导入 |
| 团队 skill 入库 | `templates/agent/skills/afcenter-page-generation/`（68 文件，含 assets/references/scripts/agents）与 `pm-components-usage/`（6 文件）；内容原样复制，同级相对链接可用 |
| scaffold | `scaffoldApp` 接收 `designSystem`：先校验（非法在创建前抛错、不建目录）→ 复制 `templates/afc-remote` 到 `frontend/` 并替换 `app.name`/`package.json name` → 写 `docs/design/design-system.json` + `docs/design/template/<type>/`（pages + structure.css + assets）+ `docs/design/template/styles/{shared,style}.css`（只复制选中类型）→ `installAgentAssets` 分发团队 skill → `syncTemplatesInto` 生成设计模板 skill |
| 设计系统摘要 | `schemaVersion/pack/packName/packVersion/applicationType(+Name)/style(+Name/ClassName)/blueprintRoot/templateDir/structure/styles{shared,style}/pages[{id,name,type,recipe,description,blueprint,packBlueprint,components,blocks}]/skills`；无时间戳，幂等 |
| 模板 skill | `backend/src/templates/distribution.ts` 生成 `adw-template-proto-<applicationType>/`：`SKILL.md`（pack/类型/风格、页面库/蓝图表、页面配方、组件映射、conformance、设计/开发读取顺序、`ui-check.md` 要求、冲突上报与边界）+ `assets/design-system.json` + `_manifest.json`（`managed:true, kind:"design-system", sourceId=applicationType, templateName, hash`） |
| skill 期望/清理 | `expectedSkillIds` = 2 方法 skill + 2 团队 skill + 需求模板 skill +（设计系统应用：设计模板 skill / 旧应用：旧原型模板 skill）；设计模板 skill 按 `kind=design-system` 白名单清理，旧原型模板/团队/用户 skill 不受影响；旧 legacy 生成逻辑保留 |
| 工作区同步 | `ensureWorkspaceAssets`（应用打开/会话启动）按 `app_settings` 幂等对齐 `design-system.json` 与蓝图副本，并同步模板 skill；`installAgentAssets` 改为内容不同才复制，避免每次打开重写 70+ 团队 skill 文件 |
| 路由 | `POST /api/apps` 将解析后的设计系统传给 scaffold；旧应用（无 `app_settings` 设计三键）不生成 frontend/design-system，行为不变；不改 DB 表、不 seed `prototype_templates` |
| 测试 | 后端新增 scaffold 2 条（MF 产物/内容抽样/setting 替换/非法不建目录）+ distribution 2 条（设计模板 skill/manifest/hash/团队 skill/期望/清理、设计 skill 与旧原型 skill 互斥）；前端/数据库未改 |

### 19.2 测试与验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **109 / 109**（原 105 + scaffold 2 + distribution 2） |
| `npm run build --prefix frontend` | 通过（2797 modules；`dist/index.html` + `dist/preview.html`） |
| `npm test --prefix frontend` | **79 / 79**（未改前端代码） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416；断言 MF 骨架/蓝图/设计 skill/团队 skill/setting 替换） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型）：2 方法 + 2 团队 + 设计模板 + 需求模板 skill + 4 command |
| `npm run e2e:preview --prefix backend` | **77 条断言**（保持） |
| `npm run e2e:p7-3b --prefix backend` | **45 条断言**（保持） |
| `npm run e2e:p2 --prefix backend` | **116 条断言**（保持） |
| `npm run e2e:p3 --prefix backend` | **126 条断言**（保持） |
| `npm run e2e:p4 --prefix backend` | **97 条断言**（保持） |

### 19.3 偏差 / 说明

1. **团队 skill 全量原样复制**：`afcenter-page-generation` 含 `assets/PageTemplates` + `ApplicationPageTemplates`（68 文件），`pm-components-usage` 6 文件；未裁剪内容，保持相对链接与升级同源。PageTemplates 因此同时存在于团队 skill assets 与 `templates/afc-remote/src/components/PageTemplates/`（前者是 skill 源，后者是生成物骨架）。
2. **额外复制应用类型 assets**：蓝图 `OperationsComponentForm.vue` 引用 `../assets/ledger-workflow.svg`，复制蓝图时一并复制 `application-types/<type>/assets/`，否则 operations 蓝图无法编译；brief 只列 pages + structure.css，属必要补充。
3. **设计模板 skill 的 manifest kind 为 `design-system`**：与旧 `kind=prototype` 区分，避免旧原型模板删除/清理误伤；skill id 仍复用 `adw-template-proto-<applicationType>` 前缀。
4. **新应用不再生成旧原型模板 skill**：即使请求显式传 `prototypeTemplateId`，DB 列仍记录、payload 仍解析，但不生成 `adw-template-proto-<legacy-id>` skill；旧应用（无设计三键）保持旧逻辑。
5. **`design-system.json` 字段多于 brief 示例**：增加 `packVersion/packName/applicationTypeName/styleName/styleClassName/structure/styles/templateDir/packBlueprint`，供开发直接定位蓝图与样式。
6. **工作区对齐范围**：只对齐 `docs/design/design-system.json` 与 `docs/design/template/**` 受管副本；不重写 `frontend/`（开发实现后不能被覆盖），也不改 `docs/requirements`、`docs/design/<MOD>` 正文。
7. **`ensureWorkspaceAssets` 依赖 DB 设计选择**：应用打开/会话启动时读 `app_settings` 三键；scaffold 在 DB 落库前显式传入，避免时序依赖。
8. **e2e p2 3.3 改为等待徽标更新（≤6s）**：新增团队 skill/蓝图对齐后 `GET /apps/:id` 略慢，原脚本“立即读徽标”存在竞态；断言数不变（116）。
9. **生成物不在本轮 `npm install`/构建**：宿主依赖 `pm-*` 不在种子 `package.json` 中；`vue/vue-router/element-plus` 已声明，README 说明 `npm install`/`npm run dev`/`build:prod`。
10. **已有应用切换设计模板**：`PATCH /design-system` 后，应用打开/会话启动会更新 `design-system.json`、当前类型蓝图与设计模板 skill；不会补建 `frontend/`（本轮只覆盖新建应用），也不会清理旧应用类型蓝图目录。旧应用改为设计模板时按需手工处理前端骨架。

### 19.4 未验证 / 边界

- 未在 `projects/<app>/frontend/` 执行 `npm install` / `npm run dev` / `build:prod`；MF remote 与真实 AFCenter 宿主的联合加载、pm-* 全局组件、base remote 未跑通。
- 未做开发 prompt/digest/module 自动注入、`ui-check.md` 自动生成与软门禁（P7-5b）；skill 文本已写要求，机制未落。
- 未做一致性验收（P7-6）、自定义模板 builder（P7-7）。
- 未运行 EOS 后端构建；`templates/afc-remote` 未做浏览器渲染截图。
- 未启停真实 3300；未读写真实 `data/`、`projects/`、`.env`；未改 DB 表结构；未 seed 原型模板；未执行 git 操作；未调用模型。

## 20. P7-5b 实施记录（2026-11-19）

> 本轮只做「开发强关联」：开发 prompt / 应用 AGENTS / 开发方法 skill / design digest / 模块上下文 / `ui-check.md` 软门禁 / 开发视图只读参考。
> **未做**：一致性检查脚本与截图自动比对（P7-6）、自定义 builder（P7-7）；未改需求模板中心/需求 skill/DB 表/旧应用行为。
> 需求模板中心、旧 design.json、现有会话/流式/停止/compact 均未破坏。

### 20.1 结果

| 项 | 结果 |
| --- | --- |
| 开发 prompt | `buildViewPrompt('development')` 重写：应用设计系统 `docs/design/design-system.json` + `docs/design/template/` 蓝图/样式；模块 `design.json`/`design-brief.md`/`tokens.json`/`prototypes/*.png`；团队 skill（`afcenter-page-generation`、`pm-components-usage`）、开发方法 skill（`adw-frontend-implementation`）、设计模板 skill；优先级 **需求 > design-system/design.json 契约 > 蓝图（布局/组件） > brief/tokens（视觉变量） > PNG（线框草图）**；蓝图复制/适配、PageTemplates/pm-*/GlobalPreference/conformance、ui-check 软门禁、MF remote/宿主边界、冲突先报告、偏离说明、完成汇报 |
| 首条提示 | `DEFAULT_DEV_PROMPT` 同步（设计系统/蓝图/ui-check/PageTemplates/pm-*/GlobalPreference/EOS 边界）；`createDevSession` 接受 `module`，单模块时首条提示追加“本轮目标模块” |
| 应用 AGENTS.md | `APP_AGENTS_MD` 新增「设计系统与开发规则」：读取顺序、优先级、先填 ui-check（软门禁）、蓝图复制/适配、PageTemplates/pm-*/GlobalPreference、pm-* 宿主提供、禁止自造 UI、偏离说明、PNG 草图、EOS 不吃风格；README（`templates/afc-remote/README.md`）补充 ui-check/组件规范/冲突 |
| 开发方法 skill | 新增 `templates/agent/skills/adw-frontend-implementation/SKILL.md`：读取顺序、页面对照表、蓝图复制/适配、PageTemplates/pm-*/GlobalPreference、conformance、截图比对、冲突/偏离、完成汇报、失败边界；`installAgentAssets` 自动分发；`expectedSkillIds` 增加；`smoke:assets` 期望列表增加 |
| design digest | 新增 `backend/src/dev/digest.ts`：pack/类型/风格/页面库、蓝图根、模块/页面（id/name/recipe/blueprint）、字段/列/操作/表单/树/分页摘要、实体字段、brief/tokens/PNG（含过期）、ui-check 状态、团队/开发 skill；约 6KB 上限并截断；未指定模块/设计缺失/应用不存在均给明确提示不抛 500；开发 prompt 注入 |
| 模块上下文 | `backend/src/dev/routes.ts` 的 `POST /session` 接受 `module`；`createDevSession`/`promptDevSession` 支持模块；`DevView` 从 artifacts 读取模块列表与 ui-check 状态，单模块自动选中，选择写 `localStorage`（`adw.dev.module.<appId>`），发送/新建会话均带模块 |
| ui-check 软门禁 | 新增 `backend/src/dev/ui-check.ts`：`docs/design/<MOD>/ui-check.md` 缺失时生成骨架（实现前/实现后/未实现项；页面/字段/操作/蓝图/布局来自 design.json + design-system 页面库）；已存在不覆盖；设计缺失/模块非法/目录缺失跳过；状态 `missing/skeleton/filled`（骨架哈希标记判断是否已填）；artifacts `design.uiCheck` 只读暴露；开发视图显示“未生成/已生成未填/已填”；不阻断 |
| 开发视图参考 | `DevView.vue` 新增模块下拉与「设计参考」只读卡：应用类型/视觉风格/页面库数量/当前模块/ui-check 状态/蓝图根/「打开模板中心」；未改时间线/工具卡/权限卡/Composer |
| 测试 | 后端新增 `dev/linkage.test.ts` 5 条（digest 内容/长度、缺失模块、ui-check 生成/不覆盖/状态、无设计跳过、artifacts uiCheck）；`dev/service.test.ts` 增加模块/digest/ui-check 1 条；`chat/service.test.ts` 增加开发 prompt 断言；前端新增 `dev/design-ref.test.mjs` 4 条；`e2e:p4` 增加模块选择/ui-check/设计参考/新 prompt 断言 |

### 20.2 测试与验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **115 / 115**（原 109 + linkage 5 + service 1） |
| `npm run build --prefix frontend` | 通过（2798 modules；`dist/index.html` + `dist/preview.html`） |
| `npm test --prefix frontend` | **83 / 83**（原 79 + design-ref 4） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416；断言开发方法 skill） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型）：2 方法 + 开发方法 + 2 团队 + 设计模板 + 需求模板 skill + 4 command |
| `npm run e2e:preview --prefix backend` | **77 条断言**（保持） |
| `npm run e2e:p7-3b --prefix backend` | **45 条断言**（保持） |
| `npm run e2e:p2 --prefix backend` | **116 条断言**（保持） |
| `npm run e2e:p3 --prefix backend` | **126 条断言**（保持） |
| `npm run e2e:p4 --prefix backend` | **128 条断言**（原 97 + 模块/设计参考/ui-check/新 prompt） |

### 20.3 偏差 / 说明

1. **ui-check 状态靠骨架哈希**：生成文件带 `<!-- adw:ui-check:skeleton hash:... -->`；内容未改视为“已生成未填”，一旦编辑（含追加）哈希不匹配即“已填”。已存在文件不覆盖；手工创建的对照表（无标记）视为“已填”。
2. **digest 只做摘要**：页面最多展开 12 个、字段/列/操作有上限；超 6KB 截断并注明；完整事实仍要求读 design.json/蓝图，避免把大段原文塞进 prompt。
3. **模块上下文按应用持久化在前端**：`localStorage` 键 `adw.dev.module.<appId>`；后端会话表不加列（不改表）。打开应用时有效值优先、失效回退上次/唯一模块。
4. **ui-check 只在开发 prompt 生成**：`createDevSession`/get 状态不写文件；command 分支不改写对照表。设计缺失时跳过，仅提示。
5. **e2e p4 增加 fixture**：脚本在临时应用目录写入 `docs/requirements/MOD-001-商品管理.md` 与 `docs/design/MOD-001/design.json`，用于模块自动选中、digest 与 ui-check 断言；不改产品路径。
6. **开发视图只读参考不含一致性检查**：ui-check 状态与蓝图根只展示；静态检查/截图比对留 P7-6。

### 20.4 未验证 / 边界

- 未用真实模型验证“读 digest + 蓝图 → 填 ui-check → 复制页面 → 截图比对”的完整还原流程（P7-6/用户授权）。
- 未跑生成物 `frontend/` 的 npm install/dev/build、真实 AFCenter 宿主 pm-* 与 EOS 运行态。
- 未做截图自动比对/一致性检查脚本、自定义 builder（P7-6/P7-7）。
- 未启停真实 3300；未读写真实 `data/`、`projects/`、`.env`；未改 DB 表结构；未执行 git 操作；未调用真实模型。

## 21. P7-6a 实施记录（2026-11-19）

> 本轮只做**设计一致性静态检查**：脚本 + command + API + 开发视图按钮/只读报告。
> **未做**：真实模型 E2E（P7-6b，需用户授权）、截图自动像素比对、自定义 builder。
> 只报告，不作为硬门禁；不改需求模板中心/需求 skill/DB 表/P7-3a/b 预览与模板中心业务。

### 21.1 结果

| 项 | 结果 |
| --- | --- |
| 共享规则 | 新增 `templates/agent/skills/adw-frontend-implementation/scripts/lib/fidelity-core.cjs`（Node 内置 fs/path/crypto，无外部依赖）；脚本与后端 API 共用同一份规则，避免两套判断漂移 |
| 脚本 | 新增 `.../scripts/check-fidelity.mjs`：`--app`、`--module`、`--json`、`--strict`；默认输出人类摘要 + JSON，exit 0；`--strict` 仅 fail 时 exit 1；参数/目录错误 exit 2 |
| 检查项（12） | `design-system`（存在/合法/pack/类型/风格/页面库）、`page-contract`（recipe + blueprint/catalogRef）、`blueprint-files`（蓝图存在）、`implementation`（视图启发式匹配 + 路由注册）、`page-templates`、`pm-components`、`form-dialog`（pm-form-dialog/FormSection/StandardFormPage）、`auto-height`、`global-preference`、`style-imports`（structure/shared/style/visual-style）、`ui-check`（missing/skeleton/filled）、`prototypes`（缺失/过期/空 manifest） |
| Command | 新增 `templates/agent/commands/check-design-fidelity.md`：运行脚本、按 12 项汇总、给修复建议、只报告不改代码；应用/全局 command 数 4 → 5 |
| 后端 API | 新增 `backend/src/dev/fidelity.ts` + `POST /api/apps/:id/design-fidelity`（body `{ module? }`）；返回 `{ appId, schemaVersion, ok, empty?, reason?, generatedAt, module, modules, designSystem, checks, summary }`；无应用 404、目录缺失 409、模块非法 400、无设计 200 `{empty:true,reason:'no-design'/'design-missing'}`，不 500 |
| 开发视图 | `DevView.vue` 设计参考面板新增「检查一致性」按钮 + 只读报告（总体状态/计数/模块/时间/逐项证据/建议/ui-check/PNG stale）；切换模块清空旧报告；不自动改代码、不影响会话/时间线 |
| 类型/纯函数 | `dev/types.ts` 新增报告类型；`dev/api.ts#checkDesignFidelity`；`dev/design-ref.js` 新增状态/文案/摘要纯函数；`design-ref.test.mjs` 增加 2 条 |
| 测试 | 后端新增 `dev/fidelity.test.ts` 8 条（脚本 pass/warn/fail/缺设计/缺模块/--module/参数错误 + 服务正常/404/400/409/empty）；前端 2 条；新增 `e2e:p7-6a`（15 条断言）；`smoke:workspace` 增加命令/脚本/API 断言；`smoke:assets` 期望 5 command |

### 21.2 测试与验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **123 / 123**（原 115 + fidelity 8） |
| `npm run build --prefix frontend` | 通过（2798 modules） |
| `npm test --prefix frontend` | **85 / 85**（原 83 + design-ref 2） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416；5 command、检查脚本、API 正常/无设计/非法模块/无应用） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型）：5 command 已加载 |
| `npm run e2e:p7-6a --prefix backend` | **15 条断言**（临时端口 + 临时数据目录；按钮/报告/ui-check/只读提示/0 console·page·API error） |
| `npm run e2e:preview --prefix backend` | **77 条断言**（保持） |
| `npm run e2e:p7-3b --prefix backend` | **45 条断言**（保持） |
| `npm run e2e:p2 / p3 / p4 --prefix backend` | **116 / 126 / 128 条断言**（保持） |

截图：`C:\Users\icecream\AppData\Local\Temp\workbench-p7-6a-shots\p7-6a-fidelity.png`。

### 21.3 偏差 / 说明

1. **规则只写一份**：`.cjs` 核心由 CLI 与后端 `require` 共用；后端优先加载仓库内置副本，缺失时回退应用 `.opencode` 分发副本，保证 API 与脚本同版本。
2. **实现/路由是启发式**：按蓝图文件名、页面 id、名称和中文字段在 `frontend/src/views/` 匹配；无法判断只给 warn 并列出候选，不误报 fail。`frontend/src` 缺失才 fail。
3. **把“模板自证”排除**：占位 `AppIndex.vue`、`components/PageTemplates/**`、`preferences/GlobalPreference.js` 定义本身不参与“已使用”判断，避免空应用误判通过。
4. **无设计不是 500**：未指定模块且无设计 → 200 `empty/no-design`；指定模块缺失 → 200 `empty/design-missing` + `page-contract` fail；模块 id 非法 → 400。
5. **PNG 只查 manifest/designHash**：不做像素比对；未导出/过期/空 manifest 都是 warn。
6. **e2e 独立脚本**：新增 `e2e:p7-6a`（复用 p2 harness，可选 `P2_DESIGN_SYSTEM` 建带设计系统应用），不改动 p2/p3/p4 断言数。
7. **command 数变更**：`workspace-smoke` 与 `verify-agent-assets` 的期望改为 5 个 command。

### 21.4 未验证 / 边界

- 未做真实模型 P7-6b：由 agent 实际读报告 → 修复代码 → 再检查的闭环仍需用户授权验证。
- 未做截图 vs 蓝图/预览的自动像素比对；视觉一致性仍需人工/后续能力。
- 未跑生成物 `frontend/` 的 install/dev/build、真实 AFCenter 宿主 pm-*、EOS 运行态。
- 未启停真实 3300；未读写真实 `data/`、`projects/`、`.env`；未改 DB 表结构；未执行 git 操作；未调用模型。

## 22. P7-6b 真实模型闭环实施记录（2026-11-19，部分通过）

- 环境：临时 `workbench-p7-6b-RsoJCm`；后端 3441、opencode 4741；真实 `packycode-deepseek/deepseek-flash`；未碰真实 3300/4771。
- 设计：90,474ms；`design.json` 5,077B（3 实体/3 关系/2 页面 + designSystem + 页面契约），`design-brief.md` 13,079B；validate 0 error/warning。
- 开发：265,196ms 墙钟（含 SSE 生命周期等待；模型约 17:33:42 写完全部文件）；`ui-check.md` 已填；`OrganizationView.vue` 18,141B/497 行 + `/organizations` 路由；PageTemplates/pm-*/v-auto-height/GlobalPreference/visual-style 命中。
- 一致性：11 pass / 1 warn / 0 fail；warn 为 PNG 未导出；无 fix round。
- 证据：`docs/plans/evidence/2026-11-19-p7-6b/`、`docs/plans/2026-11-19-p7-6b-real-model-brief.md`。
- 偏差：开发 SSE 在模型完成后未关闭，人工 interrupt 收尾（产物完整）；动作/树枚举口径不统一；风格文件路径命名不一致；PNG/视觉截图未验证；MF remote 未 install/build、未联调宿主/EOS。
- 结论：工具链与产物闭环跑通；SSE 生命周期、枚举校验、视觉比对待后续处理。

## 23. P7-6c SSE 生命周期 + 契约枚举/路径小修实施记录（2026-11-19）

> 范围：只修开发/对话 SSE 完成检测、动作/树枚举软校验、风格文件路径统一；不跑真实模型、不启停真实 3300、不读写真实 `data/projects/.env`、不做 git、不改需求模板中心。

### 23.1 SSE 生命周期

- 新增 `backend/src/opencode/session-state.ts`（纯函数）：`sessionCompletion(info, messages)` 以末条 `idle` 消息 / `outcome` / `time.idle` / `busy=false + assistant 已完成` 判定完成；`shouldFallbackFinish()` 判断 watchdog 是否该查会话；`eventCompletion()` 兼容 `session.status/session.updated/session.state` 的显式 idle 状态；`lastIdleMessage()` 只看当前轮（最后一条 user 之后），避免沿用上一轮收尾。
- **P7-7c-2 真实模型修复（2026-11-21）**：真实 `deepseek-flash` 暴露“`finish=tool-calls` 被当作收尾、数值型 `time.busy` 被忽略”导致 8.7s/10 read 后提前 `succeeded`。
  已改为：`tool-calls/tool_calls/tool-use/tool_use` 不算收尾；有限正数 `time.busy` 视为仍在忙；`chat/service.test.ts` +3 断言。
  证据 `docs/plans/evidence/2026-11-21-p7-7-real-model/pre-fix-early-stop/`。
- `backend/src/chat/service.ts`：
  - 记录 `lastEventAt`（任意订阅事件）与 `hasActivity`（delta/text/tool/permission/form）；
  - 每 2s watchdog：最后事件后超过 10s、已有活动且无待处理权限/表单时，调用 `opencode.session()` + `opencode.messages({order:'desc'})` 确认收尾；完成才 `finish()`，客户端收到 `done`；
  - 保留总超时并调整为 20 分钟；`finish()` 幂等，watchdog/heartbeat/timer 在 cleanup 清理；断开/中断不重复写 done；
  - 新事件类型（`session.status` 等）仅在显式 idle/failed/interrupted 时收尾。
- `backend/src/dev/timeline.ts`：`buildProgress` 状态优先取当前轮末条 idle/outcome，避免 `session.idle` 事件丢失后开发视图长期“运行中”；无 idle 且 `busy` 时不误判。
- `frontend/src/dev/DevView.vue`：GET development 收敛到非 running 后清掉“思考中”占位（完成事件丢失时也能收口）；5s 轮询 + 事件防抖刷新保持。

### 23.2 契约枚举软校验

- `design.schema.json`：`rowActions/toolbarActions` 增加 `x-adw-recommended`（15 个动作码），`tree.actionStyle` 增加 `x-adw-allowed`（header/footer/none），`tree.selectionStyle`（platform/dot/background）；保留 `x-adw-warning`。
- `validate.mjs`：支持 `x-adw-recommended`/`x-adw-allowed`，未知值只进 `warnings[]`、退出码仍由 errors 决定。
- 后端新增 `backend/src/workspace/design-contract.ts`；`workspace/artifacts.ts` 把同一口径 warning 写入 `designs[].warnings`（保留原值，不阻断旧 design.json）。
- 设计 skill 文案补充推荐值与 warning 行为。

### 23.3 风格路径统一

- `design/system-file.ts`：新应用复制到 `docs/design/template/styles/<styleId>/style.css`；`design-system.json.styles` 增加 `styleId`，`style` 指向新路径（`shared` 不变）。
- 同步 `apps/scaffold.ts`（应用 AGENTS.md）、`templates/distribution.ts`（设计模板 skill 文案）、`dev/digest.ts`（开发摘要输出风格样式路径）、`chat/service.ts`（开发 prompt）、`adw-frontend-implementation/SKILL.md`、`afc-remote/README.md`、`check-design-fidelity` command。
- `fidelity-core.cjs`：`design-system` 检查兼容新旧路径；旧 `docs/design/template/styles/style.css` 通过并提示“不迁移”；声明路径全缺失只 warn 不 fail；仍保持 12 项检查。
- 不迁移已有应用、不删除旧文件；P7-6b 证据目录未改。

### 23.4 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **132 / 132**（原 123 + chat 5 + timeline 1 + contract 2 + fidelity 1） |
| `npm run build --prefix frontend` | 通过（2798 modules） |
| `npm test --prefix frontend` | **85 / 85**（保持） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416；新风格路径） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型；skill/command 正常加载） |
| `npm run e2e:p4 --prefix backend` | **128 条断言** |
| `npm run e2e:p7-6a --prefix backend` | **15 条断言** |
| `npm run e2e:preview --prefix backend` | **77 条断言** |
| `npm run e2e:p7-3b --prefix backend` | **45 条断言** |

### 23.5 偏差 / 未验证 / 边界

- 偏差：后端 artifacts 仍把既有软字段（recipe/form/pagination 等）的类型问题列为 errors（P7-4a 既有口径未改）；本轮只让**新增动作/树枚举**在两端一致进入 warning。
- 未验证：真实模型是否不再需要人工 interrupt（本轮按要求未跑真实模型）；宿主/浏览器里开发视图长时间运行后的实际收敛；生成物 `frontend/` install/build。
- 边界：未启停真实 3300；未读写真实 `data/`、`projects/`、`.env`；未执行 git；未改需求模板中心；P7-6b 证据目录只读未改。

## 24. P7-6b 复跑（2026-11-20，通过）

- 目的：验证 P7-6c SSE 自动收尾；同一驱动、全新临时目录/端口、真实模型。
- 环境：`workbench-p7-6b-MBbEuZ`；后端 3441 / opencode 4741；`packycode-deepseek/deepseek-flash`；真实 3300 未动。
- 设计：93,327ms；design.json 2 页面 + designSystem；brief 落盘。
- 开发：**234,491ms；无 error；done=true；finalText 2,409 字符；未人工 interrupt**。
- 实现：ui-check filled；OrganizationView.vue 17,931B/532 行；PageTemplates/pm-*（6）/v-auto-height 2/GlobalPreference/路由。
- 一致性：**11 pass / 1 warn / 0 fail**（warn 为 PNG 未导出）；无 fix round。
- 软校验：validate 捕获 `toolbarActions[2]="batchAssignRole"` warning，保留原值不阻断。
- 风格路径：`styles/platform-blue/style.css` 新路径生效；fidelity 通过。
- 证据：`docs/plans/evidence/2026-11-20-p7-6b-rerun/`；`2026-11-19-p7-6b-real-model-brief.md` 第 7 节。
- 结论：P7-6b 通过（工具链/产物/SSE 收尾）；生成物 install/build/截图、真实宿主 pm-*、EOS/PNG 视觉仍待验证。

## 25. P7-4b 实施记录（2026-11-20，已实施待评审）

### 25.1 结果

- **纯函数**：`frontend/src/design/prototype/contract-view.js`（无 Vue/DOM）：`controlFromComponent`（`pm-*` → 控件）、`resolveSelection`、`resolveRowActions`、`resolveToolbarActions`（含 batch 判定）、`paginationModel`、`pagerSelectionText`、`treeModel`、`formView`、`subTableView`、`fieldSpanWithColumns`；`contract-view.test.mjs` 15 例。
- **接线**：`layout.ts#controlOf` 优先级 `fieldOverrides.control > components > 类型/命名推断`（推断逻辑移入纯函数，行为不变）；`design-adapter.js` 增加 `form.groups → layout.groups`（仅在存在时写该键）；`PrototypeCanvas.vue` 透传契约字段并通过 `entities` 把本模块全部实体传给渲染器；`toSpecEntity` 保留关系供子表解析。
- **列表页**：`WireframeTable.vue` 支持左树右表（`wf-split` / `wf-tree`，`titleField/parentField`、platform/dot/background、header/footer/none、节点点击只改高亮）、`selection` 勾选列与 `wf-batch-bar`、`rowActions/toolbarActions`（动作码→中文、create 主按钮、batch* 进批量条、未知码原样）、`pagination` 三形态；移动端不渲染树。
- **表单页**：`WireframeForm.vue` 支持 `form.presentation=dialog`（假列表背景 + 居中 `wf-dialog`，宽度 inline + clamp 360–900，标题=页面标题，底部取消/提交）、`form.columns=1` 单列、`layout.groups` 分组、`components` 经 `FieldControl` 生效、`subTables` 多子表且 `mode=tab` → `wf-subtabs` 页签；移动端保持整页表单。
- **样式**：`wireframe.css` 新增树面板/批量条/三段分页/弹窗/子表页签；保持灰阶线框，无 Element Plus。
- **测试**：新增 `backend/scripts/renderer-e2e.ts` + `e2e:p7-4b`（临时根/3444/stub；fixture 树列表 + 弹窗表单；48 条断言）。

### 25.2 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix frontend` | 通过（2799 modules；preview 入口正常） |
| `npm test --prefix frontend` | **102 / 102**（原 85 + contract-view 15 + adapter 2） |
| `npm run typecheck / check:vue --prefix frontend` | 通过 |
| `npm test --prefix backend`（临时目录） | **132 / 132** |
| `npm run e2e:p7-4b --prefix backend` | **48 条断言**；端口 3444 已关闭 |
| `npm run e2e:p3 --prefix backend` | **126**（旧 design.json 视觉不变） |
| `npm run e2e:preview / p7-3b / p7-6a` | **77 / 45 / 15** |
| `npm run e2e:p2 / p4` | **116 / 128** |

截图/导出：`C:\Users\icecream\AppData\Local\Temp\workbench-p7-4b-shots\`（`p7-4b-tree.png`、`p7-4b-dialog.png`、`MOD-001-org-list.png`、`MOD-001-org-form.png`）。

### 25.3 偏差 / 说明

1. 树节点/分页/批量条是线框演示：节点不改变表格数据、分页不真实翻页、批量动作只提示。
2. 子表目标解析新增本模块实体池参数（`subTableModels(..., pool)`）；设计视图经 `PrototypeCanvas` 传入全部实体；原 `findEntityInModule` 恒空行为保留。
3. `form.groups` 之外未额外改变 adapter 输出；无 `form.groups` 时不产生 `layout.groups` 键。
4. 字段控件仍按 `fieldOverrides > components > 推断`；如“机构名称”含“机构”仍推断为组织选择控件（P7-4a 前规则）。
5. 弹窗页单列字段较多时纸面较长，PNG 全量导出不裁剪；未改 PNG 导出语义。
6. 评审修正（2026-11-20）：three-part 在 `selection=false` 时左统计显示“共 N 条”，不再出现“已选 0 项”；批量条动作改为始终从 `resolveToolbarActions` 过滤 batch*（默认组合仍含 batchDelete；页面只声明 create/import 时不出现未声明的批量删除），`e2e:p7-4b` 仍 48、`e2e:p3` 仍 126。

### 25.4 未验证 / 边界

- 真实模型生成树/弹窗页面后的视觉；真实 AFCenter 宿主 `pm-*`、EOS 运行态、真实 3300；PNG 像素级比对；<768 移动端树/弹窗视觉。
- 未改后端 `src/**`、DB/表/迁移、schema/validate/API、`templates/**`、需求模板中心、开发视图/一致性检查规则、preview 业务；未新增依赖；未启停 3300/4771；未读写真实 `data/`、`projects/`、`.env`；未调模型；未做 git。

## 26. P8-1 实施记录（2026-11-20）：彻底移除旧版设计模板（1b）

> 用户决策：**不再兼容旧版设计模板**；设计阶段只用「应用类型 × 视觉风格 + 页面库」。
> 本单授权改 DB 表：`prototype_templates` 删除、`apps.prototype_template_id` 删除，5 表 → **4 表**；`apps>0` 仍 fail-closed。
> 本单不做真实模板预览（iframe，P8-2），设计视图仍是线框渲染，只是皮肤/数据来源改为设计系统风格。

### 26.1 结果

- **DB**：`NEW_TABLES` 4 张（`apps`/`app_settings`/`app_sessions`/`requirement_templates`）；`PRESERVED_TABLES` 只保留需求模板；删除原型模板表 DDL/索引与旧列；旧库判定新增「已删除表/列」分支；`apps>0` fail-closed。
- **后端删除**：`design/builtin-templates.ts`、`design/templates.ts`、`design/types.ts`；`DesignError` → `design/errors.ts`；`/api/prototype-templates` 及旧模板 CRUD/seed 全删。
- **应用/解析**：`POST /api/apps` 只处理需求模板 + 设计三键（旧 `prototypeTemplateId` 忽略 + warning）；payload 不再返回 prototype/legacy 字段；设计系统无三键时按默认 pack 解析；`GET /apps/:id/templates` 只返回需求模板。
- **参考包**：原型上传入参 `styleId`（属应用 pack 的风格）；manifest/tokens 写 `styleId`；`artifacts.tokens` 用 `styleId`。
- **分发**：删除旧原型模板 skill 生成与期望；保留 `adw-template-proto-<applicationType>` 设计模板 skill（manifest kind `design-system`）与团队/方法/需求模板 skill。
- **前端**：删除「旧版兼容」、旧原型模板徽标/列表/pick；`skinFromStyle`（`frontend/src/design/prototype/skin.js` + 3 例单测）由 `designSystem.style` 构造皮肤（topbar shell、风格 tokens）；`DesignPrototypePanel`/`PrototypeCanvas` 改 `skin` prop；`design-export` 用 `styleId`。
- **测试/脚本**：后端 133、前端 104、`e2e:p7-3b` 45→38；其余 e2e 保持；`smoke:workspace` 增加 4 表/无旧列断言。

### 26.2 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix backend`（临时目录） | **133 / 133** |
| `npm test --prefix frontend` | **104 / 104** |
| `typecheck` / `build` / `check:vue`（frontend） | 通过（2800 modules） |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型） |
| `npm run e2e:preview / p7-3b / p7-4b / p7-6a` | **77 / 38 / 48 / 15** |
| `npm run e2e:p2 / p3 / p4` | **116 / 126 / 128** |

### 26.3 偏差 / 未验证

- 迁移代码仍保留 `prototype_templates`/`prototype_template_id` 字面量（仅用于识别并删除旧库）；负数断言保留旧名作为删除证据。
- `e2e:p2` 3.2/3.2b 改为 `waitFor` 模板 skill/manifest 落盘（原有竞态；断言数仍 116）。
- 设计视图暂不渲染真实模板页面（P8-2）；旧库 `apps>0` 的 fail-closed 只有单测覆盖（未对真实库执行）。
- 未验证：真实 3300 切换后运行态、真实浏览器下新皮肤的人工视觉验收。

## 27. P8-2 实施记录（2026-11-20）：设计视图原型真实模板预览（Y）

> 用户决策：设计阶段原型要**按创建应用时选的设计模板真实呈现**。在 P8-1（旧版彻底删除）之后，把「设计模板中心/预览」的真实渲染接入设计视图「原型」Tab；复用 `preview.html`（pm-v3 + 模板页面 + 所选风格 CSS）。

### 27.1 结果

- **embed 参数**：`frontend/src/preview/preview-params.js#embedEnabled`（`embed=1`/`true`）；`PreviewApp.vue` 在嵌入时隐藏 `.preview-style-switch` 与 `.preview-badge`，`updateLocation` 保留 `embed`；type/style/page 解析/回退/标题逻辑不变。
- **纯函数**：`workbench/design-template-helpers.js` 新增 `resolvePreviewTarget(page, applicationType, templatePages)`（`{pageId, valid, reason}`：`no-catalog-ref`/`invalid-catalog-ref`/`no-application-type`/`type-mismatch`/`page-not-found`）与 `buildEmbedPreviewUrl({applicationType, style, page})`（复用 `buildPreviewUrl` + `&embed=1`）；单测 +6（target 5 + embed URL 1）。
- **原型面板**：`DesignPrototypePanel.vue` 接收 `applicationType/styleId/templatePages`；`mode: 'preview' | 'wireframe'`，切页面/应用类型/风格或可预览性变化时默认可预览→预览、否则线框；`catalogRef` 为 `<applicationType>/<pageId>`，type 与应用一致且 pageId 在 `designSystem.pages` 中才启用；预览渲染 `<iframe data-testid="prototype-preview-frame">`（`buildEmbedPreviewUrl`），线框渲染原 `PrototypeCanvas`（缩放/导出不变）；无 catalogRef/解析失败显示「未认领模板页面，当前为线框；可在模板页面库查看模板真实页面」。
- **模式切换**：头部 `prototype-mode-preview`（仅可预览时出现）/`prototype-mode-wireframe`；预览模式隐藏缩放组、禁用 `export-png-btn` 并提示“PNG 为线框草图，可切到线框导出”；不重建工作台，只切面板内容。
- **导出边界**：`DesignView` 隐藏 `PrototypeCanvas`（`exportPage`）保持线框，`prototypes/*.png`、`tokens.json`、manifest（`styleId`）仍照常生成；预览模式不影响自动导出。
- **e2e**：新增 `backend/scripts/prototype-preview-e2e.ts` + `e2e:p8-2`（临时根/3445/stub；**28 条断言**）；`e2e:p7-4b` 进入原型后先点「线框」再跑原 48 条（断言数不变）；`e2e:preview` 增加 embed 段（**77 → 83**）。

### 27.2 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | **111 / 111**（原 104 + target/embed URL 6 + embed 参数 1） |
| `npm run typecheck / build / check:vue --prefix frontend` | 通过（build 2800+ modules；`dist/preview.html` 正常） |
| `npm test --prefix backend`（临时目录） | **133 / 133**（未改后端） |
| `npm run e2e:p8-2 --prefix backend` | **28 条断言**；端口 3445 已关闭 |
| `npm run e2e:p7-4b --prefix backend` | **48**（先切线框） |
| `npm run e2e:preview --prefix backend` | **83**（含 embed 隐藏切换器/角标） |
| `npm run e2e:p3 / p7-3b / p7-6a` | **126 / 38 / 15** |
| `npm run e2e:p2 / p4` | **116 / 128** |

截图：`C:\Users\icecream\AppData\Local\Temp\workbench-p8-2-shots\`（`p8-2-preview.png`、`p8-2-wireframe.png`）。

### 27.3 偏差 / 边界

1. **真实预览只代表“模板视觉基准”**：iframe 展示模板 pack 的页面（如 `enterprise-application-platform/organization`），**不按 `design.json` 字段/列/操作重绘 pm-v3**；字段差异仍由线框（P7-4b）体现。完全所见即所得（design.json → 真实组件）为 Y2，未做。
2. `catalogRef` 只认当前应用类型的页面库；跨类型/不存在 → 线框 + 提示；页面 chips 仍来自 `design.json`。
3. 预览模式风格固定为应用设计系统的 style（不允许在原型 Tab 改风格；改风格走设计模板中心/PATCH）；缩放组仅线框模式显示。
4. `preview.html` 单页仍保留 embed 参数（刷新不丢）；不新增依赖、不改后端 `src/**`/DB/表/`templates/**`/需求模板中心。
5. 未验证：真实 AFCenter 宿主 `pm-*`、EOS 运行态、真实 3300、<768 移动端布局与 iframe 内交互（模板页面 mock 数据，非真实业务）。

## 28. P9 实施记录（2026-11-20）：设计产物模板原生真实渲染（Y2 一期）

> 用户决策：设计产物 `design.json` 必须用**创建应用时选择的设计模板**（应用类型 structure + 视觉风格）渲染——结构、组件、视觉都与模板一致。P8-2 的 `preview.html` iframe 展示的是“模板自带页面”（如运营组织台账），不是 `design.json`；P9 改为新增**设计产物模板原生渲染器**（P8-2 的模板页面预览与 `e2e:p8-2` 已删除）。
>
> 本期覆盖 **list / tree-list / page-form / dialog-form**（正好覆盖 app1 四页）；detail / dashboard / main-sub / wizard 回退 P7-4b 线框；PNG 仍是线框草图（真实产物 PNG 未做，Y2 二期）。

### 28.1 契约 → 模板结构 / 组件映射

| 契约（`design.json` 页面） | 模板结构 / 组件（P9 渲染器） |
| --- | --- |
| 页面 recipe（或 catalogRef 指向页面配方；缺失按 page.type 推断） | 配方分发：`list` / `tree-list` / `page-form` / `dialog-form`；其余显示“该配方暂未支持模板风格渲染”并回退线框 |
| 顶层 `designSystem.applicationType/style` | 根 `visual-style-host visual-style-<styleId>` + 内层 `optimized-suite application-type-<短类名>`；注入 `structureLoaders[type]` 的 `structure.css`（复用 `preview/registry.ts` 的 `shared.css` + 4 套 `style.css`） |
| `columns`（`layout.table.columns`） | `pm-table` 列；`minWidth/width` 按字段类型；实体不存在的列**跳过并提示**；首个枚举列用模板 `status-chip` |
| `filters`（`layout.table.searchFields`） | `pm-search` + `#body` 的 `el-form-item` + 按字段类型的 `pm-input/pm-select/pm-number/pm-datepicker` |
| `toolbarActions` / `rowActions` / `selection` / `pagination` | `resolveToolbarActions`/`resolveRowActions`/`resolveSelection`/`paginationModel`（复用 `design/prototype/contract-view.js`）→ `pm-toolbar`+`pm-toolbar-item`、操作列、`pm-table checked`+批量条、`pm-pagination`（页脚显示已选/总数/每页条数） |
| `tree.titleField/parentField/actionStyle/selectionStyle` | 左 `org-tree-panel` + `pm-tree`；无 `parentField` 或匹配不到 → 按 `titleField` 去重扁平 + 提示；`actionStyle/selectionStyle` 用模板类/变量体现 |
| `form.groups/fields/columns/width/presentation` | `page-form`：`page-heading` + `panel.form-panel` + `form-section`/`form-grid`（columns=1/2）；`dialog-form`：背景列表 `panel` + `pm-form-dialog`（`dialogVisible=true`，`width` clamp 360–900）内 `#form` 插槽渲染分组字段 |
| 页面 `components`（`pm-*` 覆盖） | `controlFromComponent` → pm 控件：`pm-input/pm-textarea/pm-number/pm-switch/pm-datepicker/pm-select/pm-radio/pm-checkbox/pm-upload/pm-image/pm-select-user/pm-select-org`；未知控件回退类型/命名推断 |
| 数据 | **确定性本地 mock**（按索引/字段类型/options；无 `Math.random`），不连平台/EOS |

### 28.2 入口与面板

- 新入口：`frontend/design-preview.html` + `src/design-preview/main.ts`（Element Plus zh-cn + `registerPmV3` + `installPmMock`）+ `DesignPreviewApp.vue`；`vite.config.ts` 多入口；后端 `GET /design-preview.html`（与 `/preview.html` 同一独立入口分支：**缺失 404、不回落 index**）。
- URL：`?app=&module=&page=&type=&style=&embed=1&v=<designHash>`；同源 `GET /api/apps/:id/artifacts` → `adaptDesign` → 指定 page/entity（另读 `/design-system` 只用于配方推断）；无设计/页面/实体 → 明确错误态，不白屏。
- 面板：`DesignPrototypePanel` props 增加 `appId/designHash/designLabel`；默认模式 `supportsTemplateRender`（显式 `recipe`/`catalogRef` 且配方受支持）→「模板风格」，否则「线框」；`buildDesignPreviewUrl` 纯函数；testid 沿用 `prototype-mode-preview`/`prototype-mode-wireframe`；模板模式禁用 PNG 导出；提示“PNG 仍是线框草图”。
- 保留：模板中心/页面库仍用 `preview.html`（`embed` 保留）；PNG 自动导出仍走 `DesignView` 隐藏线框画布。

### 28.3 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix backend`（临时目录） | **133 / 133** |
| `npm test --prefix frontend` | **131 / 131**（新增 `contract-preview` 24 + helper URL/模式 3，替换 P8-2 target/embed 5） |
| `npm run typecheck / build / check:vue --prefix frontend` | 通过；`dist/design-preview.html` 产出 |
| `npx tsc -p backend/tsconfig.json --noEmit` | 通过 |
| `npm run e2e:p9 --prefix backend` | **57 条断言**（新增；端口 3446 已关闭） |
| `npm run e2e:p7-4b --prefix backend` | **48**（每次切页后先点「线框」） |
| `npm run e2e:p3 --prefix backend` | **126**（旧设计无契约仍默认线框） |
| `npm run e2e:preview / p7-3b` | **83 / 38** |
| `npm run e2e:p2 / p4` | **116 / 128** |

截图：`%TEMP%\workbench-p9-shots\`（`p9-tree-list.png`、`p9-list.png`、`p9-dialog-form.png`）。

### 28.4 偏差 / 边界

1. 本期只覆盖 list/tree-list/page-form/dialog-form；detail/dashboard/main-sub/wizard 回退线框 + 提示。
2. **PNG 仍是线框草图**；真实产物 PNG 截图与像素比对未做（Y2 二期）。
3. tree-list 的 `org-ledger-shell/org-tree-panel/ledger-*` 外观规则按模板同款在渲染器 scoped CSS 内声明（模板页面的这些规则原本在组件 scoped 中，未进 `structure.css`；`templates/design-system/**` 只读未改）；模板页断点 1080px、`structure.css` 通用网格 960px，在 ~800px iframe 内都会单列，渲染器把网格断点降到 720 以保留双栏。
4. 交互为展示级 mock（搜索/分页/选择/操作只改本地状态并 ElMessage 提示）；`pm-form-dialog` 以 `modal=false`+`append-to-body=false` 渲染，保证遮罩不挡页面且继承风格变量。
5. 未改 DB/表、API 语义、`templates/**`、需求模板中心、`preview.html` 业务；未新增依赖；未启停真实 3300。

## 29. P10 实施记录（2026-11-20）：detail/dashboard 模板化 + 真实模板风格 PNG

> 用户决策：设计产物与所选模板一致，**PNG 也要一致**。在 P9 基础上：① 模板渲染支持 `detail`/`dashboard`；② 设计参考包 PNG 改为模板风格截图（iframe 内 html2canvas 自截）；main-sub/wizard 与旧无契约设计仍用线框兜底。

### 29.1 detail / dashboard 模板

| 项 | 说明 |
| --- | --- |
| 支持集合 | `list / tree-list / page-form / dialog-form / detail / dashboard`；`main-sub` / `wizard` 仍回退线框 |
| dashboard | `page-heading` + `metrics-grid`/`metric-card`（记录总数 + 最多 2 个数值字段合计 + 枚举种类，不足 3 张补占位）+ `panel` + `pm-echarts`（枚举饼图优先，否则数值柱图，`animation:false`）+ 最近记录 `pm-table`；无实体/字段为空态 |
| detail | `page-heading`/`title-line`/`status-chip` + `detail-hero` + `detail-grid` + `info-grid`/`info-item` + `timeline` + 可选子表 `pm-table`（多子表本地页签）；状态取首个枚举（优先名称含“状态”）；时间线只用实体创建/更新时间，缺失显示“暂无动态”；子表按 `layout.subTables.target` 在模块实体池解析，未知 target 跳过并提示 |
| 纯函数 | `buildDashboardModel` / `buildDetailModel` / `statusClassOfValue`；确定性 mock（无 `Math.random`），契约缺失回退实体字段，不抛错 |
| 图表 | option 形如 `{ chartView: {...}, ... }` 适配 `pm-echarts`；主色来自视觉风格 tokens（`DesignPreviewApp` 计算并传入） |

### 29.2 PNG：模板风格真实截图

- `design-preview` 新增 `capture=1&rid=`：隐藏 `.contract-notes`/角标，根节点 `is-capture`（整页展开、禁用动画）；加载完成（`structure.css` + `document.fonts.ready` + 2×rAF + 等待 chart canvas + ~300ms）后向父窗口 `postMessage({source:'adp-design-preview',type:'ready',id,pageId})`。
- 父窗口发 `{source:'adp-design-view',type:'capture',id,scale}`；iframe 内 `html2canvas(.optimized-suite)` → 回 `{type:'png',dataUrl,width,height}` 或 `{type:'error',message}`；`onclone` 把 html2canvas 不支持的 `color(srgb …)`（模板 `color-mix` 计算值）替换为可解析颜色。
- 新增 `frontend/src/design/template-capture.ts`：动态隐藏 iframe（1440×900、移出视口），`shouldTemplateCapture(page, templatePages)` 判定；逐页 `ready → capture → png`，20s 超时；解码后 >5MB 用 `scale=1` 重试；无论成败清理 iframe/监听。
- `DesignView#runExport`：支持模板渲染 → `captureTemplatePage`；否则/失败 → 现有隐藏 `PrototypeCanvas` + `captureElementPng`；回退页 `console.warn`（手动模式额外提示），不中断整包；hash 比对、409 防抖、自动/手动逻辑不变。
- `DesignPrototypePanel`：模板模式也允许「导出 PNG」，按钮 emit `export` 由 DesignView 整包导出（不再本地只导当前页）；提示“模板风格截图；不支持配方为线框”。

### 29.3 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix backend`（临时目录） | **133 / 133** |
| `npm test --prefix frontend` | **141 / 141**（+10：dashboard/detail/status） |
| `npm run typecheck / build / check:vue --prefix frontend` | 通过 |
| `npm run e2e:p10 --prefix backend` | **54 条断言**（新增；端口 3447 已关闭；overview.png 2880×1996，含 data-cyan 主色像素） |
| `npm run e2e:p9 / p7-4b / p3 --prefix backend` | **67 / 48 / 126**（PNG 导出断言改为整包重写） |
| `npm run e2e:preview / p7-3b / p2 / p4` | **83 / 38 / 116 / 128** |

证据：`%TEMP%\workbench-p10-shots\`（`p10-dashboard.png`、`p10-detail.png`、`p10-overview.png`、`p10-product-detail.png`）。

### 29.4 偏差 / 边界

1. main-sub/wizard 未模板化；PNG 页面级可混合（模板截图 + 线框兜底），manifest 不区分。
2. html2canvas 1.4.1 不支持 `color(srgb …)`；截图克隆时降级颜色解析，**只影响截图，不影响预览**。
3. 未改后端 `src/**`（含开发 prompt/应用 AGENTS/skill 的“PNG 线框草图”文案，属硬边界；仅更新 `AGENTS.md`/README/docs 语义）、DB/表、`templates/**`、需求模板中心、模板中心/`preview.html` 业务、P9 list/tree/form 行为。
4. `prototypes/*.png` 语义更新为“模板风格截图（不支持配方/旧设计为线框）”；fidelity 仍只查 manifest/designHash，不做像素比对。

## 30. P10b 实施记录（2026-11-20）：所有显式契约页面模板风格兜底 + PNG 文案同步

> 用户要求：不支持配方（main-sub / wizard / 未知显式 recipe）也要尽量跟模板风格一致，不要默认灰阶线框；PNG 文案一致。
> 结论：**任何有显式契约（`recipe` / `catalogRef` / `blueprint`）的页面都走模板风格渲染与模板截图**；未知/无映射配方按 `page.type` 映射到通用模板页；**只有无任何显式契约的旧设计才默认线框**（P11 起自动显示「结构草图（无契约）」，UI 不再提供手动切换，见 §31）。

### 30.1 支持判定与配方映射

| 项 | 说明 |
| --- | --- |
| 支持集合 | `TEMPLATE_RENDER_RECIPES` = list / tree-list / page-form / dialog-form / detail / dashboard / **main-sub** / **wizard** |
| 显式契约 | `hasExplicitContract(page)` = `recipe || catalogRef || blueprint` |
| 支持判定 | `supportsTemplateRender(page)` = `hasExplicitContract(page)`（不再限制配方列表）；`prototypeModeFor` 不变 |
| 配方映射 | `resolveContractRecipe`：显式且受支持 → 原样；显式但未知/不受支持 → 按 `page.type`（form→page-form、list/tree-list→list、dashboard→dashboard、其余含 workspace/permission/workflow→detail）；无 recipe 有 catalogRef → 模板页配方（受支持才用，否则按 type）；其余按 type；**最后兜底 detail**，返回值总在支持集合内 |
| 面板提示 | 无显式契约：“该页面无显式设计契约，默认线框；模板风格需要 recipe / catalogRef / blueprint”；缺应用设计模板：“当前应用缺少设计模板…暂用线框” |

### 30.2 main-sub / wizard / 通用兜底

- **main-sub**：`page-heading` + `panel.form-panel`（`ContractFormFields` 分组）+ 子表 `panel`（`pm-table`；多个子表用 `contract-subtabs` 页签）。子表来源 `buildDetailModel(...).subTables`（按 `layout.subTables` 在本模块实体池解析，未知 target 跳过并提示）；无实体/无子表给空态。
- **wizard**：`page-heading` + `pm-steps`（options 来自 `buildForm(...).groups`，label 用组标题，缺省“步骤 N”）+ 当前分组 `panel.form-panel`（`ContractFormFields` 新增 `onlyGroup`，只渲染当前组）+ 底部上一步/下一步/提交（本地 notify，展示级）。无实体/无字段给空态。
- **通用兜底**：`v-else` 改为模板 detail 通用页（`page-heading` + `panel` + `info-grid` 字段/值或空态）；**不出现 `wf-*` 灰阶线框**，也不再出现“该配方暂未支持模板风格渲染”（该分支仅防御，正常不会命中）。
- **PNG**：`shouldTemplateCapture` 跟随新判定 → main-sub / wizard / 未知契约页都模板截图；无契约旧设计/截图失败才回退线框。

### 30.3 文案同步

应用 AGENTS（`backend/src/apps/scaffold.ts`）、开发 prompt（`backend/src/chat/service.ts`，3 处）、开发视图首条提示（`backend/src/dev/service.ts`）、ui-check 骨架（`backend/src/dev/ui-check.ts`）、设计模板 skill（`backend/src/templates/distribution.ts`）、开发方法 skill（`templates/agent/skills/adw-frontend-implementation/SKILL.md` + `scripts/lib/fidelity-core.cjs` + `scripts/check-fidelity.mjs`）、`check-design-fidelity` command、`adw-design-artifacts` skill、`templates/afc-remote/README.md`：PNG 统一表述为“**模板风格截图（无显式契约的旧设计为线框）**”，优先级顺序不变。

### 30.4 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | **142 / 142** |
| `npm run typecheck / build / check:vue --prefix frontend` | 通过（2818 modules） |
| `npm test --prefix backend`（临时目录） | **133 / 133** |
| `node node_modules/typescript/bin/tsc -p backend/tsconfig.json --noEmit` | 通过 |
| `npm run e2e:p10 --prefix backend` | **78 条断言**（main-sub 分组/子表页签、wizard pm-steps/步骤切换、未知+仅蓝图 → 模板且无 wf-page、manifest 6 页、main-sub PNG 2880×2002 含 data-cyan 主色） |
| `npm run e2e:p9 / p7-4b / p3` | **67 / 48 / 126** |
| `npm run e2e:preview / p7-3b / p2 / p4` | **83 / 38 / 116 / 128** |
| `npm run smoke:workspace / smoke:assets` | 通过（不调模型） |

### 30.5 偏差 / 边界

1. 未知显式 recipe 在设计预览侧先被 `design-adapter.js` 丢弃（soft warning）并保留 `blueprint`，实际走“仅蓝图 → 按 type 映射”；未知 recipe 映射本身由 `contract-preview.test.mjs` 覆盖。
2. `pm-steps` 点击步条不发 `update:modelValue`（模板组件现状）；wizard 用底部上一步/下一步切换，点击步条不作为验收项。
3. 未改 DB/表、PNG 写入 API、`templates/design-system/**`、需求模板中心、模板中心/`preview.html` 业务、P9/P10 已通过的 list/tree/form/detail/dashboard 行为（除支持判定扩展）；未新增依赖、未 npm install、未做 git、未启停真实 3300/4771、未读写真实 `data/`/`projects/`/`.env`、未调真实模型。
4. 真实 3300 前端静态托管刷新即生效；后端文案需用户自行构建重启。

## 31. P11 实施记录（2026-11-20）：设计视图移除「线框」切换，只保留设计产物

> 用户决策（方案 A）：设计视图不应让用户在线框/模板之间选；**只有「设计产物」**。旧灰阶线框仅作无显式契约的自动兜底与内部调试（`?prototype=wireframe`），不在 UI 暴露。§28/§30 中“可手动切换”的描述已被本节取代。

### 31.1 面板行为

| 项 | 说明 |
| --- | --- |
| 模式按钮 | 删除 `prototype-mode-preview` / `prototype-mode-wireframe` 与 `setMode`；UI 不再出现任何线框/模板切换 |
| 只读状态 | `data-testid="prototype-render-mode"`：有显式契约 → `设计产物 · 模板风格`；无契约 → `结构草图（无契约）`；调试 → `调试 · 结构草图`；缺应用设计模板 → `结构草图（缺设计模板）` |
| 内部模式 | `mode = debugWireframe ? 'wireframe' : (previewable ? 'template' : 'wireframe')`；`previewable` 仍 = 显式契约 + `appId/applicationType` 存在 |
| 调试入口 | 仅 URL query `?prototype=wireframe`（hash 前）；`e2e:p7-4b` 用该入口，切页保持结构草图 |
| 提示 | 模板：`当前为设计产物（按所选模板渲染，<类型 · 风格>）；导出 PNG 使用模板风格截图。`；无契约：`该页面没有显式设计契约（recipe/catalogRef/blueprint），显示结构草图；补齐契约后自动套模板。` |
| 缩放 / PNG | 缩放组仅结构草图显示；「导出 PNG」保持整包模板风格（无契约/失败线框），`DesignView` 自动/手动导出不变 |

### 31.2 e2e 与回归

| 命令 | 结果 |
| --- | --- |
| `npm run e2e:p7-4b` | **48**（`?prototype=wireframe` 进入；无模式按钮/调试标识并入 1.1/1.2） |
| `npm run e2e:p9` | **70**（删除切线框段；新增只读状态/无按钮/无 `wf-page`/无契约自动结构草图/缩放仅结构草图） |
| `npm run e2e:p10` | **79**（删除切线框段；同一类断言；PNG 宽高/主色/manifest 保持） |
| `npm run e2e:p3 / preview / p7-3b / p2 / p4` | **126 / 83 / 38 / 116 / 128** |
| `npm test --prefix frontend` / `backend` | **142 / 142** / **133 / 133** |

### 31.3 边界

未改模板/线框渲染器行为、PNG 导出服务、后端 `src/**`/DB/API、`templates/**`、需求模板中心、模板中心/`preview.html`；未新增依赖、未 npm install、未做 git、未启停真实 3300/4771、未读写真实 `data/`/`projects/`/`.env`、未调真实模型。

## 附录 A：页面契约字段速查

| 字段 | 说明 |
| --- | --- |
| `recipe` | list/tree-list/dialog-form/page-form/main-sub/detail/dashboard/wizard |
| `catalogRef` | 模板页面库引用：`<applicationType>/<pageId>` |
| `blueprint` | 蓝图 Vue 路径（pack 相对路径） |
| `filters` | 查询字段名数组 |
| `columns` | 列表列 |
| `rowActions` | detail/edit/delete/自定义 |
| `toolbarActions` | create/batchDelete/import/export/自定义 |
| `selection` | 是否多选 |
| `pagination` | `{ layout: bar|split|three-part, pageSize }` |
| `form` | `{ presentation: dialog|page, columns, width, fields, groups }` |
| `tree` | `{ titleField, parentField, actionStyle, selectionStyle }` |
| `subTables` | `[{ entity, title, columns, mode: tab|flow }]` |
| `components` | 字段 → pm 组件覆盖 |

## 附录 B：`ui-check.md` 模板

```md
# 页面对照表（MOD-001）

## 实现前

| 设计页 | 路由 | 蓝图 | 字段/列 | 操作 | 布局/交互 | 差异/决策 |
| --- | --- | --- | --- | --- | --- | --- |
| org-list | /organizations | OrganizationUsers.vue | 机构名称/编码/上级/负责人/状态 | 新增顶级/下级、编辑、删除、批量分配 | 左树右表、三段分页、多选 | 需求 §9 要求树；蓝图一致 |

## 实现后

| 设计页 | 实现文件 | 截图 | 一致项 | 差异 | 原因/处理 |
| --- | --- | --- | --- | --- | --- |
| org-list | src/views/OrganizationView.vue | docs/screenshots/01-org.png | 结构/列/操作/主色 | 筛选少“机构类型” | 需求未要求，已说明 |

## 未实现/待确认

- ...
```

## 附录 C：设计模板 skill 摘要

`adw-template-proto-<id>/SKILL.md` 应包含：

- 应用类型/视觉风格/pack 版本；
- 页面库与蓝图路径；
- 两个团队 skill 相对路径：`../afcenter-page-generation/SKILL.md`、`../pm-components-usage/SKILL.md`；
- 页面配方与组件映射；
- conformance 清单；
- 设计/开发各自的读取顺序；
- 冲突上报与 `ui-check.md` 要求；
- 边界：EOS 后端不吃风格；不修改受管资源。
