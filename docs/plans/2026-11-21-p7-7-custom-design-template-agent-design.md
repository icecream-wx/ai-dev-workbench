# P7-7 自定义设计模板（模板工作室）设计稿

> 状态：**设计稿（待评审）**，2026-11-21；**P7-7a、P7-7b-1、P7-7b-2a、P7-7b-2b、P7-7c-1、P7-7c-2 已实施（待评审）**，
> **P7-7 全部分批已完成首轮实施并跑通真实模型闭环**（P7-7c-2 见文末实施记录）。
> **2026-11-23**：用户确认真实 3300 人工验收**全部通过**（**评审仍待定**；已确认事实与未采集项见文末「### 7. 人工验收（2026-11-23）」）。
> 设计稿本轮只写文档与 spike 证据；P7-7a 实施按 §15.1 落地（不改 DB 表/需求模板中心/真实实例）。
> 依据：`AGENTS.md`、`docs/STATUS.md`、`docs/plans/2026-11-20-phase1-handover-and-next-session-prompt.md`、
> `docs/plans/2026-11-19-design-template-and-dev-linkage-p7-design.md`（第 14—31 节）、
> 以及 `docs/plans/evidence/2026-11-21-p7-7-spike/` 的 A—F 证据。
>
> 当前基线（只读事实）：P7-7b-2b 后后端 **219/219**、前端 **172/172**（P7-7b-2a 为 219/170；设计稿原始基线为 133/142）；
> `e2e:p10/p9/preview/p7-3b/p7-4b/p7-6a/p7-7b` = 79/70/83/39/48/15/**50**；`e2e:p2/p3/p4` = 116/126/128。
> 真实 3300/4771：**2026-11-20 曾监听**（PID 40704/41744，启动 16:15:08）；
> **2026-11-21 只读核对已无 LISTEN，`http://127.0.0.1:3300/api/health` 连接失败，PID 40704/41744 已不存在**；
> 本设计稿不启停，后续由用户 `restart.cmd` / `restart.sh`。

---

## 1. 状态与决策

### 1.1 本轮结论

用户目标：**模板中心 = 模板工作室**。用户在“自定义模板”里与 opencode agent 对话，agent 读取现有模板/页面/组件/风格，
自己组装出新模板；新模板与内置模板**完全同等**（模板中心可见、新建应用可选、scaffold/skill/设计视图/预览/PNG 全链路一致）。

本轮已拍板的产品决策（不重新推翻）：

1. **页面三种 kind，自定义模板可混用 `reference`/`contract`**：
   - `blueprint`：**内置 pack 页面**（内置 pack 无 `kind` 字段时按此兼容）；无 `source`；模板中心/内置页面库直接用 `preview.html` 预览；
   - `reference`：**自定义 pack 的引用页**；引用内置 4 套模板的 25 个页面；生成时复制蓝图/CSS/资产（**快照语义**），
     必须有 `blueprint` + `source` 溯源；
   - `contract`：**自定义 pack 的契约页**；用 `design.json` 页面契约的组件装配（`recipe` + filters/columns/rowActions/
     toolbarActions/selection/pagination/form/tree/subTables/components），**无 `.vue` 蓝图**，由 `ContractPage` 渲染，
     开发按契约 + PageTemplates + pm-* 实现。
2. **风格**：每个自定义模板只选 **1 套**内置风格（复制进模板包）；组件不受限（契约能力内 + reference 页面可带任意内置页面用到的组件）。
3. **草稿 + 显式发布**：agent 写草稿；用户点“发布”才进正式目录；编辑已发布模板 = 覆盖 + 版本号 +1；
   引用它的应用下次打开自动同步受管副本。
4. **每个自定义模板一个独立会话**（一个模板 = 一个 draftId = 一个 packId = 一个会话）。
5. 后续授权在临时环境跑一次**真实模型闭环**（本轮不跑）。
6. **不改 DB 表、需求模板中心、真实实例；不做 git。**

### 1.2 关键架构决策

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| agent 写什么 | **只写 `drafts/<packId>/spec.json`（+ 可选 `notes.md`）**；pack 由确定性生成器产出 | 降低出错面/权限面；agent 不直接改蓝图/CSS |
| 自定义模板类型 | 自定义 pack **只含 1 个 applicationType**，其 `id` **等于 pack id** | 复用现有 pack/selection/skill 命名；`adw-template-proto-<applicationType>` 天然唯一 |
| 工作区 location | 工作室根 `data/design-system/_workshop/`（共享 `.opencode`/catalog） | 复用现有 opencode location 机制；spike B 已验证 |
| 草稿 id | `draftId = packId`（自定义模板 id 不可变） | 一个模板一个会话、一个草稿目录；编辑/发布不换 id |
| 权限 | V2 `permissions` 数组：写全 deny + spec/notes allow；shell 只放行生成/校验脚本 | spike A 已验证配置可归一化、顺序保留 |
| 预览 | `blueprint`（内置页）→ 模板中心/页面库直接 `preview.html`；自定义 `reference` 页 → `preview.html`（内置源页 + 注入合并 structure CSS）；`contract` 页 → 新 `template-preview.html` 的 `ContractPage`；`template-preview` 不处理 `blueprint` | 不引入运行时 Vue 编译；快照页与内置源页字节一致 |
| 发布 | 原子落盘 + 版本补丁号 +1；应用下次打开同步 | 不做回滚/备份；不阻塞已打开应用 |

### 1.3 本轮 spike 摘要（详见证据目录）

| Spike | 结论 |
| --- | --- |
| A opencode 权限 | `permission.edit` 对象键支持 glob；2.2.5 归一化为有序 V2 `permissions`，`bash→shell`；last match wins；未做真实工具调用 |
| B 技能加载 | 临时工作区 `.opencode/skills` + `.opencode/commands` 可加载；**须先创建空会话**初始化 location（约 500ms） |
| B3 location 隔离 | 会话 location 设为子目录时**不加载祖先 `.opencode`**；本期采用共享 location，不采用每草稿 location |
| C catalog | 25 页 / 39 个组件并集 / **39 组件中 13 个可映射契约控件（共享 `component-controls.json` 20 键）**；pack 声明组件与蓝图扫描完全一致；可提取真实用法片段 |
| D CSS 合并 | 4 套共 793 条规则；按三元组去重可省 279 条；跨类型真冲突仅 3 条（pm-search-main/body、pm-upload-copy） |
| E contract 预览 | 直接复用前端纯函数，18/18 检查通过（列/查询/表单/树/驾驶舱/详情）；发现既有 `buildTreeRows` 重复子节点问题 |
| F ChatTarget | 强绑定不仅在 `chat/service.ts`，更在 `dev/service.ts`（前端实际走 `/development/*`）；建议扩展会话视图 `template` + 等价包装 |

### 1.4 与现有文档的关系

- 本设计是 P7 设计稿的**增量**：扩展 pack 模型与页面契约（第 3、6 节），不改 P9/P10/P10b/P11 的“设计视图只展示设计产物”口径。
- 内置 pack、需求模板中心、`design.json` 既有字段、PNG 截图协议继续有效；自定义模板只是**新增来源**。
- P7-7a/b/c 完成后需在 `docs/STATUS.md` 与交接单写清命令、结果、偏差、未验证项。

---

## 2. 目标与非目标

### 2.1 目标

1. 模板中心可**新建 / 编辑 / 发布 / 删除**自定义设计模板；自定义模板与内置模板在 UI/新建应用/工作区/预览/PNG 上同等。
2. 自定义模板可**混用** `reference` 页与 `contract` 页；内置页以 `blueprint` 语义存在；reference 页复制蓝图/资产（快照），contract 页无 `.vue` 蓝图。
3. agent 通过工作室会话读 catalog、写 `spec.json`；生成器把 spec 确定性转成 pack；用户显式发布。
4. 发布后：模板中心可见、新建应用 picker 可选、`scaffold` 生成 `design-system.json`/蓝图/契约/样式/skill，
   设计视图徽标与页面库、开发视图 digest/ui-check/fidelity 全部识别。
5. 编辑已发布模板：覆盖同名 pack、版本补丁号 +1；引用应用下次打开自动对齐受管副本。
6. 删除自定义 pack：被应用引用时 **409 + 应用列表**；内置 pack 不可删。
7. 全链路无 DB 表变更、无需求模板中心变更、无 git 操作。

### 2.2 非目标（明确不做）

- **块级自由拖拽/属性面板**；不提供任意 `pm-*` 属性编辑。
- **不生成 Vue 源码**（不把 pack 页面编译成新的 `.vue`；`blueprint` 是内置源，`reference` 只复制快照，`contract` 只写契约）。
- **不导入/导出 zip**；不做模板市场/远程分发。
- **不改 DB 表**：不加表、不加列、不迁移 `app_sessions` / `app_settings`。
- **不改需求模板中心**（`TemplateLibraryDialog`、`requirement_templates`、`adw-template-req-*`）。
- **不做 git 操作**（init/commit/revert/status）。
- **不做版本回滚/历史备份/多实例并发/文件锁**；发布失败保持旧 pack，已复制到应用的文件不自动回滚。
- **不启停真实 3300/4771**；不读写真实 `data/`、`projects/`、`.env`；本轮不调模型。
- **不做旧应用数据兼容**；不迁移已存在的自定义 pack（此前不存在）。

---

## 3. 现状与差距

### 3.1 后端 pack / 设计系统

| 文件/函数 | 现状 | P7-7 缺口 |
| --- | --- | --- |
| `backend/src/design/pack.ts#DesignPageMeta` | `id/name/type/recipe/preview/description/blueprint/components/blocks` | 无 `kind/source/contract/sampleEntity/sampleSubEntities`；`blueprint` 必填；内置页无 kind |
| `pack.ts#parsePack` | 每个页面都 `resolvePackAsset(blueprint)`，文件不存在即 400 | contract 页无 `.vue`（允许“无蓝图 + 有契约”）；内置页缺省 kind 按 `blueprint` 兼容 |
| `pack.ts#findPackDir` | 先内置 `templates/design-system`，再自定义 `<dataDir>/design-system` | 无写入/发布/删除；`_workshop` 目录因无 `pack.json` 被忽略（可复用） |
| `pack.ts#packCache` | 按 `pack.json` mtime 缓存 | 发布后需 `clearDesignPackCache()` |
| `design/system-file.ts#DesignSystemSummary` | 页面必有 `blueprint`；只有 `structure/styles/pages/skills` | 无 `origin/preview`；无 contract 页/契约文件 |
| `system-file.ts#copyTypeFiles` | 复制选中类型全部蓝图 + `structure.css` + `assets` + 风格 | 无 contract 页；无合并 structure（自定义 pack 只有一个 type，但 structure 来自多来源） |
| `design/system-routes.ts` | 只读 `GET /api/design-system`、`/:packId` | 无资产接口、无自定义 pack 删除/发布 |
| `apps/design-system.ts#resolveDesignSelection` | 校验 pack/type/style 存在 | 自定义 pack 可被选中（类型 id = pack id），需要 origin/preview 语义 |
| `apps/scaffold.ts#opencodeJson` | 写 V1 `permission.edit` 对象 | 应用不变；工作室用 V2 `permissions` |
| `templates/distribution.ts#designTemplateSkillId` | `adw-template-proto-<applicationType>` | 自定义 type id = pack id 时天然唯一；skill 内容需支持 contract 页 |
| `distribution.ts#ensureWorkspaceAssets` | 按 `app_settings` 对齐 `design-system.json`/蓝图/skill | 需对齐 contract 文件与合并 structure；自定义 pack 版本变化时覆盖 |

### 3.2 会话 / 对话

- `backend/src/chat/service.ts`：`ChatApp {id,name}`、`appDirOf`、`ensureWorkspaceAssets(app.id)`、
  `expectedSkillIds(appId)` + 固定 `EXPECTED_COMMANDS`、`Record<AppView,...>` 只有三视图。
- `backend/src/sessions/store.ts`：`AppView` 三值联合；`app_id` 无 FK；`view` 是 TEXT（可加 `template`，无迁移）。
- `backend/src/dev/service.ts`：**前端实际使用的会话/时间线/prompt 入口**（`AgentChatPanel` 调 `/development/*`），
  同样按 `appOrThrow`/`appDirOf` 强绑定；只抽 `chat/service.ts` 不够。
- `apps/routes.ts#POST /:id/chat` 与 `dev/routes.ts` 都以 `req.params.id` 作为 app id。
- 前端 `AgentChatPanel.vue` props 只有 `appId/view/moduleKey`，内部固定 `dev/api.ts`；`dev/types.ts#AppView` 三值。

### 3.3 前端模板中心 / 预览

| 文件/函数 | 现状 | 缺口 |
| --- | --- | --- |
| `DesignTemplateCenter.vue` | browse/picker；自定义卡片 **disabled“即将支持”**；只读内置 pack | 自定义模板列表/创建/编辑/删除/工作室入口/自定义 pack 预览 |
| `design-template-helpers.js` | 按 `pack.applicationTypes[].pages` 分组/计数/预览 URL | 无 `kind` 区分；自定义 pack 只有一个 type；页面库需显示 `blueprint`/`reference`/`contract` |
| `shared/design-system-api.ts` | list/get/app design system | 无 draft/publish/asset/studio API |
| `preview.html` + `frontend/scripts/generate-preview-templates.mjs` + `preview/registry.ts` | **构建期**复制内置 pack 并生成静态 registry | 无法在运行时渲染任意 pack 的 `.vue`；自定义 reference 页只能映射到内置源页 |
| `design-preview.html` + `DesignPreviewApp.vue` | 从 `registry` 取 `structureLoaders[type]` 与 4 套风格 CSS；读 `/api/apps/:id/artifacts` | 自定义 pack 的 type id 不在 registry；需新增“按 pack 取 structure/style 资产”的加载方式 |
| `contract-preview.js` / `ContractPage.vue` | 已支持 8 配方、列/查询/操作/树/表单/子表/驾驶舱/详情；确定性 mock | contract 页需要 `sampleEntity` 才能脱离应用预览；树重复子节点既有问题 |
| `backend/src/index.ts` | `/preview.html`、`/design-preview.html` 独立入口 | 需要 `/template-preview.html` |

### 3.4 应用闭环

- `scaffold`/`ensureWorkspaceAssets` 只处理“一种类型 + 全部页面有蓝图”；contract 页没有蓝图会直接失败/缺文件。
- 设计模板 skill 页面表默认把 `blueprint` 当必有列；`blueprint`/`reference` 页按蓝图，contract 页需要标注“无蓝图，按契约实现”。
- 开发 prompt/AGENTS/skill/digest/ui-check 的优先级与文案只覆盖蓝图页；contract 页需要明确“读 `contracts/<page>.json` + design.json”。
- `fidelity-core.cjs` 的 `blueprint-files` 会把 contract 页判为缺失；需要跳过或改为校验契约文件。
- 设计视图徽标只显示 `类型 · 风格`；自定义 pack 需要显示模板名/版本。
- 新建应用 picker 只列内置 pack；摘要只认识内置类型。

### 3.5 明确不存在的“旧路”

- 没有旧版原型模板/legacy 分支（P8-1 已删）；本设计不恢复。
- 没有运行时 Vue 编译/动态 import 任意 `.vue` 的能力；不新增该能力。
- 没有模板写入 API；`data/design-system` 目前只有读取方。

---

## 4. 总体架构

```text
┌─────────────────────────────────────────────────────────────────────┐
│ 模板中心 / 工作室 UI（frontend）                                      │
│  设计模板中心：内置 pack 卡片 + 自定义模板卡片 + 新建/编辑/删除        │
│  工作室：左（页面/ spec/校验） 中（AgentChatPanel） 右（预览 iframe） │
└───────────────┬─────────────────────────────────────────────────────┘
                │ HTTP（/api/design-templates/*、/api/design-system/*）
┌───────────────▼─────────────────────────────────────────────────────┐
│ 后端（backend/src/design-template/*）                                │
│  workshop：工作室资产（AGENTS/opencode.json/.opencode/catalog）       │
│  draft：draft.json + spec.json + notes.md + pack/ + generation.json  │
│  generator：spec → pack（校验/复制/CSS 合并/原子写/pack 校验）        │
│  publish：发布/版本/引用检查/删除保护                                 │
│  studio：ChatTarget + 会话/prompt/事件/权限/表单（复用 sessions store）│
└───────────────┬─────────────────────────────────────────────────────┘
                │ 文件（单一事实源）
┌───────────────▼─────────────────────────────────────────────────────┐
│ data/design-system/                                                  │
│   _workshop/AGENTS.md、opencode.json、.opencode/{skills,commands,scripts}│
│   _workshop/catalog/{index,pages,components,styles,recipes}.json      │
│   _workshop/drafts/<packId>/{draft.json,spec.json,notes.md,pack/,...} │
│   <packId>/（已发布 pack，与内置 pack 同构）                          │
└───────────────┬─────────────────────────────────────────────────────┘
                │ 新建应用/打开应用
┌───────────────▼─────────────────────────────────────────────────────┐
│ 应用工作区（projects/<app>/）                                         │
│  docs/design/design-system.json（含 preview 映射/origin）             │
│  docs/design/template/<customType>/{structure.css,pages/*.vue,assets,contracts/*.json}│
│  docs/design/template/styles/{shared.css,<styleId>/style.css}         │
│  .opencode/skills/adw-template-proto-<customType>/（页面库/契约说明）  │
│  frontend/（MF remote；开发按 reference 蓝图 + contract 契约实现）     │
└─────────────────────────────────────────────────────────────────────┘
                │ 设计视图/PNG
┌───────────────▼─────────────────────────────────────────────────────┐
│ design-preview.html：design.json + 自定义 pack 的 structure/style      │
│ prototypes/*.png：同 iframe 内 html2canvas 截图（协议不变）            │
└─────────────────────────────────────────────────────────────────────┘
```

职责边界：

- **agent**：读 catalog / 现有 spec / pack，写 `spec.json`（+ notes）；**不写 pack、不发布**。
- **生成器**：spec → pack 的唯一写者；确定性、可重跑、失败清理。
- **publish**：只由 UI/API 用户动作触发；校验 id/version/引用；原子替换。
- **应用侧**：只读 pack，写受管副本；不反向修改 pack。

---

## 5. 模板包模型

### 5.1 自定义 pack 的形态

自定义 pack = **一个** applicationType：

```jsonc
{
  "schemaVersion": 1,
  "id": "supplier-hub",                 // pack id（不可变，= applicationType id = draftId）
  "name": "供应商管理模板",
  "version": "1.0.0",                   // 首次发布；每次发布 patch +1
  "defaultApplicationType": "supplier-hub",
  "defaultStyle": "data-cyan",
  "origin": {
    "kind": "custom",
    "draftId": "supplier-hub",
    "builtFrom": { "pack": "afcenter-app-templates-v1", "version": "1.0.0" },
    "baseApplicationType": "enterprise-application-platform",
    "style": "data-cyan",
    "revision": 1,
    "specHash": "sha256:...",
    "publishedAt": "2026-11-21T10:05:00.000Z"
  },
  "applicationTypes": [
    {
      "id": "supplier-hub",
      "name": "供应商管理模板",
      "category": "custom",
      "description": "...",
      "structure": "application-types/supplier-hub/structure.css",
      "assets": ["application-types/supplier-hub/assets/ledger-workflow.svg"],
      "defaultStyle": "data-cyan",
      "pages": [ /* 见 5.2 */ ]
    }
  ],
  "styles": [
    {
      "id": "data-cyan",
      "name": "数据蓝青",
      "className": "visual-style-data-cyan",
      "css": "styles/data-cyan/style.css",
      "description": "蓝青冷色、卡片层次、轻网格和偏数据科技的视觉表达。",
      "signature": "#145fba",
      "tokens": { "primary": "#145fba", "accent": "#07858d", "neutral": "#66758a", "background": "#f3f7fb", "radius": 12, "density": "compact" }
    }
  ],
  "skills": ["afcenter-page-generation", "pm-components-usage"],
  "componentMap": { /* 从内置 pack 复制 */ },
  "pageRecipes": { /* 从内置 pack 复制（8 配方） */ },
  "conformance": [ /* 从内置 pack 复制 */ ]
}
```

内置 pack 不带 `origin`；自定义 pack 的 `origin.kind = "custom"`。`applicationTypes` 长度必须为 **1**，
其 `id` 必须等于 pack id；`defaultApplicationType = id`；`styles` 长度必须为 **1**，`defaultStyle = 该风格 id`。

### 5.2 页面模型

```jsonc
// blueprint 页（内置 pack；无 kind 字段时按此兼容）
{
  "id": "list",
  "name": "通知公告管理",
  "type": "list",
  "recipe": "list",
  "preview": "list",
  "description": "...",
  "kind": "blueprint",
  "blueprint": "application-types/operations-management/pages/OperationsList.vue",
  "components": ["pm-search", "pm-table", "pm-pagination"],
  "blocks": 8
}

// reference 页（自定义 pack 引用内置页）
{
  "id": "supplier-list",
  "name": "供应商列表",
  "type": "list",
  "recipe": "list",
  "preview": "list",
  "description": "供应商台账",
  "kind": "reference",
  "blueprint": "application-types/supplier-hub/pages/supplier-list.vue",
  "source": {
    "pack": "afcenter-app-templates-v1",
    "applicationType": "operations-management",
    "pageId": "list",
    "blueprint": "application-types/operations-management/pages/OperationsList.vue",
    "sha256": "..."
  },
  "components": ["pm-search", "pm-table", "pm-pagination"],
  "blocks": 8
}

