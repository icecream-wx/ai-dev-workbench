---
name: adw-design-template-authoring
description: 设计模板工作室中加载：读 catalog 的内置页面/组件/风格/配方，按用户业务组装 drafts/<packId>/spec.json（reference 引用页 + contract 契约页），用生成脚本产出草稿包并修正 errors/warnings；只写 spec/notes，不发布
---

# 设计模板编写（工作室）

工作室的产物是**一份草稿 spec**：`drafts/<packId>/spec.json`。模板包（`pack/`）由确定性生成器从 spec 产出，
发布只能由用户点击「发布」。你负责读现有模板、确认需求、写 spec、生成与解释结果。

## 1. 何时加载

- 在「模板工作室」里新建/编辑自定义设计模板时；
- 用户说“做一个 XX 管理模板”“复用运营管理的列表页，再做一个弹窗表单”“改一下这个模板的页面”时。

应用内的需求/设计/开发视图**不加载**本 skill（那是 `adw-requirements-document` / `adw-design-artifacts` /
`adw-frontend-implementation` 的职责）。

## 2. 读取顺序（不要跳步）

1. 工作室 `AGENTS.md`：身份、可写范围、发布边界；
2. `catalog/index.json`：来源 pack、版本、页面/组件/风格/配方计数；
3. `catalog/pages.json`：内置 25 个页面的 `catalogRef`（`<applicationType>/<pageId>`）、`kind`、`type`、`recipe`、
   `readPath`、`structureReadPath`、组件清单；
4. `catalog/components.json`：组件并集、真实用法片段、`contractSupported` / `contractControl`；
5. `catalog/styles.json`：4 套风格的 id / className / tokens；`catalog/recipes.json`：8 个配方与模板组件；
6. `catalog/builtin/<packId>/...`：按 `readPath`/`structureReadPath` 读蓝图与 `structure.css`（**不要拼仓库路径**）；
7. 当前草稿 `drafts/<packId>/spec.json`（若已存在）、`generation.json`、`notes.md`；
8. 用户消息。

## 3. reference 还是 contract

每个自定义模板只能包含 **1 个 applicationType（id = pack id）** 和 **1 套风格**；页面可以混用两种 kind。

| 选择 | 何时用 | 必须写 | 不能写 |
| --- | --- | --- | --- |
| `reference` | 内置页面已经满足业务，改字段/改文案成本高；优先复用成熟页面 | `source: {pack, applicationType, pageId}`（来自 `pages.json`） | `contract` / `sampleEntity` |
| `contract` | 业务字段/列/表单布局与内置页差异大，或需要组合列/查询/操作/树/子表 | `contract` + `sampleEntity`（+ 可选 `sampleSubEntities`） | `blueprint` / `source` |

- 内置页面本身是 `blueprint`（只读参考，不能出现在自定义 spec 的 pages 里）。
- 页面 id 建议：reference 用 `<来源短名>-<sourcePageId>`；contract 用 `<业务>-<recipe>`（如 `supplier-form`）。
- 一个模板 1—40 页；顺序即页面顺序与结构样式合并顺序（reference 来源类型按首次出现排序）。

## 4. 页面契约字段（contract）

`recipe` 必须是 8 个之一：`list` / `tree-list` / `dialog-form` / `page-form` / `main-sub` / `detail` / `dashboard` / `wizard`。
`type` 可省略（按 recipe 推断）。`contract` 内字段与 `pages.json` 页面契约同名，全部可选：

| 字段 | 用途 | 说明 |
| --- | --- | --- |
| `filters` | 查询条件 | 字段名数组；来自 `sampleEntity.fields[].name` |
| `columns` | 表格列 | 字段名数组（list / tree-list / detail 子表等） |
| `rowActions` / `toolbarActions` | 行/工具栏动作 | `detail`/`edit`/`delete`/`create`/`import`/`export`/`batchDelete` 等 |
| `selection` | 是否多选 | boolean |
| `pagination` | 分页 | `{layout:'bar'|'split'|'three-part', pageSize}` |
| `form` | 表单 | `{presentation:'dialog'|'page', columns, width?, groups:[{title, fields[]}]}` |
| `tree` | 左树 | `{titleField, parentField?, actionStyle?, selectionStyle?}` |
| `subTables` | 子表 | `[{entity|target, title, columns[], mode?}]`，实体需在样例实体池内 |
| `components` | 字段→pm-* 覆盖 | object；值必须是 `catalog/components.json` 中 `contractSupported: true` 的组件 |

