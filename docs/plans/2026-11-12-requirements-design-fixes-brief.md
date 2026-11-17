# 需求/原型阻塞修复 + 结构优化交接单

日期：2026-11-12
用途：新开实施会话执行；主会话评审。
状态：**待实施**。
范围：
- **#4 原型截图/导出 PNG 在“图片”视图失效**（阻塞）
- **#5 交接包前置校验体验**（设计未确认 + PNG 缺失；补充提示，不放松校验）
- **#1.1 Epic 目标单行输入框 → 多行**
- **#1.2 模型把 Story 写进目标 / 缺少 stories[] 的兜底与提示**
- **#2 场景与 Epic 关系说明（非 1:1）**
不做：ER 图美化（#3 单独交接单）；不改交接包 PNG 硬校验；不放宽设计确认/需求确认门禁。

**重要：真实工作台当前可能在运行（app1 设计页，含用户数据）。禁止修改/删除真实 `data/`、`projects/app1`，禁止在真实 app1 上点击截图/确认/生成。所有验证用临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` + 新应用。**

---

## 1. #4 原型截图 / 导出 PNG 失效

### 1.1 根因（已定位）

`frontend/src/design/PrototypeTab.vue`：
- `PrototypeCanvas` 只在 `selectedPage && view === 'html'` 时挂载（`v-if`）；
- 顶部「截图存档」「导出 PNG」按钮在 `view === 'image'` 时仍可点击；
- 「图片」视图空状态里的「截图并存档」按钮也直接调用 `snapshot()`；
- `capture()` 通过 `canvasRef.value.paperRef` 取节点，此时组件未挂载 → `null` → 报“原型画布尚未渲染完成，请稍后再试”。

### 1.2 修复要求

- `snapshot()` / `exportPng()` 统一通过一个 `captureFromAnyView()`：
  1. 记录当前 `view`；
  2. 若 `view !== 'html'`，临时切到 `'html'` 并 `await nextTick()`；
  3. 等待 `paperRef` 存在、`isConnected`、`clientWidth/clientHeight > 0`（用 `requestAnimationFrame`/短轮询，最多约 1.5s）；
  4. 如可用 `await document.fonts?.ready`（忽略失败）；
  5. `capturing = true` + `nextTick()` 后调用 `captureElementPng`（沿用现有 `captureElementPng`）；
  6. 结束恢复原 `view`；截图成功上传后仍按现有逻辑切到 `'image'`。
- 画布在超时后仍不可用：恢复原视图，给出明确提示（如“原型画布渲染超时，请切回「原型」后重试”），不要静默失败。
- 「图片」视图空状态按钮、顶部「截图存档」、「导出 PNG」三条路径都必须可用。
- 不改变截图 API、PNG 校验、上传/存档语义。
- 建议给 `paperRef` 外层加 `data-testid="prototype-paper"`，便于验证（可选）。

### 1.3 验证（Playwright，临时数据）

- 临时后端（如 3461/4461）+ 新应用，API 预置：需求确认 → 1 实体 → 1 页面集/1 页面（不截图）→ 页面/页面集确认但设计保持 draft。
- 场景 A：设计 Studio → 页面原型 → 选页面 → 切「图片」（无图）→ 点空状态「截图并存档」→ 成功、显示图片、API `imagePath` 非空。
- 场景 B：选中另一页 → 顶部「截图存档」（当前在图片视图）→ 成功。
- 场景 C：图片视图点「导出 PNG」→ 触发下载（Playwright `page.waitForEvent('download')`）且无 warning。
- 场景 D：正常 html 视图截图仍成功（回归）。
- 全程 0 console/page error、0 意外 API>=400。

## 2. #5 交接包前置校验体验

- **不放松**：设计确认仍要求 readiness.ok；交接包仍要求所有页面有有效 PNG。
- `backend/src/design/service.ts#readinessOf` 增加**警告**（warning，不阻塞确认）：统计 `pageSets.flatMap(pages).filter(!imagePath)`，若 >0：
  `还有 N 个页面没有原型截图；生成交接包前需在设计 Studio 中截图存档`
  （设计确认允许通过，但提前告知；现有 handoff 仍会阻塞并列出页面）。
