---
name: pm-components-usage
description: "primeton-form-components-v3 组件库使用指南。Use when: 在项目中使用 pm-* 组件（pm-table、pm-field、pm-select-dict、pm-lookup、pm-form-dialog、pm-upload 等）；查询组件的 props/emits/slots/方法；编写基于该库的表单、表格、弹窗、上传页面；排查组件用法问题；选择合适组件实现业务需求。组件开发规范请改用 vue3-component-developer 技能。"
---

# primeton-form-components-v3 组件使用技能

本技能面向**使用** `primeton-form-components-v3` 组件库（pm-* 系列）开发业务页面的场景，帮助快速选型并正确传参。

## 库概况

- **技术栈**：Vue 3.4+，PC 端基于 Element Plus 封装，移动端基于 Vant 4
- **规模**：75 个组件目录（PC 75 / 移动端若干），按 6 大类组织
- **仓库**：可选的本地组件源码仓库（不要求固定路径）（源码 `src/components/<name>/pc.vue`，每个组件目录都有 `demo.vue` 可运行示例）
- **废弃组件**：PmFlip、PmMultiUrl、PmSelectRich、PmMain、PmHamburger（勿在新代码中使用）

## 组件注册与资料边界

AFCenter 子项目已提供的公共组件直接使用，不重复安装或以同名库组件覆盖。其他项目沿用自身实际注册入口，不假设 npm 包导出或 `@/components/pm-*` 源码存在。

本目录 references 随技能完整分发，先按需查阅对应 API。文档中的 `src/components/...` 均指组件库源码的可选核对位置，不是业务项目导入路径。有目标版本源码时核实存在疑问的契约；没有源码时使用资料已明确的能力，说明无法核实的接口，不杜撰方法。页面生成配合相邻的 [afcenter-page-generation](../afcenter-page-generation/SKILL.md)。

## 通用约定（先读这个，能少查一半文档）

几乎所有表单/选择器类组件遵循同一套 API 约定：

| 约定 | 说明 |
| --- | --- |
| `v-model` | 绑定值，内部为 `modelValue` prop + `update:modelValue` emit |
| `mode` | `'edit'`（默认，可编辑）/ `'view'`（纯展示，渲染为文本） |
| `readonly` / `disabled` | 只读（可复制不可改）/ 禁用（置灰） |
| `placeholder` / `clearable` | 同 Element Plus 语义 |
| `nullLabel` | 空值占位文本（view 模式下空值显示，多为 `'--'`） |
| PC / Mobile | 同一目录下 `pc.vue` / `mobile.vue` 双版本；`index_mobile.js` 单独注册移动端 |

未声明属性是否透传取决于具体组件，不能将 `$attrs` 透传视为通则。支持 size 的 pm- 字段默认显式设置 `size="default"`。

## 组件分类速查

| 分类 | 组件 | 典型用途 |
| --- | --- | --- |
| 表单输入 | pm-input、pm-textarea、pm-number、pm-number-range、pm-switch、pm-field、pm-filter、pm-search、pm-auto-number、pm-richtext、pm-markdown、pm-upload、pm-null-value、pm-multi-url(废弃) | 基础录入 |
| 选择器 | pm-select、pm-select-dict、pm-select-entity、pm-select-ext、pm-select-org、pm-select-user、pm-select-position、pm-select-tree、pm-cascader、pm-checkbox、pm-radio、pm-datepicker、pm-datepick-range、pm-time-select、pm-lookup | 下拉/日期/人员组织选择 |
| 数据展示 | pm-table、pm-tree、pm-list、pm-card、pm-pagination、pm-steps、pm-image、pm-html、pm-echarts、pm-calendar、pm-sheet、pm-outline、pm-empty、pm-skeleton、pm-divider | 列表/图表/容器 |
| 反馈浮层 | pm-dialog、pm-form-dialog、pm-context-menu(-group/-item/-submenu)、pm-drop-menu(-item)、pm-expand-card、pm-floating-pane、pm-fold(-group)、pm-slide-verify、pm-sort、pm-clip-button | 弹窗/菜单/交互反馈 |
| 业务组件 | pm-bind、pm-change、pm-download、pm-dynamic、pm-ocr、pm-option、pm-sheet | 数据绑定、OCR、Excel |
| 布局导航 | pm-affix、pm-split、pm-main(废弃)、pm-toolbar(-group/-item)、pm-hamburger(废弃)、pm-flip(废弃) | 页面骨架 |

