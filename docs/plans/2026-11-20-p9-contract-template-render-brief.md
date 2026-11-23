# P9 实施单：设计产物模板原生真实渲染（Y2 一期）（2026-11-20）

> 用户决策（2026-11-20）：设计产物（`design.json`）必须与创建应用时选择的设计模板保持一致——**结构、组件、视觉都用模板**。
> 现状问题：设计视图「线框」用工作台自建 `wf-*` 线框（只借风格颜色）；「模板预览」iframe 展示的是模板自带页面（如运营组织台账），不是 `design.json`。
> 本单做 **Y2 一期**：新增“设计产物模板原生渲染器”，按 `design.json` 页面契约用模板结构类 + PageTemplates/pm-* + `structure.css`/`shared.css`/`style.css` 渲染；设计视图默认显示这个结果。覆盖 **list / tree-list / page-form / dialog-form**（正好覆盖 app1 四页）；其他配方回退线框。

---

## 0. 出口标准

1. 设计视图「原型」Tab：
   - 页面有**显式契约**（`recipe` 或 `catalogRef`）且配方属于支持集合时，**默认**通过新入口 `design-preview.html` iframe 渲染 **`design.json` 该页**（不是模板自带页面）；
   - 渲染根节点为模板结构：`optimized-suite` + `application-type-*` + `visual-style-<styleId>`，并注入所选应用类型的 `structure.css` 与 `shared.css`/`style.css`（与 `preview.html` 一致）；
   - 使用模板组件：`pm-search`、`pm-toolbar`、`pm-toolbar-item`、`pm-table`、`pm-pagination`、`pm-tree`、`pm-form-dialog`、`pm-input/pm-select/pm-number/pm-switch/pm-datepicker/pm-textarea` 等（按契约 `components` 覆盖）；
   - 结构类沿用模板：`template-stage`、`business-page`、`page-heading`、`panel`、`org-ledger-shell`/`org-tree-panel`（tree-list）等，视觉与模板一致；
   - 无显式契约 / 不支持的配方 → 回退 P7-4b 线框 + 提示“该配方暂未支持模板风格渲染”；
   - 保留「模板风格 / 线框」切换；模板风格为默认（支持时）。
2. 页面内容来自 `design.json`：标题、`filters`、`columns`、`rowActions`、`toolbarActions`、`selection`、`pagination`、`tree`、`form.groups/fields/columns/width/presentation`、`components`；数据为本地 mock（不连接平台/EOS）。
3. 模板中心/页面库仍展示模板自带页面（不变）；`preview.html` 与 `embed=1` 不变。
4. 新增 `e2e:p9`（临时目录/端口/stub），覆盖 tree-list/list/dialog-form、模板类名/pm 组件/风格主色、切换线框、无契约回退、0 console/pageerror/外部请求。
5. 回归：`e2e:p3` 126（无 recipe/catalogRef 的旧设计仍默认线框）、`e2e:p7-4b` 48（**每次切页后需再点“线框”**）、`e2e:preview` 83、`e2e:p7-3b` 38、`e2e:p2/p4` 116/128、后端 133、前端 111+。
6. `tokens.json`/`prototypes/*.png` 语义不变：**PNG 仍是线框草图**（自动导出走隐藏线框画布）。本期不做“真实产物 PNG 截图”。

---

## 1. 新入口 `design-preview.html`（iframe 专用）

- 新增 `frontend/design-preview.html` + `frontend/src/design-preview/main.ts`：
  - 与 `src/preview/main.ts` 相同：Element Plus（zh-cn）+ `registerPmV3` + `installPmMock`；
  - 挂载 `DesignPreviewApp.vue`；
  - `frontend/vite.config.ts` 增加多入口 `design-preview`。
- 新增 `backend/src/index.ts` 静态路由：`GET /design-preview.html`（同 `/preview.html`：缺失 404 + 提示，不回落 index）；`/assets/*` 已托管。
- URL 参数：`app`、`module`、`page`、`type`、`style`、`embed=1`、可选 `v`（designHash）。
- `DesignPreviewApp.vue`：
  - 读取参数；拉 `GET /api/apps/:id/artifacts`（同源），取 `designs[]` 中 `module` 对应项；
  - `adaptDesign(design)`（复用 `frontend/src/design/design-adapter.js`）得到 `pages/entities`；
  - 找 `page` id；取 `entity`；无设计/页面/实体 → 显示明确错误；
  - 按 `type` 注入 `structureLoaders[type]` 的 CSS；根节点加 `visual-style-<style>` + `application-type-<type>`（短类名如 `application-type-operations` 可选，至少 `application-type-<full-id>`）；
  - `embed=1` 隐藏预览角标；保留错误提示；
  - 页面切换（URL `page` 变化）只重渲染内容。
