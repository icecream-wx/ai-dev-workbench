# 设计阶段后续优化（A/B 已实施，待评审；2026-11-24）

> 状态：**A/B 已实施（待评审，2026-11-24）**，实施记录见 `docs/plans/2026-11-24-design-pageset-tabs-and-overview-brief.md`。
> 当前实现：设计视图 = 左 AI 对话（可拖拽）+ 右主区（实体关系 / 页面集 / 接口设计）；中栏「页面集/实体」已删除；页面集 Tabs + 页面 Tabs（总览 + 页面），总览支持 PNG 下载（不持久化）。
> 本文保留原始目标/候选方案；已实现项见每节状态标注。

## A. 去掉中栏「页面集/实体」，页面集移到页面区域

> **已实施（待评审，2026-11-24）**：两级 Tabs（页面集 Tabs + 页面 Tabs）；ER 为完整一张图并保留搜索/筛选/字段面板；详见 O4 brief。

### 用户想法

- 设计阶段中间的「页面集/实体」栏没必要展示；
- 实体关系就是一个**完整的大 ER 图**，包含当前应用下全部实体，不需要再单独列实体；
- 页面集可以放到右侧主区（页面区域）里；
- 页面集导航考虑做成类似「订单列表 / 新建订单 / 订单详情」的可切换 Tab。

### 待讨论

- 页面集导航形态：
  - 页面集 Tabs + 页面 Tabs（两级 Tab）；
  - 页面集下拉/选择器 + 页面 Tabs；
  - 面包屑 / 树 / 左侧窄导航（但不再占一栏）；
  - 页面集很多时如何滚动、搜索、分组。
- 页面集信息展示：Epic 标题、页面数、主实体、当前页面集状态放在哪里。
- 实体列表去掉后：
  - ER 内是否保留实体搜索/筛选/选中？
  - 页面契约里如何快速定位到某个实体/字段？
  - 大 ER 图的缩放、平移、全览、筛选如何组织。
- 去掉中栏后主区变宽：
  - 页面集 Tab 与页面 Tab 的层级；
  - ER、页面预览、接口设计三个 Tab 是否仍保留；
  - 与「页面集全局预览」（B）如何共存。
- 与现有 `design-pageset-list`/`design-entities` testid、p3 e2e、UI 截图脚本的迁移。

### 参考

- 当前 `frontend/src/workbench/DesignView.vue`：中栏 `col-outline`（`design-pageset-list` / `design-entities`），主区三个 Tab。
- 图 1（用户截图）：当前「页面集/实体」中栏 + 右侧页面区域 + 页面 tabs（订单列表/新建订单/订单详情）。
- 可能涉及：`DesignView.vue`、`DesignErPanel.vue`、`DesignPrototypePanel.vue`、CSS、`e2e:p3`、UI 截图脚本。

## B. 页面集全局预览 / 总览

> **已实施（待评审，2026-11-24）**：页面 Tabs 第一项「总览」+ 2 列卡片网格（模板 iframe）+「导出页面集总览 PNG」（先下载，不写 prototypes 持久化）。
> **2026-11-24（本轮 B3）**：总览已升级为**在线画布**——点阵背景 + 1440×900 artboard，支持缩放/平移/适应窗口，点击进入单页；导出仍为 2 列拼图（`composeOverviewPng`/`overviewLayout` 不变）。详见 `docs/plans/2026-11-24-requirements-ask-ai-er-zoom-overview-canvas-brief.md`。

### 用户想法

- 当前 PNG 导出只针对单个页面；
- 希望以**页面集为粒度**，把一个页面集下的所有页面做成图片放在一起，类似设计画布/白板的总览效果；
- 也欢迎更好的方式。

### 候选方案（未定）

1. **应用内页面集总览画布**：网格/自由布局的页面 artboard，支持缩放/平移，点击进入单页；复用 `design-preview` 的模板原生渲染。
2. **页面集拼图导出 PNG**：按页面顺序生成 contact sheet（缩略图 + 页面名/类型/Epic 标签），一键导出；复用 `template-capture` 截图，不重新绘制。
3. **两者结合**：先有应用内总览，再一键导出总览 PNG；单页 PNG 保留。

### 待讨论

- 总览粒度：每个页面集一张 / 整个应用一张 / 两者都要。
- 页面布局：网格 vs 自由画布；列数、缩略图尺寸、是否显示页面名/类型/状态/主实体。
- 截图来源：模板原生截图 vs 线框/结构草图；无显式契约旧页面如何兜底。
- 技术边界：截图异步/超时、单页与总图大小限制（现有单页 5MB）、`designHash` 过期、页面很多时的分页/虚拟化。
- 导出：文件命名、manifest 字段、是否新增 `prototypes/overview-<pageSet>.png`，与现有 `prototypes/*.png` 的关系。
- 交互：只读总览 vs 可拖拽/缩放画布（类似图 2）；移动端如何展示。
- 与 A 的关系：页面集 Tab 切换后，总览是页面集的一个 Tab/入口，还是独立按钮。

### 参考

- `frontend/src/design/template-capture.ts`：单页模板风格截图。
- `frontend/src/design/design-export.ts`、`backend/src/design/prototypes.ts`：单页 PNG/manifest/designHash。
- `frontend/src/design-preview/**`：`design.json`/`pages.json` 的模板原生渲染。
- 图 2（用户截图）：设计画布/预览形态（非当前实现），可作为总览交互参考。

## 结论

A/B 已按两级 Tabs + 应用内总览 + 拼图下载实现（待评审）。**2026-11-24（本轮 B3）总览已升级为在线画布**（缩放/平移/适应窗口，不做自由拖拽/位置持久化），导出仍 2 列拼图。后续可选：总览持久化到 `prototypes/overview-*.png`、页面很多时的分页/虚拟化。
