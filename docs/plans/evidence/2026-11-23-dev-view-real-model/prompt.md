【打磨批5-B 开发实现】请按设计产物实现「商品管理」模块（MOD-001）的前端页面。

步骤（不要跳步）：
1) 先读：AGENTS.md、docs/design/design-system.json、docs/design/MOD-001/design.json、
   docs/design/template/goods-hub/ 下的 reference 蓝图（pages/goods-list.vue）、契约文件（contracts/goods-form.json）、
   structure.css、styles/shared.css 与 styles/data-cyan/style.css、docs/design/MOD-001/ui-check.md。
2) 实现前先增量填写 docs/design/MOD-001/ui-check.md 的「实现前」表（不要删除/覆盖骨架，按页面/路由/蓝图/字段列/操作/布局补）。
3) 在 frontend/src/views/ 下新建页面（建议按业务目录组织）：
   - 列表页：参照 reference 蓝图布局，用 frontend/src/components/PageTemplates/ 的实际导出（ListPage/QueryPanel/RowActions/ThreePartPagination 等）
     组合，表格用 pm-table（或蓝图中的 el-table），el-table 统一 v-auto-height；列/查询/行操作/工具栏/分页来自 design.json 契约；
     删除末页回退、选择清理按蓝图习惯处理；数据用明确标注的演示数据。
   - 新增/编辑弹窗：契约页无蓝图，按 contracts/goods-form.json + design.json 的 form（dialog 2 列 800px、3 个 groups）用 pm-form-dialog + FormSection 实现，
     字段控件按 contract.components（pm-select / pm-number / pm-select-user / pm-textarea）。
4) 统一从 frontend/src/preferences/GlobalPreference.js 读取偏好（页面 computed 合并，不改全局单例）；
   视觉风格类使用 visual-style-data-cyan（宿主提供），不要复制受管样式；不要自造 UI 替代 PageTemplates/pm-*。
5) 在 frontend/src/router/index.js 注册路由（列表页与弹窗入口，弹窗可用列表页内打开或独立路由），并说明挂载方式。
6) 完成后在应用根目录运行自检：
   node .opencode/skills/adw-frontend-implementation/scripts/check-fidelity.mjs --app . --module MOD-001
   把 13 项 pass/warn/fail 结果（尤其 fail/warn 的真实原因）写进回复；再把「实现后」表补进 ui-check.md。

边界：
- 不改 .opencode/skills/**、.opencode/commands/**、docs/design/design-system.json、docs/design/template/**、tokens.json、prototypes/**；
- 不执行任何 git 操作；不启动真实环境；不启停工作台；
- 本轮不执行 npm install / npm run build / 不启动 dev server（子工程依赖未安装；用 node --check 或一致性 CLI 做静态自查）；
- 缺组件/契约矛盾先报告，不自造替代实现。

完成汇报用中文：实现文件与路由、每页蓝图/契约对照（一致/差异）、使用的 PageTemplates/pm-*/GlobalPreference、
ui-check 是否已填、自检结果、未实现与未验证项、待确认项。
