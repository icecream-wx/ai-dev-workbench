# P10 实施单：detail/dashboard 配方模板化 + 真实模板风格 PNG（2026-11-20）

> 用户决策（2026-11-20）：PNG 也要和所选模板一致；继续做 ②。
> 前置：P9 已让设计视图「原型」默认用模板结构/组件渲染 `design.json`（list / tree-list / page-form / dialog-form），PNG 仍是线框草图。
> 本单：① 扩展模板渲染器支持 **detail / dashboard**（main-sub / wizard 仍回退线框）；② 设计参考包 PNG 改为**模板风格截图**（在 `design-preview` iframe 内 html2canvas 自截，postMessage 回工作台）；不支持配方/旧的无线索设计仍用线框截图兜底。

---

## 0. 出口标准

1. 设计视图「原型」模板风格支持集合扩展为：`list / tree-list / page-form / dialog-form / detail / dashboard`。
   - **dashboard**：模板 `page-heading` + `metrics-grid`/`metric-card` + `panel` + `pm-echarts`（或模板静态图表类）+ 最近记录 `pm-table`；指标/图表由实体与 mock 行推导，无实体时给空态。
   - **detail**：模板 `page-heading` + `panel` + `info-grid`/`info-item` + `timeline` + 可选子表 `pm-table`；字段值来自实体与 mock 行；无实体时给空态。
   - `main-sub` / `wizard` 仍回退 P7-4b 线框并提示。
2. 设计参考包 PNG：
   - 对 **支持模板渲染的页面**：`prototypes/<page>.png` 是 `design-preview` 真实模板风格截图（不是灰阶线框）；
   - 对不支持的配方 / 无 recipe 的旧设计：仍用隐藏线框画布截图（保持旧行为）；
   - 自动导出（hash 变化 1s 防抖）与手动「导出 PNG」都走同一逻辑；失败保留旧图 + 错误条，不阻塞视图；
   - `tokens.json`/`_manifest.json` 仍由后端写入（`styleId`/designHash），语义不变。
3. 新增 `e2e:p10`（临时目录/端口/stub）覆盖 detail/dashboard 渲染 + PNG 真实截图；`e2e:p9` 57、`p7-4b` 48、`p3` 126、`preview` 83、`p7-3b` 38、`p2/p4` 116/128 保持。
4. 文档更新：PNG 不再是“线框草图”，而是“模板风格截图（不支持配方为线框）”；AGENTS/报告/STATUS/设计稿同步。

---

## 1. detail / dashboard 渲染（design-preview）

### 1.1 支持判定

- `frontend/src/design-preview/contract-preview.js`（或现有 `resolveContractRecipe` 所在文件）的支持集合加 `detail`、`dashboard`。
- `DesignPrototypePanel.supportsTemplateRender` 同步；默认模板模式的判定不变（显式 recipe/catalogRef + 支持配方）。
- `main-sub`/`wizard` 仍不支持。

### 1.2 dashboard 模板

在 `ContractPage.vue` 增加 `recipe === 'dashboard'` 分支，结构参考模板（`structure.css` 已有类）：

```html
<header class="page-heading">
  <div><h1>{{ page.title }}</h1><p>{{ 描述/实体说明 }}</p></div>
  <div class="heading-actions">（toolbarActions，可空）</div>
</header>
<div class="metrics-grid">
  <article class="metric-card" v-for="m in metrics">
    <span>{{ m.label }}</span><strong>{{ m.value }}</strong><small>{{ m.note }}</small>
  </article>
</div>
<section class="panel">
  <h2 class="panel-title">分布 / 趋势</h2>
  <pm-echarts v-if="chartOption" :option="chartOption" height="260px" />
  <div v-else class="asset-empty">暂无可展示的数据分布</div>
</section>
<section class="panel">
  <h2 class="panel-title">最近记录</h2>
  <pm-table :table-data="rows.slice(0,5)" :columns="columns" show-index />
</section>
```

- 指标推导（纯函数，便于单测）：
  - `记录总数` = rows.length；
  - 数值字段（最多 3 个）：`<字段名>合计`（sum，保留原始量级）；
  - 若有枚举字段，可加 `<枚举字段>种类`（distinct 数）或作为图表维度；
  - 无实体/无字段：3 个占位卡（值 `—`），不伪造业务数据。