- 复用 `frontend/src/preview/registry.ts`（styles/structureLoaders/applicationTypes）；不复制 25 个页面组件。

## 2. 契约渲染器（核心）

新增 `frontend/src/design-preview/ContractPageApp.vue`（或 `contract/` 子目录）：

### 2.1 数据与通用

- 输入：适配后的 `page`（DesignPageRender）、`entity`（DesignEntity）、`layout`、`type`、`style`。
- 生成确定性 mock 行（不要 Math.random；按索引/字段类型/options 生成；金额/日期/枚举可读）。
- 列：`layout.table.columns`（或 page.spec.columns）→ `pm-table` 的 `columns` `[{ prop: 字段name, label, minWidth/width, scope? }]`；实体不存在的列**跳过**并记录提示（不渲染假列）。
- 查询：`layout.table.searchFields` / `filters` → `pm-search` + `pm-input/pm-select`（按字段类型）。
- 工具栏：`resolveToolbarActions`（可复用 `design/prototype/contract-view.js`）→ `pm-toolbar` + `pm-toolbar-item`；`create` 为主按钮。
- 行操作：`resolveRowActions` → 操作列（`pm-toolbar-item`/文本按钮），标签用 `actionLabel`。
- 选择：`resolveSelection`；`pm-table checked` 开启多选；批量条显示已选 + `batch*` 动作。
- 分页：`paginationModel` → `pm-pagination`（three-part 用 `layout`/总数/每页条数；若组件支持有限，用模板样式包一层）。
- 空/异常：无实体 → 模板 `panel` + 空态；不白屏。

### 2.2 配方

- **list**：`optimized-suite > template-stage > business-page > page-heading`（标题/描述/右侧工具栏）→ `panel`（`pm-search` + `pm-toolbar` + `pm-table` + `pm-pagination`）。
- **tree-list**：`business-page > org-ledger-shell`（或等价 `.panel` 两栏）：左 `org-tree-panel`（`pm-search` + `pm-tree`），右 `panel`（标题行 + `pm-toolbar` + `pm-search` + `pm-table` + `pm-pagination`）。
  - 树节点：有 `tree.parentField` 且值能匹配 → 嵌套；否则按 `titleField` 去重**扁平**展示，并在顶部小字提示“未配置 parentField，按扁平展示”（不阻断）；
  - `tree.actionStyle` header/footer/none、`selectionStyle` platform/dot/background 用模板样式类/变量体现。
- **page-form**：`page-heading` + `panel`，`form.groups` 分组 → 每组一个 `panel`/区块；字段控件按 `components`/类型；footer 提交/取消。
- **dialog-form**：页面背景用模板 `panel` 假列表（或用同页列表的精简版）+ `pm-form-dialog`（`dialogVisible=true`，`title=page.title`，`width=form.width` clamp 360–900）内渲染 `form` slot：`form.groups` + 字段控件；`columns=1/2` 控制栅格。
- 不在支持集合的配方（detail/dashboard/main-sub/wizard）→ 显示“该配方暂未支持模板风格渲染”并提示切到线框（父面板负责默认线框）。

### 2.3 控件映射

- 复用 `contract-view.js#controlFromComponent`，映射到 pm 组件：
  `input→pm-input`、`textarea→pm-textarea`、`number→pm-number`、`boolean→pm-switch`、`date/datetime→pm-datepicker`、`select/select-user/select-org/select-tree→pm-select*`、`radio→pm-radio`、`checkbox→pm-checkbox`、`upload→pm-upload`、`image→pm-image`。
- 未知 pm 组件/字段 → 推断；不抛错。

## 3. 设计视图接入（替换 P8-2 的模板页面 iframe）

