# UI-1b 实施单：三视图排版/层级 + 去重复 chip + 技术摘要人话化 + 状态文案统一（2026-11-23）

> 产品方向沿用 **UI-1a 已确认的 A+B 混合、中等密度**。只做 UI-1b（视图内部排版/层级/文案），不做 UI-2（骨架屏/引导）、UI-3（表格/表单/聊天消息内部结构）、UI-4（模板中心/工作室内部）。
> **未改**后端/DB/API/依赖/`templates/**`/`design-preview`/`template-preview` 渲染；未启停真实 3300/4771，未调模型，未读写真实 `data/`/`projects/`/`.env`，未做 git。

## 1. 范围

| 类型 | 文件 |
| --- | --- |
| 改 | `frontend/src/workbench/view-helpers.js`（`statusLabel` 文案、`artifactSummary` 人话化） |
| 改 | `frontend/src/workbench/view-helpers.test.mjs`（同步断言） |
| 改 | `frontend/src/workbench/RequirementsView.vue`（toolbar 去 chip + 人话摘要 + `N 处待处理` + 字号/间距） |
| 改 | `frontend/src/workbench/RequirementsOutline.vue`（列表标题/meta/按钮字号、留白） |
| 改 | `frontend/src/workbench/RequirementsDocument.vue`（文档标题/元信息/TOC/正文留白、字号） |
| 改 | `frontend/src/workbench/DesignView.vue`（toolbar 去 chip + 人话摘要 + 模块卡/meta/按钮字号） |
| 改 | `frontend/src/workbench/DesignErPanel.vue`（ER 属性面板字号/间距） |
| 改 | `frontend/src/workbench/DesignPrototypePanel.vue`（页面 chip/只读模式/提示条字号） |
| 改 | `frontend/src/dev/DevView.vue`（头部去 app 名与 `build · 模型` 技术行、模型 chip、字号/间距） |
| 改 | `frontend/src/dev/SessionList.vue`（会话列表标题/meta 字号） |
| 改 | `frontend/src/dev/Composer.vue`（输入区字号/内边距） |
| 改 | `frontend/src/workbench/AgentChatPanel.vue`（仅头部/空态/输入区/消息正文字号与间距） |
| 新增 | `backend/scripts/ui1b-shots.ts`（stub 后端 + 独立端口 3433 的三视图证据截图脚本） |
| 新增 | `docs/plans/evidence/2026-11-23-ui1b/*.png`（11 张常驻截图） |
| 新增 | 本文件 |
| 未改 | `theme.css`（UI-1a 的 token 已够用，未新增/未改语义）、`templates/**`、`design-preview`/`template-preview`、Studio/模板中心内部、表格/表单/聊天消息 DOM 结构、业务逻辑/数据流/testid/导航/会话/权限/表单/停止/compact 行为 |

## 2. 文案与层级

### 2.1 状态文案统一

- `view-helpers.js#statusLabel`：`requirements → 需求中`、`design → 设计中`、`development → 开发中`、`completed → 已完成`（与 `AppShell` 的 `STATUS_CHIP` 一致）；未知仍回「需求中」。
- `viewLabel` 未改（导航仍是 需求/设计/开发）。
- 使用处：`AppShell`（兜底）、`HomeShell` 应用卡状态 chip；首页/外壳/视图不再出现「需求视图/设计视图/开发视图」。

### 2.2 去重复 chip + 技术摘要人话化

- 需求视图：删除 `需求视图` chip；`artifact-summary` 文案 `模块 X · 设计 Y` → **`X 个模块 · Y 个设计`**；错误不再塞进摘要，改为独立 `artifact-issues` 文案 **`N 处待处理`**（明细仍在下方问题条）；保留 `sync-state`。
- 设计视图：删除 `设计视图` chip；保留模板徽标（`design-template-badge`，仍是「类型 · 风格」，可点开模板中心）；`design-summary` 仍为 `实体 X · 页面 Y` / `未生成设计`（p3 断言），错误改为 **`· N 处待处理`**；路径/刷新时间/`brief·tokens·原型` 状态仍在次级 meta 行。
- 开发视图：删除 `开发` chip 与 `build · opencode 默认模型` 原始技术行（`session.agent · provider/model` 收进模型 chip 的 tooltip）；头部保留 `☰`、会话标题（去掉「应用名 」前缀，应用名已在顶栏）、**模型 chip**（`模型 <modelId>`，tooltip 为 `agent · provider/model`）、模块选择（`dev-module-select`）、只读 chip；右侧保留上下文 chip、压缩、连接、运行状态（`dev-status`）、新会话、`▤`；`dev-module-empty`、`dev-model-chip` 等 testid 保留；详情仍在右侧「会话」`dl`。
- 路径/ID/端口等继续放 `title`/次级 meta（文档 meta 行、设计 meta 行、开发侧栏），不占主行。

### 2.3 字号/层级（中等密度，不改语义）

