# 页面对照表（MOD-001）

<!-- adw:ui-check:skeleton hash:880cfd341c64fb13aebd1b9b394303727c79de488e5c940dca678ddd7ff5bd3e -->

> 工作台生成（软门禁）：实现前先填写对照表，再写代码；未填写不阻断，但完成汇报需标记“流程未完成”。
> 设计事实：`docs/design/MOD-001/design.json` 与 `docs/design/template/` 蓝图；PNG 只是线框草图。

## 实现前

| 设计页 | 路由 | 蓝图 | 字段/列 | 操作 | 布局/交互 | 差异/决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `org-list` 组织与人员 | `/organizations`（`frontend/src/views/OrganizationView.vue`） | docs/design/template/enterprise-application-platform/pages/OrganizationUsers.vue | 列=登录账号、所属员工、所属机构、岗位、角色、状态、锁定、最近登录、操作；筛选=员工姓名、工号、在职状态 | 行：edit、enable、disable；工具栏：create（新建账号）、import（批量导入）；批量：batchAssignRole（勾选后出现在批量操作条） | recipe=tree-list；树=机构名称/上级机构/平台高亮/无节点操作；分页=three-part 每页 10；多选=是；结构=af-page-header + af-split（左 af-tree-panel + 右 af-panel） | 契约补「岗位」列、筛选改为员工姓名/工号/在职状态（蓝图只有单框搜索 + 账号状态下拉）；分页用 `ThreePartPagination` 满足 three-part + 已选计数（蓝图 `pm-pagination` 无计数）；批量导入无接口与字段契约，先留占位提示（TODO），不伪造上传流程 |
| `org-form` 新建/编辑账号 | `/organizations`（同页内嵌 `pm-form-dialog`，无独立路由） | docs/design/template/enterprise-application-platform/pages/OrganizationUsers.vue | 登录账号、员工姓名、所属机构、岗位、角色、状态、锁定；分组=账号信息、归属信息、账号状态 | 保存、取消 | recipe=dialog-form；表单=dialog 2 列 560px；登录账号/员工姓名必填；锁定只读 | 蓝图无「锁定」字段与分组，按契约补：用 `FormSection` 分 3 组、`pm-switch` 承载启用状态、锁定用只读 `af-status`；批量分配角色的弹窗字段需求未定义，按「追加所选角色」最小实现并在待确认项标注（不写回 design.json） |

## 实现后

| 设计页 | 实现文件 | 截图 | 一致项 | 差异 | 原因/处理 |
| --- | --- | --- | --- | --- | --- |
| `org-list` 组织与人员 | `frontend/src/views/OrganizationView.vue`；路由 `frontend/src/router/index.js`；样式副本 `frontend/src/styles/structure.css`、`shared.css`、`platform-blue/style.css`（`main.js` 引入） | 未截图（frontend 无 node_modules，未安装依赖；pm-* 由宿主提供，独立 dev 无法渲染） | 保留蓝图 `af-page-header` + `af-split` + `af-tree-panel`/`af-panel` 结构与 `structure.css` 类；`pm-input` 机构搜索 + `pm-tree` 联动过滤（唯一命中时联动选中，补需求 §2 定位）；`pm-table` 多选/序号及状态、锁定插槽；工具栏「批量导入/新建账号」；`af-panel-title`、`af-status`、`af-link` 视觉类；批量操作条展示已选数量 | 页面标题取设计页名「组织与人员」（蓝图「组织与用户」）；筛选为员工姓名/工号/在职状态（蓝图单框搜索+账号状态）；分页用 `ThreePartPagination`（契约 three-part + 已选计数，替代蓝图 `pm-pagination`）；补「岗位」列；行操作用 `RowActions`；「批量分配角色」移入批量操作条 | 契约/需求优先于蓝图（design-brief §5 已记录）；`ThreePartPagination` 与 `RowActions` 为 PageTemplates 组件；`v-auto-height` 施加在 `pm-table` 组件根（宿主 el-table 封装），高度行为待宿主验证 |
| `org-form` 新建/编辑账号 | 同 `frontend/src/views/OrganizationView.vue`（同页内嵌 `pm-form-dialog`，无独立路由） | 未截图（原因同上） | `pm-form-dialog` 宽 560px、双列；`FormSection` 分「账号信息/归属信息/账号状态」；`pm-input`/`pm-select`/`pm-switch` 组合；登录账号、员工姓名必填校验；角色多选；锁定只读展示 | 蓝图弹窗无分组与「锁定」字段，按契约补；保存与批量分配为内存演示逻辑（TODO 接口） | 需求 §4「锁定不可手工解锁」→ 只读 `af-status`；`状态` 用 `pm-switch`（沿用蓝图字符串值写法）；登录账号编辑态禁用沿用蓝图 |

## 未实现/待确认

- **批量导入**：需求未定义导入模板/字段与接口，按钮仅提示「批量导入接口待接入」（代码 TODO），未伪造上传流程。
- **批量分配角色弹窗**：需求未定义弹窗字段与「覆盖/追加」口径，按「追加所选角色」最小实现（`pm-form-dialog` + 角色多选），待确认后对齐；只作用于已勾选账号。
- **机构维护（新增/编辑/停用/删除）**：design.json `tree.actionStyle:"none"`、蓝图树不可编辑，未实现节点操作（见 design-brief §7 待确认 #2）。
- **员工档案独立页面**：设计未认领（design-brief §6/#1），员工字段仅通过账号列表与弹窗体现。
- **真实接口/权限/字典**：账号、机构、角色均为内存演示数据（代码已标 TODO），未联调；保存、启停、批量分配只改本地状态。
- **浏览器验证与截图**：`frontend/` 无 `node_modules`（未执行 `npm install`），无法启动 dev 或截图；`pm-*` 与 `v-auto-height` 由 AFCenter 宿主全局提供，`v-auto-height` 加在 `pm-table` 组件根上，实际高度行为未实测（团队 skill 的等价写法为 `el-table v-auto-height`，若宿主不生效需替换）。
- **PNG 原型**：MOD-001 未导出，无视觉对照（一致性检查 1 条 warn）。