// contract 页
{
  "id": "supplier-form",
  "name": "供应商表单",
  "type": "form",
  "recipe": "dialog-form",
  "preview": "form",
  "description": "新建/编辑供应商",
  "kind": "contract",
  "contract": {
    "filters": [],
    "columns": [],
    "rowActions": [],
    "selection": false,
    "pagination": { "layout": "bar", "pageSize": 10 },
    "form": {
      "presentation": "dialog",
      "columns": 2,
      "width": 900,
      "groups": [
        { "title": "基本信息", "fields": ["name", "code", "status"] },
        { "title": "扩展信息", "fields": ["owner", "amount", "remark"] }
      ]
    },
    "subTables": [],
    "components": { "owner": "pm-select-user" }
  },
  "sampleEntity": {
    "id": "supplier",
    "name": "供应商",
    "fields": [
      { "name": "code", "label": "供应商编码", "type": "string" },
      { "name": "name", "label": "供应商名称", "type": "string" },
      { "name": "status", "label": "状态", "type": "enum", "options": ["启用", "停用", "草稿"] },
      { "name": "owner", "label": "负责人", "type": "string" },
      { "name": "amount", "label": "年度金额", "type": "decimal" },
      { "name": "remark", "label": "备注", "type": "string" }
    ]
  },
  "components": ["pm-form-dialog", "pm-input", "pm-select", "pm-select-user", "pm-number", "pm-textarea"],
  "blocks": 0
}
```

规则：

- **kind 三值**：`blueprint`（内置 pack 页面）/ `reference`（自定义 pack 引用页）/ `contract`（自定义 pack 契约页）。
- **兼容规则**：内置 pack 的 25 页**没有 `kind`**，loader 把“缺省 kind + 有 blueprint”视为 **`blueprint`**（保持向后兼容，
  不得判内置 pack 非法，也不要求 `source`）。自定义 pack（`origin.kind=custom`）页面必须显式 `kind`，只能
  `reference`/`contract`；缺省 kind（无论是否有 blueprint）→ 400 `kind-required`。**spec 不允许写 `blueprint` kind**
  （内置页不需要组装；自定义引用页统一写 `reference`）。
- `blueprint`：仅内置 pack；必须有 `blueprint`，**不得有 `source`**。自定义 pack 不允许 `kind=blueprint`。
- `reference`：仅自定义 pack；必须有 `blueprint` 与 `source`（`source` 指向内置页）。
- `contract`：仅自定义 pack；必须有 `contract` 与 `sampleEntity`，**不得有** `blueprint`（loader 拒绝，避免两条事实源）。
- `source` 只允许内置 pack（`afcenter-app-templates-v1`）的 4 套类型页面；`sha256` 是生成时复制字节的哈希。
- `contract` 字段沿用 `design.json` 页面契约命名（P7-4a），全部可选；但 `recipe` 必须在 8 配方内。
- **contract 是模板容器，不是 design.json 页面结构**：生成器/预览在构造 **synthetic design / design.json 页面**时，
  把 `contract` 内的 `filters/columns/rowActions/toolbarActions/selection/pagination/form/tree/subTables/components`
  **逐项展平为设计页面顶层字段**（与 `design.json` 页面字段一致）；`pack.json` 仍保留 `contract` 容器用于溯源/编辑。
  注意命名空间：`pack.json` 页面顶层的 `components` 是**组件标签清单（string[]）**（现有 loader 字段），
  `contract.components` 是**字段→pm-* 覆盖（object）**；展平到 synthetic design 时后者成为设计页面的 `components` 对象，
  **不得覆盖 pack 页面的 string[] 清单**。顶层/容器不构成双份事实源：组件标签清单只服务 pack 元数据，
  字段覆盖只服务设计/预览。
- `sampleEntity` 仅用于模板预览；应用内设计仍以 `docs/design/<MOD>/design.json` 的实体为准。
- `sampleEntity.fields` 的 `name` 是**键**（列/查询/分组引用它），`label` 是显示名；
  `sampleSubEntities`（可选数组）用于 `subTables.target` 解析（见 §5.9）。
- `components` 由生成器计算：blueprint/reference = 源页面声明；contract = `contract.components` 值 + 配方默认组件并集。
- `blocks` 保持可选；custom 页可给 `0` 或省略。

### 5.3 页面 id / pack id 规则

| 对象 | 规则 | 说明 |
| --- | --- | --- |
| pack id | `^[a-z0-9][a-z0-9-]{0,63}$`（现有 `ID_PATTERN`） | 不可与内置/已发布自定义重复；**不可变**；即 applicationType id |
| draftId | = pack id | 一个模板一个草稿/会话 |
| page id | `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`（现有 `PAGE_ID_PATTERN`） | pack 内唯一；用于 `pages/<id>.vue` / `contracts/<id>.json` |
| 推荐 page id | blueprint：源页面 id；reference：`<source短名>-<sourcePageId>`；contract：`<业务>-<recipe>` | 生成器不强制前缀，但 catalog 与 skill 建议；避免仅 `index`/`list` 之类的宽泛名（自定义 pack 内） |
| 推荐 pack id | `<业务>-<类型>-<随机4位>`（如 `supplier-hub-7f3a`） | 避免与用户其它模板重名；UI 创建时自动生成、可编辑 |
| 名称→id | 只保留 ASCII 字母/数字/短横线并转小写；结果为空时生成 `custom-<4位随机>` | 中文名称不直接做 id；id 必须是 ASCII |
| 保留名 | `_workshop`、`_draft`、`assets`、`styles`、`application-types` | 仅作目录名，不能作为 pack id；page id 不受限但避免与目录名相同 |

### 5.4 已发布 pack 的目录结构

```text
data/design-system/<packId>/
  pack.json
  application-types/<packId>/
    structure.css                       # 合并后的结构样式
    pages/<PageId>.vue                  # 仅 reference 页（blueprint 页属于内置 pack，不复制）
    assets/<file>                       # 来源类型 assets 并集（+ 蓝图相对 import 的资产）
  styles/
    shared.css
    <styleId>/style.css                 # 从内置 pack 原样复制
```

与内置 pack 同构，`pack.ts` 的加载/路径安全/缓存规则直接复用。

### 5.5 版本与 origin

- 首次发布：`version = "1.0.0"`，`origin.revision = 1`。
- 每次发布（包括“无改动重新发布”）：`revision += 1`，`version = "1.0.<revision-1>"`。
- `origin.specHash` 是生成时 spec 的规范化哈希；发布前若 `spec.json` 已变化（hash 不一致）→ 409 `spec-changed`，
  必须先重新生成。
- `origin.publishedAt` 只在发布时写入；**`createdAt`/`updatedAt` 只存在 `draft.json`**，不进入 pack.json。
  生成阶段不写任何时间戳（`pack.json` 字节可复现）；只有发布时更新 `publishedAt/revision/version/specHash`。
- 同一 spec 重跑：`pack.json` 与页面/样式字节一致；只有 `draft/generation.json.generatedAt` 变化（非 pack 内容）。
- 名称/描述可改；pack id/page id **不可改**（改名会破坏应用引用与契约文件路径）。UI 只允许改显示名/描述。

### 5.6 风格

- 每个自定义 pack 只允许 1 套内置风格；生成器复制 `styles/shared.css` 与 `styles/<styleId>/style.css`。
- `styleId`/`className`/tokens 均沿用内置；本期不支持改 token（后续如支持，需要动态 style 资产接口，
  见第 11 节的风险与备选）。
- 应用级 `design-system.json.styles.styleId` 继续写内置风格 id，fidelity/PNG 语义不变。

### 5.7 componentMap / pageRecipes / conformance

- 从内置源 pack 原样复制（`componentMap` 14 条、`pageRecipes` 8 条、`conformance` 文本）。
- contract 页的 `components` 只覆盖字段控件（`form.components` / 页面 `components`），不允许自造组件名；
  生成器对 catalog 中不存在的 `pm-*` 给 warning（保留原值，不阻断，与 P7-4a 口径一致）。
- reference 页保留源页面组件，不做重映射。

### 5.8 spec 字段（agent 唯一写入口）

顶层：

| 字段 | 必填 | 规则 |
| --- | --- | --- |
| `schemaVersion` | 是 | 固定 `1` |
| `id` | 否 | 符合 pack id 规则；缺省由 `name` slug 化；创建草稿时后端已生成 |
| `name` | 是 | 1—100 字符；同时作为 pack/类型显示名 |
| `description` | 否 | ≤500 字符 |
| `baseApplicationType` | 否 | 必须是内置 pack 的应用类型；缺省取第一个 reference 的来源类型，否则企业级 |
| `style` | 否 | 必须是内置 pack 的风格 id；缺省内置默认风格 |
| `pages` | 是 | 1—40 个；顺序即 pack 页面顺序与 CSS 合并顺序 |

`pages[]`：

| 字段 | reference | contract | 规则 |
| --- | --- | --- | --- |
| `id` | 必填 | 必填 | `PAGE_ID_PATTERN`；pack 内唯一 |
| `name` | 必填 | 必填 | ≤100 字符 |
| `kind` | 必填 | 必填 | `reference` / `contract`（spec **不允许** `blueprint`；内置页由内置 pack 自身承载） |
| `source` | 必填 | 禁止 | `{pack, applicationType, pageId}`，来源页面必须存在 |
| `type` | 可省略 | 可省略 | 缺省 reference 取源页面；contract 按 recipe 推断 |
| `recipe` | 可省略 | 推荐 | reference 缺省取源页面；contract 缺省按 type 推断，必须在 8 配方内 |
| `contract` | 禁止 | 必填 | 页面契约对象，字段见 §5.2 |
| `sampleEntity` | 禁止 | 必填 | `{id,name,fields[]}`；字段至少 1 个；`name` 为键、`label` 为显示 |
| `sampleSubEntities` | 禁止 | 可选 | 子实体数组；用于 `subTables.target`（§5.9） |
| `description` | 否 | 否 | 缺省取源页面/生成默认 |
| `preview` | 否 | 否 | 缺省按 recipe 映射；仅展示用 |

生成器对未知字段/错误类型给 error（`spec-invalid`），对“字段不在 sampleEntity”等给 warning（§8.2）。
`blueprint` 只用于描述内置 pack 页面，不出现在 spec 的 pages 中。

### 5.9 `sampleEntity` / `sampleSubEntities`（contract 预览数据）

contract 页至少有一个主实体；子表/主子表/详情页需要额外实体池：

```jsonc
{
  "sampleEntity": { "id": "supplier", "name": "供应商", "fields": [/* name + label + type */] },
  "sampleSubEntities": [
    { "id": "supplier-contact", "name": "联系人", "fields": [
      { "name": "contactName", "label": "联系人", "type": "string" },
      { "name": "phone", "label": "电话", "type": "string" }
    ] }
  ],
  "contract": {
    "subTables": [{ "entity": "supplier-contact", "title": "联系人", "columns": ["contactName", "phone"], "mode": "tab" }]
  }
}
```

规则：

- `sampleEntity` 必填；`sampleSubEntities` 可选数组；`id` 在池内唯一，`fields[].name` 唯一。
- synthetic design 的 `entities = [sampleEntity, ...sampleSubEntities]`；`page.entity = sampleEntity.id`；
  `contract.subTables[].entity/target` 在同一池内解析。
- 子表目标解析不到 → warning `sample-sub-entity-missing`，预览跳过该子表并提示（不伪造）。
- 生成器把 `sampleSubEntities` 原样写入 pack 页；应用 scaffold 的 `contracts/<page>.json` 也带上（供开发参考）。
- P7-7a 测试必须覆盖：主实体 + 子实体、子表 target 命中/缺失、main-sub/detail 的 synthetic design。


---

## 6. Catalog 知识库

### 6.1 目的

让 agent “识别”现有模板：页面有哪些、每页什么配方/组件、组件真实写法、风格 tokens、配方支持情况。
catalog 是**派生只读数据**，不是事实源；真正事实仍是 builtin pack + 蓝图。

### 6.2 目录与文件

```text
data/design-system/_workshop/catalog/
  index.json          # 生成时间/hash/计数/来源 pack/版本
  pages.json          # 4 类型 × 25 页
  components.json     # 组件并集 + 引用次数 + 用法片段 + 契约映射
  styles.json         # 4 套风格 + tokens + css
  recipes.json        # 8 配方 + 模板组件 + 契约支持
  builtin/            # 内置 pack 的只读镜像（36 文件、约 580KB）
    afcenter-app-templates-v1/**
  examples/
    spec.example.json
    page-contract-list.json
    page-contract-tree-list.json
    page-contract-dialog-form.json
    page-contract-main-sub.json
```

**为什么需要 `catalog/builtin/`**：工作室 location 是 `_workshop`，内置蓝图在仓库
`templates/design-system/**`；`external_directory: deny` 会阻止 agent 读取仓库全文。初始化时把内置 pack
**原样复制**成只读镜像（36 文件、约 580KB，按 pack 版本/mtime+hash 刷新），catalog 的 `readPath` 指向镜像；
agent 始终在 location 内读取，`external_directory: deny` 保留。镜像只读（权限 deny edit），不参与发布。

### 6.3 字段

`pages.json[]`：

```jsonc
{
  "catalogRef": "operations-management/list",
  "pack": "afcenter-app-templates-v1",
  "packVersion": "1.0.0",
  "applicationType": "operations-management",
  "applicationTypeName": "运营管理",
  "pageId": "list",
  "name": "通知公告管理",
  "kind": "blueprint",
  "type": "list",
  "recipe": "list",
  "description": "...",
  "blueprint": "application-types/operations-management/pages/OperationsList.vue",
  "readPath": "catalog/builtin/afcenter-app-templates-v1/application-types/operations-management/pages/OperationsList.vue",
  "components": ["pm-search", "pm-table", "pm-pagination", "pm-toolbar"],
  "structure": "application-types/operations-management/structure.css",
  "structureReadPath": "catalog/builtin/afcenter-app-templates-v1/application-types/operations-management/structure.css",
  "assets": ["application-types/operations-management/assets/ledger-workflow.svg"]
}
```

`components.json[]`：

```jsonc
{
  "name": "pm-select",
  "category": "control",              // control | container | display
  "tagReferences": 97,
  "pageReferences": 24,
  "pages": ["enterprise-application-platform/applications", "..."],
  "contractControl": "select",        // 无映射为 null
  "contractSupported": true,
  "componentMapTypes": ["enum", "ref"],
  "snippets": ["<pm-select v-model=\"form.status\" :options=\"statusOptions\" />"],
  "notes": "契约页可用 components.status='pm-select' 指定"
}
```

`styles.json[]`、`recipes.json[]`：

```jsonc
// styles.json
{ "id": "data-cyan", "name": "数据蓝青", "className": "visual-style-data-cyan", "signature": "#145fba",
  "css": "styles/data-cyan/style.css", "tokens": { "primary": "#145fba", "radius": 12, "density": "compact" } }

// recipes.json
{ "recipe": "list", "label": "列表台账", "templateComponents": ["BusinessListPage", "QueryPanel", "RowActions", "ThreePartPagination"],
  "contractPreviewSupported": true, "examplePage": "operations-management/list" }
```

### 6.4 生成规则

- 来源：内置 pack `templates/design-system/afcenter-app-templates-v1/pack.json` + 每个页面 `.vue` 文本；
  生成前先刷新 `catalog/builtin/` 只读镜像（§6.2），catalog 的 `readPath`/`structureReadPath` 指向镜像。
- 页面/类型/风格/配方：直接取 pack；`catalogRef = "<applicationType>/<pageId>"`。
- 组件：对蓝图文本做**正则扫描** `/<(pm-[a-z0-9-]+)/g`，统计标签引用次数；用法片段取该标签起始到 `>`（最多 3 行、260 字符）。
- 契约支持：读取**共享映射文件** `templates/design-system/component-controls.json`（20 个键，`pm-*` → 控件名），
  与 39 个组件并集求交集得到 **13 个可映射控件**（spike C 的 13/39）；其余标记 `container/display`，由 `ContractPage`
  固定结构渲染。**后端 catalog 不解析前端 JS**；前端 `contract-view.js` 与后端 catalog 都消费同一 JSON（前端 import JSON）。
- 资产：扫描蓝图 `from '../assets/<file>'` 与 pack `applicationTypes[].assets`，生成 assets 列表（spike C：当前仅 1 处）。
- 确定性：排序稳定（应用类型 pack 顺序 → 页面顺序 → 组件名字典序），不写随机/时间到业务字段；
  `index.json` 可以写 `generatedAt`（catalog 是缓存）。
- 刷新：`ensureStudioAssets` 在工作室打开/会话启动时比较 builtin pack 版本+mtime，与 `index.sourceHash` 不同则重建；
  重建按文件原子写（`.tmp` → rename）。

### 6.5 同源给 UI

- `GET /api/design-templates/catalog` 返回 `index/pages/components/styles/recipes` 的摘要（组件/页面全量，体积可控）；
- 工作室 UI 的“可用页面/组件/风格”面板直接用它，避免 UI 与 agent 两套扫描逻辑；
- 页面库/模板中心复用 `pages.json` 生成分类、搜索、kind 标签。

### 6.6 catalog 不包含什么

- 不解析 Vue AST、不提取 props 类型/默认值/插槽；只给标签 + 属性原文片段（足够 agent 参考，细节读蓝图）。
- 不索引应用内 `design.json` / 页面实现；工作室只面对模板源。
- 不索引已发布自定义 pack 的页面（本期 `reference` 只允许引用内置 25 页；自定义模板复用通过编辑原模板完成）。

---

## 7. Agent 工作流与 skill / command

### 7.1 工作室 AGENTS.md（`_workshop/AGENTS.md`）

内容要点：

1. 身份：设计模板编写工作室；目标是把用户需求组装成可发布的设计模板。
2. 读取顺序：`AGENTS.md` → `catalog/index.json` → `catalog/pages.json`/`components.json`/`styles.json`/`recipes.json`
   → `catalog/builtin/` 中 `readPath` 指向的蓝图/结构样式 → 当前 `drafts/<packId>/spec.json` / `generation.json` → 用户消息；
   **不要拼仓库 `templates/design-system/**` 路径**（不在 location 内），只用 catalog 的 `readPath`。
3. 只写：`drafts/<packId>/spec.json`（+ 可选 `notes.md`）。**禁止**改 catalog、pack/、`.opencode/**`、仓库源码、应用工作区。
4. 不发布：发布只能由用户点击“发布”；agent 只生成/校验/建议。
5. 引用必须使用 catalog 中的真实 id：`pack` 固定 `afcenter-app-templates-v1`，`applicationType`/`pageId` 来自 `pages.json`；
   contract 页字段必须来自 `sampleEntity.fields`。
6. 中文回复；完成时汇报：页面清单（reference/contract）、风格、生成/校验结果、未实现项、发布前待确认。

### 7.2 `adw-design-template-authoring` skill

位置：`templates/workshop/skills/adw-design-template-authoring/`
（**不放在 `templates/agent/skills`**，避免 `installAgentAssets` 把它分发到每个应用；由工作室初始化复制到 `_workshop/.opencode/skills/`）。

```text
templates/workshop/
  skills/adw-design-template-authoring/
    SKILL.md
    references/spec.schema.json
    references/spec.example.json
    references/contract-recipes.md
    scripts/lib/{spec,css,generator}.cjs
    scripts/generate.cjs
    scripts/validate.cjs
  commands/generate-design-template.md
```

SKILL.md 工作流：

1. **复述确认**：用中文复述目标（业务场景/页面清单/风格/是否需要 reference 页），只问阻塞问题（≤3 个）；
   不确认也能给出默认方案，但要在回复里标注假设。
2. **读 catalog**：内置页面的 `kind` 为 `blueprint`（只读）；选择 `reference` 引用页（优先复用成熟页面）和/或 `contract` 页；
   页面 id 建议按 §5.3。
3. **写 spec.json**：严格按 `references/spec.schema.json`；一次写完整，不写临时文件；
   contract 页的列/查询/表单字段必须存在于 `sampleEntity.fields`（否则生成器 warning/预览缺列）。
4. **生成**：运行 `node .opencode/scripts/generate.cjs --draft <packId>`（允许的 shell），读 JSON 结果；
   或在 UI 点“生成预览”（同一后端生成器）。
5. **修正**：只改 spec；错误按 `errors[].path` 定位；warning 说明取舍。
6. **交接发布**：告诉用户“已生成，可在右侧预览；确认后点发布”，**不要自行发布**。

禁止事项（写进 skill）：

- 不写 `.vue`、不改 pack/CSS、不复制蓝图到草稿；
- 不发明页面 id/组件名/风格 id；不引用不存在的内置页面；
- 不修改仓库 `templates/**`、`backend/**`、`frontend/**`、`projects/**`、`data/**`（除当前 spec/notes）；
- 不运行除生成/校验脚本外的 shell；不调用 git。

### 7.3 `generate-design-template` command

`templates/workshop/commands/generate-design-template.md`：

```md
---
description: 按当前草稿 spec.json 生成设计模板包并校验
---

读取当前草稿 `drafts/$ARGUMENTS/spec.json`（$ARGUMENTS 为 pack id），
运行 `node .opencode/scripts/generate.cjs --draft $ARGUMENTS`，
把输出的 errors/warnings/页面清单/结构样式合并结果用中文汇报；
不要发布，不要修改 spec 之外的文件。
```

### 7.4 生成器/校验脚本的落点与权威口径

**唯一权威：后端 `backend/src/design/pack.ts`（发布/运行时校验）。**

- 共享核心（生成实现）：`templates/workshop/skills/adw-design-template-authoring/scripts/lib/*.cjs`
  （CommonJS、无外部依赖）：`spec.cjs`（spec 解析/规范化）、`css.cjs`（解析/合并）、
  `generator.cjs`（spec→pack 写入）。**核心不提供“权威 pack 校验”**，避免两套规则漂移。
- 后端入口 `backend/src/design-template/core.ts` 通过**仓库路径** `require` 这份核心（与
  `fidelity-core.cjs` 同一模式），不依赖 `tsc` 把 `.cjs` 复制到 `dist`；后端 `generator.ts` 在核心写完后
  调用 `pack.ts#validatePackDir`（权威），生成/发布都以它的结果为准。
- 工作室初始化时把核心复制到 `_workshop/.opencode/scripts/lib/*.cjs`，并提供薄 CLI：
  `generate.cjs`（核心生成 + 调后端 validate）与 `validate.cjs`（**仅预检**，调后端 validate），
  写 `_workshop/workshop.json`（含 `{ builtinRoot, customRoot, draftRoot, workbenchPort }` 绝对路径）。
- CLI 的 `validate.cjs` 结果**不替代发布校验**；发布 API 总是重新走 `pack.ts`。CLI 只用于给 agent
  快速反馈，不能作为“可发布”的依据。
- bash 白名单只需要 `node .opencode/scripts/generate.cjs *` 与 `node .opencode/scripts/validate.cjs *`。

### 7.5 与内置方法 skill 的关系

- 工作室会话只加载 `adw-design-template-authoring`（+ 可选 `opencode` 内置说明）；不分发
  `adw-design-artifacts`/`adw-frontend-implementation`/团队 skill（那是应用阶段的）。
- 若用户要求“把这个模板用于某应用”，agent 说明去新建应用选择该模板；不在工作室里改应用。

---

## 8. spec → pack 生成器

### 8.1 输入

- `studioRoot`、`packId`（= draftId）、`spec.json`；
- 内置 pack 根（`templates/design-system`）、自定义 pack 根（`<dataDir>/design-system`）。

### 8.2 校验（errors 阻断 / warnings 不阻断）

**errors**：

| 代码 | 条件 |
| --- | --- |
| `spec-invalid` | 非对象、未知顶层字段类型错误、缺 `name/pages` |
| `spec-version` | `schemaVersion` 不是 1 |
| `pack-id-invalid` | 不符合 `^[a-z0-9][a-z0-9-]{0,63}$` 或为保留名/内置 id |
| `page-id-invalid` | 不符合 `PAGE_ID_PATTERN` 或 pack 内重复 |
| `page-count` | 页面数 <1 或 >40 |
| `source-missing` | reference 的 `source.pack/applicationType/pageId` 不存在 |
| `source-page-missing` | 源页面在 pack 中不存在 |
| `kind-invalid` | spec 页不是 `reference`/`contract`（spec 不允许 `blueprint`）；pack 中出现未知 kind，或自定义 pack 使用 `kind=blueprint` |
| `kind-required` | **自定义 pack** 页面缺省 `kind`（无论是否有 blueprint）；内置 pack 缺省 kind+blueprint → `blueprint` 兼容，不报错 |
| `contract-recipe-unsupported` | contract 的 `recipe` 不在 8 配方内 |
| `contract-missing` | `kind=contract` 但无 `contract` |
| `sample-entity-missing` | `kind=contract` 但无 `sampleEntity`/无 fields |
| `sample-sub-entity-invalid` | `sampleSubEntities` 的 id 重复/为空或 fields 为空 |
| `blueprint-on-contract` | contract 页写了 `blueprint` |
| `style-missing` | 风格不存在或不属于内置 pack |
| `base-type-missing` | `baseApplicationType` 不存在 |
| `asset-collision` | 不同来源类型的同名资产内容不同（避免蓝图 import 指向错误文件） |

**warnings**（保留原值/继续生成）：

| 代码 | 条件 |
| --- | --- |
| `page-field-unknown` | contract 的列/查询/表单字段不在 `sampleEntity.fields`（预览会跳过） |
| `sample-sub-entity-missing` | `subTables.target/entity` 不在 `sampleEntity + sampleSubEntities` 池（预览跳过） |
| `component-unknown` | `components` 值不是 catalog 中的 `pm-*` |
| `reference-component-extra` | reference 源页面组件未在 catalog（理论不应发生） |
| `tree-parent-missing` | `tree.parentField` 为空或样例数据无法嵌套（预览扁平化） |
| `css-conflict` | 合并 structure 出现同选择器不同规则体（见 8.4） |
| `asset-import-missing` | 蓝图相对 import 的资产在源 pack 中不存在（仍复制其余资产） |

### 8.3 生成步骤

1. 读 spec，规范化（trim、去重、按数组顺序保留页面）。
2. 解析 packId：`spec.id` 或由 `name` slug 化；校验。
3. 解析源：
   - `baseApplicationType`（默认第一个 reference 的来源类型；无 reference 时默认 `enterprise-application-platform`）；
   - `style`（默认内置 pack 的 defaultStyle）；
   - 每个 reference 页校验源页面，记录来源类型顺序（**首次出现顺序**，用于 CSS 合并）。
4. 计算页面输出元数据：
   - reference：`type/recipe/preview/description/components/blocks` 取源页面；`name` 取 spec.name；
     `blueprint = application-types/<packId>/pages/<pageId>.vue`；`source` 记录源 pack/type/page/blueprint/sha256；
   - contract：`type` 取 spec.type（缺省按 recipe 推断）；`recipe` 取 spec.recipe；`preview` 按 recipe 映射
     （list/tree-list/page-form→form/dialog-form→form/detail/dashboard）；`contract` 原样保留；
     `sampleEntity`/`sampleSubEntities` 原样；`components` 由生成器计算。
5. **合并 structure.css**（见 8.4）：来源类型 = reference 来源顺序 + `baseApplicationType`（去重）。
6. 暂存目录：`drafts/<packId>/.pack.tmp-<rand>/`（确保不在最终目录写半成品）。
7. 写文件：
   - `styles/shared.css`（源 pack 有则复制）；`styles/<styleId>/style.css`；
   - `application-types/<packId>/structure.css`（合并结果）；
   - reference：复制源蓝图**字节**到 `pages/<pageId>.vue`，计算 sha256 与源文件一致；复制来源类型
     `assets/` 并集；扫描蓝图中的 `from '../assets/...'`，缺失给 warning；同名资产内容不同 → error `asset-collision`；
   - contract：不写 `.vue`，也不在 pack 内写 contracts 文件（`contract` 内联在 `pack.json`；应用 scaffold 时才生成
     `docs/design/template/<type>/contracts/<page>.json`）；
8. 写 `pack.json`（确定性：固定键顺序、2 空格、结尾换行；`origin` 不含 `publishedAt`，`revision` 取已发布值或 0）。
9. **权威校验**：后端 `pack.ts#validatePackDir` 对暂存目录做完整 pack 校验（发布/运行时唯一权威）。CLI 的
   `validate.cjs` 只调后端 validate 做预检，不作为发布依据。
   - 草稿 pack 目录名是 `pack`，不是 packId：校验入口必须显式传入 `expectedId`，**不要**套用运行时
     `id === path.basename(rootDir)` 的检查；发布到 `<dataDir>/design-system/<packId>` 后再按正常规则加载。
   - 校验直接读文件，不走 `pack.ts` 的 mtime 缓存；发布后调用 `clearDesignPackCache()`。
10. 原子替换 `drafts/<packId>/pack`：
    - 若已有旧 pack：先 rename 到 `.pack.old-<rand>`；
    - rename 暂存目录到 `pack`；
    - 成功删除旧目录；失败回滚 rename；
11. 写 `drafts/<packId>/generation.json`：`{generatedAt, specHash, pageCount, sources, css:{...}, warnings, errors}`；
    失败时不覆盖旧 `pack`/`generation.json`，清理暂存目录。
12. 返回 `{ok, pack: {id,version,pageCount,pages[]}, warnings, css}`。

### 8.4 CSS 合并算法（spike D 结论）

**顺序**：reference 页来源类型按页面首次出现顺序；最后追加 `baseApplicationType`（若未出现）。固定顺序保证可复现；
agent 可通过调整页面顺序改变合并顺序（UI 说明其影响）。

**解析单位**：

- 顶层规则：`selector { body }`；
- `@media <cond> { ... }`：内部规则带 `media` 前缀；
- 去除注释；仅用于**比较**时规范化空白（选择器、规则体），输出保留首次出现的原始文本（减少无意义 diff）。

**去重单位**：`(media, normalizedSelector, normalizedBody)` 三元组完全相同 → 只写首次出现的一份。

**同选择器不同规则体**：

- **全部保留**（按固定来源顺序）；后者在 CSS 级联中覆盖前者；
- 记录到 `css.conflicts[]`：
  ```jsonc
  { "selector": ".pm-search-main", "media": "", "sources": ["operations-management","data-governance-workbench"],
    "effect": "后者覆盖前者；预览以 data 类型样式为准" }
  ```
- 发布响应的 `warnings` 包含 `css-conflict`，UI 展示；不阻断发布。

**基数（内置 4 套）**：793 条规则；唯一三元组 514；去重节省 279；跨类型真冲突 3 条
（`.pm-upload-copy`、`.pm-search-main`、`.pm-search-body`；data 类型有不同实现）。详见证据 `spike-d-css.json`。

**contract 页基线**：contract 页不依赖某来源类型的页面结构类；使用 `baseApplicationType` 作为
`optimized-suite` 的根类，合并后的 structure.css 已包含该类型规则；如 `baseApplicationType` 未被任一
reference 引用，则追加其 structure（第 5 步已保证）。

### 8.5 失败与清理

- 任何 error：删除暂存目录，不触碰当前 `pack/` 与已发布目录；`generation.json` 不更新；
- 发布失败：旧 pack 不动；暂存发布目录删除；`design-pack` 缓存不清理（旧版本仍有效）；
- 不允许“部分页面写入最终目录”。

### 8.6 生成器输出示例（stdout JSON）

```json
{
  "ok": true,
  "pack": { "id": "supplier-hub", "version": "1.0.0", "pageCount": 5 },
  "pages": [
    { "id": "supplier-list", "kind": "reference", "source": "operations-management/list" },
    { "id": "supplier-form", "kind": "contract", "recipe": "dialog-form" }
  ],
  "css": {
    "sources": ["operations-management", "data-governance-workbench", "enterprise-application-platform"],
    "rules": 501,
    "deduped": 292,
    "conflicts": ["pm-search-main", "pm-search-body", "pm-upload-copy"]
  },
  "warnings": [{ "code": "page-field-unknown", "path": "pages[3].contract.form.groups[1].fields[2]", "message": "字段 notInSample 不在 sampleEntity" }],
  "errors": []
}
```

---

## 9. 工作室与会话

### 9.1 目录

```text
data/design-system/_workshop/
  AGENTS.md
  opencode.json                     # V2 permissions（spike A 推荐）
  workshop.json                     # {builtinRoot,customRoot,draftRoot,workbenchPort}
  catalog/...                       # §6（含 builtin/ 只读镜像）
  .opencode/
    skills/adw-design-template-authoring/{SKILL.md,references/*}   # 受管
    commands/generate-design-template.md                           # 受管
    scripts/{generate.cjs,validate.cjs,lib/*.cjs}                  # 受管（共享核心副本）
  drafts/<packId>/
    draft.json                      # 后端维护：status/createdAt/updatedAt/publishedVersion/lastSpecHash
    spec.json                       # agent 唯一需要写的产物
    notes.md                        # 可选
    pack/                           # 生成物（未发布）
    generation.json                 # 最近一次生成报告
```

- 工作室根是 opencode location（spike B 验证）；会话共享同一 location。
- 草稿 id = pack id：避免“发布后换 id 导致会话/契约路径漂移”。
- `draft.json.status`：`draft`（未发布）| `published`（已发布且草稿保留供继续编辑）。
- 发布后不删除草稿；编辑已发布模板就是继续改同一草稿。

### 9.2 初始化（`ensureStudioAssets`）

1. 建目录；写/覆盖 `AGENTS.md`、`opencode.json`、`workshop.json`（内容不同才写）；
2. 从 `templates/workshop/skills/adw-design-template-authoring` 与 `templates/workshop/commands/generate-design-template.md`
   复制受管资产；复制共享生成核心到 `.opencode/scripts/lib`；
3. 刷新 `catalog/builtin/` 只读镜像（按 pack 版本/mtime+hash；36 文件、约 580KB），再生成/刷新 catalog
   （mtime/版本变化时）；原子写；镜像只读，不参与发布；
4. 若资产有变化 → `opencode.reloadLocations()`（best-effort，失败只 warning）；
5. 单个进程内按内容 hash 跳过重复写；会话创建后仍需 `verifyTargetAssets`（location 惰性初始化）。

### 9.3 权限（`opencode.json`）

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "permissions": [
    { "action": "edit", "resource": "*", "effect": "deny" },
    { "action": "edit", "resource": "*drafts/*/spec.json", "effect": "allow" },
    { "action": "edit", "resource": "*drafts/*/notes.md", "effect": "allow" },
    { "action": "read", "resource": "*", "effect": "allow" },
    { "action": "shell", "resource": "*", "effect": "deny" },
    { "action": "shell", "resource": "node .opencode/scripts/generate.cjs *", "effect": "allow" },
    { "action": "shell", "resource": "node .opencode/scripts/validate.cjs *", "effect": "allow" },
    { "action": "external_directory", "resource": "*", "effect": "deny" }
  ]
}
```

说明：

- spike A 证明 V2 `permissions` 被接受、顺序保留、last match wins；`*` 可跨 `/`（官方文档）。
- **路径口径未实证**：spike A 只验证配置归一化，没有真实工具调用，无法确认 edit 的 resource 是
  “location 相对”还是绝对路径。因此 allow 规则用 `*drafts/*/spec.json`（前导 `*` 可覆盖绝对/相对两种形式）；
  P7-7b 用真实工具调用复核（不调模型，若能构造），并在生成/发布 API 再次校验当前 draftId 的 spec；
  即使权限误放行，也不会绕过生成/发布校验。
- `*drafts/*/spec.json` 放行所有草稿的 spec（共享 location 的代价）；会话 prompt 明确“只改当前 packId”，
  生成/发布只读指定草稿，跨草稿误写不会影响其它模板的发布（各自 spec 校验）。
- 可选加严：`skill` 全 deny + 只放行 `adw-design-template-authoring`（spike A 未验证实际隐藏效果，
  实施时用 `/api/skill` 实测；失败则退回“不限制、UI 过滤”）。
- 现有应用 `opencode.json` 保持 V1 不动（spike A 证明仍有效）。

### 9.4 会话模型

| 项 | 方案 |
| --- | --- |
| 表 | 复用 `app_sessions`（**不改表**） |
| app_id | `__template__:<packId>`（合成 id，无 FK） |
| view | **`template`**（新增 `SessionView`；`AppView` 仍三值；DB 是 TEXT，无迁移） |
| 标题 | `<模板名> · 模板工作室`；新建会话 `defaultSessionTitle` 用 `模板工作室` |
| 模型键 | `app.__template__:<packId>.model.template`（独立；不继承应用三视图模型） |
| 模型选择 | 工作室头部沿用现有模型设置 UI；读写 studio model API（§13.3）；`resolveChatModel` 的 stage=`template`，不调用 `storedModelFromOtherStages` 的应用继承 |
| 一个模板一个会话 | 同一 packId 的活跃会话唯一；切换/新建按现有逻辑归档旧会话；历史保留 |
| 删除模板 | 会话行归档（`status=archived`），不物理删除；避免孤儿引用 |
| 草稿删除 | 仅删草稿目录；已发布会话保留（模板仍在） |

### 9.5 `ChatTarget` 抽象

```ts
export type AppView = 'requirements' | 'design' | 'development'   // 保持三值
export type SessionView = AppView | 'template'                     // 新增
export function isSessionView(value: unknown): value is SessionView // requirements|design|development|template

