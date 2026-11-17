# D-RMP：设计阶段模块树 + 按 Epic 生成（实施交接单）

日期：2026-11-16
用途：新开实施会话执行；主会话评审。
状态：**已完成并复评（2026-11-16，含真实模型 E2E 通过）**。
上游：`docs/plans/2026-11-16-design-stage-module-epic-alignment-design.md`（已定稿）、M4/M5/M6 交接单、RMP-1/RMP-2 交接单、`docs/STATUS.md`「RMP-2 完成」。
基线：后端 **256**、前端 **148**；真实库有用户应用（**不得读写真实 3300/data/projects**）；验证只用临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`/端口；不调真实模型（主会话后续 E2E）。
政策：**不做旧设计数据迁移/兼容**；用户会重新跑需求→设计流程。

---

## 1. 目标（验收）

1. 设计页删除左侧 `设计模块` rail，改为 **设计大纲树**：
   - 模块为根节点；当前模块展开，其它折叠；点模块切换设计项目（先 flush）。
   - 模块下：**数据集（模块共享实体）** + **Epics**（页面集/Story 覆盖/状态）+ 未归属。
2. 点 Epic：
   - 实体/页面原型 Tab 过滤到该 Epic 相关项（可清除）；
   - 设计对话 focus 为 Epic；
   - 显示该 Epic 页面集与相关实体入口。
3. AI 生成改为**按 Epic**：
   - 每个 Epic 生成实体（合并进模块共享池）+ 页面集（每 Epic 一个 primary）+ 页面（按 Story）；
   - 其它 Epic 的实体/页面集不丢；
   - 每个 Epic 一个设计版本；生成 draft，不自动确认。
4. 模块根支持“按 Epic 生成”批量：勾选 Epic、进度、失败继续/重试/停止；单 Epic 节点可单独生成/重生成。
5. 已确认目标（实体/页面集/页面）需显式勾选“允许重新打开已确认项”；模块设计 confirmed / stale / out-of-scope 阻止。
6. 现有整模块 AI 生成/按场景生成保留为“整模块生成（兜底）”，不默认展示；设计确认/交接包/Change Set 语义不变。
7. 无新表/列；无旧数据迁移；RMP-1/RMP-2 需求链路不受影响。

---

## 2. 边界

- 只改设计阶段前端/后端；不改需求阶段、RMP-1/RMP-2、设计确认门禁、交接包、Change Set、U7。
- 实体仍模块级共享；不按 Epic 复制实体/表。
- 页面集每 Epic 一个 primary；手工额外页面集保留；重新生成替换 primary 页面集（页面整体重建）。
- 生成只写当前模块；跨模块实体引用沿用现有允许 + warning。
- 不新增表/列；版本仍 `app_design_versions`（source=`ai`，每 Epic 一次）。
- 不做后台任务队列；批量当前会话顺序执行，可停止剩余/重试。
- 不做 <768 专项；不做旧设计数据兼容。

---

## 3. 后端

### 3.1 Prompt（`design/prompt.ts`）

新增/扩展：

- `buildEpicEntityGenerationPrompt(project, epicId)`：
  - 输入：完整设计输入（Epic/Story 上下文）、当前 Epic + Stories、模块现有实体、原型模板（可省略页面规则）。
  - 指令：只输出**本 Epic 需要新增/变更**的实体；复用现有实体（保留 id/name）；`requirementRefs` 只引用本 Epic 的 EPIC/STORY；不要删除其它实体；更新实体时给完整字段/关系；不要输出无关实体/服务/页面/NFR。
  - 输出 `{ entities: [...] }`。
- `buildEpicPageSetGenerationPrompt(project, epicId, mergedEntities)`：
  - 输入：当前 Epic + Stories、mergedEntities（内存）、原型模板、该 Epic 现有 primary 页面集（如有）。
  - 指令：只输出**一个**页面集：`epicId`/`sceneKey` 当前 Epic，`storyIds` 本 Epic 下所有 Story；页面覆盖 Stories，页面 `requirementRefs` 为 Story；list/form/detail、模板规则沿用现有；页面字段仅引用绑定实体字段。
  - 输出 `{ pageSets: [ ... ] }`。
- `focusBrief` 支持 `focus.kind === 'epic'`：当前 Epic、Stories、相关实体/页面集、生成建议；设计对话快速提示可加“按当前 Epic 生成/补充设计”。
- 现有模块级 prompt 保留（整模块兜底），不改变行为。

### 3.2 服务（`design/service.ts`）

新增 `generateEpicDesign(appId, epicId, options)`：

1. `writableModuleOf`、`assertModuleInActiveChangeSet`、`ensureDesignProjectForModule`、`assertDesignEditable`；需求必须 confirmed；`project.stale.stale` → 409（先同步）；项目 `confirmed` → 409（先重新编辑设计）。
2. 在 `project.input.epics` 找 Epic（fallback：`SCENE-xxx` 从 input.scenes）；找不到 400/404；Stories 取 Epic 下（fallback 场景下可用 Scene/未归属 Stories）。
3. 计算**潜在受影响 confirmed 项**：
   - 相关实体：`requirementRefs` 命中 Epic 或其 Stories；
   - 该 Epic primary 页面集及其 pages confirmed；
   - 若有且 `reopenConfirmed !== true` → 409，返回 `issues`（entity/pageSet/page 列表）。
4. 生成实体：
   - 调 `buildEpicEntityGenerationPrompt` + `chatJson(... agent: 'design', model)`；
   - 解析 `entities`；失败/空（且模块无实体）→ 400/502；不写库。
5. 内存合并实体：
   - `mergeEntitiesForEpic(existing, generated, epic)`：
     - 新实体追加；已有按 id/name（名称不区分大小写）匹配；
     - 字段按 name 合并：生成字段覆盖同名，已有未提及字段保留；关系按 name+target 合并，已有未提及保留；
     - `requirementRefs` 并集；`tableName/description` 非空时更新；
     - 生成/更新实体 status='draft'；位置保留/追加；
     - 未提及的实体原样保留（包括其它 Epic）。
   - 完成 ID/名称引用解析；校验（`validateEntities` + 其它模块）失败 → 400，不写库。
6. 生成页面集：
   - 用 mergedEntities 构造临时 project（不落库）；
   - 调页面集 prompt；解析 `pageSets`；取第一个（或当前 Epic 匹配）作为生成页面集；失败 → 不写库。
7. 合并页面集：
   - 找当前 Epic 的 **primary** 页面集（`epicId` 匹配，position 最小；fallback sceneKey）；
   - 有：保留 id，替换 title/storyIds/pages/spec，status='draft'，pages draft；无：追加；
   - 其它页面集（其它 Epic/手工额外）原样保留；
   - 校验 `normalizePageSets`/引用/实体绑定；失败不写库。
8. 写入（尽量单事务）：
   - 写 mergedEntities + mergedPageSets；
   - 处理 reopenConfirmed：仅上述受影响 confirmed 项退回 draft（实体/页面集/页面），其它 confirmed 保留；
   - `appendVersion(source='ai')` **一次**；
   - 更新项目 updated_at；不自动确认。
9. 返回 `{ project, warnings, epicId, entitiesAdded, entitiesUpdated, pageSetId, pages, reopened }`。

- 注意：不要用 `saveEntities`/`savePageSets` 的“只写传入集合”语义直接写单 Epic 结果，否则会删其它 Epic；写合并后的完整列表，或实现内部 merge + write。
- 现有 `generateEntitiesFromRequirement`/`generatePageSetsFromRequirement` 保留不改（整模块兜底）。
- 页面集 primary 语义：每 Epic 一个 primary；手工额外页面集不删。

### 3.3 API（`design/routes.ts`）

`POST /api/apps/:id/design/generate-epic`

body：
```jsonc
{ "moduleId": "...", "epicId": "EPIC-001", "reopenConfirmed": false, "model": { /* 可选 */ } }
```
- 解析模型（需求/设计现有 `resolveChatModel`），调 `generateEpicDesign`；
- 错误走统一 `designErrorHandler`；返回 §3.2 结果。
- 不新增 SSE；前端按 Epic 循环，显示本地进度/重试/停止。
- 现有 `generate-entities`、`page-sets/generate` 保持不变。

### 3.4 版本/确认

- 每 Epic 成功写入后追加一个 `ai` 版本；版本历史显示“AI 生成”（不新增 Epic 列；本批不扩展表）。
- 生成结果 draft；模块设计 confirmed 阻止；项目 draft 但目标 confirmed 需要 `reopenConfirmed`。
- stale/out-of-scope/archived 沿用现有守卫。

---

## 4. 前端

### 4.1 设计大纲树

新增 `frontend/src/design/DesignOutlineTree.vue`：

- 输入：`modules`（需求模块）、`designModules`（摘要）、`project`（当前）、`selectedEpicId`、`readonly`、`changeScopeIds`、`generating`。
- 结构：
  - 模块根：key/标题/状态/版本/缺图/必选/本次变更；当前高亮；点击 select；
  - 当前模块：
    - `数据集`（共享实体）：实体列表（名称/状态/需求 refs）；点击 selectEntity；
    - Epics：从 `project.input.epics`（fallback scenes）；显示页面集数/页面数/Story 覆盖/状态/缺图；点击 focusEpic；展开显示页面集（primary 在前）和“相关实体”链接；
    - 未归属 Epic/场景：无 epicId 的页面集/无 refs 的实体；
  - 模块工具：设计总览/原型模板（移入树头部）；
  - 模块根 `按 Epic 生成` 按钮；Epic 节点 `生成此 Epic`。
- 状态：
  - 未生成：无页面集且无相关实体；
  - 草稿/已确认/缺图/需同步；
  - 生成状态（本地）由父传入。
- 交互/无障碍：展开/收起、键盘、aria；长标题省略；内部滚动。
- 响应式：宽屏 260/220；≤1024 抽屉；≤768 单栏。

修改 `DesignStudio.vue`：

- 删除 `DesignModuleRail` 使用/import；画布内新增大纲列；`moduleRailOpen` → `outlineOpen`；“模块”按钮改“大纲”。
- 新增 `selectedEpicId`；点 Epic 设置/清除；点实体/页面集处理：
  - 切实体/原型 Tab，调用 Tab 的 `selectEntity`/`selectSetById`/`selectPageById`；
  - 设置/清除 chat focus（epic/entity/pageSet/page）。
- `DesignChatPanel` focus type 增加 `'epic'`；后端 prompt 支持。
- 切模块 flush 全部编辑（chat/entity/page/prototype）后切换；生成中禁止切模块或先停止。
- 设计总览/模板弹窗保留；入口移到大纲/头部。
- 生成批处理：
  - `generateEpic(epicId)` 调 API；`generateEpics(epicIds)` 顺序循环；本地进度状态；失败继续；重试；停止剩余。
  - 确认对话框：列出受影响 confirmed 项；复选框“允许重新打开已确认项”；页面集替换说明；模块根批量选 Epic（默认未生成/有缺口、全选）。
  - 成功后 `project=result.project`，`onProjectUpdate` 同步 designModules，刷新大纲；选中第一个生成 Epic/实体/页面集。
- 设计版本/确认/交接包/Change Set 入口不变。

### 4.2 Tabs 过滤/选中

`EntityDesignTab.vue`：

- props 增加 `focusEpicId?: string`；显示过滤 chip（“当前 Epic：EPIC-001 商品档案 · 清除”）。
- 仅过滤**显示列表/ER**，保存仍用完整 `draft` 实体列表（绝不能把过滤后的列表保存，导致其它实体被删）。
- 过滤规则：实体 `requirementRefs` 命中 Epic 或其 Stories；无 refs 的实体在未设置过滤时显示，设置过滤时放“未归属”或隐藏（明确选择）。
- 暴露 `selectEntity(id)`（已有）；过滤后选中项不在列表时选第一个/清空。
- 整模块 AI 按钮移到“更多/整模块生成（兜底）”菜单，默认不展示。

`PrototypeTab.vue`：

- props 增加 `focusEpicId`；显示过滤 chip。
- 仅过滤显示页面集（epicId 命中或 storyIds 与 Epic Stories 相交）；保存仍用完整页面集列表。
- 暴露 `selectSetById(id)`、`selectPageById(id)`（后者已有）；过滤后选中项不在列表时选第一个。
- 现有“按场景生成/AI 生成页面集”收进“更多/整模块生成（兜底）”。

### 4.3 对话 focus Epic

- `design/types.ts`/`api.ts`/`DesignChatPanel` focus 类型加 `'epic'`。
- 后端设计 `focusBrief` 支持 epic；快速提示增加“按当前 Epic 生成设计/补充页面”。
- 树点 Epic → focus Epic；点实体/页面 → focus 覆盖；清除 Epic → 模块级。
- 设计对话协议/自动应用不变。

### 4.4 进度组件

新增 `DesignEpicGenerationProgress.vue`（或等价）：

- 列表项：Epic key/title、状态（等待/生成中/成功/失败/跳过）、实体/页面集/页面计数、失败原因；
- 重试失败 Epic；停止剩余（当前完成后）；
- 生成中禁止再次生成/切模块；沿用 `--rg-*` token、深浅色/响应式。
- 刷新后不保留运行态（设计数据已写库）；可重新生成/重试。无新表。

### 4.5 删除/保留

- 删除 `DesignModuleRail.vue`（grep 零引用后）；更新相关测试/选择器。
- 保留 `DesignOverviewDialog`、`DesignTemplateSwitchDialog`、设计确认/交接包/同步/版本弹窗。
- 保留现有整模块生成 API/按钮作为兜底。

---

## 5. 生成语义（必须写死）

- **共享实体**：模块级唯一；生成按 Epic 合并；未提及实体/字段/关系不删除。
- **页面集**：每 Epic 一个 primary（position 最小）；生成替换该 primary 的 pages/title/storyIds，保留 id；其它页面集保留。
- **页面**：按 Story 生成；`requirementRefs` 为 Story；页面字段只能引用绑定实体字段。
- **版本**：每 Epic 一次 `ai` 版本；生成失败不写库/不产版本。
- **确认**：生成项 draft；模块 confirmed → 阻止；目标 confirmed → `reopenConfirmed` 后重开为 draft；其它 confirmed 保留。
- **Stale**：先同步需求；不生成。
- **Fallback**：无 Epic 时以 `SCENE-xxx` 为节点；页面集 sceneKey=SCENE；epicId=null；实体 refs 用 Scene/Story。

---

## 6. 测试计划

### 6.1 命令

```powershell
npm run build --prefix backend
npm test --prefix backend        # 基线 256 + 新增；临时 RG_DATA_DIR/RG_PROJECTS_DIR
npm test --prefix frontend       # 基线 148 + 新增
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm run check:vue --prefix frontend
```

### 6.2 后端单测（不调真实模型，注入 generator/chat stub）

- 实体 prompt 只聚焦当前 Epic/Stories；页面集 prompt 一个 Epic、Story refs。
- merge：新增/更新实体保留其它 Epic/未提及字段/关系；requirementRefs 并集；status draft。
- 页面集 merge：primary 替换/保留 id；其它页面集保留；页面 Story refs。
- 版本：每 Epic 一次；失败不写库/不产版本。
- confirmed 目标：无 reopenConfirmed 409；有则仅目标退回 draft；其它 confirmed 保留；项目 confirmed/stale/out-of-scope/archived 守卫。
- fallback 场景；Epic 不在输入；空实体/页面集解析失败。
- API HTTP：model stub、成功/409/400；现有模块级接口回归。

### 6.3 前端纯逻辑

- 大纲树构建：模块/数据集/Epic/页面集/未归属；Epic 状态/Story 覆盖/缺图；
- Epic 过滤实体/页面集规则；选中/清除；批量选择/进度状态机/受影响 confirmed 摘要；fallback。

### 6.4 Playwright（临时数据/端口、mock 模型）

- 无模块 rail；大纲树模块根/当前展开/其它折叠；切模块 flush；点 Epic 过滤/焦点；点实体/页面集切 Tab 选中。
- 单 Epic 生成 mock：实体合并、页面集 primary 替换、其它 Epic 保留、版本 +1、draft；
- 批量：勾选/进度/失败重试/停止；每 Epic 版本；
- confirmed 警告/勾选后重开；项目 confirmed/stale/out-of-scope 阻止；
- 整模块兜底仍可用；设计确认/交接包回归；
- 1440/1280/1024/768、浅/深色、0 console/page/API 错误、无横向溢出；截图临时目录。

### 6.5 真实模型 E2E（主会话后续）

- 临时应用：需求 2 模块（商品/订单）确认 → 设计；按 Epic 生成（商品/订单各 Epic）；验证实体/page set/pages/Story 覆盖、其它 Epic 不丢、版本/耗时；跑完删除；不触碰用户真实应用。

---

## 7. 验收

- 设计页模块为大纲根节点；无独立 rail；Epic/数据集/页面集树可见可点。
- 按 Epic 生成实体+页面集；共享实体合并；其它 Epic 不丢；页面按 Story；每 Epic 一个版本；draft。
- 批量/单 Epic/重试/停止；confirmed 重开/守卫；stale/项目 confirmed 阻止。
- 设计确认/交接包/Change Set/需求链路回归；无新表/迁移。
- 测试/Playwright/真实 E2E 通过。

---

## 8. 交付物

- 代码 + 测试；更新 `docs/STATUS.md` 新增「D-RMP 完成」；
- 回填本交接单 **§9 实施结果**（改动/测试数/Playwright/偏差/未验证）；
- 不提交临时脚本/截图/日志；不提交 `projects/`、`data/`、`.env`；
- 明确未触碰真实 3300/真实数据、未调真实模型。

---

## 9. 实施结果

状态：**已完成并复评（2026-11-16，含主会话真实模型 E2E 通过）**。验证数字与偏差见 `docs/STATUS.md`「D-RMP 完成」。

### 9.1 交付

- 后端：`epic-context.ts`、`prompt.ts`（按 Epic 实体/页面集 prompt + focusBrief epic）、`service.ts`（`mergeEntitiesForEpic`/`mergePageSetForEpic`/`epicGenerationImpact`/`generateEpicDesign`）、`routes.ts`（`POST /design/generate-epic`）、`types.ts`；新增 12 项单测。
- 前端：新增 `DesignOutlineTree.vue`、`DesignEpicGenerationProgress.vue`、`design-epic-helpers.js`（+6 项单测）；改造 `DesignStudio.vue`/`EntityDesignTab.vue`/`PrototypeTab.vue`/`DesignChatPanel.vue`/`api.ts`/`types.ts`；删除 `DesignModuleRail.vue`。
- 语义：实体按 Epic 合并进模块共享池（不删其它 Epic/未提及字段关系）；页面集每 Epic 一个 primary（保留 id 替换 pages，其它保留）；页面按 Story；每 Epic 一个 `ai` 版本；结果 draft；目标 confirmed 需 `reopenConfirmed`，仅受影响项退回 draft；stale/项目 confirmed/变更外/归档阻止；整模块生成保留为兜底。

### 9.2 验证（实际数字）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend`（临时 RG 目录） | **268/268**（基线 256 + 12） |
| `npm test --prefix frontend` | **155/155**（基线 148 + 7） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | OK |

