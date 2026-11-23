# P8-2 实施单：设计视图原型真实模板预览（Y）（2026-11-20）

> 用户决策（2026-11-20）：设计阶段的原型要**按创建应用时选择的设计模板真实呈现**（不是灰阶线框、不是旧原型模板）。
> 本单在 P8-1（旧版彻底删除）之上，把「设计模板中心/预览」的真实渲染接入设计视图「原型」Tab。
> 实现口径：**复用 `preview.html`（pm-v3 真实组件 + 模板页面 + 所选风格 CSS）**；设计页有 `catalogRef` 时默认显示对应模板页面；无 `catalogRef` 回退现有线框；PNG 仍为线框草图（自动导出不变）。

---

## 0. 出口标准

1. 设计视图「原型」Tab：
   - 当前设计页 `catalogRef` 能解析到所选应用类型的模板页面时，**默认**渲染该模板页面的真实预览（iframe `preview.html?type=&style=&page=&embed=1`）；
   - 无 `catalogRef` / 解析失败时，回退现有线框渲染，并显示提示“未认领模板页面，当前为线框；可在模板页面库查看模板真实页面”；
   - 页面 chips 仍来自 `design.json` 页面；切页面时预览/线框自动切换；
   - 提供「模板预览 / 线框」切换（预览模式仅在可解析时可用）；切换不重建工作台，只切面板内容。
2. 预览模式下：
   - iframe 隐藏 `preview.html` 自带的底部风格切换器与 mock 角标（新增 `embed=1` 参数），避免与工作台 UI 重复；
   - 风格固定为应用设计系统的 style（不允许在原型 Tab 内改风格；改风格走设计模板中心/PATCH）；
   - `导出 PNG` 在预览模式禁用并提示“PNG 为线框草图，可切到线框导出”；线框模式可导出；
   - 设计参考包自动导出（DesignView 隐藏 `PrototypeCanvas`）**保持线框**，不因预览模式改变。
3. `preview.html` 支持 `embed=1`：隐藏 `.preview-style-switch` 与 `.preview-badge`，保留参数回退/加载失败提示。
4. 新增独立 `e2e:p8-2`（临时目录/端口/stub），覆盖：默认真实预览、iframe URL、模板页面内容、切线框、无 catalogRef 回退、预览模式禁用导出、0 console/pageerror/外部请求。
5. 现有回归：`e2e:p7-4b` 48（需先切线框）、`e2e:p3` 126、`e2e:p7-3b` 38、`e2e:preview` 77（可 +embed 断言）、`e2e:p2/p4` 116/128、后端 133、前端 104+。

---

## 1. 行为与边界（先读，避免做偏）

- **真实预览只决定“看起来像所选模板”**：iframe 展示的是模板 pack 的页面（如 `enterprise-application-platform/organization`），不是按 `design.json` 字段/操作动态重绘 pm-v3 组件。
- `design.json` 的字段/列/操作/树/表单契约仍由线框模式体现（P7-4b）。真实预览与线框是**同一设计页的两种视图**：真实视觉基准 + 契约草图。
- 若用户要“design.json 字段 → pm-v3 真实组件”的完全所见即所得（Y2），另立后续单；本单不做，文档要写清。
- `catalogRef` 格式 `<applicationType>/<pageId>`；只有 type 与当前应用类型一致且 pageId 在 `designSystem.pages` 中存在时才启用预览。
- 旧版原型模板已在 P8-1 删除，本单**不得**重新引入 `PrototypeTemplate`/`prototype_templates`/旧模板名。

---

## 2. 实现

### 2.1 `preview.html` embed 参数

- `frontend/src/preview/PreviewApp.vue`：
  - 读取 `new URLSearchParams(window.location.search)` 的 `embed`（`embed=1`/`embed=true` 视为真）；
  - `embed` 时隐藏 `.preview-style-switch` 与 `.preview-badge`（`v-if="!embed"`）；
  - 其余参数解析/回退/加载/标题逻辑不变。
