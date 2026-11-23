# MOD-001 组织与人员 · 设计说明

## 概览

- 需求来源：`docs/requirements/MOD-001-组织与人员.md`（组织树、员工档案、账号、页面与操作、验收）。
- 设计系统：`pack=afcenter-app-templates-v1`，`applicationType=enterprise-application-platform`，`style=platform-blue`（平台蓝白）。
- 模板页面库：认领 `organization`（组织与用户，tree-list）。
- 蓝图：`docs/design/template/enterprise-application-platform/pages/OrganizationUsers.vue`（包内路径 `application-types/enterprise-application-platform/pages/OrganizationUsers.vue`）。
- 本轮范围：左侧机构树 + 右侧账号列表（`org-list`），以及同页内嵌的账号新建/编辑弹窗（`org-form`）。
- 员工档案与机构维护在本轮以**实体字段、列表列、表单字段和校验规则**体现，未新增独立页面；独立页面列入“未认领页面 / 待确认”。

## 导航

- 应用入口：组织与人员（单页），页面内为“左侧机构树 + 右侧账号列表”的 `tree-list` 配方。
- 新建/编辑账号以弹窗呈现，不新增路由与侧边导航。
- 本轮没有员工档案、机构维护、批量分配角色、批量导入的独立页面/路由。

## 实体与关系

| 实体 | 关键字段 | 说明 |
| --- | --- | --- |
| `org` 机构 | 机构名称（必填）、机构编码（必填唯一）、上级机构（自关联）、负责人、状态（启用/停用）、排序号 | 树形结构，顶级机构为“普元信息技术”；停用不可新增下级，存在下级或员工时不可删除只能停用 |
| `employee` 员工 | 员工姓名（必填）、工号（必填唯一）、所属机构（必填）、岗位、手机号、邮箱、在职状态（在职/离职） | 必须归属机构；机构停用后仍可查询，但不能新增到该机构 |
| `account` 账号 | 登录账号（必填唯一）、所属员工（必填）、角色（可多选）、状态（启用/禁用）、锁定状态（已锁定/未锁定）、最近登录 | 一个员工最多一个账号；禁用后立即不能登录但保留历史；锁定只由安全策略触发，界面只读 |

关系：

- `org → org`：`1:N`，下级机构（机构自关联树）。
- `employee → org`：`N:1`，所属机构。
- `account → employee`：`N:1`，所属员工（业务上每员工最多一个账号）。

## 页面

### 1. `org-list` 组织与账号列表

- 类型/配方：`type=list` + `recipe=tree-list`；绑定实体 `account`。
- 来源：认领模板页面库 `enterprise-application-platform/organization`，蓝图 `OrganizationUsers.vue`。
- 布局：`af-split` 左侧机构树面板 + 右侧账号表格面板（与蓝图一致）。
- 机构树：标题“组织机构”，顶部搜索框按机构名称过滤并定位；选中节点联动右侧列表；`actionStyle=none`（蓝图树只读：`editable=false`、`removable=false`，无新增/编辑按钮）；`selectionStyle=background`（蓝图 `highlight-current`）。
- 筛选：登录账号、所属员工（账号或姓名关键词）、状态；机构维度由左侧树选中实现，不重复放“所属机构”筛选控件。
- 列：登录账号、所属员工、所属机构、岗位、角色、状态、锁定状态、最近登录（按需求 §5 补齐“岗位”，蓝图原列缺该项）。
- 行操作：编辑、启用、禁用（按当前状态二选一）。
- 顶部操作：新建账号、批量导入；批量操作：批量分配角色（勾选多个账号后可用）。
- 多选与分页：`selection=true`；`pagination.layout=three-part`、`pageSize=10`；页脚保留“已选账号可批量分配角色”提示与已选数量。
- 状态/锁定展示：沿用蓝图 `af-status` 徽标（启用 success、禁用 neutral、锁定 danger），锁定只读。
- 组件：状态筛选 → `pm-select`，表格 → `pm-table`，分页 → `pm-pagination`；左侧机构树为面板级 `pm-tree`（不作为字段级 `components` 覆盖）。

### 2. `org-form` 账号表单（新建/编辑）

