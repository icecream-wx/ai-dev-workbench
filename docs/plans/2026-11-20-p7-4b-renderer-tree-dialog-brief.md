# P7-4b 实施单：线框渲染器消费页面契约（树 / 弹窗 / 分页 / 操作 / 控件）（2026-11-20）

> 上游：P7-4a 页面契约（schema/adapter/类型已就绪）、P7 设计稿 §5.3/§6、`2026-11-19-p7-4a-design-contract-brief.md`。
> 本轮只做 **P7-4b**：让设计视图线框渲染器真正消费 `design.json` 页面契约（`recipe/tree/form/pagination/selection/rowActions/toolbarActions/components/subTables`），补树/弹窗/分页/操作视觉。
> **不做**：P7-7 自定义模板 builder；后端 schema/API/DB 变更；需求模板中心；开发视图/一致性检查逻辑；真实宿主/EOS。
> 不改旧 design.json 的既有视觉；不改 PNG 导出语义；不启停真实 3300；不读写真实 `data/`、`projects/`、`.env`；不做 git；不调真实模型。

---

## 0. 出口标准

1. 设计视图原型 Tab 能显示：
   - **树列表**：`recipe=tree-list` 或存在 `tree` → 左侧树面板 + 右侧表格；`tree.selectionStyle`（`platform|dot|background`）与 `tree.actionStyle`（`header|footer|none`）有可见差异；`titleField/parentField` 用于节点文案与层级。
   - **弹窗表单**：`form.presentation=dialog` 或 `recipe=dialog-form` → 列表背景占位 + 居中弹窗表单；`form.width` 生效（clamp 360–900）；`form.columns=1` 单列 / `2` 双列；`form.groups` 分组生效。
   - **分页**：`pagination.layout = bar|split|three-part` 三种可见形态（three-part = 已选/页码/每页条数）。
   - **多选**：`selection=true` 显示勾选列与批量操作条；`selection=false` 隐藏；缺省保持现状。
   - **行/工具栏操作**：`rowActions`/`toolbarActions` 按动作码渲染（`actionLabel` 转中文，未知码原样）；缺省保持现状（详情/编辑/删除、新增+批量删除/导入/导出）。
   - **组件映射**：`components` 的 `pm-*` 映射到线框控件（`pm-input/textarea/number/switch/datepicker/select/select-user/select-org/select-tree/radio/checkbox/upload/image`；未知回退推断）。
   - **子表**：`subTables.mode=tab` 用页签；`flow`/缺省保持堆叠。
2. 旧 design.json（无契约字段）视觉与断言不变：`e2e:p3` 保持 **126**，`e2e:p2` 116、`e2e:p4` 128 不变。
3. PNG 导出仍正常（树页与弹窗页各导出一次），文件名/尺寸校验通过。
4. 新增前端单测覆盖纯函数；新增独立 `e2e:p7-4b`（临时目录/端口，stub opencode，不调模型）。
5. 文档同步：P7 设计稿/STATUS/README/AGENTS/plans/README/report 状态与命令更新；报告 HTML/PDF 重新生成。

---

## 1. 现状与差距（已核对代码，2026-11-20）

| 位置 | 现状 | 差距 |
| --- | --- | --- |
| `frontend/src/design/design-adapter.js` | 已映射 `layout.pagination/selection/rowActions/toolbarActions/form/tree/subTables/components`，`table.searchFields=filters`、`pageSize` | `form.groups` 未映射到 `layout.groups`，现有 `fieldGroups()` 读不到 |
| `frontend/src/design/PrototypeCanvas.vue` | `toPageLayout()` 只复制 `table/toolbar/detail/stats/charts/groupMode`；`specPage` 不带 `recipe` | **契约字段在进入 `PrototypeRenderer` 前被丢弃**（本轮核心接线点） |
| `frontend/src/design/prototype/layout.ts` | `controlOf()` 只看 `fieldOverrides` + 推断；`fieldGroups()` 读 `layout.groups` | 不消费 `layout.components`；无 `form.columns` 单列规则；无树/分页模型 |
| `frontend/src/design/prototype/WireframeTable.vue` | 勾选列/批量提示固定；行操作固定 详情/编辑/删除；工具栏用 `layout.toolbar.actions`；分页固定单行 | 不消费 `selection/rowActions/toolbarActions/pagination.layout/tree` |
| `frontend/src/design/prototype/WireframeForm.vue` | 只支持页面内表单；`groups` 来自 `layout.groups`；无弹窗；`columns/width` 不消费 | 不消费 `form.presentation/columns/width/groups`、`components`、`subTables.mode` |
| `frontend/src/design/prototype/spec-types.ts`、`design/types.ts` | P7-4a 已补可选字段类型 | 类型可直接用，无需改 schema |
| `frontend/src/design/prototype/wireframe.css` | 有线框基础样式 | 缺树面板、弹窗、批量条、三段分页、子表页签样式 |