- 图表：
  - 优先枚举字段（distinct 计数）→ `pm-echarts` 饼图 option；
  - 否则数值字段 + string 维度 → 柱状图；无可用字段 → 不渲染图表，显示空态。
  - option 必须简单、可序列化、无外部请求；`pm-echarts` 已由 preview 注册。
- 表格列：契约 `columns` 或实体前 4—6 个字段；行操作可不渲染。

### 1.3 detail 模板

`recipe === 'detail'` 分支：

```html
<header class="page-heading">
  <div class="title-line">
    <h1>{{ page.title }}</h1>
    <span v-if="status" class="status-chip" :class="statusClass(status)">{{ status }}</span>
  </div>
  <p>{{ 副标题（实体名/编号等） }}</p>
  <div class="heading-actions">（toolbarActions）</div>
</header>
<section class="detail-hero">…主信息（名称/编号/负责人/状态）…</section>
<div class="detail-grid">
  <div>
    <section class="panel">
      <h2 class="panel-title">基本信息</h2>
      <div class="info-grid">
        <div class="info-item" v-for="f in fields"><span>{{ f.label }}</span><strong>{{ f.value }}</strong></div>
      </div>
    </section>
    <section class="panel" v-if="subTables.length">…子表 pm-table（tab/flow）…</section>
  </div>
  <aside>
    <section class="panel">
      <h2 class="panel-title">动态</h2>
      <ol class="timeline">
        <li v-for="item in timeline"><strong>{{ item.title }}</strong><span>{{ item.desc }}</span></li>
      </ol>
    </section>
  </aside>
</div>
```

- 字段/值：实体字段 + 第一行 mock 值；`components` 不用于详情展示（只做文本/状态）。
- `status`：枚举字段（优先含“状态”）的值 + `status-success/warning/danger/neutral` 映射。
- 时间线：用 `创建时间/更新时间` 或固定 2—3 条派生事件（“记录创建/最近更新”），不伪造业务事件；无字段则只显示一条“暂无动态”。
- 子表：若 `layout.subTables`/实体关系存在，用 `pm-table` 渲染前 3 行；`mode=tab` 用模板 tab 样式；否则堆叠。
- 无实体：`page-heading` + `panel` 空态（“该页面未绑定实体”），不白屏。

### 1.4 纯函数与单测

- `contract-preview.js` 新增（并导出）：
  - `buildDashboardModel({ page, entity, rows })` → `{ metrics, chartOption, columns, rows }`；
  - `buildDetailModel({ page, entity, row, subTables })` → `{ fields, status, timeline, subTables }`；
- `contract-preview.test.mjs` 增加 ≥8 例：有/无实体、枚举/数值指标、图表 option、状态映射、时间线、子表、空态。
- 确定性 mock 保持（无 Math.random）。

---

## 2. 真实模板风格 PNG（核心）

### 2.1 design-preview 支持截图

- `DesignPreviewApp.vue`：
  - 识别 `capture=1`：隐藏 `.contract-notes`、`design-preview-badge`（`v-if="!capture && !embed"`），并加根 class `is-capture`（禁用动画/过渡）。
  - 加载完成（`loading=false` + structure CSS 应用 + `document.fonts.ready` + 2×rAF + 约 300ms 等 echarts/图片）后，`postMessage({ source:'adp-design-preview', type:'ready', id: requestId, pageId }, location.origin)`。
  - 监听 `message`（`event.source === window.parent`，`data.source === 'adp-design-view'`，`type === 'capture'`）：
    - 用 `html2canvas` 截根节点 `.design-preview-root`（或 `.optimized-suite`，优先含背景/内边距的根），`scale` 由请求传入（默认 2），`backgroundColor: null`/`getComputedStyle(body).backgroundColor`；
    - 成功后 `postMessage({ source:'adp-design-preview', type:'png', id, dataUrl, width, height }, location.origin)`；
    - 失败 `postMessage({..., type:'error', message})`。
  - 截图前滚动到顶部，确保全页；html2canvas 截元素完整高度。
- `frontend/src/design-preview/snapshot.ts`（或复用 `design/snapshot.ts`）封装 html2canvas；确保不把 iframe 外的工作台 UI 截进去。

### 2.2 工作台导出服务

