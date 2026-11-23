# 设计说明：MOD-001 组织与人员

> 结构事实源：`docs/design/MOD-001/design.json`（已通过 `scripts/validate.mjs`）。
> 本文件只做开发参考与差异说明，不替代 design.json。

## 1. 概览

- 设计系统：`afcenter-app-templates-v1` / 应用类型 `enterprise-application-platform` / 风格 `platform-blue`（来源 `docs/design/design-system.json`）。
- 页面配方：`tree-list`（左侧机构树 + 右侧账号列表）+ 同页内嵌 `dialog-form`（新建/编辑账号），均认领模板页面库 `enterprise-application-platform/organization`。
- 蓝图：`docs/design/template/enterprise-application-platform/pages/OrganizationUsers.vue`（包内路径 `application-types/enterprise-application-platform/pages/OrganizationUsers.vue`），**未修改**。
- 实体：机构（自关联树）、员工、账号；角色只作为账号上的多选值，角色主数据归权限/安全模块，本模块不建实体、不编造角色字段结构。
- 视觉：颜色/间距/圆角以 `styles/shared.css` + `styles/platform-blue/style.css` 为准；`tokens.json` 与 `prototypes/*.png` 尚未由工作台生成，生成后以 design.json 结构为准，不要手改。

## 2. 导航

- 单页入口「组织与人员」（页面 id `org-list`），页面内以左侧机构树做二级定位；本模块不新增独立路由页。
- 新建/编辑账号为同页内嵌 `pm-form-dialog`，不单独占路由。

## 3. 页面

### 3.1 org-list 组织与人员（tree-list）

- 左侧：机构树面板，标题「组织机构」，上方机构搜索框（`pm-input`），树组件 `pm-tree`；选中节点联动右侧账号列表。
- 右侧：账号列表，头部为当前机构名 + 账号数量 + 工具栏（姓名/工号搜索、在职状态筛选），表格 `pm-table`（多选、序号），底部为已选提示 + 分页。
- 主实体 `account`；员工的「所属员工 / 所属机构 / 岗位 / 在职状态」通过 `所属员工`（1:1）关联读取，不重复定义员工字段。

### 3.2 org-form 新建/编辑账号（dialog-form，同页内嵌）

- `pm-form-dialog`，标题「新建账号 / 编辑账号」，宽 560px，双列（`af-form-grid`），提交校验：登录账号、员工姓名必填。
- 分组：账号信息（登录账号、员工姓名、角色）、归属信息（所属机构、岗位）、账号状态（状态、锁定）。
- 「锁定」为只读展示（需求 §4：锁定只由安全策略触发，界面不能手工解锁），开发时用只读文本/标签，不要接可编辑控件。

## 4. 页面契约表

| 设计页 | recipe | catalogRef | 蓝图 | 字段 / 筛选 / 列 | 操作 | 分页 / 表单 / 树 | 组件 | 差异 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `org-list` 组织与人员 | `tree-list` | `enterprise-application-platform/organization` | `application-types/enterprise-application-platform/pages/OrganizationUsers.vue` | 实体 `account`；筛选 `员工姓名`、`工号`、`在职状态`；列 `登录账号`、`所属员工`、`所属机构`、`岗位`、`角色`、`状态`、`锁定`、`最近登录` | 行 `edit` / `enable` / `disable`；工具栏 `create` / `import` / `batchAssignRole`；另记 `actions`：新建账号、编辑、启用、禁用、批量导入、批量分配角色 | `selection: true`；`pagination {layout:"three-part", pageSize:10}`；`tree {titleField:"机构名称", parentField:"上级机构", actionStyle:"none", selectionStyle:"platform"}` | `登录账号`/`所属员工`/`员工姓名` → `pm-input`；`所属机构`/`岗位`/`角色`/`状态` → `pm-select`；表 `pm-table`、树 `pm-tree`、分页 `pm-pagination` | 相对蓝图补 `岗位` 列；筛选改为姓名/工号/在职状态；分页为三段式（含已选计数）；树无节点操作、平台式选中（以蓝图现状为准） |
| `org-form` 新建/编辑账号 | `dialog-form` | `enterprise-application-platform/organization`（同页内嵌弹窗，无独立页面） | 同上（`OrganizationUsers.vue` 第 77–104 行内嵌 `pm-form-dialog`） | 实体 `account`；`form.fields`：`登录账号`、`员工姓名`、`所属机构`、`岗位`、`角色`、`状态`、`锁定`；分组：账号信息 / 归属信息 / 账号状态 | `actions`：保存、取消 | `presentation:"dialog"`、`columns:2`、`width:560` | `登录账号`/`员工姓名` → `pm-input`；`所属机构`/`岗位`/`角色` → `pm-select`；`状态` → `pm-switch`；`锁定` 只读展示（不指定可编辑组件） | 蓝图无「锁定」字段，按需求 §6 增加只读展示；`状态` 用开关承载启用/禁用 |