---

## 2. 契约 → 渲染映射（缺省必须等于旧行为）

| design.json | 渲染行为 | 缺省（无字段） |
| --- | --- | --- |
| `selection` | `true`：勾选列 + 选中行高亮 + 批量条；`false`：无勾选列、无批量条 | 显示（保持现状） |
| `rowActions` | 行内按钮（`actionLabel`）；`detail` 触发导航，其他 `notify` | 详情 / 编辑 / 删除（现状规则） |
| `toolbarActions` | 工具栏按钮；`create` 为主按钮；`batchDelete` 等批量动作仅在有选择时于批量条出现 | 现状（`layout.toolbar.actions` / 页面 actions / 默认组合） |
| `pagination.layout` | `bar`=现状单行；`split`=左统计右分页；`three-part`=左已选/中页码/右每页条数+总数 | `bar`（现状） |
| `pagination.pageSize` | 行数与“N 条/页” | `tablePageSize` 10 |
| `tree`（或 `recipe=tree-list`） | 左树右表；节点层级用 `titleField/parentField`；选中样式按 `selectionStyle`；树头/脚动作按 `actionStyle` | 无树（现状） |
| `form.presentation` | `dialog`：背景占位 + 居中弹窗；`page`：现状 | 现状 |
| `form.columns` | `1`：字段独占整行；`2`：现状双列 | 现状 |
| `form.width` | 弹窗宽度 px（clamp 360–900） | 560 |
| `form.groups` | 分组卡片（title + fields）；未分组字段兜底 | 无分组（现状） |
| `components` | 字段 → 控件（优先级：`fieldOverrides.control` > `components` > 类型/命名推断） | 推断（现状） |
| `subTables.mode` | `tab`：多子表页签；`flow`/缺省：堆叠 | 堆叠（现状） |

动作码 → 中文统一用 `layout.ts#actionLabel`；新增未知码原样显示。`tree.actionStyle=none` 不显示树动作；`header` 在树标题行，`footer` 在树底部。

---

## 3. 实施拆分（同一会话按序做，每批先自测）

### 3.1 第一批：纯函数 + 接线（不碰视觉）

1. 新增 `frontend/src/design/prototype/contract-view.js`（纯 JS，便于 `node --test`）：
   - `controlFromComponent(name)`：`pm-*` → `ControlType | undefined`（映射表见 §2）。
   - `resolveSelection(layout)`：`layout?.selection === false ? false : true`。
   - `resolveRowActions(page, layout)`：`layout.rowActions` 优先；否则按现状规则（`detail` + `edit`/`delete` 依 `page.actions`）。
   - `resolveToolbarActions(page, layout)`：`layout.toolbarActions` 优先；否则沿用 `layout.toolbar.actions` / `page.actions` / 默认 `['batchDelete','import','export']`，过滤非工具栏动作。
   - `paginationModel(layout, { total, selectedCount, pageSize })`：返回 `{ layout, total, selectedCount, pageSize }`，非法/缺省落 `bar`。
   - `treeModel(rows, tree, { titleField, maxNodes })`：确定性节点列表（`parentField` 能匹配则嵌套，否则首行作根、其余作子节点；最多 12 个节点）；返回 `{ title, nodes:[{label, depth}], actionStyle, selectionStyle }`。
   - `formView(layout, page)`：`{ dialog, columns, width, groups }`；`dialog` 判定 `form.presentation==='dialog' || recipe==='dialog-form'`；width clamp 360–900，缺省 560。
   - `subTableView(layout)`：`{ tabs, flow }`（`mode==='tab'` 且有多个 → tabs，否则 flow）。
   - `fieldSpanWithColumns(field, layout)`：`form.columns===1` → 24，否则沿用 `fieldSpan`。
2. `layout.ts#controlOf`：`fieldOverrides.control` → `controlFromComponent(layout.components?.[field.name])` → 推断。
3. `design-adapter.js`：`form.groups` → `layout.groups`（仅在 `form.groups` 存在时写入，缺省不产生该键）；不改变其它输出。
4. `PrototypeCanvas.vue`：
   - `toPageLayout()` 透传 `pagination/selection/rowActions/toolbarActions/form/tree/subTables/components/groupMode`（浅拷贝/数组复制）。
   - `specPage` 透传 `recipe`、`selection`、`components`（`spec.fields/actions` 逻辑不变）。
