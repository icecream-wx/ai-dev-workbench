# 反馈浮层类组件 API 速查

> 由脚本从源码静态提取；「可调用方法」可能混入 computed/内部方法，调用前请在源码确认是否对外 expose。若有出入以 `src/components/<name>/pc.vue` 与同目录 `demo.vue` 为准。

## pm-clip-button

复制按钮组件，点击可快速复制指定文本内容到剪贴板

- 平台：pc
- 源码：`src/components/pm-clip-button/pc.vue`，示例：`src/components/pm-clip-button/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `data` | String | `''` |
| `showMessage` | Boolean | `true` |

## pm-context-menu

右键菜单组件，在目标区域右键弹出上下文菜单，支持多级菜单嵌套

- 平台：pc
- 源码：`src/components/pm-context-menu/pc.vue`，示例：`src/components/pm-context-menu/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `eventType` | String | `'contextmenu'` |
| `theme` | String | `'default'` |
| `autoPlacement` | Boolean | `true` |

### Emits：`show`, `hide`, `contextmenu`

## pm-context-menu-group

右键菜单分组组件，用于对右键菜单项进行逻辑分组

- 平台：pc
- 源码：`src/components/pm-context-menu-group/pc.vue`，示例：`src/components/pm-context-menu-group/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `maxWidth` | [Number | `null` |

## pm-context-menu-item

右键菜单项组件，定义单个菜单项，支持点击事件和禁用状态

- 平台：pc
- 源码：`src/components/pm-context-menu-item/pc.vue`，示例：`src/components/pm-context-menu-item/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `autoHide` | Boolean | `true` |

### Emits：`click`, `mouseenter`, `mouseleave`

## pm-context-menu-submenu

右键菜单子菜单组件，实现多级嵌套的右键菜单层级

