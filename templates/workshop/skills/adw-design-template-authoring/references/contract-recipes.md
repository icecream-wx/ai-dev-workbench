# 页面契约配方参考（8 个 recipe）

> 来源：内置 pack `afcenter-app-templates-v1` 的 `pageRecipes` 与 `templates/design-system/component-controls.json`。
> 本文件只给编写提示；字段口径以 `references/spec.schema.json` 与后端生成器为准。

契约页（`kind: "contract"`）用 `contract` 容器描述页面能力。所有字段名必须来自该页 `sampleEntity.fields[].name`
（子表可用 `sampleSubEntities`）。缺失字段不会伪造：生成/预览会跳过并给 warning。

## 1. `list`（列表台账）

- 能力：查询条 `filters`、表格 `columns`、行操作 `rowActions`、工具栏 `toolbarActions`、多选 `selection`、
  分页 `pagination`（`bar` / `split` / `three-part`）。
- 示例：

```jsonc
{
  "kind": "contract",
  "recipe": "list",
  "type": "list",
  "contract": {
    "filters": ["name", "status"],
    "columns": ["code", "name", "status", "owner", "amount"],
    "rowActions": ["detail", "edit", "delete"],
    "toolbarActions": ["create", "export"],
    "selection": true,
    "pagination": { "layout": "three-part", "pageSize": 10 },
    "components": { "owner": "pm-select-user", "status": "pm-select" }
  },
  "sampleEntity": { "id": "supplier", "name": "供应商", "fields": [/* ... */] }
}
```

## 2. `tree-list`（树表台账）

- 能力：左树 + 右表；`tree` 需要 `titleField`（建议为 `sampleEntity` 中唯一的名称字段），可选 `parentField`；
- 缺少 `parentField` 或样例数据无法嵌套时，预览按扁平列表 + 提示（`tree-parent-missing`）；
- 示例：

```jsonc
{
  "recipe": "tree-list",
  "type": "list",
  "contract": {
    "filters": ["name"],
    "columns": ["code", "name", "status"],
    "tree": { "titleField": "name", "parentField": "org", "actionStyle": "header", "selectionStyle": "platform" },
    "selection": false,
    "pagination": { "layout": "bar", "pageSize": 10 }
  }
}
```

## 3. `dialog-form`（弹窗表单）

- 能力：`form.presentation: "dialog"` + `columns`（1/2）+ `width`（如 900）+ `groups[{title, fields[]}]`；
- `components` 覆盖字段控件（如负责人 `pm-select-user`、备注 `pm-textarea`）；
- 示例：

```jsonc
{
  "recipe": "dialog-form",
  "type": "form",
  "contract": {
    "form": {
      "presentation": "dialog",
      "columns": 2,
      "width": 900,
      "groups": [
        { "title": "基本信息", "fields": ["code", "name", "status"] },
        { "title": "扩展信息", "fields": ["owner", "amount", "remark"] }
      ]
    },
    "components": { "owner": "pm-select-user", "remark": "pm-textarea" }
  }
}
```

## 4. `page-form`（页面表单）

- 与 `dialog-form` 相同字段，`presentation: "page"`；用于独立新建/编辑页（无弹窗宽度）；
- 示例：`"form": { "presentation": "page", "columns": 2, "groups": [...] }`。

## 5. `main-sub`（主子表）

- 能力：主表 `form` 分组 + 子表 `subTables[]`（`entity` 或 `target` 指向 `sampleSubEntities`）；
- `mode`: `tab`（默认页签）等；子表 `columns` 来自子实体字段；
- 示例：

```jsonc
{
  "recipe": "main-sub",
  "type": "form",
  "contract": {
    "form": { "presentation": "page", "columns": 2, "groups": [{ "title": "基本信息", "fields": ["code", "name"] }] },
    "subTables": [
      { "entity": "supplier-contact", "title": "联系人", "columns": ["contactName", "phone"], "mode": "tab" }
    ]
  },
  "sampleEntity": { "id": "supplier", "name": "供应商", "fields": [/* ... */] },
  "sampleSubEntities": [
    { "id": "supplier-contact", "name": "联系人", "fields": [
      { "name": "contactName", "label": "联系人", "type": "string" },
      { "name": "phone", "label": "电话", "type": "string" }
    ] }
  ]
}
```

## 6. `detail`（详情页）

- 能力：标题/状态 + 信息分组（`columns` 控制展示字段）+ 可选子表 `subTables`；
- 示例：`"contract": { "columns": ["code", "name", "status", "owner", "amount"], "subTables": [...] }`。

## 7. `dashboard`（驾驶舱）

- 能力：指标卡（记录数、数值字段合计、枚举种类）+ 图表 + 最近记录表格；
- 建议在 `columns` 里给 1—2 个数值字段（`number`/`decimal`）与 1 个枚举字段（`enum`）以获得指标/饼图；
- 示例：`"contract": { "columns": ["amount", "status"], "pagination": { "layout": "bar", "pageSize": 8 } }`。

## 8. `wizard`（分步表单）

- 能力：`form.groups` 的每个分组 = 一个步骤；步骤条 + 当前分组字段 + 上一步/下一步/提交；
- 建议 2—4 个分组，字段均来自 `sampleEntity`；
- 示例：`"contract": { "form": { "presentation": "page", "columns": 1, "groups": [{ "title": "基本信息", "fields": [...] }, { "title": "确认提交", "fields": [...] }] } }`。

## 组件映射提醒

- 可在 `contract.components` 指定的只有 `contractSupported: true` 的控件（当前 13/39）；
  以 `catalog/components.json` 的 `contractControl` 为准；
- 表格/分页/树/弹窗/步骤/图表等容器由 `ContractPage` 固定结构渲染，不要在契约里指定；
- 写入不存在的 `pm-*` 只会得到 `component-unknown` warning，预览不生效。

## 常见 warning（不阻断）

| code | 含义 | 处理 |
| --- | --- | --- |
| `page-field-unknown` | 列/查询/表单字段不在 `sampleEntity` | 改用真实字段名，或补充 sampleEntity |
| `sample-sub-entity-missing` | `subTables.entity/target` 不在样例实体池 | 补 `sampleSubEntities` 或修正 target |
| `component-unknown` | `components` 值不是 catalog 组件 | 换成受支持控件 |
| `tree-parent-missing` | 树无父字段/无法嵌套 | 补 `parentField` 或接受扁平预览 |
| `css-conflict` | 合并结构样式出现同选择器不同规则 | 调整页面顺序或在汇报中说明 |
