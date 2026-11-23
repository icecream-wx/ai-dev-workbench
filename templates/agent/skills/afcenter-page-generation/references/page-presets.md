# 页面生成预设

用户说“模板1/模版1/平台默认模板”选择 preset-1；说“模板2/模版2/清爽蓝白模板”选择 preset-2；说“模板3/模版3/白色表格分段表单”选择 preset-3。读取此文件并按目标工程实际接口生成，不要求用户重复详细偏好。
预设控制布局与外观，不规定业务实体或强制左树右表；根据需求选择纯列表、列表加表单、左树右表或独立表单。
业务需求从当前消息、会话及指定文档提取；仅给模板编号且无业务信息时，先查会话和工程，必要时询问业务对象，不能凭空生成真实接口。

## 优先级与合并

用户本次明确要求 > 预设明确覆盖项 > 应用有效 GlobalPreference > 组件默认值。
预设1仅选 platform 总体外观，其他偏好继承应用；应用缺失时使用模板默认值。
预设2、预设3对各自明确列出的偏好实施页面级覆盖，未列项继续继承。对 blocks.queryPanel/treePanel、templates.list/form 等嵌套对象逐层合并，不浅合并丢失兄弟字段，也不修改共享全局偏好对象。
使用 computed 响应式解析合并结果。不要为应用预设更改公共模板默认值、持久化平台偏好或使用 key 重建业务组件。

## 预设列表

| 项目 | 模板1：平台默认 | 模板2：清爽蓝白 |
| --- | --- | --- |
| 稳定标识 | preset-1 | preset-2 |
| appearance（页面属性） | platform | blue |
| 查询模式 | 继承；缺失 inline | blocks.queryPanel.mode=card |
| 查询默认展开 | 继承；缺失 true | blocks.queryPanel.defaultExpanded=true |
| 顶部列表操作 | 继承；缺失 start | templates.list.actionsAlign=end |
| 表格行操作 | 继承；缺失 text | blocks.rowActions.mode=icon |
| 分页 | 继承；缺失 bar | templates.list.paginationLayout=three-part |
| 表单查看 | 继承；缺失 component | templates.form.viewDisplay=text |
| 单层树操作 | 继承；缺失 header | blocks.treePanel.actionStyle=header |
| 树选中 | 继承；缺失 platform | blocks.treePanel.selectionStyle=dot |
| 密度、表格边框/斑马纹、表单列数等 | 继承 | 继承 |

总体风格不是 GlobalPreference 字段。纯列表、无树页面不生成无用树状态；无表单页面不额外增加查看功能。
用户若说“模板1，但强制工具栏居右”，使用 platform 并只覆盖 actionsAlign=end，不改成模板2。

## 模板2：列表2完整模板与卡片分段表单

- 表格页面统一使用 `BlueListPage.vue`，先执行 `node <本技能目录>/scripts/install-templates.cjs <目标项目> --style=list-blue`。该选项安装 BlueListPage、list-blue.css 及其 table-blue.css/toolbar-blue.css 依赖，不安装其他可选皮肤。组件从本地文件局部导入，不假设全局注册。
- BlueListPage 自带整体样式，统一提供顶部操作栏、可折叠查询区、勾选批量条、表格区域和分页区域；不叠加旧 `.pt-appearance` 列表规则。filters 插槽直接放 el-form-item；actions 插槽直接放公共工具栏项；默认插槽提供 tableClass/queryExpanded，el-table 绑定 class 和查询展开状态；pagination 插槽按偏好放 ThreePartPagination。模板不代替业务查询、校验和提交。
- 左树右表保留实际分栏与 TreePanel，在右侧放 BlueListPage，避免嵌套另一个 BusinessListPage 产生双重工具栏。右侧不传标题或额外摘要，遵循标题隐藏规则。左树样式与分栏高度按实际容器核实，不能只替换表格 CSS 就宣称完成列表2。
- 表单超过8个业务字段时必须使用 FormSectionCard 分段，按业务语义组织（如基本信息、联系信息、分类与补充信息），不机械按字段数量平均切分、不虚构业务字段。每段复用同一最终列数，默认双列；备注、描述等多行文本使用 pt-field-full 独占整行。整个表单仍只使用一个 el-form，统一校验和提交，不重复嵌套 FormSection 标题。
- 字段数统计不包含隐藏 ID、按钮、标题，备注按一个字段；8个及以下不强制卡片，用户指定分段或布局优先。新增编辑弹窗和独立表单均适用；弹窗宽度按最终列数设置，双列采用800px上限，窄屏退化单列。
- 所有页面和表单继续引用子项目统一 GlobalPreference；只在页面 computed 中实施预设覆盖，不修改共享偏好。行操作图标、三段式分页、查看纯文本等规则保留。

