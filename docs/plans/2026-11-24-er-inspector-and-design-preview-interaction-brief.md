# ER 浮层 inspector + 设计预览交互层（B4—B5）实施 brief（2026-11-24）

> 状态：**已实施（待评审）**。范围：ER 默认全图 + 右上浮层 inspector（胶囊收起）/缩放右下角/图例折叠/首次自动适应；设计预览（单页原型 iframe）recipe 驱动交互层（弹窗/切页/确认/提示、不保存）。
> **未调真实模型、未启停真实 3300/4771、未读写真实 `data/`/`projects/`/`.env`、未做 git、未改 DB/需求模板中心/`templates/**`。**

## 1. 已确认决策

- ER 默认不选中实体、不显示字段卡片，画布占满主区；点实体 → 右上角浮层展示字段，可收起为胶囊；点空白/Esc 收起；关闭按钮清除选中。
- 浮层只在「实体关系」Tab 存在；首次进入若图超过可视区自动适应窗口一次，之后 Ctrl/⌘+滚轮/捏合缩放。
- 缩放控件移到画布右下角悬浮；图例折叠为「图例」入口；实体搜索保留。
- 设计预览交互层：不写数据、不调接口、切页/关闭后重置；显示「交互预览 · 不保存」。
- 规则 recipe 驱动：同页面集同实体优先；`dialog-form` → 当前列表页弹表单；`page-form`/`wizard` → 切目标页 Tab；`detail` → 切详情页；无目标 → 明确提示「该页面集未设计新增/编辑页」，不伪造表单。
- 同页交互：工具栏/行操作、删除确认、批量操作、dialog-form 关闭/提交、page-form 提交/取消；查询/分页/选择保持现状。
- 总览画布保持不可交互（本轮未改 `PageSetOverview`）。

## 2. 改动

### B4 ER 浮层 inspector + 全图空间

- `frontend/src/workbench/DesignErPanel.vue`：删除常驻底部 `.field-panel`；`selectedId` 初始 `null`（移除默认选中第一个实体的 watch）；新增 `.er-body` 相对定位容器（画布 + 浮层），`.er-canvas` `flex:1`、`min-height:280px`；`entity-inspector`（右上 `top/right:12px`、`width:360px`、`max-height:70%`、内部滚动）+ 头部（实体名/id/表名/状态、`entity-inspector-collapse`、`entity-inspector-close`）+ `entity-fields` testid；`entity-inspector-pill`（`{name} · {fields.length} 字段`）；点 ER 背景 `@background` 收起、window Esc 收起（卸载清理）；仅“选中不在可见集合时清空”。
- `frontend/src/design/ErGraph.vue`：工具栏只保留表/关系数 + 「图例」折叠（`er-legend-toggle`）；缩放组移到画布右下角悬浮（`er-zoom-out|value|in|fit` testid 不变）；`onMounted` nextTick 首次超可视区自动 `fitToWindow()` 一次；画布背景点击 emit `background`（`.er-node` 内不算）；Ctrl/⌘+滚轮与普通滚轮逻辑不变。
- `frontend/src/workbench/DesignView.vue`：无逻辑改动（确认无 `pageSets` 传参残留）。

### B5 设计预览交互层

- 新增 `frontend/src/design-preview/interaction.js`：`resolveActionTarget({ action, page, pages })`（同 pageSetId + 同 entityId；create/edit 配方 dialog-form > page-form > wizard；detail 只 detail；关键词优先；delete/batchDelete→confirm；export/import/其它→notify；无目标→none + reason）。
- 新增 `frontend/src/design-preview/interaction.test.mjs`（12 条）并登记 `frontend/package.json`。
- `ContractPage.vue`：动作统一 `emit('action', { code, label, row? })`（工具栏 heading/create、批量、行操作、page-form/main-sub 表单、wizard 提交）；`dialog-form` 的 `dialogVisible` 可控（默认 true、页头「新增」重开、取消/提交关闭并 emit）；**列表/树表在 `rowActions` 非空时补「操作」列**（此前 `#action` slot 无列可挂，行操作不可见——测试暴露的既有缺口）。
- `ContractFormFields.vue`：`@action` payload 改为 `{ code, label }`。
- `TemplatePreviewApp.vue`：`ContractPage @action` → `ElMessage` 轻提示（模板预览保持“有响应”，不跨页）。
- 新增 `frontend/src/design-preview/ContractActionDialog.vue`：自定义 fixed 遮罩 + 居中卡片 + `pm-form-dialog`（`:modal="false" :append-to-body="false"`）+ `ContractFormFields`；create 空表单、edit 用行预填；testid `contract-action-dialog`/`contract-action-submit`/`contract-action-cancel`。
- `DesignPreviewApp.vue`：保存全部页面与模板页；`@action` → dialog 打开 `ContractActionDialog` / navigate 发 `postMessage({source:'adp-design-preview', type:'navigate-page', pageId})`（独立窗口本地切页）/ confirm `ElMessageBox.confirm` / notify `ElMessage.info` / none `ElMessage.warning`；非 capture 显示「交互预览 · 不保存」（`design-preview-interactive-badge`，截图模式隐藏）。
- `DesignPrototypePanel.vue`：iframe `ref` + `message` 监听（校验 source/origin/type/pageId ∈ props.pages）→ `selectPage`；模板模式工具栏加只读 chip `prototype-interaction-hint`；总览未改。

