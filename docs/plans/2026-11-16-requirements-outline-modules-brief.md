# 需求阶段“模块融入需求大纲”改造（实施交接单）

日期：2026-11-16
用途：新开实施会话执行；主会话评审。
状态：**待实施**。
上游：`docs/plans/2026-11-13-module-requirements-design.md`（§6.1 模块 UI）、`docs/plans/2026-11-13-module-m3-implementation-brief.md`（模块 rail/总览/按模块 chat）、`docs/STATUS.md`「M3 完成」「M6 完成」。
范围：**只改需求阶段前端布局与导航**——去掉最左侧独立“需求模块”区域，模块成为右侧“需求大纲”树的根节点；保留全部模块操作、状态、只读/变更范围/确认语义。
**不做**：设计阶段 `DesignModuleRail`（下一轮再统一）、后端/API/表结构、交接包、Change Set、U7 阶段、登录权限、旧数据兼容、M7 #8 预览。
**不改**：`projects/`、`data/`、真实 3300 实例、`.env`；验证只用临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`/端口。

风险等级：中（需求页布局/交互重构；纯前端，无数据/接口变更）。同一时间只允许一个实施会话改文件。

---

## 1. 已确认决策（用户 2026-11-16）

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | 树展开方式 | **A. 手风琴**：只展开当前模块；点其它模块即切换并展开，上一模块收起 |
| 2 | 模块管理入口 | **行内 `⋯` 菜单 + 大纲底部“+ 新增模块”**；不新增独立“模块管理”页 |
| 3 | 大纲标题 | **“需求大纲”** |
| 4 | 需求总览 | 保持顶部按钮/弹窗，**不**作为树根节点 |
| 5 | 设计阶段 | 本批不动；等用户跑到设计阶段再统一 |
| 6 | 章节高亮 | **要**：滚动时高亮当前章节；点“问 AI”时在大纲高亮焦点章节 |

---

## 2. 目标布局

### 2.1 桌面（>1024）

```text
┌──────── 需求文档助手（400 / ≤1280 336） ────────┬──────── 文档区（剩余宽度） ─────────────────┐
│ 需求文档助手                                     │ [当前模块 · 模板 · 状态 vN · 保存态]        │
│ 订单管理系统 · MOD-001 · 草稿                    │ [需求总览 x/y] [章节编辑|预览|全文源码] ... │
│ …对话/建议卡…                                    │ 必选已确认 x/y · 需求聚合 vN/未生成         │
│                                                  │ ┌── 需求大纲 248 / ≤1280 220 ──┬─ 正文 ───┐ │
│                                                  │ │ 需求大纲  2 个模块 · 9/13 必填│ ## 文档… │ │
│                                                  │ │ ▾ MOD-001 订单管理系统        │ …        │ │
│                                                  │ │    必选 · 草稿 v2 · 张三      │          │ │
│                                                  │ │    9/13 必填            ⋯     │          │ │
│                                                  │ │    1 文档信息          必填   │          │ │
│                                                  │ │    2 问题与机会               │          │ │
│                                                  │ │    …                          │          │ │
│                                                  │ │ ▸ MOD-002 库存管理            │          │ │
│                                                  │ │    必选 · 已确认 v3 · 李四    │          │ │
│                                                  │ │ + 新增模块                    │          │ │
│                                                  │ │ 已归档 1 ▸                    │          │ │
│                                                  │ │ 点击模块切换；点章节定位      │          │ │
│                                                  │ └──────────────────────────────┴──────────┘ │
└──────────────────────────────────────────────────┴─────────────────────────────────────────────┘
```

- 删除最左侧 236px 模块 rail，需求页只剩“对话 + 文档”两列；文档内部仍是“大纲 + 正文”。
- 大纲宽度 248px（≤1280 为 220px）；长标题省略 + `title` tooltip。
- 当前模块根节点高亮（左侧强调线/底色）；当前章节高亮；缺必填章节用 warning 色。
- 大纲标题显示 `N 个模块 · 当前模块 x/y 必填`；当前模块根节点第二行显示完成度。

### 2.2 根节点信息

第一行：`▾/▸` + `MOD-xxx` + 模块标题 + `必选`（required）+ `本次变更`（in change scope）。
第二行：状态（草稿/待审核/已确认/已归档）+ `vN` + 负责人（有则显示）+ 当前模块 `x/y 必填`（非当前模块不显示完成度，避免未加载章节造成误报）。
第三行/悬浮：模块描述不常驻，放在标题 tooltip 与编辑弹窗中（不丢功能）。

当前模块展开后，章节节点沿用现有信息：序号、标题、`必填`、缺省 warning 色；缩进 16—20px，带轻量树线/层级感。

---

## 3. 交互规格

### 3.1 模块展开/切换（手风琴）

- 默认展开当前模块；任何时刻最多一个模块展开。
- 点**当前模块**根节点：收起/展开（chevron 与整行一致）。
- 点**其它模块**根节点或 chevron：沿用 `switchModule(id)`——
  1. 先 `flushAll()` 落盘当前模块手动编辑；失败则提示并**中止切换**（现有语义，不丢内容）。
  2. 设置选中模块、写 localStorage、`loadDoc()`。
  3. 加载成功后展开该模块，上一模块收起；重置章节高亮到目标/第一节。
- 切模块同时切换按模块 chat 历史（现有 `DocChatPanel :key` 行为），不改。
- 已归档模块：位于底部“已归档 N”折叠组；点击仍加载并展开（只读），不参与手风琴的“未归档当前模块”高亮；恢复后回到未归档组。
- 0 模块：显示空态 + “+ 新增模块”；启动时仍按现有默认模块逻辑创建/选择。

### 3.2 章节定位

- 点当前模块章节：`scrollIntoView`（保持现有行为），立即高亮该章节，窄屏关闭大纲抽屉。
- 点其它模块章节：记录 `pendingScrollKey` → 走 3.1 的切模块流程 → `loadDoc()` 后 `nextTick` 滚动到 `doc-sec-<key>` → 高亮；若目标章节不存在（模板变更/并发），回退到第一节并提示可忽略。
- 预览/全文源码模式：正文没有章节卡片；章节节点仍展示，但点击只切模块不再强制滚动（与现有“预览模式无法滚动到章节”一致）；不新增错误。

### 3.3 模块管理（功能对齐原 rail）

模块行右侧 `⋯` 菜单（当前模块或 hover 可见；键盘可达）：
- 编辑信息（打开现有 `ModuleEditDialog`）
- 上移 / 下移（首/末禁用；调用现有 `moveModule`）
- 归档（`modules.length <= 1` 或 `archiveBlocked` 时禁用并给 title 提示）
- 已归档行：恢复（`restoreModuleById`）

大纲底部：
- `+ 新增模块`：沿用 `createModuleGate(appStatus)`；非需求阶段禁用并显示现有 hint；打开现有创建弹窗。
- `已归档 N` 折叠组：默认收起；展开后可查看/恢复。

菜单不得被大纲滚动容器裁切（可用 teleported popover 或 fixed 定位）；点击外部/Esc 关闭；关闭后焦点回到触发按钮。

### 3.4 状态与只读

- 必选/本次变更/已确认/已归档状态与原 rail 完全一致；`currentOutOfScope`、`stageReadonly`、`docConfirmed`、`currentArchived` 的只读横幅与按钮不变。
- 本次变更未包含的模块仍可点开只读；保留“当前模块不在本次变更内（只读）”提示。
- 模块确认/重新编辑/完成需求阶段/总览/模板切换/版本/导出语义不变。

### 3.5 章节高亮（scroll spy）

- 在 `mode === 'edit'` 且大纲可见时，监听 `.doc-scroll` 滚动（`requestAnimationFrame` 节流）：取最后一个 `top <= 容器顶部 + 24px` 的章节为 active；没有则第一节；滚到底时取最后一节。
- 切换模块、AI 应用、章节保存导致章节列表变化后重算；目标章节不存在时清空。
- 点“问 AI”：设置现有 `focusSectionKey` 的同时设为 active；大纲高亮焦点章节。
- 高亮仅视觉，不改变 `focusSectionKey` 的对话语义（滚动产生的 active 不回写 focus）。
- 预览/源码模式移除监听或跳过，避免对不存在的卡片计算。

### 3.6 响应式

- `>1024`：两列（对话 + 文档），大纲常驻。
- `≤1024`：对话、**大纲**两个抽屉（删除“模块”抽屉）；大纲抽屉承载模块树与章节；遮罩/Esc/互斥关闭沿用现有逻辑；大纲宽度建议 `min(320px, calc(100vw - 56px))`。
- `≤768`：单栏 + 顶栏两行；大纲抽屉；正文不横向溢出；树区域独立滚动。
- 顶部“大纲”按钮 tooltip 改为“模块与文档大纲”（或保持“大纲”，需保证可发现性）。

---

## 4. 前端实现清单

### 4.1 修改 `frontend/src/requirements/RequirementsDocView.vue`

- 删除 `RequirementModuleRail` 的 import/模板/`moduleOpen` 状态/`@close`/相关 CSS；删除窄屏“模块”toggle 与 mask 条件中的 `moduleOpen`。
- `doc-body` 内的大纲 nav 改为新组件 `RequirementOutlineTree`（或等价内联），传入：
  - `modules`（未归档，按 position）、`archivedModules`、`selectedModuleId`
  - 当前 `payload.sections`、`activeSectionKey`、`focusSectionKey`
  - `appStatus`、`canMutate=!stageReadonly`、`changeScopeIds`、`archiveBlocked=Boolean(activeChangeSet)`
- 新增状态：`activeSectionKey`、`pendingScrollKey`、`outlineFixedMenu`（若需要锚点）。
- 新增/复用事件：
  - `select-module(id)` → `switchModule(id)`；切成功后展开由 `selectedModuleId` 驱动。
  - `toggle-module(id)` → 当前模块切换折叠；其它模块走 select。
  - `jump(moduleId, sectionKey)` → 同模块直接滚动；跨模块设 pending 后 select。
  - `create/edit/move/archive/restore` → 直接复用现有函数。
- `loadDoc()` / `onAiChanged()` / 版本回滚后：`nextTick` 处理 pendingScroll；刷新 active；章节不存在则回退。
- 滚动监听在 `onMounted` 注册、`onUnmounted` 清理；切换 mode/模块时重置。
- 保留 `scrollToSection` 作为同模块定位底层函数（增加 active 赋值）。
- 保留 `outlineOpen` 抽屉状态与 Esc/遮罩逻辑（去掉 moduleOpen 分支）。

### 4.2 新增 `frontend/src/requirements/RequirementOutlineTree.vue`

- 只负责展示与事件上抛，不直接请求 API。
- 结构：标题行 → 未归档模块列表（根节点 + 当前章节）→ “+ 新增模块” → 已归档折叠组 → 提示文案。
- 根节点、章节、`⋯` 菜单、归档组、空态、禁用态、tooltip、`aria-expanded`/`aria-current`、Enter/Space 键盘操作。
- 菜单：编辑/上移/下移/归档（或恢复）；点击外部/Esc 关闭；不得裁切。
- 样式只用 `shared/theme.css` 语义 token（`--rg-*`），深浅色、无裸色值、无横向溢出；大纲内部滚动。

### 4.3 `module-helpers.js`（+ `.test.mjs`）

新增纯函数（便于 Node 单测）：
- `moduleOutlineRow(module, { current, inChangeScope })` → `{ statusLabel, versionLabel, chips, canMoveUp/Down? }`（或等价的小函数组合）。
- `activeSectionFromTops(tops, { offset = 24 })` → 根据章节顶部位置数组返回 active index/key；覆盖空、全部在阈值下、之间、末尾。
- 如需要：`outlineCompletion(sections)` → `{ required, completed }`，复用当前 `requiredCount/completedRequired` 计算但可测。
- 保留现有 `resolveInitialModule`/`progressOf`/`moveModuleIds`/`nextModuleAfterArchive`/`createModuleGate` 行为不变。

### 4.4 删除

- `frontend/src/requirements/RequirementModuleRail.vue`（当前仅 `RequirementsDocView` 引用；删除前 grep 确认零引用）。
- 不删除 `ModuleEditDialog.vue`、`RequirementOverview.vue`、`module-helpers.js`。
- 若 Playwright/单测有 `open-modules`、`.module-rail` 选择器，一并更新。

### 4.5 不改

- `requirements/api.ts`、后端任何文件、数据库、设计阶段、交接包、Change Set、U7。
- `DocChatPanel.vue` 已显示模块名，无需改。

---

## 5. 数据/接口

- **无后端改动**：模块元数据来自现有 `appPayload.modules`，章节来自当前模块 `GET /requirements-doc?moduleId=`。
- 手风琴方案不懒加载其它模块章节，**不新增缓存/失效逻辑**，避免跨模块章节状态漂移。
- localStorage 当前模块选择键不变；按模块 chat 历史不变。

---

## 6. 兼容与边界

- 单模块应用：只有一个根节点，行为与原来一致（少了左侧 rail）。
- 已归档/已确认/变更范围/只读/重新编辑/完成需求阶段：全部保留。
- 预览/全文源码：章节树仍展示；滚动定位只在编辑模式生效（现有行为）。
- 模板切换后章节 key/标题变化：当前模块树随 payload 更新；跨模块 target 不存在时回退。
- 长标题/多模块（5—8 个）/13 章节：大纲内部滚动，不挤压正文。
- 描述不再常驻显示（原 rail 有），通过标题 tooltip + 编辑弹窗保留，作为有意的紧凑化。

---

## 7. 验证计划（实施会话必须执行）

### 7.1 命令

```powershell
npm run build --prefix backend
npm test --prefix backend          # 基线 224（未改后端，回归确认）
npm test --prefix frontend         # 基线 121 + 新增纯逻辑测试
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm run check:vue --prefix frontend
```

### 7.2 Playwright（临时数据）

- 临时 `RG_DATA_DIR` / `RG_PROJECTS_DIR`，独立端口（如 3450/5199），`OPENCODE_AUTO_START=false`；**不启停 3300**、不碰真实 `data/`/`projects/`、不调真实模型。
- 通过 API 预置应用（requirements 阶段）+ 2—3 个模块：一个已确认、一个草稿、一个已归档；可加一个变更范围 fixture（可选，若 `activeChangeSet` 预置成本高，则用已有变更单接口）。
- 断言：
  1. 桌面 1440/1280：无模块 rail；大纲根节点数 = 未归档模块数；当前模块展开且章节数正确；其它模块折叠。
  2. 切模块：点其它模块 → 正文标题/状态/版本切换；chat 历史切换；上模块收起、当前展开。
  3. 跨模块章节跳转：点其它模块某章节 → 切模块后滚动到目标且高亮；同模块章节滚动。
  4. scroll spy：滚动正文，active 章节随位置变化；点“问 AI”后焦点章节高亮且对话焦点一致（不发送消息）。
  5. 模块操作：新增（门禁提示）、编辑、上移/下移、归档（最少 1 个/变更中禁用）、恢复；归档组展开/收起。
  6. 只读：已确认模块、已归档模块、变更范围外模块提示与禁用；重新编辑入口可用。
  7. 未保存 flush：编辑章节后立即切模块 → 内容保存且切换成功；模拟保存失败 → 切换中止并提示（可路由拦截 PUT）。
  8. 1024/768：只剩“对话/大纲”抽屉；大纲抽屉可切模块/章节；遮罩/Esc/互斥；无横向溢出。
  9. 浅色/深色：树、菜单、状态 chip、active 高亮对比正常；无深色白底。
  10. 0 console error / 0 pageerror / 0 意外 API≥400；截图保存到临时目录（不提交）。
- 主会话将独立复跑关键路径（切模块、跨模块跳转、归档/恢复、响应式）。

### 7.3 验收标准

- 需求页任何宽度都没有独立模块 rail；模块只出现在“需求大纲”树根。
- 原 rail 的所有能力（新增/编辑/排序/归档/恢复/状态/版本/必选/变更范围）均可达。
- 手风琴：最多一个展开；切模块 flush 语义不丢内容。
- 章节滚动高亮/问 AI 高亮可用；跨模块跳转无竞态。
- 后端 224、前端基线 + 新增测试、typecheck/build/check:vue、Playwright 全部通过。
- 未触碰真实实例/数据；无旧数据兼容逻辑。

---

## 8. 交付物

- 代码 + 前端纯逻辑测试。
- 更新 `docs/STATUS.md` 新增「需求大纲模块化」完成段（改动、验证命令/结果、偏差、未验证项）。
- 回填本交接单 **§9 实施结果**：实际改动文件、测试数、Playwright 场景/截图目录、偏差与未验证项。
- 不提交临时脚本/截图/日志；不提交 `projects/`、`data/`、`.env`。

---

## 9. 实施结果

状态：**已实施（2026-11-16，实施会话）；主会话 must-fix 1/2/3 已修复并复评通过（2026-11-16）**。

### 9.1 实际改动文件

- 修改 `frontend/src/requirements/RequirementsDocView.vue`：
  - 删除 `RequirementModuleRail` 的 import/模板/`moduleOpen`/相关事件与窄屏“模块”toggle、mask 条件；
  - 大纲 nav 改为承载 `RequirementOutlineTree`（保留 `outlineOpen` 与 `.outline.open` 抽屉、Esc/遮罩关闭）；大纲宽度 248px、≤1280 220px、≤1024 `min(320px, 100vw - 56px)`、≤768 `100vw - 24px`；
  - 新增 `activeSectionKey`、`pendingScrollKey`、`outlineExpandedId`；`switchModule` 返回成功与否并保留 flush→切换语义；新增 `toggleOutlineModule`、`jumpToSection`（同模块滚动/跨模块 pending）、`afterDocLoaded`（nextTick 定位/回退）、`scrollSectionIntoView`、scroll spy（rAF 节流、仅 `mode='edit'`、watch `docScrollRef` 绑定/解绑、卸载清理）；`loadDoc` 返回 boolean 并在失败时清 pending；AI 应用/回滚/模板变化/全文保存后重算 active；`askAi` 同步高亮并短暂抑制 spy。
- 新增 `frontend/src/requirements/RequirementOutlineTree.vue`：标题行（`需求大纲` + `N 个模块 · 当前模块 x/y 必填`）→ 未归档模块根节点（手风琴、当前高亮、必选/本次变更、状态/vN/负责人/当前完成度、描述 tooltip、`⋯` 菜单）→ 当前模块章节（序号/必填/缺省 warning/active/focus）→ `+ 新增模块`（`createModuleGate` + `canMutate`）→ 已归档折叠组（恢复菜单）→ tip；菜单 Teleport + fixed 定位（不裁切、Esc/外部点击关闭、Esc 回焦、键盘可用）、`aria-expanded/aria-current`、0 模块空态；当前模块为已归档时自动展开归档组。
- 修改 `frontend/src/requirements/module-helpers.js`：新增 `moduleStatusClass`、`moduleOutlineRow`、`moduleOutlineTooltip`、`outlineCompletion`、`activeSectionFromTops`、`resolveSectionTarget`、`scrollAtBottom`；其余函数行为不变。
- 修改 `frontend/src/requirements/module-helpers.test.mjs`：新增 7 个测试块覆盖上述纯函数（空/缺失/阈值/底部/回退/短文档等边界）。
- 删除 `frontend/src/requirements/RequirementModuleRail.vue`（删除前 grep 确认除自身外零引用）。
- 更新 `docs/STATUS.md`（新增「需求大纲模块化」段）与本交接单 §9。
- 未改：后端任何文件、`frontend/src/requirements/api.ts`、数据库、设计阶段 `DesignModuleRail`、交接包/Change Set/U7；未新增依赖；未改 `DocChatPanel`/`RequirementOverview`/`ModuleEditDialog`。

### 9.2 测试数 / 静态检查

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **224/224**（基线 224，未改后端） |
| `npm test --prefix frontend` | **128/128**（基线 121，+7） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |

### 9.3 Playwright（临时数据）

环境：后端 `dist` 3450 + 临时静态服务/API 代理 5199；临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`；`OPENCODE_AUTO_START=false`；不启停 3300、不调真实模型。API 预置 3 模块（A 已确认 / B 草稿 / C 已归档）与按模块 chat 历史。