- `frontend/src/workbench/DesignPrototypePanel.vue`：
  - props 增加 `appId`（DesignView 传 `props.appId`）；保留 `applicationType/styleId/templatePages`（模板页列表可不再用于 preview，但保留用于提示/页面库）。
  - 计算 `contractPage = Boolean(page.recipe || page.catalogRef)`；`supported = recipe ∈ ['list','tree-list','page-form','dialog-form']`（recipe 缺失时按 catalogRef 页面 recipe 或 page.type 推断：list→list、form→page-form）。
  - `previewSrc = /design-preview.html?app=&module=&page=&type=&style=&v=<designHash>&embed=1`（新纯函数 `buildDesignPreviewUrl`，可放 `design-template-helpers.js`）。
  - 默认 mode：`supported && contractPage` → `'template'`；否则 `'wireframe'`；切页/设计 hash 变化时重置。
  - 模式按钮文案：「模板风格」「线框」；testid 沿用 `prototype-mode-preview` / `prototype-mode-wireframe`（兼容 p7-4b 脚本）。
  - iframe `data-testid="prototype-preview-frame"`；线框模式仍 `PrototypeCanvas`。
  - 提示：模板模式“当前为设计产物模板风格预览（类型 · 风格）；PNG 仍是线框草图”；线框模式保留“未支持/无契约”提示。
  - PNG 导出仍仅线框模式；隐藏画布自动导出不变。
  - 删除 P8-2 的 `resolvePreviewTarget`（catalogRef 认领模板页面）与 `buildEmbedPreviewUrl` 相关逻辑；如保留纯函数，改为 `buildDesignPreviewUrl`。
- `DesignView.vue`：给 Panel 传 `app-id`；其余不变。
- `frontend/src/preview/PreviewApp.vue` 的 `embed` 支持保留（模板中心/design-preview 均可复用）。

## 4. 测试

### 4.1 单测（前端）

- `design-template-helpers.test.mjs`：
  - `buildDesignPreviewUrl`（app/module/page/type/style/v/embed）；
  - 默认模式判定（recipe/catalogRef/type 推断；不支持 → wireframe）。
- 契约渲染纯函数（可放 `design-preview/contract-mock.js`）：`mockRowsForEntity` 确定性、列/查询/操作/树节点生成；≥6 例。
- 如复用 `contract-view.js`，其现有测试保持。

### 4.2 `e2e:p9`（新）

- 新增 `backend/scripts/design-preview-e2e.ts` + `backend/package.json` `e2e:p9`：
  - harness（`P2_PORT=3446`、`P2_APP_ID=p9-e2e`、`P2_DESIGN_SYSTEM` = operations-management / data-cyan、stub）；
  - 写 `design.json`（app1 同构）：`product-list`（tree-list、tree titleField=商品分类、无 parentField）、`product-detail-list`（list）、`product-form`（dialog-form、groups、width 760）、`product-detail-form`（dialog-form）。
  - 断言（≥28）：
    - 原型默认 `prototype-preview-frame`，`src` 含 `design-preview.html`、`app`、`module`、`page`、`type=operations-management`、`style=data-cyan`、`embed=1`；
    - frame 内根节点含 `optimized-suite` + `visual-style-data-cyan` + `application-type-*`；含 `.page-heading`、`.panel`；`pm-search`/`pm-toolbar`/`pm-table` 存在；
    - 标题“商品列表”、列“商品编码/商品名称/销售单价/商品状态”可见；工具栏“新增”；树节点存在；
    - 主按钮 computed background 为 data-cyan 主色（rgb(20,95,186) 或等价）；
    - 点「线框」→ `prototype-paper` + `wf-page`（可导出）；
    - 切 `product-detail-list` → 无树、有表；
    - 切 `product-form` → `pm-form-dialog`/对话框容器 + 分组“基本信息/价格与库存” + 字段 + `pm-number`/`pm-select`；
    - 无 recipe 的页（可加一页）→ 默认线框 + 提示；
    - 0 console error / 0 pageerror / 0 请求失败 / 0 外部请求。
- 删除/替换 `e2e:p8-2`（模板页面 iframe 断言已过时）：删除 `backend/scripts/prototype-preview-e2e.ts` 与 `e2e:p8-2` script，或改为极简重定向断言；STATUS 记“p8-2 e2e 已被 p9 取代”。
- 调整 `e2e:p7-4b`：每次切页后（默认变成模板风格）先点 `[data-testid=prototype-mode-wireframe]` 再断言；断言数仍 48。
- `e2e:p3`：旧设计无 recipe/catalogRef → 默认线框；126 不变。
- `e2e:preview` 83、`p7-3b` 38、`p2/p4` 116/128 保持。

### 4.3 后端

- `smoke:workspace` 增加 `/design-preview.html` 200 + 缺失 404（若可模拟）；或最小只断言路由注册。
- 后端测试 133 保持（静态路由不改变 API）。

## 5. 文档

- `docs/STATUS.md` 新增 P9 节；「下一步」只剩 P7-7（自定义 builder）与真实宿主/EOS/PNG 像素比对。
- P7 设计稿新增「§28 P9 设计产物模板原生渲染」：契约→模板结构/组件映射、支持配方、回退、PNG 草图、Y2 二期（detail/dashboard、PNG 真实截图）。
- `README.md` / `AGENTS.md`：设计视图原型描述改为“`design.json` 用所选模板结构/组件渲染（list/tree-list/form/dialog-form）；其他配方回退线框；PNG 仍是草图”；去掉“真实预览只展示模板页面、不重绘 pm-v3”的旧表述。
- `docs/plans/README.md` 加本实施单。
- `docs/report/ai-dev-workbench-overview.md` + report README：设计视图/原型、e2e 数字；`build:report` 重跑（截图可暂不重截，注明）。
- 本实施单末尾追加「实施结果（2026-11-20）」。

