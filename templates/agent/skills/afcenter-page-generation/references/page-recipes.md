# 页面模板与区块组合

以下模板路径相对于本技能 assets/PageTemplates；安装后相对于目标项目 src/components/PageTemplates。以当前源码为契约，不复制演示数据、权限码或演示操作到真实业务。

## 表格高度通用规则

所有模板生成的 `el-table` 默认都必须添加 `v-auto-height`，自动撑满所在区域的剩余高度；不要遗漏指令，也不要用固定 height、max-height 或额外滚动包装抵消自动高度。只有用户明确要求其他高度布局时才覆盖此默认规则。

## 列表骨架

读取 `src/components/PageTemplates/ListPage.vue` 和 `examples/ListExample.vue`。导出名是 `BusinessListPage`，不是文件名 ListPage。

| 区域 | 组合方式 | 业务责任 |
| --- | --- | --- |
| 页头工具栏 | 模板内置 PmToolbar.al-toolbar，默认新增XX、批量删除 | entityName、showCreate、showBatchDelete、createDisabled、deleting、selectionCount；处理 create、batch-delete、clear-selection |
| 行内查询 | filters 插槽放平台 PmSearch.al-search | v-model:query、default-prop、body 插槽、search 事件 |
| 卡片查询 | QueryPanel 放 BusinessListPage 上方 | model、search、reset、toggle；见下文 |
| 数据区 | 默认插槽直接放 el-table v-auto-height | 数据、loading、row-key、选择事件、字段列 |
| 编辑入口 | 选择列后的第一个数据列使用 el-link type="primary" | 打开当前记录的编辑副本；操作列不重复编辑 |
| 行操作 | RowActions 放在操作列 | 默认删除；按需求补其他操作，不默认复制示例的查看/复制 |
| 分页 | pagination 插槽，模板已包 al-footer | 平台 Pagination；three-part 模式使用 ThreePartPagination |

默认表格无边框，用 bindings.table 继承，不写无条件 border。默认表格、top-block、al-footer 的层级用于自动高度计算，不额外套滚动层或固定 height/max-height。

居左工具栏沿用平台 top-block / el-row / 16:8 栅格（无查询时可占满）。居右沿用模板一行布局：标题、搜索、次要图标操作、最右侧新增主按钮。搜索与操作紧邻；次要图标无边框、有 tooltip 和可访问名称。顶部图标沿用模板尺寸，行操作图标固定 16px。

actions 插槽会替换整组默认操作；消费 icon-only、selection-count、batch-active 插槽参数，自己实现相同的权限、禁用、图标提示与主按钮位置。不要假设模板会自动把任意业务按钮变为图标。

## 查询卡片

读取 `QueryPanel.vue`。默认插槽直接放 el-form-item，内部已有 el-form，不重复嵌套。

- 查询字段全部展示，使用 QueryPanel 内置等宽网格与统一标签宽度，自适应换行；输入框、下拉框、日期等控件撑满各自查询项，末项不单独拉满整行。不额外指定各字段不同宽度或重复套行列布局。
- 查询/重置作为网格最后一项，固定在最后一行的最右列，并在列内右对齐，右边缘与查询区内容右边缘对齐；不能仅紧随最后一个字段而停在中间列。最后一行字段占满时，按钮另起一行居右。不得另设与全部字段并列的右侧操作栏，导致按钮停留在第一行。
- 只折叠整个卡片，不恢复“高级条件”逻辑。
- defaultExpanded 只负责初始状态；v-show 折叠保留输入，不自动清空或查询。
- toggle(expanded) 后需让表格重新计算自动高度；参考 ListExample 的 data-query-expanded 更新，不重建表格。
- 查询及重置统一重置页码并加载；避免输入变化、事件和 watcher 同时请求。

## 行操作与分页

RowActions：`actions` 各项为 key、label、icon、visible、disabled，事件 `action(key, row)`。mode=text 顺序文字；icon 仅 16px 图标加提示；more 前两个可见操作显示文字，其余进入更多。先过滤 visible=false 再计数；事件处理仍检查权限/忙碌状态。

分页模式：

- bar：平台 Pagination，选择数量传 selections，工具栏保留常态。
- split：平台 Pagination，模板样式拆分总数与翻页区域；选择数量移到顶部批量态。
- three-part：ThreePartPagination，左总数、中页码（上一页/下一页）、右每页条数；选择数量同 split。

split / three-part 勾选后隐藏新增，取消选择清空表格选择；居右标题区变为已选数量。不要把批量态按钮是否为 primary 当成稳定接口，以源码为准。

ThreePartPagination 接受 total/currentPage/pageSize/pageSizes/disabled；发出模型更新及 current-change/size-change。容量变化重置页码；选事件或 watcher 的一种加载路径，避免双请求。确认平台 Pagination 实际事件契约，不套用库内 pm-pagination 的 API。

