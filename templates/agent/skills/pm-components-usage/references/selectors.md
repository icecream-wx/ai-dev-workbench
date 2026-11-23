# 选择器类组件 API 速查

> 由脚本从源码静态提取；「可调用方法」可能混入 computed/内部方法，调用前请在源码确认是否对外 expose。若有出入以 `src/components/<name>/pc.vue` 与同目录 `demo.vue` 为准。

## pm-cascader

级联选择器组件，基于 el-cascader 封装，支持多级联动数据选择和回显

- 平台：pc
- 源码：`src/components/pm-cascader/pc.vue`，示例：`src/components/pm-cascader/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `label` | String | `''` |
| `selected` | any（未标注） | `undefined` |

### Emits：`update:selected`

### 可调用方法（ref）：`viewSelectedLabel()`

## pm-checkbox

复选框组组件

- 平台：pc / mobile
- 源码：`src/components/pm-checkbox/pc.vue`，示例：`src/components/pm-checkbox/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `emptyText` | any（未标注） | `''` |
| `optionType` | any（未标注） | `undefined` |
| `showStyle` | String | `'row'` |
| `readonly` | Boolean | `false` |
| `isHighlight` | Boolean | `false` |

### 可调用方法（ref）：`customContent()`, `checkboxType()`

## pm-datepick-range

日期范围选择器组件，基于 el-date-picker 封装，支持开始/结束日期范围选择

- 平台：pc
- 源码：`src/components/pm-datepick-range/pc.vue`，示例：`src/components/pm-datepick-range/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | any（未标注） | `null` |
| `value` | any（未标注） | `undefined` |
| `value2` | any（未标注） | `null` |
| `settings` | Object | `工厂函数` |
| `placeholder` | String | `'开始日期'` |
| `placeholder2` | String | `'结束日期'` |
| `valueFormat` | String | `''` |
| `shortcutsProp` | Boolean | `false` |

### Emits：`update:modelValue`, `update:value2`

### 可调用方法（ref）：`rangeType()`, `startPlaceholder()`, `endPlaceholder()`, `isHourOnly()`, `displayFormat()`, `displayValueFormat()`, `filteredAttrs()`, `shortcutOptions()`, `convertFormat()`, `completeDateTimeByType()`, `getDisabledDate()`

## pm-datepicker

日期选择器组件，基于 el-date-picker 封装，支持日期/月份/年份选择

- 平台：pc
- 源码：`src/components/pm-datepicker/pc.vue`，示例：`src/components/pm-datepicker/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | any（未标注） | `null` |
| `value` | any（未标注） | `undefined` |
| `settings` | Object | `工厂函数` |
| `mode` | String | `'edit'` |
| `readonly` | Boolean | `false` |
| `disabled` | Boolean | `false` |
| `isInChildren` | Boolean | `false` |
| `isPickerRange` | Boolean | `false` |
| `maxValue` | String | `''` |
| `minValue` | String | `''` |
| `shortcutsProp` | Boolean | `false` |
| `isEndDate` | Boolean | `false` |

### Emits：`update:modelValue`, `update:max`, `update:min`, `update:maxValue`, `update:minValue`, `change`

### 可调用方法（ref）：`showContent()`, `isDateTimePicker()`, `displayFormat()`, `displayValueFormat()`, `filteredAttrs()`, `isHourOnly()`, `maxIntervalDays()`, `convertFormat()`, `completeDateTimeByFormat()`, `completeDateTimeByType()`, `getDisabledDate()`, `isDateOutsideRange()`

## pm-lookup

数据查找选择器，支持单选/多选，支持 entity 绑定模式与回显

- 平台：pc
- 源码：`src/components/pm-lookup/pc.vue`，示例：`src/components/pm-lookup/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | any（未标注） | `null` |
| `selected` | any（未标注） | `null` |
| `bindType` | String | `'value'` |
| `labelField` | String | `'name'` |
| `valueField` | String | `'id'` |
| `entity` | String | `''` |
| `multiple` | Boolean | `false` |
| `separator` | String | `'` |
| `mode` | any（未标注） | `'edit'` |
| `readonly` | Boolean | `false` |
| `disabled` | Boolean | `false` |
| `selectDisabled` | Boolean | `false` |
| `lableJs` | String | `''` |
| `lableJsEnable` | Boolean | `false` |
| `view` | Object | `null` |
| `viewComponents` | Array | `工厂函数` |
| `queryCondition` | Object | `null` |

### Emits：`update:modelValue`, `update:selected`, `update:persistenceValue`, `confirmSelect`, `change`