- 不改 `preview-params.js` 的 type/style/page 语义；`embed` 只影响展示。
- 可选：`e2e:preview` 增加 1—2 条断言（embed 隐藏切换器/角标）；若加，记 77→78/79。

### 2.2 设计视图原型面板（核心）

- `frontend/src/workbench/DesignView.vue`：
  - 把设计系统摘要传给面板：`:application-type="designSystem?.applicationType?.id"`、`:style-id="designSystem?.style?.id"`、`:template-pages="designSystem?.pages ?? []"`；
  - 其余布局/工具栏/导出逻辑不变。
- `frontend/src/workbench/DesignPrototypePanel.vue`：
  - 新增 props：`applicationType?: string`、`styleId?: string`、`templatePages?: Array<{ id: string; name: string }>`；
  - 计算 `previewPageId`：从 `currentPage.catalogRef` 取 pageId（`split('/')`），校验 type 与 `applicationType` 一致且 `templatePages` 含该 id；成功则 `previewable=true`；
  - `mode` 状态：`'preview' | 'wireframe'`；`watch(currentId, applicationType/styleId)` 时：可预览 → `mode='preview'`，否则 `mode='wireframe'`；
  - 头部新增模式切换（仅 `previewable` 时显示预览按钮）：
    - `data-testid="prototype-mode-preview"` / `prototype-mode-wireframe`；
    - 文案「模板预览」「线框」；
  - 预览模式渲染：
    ```html
    <iframe
      :src="previewSrc"
      class="preview-frame"
      data-testid="prototype-preview-frame"
      title="设计模板页面预览"
    />
    ```
    `previewSrc = buildPreviewUrl({ applicationType, style: styleId, page: previewPageId }) + '&embed=1'`（复用 `design-template-helpers.js#buildPreviewUrl`，确认它返回 `/preview.html?...`）；
  - 线框模式渲染现有 `PrototypeCanvas`（保持缩放/导出）；
  - `pageHint`：预览成功时不显示；“无 catalogRef/解析失败”时显示提示（见 §0）；
  - `exportPng`：仅线框模式可点；预览模式 `disabled` 且 `title` 提示；不改变隐藏画布的自动导出；
  - 预览模式的缩放：可隐藏缩放组（推荐）或对 iframe 容器做 scale；不要影响线框模式。
- `DesignView.vue` 的隐藏导出画布（`exportPage` + `PrototypeCanvas`）**保持线框**，不接 iframe；保证 `prototypes/*.png`、`tokens.json`、manifest 仍生成（styleId）。

### 2.3 纯函数与单测

- 新增/扩展 `frontend/src/workbench/design-template-helpers.js` 的纯函数（便于 node 测试）：
  - `resolvePreviewTarget(page, applicationType, templatePages)` → `{ pageId, valid, reason }`；非法 `catalogRef`/跨类型/页面不存在都返回 `valid:false` + 原因；
  - `buildEmbedPreviewUrl({ applicationType, style, page })` → `/preview.html?type=&style=&page=&embed=1`（或复用 `buildPreviewUrl` + 追加 `embed`）；
- `design-template-helpers.test.mjs` 增加 4—6 例：`type/page` 解析、跨类型、页面不存在、无 catalogRef、embed URL。
- 如抽 `prototypeMode` 状态纯函数，也补测试。

### 2.4 e2e（新增 `e2e:p8-2`）