export interface ChatTarget {
  id: string                 // appId 或 __template__:<packId>
  name: string
  directory: string
  view: SessionView
  /** 每轮/建会话前的幂等准备（应用：ensureWorkspaceAssets；工作室：ensureStudioAssets） */
  beforeSession?(): { warnings: string[] }
  /** 期望加载的 skill/command（替代 expectedSkillIds/EXPECTED_COMMANDS 写死） */
  expectedSkills(): string[]
  expectedCommands(): string[]
  /** 本轮 prompt；工作室与三视图不同 */
  buildPrompt(text: string, options: { module?: string; digest?: string }): string
  /** 开发视图 digest；工作室返回 catalog/spec 摘要或 undefined */
  digest?(module?: string): string | undefined
  allowModule: boolean
}
```

实现路径（低风险）：

1. `sessions/store.ts`：**`AppView` 保持三值**；新增 `SessionView`/`isSessionView`，`viewOf()` 对 `template`
   返回自身；应用 chat/model 路由继续用 `isAppView`（拒绝 `template`），工作室路由用 `isSessionView`；
   `activeSessionRow/listSessionRows/createSessionRow` 不需要改 SQL；
2. `chat/service.ts`：新增 `handleChat(target, req,res)`；`handleAppChat(app,...)` 保留为 `targetForApp` 的等价包装；
   `ensureViewSession` 改为 `ensureTargetSession(target, model)`；`verifyProjectAssets` → `verifyTargetAssets`；
3. `dev/service.ts`：内部 `appOrThrow/appDirOf/ensureWorkspaceAssets` 改为 target 解析；导出签名不变；
   `stateFor`/timeline 保留；工作室复用 `stateFor` 的 opencode 会话读取（用 target.directory）；
4. 新增 `backend/src/design-template/studio.ts`：`targetForDraft(packId)` 与 studio 专用
   prompt/digest/expected assets；工作室路由把请求交给共享 `handleChat` 或 dev-like 函数；
5. 前端 `AgentChatPanel` 增加可选 `api` prop（默认现 `dev/api.ts`）与可选 `commands` prop（默认 `commandsForView(view)`）；
   工作室传 `studio/api.ts` 适配器与 `generate-design-template` 命令；三视图命令不变；
   `dev/types.ts` 增加 `SessionView` 类型（不影响应用路由 `view-helpers.js` 的 3 视图映射）。

### 9.6 工作室 prompt（每轮）

```text
当前工作室：设计模板编写。
当前模板/草稿：<packId>（显示名 <name>）。
只允许写 drafts/<packId>/spec.json 与 drafts/<packId>/notes.md；其它文件只读，禁止修改。
先读 AGENTS.md 与 catalog（index/pages/components/styles/recipes），再读 spec.json（若存在）。
引用必须来自 catalog 的真实 id；contract 页字段必须来自 sampleEntity.fields。
生成用 node .opencode/scripts/generate.cjs --draft <packId>；不要发布；生成后把 errors/warnings 用中文汇报。
所有面向用户的文字使用中文。
用户消息：<text>
```

### 9.7 技能/命令加载校验

- 建会话后轮询 `GET /api/skill?location[directory]=<studio>` 与 `/api/command`，最多 10s；
- 期望：`adw-design-template-authoring`、`generate-design-template`；
- 缺失只 warning（不阻断），UI 工作室顶部显示“工作室资产未加载，点击重载”；
- 不做“未加载就禁止对话”（与现有应用 verifyProjectAssets 口径一致）。
- 全局/内置 skill 也会出现（spike B：该机 27 个）；工作室 UI 不展示列表，不影响 prompt；如需隐藏用 skill 权限。

---

## 10. 草稿 / 发布 / 编辑 / 删除

### 10.1 新建草稿

`POST /api/design-templates/drafts {name?, id?, style?, baseApplicationType?}`：

1. 生成 packId（`id` 或 slug(name)+随机 4 位）；校验不与内置/自定义重复；
2. 建 `drafts/<packId>/`；写 `draft.json`（status=draft）；写 starter `spec.json`：
   ```json
   { "schemaVersion": 1, "id": "<packId>", "name": "<显示名>", "description": "",
     "baseApplicationType": "<base>", "style": "<style>", "pages": [] }
   ```
   （空 pages 生成器会报 `page-count`；starter 只是给 agent 一个落点，UI 初次打开会提示“让 agent 先确定页面清单”。）
3. 初始化工作室资产（§9.2）；
4. 返回 draft 摘要；不自动创建 opencode 会话（用户发出第一条消息时创建，避免空会话）。

### 10.2 生成（草稿预览）

- `POST /api/design-templates/drafts/:id/generate`：调用生成器（§8），写 `drafts/<id>/pack` 与 `generation.json`；
- 不影响已发布 pack；草稿预览读取 `pack/`；
- UI 在“生成预览”后自动刷新右侧预览与页面列表；agent 也可用 CLI 生成。
- 生成是幂等的：同一 spec 重复生成结果字节一致（除 `generation.generatedAt`）。

### 10.3 发布

`POST /api/design-templates/drafts/:id/publish`：

1. 读取 `draft.json`、`spec.json`、`generation.json`；
2. 校验：
   - `spec.json` 的 sha256 == `generation.specHash`；否则 **409 `spec-changed`**（先重新生成）；
   - 草稿 pack 存在且通过后端 `pack.ts#validatePackDir` 权威校验（CLI `validate.cjs` 只作预检）；否则 400；
   - packId 未占用（首次发布）或已存在且 `origin.kind=custom`（覆盖）；
   - 内置 id → 403；非法 → 400；
3. 复制 `drafts/<id>/pack` 到自定义根暂存 `data/design-system/.publish.tmp-<rand>/<packId>/`；
4. 更新 `pack.json`：`origin.revision = 旧 revision + 1`（首次 1）、`origin.publishedAt = now`、
   `version = "1.0.<revision-1>"`、`origin.specHash`；重写文件（2 空格）；
5. 再次走 `pack.ts#validatePackDir` 权威校验；原子替换 `data/design-system/<packId>`（旧目录改名备份 → 新目录 → 删旧；
   失败恢复旧目录）；
6. `clearDesignPackCache()`；更新 `draft.json`（status=published、publishedVersion、lastSpecHash）；
7. 返回 `{ok, pack:{id,version}, warnings}`；**不主动同步已存在应用**（应用下次打开 `ensureWorkspaceAssets` 对齐，
   避免发布长事务/覆盖开发中的工作区）。

### 10.4 编辑已发布模板

- 模板中心/工作室点“编辑”：`POST /api/design-templates/packs/:packId/draft`：
  - 草稿已存在 → 直接返回；
  - 不存在 → 由已发布 pack 反写 `spec.json`（reference 的 source 来自 `page.source`；contract 取 `contract/sampleEntity/sampleSubEntities`；
    base/style 取 `origin`），写 `draft.json`（status=published），不复制 pack（生成时再产出）。
- 后续聊天/生成/发布同一 packId；发布 = 覆盖 + 版本 +1。
- 反写 spec 时保留 page 顺序；若 pack 缺 `origin`（异常）→ 400 `pack-invalid`，提示重新创建。
- **不提供“基于已发布另存为新模板”**（本期不做；需要时新建草稿重新组装）。

### 10.5 删除

`DELETE /api/design-system/:packId`：

1. 内置 pack → **403**；
2. 非 custom → 404；
3. 扫描 `app_settings` 中 `app.<id>.design.pack` 的值（JSON 字符串或纯字符串都兼容）等于该 packId；
   - 有引用 → **409** `{ error: "模板仍被应用引用", apps: [{id,name}] }`；
4. 删除 `data/design-system/<packId>`；删除 `_workshop/drafts/<packId>`（若存在）；
5. 归档该模板的工作室会话（`app_sessions` 置 archived，不物理删除）；
6. 清 pack 缓存；返回 `{ok:true, removedDraft:boolean}`。
- 删除不可回滚；UI 需二次确认，并显示引用应用列表。
- 草稿删除（未发布）：`DELETE /api/design-templates/drafts/:id`：删草稿目录；若已发布，只删草稿工作副本，
  保留 pack（返回 `packKept:true`），UI 文案区分“丢弃草稿”与“删除模板”。

### 10.6 备份 / 回滚口径