结果：**127/127 断言通过**（含 must-fix 1/2/3 复验），0 console error / 0 pageerror / 0 意外 API≥400 / 0 横向溢出（1440/1280/1024/768、浅/深色）。覆盖：

1. 桌面 1440：无 `.module-rail`/模块 toggle；标题“需求大纲”；未归档根节点 2；仅一个展开；当前 A 展开 13 节、B 折叠；当前模块高亮/必选 chip/x-y 必填/描述 tooltip；已归档 1；已确认只读与无确认按钮；按模块 chat 历史；当前模块点击收起/再展开。
2. 切模块：正文标题/状态/版本、chat 历史切换；A 收起 B 展开；完成度移动到当前模块。
3. 章节定位：同模块点章节滚动到目标并高亮；scroll spy 滚到底=最后一节、回顶=第一节；预览/全文源码下章节树仍在，点章节只高亮不切换/不强滚，切模块恢复编辑模式。
4. 问 AI：对话焦点 chip 与大纲 active+focus 同步；不自动发送消息。
5. flush：编辑后立即切模块 → API 复核内容落盘、切回内容保留；路由注入 PUT 500 → 提示“已取消切换”、仍停留 B 且 B 保持展开。
6. 模块操作：菜单不超出视口；末模块下移禁用/非首模块上移可用；编辑弹窗带入模块名；上移生效/下移恢复；Esc 关闭菜单并回焦触发按钮；归档 B（回退 A）→ 已归档组 2 → 打开归档模块只读横幅 + 顶栏 chip → 恢复 B（回到未归档并展开）；新增模块弹窗打开/取消；已归档组展开/收起。
7. 只读：已确认模块横幅 + “重新编辑需求”入口可用。
8. 响应式：1280 大纲 220；1024 仅“对话/大纲”开关，抽屉宽、Esc 关闭、抽屉内切模块/点章节关闭并定位；768 抽屉宽 ≤ vw-24、遮罩关闭；以上均无横向溢出。
9. 深色：`html.dark`、大纲背景与 Teleport 菜单均非白底。
10. 截图目录（临时、未提交）：`C:\Users\icecream\AppData\Local\Temp\rg-outline-e2e-fNtsnW\shots`（`1440-light-initial`、`1440-light-module-ops`、`1280-light`、`1024-light-outline-drawer`、`768-light-outline-drawer`、`1440-dark-menu`、`1024-dark-outline-drawer`、`1440-light-flush-failure`）。

