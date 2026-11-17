# 视觉/响应式/深浅色打磨 V1 实施交接单

日期：2026-11-11
用途：**新开实施会话**使用；主会话负责设计/评审。
状态：**已完成（2026-11-11，实施会话）**；实施结果见 §8。
范围：**V1**——主题系统 + 深浅色切换 + 应用外壳/首页/设置/通用弹窗的视觉与响应式。V2（需求/设计）、V3（开发页 + 全量截图）后续单独交接。

---

## 1. 目标与原则

- 只做视觉/样式/响应式/可访问性，**不改业务行为、接口、数据**。
- 延续现有设计语言：墨色主操作 + AI 紫标识 + 语义色只用于状态；紧凑、分层、克制，不做彩色渐变/大圆角/装饰性动效。
- 深浅色必须**都可用**：同一组件在两套主题下文字/边框/背景/状态色对比度足够；Element Plus 弹层/表单/表格随主题。
- 响应式断点：1440（默认）、1280（紧凑）、1024（两栏折叠）、768（单栏/抽屉）。
- 不引入新 UI 库/重依赖；优先 CSS 变量 + 现有 Element Plus。

---

## 2. 主题系统（shared/theme.css + settings/store）

1. 扩展语义 token（浅色/深色各一套）：
   - `--rg-bg`、`--rg-surface`、`--rg-surface-2`、`--rg-fill`、`--rg-fill-2`、`--rg-border`、`--rg-border-strong`
   - `--rg-text`、`--rg-text-2`、`--rg-text-3`、`--rg-link`
   - `--rg-ink`/`--rg-ink-hover`、`--rg-ai`/`--rg-ai-soft`
   - `--rg-ok/warn/danger` + `-soft`
   - `--rg-overlay`（遮罩）、`--rg-code-bg`、`--rg-code-text`、`--rg-focus-ring`、`--rg-scrollbar`
   - 现有 token 名尽量保留，避免大范围破坏。
2. Element Plus 深色补齐：`--el-bg-color-page`、`--el-bg-color`、`--el-bg-color-overlay`、`--el-fill-color-blank`、`--el-fill-color`、`--el-fill-color-light/lighter/dark`、`--el-mask-color`、`--el-disabled-bg-color`、`--el-text-color-*`、`--el-border-color-*`；确保对话框/下拉/表格/输入/复选框在 `html.dark` 下不出现白底。
3. `html { color-scheme: light/dark }`，原生滚动条/表单控件跟随。
4. `settings/store.ts`：
   - 增加 `setTheme(mode)`、`toggleTheme()`；持久化 `rg.theme`；
   - 初始值：`localStorage` → `prefers-color-scheme`（dark/light）→ light；
   - 保留现有 `theme` ref 与 `applyTheme`。
5. 切换入口：
   - `AppShell.vue` 顶栏加一个轻量按钮（`深色`/`浅色` 或太阳/月亮，带 `aria-label`/`title`），调用 `toggleTheme`；
   - `SettingsDialog.vue` 增加“外观”区块（浅色/深色 单选或分段控件），与顶栏同步。

---

## 3. V1 页面/组件（token 化 + 响应式）

替换硬编码颜色（`#fff`、`#1d2129`、`#f6f7f9`、`#fafbfc` 等）为 token：`HomeShell`、`AppShell`、`NewAppDialog`、`SettingsDialog`、`ChangeSetStartDialog`、`ChangeSetHistoryDialog`、`DesignHandoffDialog`、`VersionHistoryDialog`、`DesignVersionsDialog`、`MarkdownView`（代码块/引用）。

具体要求：

- `HomeShell`：
  - 页面背景/卡片/状态徽标/空状态 token 化；
  - 应用卡片网格 `repeat(auto-fill, minmax(320px, 1fr))`；768 单列；
  - 顶栏（标题/运行时状态/新建）在窄屏换行不溢出；按钮触达 ≥32px。
- `AppShell`：
  - 顶栏三段（返回/标题/阶段栏/操作）在 1280/1024 下换行或横向滚动；操作按钮不被挤出；
  - 阶段栏水平滚动、当前阶段清晰；chip/状态文本深色可读；
  - 主体高度 `min-height:0`，内部滚动不撑破页面。
- `NewAppDialog`：
  - 宽度 `min(720px, calc(100vw - 32px))`；`max-height: calc(100vh - 48px)` + 内容滚动；窄屏单列；
  - 输入/提示/错误/高级折叠 token 化；深色下 placeholder/边框可读。