## 单实体表单弹窗

读取 `examples/FormExample.vue`、`examples/ListExample.vue` 以及相邻技能 `../../pm-components-usage/references/feedback.md` 中的 pm-form-dialog 契约（源码可选核实）。

```vue
<pm-form-dialog v-model:dialog-visible="dialogVisible" :title="formTitle"
  :loading="saving" :width="formDialogWidth" @submit="formRef?.submit()">
  <template #form>
    <EntityForm v-if="editing" ref="formRef" :preference="preference"
      :data="selected" :save="saveRecord"
      @update:loading="saving = $event" @success="handleSaved" />
  </template>
</pm-form-dialog>
```

此片段表示组合契约；宿主仍需实现打开、保存、关闭和刷新。显式绑定 submit，不依赖组件寻找旧表单 mixin。子表单暴露 submit()，完成校验后 await save(record)，成功才发 success，失败保留输入。

- 外层一个 el-form，v-bind="bindings.form"；FormSection 绑定最终 formColumns，内部放 el-form-item 及字段组件。业务字段超过 8 个时 formColumns 为 2，8 个及以下使用 bindings.formPage.columns；字段计数规则见 SKILL.md。按字段顺序从左到右、从上到下排列。
- 默认 label-position=top，由偏好覆盖。备注、描述等多行文本的 el-form-item 必须使用 pt-field-full 跨整行；上传或其他长内容按需求跨整行。支持 size 的 pm- 字段组件默认显式设置 size="default"。
- 弹窗宿主随列数调整宽度：`min(800px, calc(100vw - 32px))`（两列）或 `min(520px, calc(100vw - 32px))`（一列）。使用 computed，切换时即时更新。
- .pt-page 是容器查询边界，内容宽度 ≤640px 双列自动变单列。不能在固定 520px 弹窗里宣称双列已生效。
- 使用既有样式避免双重 padding，不额外设 body-class="p-0"。
- 编辑数据使用副本，嵌套对象按业务深拷贝；切换到新增时清理旧 ID、错误和校验。保存锁同时覆盖子表单提交和宿主关闭/换记录。

## 主子模型表单

适用于一个主实体关联一个或多个明细集合的新增、编辑和查看，不将主子模型拆成互不关联的列表页。模板1和模板2都采用以下规范，总体外观继续继承所选预设。

### 布局与选择

- 上方为主表表单，下方为子表明细表格。主表复用 FormSection 及字段组件，默认双列（formColumns=2），即使主表业务字段不超过8个也采用双列；此页面级默认优先于继承的单列偏好，不修改全局偏好。用户明确指定列数时优先遵循，窄屏仍自动退化为单列。实际最终列数同时绑定表单容器与 FormSection，避免只设置偏好而未生效。
- 主表字段按从左到右、从上到下排列，备注、描述等多行字段跨整行，查看态沿用表单规则；子表集合不计入主表业务字段数量，明细表格不参与主表双列栅格。
- 单个子表直接显示带业务标题的明细表格，不增加只有一个页签的 Tab。
- 多个子表支持两种形式：Tab 模式使用 el-tabs，每个 el-tab-pane 内显示对应子表的工具栏和明细表格；流式模式按业务顺序纵向显示多个子表区块，每块包含标题、工具栏和明细表格。
- 用户指定“多子表 Tab”或“多子表流式”时直接遵循；未指定时多个子表默认 Tab。Tab 标题和区块标题使用真实子表业务名称，不使用“子表1”等占位名称冒充已明确需求。
- 新增编辑入口沿用 pm-form-dialog；需求明确独立页面时使用 StandardFormPage。主子表弹窗宽度根据明细列数和可用视口调整，不机械套用仅主表字段列数决定的 520px/800px 宽度，表格较宽时允许横向滚动。
- 明细表格沿用 bindings.table 和总体样式；按钮、分页继续继承有效偏好。明细 el-table 同样默认添加 v-auto-height；多个明细表格须安排各自可用高度容器，用户明确要求流式布局时才改为按内容展开。

### 明细编辑与提交

- 按需求提供明细新增、编辑、删除。简单字段可在表格行内编辑，复杂明细使用 pm-form-dialog；无需求不额外生成导入、导出等操作。查看态隐藏修改入口，主表与明细统一遵循 viewDisplay，text 模式展示字段内容。
- 每个子表维护独立集合、稳定 row-key 及必要的选择状态；未保存行使用本地稳定标识，不将临时标识提交为服务端主键。编辑主表和全部明细使用副本，Tab 切换不重建表格、不丢失输入。
- 保存前同时校验主表和全部子表，包括未激活 Tab 内的明细；明细必填、重复和数量约束以需求为准。若错误位于其他 Tab，切到对应页签并定位错误，不能只校验当前可见子表。
- 主子数据按真实接口契约组织提交，正确保留关联键，区分新增、修改和删除的表达方式；不能凭空假设存在批量保存或事务接口。接口要求分步保存时遵循既定顺序，明确失败后的保留和重试行为。
- 保存期间主表、各子表修改入口和提交按钮统一锁定；失败保留已填主子数据，全部必要保存成功后再关闭并刷新。分页明细不能只提交当前页而丢失其他页的修改。

