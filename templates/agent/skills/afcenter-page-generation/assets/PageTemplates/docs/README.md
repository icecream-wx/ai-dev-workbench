# 页面模板使用与偏好设置

模板、样式、偏好与平台能力的关系见 [页面模板与样式架构图](architecture.md)。

本文件为 PageTemplates 的统一接入入口，以当前 Vue 3 源码为准。模板管理布局，区块管理交互结构，业务页负责接口、权限、数据及保存流程。

## 1. 模板与示例入口

统一导入：`@/components/PageTemplates/index.js`。

| 导出 | 用途 | 示例或接入方式 |
| --- | --- | --- |
| BusinessListPage | 查询、操作、表格、分页的列表页壳 | examples/ListExample.vue |
| TreeListPage | PmSecondaryMenu 左树右表，右侧复用 BusinessListPage | examples/TreeListExample.vue |
| TreePanel | 搜索、偏好布局及新增入口外壳，树代码由页面生成 | examples/TreeListExample.vue |
| StandardFormPage | 独立表单页壳及底部操作 | examples/FormExample.vue |
| FormSection | 表单分组及单双列栅格 | examples/FormExample.vue |
| QueryPanel | 独立查询卡片 | examples/ListExample.vue |
| RowActions | 表格行操作 | examples/ListExample.vue |
| ThreePartPagination | 左总数、中页码、右容量的分页 | examples/ListExample.vue |
| resolvePagePreferences | 有效偏好到组件属性的白名单转换 | utils.js |

## 微前端本地接入与分发

模板随 Codex 的 afcenter-page-generation 技能 assets/PageTemplates 分发；pm-components-usage 与其同级提供，通过相对路径查组件资料。接收方不需要基座源码仓库。首次生成时通过技能 scripts/install-templates.cjs 安装到目标项目 src/components/PageTemplates，重复安装复用相同内容，遇到本地差异先检查，不自动覆盖。

基座不再全局安装模板，也不通过 base/components 导出模板。子项目页面从自身 `@/components/PageTemplates/index.js` 局部导入，并加载 style.css 与 appearance.css；或在自己的 Vue 实例调用本地 installPageTemplates，其包含这两份样式。公共 PmSecondaryMenu、PmSearch、PmToolbar、PmToolbarItem、pm-form-dialog、Pagination 和 v-auto-height 已验证可直接使用，不重复注册、不导入基座私有路径。主题和图标沿用目标工程。

每个子项目只有一份总的响应式 GlobalPreference，优先复用已有 store/模块。缺失时创建 src/preferences/GlobalPreference.js，导出 reactive({}) 单例；项目初始化负责将已合并展开的有效偏好写入该来源。所有业务页面统一导入，不各自复制配置或发起偏好加载。空对象使用解析器默认值，不代表已完成后台接入。

```js
import { computed } from 'vue'
import { GlobalPreference } from '@/preferences/GlobalPreference.js'
import { resolvePagePreferences } from '@/components/PageTemplates/index.js'

const bindings = computed(() => resolvePagePreferences(GlobalPreference))
```

examples 中的数据及 Playground 的偏好开关只用于演示，刷新后丢失，不作为业务页的项目级偏好来源。菜单与路由按子项目实际机制接入，基座开发演示入口不是子项目的必装资源。

## 2. 完整偏好配置与绑定

输入必须是完成平台与应用合并、已经展开的有效 GlobalPreference。后台树形配置、followPlatformSetting 合并、保存及跨应用同步由平台现有流程负责。

```js
// 以下配置在项目级 GlobalPreference 模块中维护一次，业务页统一导入。
const GlobalPreference = reactive({
  common: { density: 'comfortable' },
  blocks: {
    actionBar: { align: 'start' },
    queryPanel: { mode: 'inline', defaultExpanded: true },
    rowActions: { mode: 'text' },
    treePanel: { actionStyle: 'header', selectionStyle: 'platform' }
  },
  templates: {
    list: { actionsAlign: null, paginationAlign: 'end', paginationLayout: 'bar' },
    form: {
      actionsAlign: null, columns: 1, stickyFooter: true,
      labelPosition: 'top', viewDisplay: 'component'
    }
  },
  tableConfig: { stripe: false, border: false, pageSizes: [10, 20, 30, 50, 100] },
  text: { showWordLimit: false },
  textarea: { showWordLimit: false }
})
const bindings = computed(() => resolvePagePreferences(GlobalPreference))
```