5. 前端单测：
   - 新增 `frontend/src/design/prototype/contract-view.test.mjs`（≥10 例：控件映射/缺省、selection、行/工具栏、三种分页、树节点/嵌套回退、弹窗/列数/宽度 clamp、子表页签）。
   - `design-adapter.test.mjs` +2：`form.groups` → `layout.groups`；无 `form.groups` 时旧输出不变（无 `groups` 键）。
   - `frontend/package.json` 的 `test` 列表加新测试文件。
6. 自测：`npm test --prefix frontend`、`npm run typecheck --prefix frontend`、`npm run check:vue --prefix frontend`。

### 3.2 第二批：列表页视觉（树 / 分页 / 选择 / 操作）

1. `WireframeTable.vue`（桌面）：
   - 选择列与批量条由 `resolveSelection` 控制；批量条显示“已选 N 项”+ 批量动作（`batchDelete` 等），未选中不显示。
   - 行操作由 `resolveRowActions` 渲染（`data-testid="wf-row-actions"`），点击 `detail` 走 `nav`，其余 `notify`。
   - 工具栏由 `resolveToolbarActions` 渲染；`create` 保持主按钮并 `nav('create')`。
   - 分页按 `paginationModel` 渲染三形态；保留 `data-wf-anchor="pager"`；three-part 显示“已选/页码/每页 N 条·共 M 条”。
   - 树：`treeModel` 非空时，页面改为 `wf-split`（左 `wf-tree` + 右原内容）；树标题、搜索占位、节点（选中样式类）、`actionStyle` 头/脚动作；加 `data-wf-anchor="tree"` 与 `data-testid="wf-tree"`/`wf-tree-node`；点击节点仅切换高亮（**不改变表格数据**，保证 PNG 稳定）。
   - 移动端（`mobile`）不渲染树；选择/分页保持现状，避免破坏手机线框。
2. `PrototypeRenderer.vue`：无需改结构；确认 `WireframeTable` 接收新 layout 正常。
3. `wireframe.css`：树面板/节点（`platform`/`dot`/`background`）、批量条、三段分页、`wf-split` 样式；保持现有线框风格（灰阶/描边，不引入 Element Plus）。
4. 自测：`npm run build --prefix frontend`（含 preview 入口）、`typecheck`、`check:vue`；手写页面检查旧设计不变。

### 3.3 第三批：表单弹窗 / 控件 / 子表

1. `WireframeForm.vue`：
   - `formView()`：
     - `dialog=true`：外层 `wf-dialog-demo`（背景假列表：搜索条 + 4 行骨架），内层 `wf-dialog`（宽度 inline style，`data-testid="wf-dialog"`），标题=页面标题，底部 取消/提交。
     - `dialog=false`：现有结构不变。
   - 字段 span 用 `fieldSpanWithColumns`（`form.columns=1` 全宽）。
   - `groups` 继续用 `layout.groups`（adapter 已映射 `form.groups`）；未分组兜底不变。
   - `components` 通过 `controlOf` 自动生效（`FieldControl` 无需改）。
   - 子表：`subTableView` → `tab` 形态渲染 `wf-subtabs`（页签切换），`flow` 保持堆叠；锚点 `subtable:<i>` 保留。
   - 移动端：不做弹窗（保持现有整页表单），避免手机线框变形。
2. `wireframe.css`：弹窗遮罩/卡片/背景骨架、单列表单、子表页签。
3. PNG 导出：确认弹窗在 `prototype-paper` 内，不被裁剪；`data-wf-anchor` 不遮挡钉标层。
4. 自测：构建 + 手动切页检查弹窗页/列表页/旧页面。

### 3.4 第四批：e2e + 文档

1. 新增 `backend/scripts/renderer-e2e.ts` + `backend/package.json` script `e2e:p7-4b`：
   - 复用 `p2-e2e-harness.ts`（`P2_ROOT` 临时目录、`P2_PORT=3444`、`P2_APP_ID=p7-4b-e2e`、`P2_DESIGN_SYSTEM` 企业级/平台蓝白；stub opencode）。
   - 启动后写 `docs/design/MOD-001/design.json` 契约 fixture（见 §4），等设计视图刷新。
   - 断言（建议 ≥22 条）：
     - 原型 Tab 两页 chips；树页显示左侧树（`wf-tree`）与表格；节点选中样式类（`dot`）；树头动作存在。
     - 三段落分页可见“条/页”“共”；选择勾选后批量条出现（`wf-batch-bar`）；行操作含“停用”（`disable`）。
     - 弹窗页显示 `wf-dialog`、标题、两个分组标题、宽度≈720（inline style）、`pm-switch` 映射为开关、`pm-select-user` 映射为人员选择图标/占位。
     - 子表页签（若 fixture 含两个子表）可见。
     - 树页与弹窗页各导出一次 PNG（下载触发、文件名含页面 id）。
     - 0 console error / 0 pageerror / 0 请求失败 / 0 外部请求。
   - 结束清理临时后端/进程与端口；不碰 3300/4771。