- 类型/配方：`type=form` + `recipe=dialog-form`；绑定实体 `account`。
- 来源：`OrganizationUsers.vue` 内嵌 `pm-form-dialog`（第 77–104 行），与列表同页；`catalogRef` 仍写 `enterprise-application-platform/organization`，不新增模板页面。
- 形态：`presentation=dialog`、`columns=2`、`width=560`（对应蓝图 `width="560px"` 与 `af-form-grid` 双列）。
- 字段：登录账号、所属员工、所属机构、岗位、角色、状态。
  - 登录账号、所属员工必填（对应需求“账号与员工姓名必填”，蓝图校验 `code`/`name`）。
  - 登录账号编辑时禁用（蓝图 `:disabled="Boolean(editingId)"`）。
  - 角色多选；状态在表单中以“启用账号”开关呈现（`pm-switch`）。
  - 锁定状态不在表单中，符合“界面只能查看锁定状态，不能手工解锁”。
- 分组：基本信息（登录账号、所属员工、所属机构、岗位）；角色与状态（角色、状态）。
- 操作：保存、取消。
- 组件：登录账号/所属员工 → `pm-input`；所属机构/岗位/角色 → `pm-select`；状态 → `pm-switch`；容器 → `pm-form-dialog`。

## 页面契约表

| 设计页 | type / recipe | catalogRef | 蓝图 | 实体 / 字段 | 筛选 / 列 | 操作 | 分页 / 表单 / 树 | 组件 | 差异 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `org-list` 组织与账号列表 | `list` / `tree-list` | `enterprise-application-platform/organization` | `.../pages/OrganizationUsers.vue` | `account`：登录账号、所属员工、角色、状态、锁定状态、最近登录；关联 `employee` 的所属机构、岗位 | 筛选：登录账号、所属员工、状态；列：登录账号、所属员工、所属机构、岗位、角色、状态、锁定状态、最近登录 | 行：编辑、启用、禁用；顶部：新建账号、批量导入；批量：批量分配角色 | 分页 `three-part`、每页 10；树 `titleField=机构名称`、`parentField=上级机构`、`actionStyle=none`、`selectionStyle=background` | 状态 `pm-select`、机构树 `pm-tree`（面板级）、表格 `pm-table`、分页 `pm-pagination` | 蓝图无“岗位”列，按需求补齐；蓝图分页为 prev/pager/next 非三段式，按需求改为 `three-part`；蓝图树只读，`actionStyle=none` |
| `org-form` 账号表单 | `form` / `dialog-form` | `enterprise-application-platform/organization`（同页内嵌弹窗） | `.../pages/OrganizationUsers.vue` | `account`：登录账号、所属员工、角色、状态；关联 `employee` 的所属机构、岗位 | 表单字段：登录账号、所属员工、所属机构、岗位、角色、状态 | 保存、取消 | 弹窗、双列、宽 560；分组：基本信息 / 角色与状态 | 登录账号/所属员工 `pm-input`；所属机构/岗位/角色 `pm-select`；状态 `pm-switch`；容器 `pm-form-dialog` | 蓝图“员工姓名”为自由文本 `pm-input`，设计按需求改为“所属员工”引用；是否叠加员工选择器待确认；蓝图无分组标题，按字段语义补分组 |

## 冲突与决策