- `frontend/src/design/PrototypeTab.vue` 增加常驻提示条：有未截图页面时显示 `还有 N 个页面没有原型截图；生成交接包前需逐个“截图存档”`；截图成功后实时减少/消失。避免只在生成交接包时才暴露。
- 设计确认按钮/交接包错误文案保持现状；如实现成本低，可在交接包预览 issue 列表保持原样（已足够清晰）。
- 后端 `design/service.test.ts` 增加 warning 断言；前端无组件测试，用 Playwright 场景覆盖提示条与截图后消失。

## 3. #1.1 Epic 目标多行

`frontend/src/requirements/OutlineEditor.vue`：
- Epic「目标」从单行 `el-input` 改为 `type="textarea"`，`:autosize="{ minRows: 2, maxRows: 6 }"`，保持 `@input="emitChange"`。
- 长目标可换行显示；不改变数据字段/保存协议。
- 样式：`.field` 内文本域宽度 100%，不溢出；1024/768 单列时正常。
- 验证：临时需求文档写入长目标（>10 行/含列表）→ 结构编辑器显示多行、可编辑、保存后 Markdown/数据不变；截图/Playwright 证据。

## 4. #1.2 Story 被写进 goal / 缺少 stories[]

### 4.1 模型 prompt（`backend/src/chat/doc-prompt.ts`）

在结构化协议规则中明确：
- `epic.goal` 只写 1—3 句业务目标；**不得**把 Story 标题/验收标准/`STORY-xxx` 列表写进 `goal`；
- **每个 Epic 至少 1 个 Story**；Story 一律放顶层 `stories[]`，`stories[].epicId` 指向 `epics[].id`；
- 首次生成也必须同时返回 `epics` 与 `stories`，不要只返回 Epic；
- 可保留“嵌套 stories 后端兜底”的说明（见 4.2），但要求模型用顶层数组。

同步更新 `backend/src/requirements/builtin-templates.ts` 中 epics 章节 guidance（如适用）：一句话强调 goal 与 stories 的区别。

### 4.2 后端归一化兜底（`backend/src/requirements/outline.ts`）

- 在 `normalizeOutlineSection` 的 epics 分支支持 `epic.stories` / `epic.userStories` / `epic.user_stories` 嵌套数组：展开为顶层 Story，`epicId` 缺省为所属 Epic；在顶层 `stories[]` 也出现时按 raw id/标题去重，避免重复。
- Epic 的 `goal` 保持文本（可把字符串数组 join 成换行；非字符串忽略）。
- 归一化后对每个未归档 Epic 检查是否有 Story（`stories[].epicId === epic.id`）；没有则加 warning（不抛错）：
  `code='epic-no-story'`，`message='EPIC-001「…」没有 Story；请补充或让 AI 重新生成'`。
- 已有“至少 1 个 Story / 至少 1 个带验收标准”确认门禁保持。

### 4.3 校验提示

- `backend/src/requirements/doc.ts#validateRequirementDoc`：在结构化分支对所有 Epic 增加同样的 warning（不阻塞；全无 Story 仍由现有 error 阻塞）。
- `frontend/src/requirements/doc-protocol.js#validateDocSections`：同样增加 warning，保证 AI 建议预览/确认弹窗可见。
- `frontend/src/requirements/OutlineEditor.vue`：每个 Epic 下若 `storiesOf(epic.id).length === 0`，显示行内提示：
  `该 Epic 还没有 Story；设计阶段不会为它生成页面集。`
  保留现有“＋ 在此 Epic 下新增 Story”按钮。

### 4.4 测试

- `backend/src/requirements/doc.test.ts`：
  - 嵌套 `epic.stories` 被展开为顶层 Story，epicId 正确，保存后 Markdown 含 `#### STORY-…`；
  - Epic 无 Story 时保存返回 warning；确认时仍阻塞（已有用例）；
  - prompt 包含“不要把 Story 写进 goal”“每个 Epic 至少 1 个 Story”。
- `frontend/src/requirements/doc-protocol.test.mjs`：Epic 无 Story warning。
- 不调真实模型；如需真实模型复测，单独在临时应用执行一次并记录（可选，不阻塞本批）。

## 5. #2 场景与 Epic 的关系说明