各组件完整 props/emits/方法列表见 `references/`：

- `references/form-inputs.md` — 表单输入类（14 个）
- `references/selectors.md` — 选择器类（16 个）
- `references/data-display.md` — 数据展示类（15 个）
- `references/feedback.md` — 反馈浮层类（15 个）
- `references/business-layout.md` — 业务组件 + 布局导航类

## 高频组件速用

### pm-table — 配置化表格

```vue
<pm-table
  :table-data="rows"
  :columns="[
    { prop: 'name', label: '姓名' },
    { prop: 'status', label: '状态', scope: 'status' },   // scope 指向具名插槽
    { prop: 'age', label: '年龄', hidden: false, width: 120 },
  ]"
  :checked="true"        // 显示复选框
  :show-index="true"     // 显示序号列
  @changrows="onSelect"  // 选中行变化
>
  <template #status="{ row }">
    <el-tag>{{ row.status }}</el-tag>
  </template>
</pm-table>
```

ref 方法：`getSelectRows()`、`changeColumns(cols)`、`rerender()`、`toggleSelection(row)`。列支持 `a.b` 嵌套 prop。

### pm-field — 任意组件绑定到 model 路径

```vue
<pm-field :model="form" component="el-input" prop="name" />
<pm-field :model="form" component="el-input-number" prop="age" />
<pm-field :model="form" component="el-switch" prop="active" />
<pm-field :model="form" component="el-input" prop="address.city" default-value="--" />
```

`prop` 支持 `a.b` 嵌套路径；路径不存在时用 `default-value`。

### pm-select-dict — 字典下拉

```vue
<pm-select-dict v-model="gender" dict-type-code="gender" clearable filterable />
<!-- 联动：parentCode 为空自动禁用 -->
<pm-select-dict v-model="city" dict-type-code="City" :parent-code="province" disable-when-parent-empty />
```

`dictTypeCode` 必填。支持 `multiple`、`readonly`、`mode="view"`。

### pm-lookup — 实体查找带回

```vue
<pm-lookup v-model="userId" entity="demoEntity" value-field="id" label-field="name" />
<pm-lookup v-model="userIds" entity="demoEntity" multiple />
```

`bindType`: `'value'`（值直传）/ `'entity'`（对象绑定）；`selected` prop 传入实体对象用于回显。

### pm-form-dialog — 表单弹窗

```vue
<pm-form-dialog
  v-model:dialog-visible="visible"
  title="用户信息"
  :loading="submitting"
  :submitable="true"
  @submit="onSubmit"
  @cancel="visible = false"
>
  <template #form>
    <el-form>…</el-form>
  </template>
</pm-form-dialog>
```

### pm-upload — 文件上传

```vue
<pm-upload v-model="fileIds" multiple list-type="list" :headers="{}" />
<pm-upload v-model="imgIds" list-type="picture" accept="image/*" :file-size="10" size-unit="MB" />
<pm-upload v-model="ids" list-type="table" :columns="tableColumns" />
```

`listType`：`list` / `picture` / `table`；v-model 绑定文件 ID。

## 使用流程

1. **选型**：查上面的分类表确定组件；同类优先级：业务封装（pm-select-dict）> 通用封装（pm-select）> 直接用 Element Plus。
2. **查 API**：打开对应 `references/*.md` 看 props/emits；方法列表是静态扫描结果，可能混入 computed/内部方法，调用前在源码确认是否 `expose`。
3. **看示例**：有组件源码时按需查看对应 `demo.vue`；无源码时使用本技能附带的 API 资料和目标项目现有用法。
4. **验证**：在目标项目验证所用组件的值类型、回显和交互；不要求接收方具备组件库仓库。

## 注意事项

- 表单组件的 `mode="view"` 与 `readonly` 是两套展示逻辑：view 渲染为纯文本（用于详情页），readonly 保留控件形态。
- 移动端组件（`mobile.vue`）需从 `index_mobile.js` / `mobile_entry.js` 注册，不能混用 PC 注册表。
- 本库基于 Element Plus 2.14+，`$attrs` 透传时注意 Element Plus 版本差异（如 `popper-class` 等）。
- 生成 references 的脚本逻辑：从 `pc.vue` 静态解析 props/emits/slots，个别组件（pm-dynamic、pm-main、pm-null-value、pm-search、pm-toolbar-item）未解析出 props，请直接读源码。
<!-- Modified by AI on 2026-11-12 11:22:13 -->