| 输入路径 | 有效值与默认值 | 输出及消费者 |
| --- | --- | --- |
| common.density | comfortable（默认）、compact | list/formPage.density、table/form.size |
| blocks.actionBar.align | start（默认）、end | 列表和表单操作对齐后备值 |
| blocks.queryPanel.mode | inline（默认）、card | queryPanel.mode，由业务选择 PmSearch 或 QueryPanel |
| blocks.queryPanel.defaultExpanded | true（默认）、false | queryPanel.defaultExpanded，仅初始化查询卡片展开态 |
| blocks.rowActions.mode | text（默认）、icon、more | rowActions.mode，绑定 RowActions |
| blocks.treePanel.actionStyle | header、footer（默认） | treePanel.actionStyle，单层树新增入口布局 |
| blocks.treePanel.selectionStyle | platform（默认）、dot | treePanel.selectionStyle，树选中样式 |
| templates.list.actionsAlign | start、end；缺失/null 跟随 actionBar | list.actionsAlign |
| templates.list.paginationAlign | start、end（默认） | list.paginationAlign |
| templates.list.paginationLayout | bar（默认）、split、three-part | list.paginationLayout；由业务选择分页组件 |
| templates.form.actionsAlign | start、end；缺失/null 跟随 actionBar | formPage.actionsAlign |
| templates.form.columns | 数字 1（默认）、2 | formPage.columns，绑定表单页及分组 |
| templates.form.stickyFooter | true（默认）、false | formPage.stickyFooter |
| templates.form.labelPosition | top（默认）、left、right | form.labelPosition；缺失时先回退 formConf.labelPosition |
| templates.form.viewDisplay | component（默认）、text | view.display；业务表单切换禁用组件或纯文本 |
| tableConfig.stripe | false（默认）、true | table.stripe |
| tableConfig.border | false（默认）、true | table.border |
| tableConfig.pageSizes | 正整数数组或 JSON 字符串 | pagination.pageSizes；去重，无效回退 [10,20,30,50,100] |
| text.showWordLimit | false（默认）、true | text.showWordLimit，单行输入 |
| textarea.showWordLimit | false（默认）、true | textarea.showWordLimit，多行输入 |

`form.labelWidth` 当前固定 120px；compact 输出原生 table/form 的 small 尺寸。支持 size 的 pm- 字段组件默认显式设置 size="default"，避免库组件自己的尺寸默认值。
只转换上述白名单。resizable、align、rowHeight、virtualScroll、isNewTabWhenView 等不直接透传到 el-table。

继承顺序：有效偏好 → 响应式 bindings → 页面显式属性覆盖。先 v-bind，再写覆盖项，不复制整套默认值。切换偏好不使用 key 重建组件，不清空业务状态。
TreeListPage 只在内部消费 list 偏好；TreePanel 须单独传 preference 或绑定 bindings.treePanel；表格、查询、分页、行操作和表单也须分别绑定。给父模板传 preference 不会自动配置所有插槽子组件。

## 3. 总体风格与偏好的区别

`appearance` 是页面外观属性，目前不是 GlobalPreference 字段。TreeListPage 支持 platform（默认）、blue（清爽蓝白）、editorial（深色侧栏/荧光绿）。样式位于 `appearance.css`，统一控制分栏、树、表格、工具栏和分页。

```vue
<TreeListPage appearance="blue" :preference="GlobalPreference">
  <template #tree>
    <TreePanel :preference="GlobalPreference" structure="flat">
      <!-- 在这里直接生成 el-tree 与节点操作代码，见树区块章节 -->
    </TreePanel>
  </template>
  <el-table v-bind="bindings.table" v-auto-height :data="rows" />
</TreeListPage>
```

纯列表页没有 appearance 属性，需要导入 CSS 并使用共同祖先容器：

```vue
<script setup>
import '@/components/PageTemplates/appearance.css'
</script>
<template>
  <div class="pt-appearance" data-appearance="blue">
    <BusinessListPage v-bind="bindings.list">
      <el-table v-bind="bindings.table" v-auto-height :data="rows" />
    </BusinessListPage>
  </div>
</template>
```