1. **需求有员工档案章节，蓝图没有员工页面**：需求 §3 给出员工字段与筛选，但模板页面库与蓝图只有“组织树 + 账号列表”。本轮把员工字段作为 `employee` 实体与账号列表/表单的关联字段承载，不新增员工列表页；独立员工档案页列入“未认领页面”，需确认后再按通用 `list` 配方补契约。
2. **需求隐含机构维护动作，蓝图树只读**：需求 §2 的机构字段、“停用不可新增下级”“有下级/员工只能停用”隐含新增下级、编辑、停用、删除等操作；但蓝图树 `editable=false`、`removable=false`，面板只有搜索，没有 header 操作。本轮 `tree.actionStyle` 取 `none` 与蓝图一致，机构维护动作/权限不写入页面契约，作为待确认项；不能把未落地的按钮写成契约。
3. **列表“岗位”列**：需求 §5 明确列出“岗位”，蓝图 `columns` 没有岗位。设计以需求为准补列（数据取员工岗位），开发按契约在蓝图基础上加列。
4. **“状态”与“启用状态”命名**：需求 §4 字段叫“启用状态”，§5 列叫“状态”。统一为 `account` 实体字段“状态”（枚举：启用/禁用），列表列名“状态”，表单用“启用账号”开关（`pm-switch`）表达，避免同义字段重复。
5. **分页形态**：需求 §5 要求每页 10 条并提示已选数量；蓝图 `pm-pagination` 使用 `prev, pager, next`，页脚仅有一句批量提示。契约定为 `layout=three-part`、`pageSize=10`，开发改用 `ThreePartPagination` 并保留已选数量提示；这是对蓝图的适配差异。
6. **“所属员工”录入方式**：需求要求账号必须归属员工且一员工最多一个账号；蓝图表单的“员工姓名”是自由文本 `pm-input`，无法保证唯一关联。设计实体用 `所属员工` 引用 `employee`，但本轮组件仍按蓝图用 `pm-input`；建议后续改为员工选择器（如 `pm-select`/`pm-lookup`），需确认后再定。
7. **账号表单中的所属机构/岗位归属**：这两个字段属于 `employee`，蓝图把它们放在账号弹窗里。契约保留这些字段以匹配蓝图与需求表单，但“保存时是否同步修改员工档案”未在需求中说明，作为待确认项；设计中不把字段复制到 `account` 实体。
8. **批量导入交互缺失**：蓝图有“批量导入”按钮，但没有导入弹窗、模板下载或校验流程。契约保留需求动作名“批量导入”，具体交互与失败反馈待确认。
9. **锁定只读**：列表展示锁定徽标，表单不提供锁定/解锁字段，符合需求“只能查看，不能手工解锁”；无需偏离蓝图。
10. **机构筛选入口**：需求要求按机构筛选，设计用左侧机构树选中联动列表，不额外放“所属机构”下拉，避免与树重复；`filters` 只列关键词与状态字段。
11. **停用机构的约束**：需求规定停用机构不可新增下级、有下级/员工时不可删除。本轮作为校验规则记录在实体说明与验收中，不改变页面结构；具体提示文案与按钮禁用策略在开发阶段实现。

## 未认领页面

- **员工档案列表/表单页**：需求 §3 需要按姓名/工号搜索、按机构与在职状态筛选，但模板页面库无对应页面；若确认需要，建议按通用 `recipe=list` + `dialog-form` 的 PageTemplates 实现，字段取 `employee`。
- **机构维护（新增下级/编辑/停用/删除）页或树内操作**：需求 §2 隐含，但蓝图树只读且页面库无独立机构页面；需确认是否在 `org-list` 的树面板加 header/inline 操作，或新增机构弹窗。
- **批量分配角色弹窗**：当前只在 `org-list` 保留动作与勾选能力，模板库无对应弹窗；角色清单由权限模块提供，待确认后补。
- **批量导入弹窗**：同上，蓝图只有按钮，无导入流程页面。
- **账号详情页**：需求未要求；列表已含需求列，暂不认领。
- 模板库其余页面（`overview`、`applications`、`application-form`、`audit`）与本模块无关，未认领。

## 组件与风格

- 页面结构优先复用 `frontend/src/components/PageTemplates/`：树列表参考 `TreeListPage`，列表区块参考 `BusinessListPage`，弹窗表单参考 `StandardFormPage` / `FormSection`，分页使用 `ThreePartPagination`；新增/编辑默认 `pm-form-dialog`。
- 业务组件：`pm-tree`（机构树）、`pm-table`（账号表格）、`pm-select`（状态/机构/岗位/角色）、`pm-switch`（启用账号）、`pm-input`（账号/员工姓名）、`pm-pagination`、`pm-form-dialog`；统一由 AFCenter 宿主提供，不在前端重复注册。
- 视觉风格取 `platform-blue`（平台蓝白），颜色/间距/圆角以 `docs/design/MOD-001/tokens.json` 为准；状态与锁定徽标沿用蓝图 `af-status` 语义（success/neutral/danger）。
- `tokens.json` 与 `prototypes/**` 由工作台生成，不要手工修改；本次结构变更后建议在工作台重新导出原型 PNG，旧 PNG 仅作线框草图。

## 校验与待确认

- 已运行 `.opencode/skills/adw-design-artifacts/scripts/validate.mjs` 校验 `design.json`，结果见本次汇报。
- 待确认：
  1. 是否本轮补“员工档案”独立列表页（需求 §3）。
  2. 机构新增/编辑/停用/删除放在树面板 header、行内菜单，还是独立弹窗/页面。
  3. 账号表单的“所属员工”是否改为员工选择器（保证一员工一账号）。
  4. 账号表单保存时，所属机构/岗位是否同步写员工档案。
  5. 批量导入的来源文件格式、校验规则与失败反馈。
  6. 批量分配角色的角色清单来源与权限边界（是否来自权限模块）。