## 模板3：白色表格与分割式表单

稳定标识 preset-3；选择模板3不强制页面为左树右表，按业务需求确定页面形态。

| 项目 | 模板3配置 |
| --- | --- |
| 表格 | el-table class="pt-table-white"，按 --style=white 安装并显式导入 table-white.css |
| 页面壳 | 纯列表 BusinessListPage；左树右表 TreeListPage，appearance=platform，不叠加 BlueListPage 或 blue appearance |
| 查询 | blocks.queryPanel.mode=card、layout=header、defaultExpanded=true |
| 行操作 | blocks.rowActions.mode=more，RowActions 过滤隐藏项后超过两项才收起，前两项显示，其余下拉 |
| 分页 | templates.list.paginationLayout=three-part，实际使用 ThreePartPagination |
| 单层树 | blocks.treePanel.actionStyle=header，顶部标题及新增入口；选中样式未指定则继承 |
| 左树右表右侧 | 显式 show-title=true，提供业务列表 title 和新增按钮；不额外生成描述或摘要 |
| 表单超过8字段 | FormSectionDivider + FormSection，按业务语义分段，默认双列 |
| 其他设置 | 继承项目有效 GlobalPreference，用户显式要求优先 |

- 查询卡片放在纯列表上方或 TreeListPage 的 query 插槽，向 QueryPanel 传 layout=header（或绑定解析后的 bindings.queryPanel），确保标签在上，标题、折叠、重置、搜索同一行。不得只设置偏好而漏传 layout。
- 顶部标题与新增入口是模板3的明确布局规则，优先于其他模板的右侧标题隐藏规则。左树单层使用 TreePanel header；多层树现有 TreePanel 不提供顶部标题栏，需在树面板外显式组合顶部标题和新增根节点按钮，节点菜单仍负责新增同级/子级。不要误用不存在的 TreePanel 插槽或强行标记 flat。
- 分页三段布局下保留选择清理与批量态；新增由默认业务工具栏提供，已有批量选择态可暂时切换为批量操作，不重复生成新增。页面没有新增权限或用户禁止新增时隐藏。
- 超过8个业务字段的新增、编辑弹窗及独立表单均使用 FormSectionDivider 分段标题，字段放在随后 FormSection 中。按基本信息、联系信息、补充信息等实际业务语义分组，不机械均分、不虚构字段；不改用 FormSectionCard。number 可选，第二段可使用 tone=secondary；FormSection 不再重复设置 title。
- 业务字段数不计隐藏 ID、按钮和标题，多行文本算一个字段。超过8个默认双列，多行文本 pt-field-full 独占整行，弹窗宽度与最终列数一致；8个及以下不强制分段。整页只保留一个 el-form，统一校验与提交。
- 左树高度必须贯穿页面容器、TreeListPage、左栏滚动视图、TreePanel 与树内容；复用最新版 TreeListPage/TreePanel 的伸展样式。左侧 el-tree 至少填满可用树区域，节点多时在树区域内部滚动。不要只给 el-tree 设置 height:100%，也不要用固定像素高度；页面若额外包装树标题，该包装必须 display:flex、flex-direction:column、flex:1、min-height:0，TreePanel 同样 flex:1。在实际菜单容器中检查少量节点仍铺满、长树可滚动及窄屏堆叠。
- 树节点菜单与表格 RowActions 的 more 模式是两套交互。树节点必须复用 examples/TreeListExample.vue 的节点结构：pt-tree-panel-node 内放标签、计数和 el-dropdown.pt-tree-panel-more，触发器是 button.pt-tree-panel-trigger，内容使用 el-icon + MoreFilled（横向省略号），aria-label 描述节点操作；禁止生成常驻“更多”文字。鼠标移入当前节点行才显示省略号，键盘聚焦和菜单打开时保持显示，触屏保留入口；通过 visible-change 维护 is-open，触发按钮 @click.stop/@keydown.stop 防止误选节点。使用 TreePanel 共享样式，不在业务页覆盖为常驻显示。菜单继续点击打开，悬停仅控制入口显隐。

- 按 computed 逐层合并模板3覆盖项，不能修改项目共享 GlobalPreference；工具栏对齐、查看模式等未明确项继续继承。

一句话调用：使用 afcenter-page-generation，选择模板3生成供应商管理页面；左树右表顶部显示标题和新增，字段及接口如下……

## 共用生成规则

- 所有模板生成的 `el-table` 默认都必须添加 `v-auto-height`，自动撑满所在区域的剩余高度；不要遗漏指令，也不要用固定 height、max-height 或额外滚动包装抵消自动高度。只有用户明确要求其他高度布局时才覆盖此默认规则。

