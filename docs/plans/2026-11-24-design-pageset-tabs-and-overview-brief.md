# 设计视图页面集 Tabs + 总览（O4）实施 brief（2026-11-24）

> 状态：**已实施（待评审）**。范围：去掉设计中栏「页面集/实体」、页面集两级 Tabs、页面集总览与总览 PNG 下载、回归与文档。
> **2026-11-24（后续 B3）**：总览已升级为**在线画布**（点阵 + 1440×900 artboard，缩放/平移/适应窗口）；导出仍 2 列拼图。见 `docs/plans/2026-11-24-requirements-ask-ai-er-zoom-overview-canvas-brief.md`。
> **未调真实模型、未启停真实 3300/4771、未读写真实 `data/`/`projects/`/`.env`、未做 git。**

## 1. 决策

- 设计布局 = 左 AI 对话（可拖拽）+ 右主区；删除中栏「页面集/实体」。
- 实体关系 Tab = 应用全部实体一张 ER；保留 ER 内搜索、页面集筛选、选中看字段。
- 页面集放进「页面集」主区：第一行页面集 Tabs（Epic + 页面数，横向滚动）；第二行页面 Tabs（`总览 | 页面...`）。
- 默认选中页面集第一个页面；「总览」为页面 Tabs 第一项，点击进入总览。
- 总览：全部页面卡片网格（模板原生 iframe `embed=1`，无显式契约徽标）；点击卡片进入单页；提供「导出页面集总览 PNG」。
- 总览导出：逐页复用单页截图（模板优先，无契约/失败隐藏 PrototypeCanvas 线框兜底，scale 1），canvas 2 列 contact sheet，下载 `<pageSetId>-overview.png`；**不写 prototypes 持久化**（后续可选）。
- 聊天 `otherMinWidth = 520 + 6`；默认 380 / min 300 / max 560；窄屏只有对话左抽屉（页面集抽屉删除）。
- 页面集/页面 Tabs 横向滚动，不整页溢出。

## 2. 改动

### A. 布局/导航

- `DesignView.vue`：删除中栏 aside（`design-pageset-list`/`design-entities`/`col-outline`/`outlineOpen`/`toggleOutline`/`design-outline-toggle`/`selectedEntityId`/`selectEntity`）；`.design-body` 改为 `var(--chat-width) 6px minmax(0,1fr)`；≤1024 单列 + 对话左抽屉；页面集 Tabs 放在页面集 Tab 主区（`design-pageset-tabs` + `design-pageset-<id>`，横向滚动）；三 Tab/摘要/生成/导出/刷新保留。
- `DesignPrototypePanel.vue`：页面 chips 改页面 Tabs（`rg-tab` + 保留 `page-chip-<id>` testid，横向滚动）；第一项「总览」（`prototype-overview-tab`）；单页模式保留 iframe/结构草图/导出 PNG；页面集切换重置到第一页。
- 新增 `PageSetOverview.vue`：页面集/Epic/页面数 + 导出按钮（进度/错误）；2 列卡片网格（≤900 1 列）；每页模板 iframe（`loading=lazy`、`overview-frame-<id>`）、页面名/类型/recipe、无显式契约徽标；空态 `overview-empty`；iframe 失败显示说明。
- ER/接口 Tab 与单页预览 URL/PNG 逻辑保留；ER 全宽无横向溢出。

### B. 总览导出

- 新增 `frontend/src/design/overview-layout.js`（纯 `overviewLayout`/`overviewFileName`/`downloadDataUrl`，供单测）与 `overview-export.ts`（canvas 合成 `composeOverviewPng`；失败页占位 + 错误文案）。
- `DesignView.vue` 抽出 `capturePageForExport(page, scale)`：模板截图优先 → 隐藏 `PrototypeCanvas` + `captureElementPng` 兜底；单页/整包导出复用它（scale 2），总览使用 scale 1。
- 总览导出由父层执行（发起时页面快照），`PageSetOverview` 只 emit；不写后端/manifest。
- 自动导出与总览导出互斥保护（`overviewExporting`）。

### C. 测试/截图

- 前端单测：`overview-layout.test.mjs`（2 列/空集合/单列/文件名/下载安全）。
- `e2e:p3`：无 `design-pageset-list`/中栏；聊天左、主区右；页面集 Tabs/页面 Tabs/总览卡片/iframe；总览下载文件名与非空；实体 Tab 完整 ER（搜索/字段面板）；接口 Tab；1024/768 只有对话左抽屉、Tabs 横向滚动、无整页溢出。
- `e2e:p9/p10/p7-4b/p7-7c/api-design` 调整“先切页面集 Tab、再点页面集”的顺序并回归。
- UI 截图 ui1b/ui2a/ui2b/ui3a/ui3b 更新并实跑。

### D. 文档

- 新增本 brief；更新 `2026-11-23-next-design-optimization-backlog.md` 状态（A/B 已实施/待评审）；`docs/STATUS.md`、`docs/plans/README.md`、`AGENTS.md`/`README.md` 当前布局/总览口径；`docs/report/**` 未更新。

## 3. 命令与结果（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix backend`（临时 RG 目录） | **235 / 235** |
| `npm test --prefix frontend` | **191 / 191**（新增 overview-layout 5 项） |
| `npm run typecheck --prefix frontend` / `check:vue` | 通过 |
| `npm run build --prefix backend` / `frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过 |
| `npm run smoke:assets --prefix backend` | 通过（opencode 2.2.5 / 4719） |
| `e2e:p2` | **95** 条断言 |
| `e2e:p3` | **151** 条断言 |
| `e2e:p4` | **135** 条断言 |
| `e2e:preview` / `p7-3b` / `p7-4b` | **93 / 77 / 57** |
| `e2e:p9` / `p10` / `p7-6a` | **69 / 81 / 21** |
| `e2e:p7-7b` / `p7-7c` / `api-design` | **73 / 118 / 26** |
| UI 截图 | ui1b **11** / ui2a **10** / ui2b **7** / ui3a **13** / ui3b **23**，均无溢出失败 |

## 4. 偏差

- 总览导出先做**下载**，不写 `prototypes/**`、不新增后端接口（按要求，记录为后续可选持久化）。
- 页面 Tabs 同时保留 `page-chip-<id>` testid（并加 `rg-tab` class），避免 p9/p10 大量选择器重写；页面 Tab 容器 `prototype-pages` 保留。
- 页面集 Tabs 只在「页面集」Tab 内渲染（ER/接口 Tab 不显示），与“页面集放到页面区域”一致。
- 总览卡片 iframe 不保证每页加载成功；失败显示说明并可点击进入单页（不白屏）。
- 单页截图 helper 改为共用，单页/整包自动导出行为与 manifest 不变。
- p3 总览下载测试给 120s 超时（模板截图/线框兜底 + canvas 合成较慢）。
- `p9` 实跑 **69**（原 79 中的 10 条中栏/页面集导航断言已由 p3 151 覆盖；核心 tree-list/list/dialog-form/detail/legacy 预览断言保留）；文档按实际数字记录，不沿用旧基线。

## 5. 未验证

- **真实模型闭环未执行（需用户另行授权）**。
- 真实 3300/4771 视觉验收：本轮只读核对；结束时（2026-11-24 09:31）**已无 3300/4771 LISTEN**（用户停止，非本轮启停）；上一运行进程早于本轮构建，需用户 `restart.cmd`/`restart.sh` 后再验收。
- `docs/report/**` 未更新/未重截。
- 真实 AFCenter 宿主 `pm-*`、EOS 构建/运行、真实 401/403 未验证；旧应用硬切不提供迁移。