此为组合片段，bindings、rows 及组件须由业务页导入和定义。表单弹窗、传送到 body 的下拉菜单沿用平台主题。

| 风格 | 树行高 | 表头/数据行高 | 分栏 |
| --- | --- | --- | --- |
| platform | 平台默认 | 平台默认 | 平台 PmSecondaryMenu |
| blue | 42px | 43px / 54px | 浅色侧栏、连续面板、圆角阴影 |
| editorial | 48px | 46px / 61px | 深色侧栏、18px 间隔、小圆角 |

compact 下表头和数据行统一 32px；树行高不随此偏好改变。平台/总体风格与树 selectionStyle 是独立配置。

常用 CSS 变量：

| 区域 | 可覆盖变量 |
| --- | --- |
| 分栏 | --pt-canvas、--pt-workspace-gap、--pt-sidebar-padding、--pt-content-padding、--pt-workspace-radius、--pt-shadow |
| 树 | --pt-sidebar-bg、--pt-sidebar-heading、--pt-sidebar-text、--pt-sidebar-hover、--pt-sidebar-selected、--pt-sidebar-active、--pt-sidebar-accent、--pt-tree-height |
| 搜索 | --pt-search-bg、--pt-search-border、--pt-search-placeholder |
| 表格 | --pt-head-bg、--pt-row-line、--pt-row-hover、--pt-table-head-height、--pt-table-row-height、--pt-footer-height |
| 通用 | --pt-accent、--pt-accent-text、--pt-text、--pt-muted、--pt-line、--pt-radius、--pt-control-radius |
| 圆点外圈 | --pt-tree-dot-halo（默认 rgba(65,105,238,.12)） |

在页面自有 class 中覆盖变量，不改全局 body。左栏宽度仍使用 leftWidth，不能用 CSS 强制覆盖拖动结果。

## 4. 左树右表 TreeListPage

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| preference | {} | 有效偏好，内部解析 list |
| appearance | platform | platform / blue / editorial |
| showTitle | false | 默认隐藏右侧 title 和 header 插槽；显式 show-title 开启 |
| leftWidth | 250 | 数字或字符串；editorial 可按需求设 285 |
| allowResize | true | 平台分栏拖动 |

tree 插槽为左栏，query 插槽放右侧独立查询卡片。其余属性、事件和插槽转给 BusinessListPage，显式列表属性优先于偏好。640px 以下改上下布局。
分组切换、接口请求、分页归一和选择清理由业务实现；示例切组保留查询条件、回第一页并清空勾选。真实异步请求还须处理快速切组竞态。

## 5. 树区块 TreePanel：布局外壳，页面直接生成 el-tree

TreePanel 只提供标题、新增入口、搜索、滚动容器和偏好样式，不封装 el-tree 或节点操作。
生成页面必须在默认插槽直接输出 el-tree、节点模板、MoreFilled 菜单和业务逻辑；以 examples/TreeListExample.vue 为完整参考。

```vue
<TreePanel :preference="GlobalPreference" structure="flat" title="分组导航"
  @search="filterTree" @create="openCreate">
  <template #default>
    <el-tree ref="treeRef" :data="groups" node-key="id" :props="{ label: 'name' }"
      :filter-node-method="filterNode" highlight-current :expand-on-click-node="false"
      @node-click="selectGroup">
      <template #default="{ node, data }">
        <div class="pt-tree-panel-node custom-tree-node">
          <span v-if="bindings.treePanel.selectionStyle === 'dot'" class="pt-tree-panel-dot" />
          <svg-icon v-else class="pt-tree-panel-icon svgicon" icon-class="group" />
          <span class="pt-tree-panel-label">{{ node.label }}</span>
          <!-- 在页面生成节点数量、MoreFilled 菜单及权限控制 -->
        </div>
      </template>
    </el-tree>
  </template>
</TreePanel>
```

