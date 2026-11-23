# 表单输入类组件 API 速查

> 由脚本从源码静态提取；「可调用方法」可能混入 computed/内部方法，调用前请在源码确认是否对外 expose。若有出入以 `src/components/<name>/pc.vue` 与同目录 `demo.vue` 为准。

## pm-auto-number

自动编号组件，自动生成并展示编号，支持前缀、后缀、日期格式等配置

- 平台：pc / mobile
- 源码：`src/components/pm-auto-number/pc.vue`，示例：`src/components/pm-auto-number/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | any（未标注） | `null` |
| `mode` | any（未标注） | `'edit'` |
| `vModel` | any（未标注） | `''` |
| `generateTime` | any（未标注） | `'save'` |
| `entityName` | any（未标注） | `''` |
| `formData` | any（未标注） | `''` |

### Emits：`update:modelValue`

## pm-field

表单字段组件，包一层 el-form-item 并绑定 value/label，支持 edit/view 模式切换

- 平台：pc
- 源码：`src/components/pm-field/pc.vue`，示例：`src/components/pm-field/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `model` | Object | `工厂函数` |
| `component` | String | `'el-input'` |
| `prop` | String | `''` |
| `onlyNumber` | Boolean | `false` |
| `bindFormat` | Object | `工厂函数` |
| `defaultValue` | any（未标注） | `undefined` |
| `removeHook` | Function | `工厂函数` |

### Emits：`update:modelValue`

### 可调用方法（ref）：`val()`, `setValue()`

## pm-filter

数据过滤组件，提供过滤条件输入，实时触发过滤回调，支持防抖

- 平台：pc
- 源码：`src/components/pm-filter/pc.vue`，示例：`src/components/pm-filter/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `data` | Array | `工厂函数` |
| `placeholder` | String | `'条件'` |
| `modelValue` | Array | `工厂函数` |

### Emits：`update:modelValue`, `input`

## pm-input

输入框组件

- 平台：pc
- 源码：`src/components/pm-input/pc.vue`，示例：`src/components/pm-input/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | string|number|null | `null` |
| `mode` | 'edit'|'view' | `'edit'` |
| `disabled` | boolean | `false` |
| `readonly` | boolean | `false` |
| `clearable` | boolean | `false` |
| `placeholder` | string | `undefined` |

### Slots：`prepend`, `append`, `suffix`, `prefix`

### 可调用方法（ref）：`get()`, `set()`

## pm-markdown

Markdown 编辑器组件，基于 CodeMirror 的 Markdown 编辑与实时预览

- 平台：pc
- 源码：`src/components/pm-markdown/pc.vue`，示例：`src/components/pm-markdown/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `_index` | number | — |
| `level` | number | — |
| `text` | string | — |
| `el` | HTMLElement | — |

### Slots：`actions`

## pm-multi-url

多 URL 输入组件，支持输入多个 URL 地址，可动态添加和删除

- 平台：pc
- 源码：`src/components/pm-multi-url/pc.vue`，示例：`src/components/pm-multi-url/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | String | `''` |
| `value` | any（未标注） | `undefined` |
| `errors` | Object | `工厂函数` |
| `editable` | Boolean | `true` |
| `validator` | Array | `工厂函数` |
| `label` | String | `'地址'` |

### Emits：`update:modelValue`

## pm-null-value

空值占位组件，在空数据时展示统一的占位符样式

- 平台：pc
- 源码：`src/components/pm-null-value/pc.vue`，示例：`src/components/pm-null-value/demo.vue`

## pm-number

数字输入框组件

- 平台：pc / mobile
- 源码：`src/components/pm-number/pc.vue`，示例：`src/components/pm-number/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | any（未标注） | `null` |
| `prefixValue` | String | `''` |
| `suffixValue` | String | `''` |
| `precision` | [Number | `null` |
| `PositiveColor` | String | `''` |
| `minusColor` | String | `''` |
| `formatSetting` | String | `''` |
| `zeroSetting` | String | `''` |
| `zeroSettingCustom` | String | `''` |
| `nullSetting` | String | `'noshow'` |
| `nullSettingCustom` | String | `''` |

### Emits：`update:modelValue`

## pm-number-range

数字范围输入组件，支持最小值和最大值的范围输入

- 平台：pc / mobile
- 源码：`src/components/pm-number-range/pc.vue`，示例：`src/components/pm-number-range/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | any（未标注） | `null` |
| `value2` | any（未标注） | `null` |
| `separator` | String | `'` |
| `placeholder2` | String | `''` |

