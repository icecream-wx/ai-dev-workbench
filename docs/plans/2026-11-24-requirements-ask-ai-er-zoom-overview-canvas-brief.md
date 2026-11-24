# 需求「问 AI」+ ER 缩放 + 页面集总览在线画布（B1—B3）实施 brief（2026-11-24）

> 状态：**已实施（待评审）**。范围：需求文档章节「问 AI」+ 隐藏章节上下文；ER 去页面集 chips、字段卡片上下分栏、Ctrl/⌘+滚轮/捏合缩放与适应窗口；页面集总览改为在线画布（缩放/平移/适应窗口），导出仍 2 列拼图。
> **后续变更（2026-11-24 B4）：ER 字段面板已由 B2 的底部上下分栏改为右上浮层 inspector（可收起为胶囊），缩放控件移到画布右下角；详见 `2026-11-24-er-inspector-and-design-preview-interaction-brief.md`。**
> **未调真实模型、未启停真实 3300/4771、未读写真实 `data/`/`projects/`/`.env`、未做 git、未改 DB/需求模板中心。**

## 1. 已确认决策

- 需求文档「问 AI」：h2 + h3 显示按钮；点击后对话区出现可移除「定位章节」chip 并预填默认提问；发送时带后端隐藏章节上下文（可见文本 + 隐藏上下文，方案 A）。
- ER：Ctrl/⌘+滚轮 + 触摸板捏合（ctrl+wheel）= 缩放（以光标为锚点）；普通滚轮 = 滚动；保留按钮式缩放并新增「适应窗口」。
- ER：删除「全部实体/EP-xxx」页面集 chips，保留实体搜索；字段卡片改上下分栏（画布 flex 撑满，字段面板限高内部滚动）。
- 页面集总览：在线画布（点阵背景 + 1440×900 artboard + 缩放/平移）；不做自由拖拽/不做位置持久化。
- 总览导出 PNG：保持现有 2 列拼图（`composeOverviewPng`/`overviewLayout` 不变）。

## 2. 改动

### B1 需求文档「问 AI」+ 章节上下文

- `frontend/src/workbench/requirements-helpers.js`：新增 `askableSections(toc)`（仅 h2/h3）、`sectionAskFocus(item)`（`kind:'requirements-section'`、anchor/title/level/key）、`sectionAskPrompt(item)`（空标题用「本章节」）。
- `RequirementsDocument.vue`：在 `applyHeadingAnchors` 后为 h2/h3 注入 `section-ask-ai-<anchor>` 按钮（`data-ask-anchor`），`.markdown-wrap` 事件委托 emit `ask-ai`；重渲染后重新注入、不重复；样式只用 `:deep(.section-ask)`，不改共享 `MarkdownView`。
- `RequirementsView.vue`：`@ask-ai` → 窄屏先开对话 → `chatRef.setSectionFocus(sectionAskFocus)` + `fillComposer(sectionAskPrompt)`（只填不发）。
- `AgentChatPanel.vue`：新增 `sectionFocus` 状态；Composer 上方「定位章节：<title>」chip（`chat-section-focus` / `chat-section-focus-clear`，只读会话不显示）；`send()` 带 `focus`；切换历史/新建会话成功后清空；`defineExpose.setSectionFocus`。
- `dev/types.ts`：新增 `RequirementSectionFocus`；`dev/api.ts`：`PromptOptions.focus` 仅在提供时进入请求体；`studio/api.ts` 忽略 focus。
- `backend/src/chat/service.ts`：导出 `RequirementSectionFocus`；`buildViewPrompt(view, text, { digest?, focus? })` 仅 requirements + 合法 focus 时在「用户消息：」之前插入「本轮聚焦章节…」；title 120 / anchor 80 字符、单行清洗；缺失/非法与既有输出完全一致。
- `backend/src/dev/routes.ts` `/prompt`：可选 `focus` 对象最小校验（对象、title/anchor 字符串、level 数字；非法 400）；`dev/service.ts` 透传到 `buildViewPrompt`（仅 requirements）。

### B2 ER：去页面集 chips + 字段卡片分栏 + 滚轮缩放

- `DesignErPanel.vue`：删除 `er-pageset-filter`/`er-pageset-all`/`er-pageset-<id>` 与 `activeSet`/按页面集过滤；`visibleEntities` 只按搜索过滤；删除 `pageSets` prop。`.er-panel` 固定高度 + `overflow:hidden`；`.er-canvas` `flex:1`、`min-height:280px`、内部滚动；`.field-panel` `flex:0 0 auto; max-height:42%; overflow:auto`，边框完整包住表格。
- `DesignView.vue`：删除 `erPageSets` 计算与 `:page-sets` 传参。
- `ErGraph.vue`：`.er-wrap` 高度改 `100%/min-height:0`（不再 `calc(100vh-340px)`）；缩放改为 − / 百分比 / + / 适应窗口（`er-zoom-out`/`er-zoom-in`/`er-zoom-value`/`er-zoom-fit`）；滚动容器监听 `wheel`（`{passive:false}`）——仅 ctrl/meta 时 `preventDefault` 并按 `anchorScroll` 修正滚动，普通滚轮交给容器滚动；适应窗口按容器/图尺寸计算（clamp 20—200）并复位滚动。
- 新增 `frontend/src/design/er-zoom.js`（`clampErZoom`/`applyErWheel`/`anchorScroll`）+ `er-zoom.test.mjs`（登记 `frontend/package.json`）。