- **不做**历史版本目录、备份文件、回滚按钮；
- 发布采用暂存 + 原子替换；失败保留旧 pack；
- 已复制到应用工作区的受管副本不会因发布/删除自动回滚；应用下次打开按当前 pack 覆盖（或回退默认，见 §12.6）；
- 不做并发发布/多实例锁；同一时间只允许一个实施会话（仓库约定），产品侧默认单用户。

---

## 11. 预览

### 11.1 `template-preview.html`（自定义 pack 草稿/已发布）

新增 Vite 多入口 `frontend/template-preview.html` + `src/template-preview/{main.ts,TemplatePreviewApp.vue}`，
后端 `GET /template-preview.html`（与 `/preview.html`、`/design-preview.html` 同一独立入口分支，缺失 404 不回落 index）。
**只处理自定义 pack**（`reference`/`contract`）；`blueprint`（内置页）不进入该入口，模板中心/内置页面库仍直接使用
`preview.html?type=&style=&page=`。

URL：

```text
/template-preview.html?draft=<packId>&page=<pageId>&embed=1
/template-preview.html?pack=<packId>&page=<pageId>&embed=1
```

数据：

- 草稿：`GET /api/design-templates/drafts/:id`（返回 spec/pack 摘要/pages）+ `GET /api/design-templates/drafts/:id/asset?path=...`；
- 已发布：`GET /api/design-system/:packId` + `GET /api/design-system/:packId/asset?path=...`；
- 需要页面/风格/结构样式；`pack.json` 的 `applicationTypes[0].structure` 与 `styles[0].css`。

渲染分支：

| 页面 kind | 渲染 |
| --- | --- |
| `reference` | iframe `/preview.html?type=<source.applicationType>&style=<styleId>&page=<source.pageId>&embed=1&structurePack=<packId>`（草稿用 `structureDraft=<packId>`），父页面展示 iframe；结构样式由 `PreviewApp` 从 pack 资产接口加载并替换注入的 `structure.css` |
| `contract` | 直接在本页构造 synthetic design：`{designSystem:{...},entities:[sampleEntity, ...(sampleSubEntities||[])],pages:[{id,name,title,type,entity:sampleEntity.id,recipe,...flattenContract(page.contract)}]}` → `adaptDesign` → `ContractPage`；`flattenContract` 把 `contract` 的 filters/columns/rowActions/toolbarActions/selection/pagination/form/tree/subTables/components 展平为页面字段；注入 pack 的 structure.css 与风格 CSS；`embed=1` 隐藏角标 |
| `blueprint` | **不进入本入口**；内置页由模板中心/页面库直接 `preview.html` 预览 |

说明：

- reference 页（自定义 pack 引用页）的 `.vue` 是内置源页的**字节快照**（生成器校验 sha256），因此用内置 `preview.html` 渲染与模板包内蓝图一致；
  唯一差异是结构样式（合并后的 structure.css），通过 `structurePack/structureDraft` 覆盖；页内根类仍是**源应用类型**
  （如 `application-type-operations`），合并 structure 已包含该类型规则。
- 不为运行时 pack 做 Vue 编译/动态 import；这是本期的硬边界。
- contract 页使用 `sampleEntity`（+ 可选 `sampleSubEntities`）的确定性 mock；根类使用 `baseApplicationType`（`application-type-enterprise-platform` 等）；
  `ContractPage` 的列/查询/表单/树/子表/驾驶舱/详情逻辑完全复用，缺失字段/列跳过并提示（与 P9/P10 一致）。
- `template-preview` 只用于模板预览，不写 PNG；应用 PNG 仍由 `design-preview.html` 截图协议产出。

### 11.2 `preview.html` 的结构样式覆盖

- 新增 query：`structurePack=<packId>` | `structureDraft=<packId>`；
- `PreviewApp.vue`：若存在该参数，fetch 对应资产接口的 `application-types/<packId>/structure.css`，
  用返回文本替换 `#preview-structure-css` 内容（而不是 registry 的类型 structure）；失败回退 registry 并提示；
- `type/style/page` 语义不变（仍是内置源类型页面）；`embed` 语义不变；
- 内置 pack 预览（模板中心/内置页面库）不传该参数，行为不变；`e2e:preview` 无需改断言（新增分支另测）。

### 11.3 应用内 `design-preview.html`

- `GET /api/apps/:id/design-system` 新增 `preview` 映射（§12.2），`DesignPreviewApp.vue`：
  - 若 `designSystem.preview.kind === 'custom'`：
    - `application-type` 根类使用 `preview.baseApplicationType` 的短类（`SHORT_TYPE_CLASS` 映射）；
    - 从 `preview.structureUrl` fetch 合并 structure.css，注入 `#design-preview-structure-css`；
    - 风格仍是内置 `styleId`，静态 CSS 已随 registry 打包（自定义 pack 复制同一风格，视觉一致）；
    - `data-type` 可用自定义 pack id 便于调试；`data-style` 不变；角标/类型名优先取 `designSystem.applicationType.name`，
      registry 找不到自定义 type 时不再显示裸 id；
    - 内置 pack 路径完全不变（registry 加载）。
- `designSystem.pages` 对 contract 页给 `recipe/kind/contractFile`；`resolveContractRecipe` 用页面 id 在 `pages` 里找 meta，
  自定义页 id 同样可解析。
- `design-preview.html` URL 不变（`app/module/page/type/style/embed/v`）；`type` 传自定义 type id（=pack id）；
- PNG 截图：`template-capture.ts#shouldTemplateCapture` 依据“页面有显式契约”仍成立；iframe 内加载自定义 structure
  与风格类后截图，协议/尺寸/超时/降 scale/failure 回退线框全部不变。

### 11.4 预览的失败态

| 情况 | 表现 |
| --- | --- |
| 草稿未生成 pack | `template-preview` 显示“尚未生成，请先让 agent 生成或点‘生成预览’”；不白屏 |
| pack 无 page | 404 文案 + 可选页面列表 |
| reference 源页不存在 | 生成器已阻断；预览防御性显示错误 |
| structure 资产失败 | 回退内置源类型 structure，顶部提示“结构样式加载失败” |
| contract 无 sampleEntity | 生成器阻断；预览防御性空态 |
| 自定义 type 不在 registry | 预期内；不查 registry，只用 `baseApplicationType` 短类 |

---

## 12. 应用闭环

### 12.1 scaffold

`backend/src/apps/scaffold.ts`：

- 新应用 `designSystem` 选择支持自定义 pack（`resolveDesignSelection` 已按存在性校验；自定义 type id=pack id）；
- 复制 MF remote 不变；
- `writeDesignSystemWorkspace` 走扩展后的 `system-file.ts`（§12.2）。

### 12.2 `design-system.json`（扩展但 schemaVersion 仍为 1）

```jsonc
{
  "schemaVersion": 1,
  "pack": "supplier-hub",
  "packName": "供应商管理模板",
  "packVersion": "1.0.2",
  "origin": { "kind": "custom", "draftId": "supplier-hub", "baseApplicationType": "enterprise-application-platform" },
  "applicationType": "supplier-hub",
  "applicationTypeName": "供应商管理模板",
  "style": "data-cyan",
  "styleName": "数据蓝青",
  "styleClassName": "visual-style-data-cyan",
  "blueprintRoot": "docs/design/template",
  "templateDir": "docs/design/template/supplier-hub",
  "structure": "docs/design/template/supplier-hub/structure.css",
  "styles": {
    "shared": "docs/design/template/styles/shared.css",
    "style": "docs/design/template/styles/data-cyan/style.css",
    "styleId": "data-cyan"
  },
  "preview": {
    "kind": "custom",
    "baseApplicationType": "enterprise-application-platform",
    "structure": "docs/design/template/supplier-hub/structure.css",
    "structureUrl": "/api/apps/<appId>/design-system/asset?path=supplier-hub/structure.css",
    "styleClassName": "visual-style-data-cyan",
    "packVersion": "1.0.2"
  },
  "pages": [
    { "id": "supplier-list", "name": "供应商列表", "type": "list", "recipe": "list",
      "kind": "reference",
      "source": { "pack": "afcenter-app-templates-v1", "applicationType": "operations-management", "pageId": "list" },
      "blueprint": "docs/design/template/supplier-hub/pages/supplier-list.vue",
      "components": ["pm-search","pm-table","pm-pagination"] },
    { "id": "supplier-form", "name": "供应商表单", "type": "form", "recipe": "dialog-form",
      "kind": "contract", "contractFile": "docs/design/template/supplier-hub/contracts/supplier-form.json",
      "components": ["pm-form-dialog","pm-input","pm-select-user"] }
  ],
  "skills": ["afcenter-page-generation","pm-components-usage"]
}
```

- 内置 pack 的 `design-system.json.pages[]` 没有 `kind`（历史数据）；读取方按 **blueprint** 兼容；自定义 pack 页
  必须 `reference`/`contract`。
- `preview.structureUrl` 是应用内只读资产接口（§13.1），读 `docs/design/template/**` 的受管副本；
- 旧字段/旧应用保持可读：`preview`/`origin`/`kind` 都是可选；没有这些字段时走现有逻辑。

### 12.3 受管副本

`design/system-file.ts` 扩展：

- `buildDesignSystemSummary`：页面 summary 增加 `kind/source/contractFile`；contract 页 `blueprint` 省略；
  `preview` 写入；`origin` 写入；schemaVersion 仍 1。
- `copyTypeFiles`：
  - 复制 `pack.applicationTypes[0].structure` → `template/<packId>/structure.css`（合并结果原样）；
  - reference：复制 `pages/*.vue`；contract：写 `contracts/<pageId>.json`
    （`{schemaVersion,pageId,name,recipe,contract,sampleEntity,sampleSubEntities?}`）；
  - 复制 `applicationTypes[0].assets`；复制 `styles/shared.css` 与 `styles/<styleId>/style.css`；
  - contract 页不产生 `.vue`，也不复制任何源蓝图。
- `ensureWorkspaceAssets`：按当前 selection 覆盖受管副本；版本变化→覆盖；不触碰 `frontend/`、`docs/design/<MOD>` 正文、
  `docs/requirements`。

### 12.4 设计模板 skill

`templates/distribution.ts`：

- skill id 仍 `adw-template-proto-<applicationType>`；自定义 type id = pack id → 唯一；内置不变。
- `designTemplateSkillMarkdown` 页面表增加 `kind` 列（内置应用 page 无 kind → 显示 `blueprint`）：
  - `blueprint`（内置应用）：`蓝图 \`docs/design/template/<type>/pages/<file>.vue\``（与现状一致）；
  - `reference`（自定义引用页）：蓝图路径 + `source=<pack/type/page>`；
  - `contract`（自定义契约页）：`契约（无蓝图） \`docs/design/template/<type>/contracts/<page>.json\``；
- 新增“契约页实现”段：
  - 读 `design.json` 页面契约 + `contracts/<page>.json` + PageTemplates/pm-*；
  - 不复制蓝图；实现后 ui-check 记录“无蓝图，按契约实现”；
- manifest 增加 `templateKind:"custom"`、`packVersion`（可选，向后兼容），`kind` 仍 `design-system`；
- `expectedSkillIds`/清理逻辑不变（按 type id 白名单）；内置/自定义互斥逻辑不破坏。

### 12.5 设计 / 开发 agent

- **设计要求**（`adw-design-artifacts`/`generate-design` 文档 P7-7c 更新）：
  - 选页面优先用应用 `design-system.json.pages`；内置 `blueprint` 页沿用其 blueprint；自定义 `reference` 页写
    `catalogRef=<customType>/<pageId>` + `blueprint`；
  - contract 页以 pack 的 `contract` 为默认骨架，字段必须落到模块实体；无对应实体字段时不要编造；
  - brief 页面契约表增加 `kind/source/契约` 列。
- **开发 prompt/AGENTS/skill**：
  - 优先级不变：需求 > design-system/design.json 契约 > 蓝图（blueprint/reference） > brief/tokens > PNG；
  - contract 页：无蓝图，按 `docs/design/template/<type>/contracts/<page>.json` + design.json + PageTemplates/pm-* 实现；根类用 `baseApplicationType`；
  - `blueprint`/`reference` 页：照旧复制蓝图到 `frontend/src/views/`（内置页用原蓝图；reference 用快照；保留页内源应用类型根类；合并 structure 已含该类型规则）；
  - PNG 是模板风格截图（无契约旧设计为线框），蓝图/契约是结构事实。
- **digest**（`backend/src/dev/digest.ts`）：
  - 页面摘要增加 `kind`、`contract`（列/字段/操作/表单/树/分页摘要）、`contractFile`；blueprint/reference 保留 blueprint；
  - contract 页提示“无蓝图，按契约实现”；总长仍约 6KB 截断。
- **ui-check**（`backend/src/dev/ui-check.ts`）：
  - skeleton 页面表增加 `类型/来源/契约`；contract 页写“蓝图：无（契约页）”，blueprint/reference 写蓝图路径；
  - 缺失生成/不覆盖/状态只读口径不变。

### 12.6 fidelity（一致性检查）

`fidelity-core.cjs`（共享规则）：

- `blueprint-files`：`blueprint`（内置）/`reference`（自定义）才校验蓝图存在；contract 跳过，改为校验 `contracts/<page>.json` 存在（缺失 warn，不 fail）；
- `page-contract`：页面有 `recipe` 且（blueprint/reference 有 blueprint 或 contract 有契约文件）即 pass；
- `implementation`：仍按页面 id/名称/蓝图名匹配视图；contract 页用 id/名称；
- `style-imports`：structure/shared/style 路径不变；自定义结构样式同路径；
- 新增第 **13** 项 `template-contract`（只报告）：
  - 设计页 `catalogRef` 解析到应用 `design-system.pages` 的 contract 页 → 文件存在/recipe 一致 → pass；否则 warn；
- 12 项 → 13 项：更新 `check-fidelity.mjs` 摘要、`fidelity.test.ts` 期望、开发视图报告文案；
  **`e2e:p7-6a` 当前 15 条断言会因新增检查/报告文案变化，必须按实际更新脚本断言数，并在 `docs/STATUS.md`
  与交接单记录实际数值**（不要沿用旧 15）；汇总报告页数/文案同步。
- 仍只报告、不阻断；不做像素比对。

### 12.7 设计视图 / 新建应用 / 模板中心

- **模板中心**：
  - 自定义卡片启用；列表显示 `名称 · 风格 · 页面数(reference/contract) · 版本 · 引用应用数`；
  - 卡片操作：进入工作室、编辑、删除、预览页面库；
  - picker 增加自定义 pack（新建应用可选）；选中返回 `{pack, applicationType(pack id), style}`。
- **设计视图**：
  - 徽标显示自定义模板名/版本（如 `供应商管理模板 v1.0.2`），点击仍打开模板中心并定位；
  - 「模板页面库」显示 kind 标签（reference/contract）与来源；
  - 原型 Tab 仍只展示设计产物；自定义 structure 通过 design-preview 加载；无契约仍显示结构草图。
- **新建应用**：
  - 设计模板 picker 列出自定义 pack；表单透传 pack/type/style；
  - 创建后 `design-system.json`/蓝图/契约/skill 全链路生成。
- **删除保护**：模板中心删除按钮先调 API；409 时展示引用应用列表与“先去切换应用模板”提示。

---

## 13. API 清单

所有新增 API 挂在 `backend/src/design-template/routes.ts`（`/api/design-templates`）或 `design/system-routes.ts`（`/api/design-system`）。
错误响应统一 `{ error: string, code?: string, details?: unknown }`；不返回堆栈/绝对敏感路径。

### 13.1 只读 pack / 资产

| 方法 | 路径 | 入参 | 出参 | 错误 |
| --- | --- | --- | --- | --- |
| GET | `/api/design-system` | — | `{packs:[DesignPackSummary + {origin?, templateKind:'builtin'|'custom', referencedApps?}]}` | — |
| GET | `/api/design-system/:packId` | — | `{pack, source}`（pack 扩展 kind/source/contract/sampleEntity/sampleSubEntities/origin） | 404 |
| GET | `/api/design-system/:packId/asset?path=` | `path` 相对 pack 根，限制 `.css/.svg/.png/.jpg/.jpeg` | 文件流（Content-Type/长度） | 400 路径非法；403 内置禁止；404 |
| DELETE | `/api/design-system/:packId` | — | `{ok:true, removedDraft}` | 403 内置；404；409 `{code:'pack-referenced', apps:[{id,name}]}` |
| GET | `/api/apps/:id/design-system/asset?path=` | `path` 相对 `docs/design/template`，限制上述扩展 | 文件流 | 400/404 |

### 13.2 catalog / 草稿

| 方法 | 路径 | 入参 | 出参 | 错误 |
| --- | --- | --- | --- | --- |
| GET | `/api/design-templates/catalog` | — | `{index,pages,components,styles,recipes}` | 503 生成失败（含 warning） |
| GET | `/api/design-templates/drafts` | — | `{drafts:[{id,name,status,version?,publishedVersion?,updatedAt,pageCount,hasPack,validation:{errors,warnings},referencedApps} ]}` | — |
| POST | `/api/design-templates/drafts` | `{name?, id?, style?, baseApplicationType?}` | 201 `{draft}` | 400 参数/风格/类型非法；409 id 已存在 |
| GET | `/api/design-templates/drafts/:id` | — | `{draft, spec?, specError?, packSummary?, generation?, validation}` | 404 |
| GET | `/api/design-templates/drafts/:id/asset?path=` | 相对 draft pack 根；限制扩展 | 文件流 | 400/404（未生成） |
| POST | `/api/design-templates/drafts/:id/generate` | — | `{ok, pack, pages, css, warnings, errors:[]}` | 400 spec 校验失败；404 草稿/ spec 缺失；409 生成中（单飞锁） |
| POST | `/api/design-templates/drafts/:id/validate` | — | `{ok, errors, warnings, pack?}`（**权威** `pack.ts` 结果；供 CLI 预检） | 400 参数；404 草稿/未生成 |
| POST | `/api/design-templates/drafts/:id/publish` | — | `{ok, pack:{id,version}, warnings}` | 400 校验失败；403 内置 id；404；409 `spec-changed`/`pack-id-exists`/`publishing` |
| POST | `/api/design-templates/packs/:packId/draft` | — | `{draft}` | 404；400 pack 缺 origin/非法 |
| DELETE | `/api/design-templates/drafts/:id` | — | `{ok:true, packKept:boolean}` | 404；409 生成中 |

### 13.3 工作室会话（镜像 `/development/*`，复用同一套 service）

| 方法 | 路径 | 入参 | 出参 |
| --- | --- | --- | --- |
| GET | `/api/design-templates/drafts/:id/studio` | `?sessionId=` | `{draft, session, sessions, state, defaultPrompt, spec, validation, readOnly:false}` |
| GET | `.../studio/sessions` | — | `{sessions, activeSessionId, view:'template'}` |
| POST | `.../studio/session` | `{new?:bool}` | 同 GET studio |
| POST | `.../studio/sessions/:sid/activate` | — | 同 GET studio |
| PATCH | `.../studio/sessions/:sid` | `{title?, note?}` | 会话项 |
| POST | `.../studio/sessions/:sid/archive` | — | `{ok:true,sessionId,status:'archived'}` |
| POST | `.../studio/prompt` | `{text, command?}` | `{ok:true, warning?, command?}` |
| POST | `.../studio/interrupt` | — | `{ok:true}` |
| POST | `.../studio/compact` | — | `{ok:true,message}` |
| GET | `.../studio/events` | — | SSE（hello/事件/心跳；按活跃 opencode 会话过滤） |
| POST | `.../studio/permission/:rid/reply` | `{decision,message?}` | `{ok:true}` |
| POST | `.../studio/form/:fid/reply` | `{answer}` | `{ok:true}` |
| GET | `.../studio/model` | — | `{stage:'template', agent:'build', model, fallback}` |
| PUT | `.../studio/model` | `{model:{providerID,id,variant?}\|null}` | `{ok:true, stage:'template', model}` |

错误：404 草稿/会话；409 无活跃会话（compact/interrupt）；400 参数；502 opencode 未就绪。

### 13.4 扩展的既有接口

- `GET /api/apps/:id/design-system`：增加 `origin`、`preview`、`pages[].kind/source/contractFile`；
  老客户端忽略新字段；`resolved` 不变。
- `POST /api/apps`/`PATCH /api/apps/:id/design-system`：自定义 pack 可选中；非法 pack/type/style 仍 400；
  内置/自定义选择逻辑不变。
- `POST /api/apps/:id/chat` / `GET|PUT /api/apps/:id/model`：继续用 `isAppView` 校验，`template` **不是合法 AppView**；
  应用路由不会进入工作室会话（非法值按现有语义处理，不新增应用侧 `template` 分支）；工作室用 `isSessionView`。
- `POST /api/apps/:id/design-fidelity`：输出增加 `checks[].id='template-contract'`（13 项），summary 数量变化；
  旧响应字段不变。
- `GET /preview.html`、`GET /design-preview.html`：保持；新增 `GET /template-preview.html`。

### 13.5 静态入口

| 路径 | 说明 |
| --- | --- |
| `/template-preview.html` | 新 Vite 入口；缺失 404（不回落 index），`/assets/*` 正常 |
| `/preview.html` | 新增 `structurePack/structureDraft` query |
| `/design-preview.html` | 支持自定义 `design-system.preview` |

---

## 14. UI 清单

### 14.1 模板中心（browse）

- 顶部 tabs：全部 / 平台管理 / 运营管理 / 数据分析 / 工具应用 / **自定义**（`category:custom`）。
- 内置卡片照旧；**自定义模板卡片**：
  - 名称、风格、`页面 N（reference a · contract b）`、版本、引用应用数；
  - 操作：进入工作室、编辑、删除、预览（页面库）；
  - “新建自定义模板”主按钮。
- 新建对话框：名称、风格（4 选 1）、baseApplicationType（默认企业级）、可选“让 agent 决定页面”；
  创建后跳 `#/studio/<packId>`。
- 删除：二次确认；409 时列出引用应用（链接到应用设计视图）。
- picker 模式：内置 + 自定义分组；选中自定义返回 pack/type/style；底部“使用此模板”。

### 14.2 工作室布局（`StudioView`）

