# 偏好设置契约

读取目标项目本地模板或本技能 `../assets/PageTemplates/utils.js` 核实当前字段。输入是已完成平台/应用合并的有效 GlobalPreference 对象，不是后台首选项树。当前模块不实现持久化、跨微前端同步或 followPlatformSetting 合并。

每个子项目只有一个总的响应式 GlobalPreference 来源，页面统一导入；首次建立与接入方式见 [子项目接入](integration.md)。页面子组件可通过 props 接收该来源，但不能自行新建一套默认配置。

## 层级与边界

| 层级 | 当前能力 | 不属于偏好的内容 |
| --- | --- | --- |
| 整体外观 | common.density，既有主题变量 | 基座导航、路由、权限；不能把尚未实现的布局设置写成可用参数 |
| 页面模板 | templates.list/form 的排列、分页、列数等 | 接口、字段、保存流程 |
| 页面区块 | blocks.actionBar、queryPanel、rowActions | 查询模型、业务按钮及权限 |
| 具体组件 | tableConfig、text、textarea；其他组件按实际 API 适配 | model、rules、业务只读/禁用条件 |

有效对象 → resolvePagePreferences → 分别绑定组件/模板 → 页面显式覆盖。页面明确要求优先于继承；本技能的字段数量布局规则在页面层计算，不修改公共解析器的默认值。

```js
const bindings = computed(() => resolvePagePreferences(props.preference))
const formColumns = computed(() =>
  businessFields.value.length > 8 ? 2 : bindings.value.formPage.columns)
const formDialogWidth = computed(() =>
  `min(${formColumns.value === 2 ? 800 : 520}px, calc(100vw - 32px))`)
```

businessFields 表示页面实际定义的业务字段列表，计数包含多行文本，不包含按钮、标题及隐藏 ID。将同一个 formColumns 传给表单与弹窗宿主；超过 8 个字段时不被解析器默认单列覆盖。用户明确指定布局时按要求覆盖。

支持 size 的 pm- 组件默认在 v-bind 之后显式设置 `size="default"`，避免组件库默认尺寸或父级 el-form 的 small 尺寸意外生效。仅在用户或业务明确要求其他尺寸时覆盖该默认，不将 common.density 的 compact 自动映射为 pm- 组件 small。不支持 size 且无有效透传的组件应先核实源码，不添加无效属性。

若工程从 store/ref 获取偏好，按其真实响应式结构读取，不在 setup 时解构出失去响应性的快照。

```vue
<BusinessListPage v-bind="bindings.list" />
<!-- 只在该页面明确要求居右时添加覆盖；移除即可恢复跟随 -->
<BusinessListPage v-bind="bindings.list" actions-align="end" />
```

## 已实现的映射

| 输入路径 | 值 / 默认 | 输出 |
| --- | --- | --- |
| common.density | comfortable / compact，默认 comfortable | list/formPage.density；table/form.size |
| blocks.actionBar.align | start / end，默认 start | list/formPage.actionsAlign 的后备值 |
| templates.list.actionsAlign | start / end，缺失/null 跟随区块 | list.actionsAlign |
| templates.list.paginationAlign | start / end，默认 end | list.paginationAlign |
| templates.list.paginationLayout | bar / split / three-part，默认 bar | list.paginationLayout |
| blocks.queryPanel.mode | inline / card，默认 inline | queryPanel.mode |
| blocks.queryPanel.defaultExpanded | boolean，默认 true | queryPanel.defaultExpanded（初始状态） |
| blocks.rowActions.mode | text / icon / more，默认 text | rowActions.mode |
| templates.form.actionsAlign | start / end，缺失/null 跟随区块 | formPage.actionsAlign |
| templates.form.columns | 数字 1 / 2，默认 1 | formPage.columns |
| templates.form.stickyFooter | boolean，默认 true | formPage.stickyFooter |
| templates.form.labelPosition | left / right / top | form.labelPosition；缺失回退 formConf.labelPosition，再默认 top |
| templates.form.viewDisplay | component / text，默认 component | view.display（查看态展示：禁用组件 vs 只显示字段内容不渲染输入组件） |
| tableConfig.stripe / border | boolean，默认 false | table.stripe / border |
| tableConfig.pageSizes | 正整数数组或 JSON 字符串，去重 | pagination.pageSizes；无效回退 [10,20,30,50,100] |
| text.showWordLimit | boolean，默认 false | text.showWordLimit |
| textarea.showWordLimit | boolean，默认 false | textarea.showWordLimit |

form.labelWidth 当前固定 120px。compact 输出 table/form 的 small 尺寸，并由模板样式把表格行高设为 32px；pm- 组件采用前述显式尺寸规则。标准密度沿用平台行高。三段式分页有自身对齐规则，不消费 paginationAlign。

## 旧组件偏好的处理

保留原来 `v-bind="GlobalPreference.text"` 的思路，但模板生成优先使用白名单适配后的 bindings。不能将 vxe-table 的整份 tableConfig 直接传给 el-table；resizable、virtualScroll、rowHeight、align 等需有针对性实现才承诺有效。

`select-user` 等现有偏好键目前未纳入 resolvePagePreferences。需要时核实 pm-select-user 当前 props/透传实现，并单独创建响应式白名单绑定；不能假称已有 bindings.selectUser。历史配置里 showHeadPortrait、isTipsDisabled 等字段不能仅凭名字认定有效。

业务属性应写在偏好绑定之后，例如 v-model、readonly、disabled、字典码、校验等。保留显式 false，不能用 `value || true` 合并布尔偏好。外观切换不使用 key 重建表单/表格。

全局改变同类页面：修改有效偏好来源或公共区块样式；修改单页：局部属性/插槽；新增偏好能力：同步实现解析器、消费者和示例，再更新说明。不要只有配置键而没有消费代码。
<!-- Modified by AI on 2026-11-12 11:20:40 -->