## pm-radio

单选框组组件，基于 el-radio-group 封装，支持选项列表、禁用和自定义样式

- 平台：pc / mobile
- 源码：`src/components/pm-radio/pc.vue`，示例：`src/components/pm-radio/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `emptyText` | any（未标注） | `''` |
| `optionType` | any（未标注） | `undefined` |
| `showStyle` | String | `'row'` |
| `readonly` | Boolean | `false` |
| `isHighlight` | Boolean | `false` |

### 可调用方法（ref）：`customContent()`, `radioType()`

## pm-select

下拉选择器总入口组件。

不传 type（或 type 为空）时为基础 el-select，支持静态 options：
- 可通过 options 属性直接传入 [{ label, value, disabled, color }]
- 兼容旧用法 settings.options（settings 其余字段已不再参与数据加载）

传 type 时深度代理到对应的专用下拉组件：
- dict → pm-select-dict
- entity → pm-select-entity
- user → pm-select-user
- org → pm-select-org
- position → pm-select-position
- lookup → pm-lookup
代理时透传所有 $attrs、事件与插槽到子组件。

- 平台：pc / mobile
- 源码：`src/components/pm-select/pc.vue`，示例：`src/components/pm-select/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | any（未标注） | `null` |
| `type` | String | `''` |
| `options` | Array | `工厂函数` |
| `settings` | Object | `工厂函数` |
| `mode` | String | `'edit'` |
| `disabled` | Boolean | `false` |
| `readonly` | Boolean | `false` |
| `multiple` | Boolean | `false` |
| `clearable` | Boolean | `false` |
| `filterable` | Boolean | `false` |
| `placeholder` | String | `''` |
| `separator` | String | `'` |
| `nullLabel` | String | `'--'` |
| `isHighlight` | Boolean | `false` |
| `hasPrefixItem` | Boolean | `false` |
| `size` | String | `'small'` |
| `selected` | any（未标注） | `undefined` |
| `maxOptions` | Number | `200` |
| `isInChildren` | Boolean | `false` |
| `optionTemplateIsEnable` | Boolean | `false` |
| `lableJs` | String | `''` |
| `lableJsEnable` | Boolean | `false` |
| `entityModel` | any（未标注） | `null` |
| `isDynamicSearch` | Boolean | `false` |

### Emits：`update:modelValue`, `update:selected`, `change`

### Slots：`prefix`

### 可调用方法（ref）：`proxyComponent()`, `proxyAttrs()`, `finalOptions()`, `selectedItems()`, `viewLabel()`, `finalDisabled()`, `isEmptyValue()`

## pm-select-dict

字典下拉选择器组件 通过 dictTypeCode 从后端 DictEntryController 获取字典条目并展示为下拉列表。 替代 pm-select + settings.type='dict' 的方式，API 更简洁、聚焦字典场景。 数据映射：label ← item.name, value ← item.code, color ← item.extend 排序：按 sortBy 字段升序 缓存：组件不自带缓存，由父组件通过 v-if / keep-alive 控制

- 平台：pc / mobile
- 源码：`src/components/pm-select-dict/pc.vue`，示例：`src/components/pm-select-dict/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `dictTypeCode` | String | **必填** |
| `parentCode` | String | `null` |
| `modelValue` | any（未标注） | `null` |
| `disabled` | Boolean | `false` |
| `readonly` | Boolean | `false` |
| `clearable` | Boolean | `false` |
| `filterable` | Boolean | `false` |
| `multiple` | Boolean | `false` |
| `placeholder` | String | `''` |
| `mode` | String | `'edit'` |
| `nullLabel` | String | `'--'` |
| `selected` | any（未标注） | `undefined` |
| `disableWhenParentEmpty` | Boolean | `false` |

### Emits：`/** v-model 值更新事件 */
  'update:modelValue`, `/** v-model:selected 选中对象更新事件 */
  'update:selected`, `/** 选中值变化回调，参数为当前选中值 */
  'change`

## pm-select-entity

实体下拉选择器组件 通过 entity 名称从后端 LowcodeModelController 查询实体数据并展示为下拉列表。 替代 pm-select + settings.type='entity' 的方式，API 更简洁。 API：LowcodeModelController.queryWithPage 数据映射：label ← get(item, labelField), value ← get(item, valueField) 支持 queryCondition 查询过滤、sortFields 排序、filterable 动态搜索