### B3 页面集总览 → 在线画布

- `frontend/src/design/overview-layout.js`：新增 `overviewCanvasLayout(count, options)`（2 列 1440×900 artboard、标签 56、gapX 160/gapY 140/padding 160）、`clampOverviewZoom`（10—100）、`fitOverviewZoom`、`overviewZoomAt`（光标锚点）；`overviewLayout` 导出逻辑与行为不变。
- `overview-layout.test.mjs`：新增 4 条（世界坐标/空集合/zoom clamp+fit/锚点缩放）。
- `PageSetOverview.vue`：头部（页面集/Epic/页数/导出/进度/错误）保留；新增 `overview-zoom-out|in|value|fit`；主体 `overview-canvas`（点阵背景、`overflow:hidden`）+ `overview-stage`（`translate(pan) scale(zoom/100)`，origin 0 0）+ 每页 `overview-card-<id>` artboard（`overview-frame-<id>` iframe、`pointer-events:none`、`loading=lazy`、标题/类型/`无显式契约`、点击进单页）。Ctrl/⌘+wheel 光标锚点缩放；普通 wheel 平移；左/中键拖动平移（阈值 4px，拖动后抑制该次 click）；初始与「适应窗口」按画布尺寸 fit；不自由拖拽 artboard、不持久化。
- 导出流程不变（`DesignView` 的 `capturePageForExport` + `composeOverviewPng` 2 列拼图；不写 `prototypes/`）。

## 3. 命令与结果（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **238 / 238**（+3：buildViewPrompt focus 注入/忽略/清洗） |
| `npm test --prefix frontend` | **201 / 201**（原 191，+10：askableSections/sectionAskFocus/sectionAskPrompt 3 + er-zoom 3 + 总览画布 4） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run build --prefix backend` | 通过 |
| `npm run build --prefix frontend` | 通过（2857 modules） |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录 + 3416） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型） |
| `e2e:p2` | **105** 条断言（原 95，+10 章节「问 AI」） |
| `e2e:p3` | **168** 条断言（原 151，+17 总览画布/ER 去 chips/字段分栏/缩放） |
| `e2e:p4` | **135** |
| `e2e:preview` / `p7-3b` / `p7-4b` | **93 / 77 / 57** |
| `e2e:p9` / `p10` / `p7-6a` | **69 / 81 / 21** |
| `e2e:p7-7b` / `p7-7c` / `api-design` | **73 / 118 / 26** |
| `npx tsx scripts/ui3b-shots.ts` | **23 张截图 / 22 次无整页横向溢出 / 27 次口径测量**，无失败 |

e2e/截图均为临时目录 + 独立端口 + stub opencode（不调模型）；除 `smoke:assets` 使用真实 opencode 2.2.5（4719，不调模型）。

## 4. 偏差

- 章节「问 AI」的 e2e 放在 p2 第 12 段之后（而非文档加载后立即执行），因为提前发送会新增 assistant 消息，破坏既有「首条 assistant」流式断言；断言未削弱，仅调顺序。
- 发送按钮定位限制在 `chat-composer` 内并用 `exact: true`，避免命中空态 CTA「发送第一条消息」。
- 总览 artboard 内部字号按世界坐标（1440 宽）设计（标题 20px 等），画布缩放后视觉等比；不额外做响应式断点（≤1024 仍只有对话抽屉，总览画布按容器 fit）。
- `overview-zoom-at` 的 pan 不做边界夹取（仅 zoom clamp）；画布 `overflow:hidden`，平移越界仍可拖回。
- ER 字段面板 `max-height:42%`；≤768 画布 `min-height` 降为 220px，避免小屏被裁切过度。
- p10 仍 **81**（本轮未改 detail/dashboard/PNG 流程）；`ui3b-shots` 口径数与 O4 后的 23 张一致，未回到 UI-3b 的 24 张（中栏已删除）。

## 5. 未验证

- **真实模型闭环未执行（需用户另行授权）**：隐藏章节上下文对真实 agent 行为的影响只做静态断言。
- 真实 3300/4771 视觉验收：本轮只读核对（起止 PID 一致，未启停）；运行实例仍是旧构建，需用户 `restart.cmd`/`restart.sh` 后查看。
- 真实触摸板捏合：按浏览器 trackpad pinch → ctrl+wheel 处理，未在真实硬件验证。
- 总览大量 iframe 性能（多页面集/几十页）未压测；未做虚拟化/分页。
- PNG 导出仍为「非空 + 文件名」断言，未做像素级 diff；总览导出仍 2 列拼图（未跟随画布世界坐标，按决策）。
- `docs/report/**` 未更新/未重截。