- 视图 toolbar 摘要/同步：11/10.5 → **12 / 11.5**；需求摘要 `12/600`、错误 chip `12`。
- 模块列表（需求大纲/设计模块）：标题 `12.5 → 13.5/600`、列表头 `12.5 → 13.5/600`、计数 `10.5 → 11.5`、key `code 10.5 → 11`、meta `10.5 → 11.5`、空态 `11.5 → 12`、按钮 `10.5/11 → 11.5/12`。
- 会话列表（开发）：标题 `12 → 13/600`、列表头 `12.5 → 13`、搜索 `11.5 → 12`、meta `10 → 11.5`、备注 `10.5 → 11.5`、状态 chip `9.5 → 10.5`、mini 按钮 `10 → 11`。
- 需求文档：`h1 16 → 18/650`、徽标 `10 → 11`、meta `10.5 → 11.5`、`doc-file` `10.5 → 11`、TOC `11 → 12`、正文 `MarkdownView` 保持 `13.5/1.75`（已是目标档）、`h2 16.5`/`h3 14.5` 未动；`doc-main` 内边距 `14/18/24 → 18/24/32`；设计摘要 `11.5 → 12`。
- 设计：ER 面板 `字段表 11.5 → 12`、实体名 `13 → 13.5`、tag `10 → 11`、关系 `11 → 12`、说明 `11.5 → 12`；原型面板页面 chip `11.5 → 12`、模式徽标 `10.5 → 11.5`、缩放 `10.5 → 11`、提示条 `11 → 11.5`；tab `11.5 → 12`、主头 meta `10.5 → 11.5`。
- 开发：`.dev-side h3 12 → 13/600`、`dl 11.5 → 12`、`dd.mono 10.5 → 11`、说明 `11 → 12`、文件变化 `10.5 → 11.5`、时间线正文 `12.5 → 13.5`、空态 `12 → 12.5`、只读条 `11.5 → 12.5`、`code 11 → 11.5`；`AgentChatPanel` 头部 `12.5 → 13.5/600`、状态/上下文 chip `10.5 → 11.5`、消息正文 `12.5 → 13.5`、空态/说明 `11.5 → 12`、命令提示 `10 → 11`、只读条 `11.5 → 12`；`Composer` 输入 `13 → 13.5`、提示 `10.5 → 11.5`。
- 空态/错误/加载：只调字号/留白/标题层级（`center-card 12.5 → 13`、`empty h2 17/18`、`empty-main 12.5 → 13`），**未新增骨架屏/引导**（UI-2）。

## 3. 响应式

- 1024/390 保留原抽屉/折叠行为（需求大纲/对话抽屉、设计模块/对话抽屉、开发会话/信息抽屉与 `☰`/`▤`、Esc 关闭）。
- 开发头部 `.dev-actions` 增加 `flex-wrap + min-width:0 + max-width:100%`：390 下按钮换行不再被裁切（修复本轮截图发现的「新会话」被切掉）。
- 三视图在 1440/1024/390 均无整页横向溢出（截图脚本逐屏校验 `documentElement/body scrollWidth`）。

## 4. 验证（全部实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | **183/183**（`statusLabel`/`artifactSummary` 断言已按新文案更新） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 成功（exit 0） |
| `npm run check:vue --prefix frontend` | 通过（全部 SFC 导入完整） |
| `npm run e2e:p2 --prefix backend` | **116**（保持） |
| `npm run e2e:p3 --prefix backend` | **126**（保持） |
| `npm run e2e:p4 --prefix backend` | **130**（保持） |
| `npm run e2e:p7-3b --prefix backend` | **77**（保持） |
| `npm run e2e:p7-7b --prefix backend` | **73**（保持） |
| `npx tsx scripts/ui1b-shots.ts`（backend，stub） | 11 张截图 + **9 次无溢出校验**通过 |

- 全部 e2e 使用临时目录 + 独立端口（3422/3423/3425/3429/3431）+ stub opencode（`OPENCODE_AUTO_START=false`）；结束核对测试端口无残留监听，真实 3300/4771 未启停。
- 未跑 `e2e:p9/p10`：本轮未改 `design-preview`/`template-preview` 渲染与相关 CSS（设计视图只改外层 toolbar/侧栏/面板字号），预览 iframe 不受影响；p3/p7-3b 内的预览断言本轮已通过。
- 未跑后端单测：未改 `backend/src`（只新增 `backend/scripts/ui1b-shots.ts` 截图脚本）。
- `build` 重新生成 `frontend/dist`（Express 静态托管即时生效，运行中的真实实例刷新可见）；未改 `backend/dist`、未重启实例。

## 5. 截图（`docs/plans/evidence/2026-11-23-ui1b/`）

- 1440：`ui1b-requirements-1440.png`、`ui1b-design-1440.png`、`ui1b-development-1440.png`
- 1440 深色：`ui1b-requirements-1440-dark.png`、`ui1b-design-1440-dark.png`
- 1024：`ui1b-requirements-1024.png`、`ui1b-design-1024.png`、`ui1b-development-1024.png`
- 390（844 高）：`ui1b-requirements-390.png`、`ui1b-design-390.png`、`ui1b-development-390.png`

## 6. 偏差

1. 需求 toolbar 摘要用「X 个模块 · Y 个设计」而非「MOD-001 · 商品管理」：模块 key/标题已在文档头展示，避免重复。2. 设计 toolbar 保留「类型 · 风格」徽标（p3 断言其含「 · 」）但降为次级字号，无重复「设计视图」chip。
3. 开发头部的会话标题去掉了后端默认标题里的「应用名 」前缀（`appName` 已在顶栏），完整标题保留在 `title` tooltip 与左侧会话列表；无会话时头部显示「开发」。
4. `theme.css` 未新增 token（UI-1a 的 type scale/spacing 足够），视图内沿用 px 便于逐处微调。
5. `artifactSummary` 不再包含错误数（错误数改为视图内独立 `N 处待处理`），单测同步修改。

## 7. 未验证

- 真实 3300/4771 未启停：视觉需用户 `restart.cmd`/`restart.sh` 后在真实浏览器复核。
- 未做像素级视觉回归（无视觉快照）；1024—768 间的中间宽度仅按现有断点推断。
- UI-2（空态骨架屏/引导）、UI-3（表格/表单/聊天消息内部结构）、UI-4（模板中心/工作室内部）未做。