### 测试

- `backend/scripts/p3-e2e.ts`：点实体前断言 `entity-inspector`/pill 为 0；3b.5—3b.7 改为浮层可见/位于右下上半区/`entity-fields` 在内；新增收起→胶囊→恢复、点空白收起、切 Tab 后清空、切回 ER 仍无浮层；8b.4 改为切回 ER 后先点 `.er-node` 再读字段；断言 **168→177**。
- 新增 `backend/scripts/design-interaction-e2e.ts` + `backend/package.json` `e2e:design-interaction`（端口 3451/4451，临时根，写 fixture：order/customer/report + 6 页）：弹窗/取消/提交/编辑预填/删除确认取消/切页/未设计提示/交互角标 + 0 console error/pageerror/请求失败/外部请求；**24 条断言**。
- `backend/scripts/ui3b-shots.ts`：`.field-panel` 卡改为点实体后 `entity-inspector` 卡；23 截图 / 22 无溢出 / 27 口径，无失败。

## 3. 命令与结果（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | **213 / 213**（原 201，+12 interaction） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过（2861 modules） |
| `npm run build --prefix backend` | 通过 |
| `npx tsc -p tsconfig.json --noEmit`（backend） | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **238 / 238**（未改 backend src） |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416） |
| `e2e:p3` | **177**（原 168，+9） |
| `e2e:design-interaction`（新增） | **24** |
| `e2e:p9` | **69**（dialog-form 默认可见、可关闭，未削弱） |
| `e2e:p10` | **81** |
| `e2e:p7-4b` | **57** |
| `e2e:p7-7c` | **118** |
| `e2e:p2` / `p4` / `p7-6a` / `api-design` | **105 / 135 / 21 / 26** |
| `npx tsx scripts/ui3b-shots.ts` | **23 张截图 / 22 次无整页溢出 / 27 次口径测量**，无失败 |

e2e/截图均为临时目录 + 独立端口 + stub opencode（不调模型）。结束核对：测试端口 3400—3470 / 4400—4470 无残留监听；真实 3300/4771 只读核对为 **PID 6992 / 37956**（与交接 brief 所写 22892/3948 不同，疑用户在接单后重启；本轮未启停）。

## 4. 偏差

- 浮层放在 `.er-canvas` 外的 `.er-body`（相对定位）而非直接挂在 `.er-panel`：避免随画布滚动/缩放漂移；视觉仍在画布右上角。
- 点空白/Esc 为**收起为胶囊**（保留选中）；`entity-inspector-close` 才清除选中；Esc 在已收起时再按一次清除。
- **列表/树表新增「操作」列**：既有 `#action` slot 没有对应列，行操作实际不可见；B5 要求行 edit/delete，故在 `rowActions` 非空时补列（列宽按动作数）。这会影响所有有 `rowActions` 的模板预览页（多一列“操作”），属修复而非纯视觉变更。
- `ContractActionDialog` 的 `pm-form-dialog` 需要 `!important` 覆盖 Element Plus 2.14 的**内联** `position:fixed; inset:0`（`.el-modal-dialog`），使其在卡片内静态排布；页脚按钮用本组件自绘（带 testid），未改共享 `pm-form-dialog`。
- `dialog-form` 页头的「新增」只重开本页弹窗、不 emit create（避免宿主再叠一层同源弹窗）。
- 新增 `e2e` 的行操作定位用 `button.link-button:visible`：Element Plus 表格在 `.hidden-columns` 里保留一份隐藏副本，`first()` 会命中隐藏节点。
- p3 断言数 168→177（浮层 13 条替代原 3 条字段面板断言等）；p9 保持 69（未改 dialog-form 核心断言）。
- 列表操作列不做 `fixed:'right'`（避免固定列表格克隆/隐藏节点问题）。

## 5. 未验证

- 真实模型闭环未执行（交互层纯前端，不涉及模型）。
- 真实 3300/4771 视觉验收：本轮只读核对（PIDs 与 brief 不一致，未启停）；运行实例仍是旧构建，需用户 `restart.cmd`/`restart.sh` 后查看。
- 真实触摸板捏合：按浏览器 trackpad pinch → ctrl+wheel 处理，未在真实硬件验证。
- 交互层与真实模板产出页面的差异：fixture 为最小 6 页；真实复杂契约（大批量动作、子表、wizard 分组）未逐一验证。
- 不持久化：所有交互均为本地 mock，不写数据、不调接口；删除确认只提示「已删除（预览）」。
- 总览多 iframe 性能未压测；PNG 仅宽高/主色采样，未像素级 diff。
- AFCenter 宿主 `pm-*`、EOS 构建/运行未验证。
- `docs/report/**` 未更新/未重截（按要求）。