- 平台：pc / mobile
- 源码：`src/components/pm-select-entity/pc.vue`，示例：`src/components/pm-select-entity/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `entity` | String | **必填** |
| `labelField` | String | `'label'` |
| `valueField` | String | `'value'` |
| `queryCondition` | Object | `null` |
| `sortFields` | Array | `工厂函数` |
| `sortField` | String | `''` |
| `sortAscending` | Boolean | `true` |
| `disabledField` | String | `'disabled'` |
| `modelValue` | any（未标注） | `null` |
| `disabled` | Boolean | `false` |
| `readonly` | Boolean | `false` |
| `clearable` | Boolean | `false` |
| `filterable` | Boolean | `false` |
| `multiple` | Boolean | `false` |
| `placeholder` | String | `''` |
| `maxOptions` | Number | `200` |
| `mode` | String | `'edit'` |
| `nullLabel` | String | `'--'` |
| `selected` | any（未标注） | `undefined` |

### Emits：`/** v-model 值更新 */
  'update:modelValue`, `/** v-model:selected 选中对象更新 */
  'update:selected`, `/** 选中值变化回调 */
  'change`

## pm-select-ext

扩展下拉选择器组件 结合 el-select + el-dropdown，选择框作为触发器，下拉区域可自定义插槽内容。 适用于需要在选择面板中展示更多内容（如列表、操作按钮等）的场景。

- 平台：pc
- 源码：`src/components/pm-select-ext/pc.vue`，示例：`src/components/pm-select-ext/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `selectWidth` | String | `null` |
| `popWidth` | String | `null` |
| `modelValue` | [String | `null` |
| `valueField` | String | `'value'` |
| `labelField` | String | `'label'` |
| `disabled` | Boolean | `false` |
| `mode` | String | `'edit'` |
| `nullLabel` | String | `'--'` |
| `selected` | any（未标注） | `undefined` |

### Emits：`update:modelValue`, `update:selected`, `change`

## pm-select-org

组织选择器组件，从后端查询组织架构数据并展示为树形下拉选择

- 平台：pc
- 源码：`src/components/pm-select-org/pc.vue`，示例：`src/components/pm-select-org/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | any（未标注） | `null` |
| `isEntityAllSearch` | Boolean | `false` |
| `isOnlyLeafCanSelected` | Boolean | `false` |
| `props` | Object | `工厂函数` |
| `multiple` | Boolean | `false` |
| `placeholder` | String | `'请输入...'` |
| `readonly` | Boolean | `false` |
| `disabled` | Boolean | `false` |
| `clearable` | Boolean | `false` |
| `showMode` | String | `'all'` |
| `dimension` | String | `'def_dimension'` |
| `showCode` | Boolean | `false` |
| `tenantId` | String | `''` |
| `buttonText` | String | `''` |
| `selectTypes` | Array | `工厂函数` |
| `separator` | String | `'` |
| `mode` | String | `'edit'` |
| `type` | String | `'primary'` |
| `navigationTree` | Boolean | `false` |
| `title` | String | `''` |
| `queryDisableOrg` | Boolean | `false` |
| `isAllMode` | Boolean | `false` |
| `linkSeparator` | String | `'/'` |
| `isBindCode` | Boolean | `false` |
| `icon` | String | `''` |
| `isHighlight` | Boolean | `false` |
| `size` | String | `'mini'` |
| `bfpParticipant` | String | `''` |
| `selected` | any（未标注） | `undefined` |

### Emits：`update:modelValue`, `update:selected`, `update:bfpParticipant`, `selectedSuccess`, `change`, `allowSelect`

## pm-select-position

岗位选择器组件，从后端查询岗位数据并展示为下拉列表

- 平台：pc
- 源码：`src/components/pm-select-position/pc.vue`，示例：`src/components/pm-select-position/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | any（未标注） | `null` |
| `entityModel` | any（未标注） | `null` |
| `props` | Object | `工厂函数` |
| `multiple` | Boolean | `false` |
| `placeholder` | String | `'请输入...'` |
| `readonly` | Boolean | `false` |
| `disabled` | Boolean | `false` |
| `clearable` | Boolean | `false` |
| `showMode` | String | `'input'` |
| `showCode` | Boolean | `false` |
| `tenantId` | String | `''` |
| `buttonText` | String | `''` |
| `separator` | String | `'` |
| `mode` | String | `'edit'` |
| `type` | String | `'primary'` |
| `navigationTree` | Boolean | `false` |
| `title` | String | `''` |
| `size` | String | `'mini'` |

### Emits：`update:modelValue`, `update:entityModel`, `selectedSuccess`, `change`

## pm-select-rich

富下拉选择器组件