### Emits：`update:modelValue`, `update:value2`

## pm-richtext

富文本编辑器组件，基于 TinyMCE 的富文本编辑器，支持多种格式和插件

- 平台：pc / mobile
- 源码：`src/components/pm-richtext/pc.vue`，示例：`src/components/pm-richtext/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `id` | String | `'pm-rich-text'` |
| `modelValue` | String | `''` |
| `disabled` | Boolean | `false` |
| `readonly` | Boolean | `false` |
| `clickValue` | String | `''` |
| `autoresize` | Boolean | `true` |
| `plugins` | [String | `'link lists image code table w…` |
| `minHeight` | Number | `null` |
| `maxHeight` | Number | `null` |
| `height` | Number | `300` |
| `fontFormats` | any（未标注） | `'微软雅黑=Microsoft YaHei` |
| `toolbar` | [String | `'code undo redo restoredraft |…` |
| `action` | any（未标注） | `'/api/lowcode/models/attachmen…` |
| `fileUrl` | Function | `null` |
| `headers` | Object | `工厂函数` |

### Emits：`update:modelValue`, `onClick`

## pm-search

搜索组件，带搜索按钮的搜索输入框，支持搜索回调、清空和快捷键触发

- 平台：pc / mobile
- 源码：`src/components/pm-search/pc.vue`，示例：`src/components/pm-search/demo.vue`

### Slots：`body`

## pm-switch

开关组件，基于 el-switch 封装的开关切换组件，支持 edit/view 双模式

- 平台：pc / mobile
- 源码：`src/components/pm-switch/pc.vue`，示例：`src/components/pm-switch/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | any（未标注） | `''` |
| `displayStyle` | String | `'switch'` |
| `activeValue` | any（未标注） | `'true'` |
| `inactiveValue` | any（未标注） | `'false'` |
| `disabled` | Boolean | `false` |
| `readonly` | Boolean | `false` |

### Emits：`update:modelValue`

### 可调用方法（ref）：`get()`, `set()`

## pm-textarea

多行文本框组件

- 平台：pc / mobile
- 源码：`src/components/pm-textarea/pc.vue`，示例：`src/components/pm-textarea/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | [String | `null` |
| `isInChildren` | Boolean | `false` |

### Emits：`update:modelValue`

### 可调用方法（ref）：`get()`, `set()`

## pm-upload

文件上传组件

- 平台：pc / mobile
- 源码：`src/components/pm-upload/pc.vue`，示例：`src/components/pm-upload/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `settings` | any（未标注） | `工厂函数` |
| `fileStyle` | any（未标注） | `""` |
| `listStyle` | any（未标注） | `""` |
| `headers` | Object | `工厂函数` |
| `uploadType` | String | `'button'` |
| `listType` | String | `''` |
| `mode` | any（未标注） | `"edit"` |
| `showAcceptText` | any（未标注） | `true` |
| `showPreview` | any（未标注） | `true` |
| `accept` | any（未标注） | — |
| `fileSize` | any（未标注） | — |
| `sizeUnit` | any（未标注） | — |
| `modelValue` | any（未标注） | — |
| `readonly` | any（未标注） | `false` |
| `disabled` | any（未标注） | `false` |
| `isLimitImgWidthHeight` | any（未标注） | `false` |
| `limitImgWidth` | any（未标注） | `''` |
| `limitImgHeight` | any（未标注） | `''` |
| `buttonConfig` | Object | `工厂函数` |
| `fileUrl` | Function | `(id) => `/api/lowcode/models/a…` |
| `entityModel` | any（未标注） | `null` |
| `multiple` | Boolean | `false` |
| `isInChildren` | Boolean | `false` |
| `allowDownload` | Boolean | `true` |
| `columns` | Array | `工厂函数` |
| `insideApprovalOpinion` | Boolean | `false` |
| `filePath` | any（未标注） | `""` |
| `isOss` | Boolean | `false` |
| `fit` | any（未标注） | `""` |
| `imgWidth` | [Number | `80` |
| `imgHeight` | [Number | `80` |
| `showFileName` | Boolean | `true` |
| `optionTemplateIsEnable` | Boolean | `false` |
| `isViewVertical` | Boolean | `false` |
| `previewType` | any（未标注） | `""` |
| `previewServerUrl` | any（未标注） | `""` |
| `isTextWrap` | Boolean | `false` |
| `uploadBizType` | any（未标注） | `""` |

### 可调用方法（ref）：`isCredentialsExpired()`

