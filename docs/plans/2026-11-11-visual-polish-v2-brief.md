# 视觉/响应式/深浅色打磨 V2 实施交接单

日期：2026-11-11
用途：**新开实施会话**使用；主会话负责设计/评审。
状态：**已完成（2026-11-11，实施会话）；待主会话评审**。实施结果见 §8。
范围：**V2**——需求文档 + 设计 Studio 的 token 化/深浅色/响应式。V1（主题/外壳/首页/设置/通用弹窗）已完成；V3（开发页 + 全量截图）后续。

---

## 1. 目标与原则

- 只做视觉/样式/响应式/可访问性，**不改业务行为、接口、数据**。
- 复用 V1 的语义 token（`shared/theme.css`）与 Element Plus 深色变量；不再引入硬编码颜色。
- 深浅色都可用；正文/表格/输入/代码块/对话气泡/状态 chip 对比度足够。
- 响应式：1440/1280/1024/768；窄屏折叠而不是硬挤。
- 延续墨色 + AI 紫 + 语义色；紧凑、分层、克制；不做彩色渐变/装饰动效。
- **原型线框（Wireframe）保留“白纸”语义**：线框画布保持浅色纸张 + 边框，外围工具栏/侧栏/页面集随主题；这是产品语义，不是漏改。

---

## 2. 需求文档（requirements/）

- `RequirementsDocView.vue`：
  - 三栏（对话 / 大纲 / 编辑区）在 1280 保持、1024/768 折叠为“对话抽屉 + 大纲抽屉”，编辑区全宽；
  - 工具栏（章节编辑/预览/全文源码/模板中心/版本/导出/确认需求）窄屏换行/更多菜单，不溢出；
  - 文档标题/状态 chip/自动保存状态/只读横幅/重新编辑按钮 token 化；
  - 章节卡片、必填标记、标签、空状态、加载/错误态。
- `DocChatPanel.vue`：
  - 构建活动、接下来做什么、焦点 chip、消息气泡（user/assistant/notice）、流式文本、停止按钮、Composer；
  - 深色下气泡/边框/时间/提示可读；只读态样式。
- `AiSuggestionCard.vue`：
  - 建议卡背景/边框/计数/勾选/状态 chip；行级 diff 的 `+/-/上下文` 在深浅色都有足够对比度；
  - stale/applied/ignored 状态。
- `OutlineEditor.vue`：
  - Scene/Epic/Story 卡片、稳定 ID 标签、输入/文本域/优先级/场景归属/验收标准、归档/删除；
  - 结构/Markdown 切换、重建结构；深色输入/边框/占位符。
- `TemplateCenterDialog.vue`：
  - 模板列表/搜索/分类/预览；私有模板编辑器（章节行、key 只读、上移下移/删除/新增）；
  - Element Plus 表格/输入/下拉/按钮深色；窄屏弹窗内部滚动。
- `VersionHistoryDialog.vue`（需求版本）与 `DesignVersionsDialog` 已在 V1 基础；确认在需求页内深色/窄屏正常。
- `MarkdownView.vue` 已在 V1 token 化；确认需求正文中的表格/引用/代码块深色可读。

## 3. 设计 Studio（design/）

- `DesignStudio.vue`：顶栏（标题/状态/版本/需求输入 chip/模板 chip/交接包/同步/重新编辑/主按钮）、Tab、stale/只读/scope 横幅、窄屏换行。
- `DesignChatPanel.vue`：对话/构建活动/焦点/消息，深色与空态。
- `EntityDesignTab.vue`：实体列表、字段表格、关系编辑、确认/全部确认、AI 生成；表格深色、字段行 hover、错误提示。
- `ErGraph.vue`：SVG 节点/连线/文字/选中高亮在深色下可读；背景随主题。
- `PrototypeTab.vue`：页面集树/页面列表、页面规格编辑器（字段/动作/列/查询/验收/批注/表单 mode）、模板切换、截图/存档、页面集确认、新增/删除页面；窄屏树折叠。
- `PrototypeCanvas.vue` + `design/prototype/*`：**线框保持白纸**；外框/工具栏/页面集标题随主题；线框阴影/边框在深色下清晰。
- `RequirementCoveragePanel.vue`：覆盖度表格/树/状态 chip/未覆盖提示；深色表格与跳转按钮。
- `DesignSyncDialog.vue`：需求变更 diff（新增/修改/删除/受影响实体/页面），深色代码/列表。
- `PrototypeTemplateDialog.vue`：模板库/预览/Token 编辑器；深色输入/表格/预览。
- `DesignHandoffDialog.vue` / `DesignVersionsDialog.vue`：V1 已 token 化；确认在 Studio 内深色/窄屏无回归。

