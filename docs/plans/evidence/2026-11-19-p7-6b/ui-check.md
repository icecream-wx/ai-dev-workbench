# 页面对照表（MOD-001）

<!-- adw:ui-check:skeleton hash:055935ed237d1e7435305755c2452357bbc00fbc453c99ca74867feca06661d4 -->

> 工作台生成（软门禁）：实现前先填写对照表，再写代码；未填写不阻断，但完成汇报需标记“流程未完成”。
> 设计事实：`docs/design/MOD-001/design.json` 与 `docs/design/template/` 蓝图；PNG 只是线框草图。

## 实现前

| 设计页 | 路由 | 蓝图 | 字段/列 | 操作 | 布局/交互 | 差异/决策 |
| --- | --- | --- | --- | --- | --- | --- |
| `org-list` 组织与账号列表 | `/organizations`（`OrganizationView.vue`） | docs/design/template/enterprise-application-platform/pages/OrganizationUsers.vue | 列：登录账号、所属员工、所属机构、岗位、角色、状态、锁定状态、最近登录；筛选：登录账号、所属员工、状态 | 行：编辑、启用/禁用（按当前状态二选一）；顶部：新建账号、批量导入；批量：批量分配角色（勾选后出现） | recipe=tree-list；`af-page-header` + `af-split` 左树右表；树 `机构名称/上级机构`、只读、选中联动列表；分页 three-part、每页 10；列表多选 | 蓝图无“岗位”列→按需求/design.json 补列；蓝图单关键词→按契约拆为“登录账号/所属员工”两个筛选；蓝图 `pm-pagination` prev/pager/next→`ThreePartPagination`（契约 three-part）；蓝图页脚批量提示→勾选后批量操作条（团队规范 batch-actions）；树搜索保留 `pm-input`；`pm-table` 按用户要求保留并加 `v-auto-height`（透传待联调核实） |
| `org-form` 账号表单（新建/编辑） | `/organizations` 同页内嵌 `pm-form-dialog`（不新增路由） | docs/design/template/enterprise-application-platform/pages/OrganizationUsers.vue | 登录账号、所属员工、所属机构、岗位、角色、状态 | 保存、取消 | recipe=dialog-form；dialog 2 列、宽 560；分组=基本信息、角色与状态；登录账号编辑时禁用；状态以“启用账号”开关呈现；锁定状态不进入表单 | 蓝图无分组→用 `FormSection` 补两组；蓝图“员工姓名”为自由文本→标签改“所属员工”，组件仍 `pm-input`（是否换员工选择器待确认）；蓝图手写必填校验→`el-form` rules + 保存前兜底校验；弹窗仍用 `pm-form-dialog` |

## 实现后

| 设计页 | 实现文件 | 截图 | 一致项 | 差异 | 原因/处理 |
| --- | --- | --- | --- | --- | --- |
| `org-list` 组织与账号列表 | `frontend/src/views/OrganizationView.vue`（路由 `/organizations`） | 未截图（未安装依赖、未启动真实环境） | 保留 `af-page-header` / `af-split` / `af-panel` 结构与蓝图样式；机构树搜索 + 选中联动；列按契约为登录账号/所属员工/所属机构/岗位/角色/状态/锁定状态/最近登录；筛选为登录账号/所属员工/状态；行操作编辑 + 启用/禁用二选一；新建/编辑弹窗；多选；three-part 分页每页 10；状态/锁定徽标沿用 `af-status` | 1) 蓝图 `pm-pagination` 改为 `ThreePartPagination`（契约 three-part）；2) 蓝图单关键词拆为“登录账号/所属员工”两个筛选；3) 蓝图页脚批量提示改为勾选后批量操作条；4) 蓝图 `af-link` 行操作改用 `RowActions`；5) 批量导入/批量分配角色为 TODO 占位提示；6) 蓝图 h1“组织与用户”改为需求模块名“组织与人员” | 设计契约优先；团队规范要求 batch-actions 与 PageTemplates；角色清单与导入流程待确认；`pm-table` 的 `v-auto-height` 透传待宿主联调核实 |
| `org-form` 账号表单（新建/编辑） | `frontend/src/views/OrganizationView.vue`（同页内嵌 `pm-form-dialog`） | 未截图（未安装依赖、未启动真实环境） | `pm-form-dialog` 宽 560px；`FormSection` 双列分组“基本信息/角色与状态”；字段与组件映射符合契约（登录账号/所属员工 `pm-input`，所属机构/岗位/角色 `pm-select`，状态 `pm-switch`）；登录账号编辑禁用；锁定状态在表单只读展示（不可手工解锁）；必填规则生效（rules + 保存兜底） | 蓝图无分组→补 `FormSection` 两组；蓝图“员工姓名”标签改为“所属员工”（组件仍为 `pm-input`）；蓝图手写校验→`el-form` rules + 保存兜底；需求 §6 要求锁定在表单可见、design-brief 写“不进入表单”→按需求加只读徽标（不提供解锁操作） | 设计契约的分组与字段命名优先；需求与设计冲突按需求加只读展示；员工选择器待确认；未伪造权限/角色数据 |

## 未实现/待确认

- **批量导入**：入口保留，点击提示 TODO；来源文件格式、校验规则与失败反馈待确认（design-brief）。
- **批量分配角色**：勾选能力、批量操作条与入口保留，角色清单来自权限模块尚未接入，点击提示 TODO。
- **所属员工录入**：仍按蓝图使用 `pm-input`，未改为员工选择器/`pm-lookup`（design-brief 待确认项 3）。
- **员工档案独立页、机构维护动作（新增下级/编辑/停用/删除）**：design-brief 已列为未认领页面，本轮未实现。
- **运行与交互验证**：未执行 `npm install`，也未启动 dev/build，未做浏览器交互验证与截图；`pm-table` 是否透传 `v-auto-height` 需在宿主联调时确认（已按用户要求保留 `pm-table` 并显式添加指令）。
- **PNG 原型**：MOD-001 未导出（一致性检查的唯一告警），不影响静态检查；需要视觉参考时在设计视图导出。
- **风格文件路径**：`docs/design/template/styles/platform-blue/style.css` 不存在；`design-system.json` 的 `styles.style` 指向 `docs/design/template/styles/style.css`，已按设计系统复制该文件，未修改原件。