生成后检查：单子表、多个 Tab/流式子表、未访问 Tab 校验、切换保留数据、明细增删改、主子关联及保存失败状态。没有对应需求或接口时不虚构校验规则和联调结果。

## 独立表单页

使用 StandardFormPage v-bind="bindings.formPage" :columns="formColumns"，default 插槽暴露 columns，传给 FormSection。最终 formColumns 与弹窗表单采用同一字段数量规则，多行文本仍跨整行。header/feedback/actions 分别放标题、反馈和底部操作，内容仍只有一个 el-form。

actions 自行实现保存和取消；stickyFooter 是带文档占位的吸底布局，确认实际滚动宿主。模板不负责验证、接口、返回路由或离开确认。

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


## 按页面选择安装样式

默认安装只包含模板结构所需 style.css，不复制 examples、docs 或可选风格 CSS。白色表格使用 `--style=white` 安装 table-white.css；blue/editorial 页面使用 `--style=appearance` 安装 appearance.css，可同时指定。示例：`node <本技能目录>/scripts/install-templates.cjs <目标项目> --style=white`。页面显式导入选中的 CSS，并在 el-table 上添加 `class="pt-table-white"`。install.js 和 TreeListPage 不自动导入可选样式。生成页面未选择某种外观时，不复制或导入其 CSS；已有项目中已安装的样式不自动删除。样式被其他页面使用时继续共享。

## 列表2表格样式：pt-table-blue

从“列表2/code.html”提取为独立 Element Plus 表格皮肤：浅蓝 #eff4ff 表头、40px 表头高度、11px/600 表头字、13px/18px 内容字、12px 单元格间距、无横向分隔线，悬停浅蓝。Inter 字体有安装时使用，否则回退系统字体，无需网络字体或 Tailwind。

按需安装：`node <本技能目录>/scripts/install-templates.cjs <目标项目> --style=blue`。页面导入 `@/components/PageTemplates/table-blue.css`，使用 `<el-table class="pt-table-blue" v-auto-height :data="rows">`。不由 install.js 默认导入，也不默认安装。

原型个别数据行有不同背景，按业务需要通过 row-class-name 返回 pt-table-blue-row-strong、pt-table-blue-row-soft 或 pt-table-blue-row-muted；不根据行号伪造业务状态。头像、状态标签、动作、列对齐及行内容仍由业务插槽定义。该皮肤适配原型无边框表格，使用时不要开启 border；斑马纹和其他 appearance 叠加需单独验证。该样式不是预设2整体 appearance，不附带导航、查询卡片或分页。

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


模板2表格页使用 BlueListPage，业务字段超过8个的表单使用 FormSectionCard 按业务语义分段；具体规则统一见 [页面预设](page-presets.md)。

## 列表2操作区域规范

- 查询区域上方的主操作区（BlueListPage 的 actions 插槽）仅放不依赖表格勾选记录的操作，如新增、导入、全量或按查询条件导出。
- 依赖选择列勾选记录的操作，如批量删除、批量启停、批量分配、导出选中项，必须放在查询区域下方、表格上方的批量操作条，使用 batch-actions 插槽；不得放到顶部 actions 主操作区，即使无勾选时禁用也不符合此布局规范。
- 页面维护 selections 并向 BlueListPage 传 selectionCount。仅有勾选记录时显示批量操作条，展示已选数量、取消选择及对应批量按钮；取消选择需实际清空 el-table 勾选。模板已有默认批量删除时不重复生成按钮；自定义 batch-actions 会替换默认批量删除，需要时在该插槽内一起提供。
- 批量按钮保留权限、禁用和 loading 判断，执行前再次检查选择；查询、翻页及数据刷新后的选择清理沿用业务契约。单行操作仍放表格操作列，不混入批量操作条。
- 生成验收时分别检查 actions 和 batch-actions：凡操作对象来自 selections/selectedIds 的按钮，均应位于批量操作条；用户本次明确指定其他布局时按其要求覆盖。


模板3使用白色表格、独立顶部标签查询卡片、more 行操作、三段分页；超过8字段用 FormSectionDivider 分段，左树右表显示顶部标题和新增。完整绑定与规则见 [模板3预设](page-presets.md)。
<!-- Modified by AI on 2026-11-13 10:08:22 -->