- 平台：pc
- 源码：`src/components/pm-context-menu-submenu/pc.vue`，示例：`src/components/pm-context-menu-submenu/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `title` | String | `''` |

### Slots：`title`

## pm-dialog

弹窗组件，增强的 el-dialog，支持全屏切换、拖拽、最大化等高级功能

- 平台：pc
- 源码：`src/components/pm-dialog/pc.vue`，示例：`src/components/pm-dialog/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `modelValue` | Boolean | `false` |
| `visible` | Boolean | `undefined` |
| `title` | String | `''` |
| `appendToBody` | Boolean | `true` |
| `closeOnClickModal` | Boolean | `false` |
| `draggable` | Boolean | `true` |
| `fullscreen` | [Boolean | `false` |
| `footerHeight` | Number | `60` |
| `showFooter` | Boolean | `true` |
| `showFullScreenButton` | Boolean | `true` |
| `showClose` | Boolean | `true` |
| `beforeClose` | Function | `undefined` |
| `dirty` | Boolean | `false` |
| `trapFocus` | Boolean | `true` |
| `testId` | String | `''` |

### Emits：`update:modelValue`, `update:visible`, `update:fullscreen`, `confirm-close`

### Slots：`title`, `icon`, `footer`

### 可调用方法（ref）：`bodyStyle()`, `footerStyle()`, `fullscreen()`, `show()`, `hidden()`, `switchFullscreen()`

## pm-drop-menu

下拉菜单组件，基于 el-dropdown 封装的下拉操作菜单

- 平台：pc
- 源码：`src/components/pm-drop-menu/pc.vue`，示例：`src/components/pm-drop-menu/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `data` | Object | `工厂函数` |
| `label` | String | `''` |
| `icon` | String | `''` |
| `allow` | Boolean | `true` |
| `size` | String | `'small'` |

### Emits：`click`

### Slots：`icon`

## pm-drop-menu-item

下拉菜单项组件，定义下拉菜单中的单个操作项

- 平台：pc
- 源码：`src/components/pm-drop-menu-item/pc.vue`，示例：`src/components/pm-drop-menu-item/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `data` | Object | `工厂函数` |
| `label` | String | `''` |
| `icon` | String | `''` |
| `disabled` | Boolean | `false` |

### Emits：`click`

## pm-expand-card

可展开卡片组件，点击可展开/收起更多内容，支持自定义标题和展开区域

- 平台：pc
- 源码：`src/components/pm-expand-card/pc.vue`，示例：`src/components/pm-expand-card/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `minHeight` | Number | `35` |

## pm-floating-pane

浮动面板组件，在页面上自由拖拽的浮动面板，支持定位和拖拽范围限制

- 平台：pc
- 源码：`src/components/pm-floating-pane/pc.vue`，示例：`src/components/pm-floating-pane/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `isMax` | Boolean | `false` |
| `maxHeight` | String | `'400px'` |
| `minHeight` | String | `'40px'` |
| `bgColor` | String | `'#ffffff'` |
| `shadow` | Boolean | `true` |
| `rounded` | Boolean | `true` |

### Slots：`max`, `min`

## pm-fold

折叠面板组件，可折叠/展开内容区域，支持手风琴模式，可自定义标题和图标

- 平台：pc
- 源码：`src/components/pm-fold/pc.vue`，示例：`src/components/pm-fold/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `title` | String | `''` |
| `subTitle` | String | `''` |
| `contrlType` | String | `'arrow'` |
| `arrowPosition` | String | `'right'` |
| `isFold` | Boolean | `true` |
| `bodyBorder` | Boolean | `false` |

### Emits：`update:isFold`

### Slots：`extend`

### 可调用方法（ref）：`open()`, `close()`

## pm-fold-group

折叠面板组组件，管理多个折叠面板，支持手风琴互斥模式

- 平台：pc
- 源码：`src/components/pm-fold-group/pc.vue`，示例：`src/components/pm-fold-group/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `accordion` | Boolean | `false` |

## pm-form-dialog

表单弹窗组件，集成表单的弹窗，支持表单提交、校验和重置

- 平台：pc
- 源码：`src/components/pm-form-dialog/pc.vue`，示例：`src/components/pm-form-dialog/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `dialogVisible` | Boolean | `false` |
| `modelValue` | Boolean | `undefined` |
| `okText` | String | `null` |
| `cancelText` | String | `null` |
| `submitable` | Boolean | `true` |
| `title` | String | `''` |
| `loading` | Boolean | `false` |
| `bodyClass` | String | `null` |
| `formType` | String | `'form'` |
| `showFooter` | Boolean | `true` |
| `inline` | Boolean | `false` |
| `fullscreen` | Boolean | `false` |

### Emits：`update:dialogVisible`, `update:modelValue`, `cancel`

### Slots：`form`

### 可调用方法（ref）：`fullscreen()`, `cancel()`, `getFormSlotComp()`, `findSlotComp()`, `getRootForm()`, `show()`, `hidden()`

## pm-slide-verify

滑块验证码组件，拖动滑块完成拼图验证，用于人机校验

- 平台：pc
- 源码：`src/components/pm-slide-verify/pc.vue`，示例：`src/components/pm-slide-verify/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `type` | String | `'inherent'` |
| `length` | Number | `42` |
| `radius` | Number | `10` |
| `width` | Number | `310` |
| `height` | Number | `155` |
| `sliderText` | String | `'滑动验证'` |
| `imgs` | Array | `工厂函数` |
| `modelValue` | Boolean | `false` |

### Emits：`update:modelValue`, `success`

## pm-sort

排序组件，支持拖拽排序和按钮排序，可自定义排序方向和触发事件

- 平台：pc
- 源码：`src/components/pm-sort/pc.vue`，示例：`src/components/pm-sort/demo.vue`

### Props

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `orderFields` | Array | `工厂函数` |
| `modelValue` | String | `''` |
| `labelField` | String | `'label'` |
| `valueField` | String | `'value'` |
| `directionField` | String | `'direction'` |

### Emits：`update:modelValue`, `refresh`