- 新增 `backend/scripts/prototype-preview-e2e.ts` + `backend/package.json` script `e2e:p8-2`：
  - 复用 `p2-e2e-harness.ts`（临时根、`P2_PORT=3445`、`P2_APP_ID=p8-2-e2e`、`P2_DESIGN_SYSTEM` 企业级/平台蓝白、stub opencode）；
  - 启动后写 `docs/design/MOD-001/design.json`（两页）：
    - `org-list`：`type=list`、`catalogRef="enterprise-application-platform/organization"`；
    - `local-page`：`type=list`、**无** catalogRef（用于回退线框）；
  - 设计视图 → 原型 Tab：
    - 默认显示 `prototype-preview-frame`，`src` 含 `type=enterprise-application-platform`、`style=platform-blue`、`page=organization`、`embed=1`；
    - `frameLocator` 内可见“组织与用户/机构/账号”等模板页面内容；
    - iframe 内**不出现**底部风格切换器（`embed` 生效）；
    - 点「线框」→ `prototype-paper` 可见（P7-4b 线框），导出按钮可用；
    - 点「模板预览」→ iframe 回来；
    - 切 `local-page` → 线框 + 提示；无「模板预览」按钮或禁用；
    - 预览模式导出按钮禁用（`isDisabled()===true`）；
    - 0 console error / 0 pageerror / 0 请求失败 / 0 外部请求；
  - 结束清理临时后端/端口（3445）。
- 调整 `e2e:p7-4b`（`backend/scripts/renderer-e2e.ts`）：
  - fixture 的 `org-list` 有 catalogRef → 默认会进预览；在进入原型后先点 `[data-testid=prototype-mode-wireframe]`，再跑现有 48 条断言；
  - 不改断言数（仍 48）。
- `e2e:p3` 的 fixture 页面无 catalogRef → 默认线框，126 不变；若出现模式按钮，不得影响现有断言。
- `e2e:p7-3b`/`preview`/`p2`/`p4` 保持；如受 embed 影响只加断言不改口径。

---

## 3. 文档同步

- `docs/STATUS.md` 新增 P8-2 节；「下一步」更新（P7-7、真实 3300）。
- P7 设计稿新增「§27 P8-2 设计视图真实模板预览」：行为、catalogRef 规则、线框/预览双视图、PNG 草图、Y2 未做。
- `README.md`/`AGENTS.md`：设计视图原型支持“模板真实预览（catalogRef）+ 线框”；PNG 仍是线框草图；新增 `e2e:p8-2`。
- `docs/plans/README.md` 加本实施单条目。
- `docs/report/ai-dev-workbench-overview.md` + report README：设计视图/原型描述、e2e 数字；`build:report` 重跑（截图可暂不重截，注明）。
- 本实施单末尾追加「实施结果（2026-11-20）」。

---

## 4. 边界

- 只改：`frontend/src/preview/**`、`frontend/src/workbench/**`、`frontend/src/design/**`（如需）、`backend/scripts/**`（e2e）、`backend/package.json`（script）、`docs/**`、`README.md`、`AGENTS.md`。
- 不改：后端 `src/**`（除无）、DB/表、设计模板 pack、`templates/**`、需求模板中心、P7-4b 线框渲染逻辑（除模式切换/导出禁用）。
- 不做 Y2（design.json 字段→pm-v3 真实组件）；不引入新依赖；不 npm install。
- 不启停真实 3300/4771；不读写真实 `data/`、`projects/`、`.env`；不做 git；不调真实模型。
- 临时实例只用临时目录/端口（3445/stub）；结束清理。

---

## 5. 收尾与回报

- 结果 → 验证命令与数字（后端 133、前端 104+、p8-2 新增数、p7-4b 48、p3 126、p7-3b 38、preview 77/78、p2/p4 116/128、build:report）→ 偏差 → 未验证 → 环境确认。
- 明确写清：真实预览展示的是模板 pack 页面；`design.json` 字段差异仍在线框/契约中体现（Y2 未做）。

---

## 实施结果（2026-11-20）

### 结果

P8-2 已实施：设计视图「原型」Tab 支持 **模板真实预览 / 线框** 双视图。有 `catalogRef`（`<applicationType>/<pageId>`，类型与应用一致且页面在 `designSystem.pages` 中）时**默认** iframe 展示 `preview.html?type=&style=&page=&embed=1`；无 catalogRef/解析失败回退 P7-4b 线框并提示；预览模式禁用 PNG 导出并提示，线框模式保留缩放/导出；`DesignView` 隐藏导出画布保持线框，自动导出（PNG/tokens/manifest）不受影响。`preview.html` 支持 `embed=1` 隐藏自带风格切换器与 mock 角标。