## 6. 边界

- 只改：`frontend/src/design-preview/**`、`frontend/src/preview/**`（embed/复用）、`frontend/src/workbench/**`、`frontend/src/design/**`（复用）、`frontend/design-preview.html`、`frontend/vite.config.ts`、`backend/src/index.ts`（仅静态路由）、`backend/scripts/**`、`backend/package.json`、`docs/**`、`README.md`、`AGENTS.md`。
- 不改：DB/表、API 语义（artifacts 已有）、`templates/design-system/**`（只读）、`templates/afc-remote/**`、需求模板中心、模板中心/`preview.html` 业务（embed 保留）。
- 不新增依赖；不 npm install；不做 git；不启停真实 3300；不读写真实 `data/`/`projects/`/`.env`；不调真实模型；e2e 用临时目录/端口（3446/stub），结束清理。
- 真实 3300 当前为 P8-1 后端 + P8-2 前端（静态托管即时生效）；**本单完成后前端改动由静态托管即时生效，后端只新增静态路由，需用户自行决定是否重启**；不要自动重启。

## 7. 收尾与回报

- 结果 → 验证命令与数字（后端 133、前端 111+、`e2e:p9` 新增、`p7-4b` 48、`p3` 126、`preview` 83、`p7-3b` 38、`p2/p4` 116/128、`build:report`）→ 偏差 → 未验证 → 环境确认。
- 明确写清：本期真实渲染覆盖 list/tree-list/page-form/dialog-form；detail/dashboard/main-sub 仍回退线框；PNG 仍是线框草图。

---

## 实施结果（2026-11-20）

### 结果

- `design.json` 现在**用创建应用时选择的设计模板**（应用类型 structure + 视觉风格）原生渲染：新入口 `frontend/design-preview.html`（`src/design-preview/{main.ts,DesignPreviewApp.vue,ContractPage.vue,ContractFormFields.vue,FieldControl.vue,ContractSearch.vue,contract-preview.js}`）；后端 `GET /design-preview.html`（缺失 404、不回落 index）。
- 覆盖 **list / tree-list / page-form / dialog-form**（app1 四页）；detail / dashboard / main-sub / wizard 回退 P7-4b 线框并提示；**PNG 仍是线框草图**（自动导出不变，真实产物 PNG 未做）。
- P8-2 的“模板自带页面预览”已删除（`resolvePreviewTarget`/`buildEmbedPreviewUrl`、`prototype-preview-e2e.ts`、`e2e:p8-2`）。

### 关键实现

1. **入口 / 数据**：URL `?app=&module=&page=&type=&style=&embed=1&v=<designHash>`；同源 `GET /api/apps/:id/artifacts` → `adaptDesign` → 指定 page/entity；`GET /api/apps/:id/design-system` 只用于 catalogRef 配方推断（失败不阻断）；错误态明确、不白屏。
2. **模板原生**：根 `visual-style-host visual-style-<styleId>` + 内层 `optimized-suite application-type-<短类名>`（另带 `application-type-<full-id>`）；注入 `structureLoaders[type]` 的 `structure.css`，复用 `preview/registry.ts` 的 `shared.css` + 4 套 `style.css`；data-cyan 主色实测 `rgb(20, 95, 186)`。
3. **结构 / 组件**：`template-stage`/`business-page`/`page-heading`/`panel`/`org-ledger-shell`/`org-tree-panel`；`pm-search`、`pm-toolbar`、`pm-toolbar-item`、`pm-table`、`pm-pagination`、`pm-tree`、`pm-form-dialog`、`pm-input/pm-select/pm-number/pm-switch/pm-datepicker/pm-textarea`（契约 `components` 可覆盖 pm-radio/pm-checkbox/pm-upload/pm-image/pm-select-user/pm-select-org）。
4. **契约映射**（纯函数 `contract-preview.js`）：列/查询/工具栏/行操作/选择/分页/树/表单分组；确定性 mock（无 `Math.random`）；实体不存在的列/字段跳过 + 提示；tree 无 `parentField` 或匹配不到 → 按 `titleField` 去重扁平 + 提示。
5. **面板**：`DesignPrototypePanel` 增加 `appId/designHash/designLabel`；`supportsTemplateRender`（显式 recipe/catalogRef + 配方 ∈ 支持集合）→ 默认「模板风格」，否则「线框」；testid 沿用 `prototype-mode-preview`/`prototype-mode-wireframe`；模板模式禁用 PNG 导出。
6. **测试**：前端新增 `design-preview/contract-preview.test.mjs`（24）+ helper `buildDesignPreviewUrl`/默认模式（3），删除 P8-2 纯函数测试；`e2e:p9` 57 条；`e2e:p7-4b` 每次切页后先点「线框」（仍 48）。