- 所有模板（模板1、模板2、模板3及未指定预设的页面）的树节点菜单统一使用 MoreFilled 横向省略号图标，禁止常驻“更多”文字按钮。默认隐藏省略号入口，鼠标移入当前节点行后显示；点击入口打开菜单，菜单打开期间保持入口可见。复用 examples/TreeListExample.vue：el-dropdown 使用 pt-tree-panel-more，按钮使用 pt-tree-panel-trigger，内容为 el-icon + MoreFilled；通过 visible-change 维护当前打开节点并绑定 is-open，按钮 @click.stop/@keydown.stop 避免误选节点。键盘聚焦时可见，触屏保留入口；节点菜单规则独立于表格 RowActions 模式。

- 模板安装自本技能 assets，组件和样式从目标项目本地导入。已验证可用的公共组件及 v-auto-height 直接使用。所有页面引用同一子项目 GlobalPreference，预设只在页面 computed 中逐层合并覆盖，不修改共享对象。

- 模板1与模板3列表复用 BusinessListPage、左树右表复用 TreeListPage；模板2按上节使用列表2完整模板，右侧标题、描述及摘要遵循 SKILL.md「左树右表的右侧展示」规则，仅在用户明确要求时显示。模板1独立查询放 QueryPanel，左树右表放 query 插槽；模板2查询放 BlueListPage 的 filters 插槽。三段式实际渲染 ThreePartPagination，不能只设偏好而继续放标准 Pagination。
- 父模板不自动配置全部插槽内容：分别绑定 table、queryPanel、rowActions、pagination、form、view 等解析结果。
- 模板2的表格操作列使用 RowActions 并绑定解析后的 bindings.rowActions，确保 mode=icon 实际生效；纯列表、左树右表及主子表明细的操作列均遵循。操作使用 16px 图标、tooltip 和可访问名称，保留权限与禁用条件，不以文字按钮替代。编辑入口仍沿用首个业务列链接规则，不重复增加编辑操作；用户明确覆盖操作模式时优先遵循。
- TreePanel 仅为搜索、标题、新增入口和偏好样式外壳。页面直接生成 el-tree、节点模板、菜单、过滤、权限和数据操作。structure 明确 flat/tree；不要沿用已移除的 data/actions 等封装接口。
- 节点图标直接读取页面响应式 bindings.treePanel.selectionStyle：dot 输出 pt-tree-panel-dot，其他输出平台 group 图标。不捕获外层插槽 selectionStyle 控制节点刷新。
- 单层 header 为顶部标题加新增图标；多层为节点菜单新增同级/子级。新增编辑使用 pm-form-dialog。blue 隐藏树顶边框与底部新增区分隔线；平台 footer 模式保留树顶边框。
- viewDisplay=text 必须在查看态渲染字段内容，不能仅传配置后仍显示禁用输入框。新增编辑仍使用字段组件。
- 表单超过8个业务字段双列，多行描述跨整行，弹窗宽度与最终列数一致。

实现前读取 本技能 assets/PageTemplates/docs/README.md、对应组件及最新示例；与源码不一致时核实能力，不伪造已实现接口。

## 一句话调用

- 使用 afcenter-page-generation，选择模板1，根据这份需求生成用户管理页面。
- 使用 afcenter-page-generation，选择模板2，在当前微前端生成左树右表的分类管理页面，需求见附件。
- 使用 afcenter-page-generation，选择模板2，但树选中使用平台默认样式，生成前面讨论的资源管理页面。

交付说明所选预设、最终覆盖项、接入方式及验证结果。未做浏览器或远程加载验收时明确说明。

## 列表2操作区域规范

- 查询区域上方的主操作区（BlueListPage 的 actions 插槽）仅放不依赖表格勾选记录的操作，如新增、导入、全量或按查询条件导出。
- 依赖选择列勾选记录的操作，如批量删除、批量启停、批量分配、导出选中项，必须放在查询区域下方、表格上方的批量操作条，使用 batch-actions 插槽；不得放到顶部 actions 主操作区，即使无勾选时禁用也不符合此布局规范。
- 页面维护 selections 并向 BlueListPage 传 selectionCount。仅有勾选记录时显示批量操作条，展示已选数量、取消选择及对应批量按钮；取消选择需实际清空 el-table 勾选。模板已有默认批量删除时不重复生成按钮；自定义 batch-actions 会替换默认批量删除，需要时在该插槽内一起提供。
- 批量按钮保留权限、禁用和 loading 判断，执行前再次检查选择；查询、翻页及数据刷新后的选择清理沿用业务契约。单行操作仍放表格操作列，不混入批量操作条。
- 生成验收时分别检查 actions 和 batch-actions：凡操作对象来自 selections/selectedIds 的按钮，均应位于批量操作条；用户本次明确指定其他布局时按其要求覆盖。
<!-- Modified by AI on 2026-11-13 10:08:22 -->