| 外壳属性 | 默认值 | 说明 |
| --- | --- | --- |
| preference | {} | 消费 blocks.treePanel |
| actionStyle | 空，跟随偏好 | header / footer |
| selectionStyle | 空，跟随偏好 | platform / dot |
| structure | flat | 显式 flat / tree，不再根据业务数据自动推断 |
| title | 分组导航 | 单层 header 模式标题 |
| searchable | true | 显示搜索框 |
| searchPlaceholder | 搜索分组 | 搜索提示 |
| showCreate | true | 显示单层新增入口 |
| createText | 新建分组 | 按钮文案或图标提示 |
| createDisabled | false | 禁用单层新增 |

默认插槽提供 keyword、selectionStyle、isFlat；el-tree 节点内应直接读取页面响应式 bindings.treePanel.selectionStyle，不捕获外层插槽的 selectionStyle 值，确保已有节点同步更新；create() 通知单层新增，search(keyword) 通知搜索；footer 插槽仅在 flat/footer 渲染。
页面持有 treeRef、data、props、node-key、lazy/load、current-node-key、filter-node-method、node-click，不再传给 TreePanel。
页面监听 search 后调用 treeRef.filter 或请求远程数据；数据变化后如需保留过滤结果，由页面重应用过滤。
节点菜单、悬停菜单状态、权限、禁用、同级/子级新增及表单提交均在页面直接生成。
多层 structure="tree" 不显示单层新增入口；页面菜单提供“新增节点”和“新增子节点”，计算父节点后打开 pm-form-dialog。空树首个根节点由页面工具栏处理。

共享样式通过 pt-tree-panel-node、pt-tree-panel-icon、pt-tree-panel-label、pt-tree-panel-count、pt-tree-panel-more、pt-tree-panel-trigger、pt-tree-panel-dot 类应用于插槽内容。菜单打开时页面给 pt-tree-panel-more 加 is-open。
所有模板（模板1、模板2、模板3及未指定预设的页面）的树节点菜单统一使用 MoreFilled 横向省略号图标，禁止常驻“更多”文字按钮。默认隐藏省略号入口，鼠标移入当前节点行后显示；点击入口打开菜单，菜单打开期间保持入口可见。复用 examples/TreeListExample.vue：el-dropdown 使用 pt-tree-panel-more，按钮使用 pt-tree-panel-trigger，内容为 el-icon + MoreFilled；通过 visible-change 维护当前打开节点并绑定 is-open，按钮 @click.stop/@keydown.stop 避免误选节点。键盘聚焦时可见，触屏保留入口；节点菜单规则独立于表格 RowActions 模式。
platform 选中样式保留图标和平台高亮；dot 样式由插槽选择圆点标记，共享 CSS 控制圆角背景、外圈及隐藏左侧高亮条。
平台单层 header 隐藏树顶边框，footer 保留；blue 始终隐藏树顶边框及底部新增区分隔线。搜索左右内边距仍为8px。
修改迁移：旧 data/treeProps/nodeKey/nodeIcon/countKey/actions、node 插槽、action 事件和暴露的 treeRef 已移到业务页；调用方需改成默认插槽方式。

## 6. 列表、查询、行操作和分页

BusinessListPage 属性：title 默认空、entityName 默认“记录”、showCreate/showBatchDelete 默认 true、createDisabled 默认 false、selectionCount 默认 0、deleting 默认 false。外观属性见偏好表。
插槽：header、summary、filters、selection、actions、tools、default、pagination。事件：create、batch-delete、clear-selection。权限及忙碌状态由业务传入。

所有模板生成的 `el-table` 默认都必须添加 `v-auto-height`，自动撑满所在区域的剩余高度；不要遗漏指令，也不要用固定 height、max-height 或额外滚动包装抵消自动高度。只有用户明确要求其他高度布局时才覆盖此默认规则。

默认内容直接放 el-table v-auto-height；分页放 pagination 插槽，模板已包 al-footer。不增加固定高度或额外滚动包装抵消自动高度。表格属性绑定 bindings.table；编辑入口放首个业务列的 el-link，行操作使用 RowActions。
居左沿用平台 top-block / el-row / 16:8；居右为标题、搜索、辅助操作与新增同一行。actions 插槽替换整组默认工具栏，参数 iconOnly、selectionCount、batchActive；业务自行实现图标提示与禁用态。

查询由业务按 bindings.queryPanel.mode 选择：