2. 回归（同一轮实跑并记录）：
   - `npm test --prefix backend`（132，应不变）
   - `npm test --prefix frontend`（85 + 新增）
   - `npm run build/typecheck/check:vue --prefix frontend`
   - `npm run e2e:p3 --prefix backend`（**126 不变**；旧 design.json 视觉回归）
   - `npm run e2e:p7-4b --prefix backend`（新）
   - `npm run e2e:preview` 77、`e2e:p7-3b` 45、`e2e:p7-6a` 15（保持）
   - `npm run e2e:p2/p4`（116/128 保持；如时间不足至少 p4）
3. 文档同步：
   - P7 设计稿新增「§25 P7-4b 实施记录」（结果/测试/偏差/未验证）；状态行更新。
   - `docs/STATUS.md` 新增 P7-4b 节；把“P7-4b 未做”全部改为“P7-4b 已实施（待评审）”；「下一步」只剩 P7-7 与真实 3300。
   - `README.md` 状态行、开发命令加 `e2e:p7-4b`。
   - `AGENTS.md`：P7-4b 改为已实施；删除“（P7-4b 渲染器尚未消费全部字段）”，改为“渲染器已消费树/弹窗/分页/操作/控件映射（P7-4b）”。
   - `docs/plans/README.md` 增加本实施单条目与状态。
   - `docs/report/ai-dev-workbench-overview.md`：§1.1 设计模板行补“原型渲染器消费契约（P7-4b）”；§3.2 末补一段渲染器映射；§8 删“P7-4b 未实施”；§10 加 `e2e:p7-4b` 数字；`docs/report/README.md` 内容原则补一行。重新 `npm run build:report --prefix backend`（**不需要重截截图**；在偏差里写明截图仍是 P7-A 版本）。
   - 本实施单末尾追加「实施结果（2026-11-20）」。

---

## 4. e2e fixture（写入临时应用 `docs/design/MOD-001/design.json`）

```jsonc
{
  "module": "MOD-001", "title": "组织与人员",
  "designSystem": { "pack": "afcenter-app-templates-v1", "applicationType": "enterprise-application-platform", "style": "platform-blue" },
  "entities": [
    { "id": "org", "name": "机构", "fields": [
      { "name": "机构名称", "label": "机构名称", "type": "string", "required": true },
      { "name": "机构编码", "label": "机构编码", "type": "string", "unique": true },
      { "name": "上级机构", "label": "上级机构", "type": "string" },
      { "name": "负责人", "label": "负责人", "type": "string" },
      { "name": "状态", "label": "状态", "type": "enum", "options": ["启用", "停用"] },
      { "name": "排序号", "label": "排序号", "type": "number" }
    ]},
    { "id": "employee", "name": "员工", "fields": [
      { "name": "员工姓名", "label": "员工姓名", "type": "string" },
      { "name": "所属机构", "label": "所属机构", "type": "ref" },
      { "name": "在职状态", "label": "在职状态", "type": "enum", "options": ["在职", "离职"] }
    ]}
  ],
  "relations": [
    { "from": "org", "to": "org", "type": "1:N", "label": "下级机构" },
    { "from": "employee", "to": "org", "type": "N:1", "label": "所属机构" }
  ],
  "pages": [
    { "id": "org-list", "name": "组织与人员", "type": "list", "entity": "org",
      "recipe": "tree-list", "catalogRef": "enterprise-application-platform/organization",
      "blueprint": "application-types/enterprise-application-platform/pages/OrganizationUsers.vue",
      "filters": ["机构名称", "机构编码", "状态"],
      "columns": ["机构名称", "机构编码", "上级机构", "负责人", "状态"],
      "rowActions": ["detail", "edit", "disable"],
      "toolbarActions": ["create", "import", "batchDelete"],
      "selection": true,
      "pagination": { "layout": "three-part", "pageSize": 5 },
      "tree": { "titleField": "机构名称", "parentField": "上级机构", "actionStyle": "header", "selectionStyle": "dot" },
      "components": { "状态": "pm-select" } },
    { "id": "org-form", "name": "新建/编辑机构", "type": "form", "entity": "org",
      "recipe": "dialog-form",
      "form": { "presentation": "dialog", "columns": 1, "width": 720,
        "fields": ["机构名称", "机构编码", "上级机构", "负责人", "状态", "排序号"],
        "groups": [
          { "title": "基本信息", "fields": ["机构名称", "机构编码", "上级机构"] },
          { "title": "其他信息", "fields": ["负责人", "状态", "排序号"] }
        ] },
      "components": { "状态": "pm-switch", "负责人": "pm-select-user" } }
  ]
}
```