```text
┌────────────────────────────────────────────────────────────────────┐
│ 头部：返回模板中心 | 模板名 · 版本 · 状态（草稿/已发布） | 模型设置    │
├──────────────┬───────────────────────────────┬─────────────────────┤
│ 左：页面/spec │ 中：AgentChatPanel（工作室 API）│ 右：预览            │
│ - kind 标签   │ - 历史/新建/停止/compact       │ - 页面选择          │
│ - 页面顺序    │ - 权限/表单/工具时间线         │ - iframe            │
│ - 校验/警告   │ - 首条提示/命令                │ - 打开新窗口        │
├──────────────┴───────────────────────────────┴─────────────────────┤
│ 底部：生成预览 | 发布 | 丢弃草稿/删除模板 | 校验摘要 | 最后生成时间     │
└────────────────────────────────────────────────────────────────────┘
```

- 左：页面列表（id/名称/kind/recipe/来源）、spec 错误/警告（点击定位 path）、catalog 快捷入口（可选）。
- 中：复用 `AgentChatPanel`；API 适配到 studio；首条提示由 studio state 返回；无 module 概念。
- 右：`template-preview.html` iframe；页面下拉；未生成时提示；发布后仍可预览草稿。
- 底部：
  - “生成预览” → `POST generate`；失败显示 errors（path/message），成功刷新预览；
  - “发布” → 二次确认（版本将 +1；引用应用下次打开同步）→ `POST publish`；成功 toast + 版本更新；
  - “丢弃草稿”（未发布）/“删除模板”（已发布，走删除保护）；
  - 显示 `generation.css` 冲突摘要（3 条以内 + 展开）。
- 错误态：工作室资产未加载（重载按钮）、opencode 未就绪（沿用现有设置面板提示）、spec 不存在（显示“让 agent 先确定页面清单”）。

### 14.3 设计视图 / 新建应用

- 设计视图徽标：自定义模板名 + 版本；tooltip 显示 pack id/来源；点击打开模板中心自定义分类。
- 模板页面库：页面卡显示 kind（`blueprint`/`reference`/`contract`）、来源（`运营管理/list`）、recipe；contract 页显示“无蓝图”。
- 新建应用：设计模板摘要显示自定义名称 + 风格；picker 自定义分组；创建后提示“已生成蓝图/契约/样式”。
- 开发视图设计参考：显示模板 kind；contract 页提示“按契约实现”；ui-check 状态照旧。

### 14.4 空态/错误文案（统一）

| 场景 | 文案 |
| --- | --- |
| 无自定义模板 | “还没有自定义模板；进入工作室，让 AI 根据你的业务组装一个。” |
| 草稿未生成 | “尚未生成预览；先与 AI 确认页面清单，再点‘生成预览’。” |
| 生成失败 | “spec 有 N 处错误（路径/原因）；修正后重新生成。” |
| 发布被引用 | “模板仍被 N 个应用引用：…；请先在应用中切换模板。” |
| 权限阻止 | “AI 尝试修改受管文件，已被工作室权限阻止；请只修改 spec.json。” |
| 预览加载失败 | “预览加载失败（结构样式/页面）；可重试或查看生成报告。” |

---

## 15. 分批实施

### 15.1 P7-7a 底座（pack 模型 + 生成器 + catalog + 发布 API）

**范围**

- `backend/src/design/pack.ts`：扩展 `DesignPageMeta`（kind/source/contract/sampleEntity/sampleSubEntities/origin），
  内置页缺省 kind=blueprint 兼容（无 source）、contract 页允许无 blueprint；导出 `validatePackDir(dir, expectedId?)`（**权威**，
  供生成器/发布/运行时校验）。
- 新增 `backend/src/design-template/`：
  - `paths.ts`（studio/draft/pack 路径安全）
  - `core.ts`（通过仓库路径加载 `templates/workshop/skills/adw-design-template-authoring/scripts/lib/*.cjs`）
  - `spec.ts`（类型/校验包装）、`generator.ts`、`catalog.ts`、`publish.ts`
  - `routes.ts`（catalog/drafts/generate/publish/delete/asset，不含 studio 会话）
- `design/system-routes.ts`：资产/删除接口；`listPacks` 摘要增加 origin/templateKind。
- `backend/src/index.ts`：静态入口暂不加（无模板预览）；`/api/design-templates` 挂载。
- 测试（新增）：
  - pack 扩展：blueprint/reference/contract 三 kind、内置页缺省 kind=blueprint 兼容且无 source、自定义页缺省 kind 报错、非法 kind、reference source 缺失、origin 校验；
  - **内置 pack 回归**：`afcenter-app-templates-v1` 原样加载（25 页无 kind/no source，全部视为 blueprint），
    现有 `pack.test.ts` 的页面数/路径/错误用例不降低；
  - 生成器：fixture spec（reference+contract）→ pack 字节/结构/CSS 报告；错误不落半成品；同 spec 重跑一致；
  - 校验权威：后端 `pack.ts#validatePackDir` 与发布 API 一致；`validate.cjs` 预检结果不替代发布，二者冲突时以后端为准；
  - CSS：spike D 数字/冲突复现；去重/顺序/注释；
  - catalog：25 页/39 组件/**20 键共享映射 `templates/design-system/component-controls.json` ∩ 39 = 13 个可映射控件**；
    前端 `contract-view.js` 与后端 catalog 读同一 JSON，测试断言 20 键完全一致、13/39 不漂移；
  - 组件引用次数与 spike C 一致；
  - contract 预览样例：sampleEntity + sampleSubEntities、subTables target 命中/缺失；树样例保证 `titleField` 唯一
    （是否修复 `buildTreeRows` 由用户确认，设计不自行决定）；
  - 发布：首次 1.0.0、重复发布 1.0.1、spec-changed 409、id 冲突 409、引用应用删除 409、原子失败保留旧 pack；
  - API：catalog/drafts/generate/publish/delete/asset 200/4xx。
- 出口：
  - 临时 `RG_DATA_DIR` 下用 CLI/API 从 fixture spec 生成并发布自定义 pack；
  - `GET /api/design-system` 能看到该 pack，`GET /api/design-system/:id` 通过扩展 loader；
  - 现有后端/前端测试与 `smoke:workspace` 通过；**不改变应用创建/设计/开发行为**。

**影响文件**：`backend/src/design/pack.ts`、`backend/src/design/system-routes.ts`、`backend/src/index.ts`、
`templates/design-system/component-controls.json`（新增共享 20 键映射）、`frontend/src/design/prototype/contract-view.js`
（改为 import 该 JSON，保持导出 API 不变）、新增 `backend/src/design-template/**`、
新增 `templates/workshop/skills/adw-design-template-authoring/scripts/lib/*.cjs`（生成核心源）、
`backend/src/design/pack.test.ts`（扩展）、新增测试文件、`backend/package.json`（测试脚本，如需）。
（`AGENTS.md`/`README.md` 的 `templates/workshop/` 目录说明在 P7-7b 随 skill/command 落地时同步。）

### 15.2 P7-7b 工作室（会话 + UI + 草稿预览）

**范围**

- `sessions/store.ts`：`AppView` 保持三值；新增 `SessionView`/`isSessionView`，`viewOf` 支持 `template`；应用路由仍用 `isAppView`；
- `chat/service.ts`：`ChatTarget` + `handleChat` + `handleAppChat` 包装；`verifyTargetAssets`；
- `dev/service.ts`：内部 target 化（对外签名不变）；
- 新增 `backend/src/design-template/studio.ts` + 路由（§13.3）；`workshop.ts`（§9.2）；
  `workshop.ts` 负责把内置 pack 复制成 `catalog/builtin/` 只读镜像（§6.2）；
- `templates/workshop/skills/adw-design-template-authoring/**` 与 `templates/workshop/commands/generate-design-template.md`；
- 前端：
  - `frontend/template-preview.html` + `src/template-preview/**`；
  - `DesignTemplateCenter.vue` 自定义入口/列表/新建/删除/编辑；
  - `StudioView.vue` + `src/studio/{api.ts,types.ts,spec-helpers.js}`；
  - `frontend/src/App.vue`：路由解析新增 `studio` kind（`#/studio/<packId>`），挂载 `StudioView`；其余仍 `HomeShell`；
  - `AgentChatPanel` 可选 API 适配；
  - `preview.html` `structurePack/structureDraft`；
  - 路由 `#/studio/<packId>`（`App.vue`）。
- **文档/目录**：新增顶层 `templates/workshop/`（skill/command/core 源），P7-7b 同步更新 `AGENTS.md` 的目录与约定、
  `README.md` 目录说明、`docs/plans/README.md`（本设计稿索引已加）；`smoke:assets` 的应用 command 期望仍为 **5**
  （工作室 command 不随应用分发）。
- 测试：
  - 后端：`ChatTarget` 单测、studio state/prompt/expected assets、workshop 资产/权限 JSON、catalog 刷新
    （含 `catalog/builtin/` 镜像 36 文件/580KB、readPath 可读、镜像只读）；
  - 前端：spec/studio helpers、模板中心/工作室纯函数；
  - e2e：新增 `e2e:p7-7b`（stub opencode，临时目录/端口）覆盖创建草稿/工作室打开/空会话/spec 写/生成/预览 reference+contract/发布/删除保护；
    template-preview 只覆盖自定义 `reference`/`contract`，内置 `blueprint` 页仍走 `preview.html` 的既有 e2e；
  - 回归 `e2e:p2/p3/p4`（前端仍走原 API；p4 覆盖 sessions/rename/archive/compact）、`smoke:workspace`、`smoke:assets`（不调模型）；
    工作室 command 放在 `templates/workshop`，**不随应用分发**，`smoke:assets` 的应用 command 期望仍为 5。
- 出口：
  - 临时环境：创建草稿 → （stub/真实 opencode 不调模型）加载 skill/command → 生成 fixture pack → `template-preview` 两种页 → 发布；
  - 模板中心可见/可编辑/可预览/可发布自定义模板；
  - **新建应用 picker 暂不列自定义 pack**（b 阶段 scaffold 尚未支持 contract 页；避免创建半可用应用）；picker 的
    自定义分组在 P7-7c 打开；
  - 现有应用行为不变。

### 15.3 P7-7c 应用闭环 + 真实模型

**范围**

- `design/system-file.ts`：summary/copy contract/合并 structure/preview/origin；
- `apps/scaffold.ts`：AGENTS/README 文案识别 contract 页；
- `templates/distribution.ts`：设计模板 skill 页面 kind/契约段/manifest；
- `backend/src/dev/digest.ts`、`ui-check.ts`、`fidelity.ts`、`scripts/lib/fidelity-core.cjs`、
  `scripts/check-fidelity.mjs`、command 文案；
- 前端：`DesignPreviewApp.vue` 自定义 preview/structure 加载；`DesignView` 徽标/页面库 kind；
  `NewAppDialog` 自定义 picker；`design-system-api.ts` 类型；
- 应用内资产接口 `GET /api/apps/:id/design-system/asset`；
- 测试/回归：
  - 后端：system-file contract/preview、scaffold custom pack、distribution skill、digest/ui-check/fidelity 13 项；
  - 一致性检查：`fidelity.test.ts` 期望同步 13 项；`e2e:p7-6a` 断言数**会变**（当前 15，按实际更新）；
    STATUS 记录实际值，不沿用旧基线；
  - 前端：design-preview 自定义 structure、模板中心/新建应用/设计视图 helpers；
  - e2e：新增 `e2e:p7-7c`（应用从自定义 pack 创建/设计预览/PNG/fidelity）；回归 `p10/p9/preview/p7-3b/p7-4b/p7-6a/p2/p3/p4`；
  - **真实模型闭环**（用户后续授权）：临时目录/端口、真实 `deepseek-flash`；见 §17。
- 出口：
  - 新建应用选自定义模板 → `docs/design/design-system.json`/reference 蓝图/contract 文件/styles/skill 齐全；
  - 设计视图用自定义 structure + design.json 渲染；PNG 截图成功；开发 digest/ui-check/fidelity 识别 contract 页；
  - 真实模型工作室闭环证据落 `docs/plans/evidence/2026-11-21-p7-7-real-model/`。

---

## 评审修正（2026-11-21）

以下按评审编号逐条记录本轮定向修改；未改产品代码/未做 git/未启停真实实例/未调模型。

1. **3300/4771 时点**：开头改为“2026-11-20 曾监听（PID 40704/41744）；2026-11-21 只读核对已无 LISTEN，
   `http://127.0.0.1:3300/api/health` 连接失败，PID 已不存在；设计稿不启停，后续由用户 restart”。
2. **reference 蓝图路径**：所有示例改为 `application-types/operations-management/pages/OperationsList.vue`；
   已按 `pack.json` 核对 overview/treeTable/list/form/detail 等示例，未发现其它不一致（treeTable 为
   `OperationsTreeTable.vue`）。
3. **selection/tree 示例**：contract 示例改为 `"selection": false`（boolean），删除 `"tree": null`；
   不再用对象/ null 触发 schema warning。
4. **组件控件映射口径**：改为“共享 `templates/design-system/component-controls.json` **20 个键**；与 39 个组件并集求交集得到 **13 个可映射控件**（13/39）”；不再让后端解析前端 JS。
5. **kind 三值**：`blueprint`（内置 pack 页面）/ `reference`（自定义引用页）/ `contract`（自定义契约页）；
   内置 25 页没有 `kind`，loader 规则为“缺省 kind + 有 blueprint = **blueprint**（兼容，不要求 source）”；
   自定义页必须显式 `reference`/`contract`；缺省（无论是否有 blueprint）→ `kind-required`；spec 不允许 `blueprint`。
6. **contract 展平**：明确 `contract` 是模板容器；生成器/预览在构造 **synthetic design / design.json 页面**时把
   `filters/columns/rowActions/toolbarActions/selection/pagination/form/tree/subTables/components` 展平为设计页顶层字段；
   `pack.json` 页面顶层 `components` 仍是组件标签清单（string[]），`contract.components` 是字段覆盖 object，二者不互相覆盖；
   `sampleEntity.fields.name` 是列/查询/分组的引用键，`label` 是显示名。
7. **sampleSubEntities**：新增可选 `sampleSubEntities`；synthetic design 的 `entities = sampleEntity + sampleSubEntities`，
   `page.entity = sampleEntity.id`；`subTables.target` 在池内解析；缺失给 `sample-sub-entity-missing` warning。
   已更新 §5.2/5.8/5.9、§8.2、§11.1、§15.1 测试口径与示例。
8. **校验权威**：写死“后端 `pack.ts#validatePackDir` 为权威（发布/运行时）”；CLI `validate.cjs` 仅预检
   （调后端 validate），不替代发布校验；共享核心只负责 spec/css/generator 写入。新增
   `POST /api/design-templates/drafts/:id/validate`。
9. **会话视图**：`AppView` 保持三值；新增 `SessionView = AppView | 'template'` 与 `isSessionView`；
   `viewOf` 对 template 返回自身；应用 chat/model 路由继续 `isAppView`（拒绝 template），工作室用 `isSessionView`。
   已同步 spike F 与证据 README。
10. **权限路径口径**：design 的 allow 规则改为 `*drafts/*/spec.json`、`*drafts/*/notes.md`（前导 `*` 覆盖
    绝对/相对路径）；写明 spike A 未验证真实 edit resource 路径，P7-7b 用真实工具调用复核，生成/发布后端再校验兜底；
    引用官方 `*` 跨 `/`、last match wins。
11. **内置蓝图可读性**：新增 `_workshop/catalog/builtin/` 内置 pack 只读镜像（36 文件、约 580KB，按版本/mtime+hash 刷新）；
    catalog 增加 `readPath`/`structureReadPath` 指向镜像；保留 `external_directory: deny`，不放开仓库读权限。
12. **templates/workshop 目录**：在 P7-7b 影响面写明新增顶层 `templates/workshop/`，并同步更新 `AGENTS.md`、
    `README.md`、`docs/plans/README.md`；`smoke:assets` 应用 command 期望仍为 5（工作室 command 不分发）。
13. **studio 路由**：P7-7b 影响文件增加 `frontend/src/App.vue`（新增 `studio` kind、挂载 `StudioView`，其余走 `HomeShell`）。
14. **origin 时间戳**：`createdAt/updatedAt` 只存在 `draft.json`；`pack.json` 生成阶段不写时间戳，只有发布写
    `publishedAt/revision/version/specHash`；同 spec 重跑 pack 字节一致（`generation.generatedAt` 不入 pack）。
15. **toolbarActions 示例**：删除表单页示例中的 `toolbarActions`（表单页通常不需要，避免未知动作 warning）；
    合法动作列表仍可在字段清单/技能中查。
16. **fidelity 13 项**：写明 `e2e:p7-6a` 当前 15 条断言会变，必须按实际更新；`fidelity.test.ts` 期望同步；
    STATUS/交接单记录实际值，不沿用旧基线。
17. **buildTreeRows**：不自行决定修不修；“P7-7a 是否顺手修复由用户确认”；若不修，contract 树 sample 必须保证
    `titleField` 唯一，P7-7c 真实模型验证检查树页。
18. **COMPONENT_CONTROLS 单一来源**：新增 `templates/design-system/component-controls.json`（20 键，`pm-*` → 控件名）；
    前端 `contract-view.js` 与后端 catalog 生成器都消费同一 JSON，不再让后端解析前端 JS；P7-7a 测试断言
    20 键一致、13/39 交集不漂移。


---

## 16. 风险与未决问题

| # | 风险/未决 | 结论/建议 | 备选 |
| --- | --- | --- | --- |
| 1 | opencode 权限只验证配置归一化，未验证真实工具拒绝 | P7-7b 校验配置/资产；P7-7c 真实模型闭环验证“尝试写受管文件被拒”；不做无模型的伪造工具调用 | 生成器二次校验 + 后端只接受 spec；最严：agent 不写盘，聊天返回 spec |
| 2 | `ChatTarget` 抽取影响 `dev/service.ts`/时间线 | 保留导出签名，内部 target 化；先单测后 e2e p2/p3/p4 回归（116/126/128 不变） | 若风险过高：新增 studio service 复制会话逻辑（分叉，不推荐） |
| 3 | contract 预览能力边界：39 组件中 13 个可映射控件（共享 `component-controls.json` 共 20 键），其余容器固定结构 | 设计稿/技能明确“契约只覆盖能力内”；contract 页不承诺任意 pm-* 属性 | 后续扩展 `component-controls.json`/ContractPage |
| 4 | `buildTreeRows` 重复子节点导致 roots 重复 | **P7-7a 是否顺手修复由用户确认**；若不修，contract 页 sample 数据必须保证 `titleField` 唯一，并在 P7-7c 真实模型验证中检查树页 | 用户确认后单独小修 P9（需另立单测） |
| 5 | 自定义 structure 合并可能覆盖源页样式（3 条真冲突） | 固定来源顺序 + 冲突报告；发布 warnings；UI 显示；agent 可调整页面顺序 | 按来源类型加 CSS scope（工作量大，本期不做） |
| 6 | 自定义 reference 页预览依赖“字节快照 == 内置源页” | 生成器校验 sha256；pack 记录 source.sha256；发布校验；blueprint 页不经 template-preview | 为 reference 加运行时 Vue 编译（明确不做） |
| 7 | 自定义 pack 只有一个 applicationType（id=pack id） | 满足本期；skill 命名天然唯一；UI 分类 custom | 若未来多类型：skill id 需加 pack 前缀/新命名（另设计） |
| 8 | draftId=packId 不可变；改名只改显示名 | UI 明确“id 不可改”；API 不接受 id 更新 | 允许迁移（需同步应用契约路径，不做） |
| 9 | 共享 location 下 agent 理论上可写其它草稿 spec | 生成/发布只读指定草稿；每个 spec 独立校验；会话 prompt 约束 | 每草稿复制 `.opencode`（spike B3 证明可行但资产重复） |
| 10 | 发布不主动同步已打开应用 | 文档/UI 提示“下次打开应用生效”；`ensureWorkspaceAssets` 幂等覆盖 | 发布后后台同步（需处理开发中覆盖，风险高） |
| 11 | 删除被引用 pack 409；手工移除外置 pack | `resolveAppDesignSystem` 已有失效回退默认 + warning；不自动删除应用文件 | 迁移 UI/自动回退（本期不做） |
| 12 | 真实模型是否按 catalog/skill 写 spec | P7-7c 计划验证；catalog 控制体积（组件片段截断）；skill 给示例 | 失败则加强示例/减少自由文本/提供 spec 生成表单 |
| 13 | CSS 合并只支持当前模式（无 `url()`/嵌套） | spike D 已确认当前 pack 无 `url()`；未来出现则报 warning 并复制资产 | 引入 PostCSS（新增依赖，不做） |
| 14 | `opencode.json` 会合并全局/祖先配置 | 工作室根无祖先项目配置；仍可能合并用户全局 rules；以项目级 rules 覆盖 | 启动时检测异常配置并提示（P7-7b） |
| 15 | 发布/生成并发 | API 单飞锁（同一 draft）；多实例不设计 | 文件锁/队列（不做） |
| 16 | 模板中心 iframe 重复风格切换器（P7-3b 已知） | 自定义预览 `embed=1` 隐藏切换器；内置保持现状 | 后续统一预览工具 |
| 17 | 自定义 style 修改（tokens）不支持 | 本期复制内置风格；明确“风格固定” | 动态 style API + registry 改造（后续） |

---

## 17. 真实模型验证计划（本轮不执行）

### 17.1 环境

- 临时根：`%TEMP%\workbench-p7-7-real-<rand>`；
- `RG_DATA_DIR`/`RG_PROJECTS_DIR` 指临时根；后端端口 **3487**，opencode 端口 **4787**（不使用 3300/4771）；
- 真实模型 `packycode-deepseek/deepseek-flash`；真实 opencode 2.2.5；
- 不读写真实 `data/`、`projects/`、`.env`；不 git；结束 kill 进程树并确认端口释放。

### 17.2 步骤（驱动脚本，参考 P7-6b）

1. 启动临时后端（真实 opencode serve），创建工作室草稿（style=`data-cyan`，base=`enterprise-application-platform`）；
2. 发送 prompt（示例）：
   > 帮我做一个“供应商管理”设计模板：供应商列表（reference 运营管理的 list）、供应商新建/编辑（contract dialog-form）、
   > 供应商详情（contract detail）；风格数据蓝青。先读 catalog，告诉我页面清单与字段，再写 spec。
3. 等待空闲（超时 10 分钟）；检查 spec 存在、catalog/.opencode/仓库未被修改（前后哈希）；
4. 让 agent 运行 `generate-design-template`（或手工调用生成 API）；检查 errors/warnings；
5. 用户动作模拟：发布；检查版本 1.0.0；
6. 新建应用选择该 pack；检查 scaffold 文件：reference 蓝图/contract 文件/合并 structure/style/skill/design-system.json；
7. 生成模块 design.json（可复用现有设计会话），打开 `design-preview` / 导出 PNG；
8. 开发视图：检查 digest/ui-check/fidelity 13 项（contract 页跳过蓝图、契约文件存在）；
9. 记录消息数/工具数/耗时/错误/权限拒绝；保存 `design.json`/spec/pack/截图/日志到证据目录。

### 17.3 成功标准

- agent 只写 `spec.json`/`notes.md`；无权限越界；无 `.opencode`/catalog/仓库修改；
- spec 中 reference 引用均为 catalog 真实 id；contract 页字段来自 sampleEntity；生成 0 error；
- 发布成功、版本 1.0.0；应用创建成功；reference/contract 产物齐全；
- 设计预览/PNG 正常（0 console error/pageerror/外部请求）；fidelity 无 fail；
- 结果写入 `docs/plans/evidence/2026-11-21-p7-7-real-model/`，STATUS/交接单更新。

### 17.4 失败处理

- 模型未写 spec/写错目录：记录权限/提示词问题，不伪造成功；
- 生成器错误：保留 spec 与 generation 输出，回合后修复 skill/示例；
- 预览/PNG 失败：区分结构样式加载、contract mock、html2canvas；
- 真实模型不可用/额度不足：记录环境原因，不降级为 stub 结果。

---

## 18. 边界

- **不改 DB 表/列**：`apps`/`app_settings`/`app_sessions`/`requirement_templates` 结构不变；`view='template'` 只是值。
- **不改需求模板中心**：`TemplateLibraryDialog`、`requirement_templates`、`adw-template-req-*`、模块 frontmatter 不动。
- **不改真实实例**：不启停 3300/4771；不读写真实 `data/`/`projects/`/`.env`；所有验证用临时目录与独立端口。
- **不做 git**（init/commit/revert/status）。
- **不改内置 pack 内容**（`templates/design-system/**` 只读；自定义写 `data/design-system`）。
- **不新增运行时依赖**；生成器核心只用 Node 内置模块；前端不新增重依赖（`template-preview` 复用现有 Vue/ContractPage）。
- **不迁移旧应用/旧 pack**；旧应用无 `preview/origin/kind` 继续可读；内置 pack 页面无 `kind` 时按 **blueprint** 兼容。
- **不承诺 EOS/AFCenter 宿主运行态**；pm-* 仍由宿主提供；PNG/风格只约束 Vue3 前端。
- **不做回滚/备份/并发锁**；发布原子替换，失败保留旧 pack。

---

## 19. 附录

> 以下 JSON 均为示例（`jsonc` 注释/`...` 表示省略），实际字段以 loader/spec schema 为准。

### 附录 A：spec 示例

```jsonc
{
  "schemaVersion": 1,
  "id": "supplier-hub",
  "name": "供应商管理模板",
  "description": "供应商台账、弹窗表单与详情页",
  "baseApplicationType": "enterprise-application-platform",
  "style": "data-cyan",
  "pages": [
    {
      "id": "supplier-list",
      "name": "供应商列表",
      "kind": "reference",
      "source": {
        "pack": "afcenter-app-templates-v1",
        "applicationType": "operations-management",
        "pageId": "list"
      }
    },
    {
      "id": "supplier-form",
      "name": "供应商表单",
      "kind": "contract",
      "type": "form",
      "recipe": "dialog-form",
      "contract": {
        "form": {
          "presentation": "dialog",
          "columns": 2,
          "width": 900,
          "groups": [
            { "title": "基本信息", "fields": ["name", "code", "status"] },
            { "title": "扩展信息", "fields": ["owner", "amount", "remark"] }
          ]
        },
        "components": { "owner": "pm-select-user" }
      },
      "sampleEntity": {
        "id": "supplier",
        "name": "供应商",
        "fields": [
          { "name": "code", "label": "供应商编码", "type": "string" },
          { "name": "name", "label": "供应商名称", "type": "string" },
          { "name": "status", "label": "状态", "type": "enum", "options": ["启用", "停用", "草稿"] },
          { "name": "owner", "label": "负责人", "type": "string" },
          { "name": "amount", "label": "年度金额", "type": "decimal" },
          { "name": "remark", "label": "备注", "type": "string" }
        ]
      }
    },
    {
      "id": "supplier-detail",
      "name": "供应商详情",
      "kind": "contract",
      "type": "detail",
      "recipe": "detail",
      "contract": {
        "columns": ["code", "name", "status", "owner", "amount"],
        "subTables": [{ "entity": "supplier-contact", "title": "联系人", "columns": ["contactName", "phone"], "mode": "tab" }]
      },
      "sampleSubEntities": [
        { "id": "supplier-contact", "name": "联系人", "fields": [
          { "name": "contactName", "label": "联系人", "type": "string" },
          { "name": "phone", "label": "电话", "type": "string" }
        ] }
      ],
      "sampleEntity": {
        "id": "supplier",
        "name": "供应商",
        "fields": [
          { "name": "code", "label": "供应商编码", "type": "string" },
          { "name": "name", "label": "供应商名称", "type": "string" },
          { "name": "status", "label": "状态", "type": "enum", "options": ["启用", "停用", "草稿"] },
          { "name": "owner", "label": "负责人", "type": "string" },
          { "name": "amount", "label": "年度金额", "type": "decimal" },
          { "name": "remark", "label": "备注", "type": "string" }
        ]
      }
    }
  ]
}
```

### 附录 B：pack.json 示例（自定义）

```jsonc
{
  "schemaVersion": 1,
  "id": "supplier-hub",
  "name": "供应商管理模板",
  "version": "1.0.0",
  "defaultApplicationType": "supplier-hub",
  "defaultStyle": "data-cyan",
  "origin": {
    "kind": "custom",
    "draftId": "supplier-hub",
    "builtFrom": { "pack": "afcenter-app-templates-v1", "version": "1.0.0" },
    "baseApplicationType": "enterprise-application-platform",
    "style": "data-cyan",
    "revision": 1,
    "specHash": "sha256:...",
    "publishedAt": "2026-11-21T10:05:00.000Z"
  },
  "applicationTypes": [{
    "id": "supplier-hub",
    "name": "供应商管理模板",
    "category": "custom",
    "description": "供应商台账、弹窗表单与详情页",
    "structure": "application-types/supplier-hub/structure.css",
    "assets": ["application-types/supplier-hub/assets/ledger-workflow.svg"],
    "defaultStyle": "data-cyan",
    "pages": [
      {
        "id": "supplier-list", "name": "供应商列表", "type": "list", "recipe": "list",
        "preview": "list", "description": "供应商台账",
        "kind": "reference",
        "blueprint": "application-types/supplier-hub/pages/supplier-list.vue",
        "source": {
          "pack": "afcenter-app-templates-v1",
          "applicationType": "operations-management",
          "pageId": "list",
          "blueprint": "application-types/operations-management/pages/OperationsList.vue",
          "sha256": "..."
        },
        "components": ["pm-search", "pm-table", "pm-pagination"],
        "blocks": 8
      },
      {
        "id": "supplier-form", "name": "供应商表单", "type": "form", "recipe": "dialog-form",
        "preview": "form", "description": "新建/编辑供应商",
        "kind": "contract",
        "contract": { "form": { "presentation": "dialog", "columns": 2, "width": 900, "groups": [{ "title": "基本信息", "fields": ["name", "code", "status"] }] } },
        "sampleEntity": { "id": "supplier", "name": "供应商", "fields": [
          { "name": "code", "label": "供应商编码", "type": "string" },
          { "name": "name", "label": "供应商名称", "type": "string" },
          { "name": "status", "label": "状态", "type": "enum", "options": ["启用", "停用", "草稿"] }
        ] },
        "components": ["pm-form-dialog", "pm-input", "pm-select"],
        "blocks": 0
      }
    ]
  }],
  "styles": [{ "id": "data-cyan", "name": "数据蓝青", "className": "visual-style-data-cyan",
    "css": "styles/data-cyan/style.css", "description": "蓝青冷色、卡片层次、轻网格和偏数据科技的视觉表达。", "signature": "#145fba",
    "tokens": { "primary": "#145fba", "accent": "#07858d", "neutral": "#66758a", "background": "#f3f7fb", "radius": 12, "density": "compact" } }],
  "skills": ["afcenter-page-generation", "pm-components-usage"],
  "componentMap": { "string": "pm-input", "text": "pm-textarea", "number": "pm-number", "decimal": "pm-number",
    "boolean": "pm-switch", "date": "pm-datepicker", "datetime": "pm-datepicker", "enum": "pm-select", "ref": "pm-select" },
  "pageRecipes": { "list": ["BusinessListPage", "QueryPanel", "RowActions", "ThreePartPagination"],
    "tree-list": ["TreeListPage", "TreePanel", "QueryPanel", "RowActions"],
    "dialog-form": ["pm-form-dialog", "FormSection"],
    "page-form": ["StandardFormPage", "FormSection"],
    "main-sub": ["StandardFormPage", "FormSection", "el-tabs"],
    "detail": ["detail sections", "related lists"],
    "dashboard": ["metric cards", "pm-echarts"],
    "wizard": ["pm-steps", "FormSection"] },
  "conformance": ["列表/树/表单优先使用 PageTemplates", "..."]
}
```

### 附录 C：catalog 示例

```jsonc
// pages.json（一条）
{
  "catalogRef": "operations-management/list",
  "pack": "afcenter-app-templates-v1",
  "packVersion": "1.0.0",
  "applicationType": "operations-management",
  "applicationTypeName": "运营管理",
  "pageId": "list",
  "name": "通知公告管理",
  "kind": "blueprint",
  "type": "list",
  "recipe": "list",
  "description": "...",
  "blueprint": "application-types/operations-management/pages/OperationsList.vue",
  "readPath": "catalog/builtin/afcenter-app-templates-v1/application-types/operations-management/pages/OperationsList.vue",
  "components": ["pm-search", "pm-table", "pm-pagination", "pm-toolbar", "pm-toolbar-item"],
  "structure": "application-types/operations-management/structure.css",
  "structureReadPath": "catalog/builtin/afcenter-app-templates-v1/application-types/operations-management/structure.css",
  "assets": ["application-types/operations-management/assets/ledger-workflow.svg"]
}

// components.json（一条）
{
  "name": "pm-select",
  "category": "control",
  "tagReferences": 97,
  "pageReferences": 24,
  "pages": ["enterprise-application-platform/applications", "..."],
  "contractControl": "select",
  "contractSupported": true,
  "componentMapTypes": ["enum", "ref"],
  "mappingSource": "templates/design-system/component-controls.json",
  "snippets": ["<pm-select size=\"default\" v-model=\"form.status\" :settings=\"statusSettings\" />"]
}
```

### 附录 D：CSS 合并算法

```text
input: ordered sourceTypes（reference 首次出现顺序 + baseApplicationType 去重）
output: structure.css

for each sourceType in order:
  css = read(application-types/<sourceType>/structure.css)
  rules = parse(css)   # 顶层规则 + @media 内规则；去注释
  for each rule:
    key = (media, normalize(selector), normalize(body))
    if key not in seen:
      seen.add(key)
      emit(rule.raw)   # 保留原始文本；首段加注释 "/* source: <type> */"
    else:
      duplicateCount += 1
    if selector+media seen with different body:
      conflicts.add({selector, media, sourceType, previousSources})