### 9.4 与交接单的偏差（逐条）

1. **跨模块章节点击不可达**：§1 决策 1 的手风琴只渲染当前模块章节，点其它模块根节点即切换，因此不存在“点其它模块章节”的用户路径。按最保守方案：`jump(moduleId, sectionKey)` 的跨模块 pendingScroll + 目标不存在回退仍按 §3.2 实现，并用 `resolveSectionTarget` 单测 + 同模块跳转/切模块覆盖；未为测试另造入口，也未改变手风琴决策。
2. **已归档组自动展开**：当前选中模块为已归档时自动展开“已归档 N”组（否则切模块时 `doc-body` 重挂载会把组收起，当前归档模块在大纲里不可见）；其他情况默认收起。
3. **切模块后已归档组折叠态重置**：由于 `loading` 期间大纲随 `doc-body` 重挂载，内部折叠态回到默认收起（已归档当前模块由第 2 条兜底）；未改全局 loading 结构。
4. **菜单点击外部关闭时回焦**：按 §3.3 在关闭时把焦点还给触发按钮；若点击的是其它可聚焦元素，浏览器随后会把焦点交给被点元素。
5. 新增模块“非需求阶段禁用/门禁提示”、0 模块空态、变更中归档禁用：需求页只在 `requirements` 渲染（设计/开发走其它视图），变更单需 development + 交接包，Playwright 无法从 UI 触发；相关逻辑沿用 `createModuleGate`/归档规则与既有单测，未在 UI 断言。
6. 模块描述按 §6 不再常驻，仅保留标题 tooltip + 编辑弹窗。