- Playwright（临时数据/端口 3431、真实临时 backend + stub 模型）：**138/138 断言**；0 console error / 0 pageerror / 0 意外 API≥400（仅故意失败/保存失败窗口的 502/500 排除）/ 0 横向溢出；截图 `C:\Users\icecream\AppData\Local\Temp\drmp-pw-1794824297773\screens`（14 张，未提交）。
- 覆盖：大纲树/手风琴/切模块 flush；Epic 过滤/焦点/清除；批量失败继续/重试失败/停止剩余；draft/每 Epic 版本/共享实体/Story 覆盖；过滤下保存完整集合；树点实体/页面集；单 Epic 保留 primary id 且不丢其它 Epic；confirmed 勾选重开、stale/项目 confirmed/变更外阻止；整模块兜底；交接包弹窗；1440/1280/1024/768 × 浅/深。

### 9.2.1 复核 must-fix（2026-11-16，已修并复验）

| # | 修复 | 验证 |
| --- | --- | --- |
| MF-DRMP-1 | `submitEpicGeneration` 先 `flushAll()`；失败不关闭对话框/不生成/`epicError` 提示；两个 Tab 的 `flushSave` 失败抛错并等待在途保存 | 单测无（前端）+ Playwright：保存优先于生成、内容不丢；注入 500 → 无生成请求、对话框保留错误、未写库 |
| MF-DRMP-2 | `pageReadonly = readonly \|\| epicRunning` 传给实体/原型/对话；头部确认/重编辑/同步/刷新/交接包禁用；相关函数入口 guard；大纲模板入口禁用 | Playwright：运行中控件 disabled、无确认请求；结束/停止后恢复 |
| MF-DRMP-3 | impact/前端 affected：primary 存在即列 confirmed page（不要求页面集 confirmed） | 后端 + 前端单测；Playwright draft 页面集 + confirmed page 提示/409/重开 |
| MF-DRMP-4 | Epic confirmed 只由自身 primary/pages/entities + stale 决定 | 前端单测（draft/confirmed/stale）；Playwright UI 状态 |
| MF-DRMP-5 | 相关/受影响实体 = refs ∪ 页面绑定（前端匹配页面集、后端 primary）；实体过滤新增 `focusEpicEntityIds`；树同步 | 后端 + 前端单测；Playwright 仅绑定实体进入过滤/相关实体/确认提示 |