```

- 输出按来源类型分节，段首注释 `/* ===== <type> ===== */`；
- 同选择器不同规则体全部保留（后写覆盖），冲突写入 `generation.css.conflicts` 与发布 warnings；
- 现有基数：793 → 514（省 279）；3 条跨类型真冲突（见 §8.4）。

### 附录 E：页面命名/契约文件

| 对象 | 规则/示例 |
| --- | --- |
| pack id | `supplier-hub` / `procurement-ops-7f3a` |
| applicationType id | 同 pack id（唯一） |
| page id | `supplier-list`、`supplier-form`、`supplier-detail` |
| reference blueprint | `docs/design/template/<packId>/pages/<pageId>.vue` |
| contract file | `docs/design/template/<packId>/contracts/<pageId>.json` |
| app design.json catalogRef | `<packId>/<pageId>` |
| 设计模板 skill | `adw-template-proto-<packId>`（内置仍 `adw-template-proto-<applicationType>`） |

### 附录 F：contract 文件与 design-system.json 形态

`docs/design/template/<packId>/contracts/<pageId>.json`：

```jsonc
{
  "schemaVersion": 1,
  "pageId": "supplier-form",
  "name": "供应商表单",
  "recipe": "dialog-form",
  "contract": { "form": { "presentation": "dialog", "columns": 2, "width": 900, "groups": [{ "title": "基本信息", "fields": ["name", "code", "status"] }] } },
  "sampleEntity": { "id": "supplier", "name": "供应商", "fields": [
    { "name": "code", "label": "供应商编码", "type": "string" },
    { "name": "name", "label": "供应商名称", "type": "string" },
    { "name": "status", "label": "状态", "type": "enum", "options": ["启用", "停用", "草稿"] }
  ] },
  "sampleSubEntities": []
}
```

应用 `design-system.json` 见 §12.2（含 `origin/preview/pages[].kind/source/contractFile`）。

### 附录 G：生成器错误/警告码

| 类型 | 代码（摘要） |
| --- | --- |
| error | `spec-invalid`、`spec-version`、`pack-id-invalid`、`page-id-invalid`、`page-count`、`source-missing`、`source-page-missing`、`kind-invalid`、`kind-required`、`contract-recipe-unsupported`、`contract-missing`、`sample-entity-missing`、`sample-sub-entity-invalid`、`blueprint-on-contract`、`style-missing`、`base-type-missing`、`asset-collision` |
| warning | `page-field-unknown`、`sample-sub-entity-missing`、`component-unknown`、`reference-component-extra`、`tree-parent-missing`、`css-conflict`、`asset-import-missing` |
| publish | `spec-changed`(409)、`pack-id-exists`(409)、`publishing`(409)、`pack-referenced`(409)、`builtin-readonly`(403) |

### 附录 H：Spike 证据索引

`docs/plans/evidence/2026-11-21-p7-7-spike/`：

- `README.md`（目的/环境/命令/结果/结论/限制）
- `spike-a-opencode-permission.md` + `opencode-a1/a2.json` + `spike-a*-workspace-config.json`
- `spike-b-skill-load.mjs` + `spike-b-result.txt`；`spike-b3-*`（location 负结果）
- `spike-c-catalog-scan.mjs` + `spike-c-catalog.json` + `spike-c-result.txt`
- `spike-d-css-merge.mjs` + `spike-d-css.json` + `spike-d-result.txt`
- `spike-e-contract-preview.mjs` + `spike-e-contract.json` + `spike-e-result.txt`
- `spike-f-chat-target.md`

---

## P7-7a 实施记录（2026-11-21）

> 范围：设计稿 §15.1（pack 模型 + 共享映射 + spec→pack 生成核心 + catalog + 草稿/生成/发布/删除 API + `buildTreeRows` 修复 + 单测）。
> **未做**：工作室对话/会话/资产初始化（P7-7b）、模板中心 UI / 新建应用 picker / `template-preview.html`（P7-7c）、
> scaffold/应用闭环、真实模型、真实 3300/4771 启停。

### 1. 改动文件

| 类别 | 文件 |
| --- | --- |
| pack 模型 | `backend/src/design/pack.ts`（`DesignPageMeta.kind/source/contract/sampleEntity/sampleSubEntities`、`origin`、`validatePackDir`、`getBuiltinPack`、`templateKind`）；`backend/src/design/errors.ts`（可选 `code/details`）；`backend/src/design/system-file.ts`（contract 页在 P7-7a 明确 400；blueprint 页行为不变）；`backend/src/design/system-routes.ts`（资产/删除接口）、`backend/src/index.ts`（挂载 `/api/design-templates`） |
| 共享映射 | 新增 `templates/design-system/component-controls.json`（20 键）；`frontend/src/design/prototype/contract-view.js`（import JSON + 导出 `COMPONENT_CONTROLS`，映射键/值不变） |
| 生成核心 | 新增 `templates/workshop/skills/adw-design-template-authoring/scripts/lib/{spec,css,generator}.cjs`、`scripts/{generate,validate}.cjs`、`references/spec.schema.json` |
| 后端模块 | 新增 `backend/src/design-template/{paths,core,spec,draft,generator,catalog,publish,routes}.ts`（比 §15.1 多一个 `draft.ts`，放置草稿 CRUD/反写，避免 `publish.ts` 与路由互相依赖） |
| 测试 | 扩展 `backend/src/design/pack.test.ts`；新增 `backend/src/design-template/{spec,css,generator,catalog,publish,routes}.test.ts`；`backend/package.json` test 列表；`frontend/src/design-preview/contract-preview.test.mjs`（+3 回归）、`frontend/src/design/prototype/contract-view.test.mjs`（+1 一致性） |
| 前端修复 | `frontend/src/design-preview/contract-preview.js#buildTreeRows` |

### 2. 口径与实现要点

1. **kind 三值与兼容**：内置/非自定义 pack 页面缺省 `kind` + 有 `blueprint` → `blueprint`（无 `source`）；自定义 pack 判定以 `origin.kind === 'custom'` 为准（保证无 `origin` 的旧自定义目录仍可读）；自定义页缺省 kind → 400；`contract` 禁止 `blueprint`，必须有 `contract + sampleEntity`；`reference` 必须有 `blueprint + source`，`source.pack` 只允许内置 pack 且页面必须存在。
2. **权威校验**：`validatePackDir(dir, expectedId?)` 只读文件、不走 mtime 缓存；生成器暂存目录名是 `pack`，显式传 expectedId，发布后再按 `<dataDir>/design-system/<packId>` 正常规则加载；发布前后都走它。`POST /drafts/:id/validate` 返回 spec 校验 + pack 权威校验合并后的 `errors/warnings`（pack 部分是权威）；CLI `validate.cjs` 只调它预检，不替代发布。
3. **contract 容器 vs pack 页面字段**：`pack.json` 页面顶层 `components` 是 `string[]`（reference 取源页面；contract = `contract.components` 值 + `pageRecipes[recipe]` 并集）；`contract.components` 是字段覆盖 object，原样留在 `contract` 内；synthetic design（`spec.cjs#buildSyntheticDesign`）才把 filters/columns/rowActions/toolbarActions/selection/pagination/form/tree/subTables/components 展平为页面字段。
4. **sampleEntity/sampleSubEntities**：contract 必填主实体；可选子实体；`entities = [主实体, ...子实体]`、`page.entity = 主实体.id`；`subTables.entity/target` 不在池内 → `sample-sub-entity-missing` warning。
5. **CSS 合并**：顺序 = reference 首次出现顺序 + `baseApplicationType`（去重）；三元组去重保留首次原文；同选择器不同规则体全部保留并记录 `css-conflict`；`@media` 内规则带 media 参与键；`@keyframes` 原样保留但不计入基线（`atRules` 单独计数）。
6. **版本/时间戳**：`pack.json` 生成阶段不含 `createdAt/updatedAt/publishedAt`；`origin.revision` = 已发布 revision（未发布 0），`version` = `1.0.0`（未发布）或 `1.0.<已发布 revision>`；发布时 `revision+1`、`version = 1.0.<revision-1>` 并写 `publishedAt/specHash`；同 spec 重跑 pack/页面/样式字节一致（仅 `generation.json.generatedAt` 变）。
7. **catalog**：`catalog/{index,pages,components,styles,recipes}.json` + `examples/`（5 个）；组件扫描 `/<(pm-[a-z0-9-]+)/g`，片段最多 3 条/260 字符/单行化；`contractControl` 来自共享 JSON（20 键），39 组件 ∩ 20 键 = **13**；`readPath`/`structureReadPath` = `catalog/builtin/<packId>/<pack 相对路径>`（镜像本身 P7-7b 落地）；`index.sourceHash` = pack 版本 + pack.json mtime；确定性排序 + `.tmp`→rename 原子写；`generatedAt` 只属缓存。
8. **删除保护**：内置 403；非 custom/不存在 404；扫描 `app_settings` 的 `app.<id>.design.pack`（JSON 字符串或纯字符串都兼容）→ 409 `pack-referenced` + `{apps:[{id,name}]}`；删除同时移除草稿（若存在）并归档 `__template__:<packId>` 会话（P7-7b 使用；当前无会话行也安全）。
9. **`buildTreeRows` 修复**：旧实现当子节点已挂载时不再 `continue`，会落到 `roots.push`，同一节点既在 `children` 又出现在 `roots`（spike E 的重复机构场景）。修复为：有父节点时始终 `continue`（只挂载一次），并把该节点从 `roots` 移走（兼容“先出现为根、后出现带父级”）；无 `parentField`/匹配不到时仍按 `titleField` 去重扁平化。