- 结论：**不是 1:1**。场景可选；一个场景可包含多个 Epic；一个 Epic 最多属于一个场景（或未归属）。页面集按 Epic/场景派生，多个 Epic 可共享同一场景。
- `frontend/src/requirements/OutlineEditor.vue`：
  - 标签改为 `所属场景（可选）`，选择器增加 `title`/提示：`一个场景可包含多个 Epic；一个 Epic 最多属于一个场景`。
  - 顶部结构提示补一句 `场景可选；一个场景可包含多个 Epic`。
- 不改数据结构/派生逻辑；确认现有行为（sceneId 可空、多 Epic 同场景）有测试覆盖即可（现有设计测试已覆盖多 Epic/场景，不重复造大测试）。

---

## 6. 验证与边界

### 6.1 命令

```powershell
npm test --prefix backend
npm test --prefix frontend
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm run check:vue --prefix frontend
npm run build --prefix backend
```

- 后端基线 145；前端基线 78（新增测试后按实际回传）。
- Playwright（临时目录，端口如 3461/4461，真实 opencode 仅建会话/不调模型）：
  - #4 四个截图场景 + #5 提示条/截图后消失 + 确认设计 + 交接包 preview 无 PNG issue。
  - #1.1 长目标多行可见/可保存（可用 API 预置 + UI 截图）。
  - 浅/深 × 1440/1024/768 至少覆盖设计 Studio 页面原型/图片视图；0 console/page/API 错误、0 横向溢出、0 深色白底。
- 禁止使用真实 app1/真实 data；验证结束停止临时后端/opencode，释放端口；真实 `apps`/`projects` 不变。

### 6.2 文档

- 在本交接单追加 `## 7. 实施结果`（改动/命令/偏差/未验证）。
- `docs/STATUS.md`：新增本次修复小节 + 摘要表行；写明 #4/#5/#1.1/#1.2/#2。
- 不改 `AGENTS.md`/ER 文档（主会话评审后统一更新）。
- 不修 ER（#3 另单）、不修启动脚本次要项。

## 7. 实施结果

实施会话：2026-11-12。真实工作台（3300，app1）未操作；全部功能验证使用临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` + PORT=3461 + 临时应用 `reqfix-e2e`，验证后停止临时后端，真实 `data/`/`projects/app1` 未变。

### 7.1 改动（文件）

| 文件 | 内容 |
| --- | --- |
| `frontend/src/design/PrototypeTab.vue` | `captureFromAnyView()`（记录 view → 非 html 临时切 html → `waitForPaper` RAF 轮询 1.5s：存在/connected/宽高>0 → `document.fonts.ready` 忽略失败 → `capturing`+截图 → 恢复 view）；`snapshot`/`exportPng` 改用它；超时提示“原型画布渲染超时，请切回「原型」后重试”；`missingImageCount` 常驻提示条；`data-testid`（`proto-snapshot`/`proto-export`/`proto-empty-snapshot`/`prototype-missing-images`） |
| `frontend/src/design/PrototypeCanvas.vue` | `paperRef` 加 `data-testid="prototype-paper"`（验证用） |
| `backend/src/design/service.ts` | `readinessOf` 增加缺图 warning（不阻塞、不进 issues）：`还有 N 个页面没有原型截图；生成交接包前需在设计 Studio 中截图存档` |
| `frontend/src/requirements/OutlineEditor.vue` | Epic 目标 `type="textarea"` + `:autosize="{minRows:2,maxRows:6}"`；“所属场景（可选）”+ 非 1:1 title/提示；顶部提示补“场景可选，一个场景可包含多个 Epic”；无 Story 的 Epic 行内提示（`data-testid="epic-no-story"`），保留新增 Story 按钮 |
| `backend/src/requirements/outline.ts` | Epic 内嵌 `stories`/`userStories`/`user_stories` 展开为顶层 Story（`epicId` 缺省所属 Epic）；顶层优先 + raw id/标题去重；`goal` 支持字符串数组（换行 join）；`epic-no-story` warning（不抛错）；`flushEpicBody` 支持多行目标 |
| `backend/src/requirements/doc.ts` | `validateRequirementDoc` 结构化分支增加 `epic-no-story` warning（不阻塞） |
| `backend/src/chat/doc-prompt.ts` | 规则：goal 只写 1—3 句业务目标、不要把 Story/验收/STORY-xxx 写进 goal；每个 Epic 至少 1 个 Story；Story 放顶层 `stories[]`（`epicId` 指向 Epic，内嵌仅兜底）；首次生成同时返回 `epics` 与 `stories` |
| `backend/src/requirements/builtin-templates.ts` | 两个内置模板 epics guidance 补 goal 与 stories 区别 |
| `frontend/src/requirements/doc-protocol.js` | `validateDocSections` 增加 `epic-no-story` warning |
| 测试 | `backend/src/requirements/doc.test.ts`（+2：内嵌展开/epicId/多行 goal/去重；Epic 无 Story warning + 确认仍阻塞；prompt 断言 3 条）；`backend/src/design/service.test.ts`（+1：缺图 warning 2→1→0 且不进 issues）；`frontend/src/requirements/doc-protocol.test.mjs`（+1：Epic 无 Story warning 且不误报） |

未新增测试文件，`frontend/package.json` 的 test 列表不变。未改数据结构/API/数据库/页面集派生逻辑，未改 ER，未放宽任何确认门禁。

### 7.2 命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix backend` | ✅ 148/148（基线 145，+3） |
| `npm test --prefix frontend` | ✅ 79/79（基线 78，+1） |
| `npm run typecheck --prefix frontend` | ✅ |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `npm run check:vue --prefix frontend` | ✅ 全部 SFC 导入完整 |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |

### 7.3 Playwright（临时数据，不调模型）

环境：`PORT=3461`、`RG_DATA_DIR`/`RG_PROJECTS_DIR` 在 `C:\Users\icecream\AppData\Local\Temp\opencode\req-design-fixes\`、`OPENCODE_AUTO_START=false`（未启动 opencode）、前端 `dist` 由本批代码构建。

预置：临时应用 `reqfix-e2e`；需求 1 场景 / 2 Epic（EPIC-001 三行长目标；EPIC-002 无 Story）/ 1 Story（带验收）→ 确认需求（warnings=1）；设计 1 实体（已确认）+ 1 页面集 / 2 页面（已确认、NO PNG），设计保持 draft。

| 场景 | 结果 |
| --- | --- |
| #4 A 图片视图空状态「截图并存档」 | ✅ 成功 + `img.proto-image` 显示 + API `imagePath` 非空 |
| #4 B 图片视图顶部「截图存档」（第 2 页） | ✅ 成功 + `imagePath` 非空 |
| #4 C 图片视图「导出 PNG」 | ✅ `download` 事件 `order-detail.png`（99,800B）+ 成功提示 |
| #4 D html 视图「截图存档」 | ✅ 成功（回归） |
| #5 提示条 | ✅ 初始“还有 2 个页面” → 截 1 张后“还有 1 个” → 齐备后消失；交接包「预览（不写盘）」0 issue + API preview `issues=0`（无“缺少原型 PNG”） |
| 确认设计 | ✅ UI 确认框通过（缺图仅 warning，不阻塞） |
| #1.1 长目标 | ✅ 目标为 `TEXTAREA`（3 行/118px），追加一行后自动保存，API `goal` 保留换行（4 行） |
| #1.2 / #2 | ✅ 仅 EPIC-002 显示“该 Epic 还没有 Story”行内提示；“所属场景（可选）”“场景可选，一个场景可包含多个 Epic”可见 |
| 截图矩阵 | ✅ 浅/深 × 1440/1024/768 ×（设计原型图片、设计原型、需求结构编辑器）共 18 张 + 2 张补充；**0 console/page error、0 意外 API>=400、0 横向溢出、0 深色白底** |

产物：`C:\Users\icecream\AppData\Local\Temp\opencode\req-design-fixes\`（`e2e.cjs`、`report.json`、`shots/`）。验证后临时后端已停止，3461/4461 无监听。

### 7.4 偏差

1. `goal` 字符串数组按换行 join（brief 允许），并扩展 `flushEpicBody` 解析目标续行，保证多行目标在 Markdown 源码模式重建后不丢。
2. 内嵌 stories 与顶层 `stories[]` 同时出现时**顶层优先**；raw id 全局去重、归一化标题只在**同一 Epic 内**去重（同标题 Story 可合法出现在不同 Epic，见 §7.6）。
3. 缺图提示条在只读/已确认设计下仍显示（信息性；需重新编辑设计才能截图）。
4. 截图超时文案统一为“原型画布渲染超时，请切回「原型」后重试”。
5. 未运行 `smoke:*`（本批不涉及交接包生成/开发/opencode 运行时，按 §6.1 只跑测试/build/Playwright）。

### 7.5 未验证

- 真实模型在新 prompt 下是否稳定输出顶层 `stories[]`（prompt 文案与归一化兜底由单测覆盖，未调模型）。
- 真实应用（app1）上的截图/确认/生成（约束禁止）；<768 移动端。
- `smoke:design` / `smoke:design-handoff` 等脚本未重跑（无后端行为链路变更：仅 readiness warning 为新增非阻塞字段）。

### 7.6 复核修复（主会话 must-fix）：同标题 Story 按 Epic 去重

- `backend/src/requirements/outline.ts`：标题去重键改为 Epic 范围 `title:${effectiveEpic}:${normalizeTitle(title)}`（`effectiveEpic = asString(item.epicId) || defaultEpicId || ''`）；raw id 去重保持全局。修复“两个 Epic 各有同名 Story（如都叫「查看列表」）时第二个被静默丢弃”。
- `backend/src/requirements/doc.test.ts` 新增用例：两个 Epic 各一条同名内嵌 Story → 2 条 active、`epicId` 分别为 `EPIC-001`/`EPIC-002`；原有“顶层 + 同 Epic 内嵌重复去重”用例保持通过。
- 顶层优先与 goal 字符串数组行为未变。
- 回归：`npm run build --prefix backend` ✅；`npm test --prefix backend` **149/149**；前端 `npm test` 79/79、`typecheck`、`check:vue` 不变（无前端改动）。

### 7.7 复核/UX 补充（2026-11-13）：设计变更同步弹窗区分“同步”与“确认设计”

问题：需求+设计变更时设计 stale，头部主按钮是「同步需求」，同步弹窗只有「去修改需求 / 暂不处理 / 仅同步新增项 / 重生成受影响项」，用户不清楚“同步”本身就是同步动作、同步后还要再点「确认设计」。

改动（仅 `frontend/src/design/DesignSyncDialog.vue`，不改后端/同步 mode/确认逻辑）：

| 项 | 结果 |
| --- | --- |
| 顶部引导 | 新增 token 信息框（`--rg-ai-soft`/`--rg-ai-border`，非 warning）：`同步 ≠ 确认设计：选择下面任一同步方式后，设计输入会绑定到最新需求并回到草稿；关闭弹窗后请点击右上角「确认设计」完成确认。`（`data-testid="sync-guide"`） |
| 按钮文案 | `仅同步新增项` → **`同步输入（保留设计）`**；`重生成受影响项` → **`同步并重置受影响项`**；mode 仍为 `additions`/`regenerate`；`去修改需求`/`暂不处理` 不变；`data-testid="sync-apply-additions"`/`sync-apply-regenerate` |
| 确认框 | 标题与新按钮一致；正文明确“同步后设计会回到草稿，需要重新点击「确认设计」完成确认”；确认按钮 `继续同步` |
| 说明段落 | 结尾补“两种同步都不会替你确认设计” |
| 成功提示 | stale 已清除时：`需求输入已同步；设计已回到草稿，请点击右上角「确认设计」`；仍 stale 时保留 `已记录，但设计输入仍然过期`；关闭弹窗 + emit applied（不自动确认）不变 |

验证（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`，PORT=3462，`OPENCODE_AUTO_START=false`，不调模型）：临时应用 → 需求确认（v2）→ 实体/页面集/页面确认（设计 draft、input v2）→  reopen 需求并新增 1 个 Story → 再次确认（v3，设计 stale、`需求文档已变更` 阻塞）→ UI 设计页主按钮显示「同步需求」→ 打开同步弹窗（引导文案/新按钮名/旧按钮名消失）→ 点「同步输入（保留设计）」→ 确认框（标题/正文含“回到草稿”“确认设计”）→ 成功提示 → 弹窗关闭、主按钮变「确认设计」、stale 横幅消失、API `stale=false`/`readiness.ok=true` → 点「确认设计」→ 设计 confirmed。**0 console/page/API 错误**；截图 `sync-dialog-light-1440.png`、`design-after-sync-light-1440.png`（临时目录 `C:\Users\icecream\AppData\Local\Temp\opencode\reqdesign-sync-ux\`）。`npm test --prefix frontend` 87/87、typecheck/build/check:vue 通过；后端未改（149/149 未重跑）。