- fixture 用 `org` 自关联做树；`employee` 只用于关系，不要求页面。
- 子表页签断言可选：若页面加 `subTables:[{entity:'employee',title:'员工',mode:'tab'},{entity:'org',title:'下级机构',mode:'tab'}]` 到 org-form，则断言页签；不做则删除该断言（不要为了凑数造假）。
- 页面标题/字段用固定值，断言不依赖随机 mock 值；树节点只断言存在与样式类。

---

## 5. 边界（硬约束）

- 只改：`frontend/src/design/**`、`frontend/package.json`（仅 test 列表）、`backend/scripts/renderer-e2e.ts` + `backend/package.json`（仅 e2e script）、`docs/**`、`README.md`、`AGENTS.md`。
- 不改：后端 `src/**`、DB/表/迁移、schema/validate/API、`templates/**`、需求模板中心、开发视图/一致性检查规则、预览 `preview.html` 业务。
- 不新增依赖；Playwright 复用根依赖。
- 旧 design.json 页面渲染必须与 P7-4a 前一致（p3 126 为硬回归）。
- 不做真实模型；不启停 3300/4771；不读写真实 `data/`、`projects/`、`.env`；不做 git。
- 临时实例只用临时目录与临时端口（3444/stub），结束清理并确认无监听。

---

## 6. 收尾与回报

- 在本文件末尾追加「实施结果（2026-11-20）」：改动清单、映射行为、单测/e2e 数字、截图/临时目录、偏差、未验证、环境确认。
- 回报结构：结果 → 验证命令与输出 → 偏差 → 未验证 → 环境确认。
- 如某一批做不完或出现阻断：停止并报告已完成部分与下一步，不要留下半套或被禁用的旧行为。

---

## 7. 实施结果（2026-11-20）

- **结果**：四批全部完成。新增 `contract-view.js`（+15 例单测）与接线；列表页树/三形态分页/批量条/行与工具栏动作；表单弹窗（720 宽/单列/分组/pm-switch/pm-select-user）与子表页签；新增 `e2e:p7-4b` 48 条断言。旧 design.json 视觉不变（`e2e:p3` 126）。
- **验证**：后端 **132**；前端 **102**（原 85 + 17）；`build/typecheck/check:vue` 通过；`e2e:p7-4b` **48**、`e2e:p3` **126**、`e2e:preview/p7-3b/p7-6a` **77/45/15**、`e2e:p2/p4` **116/128**；`build:report` 通过（尺寸/页数见 `docs/report/README.md`）。
- **偏差**：树/分页/批量仅线框演示；子表目标解析增加本模块实体池参数；未改后端 schema/API/DB/preview/需求模板中心；未新增依赖。
- **未验证**：真实模型生成树/弹窗页面的视觉、真实 AFCenter 宿主/EOS/3300、PNG 像素比对、<768 移动端树/弹窗。
- **环境**：临时目录 + 端口 3444（已关闭），stub opencode、未调模型；未启停真实 3300/4771；未读写真实 `data/`、`projects/`、`.env`；未做 git。
- 详细记录见 P7 设计稿第 25 节、`docs/STATUS.md`「P7-4b」节。

### 7.1 评审修正（2026-11-20）

- **three-part + selection=false**：新增 `pagerSelectionText(selectionEnabled, selectedCount, total)`；`selection=false` 时左统计显示“共 N 条”，不再出现“已选 0 项”；`selection=true/缺省`仍显示“已选 N 项”。
- **批量条动作**：`WireframeTable#batchActions` 改为始终从 `resolveToolbarActions(page, layout)` 过滤 `isBatchAction`，去掉硬编码 `['batchDelete']`；默认组合仍含 batchDelete，页面只声明 create/import 时批量条只显示“已选 N 项”，显式 toolbarActions 只显示其中 batch*。
- **测试**：`contract-view.test.mjs` +3 例（pagerSelectionText ×2、批量动作组合 ×1），前端 **102/102**；`e2e:p7-4b` **48**、`e2e:p3` **126** 不变；`typecheck/check:vue/build` 通过。
