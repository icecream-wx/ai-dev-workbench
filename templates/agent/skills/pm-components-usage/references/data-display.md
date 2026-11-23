# 数据展示类组件 API 速查

> 由脚本从源码静态提取；「可调用方法」可能混入 computed/内部方法，调用前请在源码确认是否对外 expose。若有出入以 `src/components/<name>/pc.vue` 与同目录 `demo.vue` 为准。

## pm-calendar

日历组件，展示日期日历，支持日期选择、事件标记和视图切换

- 平台：pc
- 源码：`src/components/pm-calendar/pc.vue`，示例：`src/components/pm-calendar/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `data` | Array | `工厂函数` |
| `options` | Object | `工厂函数` |
| `formProxy` | Object | `工厂函数` |
| `pkField` | String | `工厂函数` |
| `mergeReadonly` | Boolean | `false` |

### 可调用方法（ref）：`startConfig()`, `endConfig()`, `recordConfig()`, `colorConfig()`, `rowConfig()`, `toolConfig()`, `isSameDate()`, `operateCard()`, `addCard()`, `moveCard()`, `resizeCard()`

## pm-card

卡片组件，带标题和内容的卡片容器，支持自定义头部和主体插槽

- 平台：pc / mobile
- 源码：`src/components/pm-card/pc.vue`，示例：`src/components/pm-card/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `cardType` | any（未标注） | `'normal'` |

### Slots：`header`

## pm-divider

分割线组件，带文字和字段映射的分割线，支持纵向和横向布局

- 平台：pc / mobile
- 源码：`src/components/pm-divider/pc.vue`，示例：`src/components/pm-divider/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `contentPosition` | String | `'center'` |
| `direction` | String | `'horizontal'` |
| `titleText` | String | `'分割线'` |
| `divideType` | String | `'line'` |
| `componentProxy` | String | `null` |
| `optionTemplateIsEnable` | Boolean | `false` |
| `foldable` | Boolean | `false` |
| `iconColor` | String | `''` |
| `titleColor` | String | `''` |
| `icon` | String | `''` |

## pm-echarts

ECharts 图表组件，基于 ECharts 封装的图表展示，支持自适应和动态更新

- 平台：pc
- 源码：`src/components/pm-echarts/pc.vue`，示例：`src/components/pm-echarts/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `option` | Object | `工厂函数` |
| `width` | String | `'100%'` |
| `height` | String | `'100%'` |

### 可调用方法（ref）：`drawLine()`

## pm-empty

空状态组件，在无数据时展示空白占位提示，支持自定义文案和图标

- 平台：pc
- 源码：`src/components/pm-empty/pc.vue`，示例：`src/components/pm-empty/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `imageStyle` | Object | `工厂函数` |
| `image` | String | `'https://gw.alipayobjects.com/…` |
| `description` | String | `'暂无数据'` |

### Slots：`description`, `footer`

## pm-html

HTML 渲染组件，将 HTML 字符串渲染为页面内容，支持脚本和样式处理