### 9.3 偏差

1. 前端过滤 props 为 `focusEpicId` + `focusEpicTitle` + `focusEpicRefs`（实体侧另有 `focusEpicEntityIds`；原型侧另有 `focusEpicIsScene`），过滤需要本 Epic 的 Story 引用与页面绑定实体；保存仍用完整集合。
2. 关系合并优先按 `name`（仅重名时用 `name|target`）：已有 target 是 id、模型输出多为 name，按 `name+target` 会重复。
3. 新增单测注入点 `options.generator`（仅 service；路由不暴露）；模型异常映射 502。
4. 不新增 SSE/后台队列；批量在当前会话顺序执行。

### 9.4 未验证 / 已知风险

- **真实模型 E2E 已通过（2026-11-16，主会话）**：临时 backend/opencode；需求商品/订单 2 模块确认进设计；商品 2 个 Epic → 2 实体/2 页面集/8 页（v3），订单 1 个 Epic → 2 实体/1 页面集/5 页（v2）；共享实体合并、每 Epic 页面集、模块隔离、全 draft；15/15 断言；临时应用已删除、临时服务已停止；真实 3300/data/projects 未触碰。详见 `docs/STATUS.md`「D-RMP…真实模型 E2E」。
- 未验证：<768 移动端；变更单内部分模块批量的完整 UI 路径（后端守卫与只读阻止已覆盖）；真实模型 confirmed 重开/stop-retry/merge 归档（单测 + Playwright mock 覆盖）。
- **注意**：真实 3300 后端仍是 D-RMP 之前构建，需用户确认后 `stop.cmd` → `start.cmd` 重启才能使用 `/design/generate-epic` 与新版设计页。
- 刷新不保留批量运行态（设计数据已写库，可重新生成/重试）。


### 9.5 边界确认

- 只改设计阶段；未改需求/RMP/确认门禁/交接包/Change Set/U7；无新表/列；无旧设计数据迁移。
- 未触碰真实 3300、真实 `data/`/`projects/`/`.env`；未调真实模型；临时应用与临时服务仅存在于本次验证（临时目录未提交）。
