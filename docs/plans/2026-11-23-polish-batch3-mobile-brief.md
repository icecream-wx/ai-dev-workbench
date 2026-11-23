# 打磨批 3（2026-11-23）：移动端 <768 审计与修复（E）

> 实施状态：**已实施（待评审）**。只改前端 `StudioView.vue`/`DesignTemplateCenter.vue` + `backend/scripts/` 三个 e2e 断言 + 文档；未改 DB/API/依赖/backend `src`/`templates/**`；未启停真实 3300/4771，未调模型，未做 git。

## 目的

按“先测量、后修复、再加永久断言”的顺序，审计 390×844 / 414×896 / 768×1024 下的 4 类界面：

1. 模板工作室 `#/studio/<packId>`（`StudioView`：页面/对话/预览）；
2. 设计模板中心 browse 弹窗与新建应用 picker（`DesignTemplateCenter` / `NewAppDialog`）；
3. 设计视图「原型」Tab（`DesignView` + `DesignPrototypePanel` + `design-preview.html` iframe，含 contract 页）；
4. `template-preview.html`（自定义 reference/contract，embed=0/1）。

判定：整页 `documentElement.scrollWidth` 不得大于 `innerWidth`；关键按钮/面板可见可点；Studio 三块都必须可到达；iframe 内允许表格容器横向滚动，但不允许整页溢出。

## 测量结果（修复前）

| surface | 390×844 | 414×896 | 768×1024 |
| --- | --- | --- | --- |
| Studio | 整页无溢出；`预览` 面板 `display:none`，预览页下拉不可见；左 240px + 对话 150px（ cramped） | 整页无溢出；预览不可达；对话 174px | 整页无溢出；预览不可达；对话 528px |
| 模板中心 browse | 无溢出；关闭/搜索可见；标题列被「当前」挤窄（picker） | 同左 | 无溢出 |
| 新建应用 picker | 无溢出；`使用此模板` 可见可点（y≈794） | 同左 | 无溢出 |
| 设计视图「原型」 | 无溢出；原型 iframe 可见；iframe 内宽 = 364 | 无溢出；iframe 内宽 = 388 | 无溢出；iframe 内宽 = 742 |
| `template-preview` embed=1/0 | 无溢出 | 无溢出 | 无溢出 |

结论：**唯一硬问题是 Studio 在 ≤1180 隐藏预览**；模板中心/picker 390 下头部标题列可读性差（非溢出）；设计视图与 template-preview 通过。

截图：修复前 `%TEMP%\workbench-mobile-qbEIYe\`。

## 修复

1. **StudioView（≤1180）单栏 tab**：新增「页面 / 对话 / 预览」三个 tab（默认对话），三个面板 `pane-active` 单栏显示；预览必然可达，对话占满宽高；桌面 **>1180 三栏不变**（tab 隐藏、三栏同时显示）。不改 `AgentChatPanel`。
2. **DesignTemplateCenter（≤560）头部响应式**：头部换行、标题整行、`当前：…` 与关闭按钮第二行（关闭靠右）、搜索框撑满剩余宽度；仅 CSS，无行为/API 变化。
3. 设计视图/`ContractPage`/`template-preview`/模板页**无改动**（实测无整页溢出）。

新增稳定钩子：`studio-pane-tabs`、`studio-tab-pages|chat|preview`、`studio-pane-pages|chat|preview`。

## 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | **183 / 183** |
| `npm run typecheck --prefix frontend` | 通过（exit 0） |
| `npm run build --prefix frontend` | 成功（exit 0） |
| `npm run check:vue --prefix frontend` | 通过（全部 SFC 导入完整） |
| `npm run e2e:p7-3b --prefix backend` | **55**（原 42；+13） |
| `npm run e2e:p7-7b --prefix backend` | **73**（原 51；+22） |
| `npm run e2e:p7-7c --prefix backend` | **116**（原 108；+8） |
| `npm run e2e:p9 --prefix backend` | **70**（回归不变） |
| `npm run e2e:p10 --prefix backend` | **82**（回归不变） |

- e2e 均为临时目录 + 独立端口 + stub（p7-3b 使用 `OPENCODE_AUTO_START=false`）；结束后测试端口（3420—3500 / 4400—4900）无残留监听。
- 未跑后端单测（未改 `backend/src`）；未跑 `e2e:p2/p4`（工作台外壳未改）、`e2e:p3`（设计视图未改）。
- 修复后截图：`%TEMP%\workbench-mobile-G1vwRM\`；e2e 新截图：`workbench-p77b2b-shots\p7-7b2b-studio-mobile.png`、`workbench-p77c-shots\p7-7c-design-mobile.png`/`p7-7c-design-form-mobile.png`、`%TEMP%\opencode\p7-3b-mobile-picker.png`（临时，不入库）。

## 偏差 / 未验证

- 真实 3300/4771 未启停；移动端视觉需用户 `restart.cmd`/`restart.sh` 后在真实设备复核。
- 断言覆盖 no-overflow/可达性/关键按钮，不做像素级视觉回归；未验证 320px 及更窄视口。
- iframe 内表格按容器横向滚动处理；本轮实测 ContractPage 无整页溢出，故不改其移动 CSS。
- 未改 `DesignView`/`DesignPrototypePanel`，因此设计视图 surface 记录为“无改动”。
