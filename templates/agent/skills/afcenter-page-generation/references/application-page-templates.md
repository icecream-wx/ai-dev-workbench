# 完整页面模板

完整页面模板位于 `assets/ApplicationPageTemplates/`，用于直接复用成熟的页面构图、视觉主题和交互组合。它们与 `assets/PageTemplates/` 分工不同：前者是可改造成业务页的完整蓝本，后者是列表、表单、树表等基础页面结构组件。

## 选择顺序

1. 先按页面形态选择最接近的页面，再按视觉风格选择套装；不要只按页面名称匹配。
2. 读取目标 `.vue`、同套装 `style.css`，以及存在时的 `assets/`。不要先读取整套所有页面。
3. 将模板中的实体、字段、演示数据、事件和文案替换为真实需求；保留有价值的布局与交互组合。
4. 按目标工程现有入口注册 `pm-*` 组件，并核对组件 API。模板不负责安装或重复注册组件库。
5. 同一页面区域只使用一套主题样式。不要混用多个套装的 `style.css`。

## 套装概览

| 套装 | 风格 | 优先场景 |
| --- | --- | --- |
| `afcenter` | 明亮蓝白、留白适中、平台感强 | 应用管理、组织用户、审计、平台驾驶舱 |
| `classic-ops-admin` | 暖橙棕、高密度、边界明确 | 运营台账、公告、权限、排班、异常处理 |
| `data-workbench` | 蓝青冷色、卡片化、数据科技感 | 数据资产、任务、监控、接入、协作 |
| `lightweight-tool-console` | 芥末黄与黑色、高对比、工具感 | 小型工具、事件监控、规则与处置 |

## 页面目录

| 套装/文件 | 页面形态与可复用结构 |
| --- | --- |
| `afcenter/pages/PlatformOverview.vue` | 指标、图表、动态和应用概览 |
| `afcenter/pages/ApplicationCenter.vue` | 筛选、卡片/表格双视图、编辑弹窗 |
| `afcenter/pages/ApplicationForm.vue` | 分步表单、校验、配置摘要 |
| `afcenter/pages/OrganizationUsers.vue` | 左树右表、账号和角色管理 |
| `afcenter/pages/AuditLogs.vue` | 组合筛选、日志表格、详情弹窗 |
| `classic-ops-admin/pages/OperationsTreeTable.vue` | 左树右表、组织档案、人员台账 |
| `classic-ops-admin/pages/OperationsList.vue` | 筛选、批量操作、表格、分页 |
| `classic-ops-admin/pages/OperationsForm.vue` | 分组表单、富文本、附件上传 |
| `classic-ops-admin/pages/OperationsPermission.vue` | 组织索引、权限矩阵 |
| `classic-ops-admin/pages/OperationsComponentForm.vue` | 输入、选择、上传、组织类组件表单；依赖同套装 `assets/ledger-workflow.svg` |
| `classic-ops-admin/pages/OperationsDashboard.vue` | 经营指标、趋势图、运营待办 |
| `classic-ops-admin/pages/OperationsSchedule.vue` | 高级搜索、班次维护、状态确认 |
| `classic-ops-admin/pages/OperationsIssues.vue` | 阶段流程、异常列表、处置弹窗 |
| `data-workbench/pages/DataTreeTable.vue` | 数据域树、多级表头、资产检查 |
| `data-workbench/pages/DataTaskList.vue` | 指标、组合搜索、进度、资源侧栏 |
| `data-workbench/pages/DataTaskForm.vue` | 四步任务向导、发布确认 |
| `data-workbench/pages/DataAssetCatalog.vue` | 主题域、资产卡片、质量信息 |
| `data-workbench/pages/DataMonitor.vue` | 吞吐、资源池、异常实例、运行动态 |
| `data-workbench/pages/DataAccessWorkspace.vue` | 上传、字段映射、OCR、质量检查、日历 |
| `data-workbench/pages/DataTaskDetail.vue` | 配置、血缘、质量、资源、运行时间线 |
| `data-workbench/pages/DataWorkspaceMembers.vue` | 角色、数据权限、协作状态 |
| `lightweight-tool-console/pages/IncidentList.vue` | 标签筛选、块面表格、分页 |
| `lightweight-tool-console/pages/IncidentRuleForm.vue` | 分节表单、检测逻辑、响应动作 |
| `lightweight-tool-console/pages/IncidentWorkspace.vue` | 标签、折叠、卡片、分栏、操作组件 |
| `lightweight-tool-console/pages/IncidentDetail.vue` | 状态卡、处置时间线、操作日志 |

## 复用方式

- 直接生成业务页时，从技能资产复制所选 `.vue`，同时复制同套装 `style.css` 和所需静态资源；再按目标工程目录调整导入路径。
- 需要先把原始蓝本装入目标工程时，运行 `node <本技能目录>/scripts/install-application-page-template.cjs <目标工程> <套装> [页面名]`。省略页面名会安装整套；页面名可带或不带 `.vue`。
- 安装位置固定为 `src/views/application-page-templates/<套装>/`。脚本发现同名内容不一致时停止，不覆盖本地修改。
- 页面可以直接作为路由组件，也可以由业务入口包装。模板声明的 `navigate`、`open-list`、`open-detail` 等事件需接入目标路由。

## 改造成业务页

- 将内存演示数据替换为目标工程 API、store 或路由参数；未接通依赖时明确标注，不把演示数据描述为已联调。
- 保持本技能的通用规则优先：表格高度、查询回第一页、删除末页回退、选择清理、保存锁、失败保留输入、表单布局和 `GlobalPreference` 继承都必须重新核对。
- 把模板中的固定标题、状态、角色、字典值和权限动作视为示例，不直接当成真实业务契约。
- 保留套装外层作用域类，确保主题变量只在页面区域生效；不要把套装变量提升到全局 `:root`。
- 核对 `vue`、`element-plus`、`@element-plus/icons-vue` 和 `primeton-form-components-v3` 的宿主版本；字段组件的精确 API 读取相邻 `pm-components-usage` 技能。
