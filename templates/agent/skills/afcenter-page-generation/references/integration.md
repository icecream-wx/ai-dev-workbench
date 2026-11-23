# 子项目本地接入

将 afcenter-page-generation 和 pm-components-usage 两个目录完整放到接收方 Codex 的 skills 目录下，保持同级。无需原基座或组件库源码仓库。

## 安装模板

执行 `node <本技能目录>/scripts/install-templates.cjs <目标项目根目录>`。模板安装到目标项目 src/components/PageTemplates；脚本先比较全部文件，遇到差异停止，避免覆盖本地修改。相同内容可重复执行。升级时先检查项目内改动再迁移，不自动覆盖。

页面从 `@/components/PageTemplates/index.js` 局部导入模板；本地 install.js 仅包含结构样式 style.css，可选样式按页面需要安装并显式导入。别名以目标项目配置为准。

公共 PmSecondaryMenu、PmSearch、PmToolbar、PmToolbarItem、pm-form-dialog、Pagination 和 v-auto-height 在 AFCenter 子项目已验证可直接使用，不重复安装、不复制、不从基座私有路径导入。模板自己的组件仍需本地导入或安装。主题及图标沿用目标环境。

## 每个项目一份 GlobalPreference

先查找已有有效偏好 store/模块，存在时所有生成页面统一引用它，不创建第二份来源。没有时在 src/preferences/GlobalPreference.js 创建响应式单例：

```js
import { reactive } from 'vue'

export const GlobalPreference = reactive({})
```

空对象由模板解析器提供缺失项默认值，不表示已经接通后台。项目初始化时将已合并展开的应用有效偏好更新到此单例；持久化、平台继承和跨应用同步沿用实际项目机制，不在各页面单独请求或实现。更新应保留单例引用，并清理已移除的配置键。

页面统一使用：

```js
import { computed } from 'vue'
import { GlobalPreference } from '@/preferences/GlobalPreference.js'
import { resolvePagePreferences } from '@/components/PageTemplates/index.js'

const bindings = computed(() => resolvePagePreferences(GlobalPreference))
```

已有 store/ref 时按其实际响应式接口读取，不解构成快照。页面只为本页需求计算覆盖；预设嵌套合并遵循 page-presets.md，不修改共享 GlobalPreference。表单子组件可通过 props 接收同一有效偏好。

## 交付检查

运行目标项目本地 `node src/components/PageTemplates/verify.cjs`（需要目标环境已有 Vue、Element Plus、compiler-sfc、server-renderer），并检查模板相对导入及公共组件注册。验证脚本是模板结构与行为检查，不代表浏览器视觉、真实接口或后台偏好同步通过。菜单和路由按目标项目实际机制接入，示例路径不自动构成正式菜单。
<!-- Modified by AI on 2026-11-12 11:20:30 -->


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
<!-- Modified by AI on 2026-11-12 14:30:07 -->