## 4. 响应式细节

- 1280：保持三栏/双栏，缩间距与字号；工具栏不换行溢出。
- 1024：需求对话/大纲变抽屉（按钮切换）；设计 Studio 的聊天/画布可上下或抽屉；实体表格横向滚动。
- 768：单栏；对话/大纲/页面集树用抽屉/折叠；弹窗宽度自适应；按钮触达 ≥32px。
- 所有图标按钮 `aria-label`/`title`；焦点可见；键盘可操作抽屉/切换。
- 检查 `document/body` 无横向溢出。

## 5. 验证

- `npm run typecheck --prefix frontend`、`npm run build --prefix frontend`、`npm test --prefix frontend`、`node check-vue-imports.cjs`。
- Playwright（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`，API 预置，不依赖模型）：
  - 浅/深 × 1440/1024/768：需求文档（编辑/预览/源码/大纲）、对话/AI 建议卡（可用 API 预置 chat 消息含 suggestion）、模板中心、版本弹窗；设计 Studio（实体/ER/原型/覆盖度/同步/模板/交接包/版本）；
  - 深色白底检查（弹窗/输入/表格/下拉/代码块）；无横向溢出；0 console error / 0 非预期 API >=400。
  - 截图 `C:\Users\icecream\AppData\Local\Temp\opencode\visual-v2\shots\`（命名含主题/宽度/页面）。
- 功能回归：创建 doc 应用 → 需求文档编辑/预览/确认 → 设计 Studio 打开/实体/原型/覆盖度；不要求真实模型。

## 6. 不做 / 边界

- 不改业务逻辑/接口/数据/版本/交接包语义。
- 不做开发页（V3）；不做移动 <768；不做视觉重构/换设计语言。
- 原型线框不改成深色（保持白纸），但外围适配。
- 不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交。

## 7. 文档

更新 `docs/STATUS.md`（「视觉 V2 完成」+ 摘要表）、本交接单状态/实施结果、`AGENTS.md`（V2 完成、下一步 V3）、`docs/plans/2026-11-11-main-review-handoff.md`。

回传：改动文件、截图清单、验证结果、深色/窄屏遗留、V3 建议。

---

## 8. 实施结果（2026-11-11，实施会话）

### 8.1 改动文件

| 文件 | 改动 |
| --- | --- |
| `frontend/src/shared/theme.css` | 新增 `--rg-accent` / `--rg-accent-soft`（浅/深）；其余不动 |
| `frontend/src/requirements/RequirementsDocView.vue` | token 化 + 1024/768 对话/大纲抽屉（`chatOpen`/`outlineOpen`、遮罩、关闭按钮、Esc、`askAi` 打开对话、点大纲项关闭）、工具栏/章节/预览/源码/空错态重排 |
| `frontend/src/requirements/DocChatPanel.vue` | token 化（badge 改墨色实心、去渐变）+ `aria-label` |
| `frontend/src/requirements/AiSuggestionCard.vue` | token 化（含 diff 三态、stale/applied/ignored） |
| `frontend/src/requirements/OutlineEditor.vue` | token 化（ID chip：Epic=ai、Story=accent）+ 768 单列 |
| `frontend/src/requirements/TemplateCenterDialog.vue` | token 化 + 宽度/高度收敛 + ≤820 纵向堆叠 |
| `frontend/src/requirements/MarkdownView.vue` | `overflow-x:auto`（表格不撑破文档） |
| `frontend/src/design/DesignStudio.vue` | token 化 + ≤1024 设计对话抽屉（Tab 行「对话」按钮 + 遮罩 + Esc）+ 768 头部换行 |
| `frontend/src/design/DesignChatPanel.vue` | token 化（去蓝紫渐变）+ `aria-label` |
| `frontend/src/design/EntityDesignTab.vue` | token 化 + 字段表横向滚动（`min-width:880px`）+ ≤768 实体列表抽屉 + 实体头 `.wide` 跨列 |
| `frontend/src/design/ErGraph.vue` | SVG 全量 token（节点/连线/箭头/文字/选中/草稿虚线）+ 节点键盘可达 |
| `frontend/src/design/PrototypeTab.vue` | token 化 + ≤1024 页面集抽屉 + ≤768 画布/规格纵向堆叠 + 画布 `--rg-canvas` |
| `frontend/src/design/RequirementCoveragePanel.vue` | token 化（Story=accent）+ 768 换行 |
| `frontend/src/design/DesignSyncDialog.vue` | token 化 + 宽度自适应 + ≤820 单列 |
| `frontend/src/design/PrototypeTemplateDialog.vue` | token 化 + 宽度/高度收敛 + ≤900 纵向堆叠 |

未改：`design/prototype/*`、`design-skin.css`（线框白纸）、`DesignHandoffDialog.vue`、`DesignVersionsDialog.vue`（V1 已 token 化，仅回归）、后端/接口/数据/版本/交接包。

### 8.2 验证

- `npm run typecheck --prefix frontend` ✅、`npm run build --prefix frontend` ✅（CSS 546.17 kB）、`npm test --prefix frontend` ✅ 63/63、`node check-vue-imports.cjs` ✅。
- Playwright（临时数据目录 + API 预置，PORT=3410，不依赖模型）：浅/深 × 1440/1024/768 共 120 张截图；**0 console error / 0 page error / 0 意外 API≥400 / 0 深色白底 / 0 横向溢出**；弹窗包围盒均在视口内；768×760 模板中心 `el-dialog__body` 内部滚动。
- 功能回归：创建 doc 应用 → 写入 9 个必填章节 + 结构化 Scene/Epic/Story → 保存版本 → 确认需求 → 设计实体/页面集/版本/同步 → 确认设计 → 每页 PNG → 交接包生成（25 文件），全链路 200。
- 截图与脚本：`C:\Users\icecream\AppData\Local\Temp\opencode\visual-v2\`（`shots/`、`setup.cjs`、`e2e.cjs`、`e2e.log`）。

### 8.3 遗留（供 V3 参考）

1. 抽屉是 overlay（非重排）；1024 时需求对话/大纲、设计对话、页面集树折叠，768 追加实体列表折叠。
2. 线框/PNG/模板颜色 swatch 属于“白纸/数据”语义，深色白底检查已列例外。
3. ER 连线标签在节点密集时可能被遮挡（既有布局算法）。
4. 深色 `el-table` 未在 V2 页面实机出现（无实例），沿用 V1 变量兜底。
5. 未跑真实模型对话与后端测试/冒烟（本轮不改后端）。
6. <768 移动端未纳入。

### 8.4 V3 建议

- 开发页（`DevView`/`SessionList`/`ToolCard`/`StepCard`/`FormCard`/`PermissionCard`/`Composer`/`dev/api.ts` 视图层）token 化与深浅色；时间线/工具卡/diff/权限/表单在深色下逐项核白底。
- 全量截图（含开发页与真实模型对话），并把 `visual-v2` 的检查脚本泛化为可复跑回归（含浅/深 × 1440/1280/1024/768）。
- 若后续引入 `el-table`（如覆盖度改表格），补一次深色实机验证。