- `SettingsDialog`：外观区块；模型列表/提示/错误 token 化；深色下标签/占位/下拉可读。
- 通用弹窗（ChangeSetStart/History、DesignHandoff、VersionHistory、DesignVersions）：
  - 背景/边框/文字/代码块/表格/状态 chip token 化；
  - `max-height` + 内部滚动；窄屏宽度自适应；
  - 深浅色下代码/`<pre>`/JSON/SQL 预览可读。
- `MarkdownView`：标题/正文/引用/表格/代码块 token 化；深色代码块背景/文字对比度。

---

## 4. 响应式与可访问性

- 断点：`@media (max-width: 1280px)`、`(max-width: 1024px)`、`(max-width: 768px)`；优先用 `clamp()`/`min()`/`grid` 自适应。
- 所有图标按钮有 `aria-label`/`title`；键盘焦点可见（`--rg-focus-ring`）。
- 文本对比度：深色下 `--rg-text-3` 至少用于次要信息，不用于关键操作。
- 滚动条：细、随主题（webkit + Firefox `scrollbar-color`）。

---

## 5. 验证

- `npm run typecheck --prefix frontend`、`npm run build --prefix frontend`、`npm test --prefix frontend`、`node check-vue-imports.cjs`。
- Playwright（临时数据，不依赖模型）：
  - 浅色/深色 × 1440/1024/768 截图：首页、应用外壳（需求阶段）、设置弹窗、新建应用弹窗、变更历史、交接包弹窗、版本弹窗；
  - 切换主题后刷新保持；0 console error / 0 非预期 API >=400；
  - 检查深色下无白底弹窗/输入/表格，窄屏无横向溢出。
- 截图放 `C:\Users\icecream\AppData\Local\Temp\opencode\visual-v1\shots\`（命名含主题/宽度/页面）。
- 不改后端；`npm test --prefix backend` 作为基线可不跑。

---

## 6. 不做 / 边界

- 不改业务逻辑/接口/数据/交接包/版本语义。
- 不做需求文档、设计 Studio、开发页的深度视觉改造（V2/V3）。
- 不做视觉重构/换设计语言；不引入新 UI 库。
- 不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交。

---

## 7. 文档

更新 `docs/STATUS.md`（「视觉 V1 完成」+ 摘要表）、本交接单状态/实施结果、`AGENTS.md`（V1 完成、下一步 V2）、`docs/plans/2026-11-11-main-review-handoff.md`。

完成后回传：改动文件、token/主题方案、截图清单、验证结果、深浅色/窄屏遗留问题、V2 建议。

---

## 8. 实施结果（2026-11-11，实施会话）

### 8.1 改动文件

| 文件 | 改动 |
| --- | --- |
| `frontend/src/shared/theme.css` | 补齐浅/深语义 token；Element Plus 变量映射；`color-scheme`；深色弹层/表格/输入/复选框兜底；`.el-dialog` 最大高度 + body 滚动；≤768 弹窗宽度；焦点环；主题滚动条 |
| `frontend/index.html` | 首屏前套用主题（localStorage → `prefers-color-scheme`）避免深色闪白；`#boot` 深色样式；`meta color-scheme` |
| `frontend/src/settings/store.ts` | `setTheme`/`toggleTheme`；初始值 localStorage → 系统偏好 → light；持久化 `rg.theme` |
| `frontend/src/App.vue` | 首屏创建 settings store，让首页也立即套用主题 |
| `frontend/src/workbench/AppShell.vue` | 顶栏主题按钮（`aria-label`/`title`，太阳/月亮）；全部颜色 token 化；1280/1024/768 响应式；按钮 32px 触达 + 焦点环 |
| `frontend/src/workbench/HomeShell.vue` | 顶栏主题按钮（便于首页切换）；全部颜色 token 化；应用列表卡片网格（320px auto-fill，768 单列）；键盘可聚焦；响应式 |
| `frontend/src/workbench/NewAppDialog.vue` | 宽度/高度自适应 + body 滚动 + sticky 操作区；输入/提示/错误/高级折叠 token 化；900/768 单列；关闭按钮 `title` |
| `frontend/src/settings/SettingsDialog.vue` | 新增「外观」分段控件（浅色/深色，`aria-pressed`）；宽度自适应；运行态/提示/错误 token 化 |
| `frontend/src/changesets/ChangeSetStartDialog.vue` | token 化（基准条/范围卡/警告/错误/按钮）；宽度自适应；640 单列 |
| `frontend/src/changesets/ChangeSetHistoryDialog.vue` | token 化（条目/状态 chip/差异 Markdown/按钮）；宽度自适应；body 高度自适应；768 元信息换行 |
| `frontend/src/design/DesignHandoffDialog.vue` | 全部 token 化（文件列表/预览头/代码块；PNG 纸面 `#fff` 保留）；宽度/高度自适应；≤820 纵向堆叠；关闭按钮 `title` |
| `frontend/src/requirements/VersionHistoryDialog.vue` | token 化；宽度自适应；≤820 版本列表横向滚动；源码块 code token |
| `frontend/src/design/DesignVersionsDialog.vue` | token 化；宽度自适应；≤820 纵向堆叠、版本列表横向滚动 |
| `frontend/src/requirements/MarkdownView.vue` | 标题/正文/引用/表格/代码/链接 token 化；表格隔行底色；深色代码块对比度 |
| 文档 | `docs/STATUS.md`「视觉 V1 完成」+ 摘要表；本文件 §8；`AGENTS.md`；`docs/plans/2026-11-11-main-review-handoff.md` |