- inline：filters 插槽放平台 PmSearch，绑定 v-model:query、default-prop、body 插槽及 search。
- card：QueryPanel 放列表上方或 TreeListPage 的 query 插槽；内部已有 el-form，默认插槽直接放 el-form-item。
- QueryPanel 的 model 必传；title 默认“查询条件”，defaultExpanded 默认 true，loading 默认 false。事件 search、reset、toggle；actions 插槽替换按钮。
- 卡片折叠保留输入、不自动查询；defaultExpanded 只初始化一次。toggle 后可更新表格 data-query-expanded，触发既有自动高度重算，不重建表格。

RowActions 绑定 bindings.rowActions，传 actions、row，监听 action(key,row)。text 为文字，icon 为图标提示，more 为前两项文字、其余下拉。项支持 key、label、icon、visible、disabled，先过滤隐藏项再计数。业务须再次检查权限和忙碌状态。

| 分页布局 | 组件 | 勾选数量与批量操作 |
| --- | --- | --- |
| bar | 平台 Pagination | 传 selections，底部显示已选数量；顶部工具栏不切换 |
| split | 平台 Pagination | 总数靠左、分页靠右；顶部切批量态，分页传空 selections |
| three-part | ThreePartPagination | 左总数、中页码、右容量；同样启用顶部批量态 |

split 和 three-part 勾选后隐藏默认新增，显示已选数量、取消选择和批量删除；居右时替换标题区域。clear-selection 由业务清空表格勾选。自定义 actions 须自行消费 batchActive。
ThreePartPagination 属性 total/currentPage/pageSize/pageSizes/disabled；事件 update:currentPage、update:pageSize、current-change、size-change。容量变化回第一页；业务选事件或 watcher 一种请求路径，避免重复请求。three-part 不消费 paginationAlign。

## 7. 表单与弹窗

StandardFormPage 属性 title、density、actionsAlign、columns（1/2，默认1）、stickyFooter（默认true）。插槽 header、feedback、default（参数columns）、actions。
FormSection 属性 title、description、columns；默认插槽放 el-form-item。外层只使用一个 el-form，绑定 bindings.form。

- 单实体新增编辑和树节点新增编辑使用 pm-form-dialog；submit 显式连接表单校验提交，不依赖旧 mixin 自动寻找表单。
- 字段超过8个时双列；其余跟随列数偏好。多行描述使用 pt-field-full 跨整行。
- 单列弹窗宽度 min(520px, calc(100vw - 32px))，双列 min(800px, calc(100vw - 32px))，与实际列数同步。640px 以下栅格降单列。
- 单行绑定 bindings.text，多行绑定 bindings.textarea；输入统计需字段本身设置适当 maxlength。
- 查看 component 为禁用组件，text 为纯文本。由业务表单消费 bindings.view.display，不直接传给 el-form。
- pm- 字段可能须显式 disabled；不要假定全部继承 el-form 禁用上下文。
- 弹窗内 pt-page 自动移除自身 padding，不额外设置 body-class="p-0"；表单栅格已有 pm-textarea 根 span 的撑满规则。
- 回显使用副本，保存期间锁定提交和关闭；失败保留输入，成功才关闭刷新。FormExample 的 save(record) 成功返回记录，失败 reject Error。

## 8. 生成页面时的描述与核对

推荐描述：

> 使用 afcenter-page-generation，生成左树右表页面。总体样式 blue，右侧复用 BusinessListPage 且默认隐藏标题；左侧 TreePanel 使用 flat，树操作偏好 header、选中偏好 dot。新增和编辑使用 pm-form-dialog；查询、分页、行操作及表单继承有效 GlobalPreference。业务字段和接口如下……

生成前检查总体风格和偏好分别绑定；页面创建不等于已创建后台资源或菜单，不虚构接口、权限码或字典码。真实 API 按工程成功/失败契约处理。

验收清单：