### 9.5 未验证 / 已知风险

- <768 移动端（沿用既有视觉范围，未在本批验证）。
- 5—8 模块 + 13 章节的长列表实机滚动压测（当前 3 模块；大纲内部滚动已在 768/1024 验证）。
- `activeChangeSet` 场景下的“本次变更”chip、范围外只读横幅、变更中归档禁用：需 development + 交接包 fixture，本批未构造（可选验证项）。
- 0 模块空态与“+ 新增模块”禁用提示未在 UI 出现（新建应用会懒创建默认模块；归档至少保留 1 个）。
- 未触碰 3300、真实 `data/`/`projects/`/`.env`；未调用真实模型/opencode。

### 9.6 主会话 must-fix 修复（2026-11-16）

| # | 修复 | 实现 / 验证 |
| --- | --- | --- |
| MF1 | 短文档 scroll spy 误判 | 新增 `scrollAtBottom(metrics, threshold=4)`：不可滚动（`scrollHeight <= clientHeight + threshold`）恒 false；可滚动且距底 ≤ threshold true；`computeActiveSection` 改用它。单测覆盖不可滚动/刚好等于阈值/中间/到底/阈值边界/非法输入。Playwright：1440×5000 超高视口下断言 `doc-scroll` 不可滚动、派发 scroll 后仍高亮第一节（不是最后一节），恢复 1440×900 后仍第一节。 |
| MF2 | 加载后自动滚到第一节 | `afterDocLoaded` 仅当 `pendingScrollKey` 非空（跨模块跳转/回退）才 `scrollSectionIntoView`；无 pending 保持 `resetDocView` 的 `scrollTop=0`，只初始化 active=第一节。Playwright：初始已确认模块 `scrollTop=0`、只读横幅在视口内、第一节高亮；滚到底后切 A / 再切回 B 均 `scrollTop=0`、A 横幅可见、第一节高亮；新建模块加载后也 `scrollTop=0`。 |
| MF3 | 模块操作切模块前 flush | `saveModule` create 分支、`archiveModuleById`（仅当前模块）、`restoreModuleById` 在写库/切换前 `await flushAll()`；失败分别提示“已取消新增模块/归档/恢复；请先处理保存失败”并中止（不创建/不归档/不恢复、不切模块；创建失败弹窗保持打开、`moduleSaving` 正常复位）。Playwright 用 section PUT 500 注入覆盖三条失败路径（操作取消、仍停留原模块、编辑内容仍在、模块/归档状态未变），并覆盖创建/恢复/归档成功路径（API 复核内容先落盘再切换）。 |
| 小修 | askAi 展开大纲；CSS 注释 | `askAi` 设置 `outlineExpandedId=selectedModuleId`（当前模块折叠时点“问 AI”也展开大纲并高亮焦点章节，不自动打开窄屏抽屉）；≤1024 注释改为“对话/大纲折叠为抽屉”。Playwright：先收起当前模块再点“问 AI”，断言大纲重新展开且焦点章节 active+focus。 |

复验命令：前端 **128/128**、`typecheck`/`build`/`check:vue` 通过；后端 **224/224**（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`）；Playwright **127/127**、0 console/page error、0 意外 API≥400、0 横向溢出；截图目录同 §9.3。未触碰 3300/真实数据。