基于 el-popover 实现的下拉选择器，支持搜索过滤、多选、清除等功能。
适合需要更丰富交互的选择场景。

- 平台：pc
- 源码：`src/components/pm-select-rich/pc.vue`，示例：`src/components/pm-select-rich/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | any（未标注） | `null` |
| `value` | any（未标注） | `undefined` |
| `options` | Array | `工厂函数` |
| `filterable` | Boolean | `false` |
| `searchPlaceholder` | String | `null` |
| `border` | Boolean | `true` |
| `disabled` | Boolean | `false` |
| `readonly` | Boolean | `false` |
| `clearable` | Boolean | `false` |
| `multiple` | Boolean | `false` |
| `placeholder` | String | `'请选择'` |
| `popoverWidth` | [String | `null` |
| `valueField` | String | `'value'` |
| `labelField` | String | `'label'` |
| `mode` | String | `'edit'` |
| `nullLabel` | String | `'--'` |
| `label` | String | `''` |
| `selected` | any（未标注） | `undefined` |

### Emits：`update:modelValue`, `update:selected`, `change`

### 可调用方法（ref）：`mixDisabled()`, `dataFilter()`, `viewLabel()`, `viewSelectedLabel()`, `viewReady()`, `visible()`, `renderValue()`, `clear()`, `removeItem()`, `choose()`, `emitSelected()`

## pm-select-tree

树形选择器组件，基于 el-tree-select 封装，支持树形数据结构和多级选择

- 平台：pc
- 源码：`src/components/pm-select-tree/pc.vue`，示例：`src/components/pm-select-tree/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `entityModel` | any（未标注） | `null` |
| `isEntityAllSearch` | any（未标注） | `false` |
| `settings` | Object | `工厂函数` |
| `placeholder` | String | `工厂函数` |
| `selected` | any（未标注） | `undefined` |

### Emits：`update:modelValue`, `update:entityModel`, `update:displayField`, `update:selected`, `selectedSuccess`, `allowSelect`, `getCondition`, `change`

### 可调用方法（ref）：`staticList()`, `staticTreeData()`, `getConditionValueStr()`, `getAllPathByKey()`, `getBrothersById()`, `refresh()`, `reloadParent()`, `reloadChildren()`, `expand()`, `expandAll()`

## pm-select-user

用户选择器组件，从后端查询用户数据并展示为可选列表，支持多选和搜索

- 平台：pc
- 源码：`src/components/pm-select-user/pc.vue`，示例：`src/components/pm-select-user/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | any（未标注） | `null` |
| `props` | Object | `工厂函数` |
| `multiple` | Boolean | `false` |
| `placeholder` | String | `'请输入...'` |
| `readonly` | Boolean | `false` |
| `disabled` | Boolean | `false` |
| `clearable` | Boolean | `false` |
| `showMode` | String | `'all'` |
| `showCode` | Boolean | `false` |
| `dimension` | String | `'def_dimension'` |
| `tenantId` | String | `''` |
| `buttonText` | String | `''` |
| `selectTypes` | Array | `工厂函数` |
| `separator` | String | `'` |
| `mode` | String | `'edit'` |
| `type` | String | `'primary'` |
| `navigationTree` | Boolean | `false` |
| `title` | String | `''` |
| `queryDisableUser` | Boolean | `false` |
| `queryDisableOrg` | Boolean | `false` |
| `isBindCode` | Boolean | `false` |
| `isInChildren` | Boolean | `false` |
| `icon` | String | `''` |
| `optionTemplateIsEnable` | Boolean | `false` |
| `chooseMode` | String | `'selectAndDialog'` |
| `collapseTags` | Boolean | `false` |
| `bfpParticipant` | String | `''` |
| `needScroll` | Boolean | `false` |
| `size` | String | `'mini'` |
| `isHighlight` | Boolean | `false` |
| `selected` | any（未标注） | `undefined` |

### Emits：`update:modelValue`, `update:selected`, `update:bfpParticipant`, `selectedSuccess`, `change`, `allowSelect`, `selectUserVisibleChange`

## pm-time-select

时间选择器组件，基于 el-time-select 封装，支持时间点选择和时段限制

- 平台：pc
- 源码：`src/components/pm-time-select/pc.vue`，示例：`src/components/pm-time-select/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | any（未标注） | `null` |
| `value` | any（未标注） | `undefined` |
| `valueFormat` | String | `'HH:mm:ss'` |
| `mode` | String | `'edit'` |
| `nullLabel` | String | `'--'` |

### Emits：`update:modelValue`

### 可调用方法（ref）：`get()`, `set()`