- 总体 platform/blue/editorial 与树 header/footer、platform/dot 组合；树边框及高亮条不叠加。
- 单层/多层/空树/懒加载，新增同级与子级父节点正确，菜单隐藏与禁用有效。
- 搜索、偏好或风格切换保留输入和选择，长节点省略且更多图标可操作。
- 查询/重置/容量变化回第一页，切组和翻页清空选择，删除末页回退，空列表可见。
- bar/split/three-part、左右操作对齐及批量态，无重复数量或重复请求。
- 表单校验、编辑副本、取消、失败保留输入、保存锁及查看态两种模式。
- 窄屏分栏、查询折叠、双列表单、分页及自动高度不遮挡内容。

局部检查：`node src/components/PageTemplates/verify.cjs`。覆盖偏好、响应式、模板编译、SSR 插槽及目录路径；不等同于浏览器视觉和真实接口验收。分发前需在实际子项目完成公共组件、样式和交互验收。

## 查询卡片布局：标签在上、顶部操作

新增 `QueryPanel layout="header"`：字段 label 在上方，标题、重置、搜索及折叠图标同一行。重置和搜索在折叠时仍可操作；查询输入保留，按钮沿用 loading 状态。默认 `layout="grid"` 保持原有布局。可在项目总 GlobalPreference 的 `blocks.queryPanel` 设置 `mode: 'card'`、`layout: 'header'`，页面继续通过 `v-bind="bindings.queryPanel"` 继承。单页明确要求时显式 layout 覆盖。actions 插槽在顶部布局中位于标题行，无需自行创建按钮区。

```vue
<QueryPanel v-bind="bindings.queryPanel" layout="header" :model="query"
  :loading="loading" @search="handleSearch" @reset="handleReset">
  <el-form-item label="名称" prop="name">
    <el-input v-model="query.name" clearable />
  </el-form-item>
</QueryPanel>
```

## 独立表格样式：pt-table-white

从“列表1/code.html”的表格提取，转换为 Element Plus 样式，不依赖 Tailwind。白色表头、12px 常规字重、浅灰横线、表头上下 12px / 数据单元格上下 14px 内边距、浅色悬停、蓝色链接交互及 14px 复选框。多行业务内容、头像、标签、日期对齐及列宽仍由列插槽和列属性定义，不通过 CSS 推断业务。

```vue
<script setup>
import '@/components/PageTemplates/table-white.css'
</script>
<template>
  <el-table class="pt-table-white" v-bind="bindings.table" v-auto-height :data="rows">
    <el-table-column prop="name" label="名称" />
  </el-table>
</template>
```

此片段的 rows、bindings 由业务页定义。此 CSS 按需安装，页面必须显式导入。只在用户选择此表格风格时添加 class，不自动替换所有现有表格。保留 stripe、border、列对齐和选择行为；small 尺寸收紧至 8px 上下内边距。独立使用可还原原型表格基础样式；与 appearance.css 叠加时已有外观规则可能影响行高和背景，需按实际页面验证。样式不包含外层卡片、工具栏和分页。
<!-- Modified by AI on 2026-11-12 14:10:03 -->


## 按页面选择安装样式

默认安装只包含模板结构所需 style.css，不复制 examples、docs 或可选风格 CSS。白色表格使用 `--style=white` 安装 table-white.css；blue/editorial 页面使用 `--style=appearance` 安装 appearance.css，可同时指定。示例：`node <本技能目录>/scripts/install-templates.cjs <目标项目> --style=white`。页面显式导入选中的 CSS，并在 el-table 上添加 `class="pt-table-white"`。install.js 和 TreeListPage 不自动导入可选样式。生成页面未选择某种外观时，不复制或导入其 CSS；已有项目中已安装的样式不自动删除。样式被其他页面使用时继续共享。
<!-- Modified by AI on 2026-11-12 14:10:03 -->

## 列表2表格样式：pt-table-blue

从“列表2/code.html”提取为独立 Element Plus 表格皮肤：浅蓝 #eff4ff 表头、40px 表头高度、11px/600 表头字、13px/18px 内容字、12px 单元格间距、无横向分隔线，悬停浅蓝。Inter 字体有安装时使用，否则回退系统字体，无需网络字体或 Tailwind。

按需安装：`node <本技能目录>/scripts/install-templates.cjs <目标项目> --style=blue`。页面导入 `@/components/PageTemplates/table-blue.css`，使用 `<el-table class="pt-table-blue" v-auto-height :data="rows">`。不由 install.js 默认导入，也不默认安装。