### 验证数字（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **133 / 133** |
| `npm test --prefix frontend` | **131 / 131** |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过；产出 `dist/design-preview.html` |
| `npm run check:vue --prefix frontend` | 通过 |
| `npx tsc -p backend/tsconfig.json --noEmit` | 通过 |
| `npm run e2e:p9 --prefix backend`（新，端口 3446） | **57 条断言**；端口已关闭 |
| `npm run e2e:p7-4b --prefix backend` | **48** |
| `npm run e2e:p3 --prefix backend` | **126** |
| `npm run e2e:preview / p7-3b --prefix backend` | **83 / 38** |
| `npm run e2e:p2 / p4 --prefix backend` | **116 / 128** |
| 临时后端 `GET /design-preview.html` / `/preview.html` | 均 **200 text/html**（缺失 404 与 `preview.html` 共用同一分支，未模拟缺失） |
| `npm run build:report --prefix backend` | 通过：HTML **720.3 KB**（737,636B）、PDF **1,105.8 KB / 15 页**（P9 新增一节；页数守卫 14→15）、flow PNG 567,720B；截图/流程图沿用 P7-A 未重截 |

### 偏差

1. detail/dashboard/main-sub/wizard 未接入模板原生渲染（回退线框 + 提示）；真实产物 PNG 未做（Y2 二期）。
2. tree-list 的 `org-ledger-shell`/`org-tree-panel`/`ledger-*` 外观在渲染器 scoped CSS 内按模板同款声明（模板页面这些规则原本在组件 scoped 中，未进 `structure.css`，`templates/design-system/**` 只读未改）；模板页断点 1080px/`structure.css` 通用网格 960px 在 ~800px iframe 内都会单列，渲染器把网格断点降到 720px 以保证双栏可读。
3. 交互为展示级 mock（搜索/分页/选择/动作只改本地状态并 ElMessage 提示）；`pm-form-dialog` 用 `dialogVisible=true` + `modal=false` + `append-to-body=false`，保证无遮罩且继承风格变量。
4. 「不存在的列」提示只在渲染器顶部 note 中列出（不渲染假列）；实体为空时显示空表 + 提示，不白屏。
5. 未改 DB/表、API 语义、`templates/design-system/**`、`templates/afc-remote/**`、需求模板中心、`preview.html` 业务（`embed` 保留）；未新增依赖/未 npm install；未启停 3300/4771；未读写真实 `data/`/`projects/`/`.env`；未调真实模型；未做 git。
6. `build:report` 的 PDF 页数守卫由 14 调整为 **15**：P9 新增一节使报告 14→15 页；其余离线/无 console error/无横向溢出/流程图不跨页检查不变。

### 未验证

- 真实 AFCenter 宿主 / EOS 运行态的 pm-* 表现；真实 3300 上 P9 的人工视觉验收（运行实例的 `/design-preview.html` 与 assets 已实测 200，未在真实实例打开设计视图做人工截图验收）；后端“缺文件 404”显式路由需 `npm run build --prefix backend` + 重启后端后才生效（不影响当前预览）。
- detail/dashboard 等配方的模板化（Y2 二期）；真实产物 PNG 截图与像素比对。

### 环境确认

- 未启停真实 3300/4771（本期观察到实例已于 13:10:47 由用户重启：PID 10224/38776；本会话未启停）；未读写真实 `data/`/`projects/`/`.env`；e2e 全部使用临时目录与独立端口（3446/3444/3443/…）并及时清理。运行实例上只做了只读 HTTP 探测（`/design-preview.html` 与 `/assets/design-preview-*` 均 200）。
- **P9 已通过静态托管在真实 3300 生效**：前端 `dist` 即时生效，设计视图「模板风格」预览无需重启；`backend/dist` 仍为 13:10 构建，新增的显式 404 路由待用户按需重建/重启。
- `frontend/dist` 已为本期构建（含 `design-preview.html`）；`backend/dist` 未重建（运行进程不受影响，`/design-preview.html` 路由待用户重启后端后生效）。