- 新增 `frontend/src/design/template-capture.ts`（或 `.js` 便于测试）：
  - `captureTemplatePage({ appId, moduleKey, pageId, type, styleId, designHash, width=1440, height=900, scale=2, timeoutMs=20000 })`
    - 动态创建隐藏 iframe（`position:fixed; left:-20000px; top:0; width:1440px; height:900px; border:0`），src=`/design-preview.html?app=&module=&page=&type=&style=&v=&embed=1&capture=1&rid=<id>`；
    - 等待 `ready` → 发 `capture` → 等 `png`/`error`/超时；返回 dataUrl/宽高；
    - 清理 iframe 与监听（无论成功失败）。
    - 若 dataUrl 估算 > 5MB（后端上限），用 `scale:1` 重试一次；仍失败报错。
  - 纯函数 `shouldTemplateCapture(page, designSystem)`（recipe 支持 + type/style 存在）。
- `DesignView.vue#runExport`：
  - 逐页：
    - `shouldTemplateCapture` → `captureTemplatePage`；
    - 否则 → 现有隐藏 `PrototypeCanvas` + `captureElementPng`（保留）；
  - 混合页面允许（manifest 不区分渲染器；如需要可在 UI 提示“N 页为线框兜底”）；
  - 模板截图失败：**回退该页线框截图**并记录警告（不中断整包）；仍失败才抛错、保留旧图；
  - 其余 hash 比对/409 防抖/`savePrototypePackage`/手动与自动逻辑保持。
- `DesignPrototypePanel.vue`：
  - 模板模式也允许「导出 PNG」（现在禁用）；按钮 emit `export`，由 DesignView 执行整包导出（模板优先、线框兜底）；wireframe 模式同一按钮；
  - 文案/tooltip：“导出 PNG（模板风格；不支持配方为线框）”；
  - 不再本地直接 `captureElementPng` 当前页（避免只导出 1 页删掉其他页）。
- 说明：自动导出仍是“设计视图可见 + hash 变化 + 1s 防抖”；真实截图比线框慢，保持串行、逐页、有超时。

### 2.3 PNG 语义/文档

- `prototypes/*.png` 现在是“模板风格截图（不支持配方为线框）”，不再是“线框草图”；
- `prototypes/_manifest.json` 的 `designHash` 过期语义不变；fidelity 只查 hash/页数，不改；
- 开发 prompt/AGENTS/skill 中“PNG 是线框草图”的表述改为“PNG 是模板风格截图（不支持配方/旧设计为线框；过期先说明）”。

---

## 3. e2e 与回归

### 3.1 `e2e:p10`（新）

`backend/scripts/template-png-e2e.ts` + `backend/package.json` `e2e:p10`：
- harness（`P2_PORT=3447`、`P2_APP_ID=p10-e2e`、`P2_DESIGN_SYSTEM`=operations-management/data-cyan、stub）。
- fixture design.json：
  - `overview`（dashboard，entity=product）；
  - `product-detail`（detail，entity=product）；
  - `product-list`（list，entity=product，用于混合导出/对照）。
- 断言（≥26）：
  - dashboard 默认模板 iframe：`metrics-grid`/`metric-card`（≥3）、`pm-echarts`（canvas/svg）、`panel`、标题；
  - detail 默认模板 iframe：`page-heading`/`title-line`/`status-chip`、`info-grid`/`info-item`、`timeline`、`panel`；
  - 主色 data-cyan 计算值；
  - 自动导出：等待 `prototypes/_manifest.json`，manifest 页数=3；
  - 打开 `overview.png`/`product-detail.png`（读取文件 → base64 → 浏览器 Image+canvas 采样），断言：
    - 宽 > 800、高 > 400；
    - 存在接近 data-cyan 主色 `rgb(20,95,186)` 的像素（证明不是灰阶线框；允许抗锯齿容差）；
  - 切「线框」仍可用；
  - 0 console/pageerror/请求失败/外部请求；
  - 清理端口。
- 若自动导出较慢：等待 manifest 超时 90s；失败重试一次。
- 需要 `e2e` 中读取 `tokens/style` 主色常量。

### 3.2 回归

- `e2e:p9` 57（detail/dashboard 不涉及；PNG 变成模板截图不影响断言，若有导出等待需放宽）；
- `e2e:p7-4b` 48（模板页自动导出可能变慢；断言不变）；
- `e2e:p3` 126（无 recipe → 仍线框 PNG，2b.2/2b.8 等不变）；
- `e2e:preview` 83、`p7-3b` 38、`p2/p4` 116/128；
- 后端 133、前端 131+；`build:report`。

