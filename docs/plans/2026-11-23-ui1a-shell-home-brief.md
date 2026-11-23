# UI-1a 实施单：设计 token + 应用外壳 + 首页（2026-11-23）

> 产品方向：**A+B 混合**（企业级冷静外壳 + AI 原生引导），**中等密度**。只做 UI-1a，不做 UI-1b/UI-3。
> 允许调整 DOM 结构，但**不改功能/数据流**。**未改**后端/DB/API/依赖/`templates/**`；未启停真实 3300/4771，未调模型，未读写真实 `data/`/`projects/`/`.env`，未做 git。

## 1. 范围

| 类型 | 文件 |
| --- | --- |
| 改 | `frontend/src/shared/theme.css`（type scale / spacing / 语义类 / body 14px-1.6） |
| 改 | `frontend/src/workbench/AppShell.vue`（顶部应用栏三区） |
| 改 | `frontend/src/workbench/HomeShell.vue`（概览式两栏） |
| 改 | `backend/scripts/design-template-e2e.ts`（p7-3b：首页/外壳/390 断言 + UI-1a 截图） |
| 新增 | `docs/plans/evidence/2026-11-23-ui1a/*.png`（常驻截图证据） |
| 新增 | 本文件 |
| 未改 | `RequirementsView`/`DesignView`/`DevView`/`Studio`/模板中心内部布局；表格/表单/聊天内部；业务逻辑；`api.ts`（现有 `AppInfo`/`AppDesignSystemSummary` 类型已够用，未加接口） |

## 2. 设计 token（`theme.css`）

- type scale：`--rg-font-display: 26px`、`--rg-font-page-title: 20px`、`--rg-font-section: 15px`、`--rg-font-body: 14px`、`--rg-font-caption: 12px`、`--rg-font-mono: 12px`；行高 `--rg-leading-title: 1.3`、`--rg-leading-body: 1.6`、`--rg-leading-caption: 1.5`。
- spacing：`--rg-space-1..7 = 4/8/12/16/24/32/48`。
  - **偏差**：规范写“`--rg-space-1..6` = 4/8/12/16/24/32/48”（6 个名字给了 7 个值），实现补一档 `--rg-space-7: 48px`，1..6 保持 4/8/12/16/24/32。
- `body` 字号 **13 → 14px**、`line-height: 1.6`；`html.dark` 色板未改（不新增渐变/彩色块）。
- 新增 workbench 语义类（只在本轮外壳/首页使用）：`.rg-page-title`、`.rg-section-title`、`.rg-caption`、`.rg-meta`；`.rg-mono` 保持原有等宽语义（未改其 font-size）。
- Element Plus `--el-font-size-base` 仍为 13px（EP 组件不随 body 变化）。

## 3. 应用外壳（`AppShell.vue`）

- 顶部应用栏约 **56px**，三区：
  - 左：`←` 图标按钮（`ArrowLeft`，`aria-label="返回应用列表"`）+ 首字母标识 + 应用名（14/600，超长省略）+ 状态 chip（`app-status`）。`appId` 不再作为主行 raw 文本，只在应用名 `title`（`名称（appId）`）里。
  - 中：三段视图导航（需求/设计/开发），保留文本 + 小图标（`Document`/`Brush`/`Monitor`），`nav[aria-label="应用视图"]`、`data-testid="app-view-nav"`；active 用 2px 墨色下划线 + 图标 AI 紫；点击仍 `navigate(view)` → 仍调用 `setAppView`。
  - 右：设计模板/风格 chip（原 `requirementLabel`，截断 + `title` 显示完整，`app-design-chip`）、模型按钮（原 `SettingsDialog` 入口，保留“模型”文案）、主题图标（原切换逻辑/aria-label）、`⋯` 更多菜单（`el-dropdown` + `MoreFilled`，`data-testid="app-more"`）内含「设置」与危险项「删除应用」（`app-delete`）。
- 删除应用**只**在更多菜单里（主栏不再有删除按钮），确认框与 `deleteApp` 逻辑不变。
- 状态 chip 文案用「需求中/设计中/开发中/已完成」（`statusLabel` 作为兜底），避免与视图自身标题栏的“需求视图”重复。
- 响应式：≤1024 视图导航换行成第二行、隐藏设计模板 chip、收紧间距；≤560 隐藏状态 chip、应用名进一步截断；390 无横向溢出，「更多」可用。

## 4. 首页（`HomeShell.vue`）