### 3. 验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `node backend/node_modules/typescript/bin/tsc -p backend/tsconfig.json --noEmit` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **191 / 191**（原 133 + 新增 58：pack +10、spec 16、css 5、generator 7、catalog 6、publish 7、routes 7） |
| `npm run build --prefix frontend` | 通过（多入口；JSON import attribute 通过 Vite/esbuild） |
| `npm test --prefix frontend` | **146 / 146**（原 142 + `buildTreeRows` 回归 3 + 共享映射一致性 1） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run e2e:p9 --prefix backend` | **70** 条断言（端口 3446 已关闭） |
| `npm run e2e:p10 --prefix backend` | **79** 条断言（端口 3447 已关闭；overview 2880×1996、main-sub 2880×2002，data-cyan 主色像素 > 0） |
| `npm run e2e:p7-4b --prefix backend` | **48** 条断言（端口 3444 已关闭） |
| `npm run e2e:p3 --prefix backend` | **126** 条断言 |
| `npm run e2e:preview --prefix backend` | **83** 条断言 |
| `npm run e2e:p7-3b --prefix backend` | **38** 条断言 |
| `npm run e2e:p7-6a --prefix backend` | **15** 条断言 |
| `npm run e2e:p2 / p4 --prefix backend` | **116 / 128** 条断言 |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型） |

### 4. 测试覆盖（新增/扩展）

- **pack**：内置 25 页全部 kind=blueprint/无 source；非自定义页带 source 400；自定义 pack（origin）reference+contract 可读；页面缺省 kind 400；contract 带 blueprint/缺 sampleEntity/缺 contract 400；reference 缺 source/源页不存在/源 pack 非内置 400；sampleSubEntities id 重复/空 fields 400；origin kind/revision/draftId/单类型校验；`validatePackDir(staging, expectedId)` 与错误不抛；contract 软校验 warning（字段/子表/树/动作枚举）。
- **spec**：合法 reference+contract（默认 base/style、type/recipe/preview 推断、hash 稳定）；缺省 base 来源；schemaVersion/name/pages/pack id/page id 错误码；kind 缺省/blueprint/未知；blueprint-on-contract；source-missing/source-page-missing；contract/sampleEntity/sampleSubEntities；recipe 不支持与按 type/契约形态推断；style/base 缺失；warning 路径（`pages[i].contract.*`）；synthetic design（entities 池、展平、`subTables` 命中/缺失、design.schema.json 校验 0 error）。
- **css**：内置 4 套 793/514/279/3 冲突 + 2 个 @keyframes；确定性；去注释/原文保留/@media；三元组去重与同选择器冲突顺序；media 参与键。
- **generator**：reference 字节快照 + `source.sha256`/components/blocks；contract 不写 `.vue`、contract/sample 保留、`components` 命名空间不覆盖；styles/shared/style/structure/assets；`publishedRevision` → 版本；同 spec 两目录字节一致；失败清理；contract-only；asset-collision；蓝图 import 缺失 warning。
- **catalog**：25 页/39 组件/4 风格/8 配方；20 键 ∩ 39 = 13（前后端同源）；组件引用次数与 spike C 一致（pm-select 97/24、pm-table 21/18、pm-toolbar-item 52/9）；readPath 口径/顺序；确定性；examples 能被 spec 校验；ensureCatalog 原子写/缓存/sourceHash/force。
- **publish/routes**：1.0.0→1.0.1；spec-changed 409；破坏 pack 400 且旧版本保留；内置 403；引用应用 409 + `details.apps`；删除后草稿移除；DELETE draft → 反写 spec → 再发布；catalog/drafts/generate/validate/asset/publish/delete 的 200/400/403/404/409；路径穿越/非法扩展 400。

### 5. 偏差 / 未验证项

1. `@keyframes` 保留输出但不计入 793/514 基线（spike D 只统计普通规则 + @media 内规则）。当前 2 条：`classic-page-in`、`pm-scan`。
2. 自定义 pack 严格规则以 `origin.kind=custom` 判定；无 origin 的旧自定义目录继续按 blueprint 兼容。
3. `design/system-file.ts` 对 contract 页明确 400（应用闭环留给 P7-7c）；当前 picker/scaffold 未开放自定义模板，现有应用路径不变。
4. `catalog/builtin/` 镜像本身未落地（P7-7b），P7-7a 只固定 catalog 的 `readPath` 口径。
5. CLI `generate.cjs` 在后端不可达时只给 warning（本地生成成功退出 0）；`validate.cjs` 后端不可达退出 2；发布仍以后端 `publishDraft` 为权威。
6. 未验证（P7-7a 当时口径；后续 7b-1/2a/2b 已完成部分见对应记录；7c 仍未做）：工作室会话/权限/资产初始化（P7-7b）；模板中心 UI/picker/`template-preview.html`（P7-7c）；scaffold contract 闭环、digest/ui-check/fidelity 13 项；真实模型；真实 3300/4771 启停与人工验收；Windows 下原子替换的极端中断（只有逻辑回滚，未做故障注入）；`buildTreeRows` 修复未新增树页专项 e2e 断言（单测 + p9/p10 树/列表渲染回归）。
7. JSON 读取容忍 UTF-8 BOM（spec/pack/workshop）；CLI 手测：临时工作室生成 pack 成功、重跑包字节一致、后端不可达时 `generate.cjs` 退出 0（带 warning）、`validate.cjs` 退出 2。

### 6. 评审收口（2026-11-21）

- **保留 id 加固**：`scripts/lib/spec.cjs` 的保留 id 判断改为 `reserved.includes(packId)`（去掉 `&& packId !== draftId`），
  避免“手工创建的草稿 id 恰好等于内置应用类型 id”绕过；调用方仍把当前 packId 从 `reservedIds` 过滤掉。
  `backend/src/design/pack.ts` 新增并导出 `isBuiltinPackId(packId)`（只接受合法 id，按 `templates/design-system/<id>/pack.json` 判定）
  与 `listBuiltinPackIds()`；`createDraft`/`publishDraft`/`deleteCustomPack` 统一按“所有内置 pack id”拒绝（新建 400、发布/删除 403）；
  `spec.ts#normalizeDraftSpec` 默认把全部内置 pack id 并入保留列表（核心另加内置应用类型 id）。
- **文档运行态校正**：`docs/STATUS.md`、`AGENTS.md`、`README.md` 的“当前 3300/4771 有监听”统一为
  “**2026-11-20 曾监听（PID 40704/41744，16:15:08）；2026-11-21 只读核对已无 LISTEN、`/api/health` 连接失败、PID 不存在；
  设计/实施不启停，后续由用户 `restart.cmd`/`restart.sh`；以实际为准**”；不改历史事实段落。README 顶部状态改为
  “P7-7a 已实施（待评审），P7-7b/c 未做”。历史交接单 `2026-11-20-phase1-handover-and-next-session-prompt.md`
  只在文首加后继说明，不重写正文。
- **验证**：`npm run build --prefix backend` 通过；`node backend/node_modules/typescript/bin/tsc -p backend/tsconfig.json --noEmit`
  通过；`npm test --prefix backend`（临时 RG 目录）**191 / 191**（+1 保留 id 用例；publish/routes 的内置 403 断言并入现有用例）；
  `npm test --prefix frontend` **146 / 146**。未启停真实 3300/4771、未读写真实 `data/`/`projects/`/`.env`、未调模型、未做 git。

---

## P7-7b-1 实施记录（2026-11-21）

> 范围：设计稿 §9（工作室/会话）、§13.3（studio API）、§15.2 的**后端部分**：`SessionView`/`ChatTarget`、
> `workshop.ts` 资产/镜像、`studio.ts` + `studio-routes.ts`、工作室 SKILL/command/references、单测/回归。
> **未做（留 P7-7b-2/7c）**：Studio UI、`template-preview.html`、模板中心自定义入口、新建应用 picker、
> scaffold contract 闭环、真实工具权限验证、真实模型、真实实例启停。
> （历史记录：后续 7b-2a/2b 已完成 Studio UI/`template-preview.html`/模板中心自定义入口；7c 仍未做。）

### 1. 改动文件

| 类别 | 文件 |
| --- | --- |
| 会话视图 | `backend/src/sessions/store.ts`：`SessionView = AppView \| 'template'`、`SESSION_VIEWS`、`isSessionView`；`viewOf` 返回 template 自身；`activeSessionRow/listSessionRows/createSessionRow/archiveActiveSessions` 接受 `SessionView`（应用调用与 SQL 不变） |
| 对话抽象 | `backend/src/chat/service.ts`：`ModelStage = SessionView`；`ChatTarget`（id/name/directory/view/sessionTitle?/beforeSession?/expectedSkills/expectedCommands/buildPrompt/digest?/allowModule）；`handleChat(target,req,res)`；`handleAppChat` 为 `appChatTarget` 等价包装；`ensureTargetSession`/`ensureViewSession`；`verifyTargetAssets`；`storedModelFromOtherStages` 对 template 不继承；`isModelStage` 仍只接受三视图（应用 model 路由拒绝 template）；应用 command 期望补 `check-design-fidelity`（5 个，与 smoke 一致） |
| 共享会话底层 | 新增 `backend/src/dev/session-support.ts`：类型（`SessionInfo/ListItem/List/State/Pending`）、`httpError/dateTimeLabel/viewLabel/modelOf/sessionItemOf/sessionInfoOf`、上下文 token 上限、`stateForSession(directory,row)`；`backend/src/dev/service.ts` 改为复用（导出签名/响应/错误语义不变） |
| 工作室资产 | 新增 `backend/src/design-template/workshop.ts`：`ensureStudioAssets`（AGENTS/opencode.json/workshop.json 内容变更才写、skill/command/scripts 受管副本、`catalog/builtin/<packId>` 36 文件只读镜像按版本/mtime/内容 hash 刷新、`catalog/component-controls.json`、`ensureCatalog`、资产变化时 best-effort `opencode.reloadLocations`）；`workshop.json` 只含 `{builtinRoot,customRoot,draftRoot,workbenchPort}` 绝对路径，无凭据 |
| 工作室服务/路由 | 新增 `backend/src/design-template/studio.ts`（`targetForDraft/studioState/listStudioSessions/create/activate/rename/archive/prompt/interrupt/compact/permission/form/activeStudioOpencodeSession/getStudioModel/saveStudioModel`；`view=template`、`app_id=__template__:<packId>`、模型键 `app.__template__:<id>.model.template`）与 `studio-routes.ts`（§13.3 全部接口 + SSE hello/事件/心跳）；`routes.ts` 挂载 `designTemplateRoutes.use('/drafts/:id/studio', studioRoutes)` |
| 工作室 skill/command | 新增 `templates/workshop/skills/adw-design-template-authoring/SKILL.md`、`references/contract-recipes.md`（8 配方/字段/sampleEntity/组件边界/warning）；新增 `templates/workshop/commands/generate-design-template.md`；复用 P7-7a `references/spec.schema.json` 与 `scripts/**` |
| 测试 | 新增 `backend/src/sessions/store.test.ts`、`backend/src/chat/target.test.ts`、`backend/src/design-template/{workshop,studio,studio-routes}.test.ts`；`backend/package.json` test 列表 |
| 文档 | `docs/STATUS.md`、`README.md`、`AGENTS.md` 状态与目录说明；本实施记录 |

### 2. 口径与实现要点

1. **AppView 三值不变**：应用 chat/model 路由继续 `isAppView`；工作室路由/服务用 `SessionView`/`isSessionView`；
   `app_sessions.view='template'` 是 TEXT 新值，无迁移、无新表。
2. **ChatTarget 等价包装**：`handleAppChat` 先按 body.view 解析三视图，再构造 `appChatTarget` 调 `handleChat`；
   meta 帧/会话标题/prompt/模型/开发 digest/ui-check 行为与 P7-6c 完全一致（`e2e:p2/p3/p4` 回归 116/126/128）。
3. **工作室目标**：`targetForDraft` 校验草稿（404/400）、`ensureStudioAssets`、prompt 固定为“只写
   `drafts/<packId>/spec.json`（+ notes.md）、先读 AGENTS/catalog、引用真实 id、生成用
   `node .opencode/scripts/generate.cjs --draft <packId>`、不发布、中文”；expected =
   `adw-design-template-authoring` + `generate-design-template`。
4. **工作室会话**：一个模板一个活跃会话；`new` 会归档旧会话；无活跃会话时 `prompt/interrupt/compact/permission/form`
   返回 409；未建会话的 `GET /studio` 不创建空会话（session/state=null，返回 defaultPrompt/spec/validation）。
5. **模型独立**：`getStudioModel/saveStudioModel` 固定 `stage='template'`；`storedModelFromOtherStages` 对 template
   返回 null，不继承应用三视图模型；应用 `GET|PUT /api/apps/:id/model` 的 `stage=template` 仍回退 requirements。
6. **镜像/幂等**：`catalog/builtin/<packId>` 复制 `pack.json` + application-types + styles（36 文件，594,145 B）；
   stamp 比较版本+mtime+内容 hash+文件数；失效先写临时目录再原子替换；AGENTS/opencode/workshop/skill/command/scripts
   均内容不同才写；第二次 `ensureStudioAssets` `changed=false`。
7. **权限 JSON**：V2 `permissions` 共 8 条且顺序固定（edit 全 deny → spec/notes allow → read allow →
   shell deny → generate/validate allow → external_directory deny）；`*drafts/*/spec.json` 前缀 `*` 兼容绝对/相对路径。
8. **SSE**：`GET .../studio/events` 先在有活跃会话时返回 hello（sessionID/draftId/view/status），事件 `redactDeep`
   后转发，15s 心跳；无活跃会话 409；opencode 未就绪 502。
9. **会话删除保护**：沿用 P7-7a `archiveStudioSessions`（删除模板归档 `__template__:<packId>` 行，不物理删除）。

### 3. 验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `npx tsc -p backend/tsconfig.json --noEmit` | 通过 |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **217 / 217**（原 191 + 26：SessionView 3、ChatTarget 4、workshop 6、studio 7、studio routes 6） |
| `npm test --prefix frontend` | **146 / 146**（未改前端） |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型；应用 command 仍 5） |
| `npm run e2e:p2 --prefix backend` | **116** 条断言 |
| `npm run e2e:p3 --prefix backend` | **126** 条断言 |
| `npm run e2e:p4 --prefix backend` | **128** 条断言 |
| `npm run e2e:p9 / p10 / p7-4b / preview / p7-3b / p7-6a` | 本期未重跑（无前端/预览改动；p2/p3/p4 已覆盖会话与前端主路径） |
| 工作室 CLI（临时目录） | 未单独手测；`generate.cjs/validate.cjs` 为 P7-7a 既有脚本，本次只复制到 `_workshop/.opencode/scripts` |

### 4. 偏差 / 未验证项

1. **`dev/service.ts` 走“共享底层 helper”而非 target 化重写**：抽出 `dev/session-support.ts`，`dev/service.ts`
   的导出签名/响应/错误语义不变（后端 217 与 e2e p2/p3/p4 通过）；设计稿 §15.2 允许该低风险路径。
2. **`ensureStudioAssets` 为 async**：为使 `opencode.reloadLocations()` 失败可收集 warning；`ChatTarget.beforeSession`
   允许返回 Promise（应用仍返回同步对象，等价）。
3. **应用 command 期望从 4 补到 5**：新增 `check-design-fidelity`，与 `smoke:assets` 实际加载一致；缺失只 warning，不阻断。
4. **镜像复制保留字节**：`syncDirectory`/镜像复制用 Buffer 比较/写入（当前 36 文件均为文本，仍按字节安全处理）。
5. **测试 stub 事故（已修正）**：`studio.test.ts` 初版遗漏 stub `replyPermission/replyForm`，曾短暂启动本机
   opencode serve（4771，未调模型、未啟停 3300）；补 stub 后重跑通过，当前 4771 无 LISTEN，未影响真实实例。
6. **未验证**（7b-1 当时口径；后续 7b-2a/2b 已完成 Studio UI/`AgentChatPanel` 适配/`template-preview.html`/模板中心自定义入口，7c 仍未做）：
   Studio UI/`AgentChatPanel` 适配/`template-preview.html`/模板中心自定义入口/新建应用 picker（P7-7b-2）；
   真实 opencode 工具调用下的 edit/shell 权限路径（`external_directory`/前导 `*` 是否匹配绝对路径）与真实模型按
   catalog 写 spec（P7-7c）；真实 3300/4771 人工验收；`catalog/builtin` 镜像的并发写入（单用户/单会话假设，无锁）。


---

## P7-7b-2a 实施记录（2026-11-21）

> 范围：设计稿 §9.5/§9.6、§11、§13.3、§14.2、§15.2 的**前端部分** + 测试守卫：
> StudioView/路由、AgentChatPanel 适配、`template-preview.html`、`preview.html` 结构覆盖、`NODE_TEST_CONTEXT` 下禁止默认 4771 真实 serve。
> **未做（留 P7-7b-2b / P7-7c）**：模板中心自定义入口/列表/新建/编辑/删除、新建应用 picker、`e2e:p7-7b`、scaffold contract 闭环、
> 真实工具权限、真实模型、真实实例启停。

### 1. 改动文件

| 类别 | 文件 |
| --- | --- |
| 测试守卫 | `backend/src/opencode/runtime.ts`：新增 `DEFAULT_SERVE_PORT=4771`、`ServePortGuardEnv`、`assertSafeTestServePort(port, env)`；`ensureStarted()` 与 `start()` 启动路径调用（`NODE_TEST_CONTEXT` + 4771 且非 `RG_ALLOW_REAL_OPENCODE=1` → 抛清晰错误）；`backend/src/opencode/runtime.test.ts` +2 用例（命中/放行） |
| 静态入口 | `backend/src/index.ts`：`/template-preview.html` 独立入口（缺失 404，不回落 index） |
| 草稿详情 | `backend/src/design-template/draft.ts`：`DraftDetail` 增加权威 `pack`（已生成时 `validatePackDir().pack`），供工作室/模板预览读取 kind/source/contract/sampleEntity；原有字段不变 |
| 路由/工作室 | `frontend/src/App.vue`：新增 `#/studio/<packId>` kind（`StudioView`，其余仍 `HomeShell`/`AppShell`）；新增 `frontend/src/studio/{types.ts,api.ts,api-helpers.js,api-helpers.test.mjs,spec-helpers.js,spec-helpers.test.mjs,StudioView.vue}` |
| 面板适配 | `frontend/src/dev/types.ts`：新增 `SessionView = AppView \| 'template'`（`AppView` 仍三值；会话 view 字段放宽）；`frontend/src/dev/api.ts`：新增 `ChatPanelApi` 与默认 `devApi`；`frontend/src/workbench/AgentChatPanel.vue`：可选 `api`/`commands`/`emptyHint`/`composerPlaceholder`，所有调用走 `props.api ?? devApi`，命令按钮走 `props.commands ?? commandsForView(view)`（默认行为不变） |
| 预览入口 | 新增 `frontend/template-preview.html` + `src/template-preview/{main.ts,TemplatePreviewApp.vue,helpers.js,helpers.test.mjs}`；`frontend/vite.config.ts` 多入口 |
| 结构覆盖 | `frontend/src/preview/preview-params.js`：`resolveStructureOverride/structureAssetUrl/applyStructureOverride`；`frontend/src/preview/PreviewApp.vue`：`structurePack/structureDraft` 加载 pack 合并 `structure.css` 并替换 `#preview-structure-css`，失败回退 registry + warning，`updateLocation` 保留参数；`preview-params.test.mjs` +3 用例 |
| 测试脚本 | `frontend/package.json` test 列表 +2 文件 |
| 文档 | `docs/STATUS.md`、`README.md`、`AGENTS.md`、`docs/plans/README.md` 状态同步；本记录 |

### 2. 口径与实现要点

1. **工作室会话**：`StudioView` 传 `app-id=<packId>`、`view='template'`、`:api=studioChatApi`、`:commands=[]`；
   `studio/api.ts#studioChatApi` 走 `/api/design-templates/drafts/:id/studio/*`，`getState` 把 `StudioStateResponse`
   映射为 `DevStateResponse`（`app` 用草稿摘要合成、`view='template'`）；`connectEvents` 用 `EventSource .../studio/events`；
   错误保留后端 `{error}`（`StudioApiError` 附 status/payload）。
2. **`AgentChatPanel` 默认不变**：未传 `api`/`commands` 时与 P7-6c 完全一致（应用三视图命令/文案）；
   工作室传 `commands=[]` 隐藏命令行，空态/占位文案由 props 覆盖。
3. **`template-preview.html`**：`?draft=<packId>&page=&embed=1` / `?pack=<packId>&page=&embed=1`；
   草稿读取 `GET drafts/:id` 的权威 `pack`（不是 pack.json 资产，避免放宽资产扩展名），已发布读取 `GET /api/design-system/:id`；
   - reference：父页 iframe `/preview.html?type=<source.applicationType>&style=<styleId>&page=<source.pageId>&embed=1&structureDraft|Pack=<packId>`；
   - contract：`flattenContract(page)`（contract 容器的 filters/columns/rowActions/toolbarActions/selection/pagination/form/tree/subTables/components 展平为页面字段，components 仍 object；title=name；entity=sampleEntity.id）→ synthetic design（entities=sampleEntity+sampleSubEntities）→ `adaptDesign` → `ContractPage`；
   - 注入 pack `application-types/<packId>/structure.css`；风格类来自 registry（自定义 pack 复制内置风格）；根类用 `baseApplicationType` 短类；
   - 未生成/无页面/无 sampleEntity/草稿不存在均有明确错误态，不白屏；`embed=1` 隐藏角标；不写 PNG。
4. **`preview.html` 覆盖**：显式 `structureDraft/Pack` 时 fetch 资产接口并替换注入内容；失败回退内置源类型 structure 且提示；
   无参数行为与 P7-3a/P8-2 完全一致（`e2e:preview` 断言不变）。
5. **`StudioView`**：头部返回/名称/版本/状态/模型选择（`/api/opencode/models` + studio model GET/PUT，失败只提示）；
   左页面清单/spec 校验（路径+原因）/首条提示；中 `AgentChatPanel`；右 `template-preview` iframe（页面下拉/刷新/新窗口/空态）；
   底部生成预览/发布（二次确认）/丢弃草稿（已发布保留模板）/刷新 + 最后生成时间 + CSS 来源/规则/去重/冲突（3 条 + 展开）；
   草稿不存在/加载失败显示错误态并可返回/重试。
6. **测试守卫**：`assertSafeTestServePort` 为纯函数；`ensureStarted/start` 都调用；e2e/smoke 使用独立端口/不设 `NODE_TEST_CONTEXT`，不受影响。