原型个别数据行有不同背景，按业务需要通过 row-class-name 返回 pt-table-blue-row-strong、pt-table-blue-row-soft 或 pt-table-blue-row-muted；不根据行号伪造业务状态。头像、状态标签、动作、列对齐及行内容仍由业务插槽定义。该皮肤适配原型无边框表格，使用时不要开启 border；斑马纹和其他 appearance 叠加需单独验证。该样式不是预设2整体 appearance，不附带导航、查询卡片或分页。
<!-- Modified by AI on 2026-11-12 14:12:25 -->

## 列表2工具栏：pt-toolbar-blue

独立提取顶部操作按钮：浅蓝辅助按钮、深蓝主按钮、8px 圆角、12px/500 字重、8px 按钮间距及轻阴影。样式适配公共 PmToolbar / PmToolbarItem 渲染的 Element Plus 按钮；权限、禁用、loading 和动作仍由业务控制。主按钮需显式 type="primary"。text/link 按钮保留轻量图标形态。不包含表格行操作、查询区及分页按钮。

按需安装 `--style=toolbar-blue`，页面导入 `@/components/PageTemplates/toolbar-blue.css`，使用：

```vue
<PmToolbar class="pt-toolbar-blue">
  <PmToolbarItem @click="handleImport">导入</PmToolbarItem>
  <PmToolbarItem type="primary" @click="handleCreate">新增</PmToolbarItem>
</PmToolbar>
```

也可将 class 加到自定义操作区的共同父容器，内部使用 el-button。表格样式与工具栏分别选择；需要两者时同时传 --style=blue --style=toolbar-blue，不默认安装任何可选风格。与已有平台强制样式叠加时按目标项目验证。

## 表单分段分割组件 FormSectionDivider

提取自表单1的两处分段标题，独立于字段栅格，放在 el-form 内的各段字段之前。number 可选，字符串保留前导零；tone=primary（蓝）/secondary（青），description 为右侧辅助说明，extra 插槽放业务操作。不内置联系人添加逻辑。组件不包裹 el-form、不提交表单；操作按钮建议 native-type="button"。

```vue
<FormSectionDivider number="01" title="企业基本信息" description="已接入实时核验" />
<!-- 在此放该段表单字段或 FormSection（不再重复传 title） -->
<FormSectionDivider number="02" title="核心决策人与首要联系人" tone="secondary">
  <template #extra>
    <el-button text type="primary" native-type="button" @click="addContact">+ 添加第二联系人</el-button>
  </template>
</FormSectionDivider>
```

从本地 PageTemplates/index.js 导入 FormSectionDivider，组件自带 scoped 样式，不依赖 Tailwind 或在线字体。仅使用默认 import 安装模板时按现有局部导入方式使用，不依赖全局注册。

## 卡片式表单区块 FormSectionCard

参考表单2：白色卡片、14px 圆角、浅色边框和轻阴影。属性 title、description、columns（1/2，默认1）；icon 插槽放标题图标，extra 插槽放右侧操作。默认插槽直接放 el-form-item，整行字段使用 pt-field-full。内部复用 FormSection，不创建 el-form；同一业务表单外层仅创建一个 el-form，统一校验、提交。标签位置由外层表单决定，不强制修改控件尺寸和样式。窄屏双列自动退化单列。

```vue
<el-form :model="form" :rules="rules" label-position="top">
  <FormSectionCard title="企业基础信息" :columns="2">
    <el-form-item label="客户全称" prop="name" class="pt-field-full">
      <pm-input v-model="form.name" size="default" />
    </el-form-item>
  </FormSectionCard>
  <FormSectionCard title="主要联系人" description="用于日常对接与回访" :columns="2">
    <!-- 联系人字段 -->
  </FormSectionCard>
</el-form>
```

从本地 PageTemplates/index.js 局部导入 FormSectionCard。组件自带 scoped 卡片样式并复用结构 CSS，无需单独选择表格或工具栏皮肤。生成请求可指定“使用 FormSectionCard，按指定分段组织字段”；组件不添加业务按钮和字段，也不重复显示内部 FormSection 标题。
<!-- Modified by AI on 2026-11-13 10:16:58 -->
