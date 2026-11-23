# 页面对照表（MOD-001）

<!-- adw:ui-check:skeleton hash:fc89c6903321f7e72049cc2153d7d0921e04af6f55ead403a7609756b9306ed8 -->

> 工作台生成（软门禁）：实现前先填写对照表，再写代码；未填写不阻断，但完成汇报需标记“流程未完成”。
> 设计事实：`docs/design/MOD-001/design.json` 与 `docs/design/template/` 蓝图；契约页（无蓝图）读 `contracts/<page>.json` 按契约实现。
> PNG 是模板风格截图（无显式契约的旧设计为线框）。

## 实现前

路由：`/goods` → `frontend/src/views/goods/GoodsList.vue`；新增/编辑弹窗由列表页内打开（`GoodsForm.vue`，不单独占路由）。

| 设计页 | 类型/来源 | 蓝图 | 契约 | 字段/列 | 操作 | 布局/交互 | 差异/决策 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `goods-list` 商品列表 | reference ← afcenter-app-templates-v1/operations-management/list | docs/design/template/goods-hub/pages/goods-list.vue | docs/design/MOD-001/design.json 的 `pages[goods-list]`（无独立契约 JSON） | 列：code、name、category、status、price、stock；筛选：name、status | 行：edit、delete；工具栏：create；勾选：批量删除（需求要求批量操作） | recipe=list；保留蓝图“页头 + 左侧概况栏 + 右侧明细”两栏布局；QueryPanel 查询、BusinessListPage 表格区、RowActions 行操作、ThreePartPagination 每页 20 | 蓝图检索在左栏、导出按钮不在契约中：检索改为表格上方 QueryPanel，移除导出；design.json 未列 batchActions，按需求补模板默认批量删除；保留蓝图的概况/关注栏与序号列；编码列不重复做编辑入口（编辑仍走行操作） |
| `goods-form` 商品新增/编辑 | contract | 无（契约页，按契约实现） | docs/design/template/goods-hub/contracts/goods-form.json | code、name、category、status；price、stock；owner、remark（共 8 字段） | 取消、保存（`pm-form-dialog` 默认底部） | recipe=dialog-form；弹窗 2 列、宽度 `min(800px, 100vw - 32px)`；分组=基本信息、价格与库存、补充说明 | 字段控件按 contract.components：category/status→pm-select，price/stock→pm-number，owner→pm-select-user，remark→pm-textarea，code/name 用 pm-input；备注按多行文本规则 `pt-field-full` 跨整行；编码做唯一性校验（契约 code.unique） |

## 实现后

| 设计页 | 实现文件 | 截图 | 一致项 | 差异 | 原因/处理 |
| --- | --- | --- | --- | --- | --- |
| `goods-list` 商品列表 | `frontend/src/views/goods/GoodsList.vue`（路由 `/goods`；MF 暴露 `./goods-list`） | 未截图（本轮未启动 dev server） | 页头标题 + 新增、左侧“商品概况/今日关注”栏、右侧台账两栏结构；列 code/name/category/status/price/stock（+序号、勾选、操作）；筛选 name/status；行 edit/delete；工具栏 create；three-part 每页 20；状态标签；勾选批量删除；删除末页回退、翻页/筛选清空选择 | 检索从左侧栏移到表格上方 QueryPanel；蓝图“导出台账”未实现；新增按钮只放页头；批量删除按钮由 BusinessListPage 默认批量区提供 | 契约 toolbarActions 仅 create，导出不在契约内；QueryPanel 适配 name/status 两字段并复用 PageTemplates；需求要求“批量操作/批量选择”，design.json 未列 batchActions，按模板默认补批量删除 |
| `goods-form` 商品新增/编辑 | `frontend/src/views/goods/GoodsForm.vue`（由列表页 `v-model:dialog-visible` 打开，无独立路由） | 未截图（本轮未启动 dev server） | `pm-form-dialog` + `FormSection`；dialog 2 列、宽度 `min(800px, calc(100vw - 32px))`；3 组（基本信息 / 价格与库存 / 补充说明）；8 字段齐全；控件映射 category/status→`pm-select`、price/stock→`pm-number`、owner→`pm-select-user`、remark→`pm-textarea`、code/name→`pm-input`；code/name 必填、code 唯一校验；备注跨整行 | 表单未做独立路由页；owner 以演示值同时作为 id/name 回显（`selected`），未接宿主用户服务验证真实选中 | 契约 presentation=dialog，弹窗即页面入口；无真实接口，负责人回显依赖宿主能力，列入待确认 |

## 未实现/待确认

- 商品管理 的页面/交互如有未实现项，在这里逐条列出并说明原因。
- 未接真实后端：列表 24 条为明确演示数据，新增/编辑/删除仅改内存；接口接入后替换 `rows` 与保存/删除逻辑。
- 批量删除：需求写“批量操作/批量选择”，`design.json` 的 `pages[goods-list]` 未列 `batchActions`；本轮按需求与模板默认能力提供批量删除，待设计确认是否补进契约。
- 负责人 `pm-select-user` 依赖宿主用户服务；演示态用 owner 姓名同时作为 id/name 回显（`selected`），真实环境需替换为宿主查询到的用户对象，本轮无法验证真实选中/回显。
- 本轮未执行 `npm install` / `npm run build` / dev server，未做浏览器截图与交互实测；仅做 `node --check`、模板标签配对与一致性 CLI 静态自查。
- `pm-table` 的列与行状态沿用蓝图 `columns` + 具名插槽；`GlobalPreference.tableConfig`（stripe/border）未显式透传，保持蓝图表格外观。
- 交互决策：新增保存后清空筛选回到第一页（避免新记录被筛选隐藏）；编辑保存保留当前筛选与页码。