### 3. 验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `node backend/node_modules/typescript/bin/tsc -p backend/tsconfig.json --noEmit` | 通过 |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **219 / 219**（+2 端口守卫） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过（含 `template-preview.html` 多入口） |
| `npm test --prefix frontend` | **170 / 170**（+24：template-preview helpers 10、studio spec-helpers 6、studio api-helpers 5、preview structure override 3） |
| `npm run e2e:p2 / p3 / p4 --prefix backend` | **116 / 126 / 128** |
| `npm run e2e:preview / p7-3b / p7-4b / p9 / p10 --prefix backend` | **83 / 38 / 48 / 70 / 79** |
| 手工 Playwright（临时目录+端口 3521/4801，不调模型） | **54 条断言全过**；0 console error/pageerror/请求失败/外部请求；截图 `%TEMP%\workbench-p77b2a-shots\` |

手工流程：API 建草稿 → 写 reference+contract×2 spec → 工作室（空预览）→ 点「生成预览」→ iframe → reference（iframe 标题“通知公告管理”、structureDraft）→ contract list（pm-table、structure.css 2919 字符、data-cyan 风格、enterprise-platform 短类）→ contract dialog-form → preview.html structureDraft 注入内容与资产逐字一致且 URL 保留 → 发布（1.0.0）→ 已发布 pack 可见/预览用 structurePack → 丢弃已发布草稿 `packKept=true` → 草稿不存在/未生成错误态。全程无模型调用。

### 4. 偏差 / 未验证项

1. **草稿权威 pack 走 `GET drafts/:id#pack`**（而非设计稿示例的 `pack.json` 资产）：资产接口只允许 `.css/.svg/.png/.jpg/.jpeg`，放宽扩展名会扩大只读面；改为草稿详情附带 `validatePackDir` 的权威 pack（原字段不变，纯新增）。
2. **工作室状态未展示“资产未加载”**：`studioState` 未返回 skill/command 校验结果；本轮只显示 opencode 连接状态、模型/草稿/校验错误，不伪造资产校验（设计稿 §9.7 的资产 warning 留 7b-2b/7c）。
3. **模型选择触发真实 opencode**：`/api/opencode/models` 按需启动 serve（临时端口，不调模型）；真实 3300/4771 未启停。
4. **未验证**（后续 2b 已完成模板中心自定义入口/列表/新建/编辑/删除与 `e2e:p7-7b`；7c 仍未做）：模板中心自定义入口/列表/新建/编辑/删除与 `e2e:p7-7b`（7b-2b）；新建应用 picker 自定义分组、scaffold contract 闭环、应用内 design-preview 自定义 structure（7c）；真实 opencode 工具权限路径、真实模型按 catalog 写 spec、真实 3300/4771 人工验收。
5. **未重跑**：`e2e:p7-6a`（无 fidelity 改动）、`smoke:workspace`/`smoke:assets`（本轮未改分发/应用路径；P7-7b-1 已通过）。

---

## P7-7b-2b 实施记录（2026-11-21）

> 范围：设计稿 §10.1/§10.4/§10.5、§12.7（仅模板中心部分）、§13.1/§13.2、§14.1、§15.2 的模板中心自定义入口 +
> `e2e:p7-7b` + `e2e:p7-3b` 更新 + 清理。**未做（留 P7-7c）**：新建应用 picker 列自定义 pack、scaffold contract 闭环、
> 应用内自定义 structure/design-preview、真实工具权限/真实模型、真实 3300/4771 启停。

### 1. 改动文件

| 类别 | 文件 |
| --- | --- |
| 模板中心 | `frontend/src/workbench/DesignTemplateCenter.vue`：browse「自定义」分类/tab、自定义卡片列表（名称/风格/版本/状态/kind 计数/引用应用数）、进入工作室/编辑/预览/删除、删除内联二次确认与 409 应用列表、新建入口；picker 行为不变（不加载/不显示自定义） |
| 新建对话框 | 新增 `frontend/src/workbench/NewDesignTemplateDialog.vue`（名称/4 风格/base 应用类型 → `POST /api/design-templates/drafts` → 跳 `#/studio/<packId>`；只创建草稿） |
| 纯函数/单测 | `frontend/src/workbench/design-template-helpers.js`：`appendCustomCategory`/`buildCustomTemplateItems`/`customPageSummary`/`customTemplateActions`/`customPreviewUrl`/`customStudioHash`/`filterCustomTemplates`/`pageKindCounts`；`design-template-helpers.test.mjs` +2 用例 |
| Studio API/类型 | `frontend/src/studio/api.ts`：`listDrafts`/`createDesignTemplateDraft`/`ensureDraftFromPack`/`deleteDesignPack`；`types.ts`：`DraftSummary`/`CreateDraftInput`、`DraftFailurePayload.details.apps` |
| 共享类型/接口 | `frontend/src/shared/design-system-api.ts`：`DesignPackSummary.templateKind/referencedApps`；`backend/src/design/system-routes.ts`：`GET /api/design-system` 摘要附 `referencedApps`（复用 `referencedAppsMap`）；`backend/src/design-template/routes.test.ts` +1 断言 |
| 预览修复 | `frontend/src/template-preview/TemplatePreviewApp.vue`：`data-kind`/角标改为记录当前 pack 页面的 `reference/contract`（contract 的 synthetic 页面不带 kind，原实现会误显示“蓝图页”） |
| 清理 | `frontend/src/template-preview/helpers.js`：删除 `packJsonUrl`（后端资产只允许 `.css/.svg/.png/.jpg/.jpeg`）；`helpers.test.mjs` 更新；`templates/workshop/skills/adw-design-template-authoring/SKILL.md` §6 补第 13 个控件 `pm-select-tree` |
| e2e | 新增 `backend/scripts/design-template-studio-e2e.ts` + `e2e:p7-7b`；`backend/scripts/design-template-e2e.ts`（p7-3b）更新自定义卡片/空态/新建与分类 tabs；`backend/package.json` |
| 文档 | 本记录、`docs/STATUS.md`、`README.md`、`AGENTS.md`、`docs/plans/README.md` |

### 2. 口径与实现要点

1. **browse 自定义列表**：`GET /api/design-templates/drafts`（草稿/引用应用数）+ `GET /api/design-system`（`templateKind=custom`）按 id 合并去重；草稿优先更新名称/校验/时间；已发布无草稿的 item 补拉 `GET /api/design-system/:id` 以计算 reference/contract 页数；排序草稿在前，再按名称/id。
2. **动作**：进入工作室/编辑 = 草稿存在直接跳；已发布但草稿被丢弃先 `POST /api/design-templates/packs/:id/draft` 反写；预览 = `template-preview.html?draft|pack=<id>&page=<first>&embed=0`（无生成/无页面禁用）；删除 = 已发布 `DELETE /api/design-system/:id`，未发布 `DELETE /api/design-templates/drafts/:id`；内置不出现在自定义列表。
3. **删除保护**：内联二次确认（不用 `ElMessageBox`，避免其 overlay 在模板中心 z-index 3000 之下被拦截）；409 `pack-referenced` 读取 `payload.details.apps`（兼容顶层 `apps`）并展示应用 id/名称；解除引用后再次删除成功；删除同时由后端移除草稿。
4. **新建**：默认风格/基础类型取内置 pack 的 `defaultStyle/defaultApplicationType`；提交只创建草稿（starter `pages: []`），成功后关闭模板中心并跳工作室；不生成、不发布、不创建 opencode 会话。
5. **picker 锁定**：picker 模式不请求 drafts、不渲染自定义入口/分类/卡片；`NewAppDialog` 未改。
6. **e2e fixture**：`e2e:p7-7b` 通过 UI 创建草稿后，直接写临时草稿目录的 `spec.json`（reference=`operations-management/list`，contract=`dialog-form` + sampleEntity），不经过真实 agent；生成/预览/发布/删除均走真实 API。
7. **清理口径**：`template-preview` 只使用草稿详情权威 `pack` 与已发布 pack，不再尝试读 `pack.json` 资产；SKILL §6 的 13 个可映射控件与 `component-controls.json ∩ 39` 完全一致。

### 3. 验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `node backend/node_modules/typescript/bin/tsc -p backend/tsconfig.json --noEmit` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **219 / 219**（新增 `GET /api/design-system` 摘要 `referencedApps` 断言） |
| `npm run build --prefix frontend` | 通过（多入口） |
| `npm test --prefix frontend` | **172 / 172**（原 170 + 自定义模板 helper 2 用例；template-preview 改为断言 `packJsonUrl` 不存在） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run e2e:p7-7b --prefix backend` | **50 条断言**（stub opencode；端口 3429/4429；临时目录自动清理；含编辑草稿直接进入与丢弃后反写、预览按钮可用） |
| `npm run e2e:p7-3b --prefix backend` | **39 条断言**（原 38；自定义卡片启用/进入空态/新建入口；分类 tabs 6） |
| `npm run e2e:p2 / p3 / p4 --prefix backend` | **116 / 126 / 128** |
| `npm run e2e:preview / p7-4b / p9 / p10 / p7-6a --prefix backend` | **83 / 48 / 70 / 79 / 15** |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型；应用 command 仍 5） |
| 截图 | `%TEMP%\workbench-p77b2b-shots\`：center-empty / new-dialog / studio-empty / studio-generated / studio-contract / studio-published / center-published / delete-409 / deleted（9 张） |

### 4. 偏差 / 未验证项

1. **删除确认改为模板中心内联确认**：`ElMessageBox` 默认 overlay z-index 低于模板中心（3000），按钮会被模板中心拦截；内联确认更可测，也不再依赖 Element Plus overlay 层级。
2. **`GET /api/design-system` 摘要新增 `referencedApps`**（可选字段）：设计稿 §13.1 已预留；仅用于模板中心显示引用数，内置为空数组；旧客户端忽略。
3. **修复 `template-preview` 的 kind 展示**：`data-kind`/角标此前从 synthetic design 页面推断，contract 会被误标为“蓝图页”；现在记录 pack 页面 kind（reference/contract）。
4. **e2e 忽略一条预期 409 网络日志**：删除保护的 409 是断言目标，浏览器会把该非 2xx 资源记为 console error；`e2e:p7-7b` 只忽略这一条，其余 console error/pageerror/请求失败/外部请求仍为 0。
5. **未验证/未做（P7-7c）**：新建应用 picker 列自定义 pack、scaffold contract 闭环、应用内自定义 structure/design-preview、真实工具权限、真实模型按 catalog 写 spec、真实 3300/4771 人工验收；`build:report` 未重跑（无汇报材料改动）。

## P7-7c-1 实施记录（2026-11-21）

> 范围：设计稿 §15.3 的应用闭环（**不含真实模型**）。目标：自定义模板 → 新建应用 → 设计视图/预览/PNG → 一致性检查。
> **未做**：P7-7c-2（真实工具权限/真实 `deepseek-flash`/真实 3300/4771）、真实 `data/`/`projects/`/`.env`、DB 表变更、需求模板中心、git。

### 1. 阅读文件

`backend/src/design/system-file.ts`、`design/pack.ts`、`apps/design-system.ts`、`apps/routes.ts`、`apps/scaffold.ts`、`templates/distribution.ts`、`dev/digest.ts`、`dev/ui-check.ts`、`dev/fidelity.ts`、
`templates/agent/skills/adw-frontend-implementation/scripts/lib/fidelity-core.cjs`、`scripts/check-fidelity.mjs`、`templates/agent/commands/check-design-fidelity.md`；
前端 `design-preview/DesignPreviewApp.vue`、`design/template-capture.ts`、`workbench/{DesignView,DesignPrototypePanel,NewAppDialog,DesignTemplateCenter,HomeShell,AppShell}.vue`、`shared/design-system-api.ts`、`workbench/design-template-helpers.js`；
e2e `p2-e2e-harness.ts`、`design-preview-e2e.ts`、`template-png-e2e.ts`、`fidelity-e2e.ts`、`design-template-studio-e2e.ts`、`design-template-e2e.ts`、`p2/p3/p4-e2e.ts`。

### 2. 口径与实现要点

- **`design-system.json`（schemaVersion 1）**：`origin`（custom/draftId/baseApplicationType）、`preview`（kind/baseApplicationType/structure/structureUrl/styleClassName/packVersion）、`pages[].kind/source/contractFile`；contract 页不写 `blueprint`，reference/blueprint 保留。
- **受管副本**：`docs/design/template/<packId>/structure.css`（合并结果原样）、`pages/<reference>.vue`、`contracts/<contract>.json`、`assets/*`、`styles/{shared.css,<styleId>/style.css}`；`ensureWorkspaceAssets` 幂等覆盖，不碰 `frontend/`/`docs` 正文。
- **应用资产接口**：`GET /api/apps/:id/design-system/asset?path=`，相对 `docs/design/template`，只允许 `.css/.svg/.png/.jpg/.jpeg`，禁绝对路径/`..`；`no-store`。
- **设计模板 skill**：页面表 `kind` 列；reference `source=pack/type/page`；contract `契约（无蓝图）` + “契约页实现（无蓝图）”段；manifest `templateKind`/`packVersion`（旧 manifest 缺省 builtin 兼容）。
- **digest/ui-check**：契约页“无蓝图，按契约实现”+ 契约摘要；ui-check 页面表含类型/来源/契约，contract 页蓝图 `无（契约页）`。
- **fidelity 13 项**：`template-contract` 只报告；`blueprint-files` 契约页跳过、契约文件缺失只 warn；无契约页引用时 `template-contract` pass。
- **前端**：`DesignPreviewApp` 读 `designSystem.preview`（base 短类 + 应用内 structure + 内置风格类；失败回退 registry + warning）；`DesignView` 徽标自定义带版本；picker 只列**已发布**自定义 pack（`design-template-custom-pick-<id>`）、页面库 kind/来源、自定义预览走 `template-preview.html?pack=`；PNG 协议/尺寸/超时不变。
- **e2e:p7-7c**：API 创建→fixture spec→生成→发布；picker 已发布/草稿不列；API 新建应用；工作区/资产/对齐；设计视图自定义 structure+base 类+contract dialog；PNG；digest/ui-check/fidelity 13 项；0 console/pageerror/请求失败/外部请求。

### 3. 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` / `npx tsc -p backend/tsconfig.json --noEmit` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **230 / 230**（原 219；+system-file 4、digest/ui-check 4、fidelity 1、distribution 1、design-system 1） |
| `npm test --prefix frontend` | **178 / 178**（原 172；+custom-preview 4、picker/徽标 1、新建应用摘要加载态 1） |
| `npm run typecheck --prefix frontend` / `check:vue` / `build` | 通过（build exit 0） |
| `npm run e2e:p7-7c --prefix backend` | **108 条断言**；端口 3430 已关闭；临时根已清理；**连跑 3 次均通过（108/108/108）** |
| `npm run e2e:p7-6a / p7-7b / p7-3b --prefix backend` | **18 / 51 / 39**（p7-6a 原 15；p7-7b 原 50） |
| `npm run e2e:p2 / p3 / p4 --prefix backend` | **116 / 126 / 128** |
| `npm run e2e:preview / p7-4b / p9 / p10 --prefix backend` | **83 / 48 / 70 / 79** |
| `npm run smoke:workspace / smoke:assets --prefix backend` | 通过（临时目录 + 3416/4719；opencode 2.2.5；不调模型） |

截图（`%TEMP%\workbench-p77c-shots`，0 非预期 console error）：`p7-7c-picker.png`、`p7-7c-design-list.png`、`p7-7c-design-form.png`、`p7-7c-supplier-list.png`、`p7-7c-development.png`、`p7-7c-design-system.json`、`p7-7c-ui-check.md`。

### 4. 偏差 / 未验证项

1. `preview` 只写自定义 pack；内置保持 registry 路径。contract 页根类按设计稿用 `baseApplicationType` 短类（合并 structure 已含来源类型规则）。
2. `template-contract` 在“无契约页引用”时 pass，避免给内置模板应用新增 warning；空设计报告仍 2 项。
3. picker 使用新 testid `design-template-custom-pick-<id>`；`e2e:p7-7b` 的 picker 断言改为“列已发布自定义、草稿不列”。
4. 自定义结构加载失败回退 registry，并在非 embed/capture 时显示 warning 条（`data-structure-fallback=1`）。
5. **picker 异步摘要加载态（评审修复，2026-11-21）**：`NewAppDialog#applyDesignSelection` 切换 pack 时先清空 `designPack` 并进入加载态（摘要显示“加载中…”），失败只留 `designNotice`，不再用旧内置 pack 回退；内置同一 pack 快速路径不变。`describeNewAppDesignSelection` 纯函数覆盖 ready/loading/failed/default（前端 +1 用例）。`NewAppDialog`/`DesignTemplateCenter.load`/`loadCustom` 增加请求 token，关闭/改选会丢弃迟到结果；`e2e:p7-7c` 在“使用此模板”后先 `waitForText` 摘要出现自定义模板名/标签，并补充页面库/首条提示等待；harness 状态文件读取增加容错（半截 JSON 返回 null 重试）。**连跑 3 次均通过（108 条断言/次）**，未再复现偶发失败。
6. 未验证（P7-7c-2）：真实 opencode 工具权限（edit/shell 拒绝路径）、真实模型按 catalog/skill 写 spec、真实 3300/4771 人工验收；真实 AFCenter 宿主/EOS 运行态；<768 移动端；PNG 像素级模板比对（仍只宽高 + 主色采样）。

## P7-7c-2 真实模型闭环（2026-11-21）

> 范围：§17 真实模型验证计划（临时目录/端口、真实 opencode 2.2.5、真实 `deepseek-flash`）。
> **未做**：真实 3300/4771 启停/人工验收、DB 表变更、需求模板中心、git；未读写真实 `data/`/`projects/`/`.env`。

### 1. 结论

**通过**：真实模型从工作室 prompt 出发，读 AGENTS/catalog/skill → 写 `spec.json`（1 reference + 2 contract）→
自行运行生成/校验 → 中文汇报；发布 1.0.0 → 新建应用 → 设计预览/PNG → fidelity 13 项 **0 fail**。
全链路约 **3 分 3 秒**（prompt 到收尾 **64,149ms**，21 条消息 / 29 次工具）。

### 2. 环境与结果

| 项 | 结果 |
| --- | --- |
| 临时根 / 端口 | `%TEMP%\workbench-p7-7-real-s8BRUr`；后端 **3487**、opencode **4787** |
| 模型 | `packycode-deepseek/deepseek-flash`（63 个候选中命中；`PUT /studio/model` 显式设置） |
| spec | 3 页：`supplier-list`（reference `operations-management/list`）、`supplier-form`（contract `dialog-form`）、`supplier-detail`（contract `detail`）；`data-cyan`；`baseApplicationType=operations-management` |
| 生成 | agent 自行执行 `generate.cjs`：**0 error / 0 warning**，212 条 CSS 规则，0 冲突；`validate.cjs` 0/0 |
| 发布 | **1.0.0**；`GET /api/design-system` 可见 `templateKind=custom` |
| 应用 | `p77c2-real`：`design-system.json`（origin/preview/kind/contractFile）、reference 蓝图、2 契约 JSON、合并 structure、styles、`adw-template-proto-supplier-management` skill 齐全 |
| 预览/PNG | 自定义 structure 注入、`data-cyan`、base 短类 `application-type-operations`；PNG 3 页 2880×1800、主色像素 2011；0 console error/pageerror/外部请求 |
| fidelity | **13 项 pass 5 / warn 8 / fail 0**；`template-contract` pass、`blueprint-files` pass、`prototypes` pass |

### 3. 真实权限/越界

- 实际工具：`read` 19、`glob` 3、`grep` 2、`write` 2、`shell` 3；**1 次权限拒绝**：
  `shell Get-ChildItem ...` → `permission.rejected` / `Permission denied: shell`；模型改用 read/glob 继续。
- `write drafts/<id>/spec.json`、`write drafts/<id>/notes.md`、`shell generate.cjs/validate.cjs` 均允许。
- 前后 hash：`catalog/**`（48 文件）、`.opencode/**`（9 文件）、`projects/**`、仓库源码（474 文件）**均未变化**；
  只有 `drafts/<id>/pack/**`（生成器）与 `drafts/<id>/{spec,notes}.json/md`（agent）变化。

### 4. 真实模型驱动的修复（阻塞性问题）

首轮真实运行 8.7s、10 次 read 后被误判 `succeeded`（spec 仍 0 页）。根因在
`backend/src/opencode/session-state.ts`：

1. `transcriptComplete()` 把 `finish=tool-calls` 当作本轮收尾；
2. `sessionCompletion()` 只认 `time.busy === true||1`，而 opencode v2 的 `time.busy` 是**时间戳**。

最小修复：`tool-calls/tool_calls/tool-use/tool_use` 不算收尾；数值型 `time.busy` 视为仍在忙；
`chat/service.test.ts` +3 断言。修复后同一 prompt 正常运行 64s 完成。该修复同时改善三视图会话完成判定，
避免多轮工具调用被提前标成完成。证据：`docs/plans/evidence/2026-11-21-p7-7-real-model/`（含 `pre-fix-early-stop/`）。

### 5. 偏差 / 未验证

1. 草稿初始 base 为 `enterprise-application-platform`；模型按技能 §7 选择 `operations-management`（reference 同源）。
   生成/预览/design-system 以 `operations-management` 为 base（短类 `application-type-operations`），属合理默认。
2. 模型在汇报中说明 reference 列表仍显示源页公告文案（快照语义固有限制），并给出改 `contract + list` 选项。
3. 驱动脚本在证据复制/续跑阶段修正过两次（临时脚本问题，非产品失败）；续跑未重复调用模型。
4. 未验证：真实 3300/4771 人工验收、AFCenter 宿主/EOS 运行态、开发视图真实模型实现、<768 移动端、PNG 像素级 diff；
   `edit`/`write` 越界拒绝路径未被真实触发（模型只写 spec/notes，hash 证明未越界）；本轮真实命中 `shell` 拒绝。
5. `ui-check` 为 warn（本轮不启动开发会话，不做额外模型调用）；digest/ui-check 契约页识别仍由 `e2e:p7-7c`（108）覆盖。

### 6. 回归（实跑）

后端 **230/230**、前端 **178/178**；`e2e:p7-7c/p7-7b/p7-6a/preview/p7-4b/p9/p10/p2/p3/p4` =
**108/51/18/83/48/70/79/116/126/128**；`build`/`typecheck`/`check:vue`/`smoke:workspace`/`smoke:assets` 通过。
详见证据 README。

### 7. 人工验收（2026-11-23）

> 只记录已确认事实；未采集项明确标注，不补写验收细节。

- 用户确认**真实 3300 人工验收全部通过**（2026-11-23）；**P7-7 评审仍待定**，不等于“全部评审通过”。
- 运行态（只读核对）：3300 LISTEN，PID **39828**（`node dist/index.js`，启动 **09:10:41**）；
  4771 LISTEN，PID **19608**（`opencode serve` 2.2.5，启动 **09:10:42**）；`GET /api/health` **200**
  （`ok:true`、`runtime.ready:true`、`pendingSessions:0`）。
- 构建产物：`backend/dist` **2026-11-23 10:08:23**、`frontend/dist` **2026-11-23 10:08:49**；后端进程比 dist 早约 58 分钟——
  前端静态托管即时生效，09:10 后若后端有改动需用户自行 `restart.cmd`/`restart.sh`（本轮未启停、未验证运行进程内后端）。
- 未采集（本轮未提供）：appId / packId / 模板名、fidelity 计数、耗时、权限拒绝/越界检查、截图与日志；
  后端 230/230、前端 178/178、e2e 各项为 2026-11-21 口径，**本轮未重跑**。
- 历史保留：2026-11-20 曾监听（PID 40704/41744，16:15:08）；2026-11-21 只读核对无 LISTEN、`/api/health` 连接失败。
