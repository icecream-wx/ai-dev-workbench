# 业务组件与布局导航类组件 API 速查

> 由脚本从源码静态提取；「可调用方法」可能混入 computed/内部方法，调用前请在源码确认是否对外 expose。若有出入以 `src/components/<name>/pc.vue` 与同目录 `demo.vue` 为准。

---

# 业务组件

## pm-bind

数据绑定组件，支持对任意子组件进行数据绑定和值映射，提供灵活的绑定配置

- 平台：pc
- 源码：`src/components/pm-bind/pc.vue`，示例：`src/components/pm-bind/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | any（未标注） | `undefined` |
| `value` | any（未标注） | `undefined` |
| `bindModel` | Object | `工厂函数` |
| `bindComponent` | String | `'el-input'` |
| `bindPath` | [String | `''` |
| `onlyNumber` | Boolean | `false` |
| `bindFormat` | Object | `工厂函数` |
| `bindDefaultValue` | String | `''` |
| `removeHook` | Function | `工厂函数` |

### Emits：`update:modelValue`

### 可调用方法（ref）：`val()`, `getValue()`, `setValue()`, `setItem()`

## pm-change

变更记录组件，展示字段变更前后的对比信息，支持多字段对比展示

- 平台：pc
- 源码：`src/components/pm-change/pc.vue`，示例：`src/components/pm-change/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `trigger` | String | `'hover'` |

## pm-download

文件下载组件，支持根据文件 URL 或 ID 触发浏览器下载，支持自定义文件名

- 平台：pc
- 源码：`src/components/pm-download/pc.vue`，示例：`src/components/pm-download/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | String | `null` |
| `value` | any（未标注） | `undefined` |
| `method` | String | `'get'` |

### Emits：`update:modelValue`

## pm-dynamic

动态组件渲染器，根据 schema 配置动态渲染任意组件，支持 formModel 数据传递

- 平台：pc
- 源码：`src/components/pm-dynamic/pc.vue`，示例：`src/components/pm-dynamic/demo.vue`

## pm-ocr

OCR 文字识别组件，上传图片并调用 OCR 接口识别图片中的文字内容

- 平台：pc / mobile
- 源码：`src/components/pm-ocr/pc.vue`，示例：`src/components/pm-ocr/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `ocrSetting` | Object | `工厂函数` |
| `formData` | Object | `工厂函数` |
| `OCRType` | String | `''` |
| `OCRFields` | Array | `工厂函数` |

### 可调用方法（ref）：`isExpress()`, `dispatchProxy()`, `Controllers()`, `type()`, `isFormEdit()`, `fields()`, `showUpload()`, `backSide()`, `rightSide()`, `triggerUpload()`, `dataProcess()`, `transformData()`

## pm-option

选项组件，用于配置下拉选项数据，定义 label-value 映射关系

- 平台：pc
- 源码：`src/components/pm-option/pc.vue`，示例：`src/components/pm-option/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `label` | [String | `''` |
| `value` | any（未标注） | `null` |

## pm-sheet

Excel 表格组件，基于 Luckysheet 的在线 Excel 编辑与展示组件

- 平台：pc
- 源码：`src/components/pm-sheet/pc.vue`，示例：`src/components/pm-sheet/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `value` | Object | `工厂函数` |
| `sheetConfig` | any（未标注） | `工厂函数` |

### 可调用方法（ref）：`isDesigner()`, `importExcel()`, `acceptMessage()`, `getSheetData()`, `getCellValue()`, `setCellValue()`, `setCellValueRich()`, `getCellValueRich()`


---

# 布局导航

## pm-affix

固钉组件，将元素固定在页面指定位置，支持顶部和底部两种固定模式

- 平台：pc
- 源码：`src/components/pm-affix/pc.vue`，示例：`src/components/pm-affix/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `offsetTop` | Number | `0` |
| `offsetBottom` | Number | `0` |
| `useCapture` | Boolean | `false` |

### Emits：`on-change`

## pm-flip

翻转容器组件，正反两面可放置不同内容，通过翻转动作切换展示面

- 平台：pc
- 源码：`src/components/pm-flip/pc.vue`，示例：`src/components/pm-flip/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `trigger` | String | `'hover'` |
| `direction` | String | `'Y'` |
| `width` | String | `'200px'` |
| `height` | String | `'200px'` |

### Slots：`front`, `back`

## pm-hamburger

汉堡菜单按钮组件，三横线菜单切换按钮，常用于侧边栏折叠切换

- 平台：pc
- 源码：`src/components/pm-hamburger/pc.vue`，示例：`src/components/pm-hamburger/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `isActive` | Boolean | `false` |

### Emits：`toggle-click`

## pm-main

主体布局容器组件，作为页面主体内容区域的布局容器

- 平台：pc
- 源码：`src/components/pm-main/pc.vue`，示例：`src/components/pm-main/demo.vue`

## pm-split

分割面板组件，可拖拽调整左右/上下面板的宽度比例

- 平台：pc
- 源码：`src/components/pm-split/pc.vue`，示例：`src/components/pm-split/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | [Number | `0.5` |
| `mode` | any（未标注） | `'horizontal'` |
| `min` | [Number | `0` |
| `max` | [Number | `0.9` |
| `onlyShow` | String | `null` |
| `showLeftFold` | Boolean | `false` |

### Emits：`update:modelValue`, `on-moving`, `on-move-end`, `on-move-start`

### Slots：`left`, `right`, `left`, `trigger`, `right`, `top`, `trigger`, `bottom`

## pm-toolbar

工具栏组件，页面操作工具栏容器，用于组织和排列操作按钮

- 平台：pc
- 源码：`src/components/pm-toolbar/pc.vue`，示例：`src/components/pm-toolbar/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `buttonType` | String | `'default'` |
| `buttons` | Array | `工厂函数` |
| `showCount` | Number | `4` |
| `moreText` | String | `'更多'` |
| `bordered` | Boolean | `true` |

## pm-toolbar-group

工具栏分组组件，对工具栏内的操作按钮进行逻辑分组

- 平台：pc
- 源码：`src/components/pm-toolbar-group/pc.vue`，示例：`src/components/pm-toolbar-group/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `text` | String | `''` |

### Emits：`click`

## pm-toolbar-item

工具栏项组件，定义工具栏中的单个操作按钮项

- 平台：pc
- 源码：`src/components/pm-toolbar-item/pc.vue`，示例：`src/components/pm-toolbar-item/demo.vue`

### Emits：`click`