### 改动

| 文件 | 说明 |
| --- | --- |
| `frontend/src/preview/PreviewApp.vue` | `embed=1/true` 时隐藏 `.preview-style-switch`/`.preview-badge`；`updateLocation` 保留 embed；其余参数逻辑不变 |
| `frontend/src/preview/preview-params.js` | 新增 `embedEnabled(search)`（纯函数）；顶部注释补充 embed |
| `frontend/src/workbench/design-template-helpers.js` | 新增 `resolvePreviewTarget`、`buildEmbedPreviewUrl` |
| `frontend/src/workbench/DesignPrototypePanel.vue` | 新增 `applicationType/styleId/templatePages` props、preview/wireframe 双模式、catalogRef 解析、iframe（`prototype-preview-frame`）、模式切换（`prototype-mode-preview`/`prototype-mode-wireframe`）、回退提示、预览禁用导出 + 提示、预览隐藏缩放组 |
| `frontend/src/workbench/DesignView.vue` | 传设计系统摘要给面板；隐藏导出画布不变（线框） |
| `frontend/src/workbench/design-template-helpers.test.mjs` / `frontend/src/preview/preview-params.test.mjs` | +6 / +1 单测 |
| `backend/scripts/prototype-preview-e2e.ts` + `backend/package.json` | 新增 `e2e:p8-2`（端口 3445，stub，临时目录，结束清理） |
| `backend/scripts/renderer-e2e.ts` | `e2e:p7-4b` 进入原型先点「线框」；末尾回 org-list 后再点「线框」（断言数仍 48） |
| `backend/scripts/preview-e2e.ts` | 增加 embed 段（77→83） |
| `docs/STATUS.md`、`README.md`、`AGENTS.md`、`docs/plans/README.md`、P7 设计稿 §27、`docs/report/*` | 同步行为/规则/数字；`build:report` 重跑 |

