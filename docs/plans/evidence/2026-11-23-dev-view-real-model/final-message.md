## 实现摘要

已按 `design.json` 契约、`goods-list.vue` 参考蓝图与 `goods-form.json` 契约实现 MOD-001 商品管理前端：

- 列表页：蓝图两栏台账结构（页头 + 左侧概况/关注 + 右侧检索/明细），组合 `BusinessListPage`（ListPage 实际导出名）、`QueryPanel`、`RowActions`、`ThreePartPagination`，表格沿用蓝图的 `pm-table`。
- 新增/编辑：`pm-form-dialog` + `FormSection`，dialog 双列、宽度 `min(800px, calc(100vw - 32px))`，三个分组与 8 个字段按契约落位。
- 偏好：两页均从 `GlobalPreference` 读取，页面 `computed` 合并 `list.paginationLayout=three-part`、`form.columns=2`，未修改全局单例。
- 交互：筛选/重置回第一页；翻页、筛选、删除后清空选择；删除末页自动回退；批量删除带二次确认；商品编码必填 + 唯一校验。

## 新增与修改文件

| 文件 | 内容 |
| --- | --- |
| `frontend/src/views/goods/GoodsList.vue` | 商品列表页（24 条标注演示数据，每页 20 条） |
| `frontend/src/views/goods/GoodsForm.vue` | 商品新增/编辑弹窗组件（由列表页打开） |
| `frontend/src/router/index.js` | 注册 `/goods`（name `goods-list`） |
| `frontend/build/mfp.config.js` | 追加 MF 暴露 `./goods-list` |
| `frontend/README.md` | 同步暴露入口与路由目录说明 |
| `docs/design/MOD-001/ui-check.md` | 增量填写「实现前」「实现后」与未实现/待确认 |

路由与挂载：`/#/goods` 打开列表；新增/编辑弹窗在列表内通过 `v-model:dialog-visible` 打开，不单独占路由；宿主菜单也可直接挂载 MF 暴露的 `./goods-list`。

## 页面与蓝图/契约对照

### 商品列表（`goods-list`，reference 蓝图）

一致项：页头标题与新增按钮、左侧“商品概况/今日关注”、右侧台账面板与标题区、`pm-table` 勾选/序号、列 `code/name/category/status/price/stock`、筛选 `name/status`、行 `edit/delete`、工具栏 `create`、three-part 分页每页 20、状态标签、批量选择与删除、删除末页回退、翻页/筛选清空选择。

差异与处理：
- 蓝图检索在左侧栏并带“导出台账”；契约工具栏仅 `create`，故移除导出，检索改为表格上方 `QueryPanel`（仍保留左侧概况/关注栏）。
- `design.json` 有 `selection: multiple` 但未列 `batchActions`；需求明确“批量操作/批量选择”，按模板默认能力补了批量删除，待设计确认是否补进契约。
- 保留蓝图序号列（辅助列）；编码列不重复做编辑入口，编辑仍走行操作。

### 商品新增/编辑（`goods-form`，契约页，无蓝图）

一致项：`pm-form-dialog` + `FormSection`；2 列、800px；分组“基本信息 / 价格与库存 / 补充说明”；字段与控件映射 `category/status→pm-select`、`price/stock→pm-number`、`owner→pm-select-user`、`remark→pm-textarea`、`code/name→pm-input`；备注 `pt-field-full` 跨整行；`code/name` 必填、`code` 唯一校验。

差异：弹窗组件由列表打开，无独立路由（契约即为 dialog）；`owner` 用演示值同时作为 id/name 回显，真实用户服务回显未验证。

## 使用的 PageTemplates / pm-* / GlobalPreference

- PageTemplates：`BusinessListPage`、`QueryPanel`、`RowActions`、`ThreePartPagination`、`FormSection`、`resolvePagePreferences`
- pm-*：`pm-toolbar`、`pm-toolbar-item`、`pm-select`、`pm-table`、`pm-form-dialog`、`pm-input`、`pm-number`、`pm-select-user`、`pm-textarea`
- GlobalPreference：`views/goods/GoodsList.vue`、`views/goods/GoodsForm.vue` 均引用并在页面 computed 合并

## ui-check

已增量填写，未删除骨架与 marker：`docs/design/MOD-001/ui-check.md` 的「实现前」「实现后」和「未实现/待确认」均已补全。

## 自检结果（check-fidelity，13 项）

总体：通过 12 · 警告 1 · 失败 0。

| 项 | 状态 | 证据/真实原因 |
| --- | --- | --- |
| 应用设计系统 | pass | goods-hub v1.0.0 · data-cyan · 2 页蓝图 |
| 页面契约 | pass | 2 页均含 recipe 与 blueprint/catalogRef/契约文件 |
| 蓝图文件 | pass | 蓝图存在；另 1 个契约页（无蓝图） |
| 实现视图/路由 | pass | 视图匹配 2/2；路由 2 条；goods-list→GoodsList.vue、goods-form→GoodsForm.vue |
| PageTemplates | pass | 已导入 FormSection、BusinessListPage、QueryPanel、RowActions、ThreePartPagination |
| pm-* 组件 | pass | 9 个（pm-form-dialog、pm-table、pm-select 等） |
| 表单弹窗/FormSection | pass | 表单页使用 pm-form-dialog/FormSection |
| 列表 v-auto-height | pass | 列表页使用 v-auto-height |
| GlobalPreference | pass | 已引用 GlobalPreference |
| 结构/风格导入 | pass | 两个视图含 `visual-style-data-cyan` |
| 模板契约页 | pass | 契约文件存在、recipe 一致 |
| ui-check 对照表 | pass | MOD-001 已填 |
| PNG 原型 | warn | `MOD-001: 未导出`；本模块无 `prototypes/_manifest.json`/PNG，属产物缺失，不是代码缺陷 |

另外做了静态自查：`router/index.js`、`mfp.config.js` 通过 `node --check`；两个 `.vue` 的 `<script setup>` 抽出后语法检查通过；模板标签配对检查通过（自定义简单脚本，非完整 Vue 编译）。

## 未实现 / 未验证 / 待确认

- 未接真实后端：24 条商品为明确演示数据，新增/编辑/删除仅改内存。
- 本轮按要求未执行 `npm install`、`npm run build`、未启动 dev server，因此没有浏览器截图与实际交互验证；不能声称“视觉已还原”。
- `pm-select-user` 依赖宿主用户服务；演示态用姓名兼作 id/name 回显，真实选中/回显未验证。
- `pm-table + v-auto-height`、`pm-form-dialog` 的 `width` 与 `@submit` 行为沿用蓝图用法，未在运行环境验证。
- 待确认：批量删除是否正式补入 `design.json` 的 `batchActions`；检索位置由左栏改为表格上方是否符合预期；序号列是否保留。
- 需求与设计无硬冲突，仅存在上述 `batchActions` 缺口，已按“需求 > design.json”处理并记录。