---

## 4. 文档

- `docs/STATUS.md` 新增 P10 节；「下一步」只剩 P7-7 与真实宿主/EOS/像素比对（PNG 真实截图已完成；main-sub/wizard 未做）。
- P7 设计稿新增「§29 P10 detail/dashboard + 模板风格 PNG」。
- `AGENTS.md`/`README.md`：支持配方、PNG 语义、e2e 数字更新；删除“PNG 是线框草图”的旧表述（改为模板风格截图，不支持配方为线框）。
- `docs/report/*` 更新并 `build:report`（截图可暂不重截，注明）。
- 本实施单末尾追加「实施结果（2026-11-20）」。

---

## 5. 边界

- 只改：`frontend/src/design-preview/**`、`frontend/src/workbench/**`、`frontend/src/design/**`（截图服务/复用）、`backend/scripts/**`、`backend/package.json`、`docs/**`、`README.md`、`AGENTS.md`。
- 不改：后端 `src/**`（PNG 写入接口不变）、DB/表、`templates/**`、需求模板中心、模板中心/`preview.html` 业务、P9 的 list/tree/form 行为。
- 不新增依赖（html2canvas 已有）；不 npm install；不做 git；不启停真实 3300；不读写真实 `data/`/`projects/`/`.env`；不调真实模型；e2e 临时目录/端口 3447。
- 真实 3300 前端静态托管即时生效；**本单完成后刷新即可见，不要自动重启**；不涉及后端路由。

---

## 6. 收尾与回报

- 结果 → 验证数字（后端 133、前端 131+、`e2e:p10` 新增、`p9` 57、`p7-4b` 48、`p3` 126、`preview` 83、`p7-3b` 38、`p2/p4` 116/128、`build:report`）→ 偏差 → 未验证 → 环境确认。
- 明确写清：detail/dashboard 已模板化；main-sub/wizard 仍线框；PNG 已改为模板风格截图（不支持配方/旧设计为线框）；真实宿主/EOS/像素级比对未验证。

---

## 实施结果（2026-11-20）

| 项 | 结果 |
| --- | --- |
| detail/dashboard | 已模板化（`design-preview` 支持集合 = list/tree-list/page-form/dialog-form/detail/dashboard）；dashboard 指标卡/饼图柱图/最近记录、detail 主信息/字段/状态/时间线/子表均由契约 + 实体确定性 mock 生成；main-sub/wizard 仍回退线框 |
| PNG | 已改为模板风格截图：`design-preview?capture=1&rid=` 内 html2canvas 自截 + postMessage；`design/template-capture.ts` 隐藏 iframe 逐页截图、超时/>5MB 降 scale；失败回退该页线框并记警告；模板模式按钮也允许整包导出 |
| 验证 | 后端 **133/133**；前端 **141/141**；typecheck/build/check:vue 通过；`e2e:p10` **54**（端口 3447，overview.png 2880×1996 + data-cyan 主色像素）；`e2e:p9` **67**（脚本实际数；旧记录 57）、`p7-4b` **48**、`p3` **126**、`preview` **83**、`p7-3b` **38**、`p2/p4` **116/128**（PNG 导出断言改为整包重写）；`build:report` 见 STATUS |
| 偏差 | ① html2canvas 1.4.1 不支持 `color(srgb …)`（模板 `color-mix`），截图克隆时降级颜色解析；② `DesignPrototypePanel` PNG 按钮改为整包导出（不再下载当前页），p9/p7-4b/p3 断言同步；③ **未改开发 prompt/应用 AGENTS/skill 的“PNG 线框草图”文案**（在 `backend/src/**`、`templates/**`，属硬边界），只更新 AGENTS/README/docs；④ `e2e:p9` 实际 67 条（旧文档 57 与脚本不符） |
| 未验证 | 真实 AFCenter 宿主/EOS、真实 3300 人工视觉验收、PNG 像素级模板比对（仅宽高+主色采样）、长表/超大页面截图稳定性、main-sub/wizard 模板化 |
| 环境 | 临时目录/端口 3447；未启停真实 3300/4771；未读写真实 `data/`/`projects/`/`.env`；未 npm install；未新增依赖；未做 git；未调真实模型；`frontend/dist` 已重建，静态托管即时生效 |