- 动作码说明：`batchAssignRole` 不在 schema 推荐动作码内，产生 1 条 warning（已保留原值），因为它就是需求 §4/§5 的“批量分配角色”，没有等义推荐码；开发按该码实现批量操作。
- 树选中为 `platform`：蓝图 `pm-tree` 使用 `highlight-current`（平台选中高亮），不是 `dot`。

## 5. 冲突与决策

1. **列表列「岗位」缺失（需求 vs 蓝图）**：需求 §5 列明「岗位」，蓝图 `columns` 只有账号/所属员工/所属机构/角色/状态/锁定/最近登录/操作（`OrganizationUsers.vue` 第 207–216 行）。决策：按需求补 `岗位` 列，位置在「所属机构」之后。影响：表格列宽需重排，蓝图默认宽度不再适用。
2. **列标签差异**：需求用「登录账号 / 状态 / 锁定」，蓝图用「账号」及 `status`/`lock` 插槽。决策：列名取需求文案（设计实体字段为 `登录账号`、`状态`、`锁定`），蓝图仅作为结构与样式基准。影响：表头文案与蓝图不同，属预期。
3. **筛选口径不同（需求 §3/§5 vs 蓝图）**：需求要求按姓名/工号搜索、按机构与在职状态筛选；蓝图只有「搜索账号或姓名」+「账号状态」下拉。决策：契约筛选取 `员工姓名`、`工号`、`在职状态`，机构筛选由左侧树选中承担；蓝图的状态下拉作为可选项，未写入契约（账号状态已在列表中可见），开发如需保留请同步回 design.json。
4. **分页形态（需求 vs 蓝图）**：需求 §5 要求每页 10 条并显示已选数量提示；蓝图页脚是左侧静态文案「已选账号可批量分配角色」+ 右侧 `pm-pagination layout="prev, pager, next"`（`OrganizationUsers.vue` 第 66–74 行），并无已选计数。决策：契约 `layout:"three-part"`、`pageSize:10`，开发用 `ThreePartPagination` 或补左段「已选 N 个」；蓝图现状视为 `split` 形态的近似实现。
5. **机构树无可编辑操作（需求 §2 vs 蓝图）**：需求要求维护多级机构、停用/删除约束，但页面章节未定义机构维护操作，蓝图树为 `:editable="false" :removable="false"`（第 23–24 行）。决策：`tree.actionStyle:"none"` 忠实反映蓝图；机构新增/编辑入口缺口见第 7 节待确认，不擅自造按钮。
6. **表单「锁定」字段（需求 §6 vs 蓝图）**：需求要求停用/锁定状态在表单中可见，需求 §4 又规定锁定不可手工解锁；蓝图表单只有「启用账号」开关。决策：表单契约加入 `锁定`，但明确只读展示、不给可编辑组件；`状态` 用 `pm-switch`。
7. **表单跨实体字段（需求 §4 vs 蓝图）**：蓝图弹窗直接采集「员工姓名 / 所属机构 / 岗位」（属员工实体），需求只规定账号的「所属员工」必填。决策：保留蓝图的采集方式以符合「账号与员工姓名必填」，brief 标注这些字段来源员工实体；账号与员工 1:1 同时建档的实现方式由后端契约确认。
8. **角色无独立实体**：需求要求角色可多选、可批量分配，但未定义角色字段结构，且角色主数据属权限域。决策：`account.角色` 用 `string` 多选存储，不建角色实体，避免编造。
9. **实体粒度**：列表绑定 `account`，筛选/列中出现员工字段，通过 `所属员工`（1:1）取数；不把员工字段复制进账号实体，避免同名字段重复。

## 6. 未认领页面

- 模板页面库其余页面（`overview` 管理驾驶舱、`applications` 应用中心、`application-form` 注册应用、`audit` 审计日志）与本模块需求无关，不认领。
- 员工档案独立列表/详情页：需求 §3 描述了员工字段与筛选，但 §5 页面章节只定义「机构树 + 账号列表」，蓝图也没有员工独立页。暂不认领，作为待确认项（见下）。
- 机构维护弹窗/页面：需求 §2 有机构字段与增删改约束，但无页面操作定义、蓝图也无节点操作。暂不认领。

## 7. 待确认项

1. 员工档案是否需要独立页面（列表/详情）？当前只在账号弹窗与列表关联中体现员工信息。
2. 机构树是否需要新增/编辑/停用节点操作？若需要，`tree.actionStyle` 应改为 `header`，并补机构表单契约（会新增第 3 个页面）。
3. 账号状态筛选（蓝图现状）是否保留为额外筛选项？保留则需在 `org-list.filters` 增加 `状态`。
4. 「批量分配角色」的弹窗形态与字段（角色选择器、是否覆盖/追加）需求未定义，暂只落动作码，不写表单契约。
5. 角色主数据所属模块未在需求/设计中声明；若已有权限模块，请提供模块 key，后续把 `account.角色` 改为跨模块引用。