- 顶部品牌区：`AI` 方标 + 「智能开发工作台」+「需求 → 设计 → 开发」副标题 + 主题切换；不放大 hero 动作。
- hero：`h1` **保留「从一个应用开始」**（p7-3b 既有断言依赖），一句价值说明 + 主 CTA「新建应用」（`home-new-app`）+ 次级「模板库」「设计模板」（保留原 `home-template-library` / `home-design-templates` testid，且各只有 1 个元素带该 testid）。
- 主区两栏 `max-width: 1120px`，`minmax(0,1fr) / 320px`，≤1024 单列：
  - 左「最近应用」：应用卡 = 首字母 + 名称 + 状态 chip + 需求/设计模板摘要（`home-app-templates`，仍含“设计模板：类型 · 风格”）+ 更新时间；hover/focus 显示「打开」与「更多（删除应用）」（`el-dropdown`）；整卡点击/回车/空格仍打开应用，删除确认逻辑不变。空态 `home-empty`：3 步引导（建应用 → 选模板 → 对话）+ 「新建应用」。列表仍按 `updatedAt` 排序（后端原有顺序，未新增接口/未编造活动）。
  - 右列「快捷开始」：新建应用 / 模板库 / 设计模板三个轻量入口（无 testid，避免与 hero 重复）；底部「运行状态」compact：状态点 + 已连接/未启动 + 版本，端口/CLI/事件流收进 `<details data-testid="home-runtime-diagnostics">诊断</details>`；刷新 / 启动 opencode 功能保留（API 未改）。

## 5. e2e（`backend/scripts/design-template-e2e.ts`，p7-3b）

只新增必要断言，旧断言全部保留：

- 首页：`home-new-app`、`home-empty`（3 步）、`快捷开始`、`home-runtime` 状态文案、诊断默认折叠且端口/事件流默认不可见。
- 应用外壳：返回按钮（`aria-label`）、`app-view-nav` 三段、`app-status`、模型/主题/`app-more`；打开更多后 `app-delete` 可见（此前在主栏不可见）。
- 390×844：首页与应用外壳均无整页横向溢出、应用名截断宽度受限、「更多」在视口内且菜单可打开。
- 截图（写入 `P7_3B_SHOTS_DIR`，默认 `%TEMP%\opencode`）：`ui1a-home-empty-light.png`、`ui1a-home-light.png`、`ui1a-home-dark.png`、`ui1a-app-shell.png`、`ui1a-app-shell-more.png`、`ui1a-mobile-home.png`、`ui1a-mobile-shell.png`；常驻副本见 `docs/plans/evidence/2026-11-23-ui1a/`。
- 输出追加 ASCII `assertions=`，便于记录实际断言数（中文输出在 PowerShell 下有编码歧义）。

## 6. 验证（全部实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | **183/183** |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 成功（exit 0） |
| `npm run check:vue --prefix frontend` | 通过（全部 SFC 导入完整） |
| `npm run e2e:p2 --prefix backend` | **116**（保持） |
| `npm run e2e:p3 --prefix backend` | **126**（保持） |
| `npm run e2e:p4 --prefix backend` | **130**（保持） |
| `npm run e2e:p7-3b --prefix backend` | **77**（原 55，+22） |
| `npm run e2e:p7-7b --prefix backend` | **73**（保持） |

- 全部 e2e 使用临时目录 + 独立端口 + stub（p7-3b 为 `OPENCODE_AUTO_START=false`）；结束核对仅真实 **3300（PID 39828）/4771（PID 19608）** 在监听，无测试端口残留。
- 未跑 `e2e:preview`：`theme.css` 只被工作台 `App.vue` 引入，`preview.html`/`design-preview.html`/`template-preview.html` 使用各自 CSS，token 不影响预览；p7-3b 内的 iframe 预览已在本次运行中通过。
- 未跑后端单测：未改 `backend/src`（只改 `backend/scripts` 断言）。

## 7. 偏差

1. spacing 命名 1..7（见 §2），规范 1..6 给了 7 个值。
2. 首页 `h1` 仍为「从一个应用开始」（p7-3b 既有断言）；品牌 wordmark 在顶部改为「智能开发工作台 + 需求 → 设计 → 开发」。
3. 首页「新建应用」在 hero 与空态/快捷开始各有一个按钮（语义入口重复是设计意图）；带 testid 的只有 hero 一个。
4. 外壳状态 chip 用「需求中/设计中/开发中/已完成」而非 `statusLabel()` 的“需求视图”，避免与视图标题栏重复。
5. 多菜单关闭在 e2e 里用“点击外壳空白处”而不是 `Escape`（Element Plus `el-dropdown` 实测不响应 Escape 关闭）。
6. `el-dropdown` 菜单是 teleport 到 body 的弹层：断言用“可见性”而不是“DOM 计数存在”判断主栏是否有删除项。

## 8. 未验证

- 真实 3300/4771 的视觉需用户 `restart.cmd`/`restart.sh` 后在真实浏览器复核（本轮未启停）。
- 只验证 1440/1024/768（p2 矩阵）与 390×844（p7-3b）结构断言，**未做像素级视觉回归**（无视觉快照）。
- 1024→768 之间的首页两栏堆叠/卡片排布为目测实现，无逐断点截图。
- UI-1b（视图内部布局/表格/表单/聊天）、UI-3（模板中心/工作室内部）未做。