### 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **133 / 133** |
| `npm test --prefix frontend` | **111 / 111** |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过（2800+ modules，`dist/preview.html`） |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run e2e:p8-2 --prefix backend` | **28 条断言**；端口 3445 已关闭 |
| `npm run e2e:p7-4b --prefix backend` | **48 条断言** |
| `npm run e2e:p3 --prefix backend` | **126 条断言** |
| `npm run e2e:preview --prefix backend` | **83 条断言** |
| `npm run e2e:p7-3b / p2 / p4 --prefix backend` | **38 / 116 / 128 条断言** |
| `npm run build:report --prefix backend` | 通过：HTML 719.4KB（736,639B）、PDF 1,079.9KB（1,105,831B，14 页）、flow PNG 567,720B |

### 偏差 / 说明

1. 真实预览只展示模板 pack 页面（如 `organization`），**不按 `design.json` 字段/列/操作重绘 pm-v3**；字段差异由线框/契约体现。完整所见即所得（Y2）未做。
2. `catalogRef` 只认当前应用类型页面库；跨类型/不存在 → 线框 + 提示；页面 chips 仍来自 `design.json`。
3. 预览模式风格固定为应用设计系统（原型 Tab 内不改风格）；缩放组仅线框显示；预览禁用 PNG 导出，自动导出（隐藏画布）不受影响。
4. `e2e:preview` 新增 6 条（内容仍渲染 + embed 隐藏切换器/角标 + 4 条审计），77→83；`e2e:p7-4b` 断言数不变。
5. 汇报材料为维持 PDF ≤14 页的既有构建阈值，P8-2 描述放在「示例界面」之后，并合并了少量重复段落（未删能力信息）；截图/流程图未重截。
6. 未改后端 `src/**`、DB/表、`templates/**`、需求模板中心、P7-4b 线框渲染逻辑（除模式切换/导出禁用）；未新增依赖/未 npm install；未启停 3300/4771；未读写真实 `data/`、`projects/`、`.env`；未调模型；未做 git。

### 未验证

- 真实 AFCenter 宿主 `pm-*`、EOS 运行态、真实 3300 切换后运行态。
- <768 移动端原型面板与 iframe 内交互（模板页面为 mock 数据）。
- 预览页面与 `design.json` 的字段级自动比对（Y2）。

### 环境确认

- 全部 e2e 使用临时目录与独立端口（p8-2 3445；p7-4b 3444；p3 3423；p2 3422；p4 3425），stub opencode，不调用模型；结束时端口已关闭、临时目录已清理。
- **真实 3300/4771**：当前**有监听**（PID 34988 `node dist/index.js` / 15628 `opencode serve`，启动 2026-11-20 10:35:47；**非本会话启停**）；**运行后端已是 P8-1**（app1 产物可证：`tokens.json` 含 P8-1 才引入的 `styleId: data-cyan`、`design-system.json` 用新风格路径、新建应用无「旧版兼容」；`backend/dist` 11:36 只是重建，后端 src 未变），`frontend/dist` 11:28 为 P8-2 且由 Express 静态托管**即时生效**，**P8-2 前端已生效、无需重启**；当前库为 P8-1 的 4 表新结构（app1 在其后创建），`apps>0` 正常，fail-closed 只针对旧 5 表结构 + `apps>0`。本会话未读写真实 `data/`/`projects/`/`.env`；未执行任何 git 操作、未调模型。

### 评审修正（2026-11-20）

**运行态更正（重要）**：上一轮误判为「旧后端进程 + 新前端静态资源」混合、需重启、`apps>0` 会 fail-closed——**不成立**。

- 3300 进程虽启动于 10:35:47，但 `projects/app1` 产物证明其**运行后端已是 P8-1**：`docs/design/MOD-001/tokens.json` 含 P8-1 才引入的 `styleId: data-cyan`；`docs/design/design-system.json` 使用新路径 `docs/design/template/styles/data-cyan/style.css`；新建应用无「旧版兼容」。`backend/dist` 11:36 只是重新构建（后端 src 未变）。
- `frontend/dist` 11:28 为 P8-2，由 Express 静态托管**即时生效**；**P8-2 前端已生效（用户截图的真实预览即证据），不需要为 P8-2 重启**。
- 当前库已是 P8-1 的 **4 表新结构**（app1 在其后创建），`apps>0` 对**新结构**是正常状态；`fail-closed` 只针对「旧 5 表结构 + `apps>0`」的旧库升级。
- 若后续改后端或切换构建，再按 ops 停/构建/启动；**重启始终由用户执行**。

文档口径统一（只改文档，未碰代码）：

- `docs/STATUS.md`：第 3 行、结论「真实实例」/「待用户执行」/「下一步」、P8-2 节未验证项改为上述事实——运行后端已是 P8-1、P8-2 前端已生效无需重启、4 表新结构 `apps>0` 正常、fail-closed 仅针对旧 5 表结构 + `apps>0`。
- `README.md`、`AGENTS.md`：真实 3300 段同步为上述事实。
- `docs/report/README.md`、`docs/report/ai-dev-workbench-overview.md`（版本行、§8 边界）：同步同口径。
- `docs/ops/switch-to-agent-first.md`：§0 当前状态、§2 停旧提示、§4 升级行为/`apps=0` 通过标准改为“仅旧 5 表结构升级要求 apps=0；新 4 表结构 apps>0 正常”；保留「切换/重启由用户执行、不自动切换/回滚」。
- `build:report` 重跑：通过，HTML 719.4KB（736,639B）、PDF 1,079.9KB（1,105,831B，**14 页**）、flow PNG 567,720B；截图/流程图未重截。
- 环境确认：未启停 3300/4771，未读写真实 `data/`/`projects/`/`.env`，未调模型，未做 git；本次仅改文档并重生成汇报材料。