未改后端、接口、数据库、交接包/版本语义；未动 `templates/eos-app`、`projects/`、`data/`、`.env`。

### 8.2 token / 主题方案

- 浅色：`bg #f4f5f7`、`surface #fff`、`surface-2 #fafbfc`、`fill #f4f5f7`、`fill-2 #eef0f4`、`border #e4e7ec`、`border-strong #d4d9e2`、`text #1f2937`、`text-2 #4b5563`、`text-3 #7c8595`、`ink #20242e`、`ai #5b5bd6`、语义色三套 + `-soft`/`-border`。
- 深色：`bg #11141b`、`surface #1a1e28`、`surface-2 #151a23`、`fill #20242f`、`fill-2 #262b38`、`border #2a303c`、`border-strong #3a4150`、`text #e6e9f0`、`text-2 #aab2c0`、`text-3 #8c95a6`、`ink #e3e6ee`（按钮文字 `--rg-ink-contrast #16181d`）、`ai #9a9af5`、`code-bg #12161e`。
- 弹层：`--el-bg-color-overlay` 深色取 `fill`（比页面亮一档），弹窗取 `surface`，输入取 `fill`；`--el-mask-color` = `--rg-overlay`。
- 主题来源：`rg.theme` localStorage；首次无存储时跟系统 `prefers-color-scheme`；`html.dark` + `color-scheme` 驱动原生控件与 Element Plus dark css-vars。

### 8.3 验证结果

- `npm run typecheck --prefix frontend` ✅
- `npm run build --prefix frontend` ✅（1832 modules；CSS 523.22 kB）
- `npm test --prefix frontend` ✅ 63/63
- `node check-vue-imports.cjs` ✅
- Playwright（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`，PORT=3400，`OPENCODE_AUTO_START=false`）：
  - 浅/深 × 1440/1024/768 各 7 页，42 张 + 3 张补充；0 console error / 0 page error / 0 意外 API≥400；
  - 深色弹窗、输入、下拉、ElMessageBox 无近白背景（脚本逐元素计算有效背景）；
  - 窄屏 `document/body/appbar` 横向溢出均为 0；
  - 顶栏按钮 ↔ 设置「外观」双向同步；刷新后保持；`prefers-color-scheme: dark` 且无存储时初始深色。
- 后端未改，`npm test --prefix backend` 未重跑（基线 113）。

### 8.4 遗留与 V2 建议

- 遗留：需求文档/设计 Studio/开发页仍为浅色硬编码 → 深色截图为“深色外壳 + 浅色正文”；`.el-table` 深色变量已映射但无 V1 实例；未监听系统主题实时变化；未覆盖 <768。
- V2 建议：
  1. 需求文档/对话气泡/章节编辑器/大纲用同一套 token；正文 markdown 与 AI 建议卡片深色补齐；表格/输入/复选框实机验证。
  2. 设计 Studio（实体/ER/页面原型/模板弹窗）token 化；wireframe 画布保持“白纸”但外框/工具栏随主题。
  3. 把 `.el-dialog` 的全局 flex/滚动改为可复用 `rg-dialog` 类，避免影响 V2 新弹窗的自定义高度。
  4. 主题偏好可加“跟随系统”三态（light/dark/system），需同步 `index.html` 首屏脚本。
  5. 深色下状态色（`--rg-ok/warn/danger`）与 AI 紫的对比度用自动化脚本做 WCAG AA 抽查。