详情与示例见 `references/contract-recipes.md`。

## 5. sampleEntity / sampleSubEntities

- `sampleEntity` 必填：`{id, name, fields:[{name, label, type, options?, required?, unique?, ref?, note?}]}`；
  `name` 是**键**（列/查询/表单/分组引用它），`label` 是显示名；
- `sampleSubEntities` 可选：子实体数组；`subTables.entity/target` 必须能在 `sampleEntity + sampleSubEntities` 池内解析；
- 字段类型：`string/text/number/decimal/date/datetime/time/boolean/enum/ref`；`enum` 需要 `options`；
- 只用于模板预览（synthetic design），不写进应用需求；应用内仍以 `docs/design/pages.json` 为准。

## 6. 组件映射（契约能力边界）

- 契约只覆盖**字段控件**：`templates/design-system/component-controls.json` 的映射（20 键）与 39 个组件并集相交，
  当前 **13 个可映射控件**：`pm-input`/`pm-select`/`pm-select-tree`/`pm-number`/`pm-switch`/`pm-datepicker`/
  `pm-textarea`/`pm-radio`/`pm-checkbox`/`pm-upload`/`pm-image`/`pm-select-user`/`pm-select-org`；
- 只写 `contract.components` 里真实支持的 `pm-*`；其它容器/展示组件由 `ContractPage` 固定结构渲染，不要在契约里指定；
- 未知组件会给 `component-unknown` warning（保留原值、不阻断），但预览不会生效；
- 不发明新的 `pm-*` 组件名，也不修改内置 pack/组件实现。

## 7. 风格固定 1 套

- `style` 必须是 `catalog/styles.json` 中的 1 个 id；模板只复制该风格（`styles/shared.css` + `styles/<styleId>/style.css`）；
- 不支持改 tokens/自定义 CSS；如需别的视觉，换一个内置风格 id；
- `baseApplicationType` 决定 contract 页的根类与兜底结构样式；缺省取第一个 reference 的来源类型，否则企业级应用平台。

## 8. 工作流

1. **复述确认**：用中文复述目标（业务场景 / 页面清单 / reference 或 contract / 风格 / 子表），
   只问真正阻塞的问题（**≤3 个**）；不确认也能给默认方案，但要标注假设。
2. **读 catalog**：核对页面 `catalogRef`、组件能力、风格 id；优先 reference 成熟页面，contract 补差异页。
3. **写 spec**：一次写完整 `drafts/<packId>/spec.json`（严格按 `references/spec.schema.json`）；
   contract 页的列/查询/表单/树/子表字段必须存在于 `sampleEntity`（子表还需 `sampleSubEntities`）。
4. **生成**：运行 `node .opencode/scripts/generate.cjs --draft <packId>`，读取 JSON 结果
   （`pack/pages/css/warnings/errors`）；也可由用户点「生成预览」（同一生成器）。
5. **修正**：只改 spec；按 `errors[].path` 定位；warning 说明取舍（缺字段会跳过而不是编造）。
6. **交接发布**：告诉用户“已生成，可在右侧预览；确认后点发布”，**不要自行发布**。

## 9. 禁止事项

- 不写 `.vue`、不改 `pack/`、CSS、catalog、`.opencode/**`、仓库源码、应用工作区（除当前 `spec.json`/`notes.md`）；
- 不发明页面 id / 组件名 / 风格 id；不引用不存在的内置页面；
- 不运行除生成/校验脚本外的 shell；不调用 `git`；
- 不发布、不删除模板、不改应用设计系统；
- 不把内置模板页面的 `kind=blueprint` 写进 spec（内置页由内置 pack 自身承载）。

## 10. 汇报要求（中文）

每次完成用中文汇报：**页面清单**（reference / contract 分开）、**风格**、**生成/校验结果**（errors/warnings
与修正）、**未实现项/假设**、**发布前待确认**。所有面向用户的文字一律中文；代码、命令、id、路径除外。