- 平台：pc / mobile
- 源码：`src/components/pm-html/pc.vue`，示例：`src/components/pm-html/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `html` | any（未标注） | `''` |
| `icon` | any（未标注） | `''` |
| `showIcon` | any（未标注） | `''` |
| `iconSize` | any（未标注） | `''` |
| `iconColor` | any（未标注） | `''` |
| `styleType` | any（未标注） | `''` |

## pm-image

图片组件，支持图片预览、加载失败占位、懒加载和自定义预览列表

- 平台：pc / mobile
- 源码：`src/components/pm-image/pc.vue`，示例：`src/components/pm-image/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | any（未标注） | `''` |
| `fit` | String | `'contain'` |
| `imgWidth` | [Number | `null` |
| `imgHeight` | [Number | `null` |
| `fileSize` | [Number | `2` |
| `imgUrl` | String | `''` |
| `readonly` | Boolean | `false` |
| `disabled` | Boolean | `false` |
| `mode` | any（未标注） | `'edit'` |
| `isInChildren` | Boolean | `false` |
| `datasourceIsUpload` | Boolean | `false` |

## pm-list

列表组件，基于 el-table 封装的数据列表展示，支持列配置、操作按钮和分页

- 平台：pc
- 源码：`src/components/pm-list/pc.vue`，示例：`src/components/pm-list/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `data` | Array | `工厂函数` |
| `minLength` | Number | `0` |
| `addable` | Boolean | `true` |
| `maxLength` | Number | `0` |
| `model` | Object | `工厂函数` |
| `addText` | String | `'添加'` |
| `beforeRemove` | Function | `null` |
| `sortable` | Boolean | `true` |
| `removeConfirm` | Boolean | `false` |
| `removeConfirmText` | String | `'确定要删除吗?'` |
| `addAttrs` | Object | `工厂函数` |
| `createable` | Boolean | `true` |
| `removeStyle` | String | `''` |
| `size` | String | `'small'` |
| `stripe` | Boolean | `true` |
| `cloneable` | Boolean | `true` |

### Emits：`update:data`

### Slots：`button`

## pm-outline

大纲目录组件，根据页面标题层级自动生成文章导航目录结构

- 平台：pc
- 源码：`src/components/pm-outline/pc.vue`，示例：`src/components/pm-outline/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `selectors` | Array | `工厂函数` |
| `catalogueWidth` | any（未标注） | `'200px'` |
| `placement` | any（未标注） | `'left'` |

## pm-pagination

分页组件，基于 el-pagination 封装的分页导航，支持分页查询和切换

- 平台：pc
- 源码：`src/components/pm-pagination/pc.vue`，示例：`src/components/pm-pagination/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `pageSizes` | Array | `工厂函数` |
| `pageSize` | Number | `10` |
| `layout` | String | `'slot` |

## pm-skeleton

骨架屏组件，在页面加载时展示占位骨架，提升用户体验

- 平台：pc
- 源码：`src/components/pm-skeleton/pc.vue`，示例：`src/components/pm-skeleton/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `animated` | Boolean | `false` |
| `count` | Number | `1` |
| `rows` | Number | `3` |
| `loading` | Boolean | `true` |
| `throttle` | Number | `0` |

## pm-skeleton-item

骨架屏项组件，定义单个骨架占位块，支持多种形状和尺寸

- 平台：pc
- 源码：`src/components/pm-skeleton-item/pc.vue`，示例：`src/components/pm-skeleton-item/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `variant` | String | `'text'` |

## pm-steps

步骤条组件，引导用户按步骤完成流程，支持步骤状态和自定义内容

- 平台：pc / mobile
- 源码：`src/components/pm-steps/pc.vue`，示例：`src/components/pm-steps/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | any（未标注） | `null` |
| `mode` | any（未标注） | `'edit'` |
| `readonly` | Boolean | `false` |
| `disabled` | Boolean | `false` |
| `direction` | any（未标注） | `'horizontal'` |
| `isAlignCenter` | Boolean | `false` |
| `isSimple` | Boolean | `false` |
| `options` | Array | `工厂函数` |
| `finishStatus` | any（未标注） | `undefined` |
| `space` | any（未标注） | `undefined` |
| `spaceSetting` | String | `'default'` |

### Emits：`update:modelValue`, `clickStep`

### 可调用方法（ref）：`get()`, `set()`

## pm-table

表格组件，基于 el-table 封装的数据表格，支持列配置、多选、行点击和操作栏

- 平台：pc
- 源码：`src/components/pm-table/pc.vue`，示例：`src/components/pm-table/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `tableData` | Array | `工厂函数` |
| `columns` | Array | `工厂函数` |
| `checked` | Boolean | `false` |
| `showIndex` | Boolean | `false` |
| `detailKeyWidth` | Number | `100` |
| `editColumns` | Boolean | `false` |
| `autoSelectRow` | Boolean | `true` |

### Emits：`changrows`

### 可调用方法（ref）：`tableData()`, `getSelectRows()`, `rerender()`, `getType()`, `changeColumns()`, `toggleSelection()`, `showDetail()`, `isShowDetailText()`

## pm-tree

树形组件，基于 el-tree 封装的树形数据展示，支持节点选择、展开/折叠和自定义节点

- 平台：pc
- 源码：`src/components/pm-tree/pc.vue`，示例：`src/components/pm-tree/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `line` | Boolean | `false` |
| `highlight` | Boolean | `true` |
| `multiple` | Boolean | `false` |
| `load` | Function | `null` |
| `size` | String | `'normal'` |
| `modelValue` | Object | `null` |
| `editable` | Boolean | `true` |
| `searchable` | Boolean | `true` |
| `removable` | Boolean | `true` |
| `lazy` | Boolean | `false` |
| `contextMenuEnable` | Boolean | `true` |
| `defaultExpandedKeys` | Array | `工厂函数` |
| `props` | Object | `工厂函数` |
| `data` | Array | `工厂函数` |
| `disabledKeys` | Array | `工厂函数` |

### Emits：`update:modelValue`, `node-click`, `edit`, `remove`, `add`

### Slots：`row`

