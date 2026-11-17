# 开发/需求 UX 小改批交接单（1/2/4/5）

日期：2026-11-13
用途：新开实施会话执行；主会话评审。
状态：**待实施**。
范围（#3 已被用户确认“不遮挡了”，**不做**）：
1. 开发 Composer 不再铺满整页，与消息区（timeline content）对齐。
2. Composer Enter 发送、Shift+Enter 换行（保留 Ctrl/Cmd+Enter 兼容）。
3. 开发 agent 默认中文回复/思考提示（prompt 层；模型不保证 100%）。
4. 变更单信息自动带入需求阶段对话输入框（只预填，不自动发送）。
不做 #3、#6/#8、#7；不改 ER/原型/交接包/阶段语义。

**重要**：真实工作台可能在运行（app1 用户数据）。不要修改/删除真实 `data`/`projects/app1`；Playwright 用临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` + 新应用。不要读取/打印真实凭据或 `.env`。

---

## 1. Composer 与消息区对齐

当前：`Composer` 在 `DevView.vue` 的 `.dev-view` 下，是 `.dev-body` 的同级元素 → 横向铺满整个开发页（含左右栏）。

改法：
- 将 `Composer`（以及 `readonly-bar`）移入 `<main class="timeline">` 内部，作为时间线滚动区下方的 flex-shrink 0 footer。
- `Composer.vue` 增加内层 `.composer-inner`：`width: min(880px, 100%); margin: 0 auto;`，textarea + 按钮栏放内层；外层保留 border-top/背景/上下 padding。
- 与 `.timeline-content { width: min(880px,100%) }` 左右对齐；≤768 时与 timeline padding 对齐（如 10px），不产生横向溢出。
- 只读条同样移入 timeline，宽度对齐/可接受全宽（但不再覆盖左栏）。
- 保持 Composer 现有 props/emit/focus；不改发送/停止逻辑。

验证：临时 dev 页面（可用 Playwright route mock 注入 GET `/development`/`sessions`，避免真实模型）：
- 1440/1280/1024/768：Composer 不再横跨会话列表/aside；其左右边界与 `.timeline-content` 对齐（允许 2px 误差）；无横向溢出。
- 只读会话：readonly-bar 不覆盖左栏。
- 截图 4 宽度（浅/深至少覆盖 1440/1024）。

## 2. Enter 发送

`Composer.vue`：
- Enter（无 Shift、非输入法组合）→ `preventDefault` + `emit('send')`。
- Shift+Enter → 换行（不发送）。
- Ctrl/Cmd+Enter 仍发送（兼容）。
- 必须处理输入法：`event.isComposing` 或 `event.keyCode === 229` 时不发送。
- 更新 placeholder 与 hint：`Enter 发送 · Shift+Enter 换行`；busy 时提示保持。
- 空内容不发送（现有 `modelValue.trim()` 判断保留）。

验证（Playwright route mock，拦截 `POST /development/prompt`）：
- 填文本按 Enter → 发出 1 次 prompt、textarea 清空；
- Shift+Enter → 文本换行、未发请求；
- 中文输入法组合态不发送（可用 `isComposing` 的 KeyboardEvent/Playwright evaluate 模拟，至少验证 handler 条件）；
- Ctrl+Enter 仍发送。

## 3. 开发 agent 中文思考

后端 prompt 层（不改 opencode 模型能力）：
- `backend/src/dev/service.ts`：`DEFAULT_DEV_PROMPT`、`REGENERATED_DEV_PROMPT`、变更单 prompt 加一句：`请全程使用中文回复；思考/进度说明也使用中文。`
- `backend/src/dev/phases.ts#buildPhasePrompt`：加同样中文要求（阶段 brief 首条提示）。
- `backend/src/apps/scaffold.ts` 的 `AGENTS.md` 渲染内容加一行：`- 所有回复与思考/进度说明使用中文。`（新应用生效；不改已有 app1 文件）。
- 不改模型/agent 配置；不保证模型 100% 遵守，记录观察。
- 需求/设计 chat 已有中文提示，不在本批强制改。

验证：
- 后端单测断言 `buildDevPrompt`（初次/重新生成/变更单）与 `buildPhasePrompt` 含中文要求；
- 不调用真实模型（如需，临时应用单独记录，不阻塞）。

## 4. 变更信息自动带入需求对话

后端已有 `ChangeSetInfo.description`；前端：
- `RequirementsDocView.vue` 根据 `activeChangeSet` 生成 `initialChatPrompt`：
  ```
  本次变更 #N：<title>
  变更说明：<description 或 “（未填写）”>
  请基于现有需求文档，先列出本次变更涉及的需求点、影响范围和建议修改的章节；我确认后再修改文档。不要重写无关章节。
  ```
  只在需求阶段（doc 为 draft / change set active）使用；无 activeChangeSet 或初始开发 #1 不生成。
- `DocChatPanel.vue` 新增可选 prop `initialPrompt?: string`；在 `load()` 完成后，若：
  - `messages.length === 0`（没有历史对话）
  - `draft` 为空
  - 非 readonly
  则 `draft = initialPrompt.trim()`。
- **绝不自动发送**；用户可编辑后按 Enter 发送。
- 不覆盖用户已有草稿/历史；同一页面重复挂载时，只要用户还没发/删，预填仍可出现（可接受；不引入 localStorage）。
- 设计阶段 chat 本批不预填（后续可做）。

> **2026-11-13 must-fix 修正**：原实现“有历史就不预填”在真实变更流程（需求阶段已有历史）中失效。现改为：**有历史也预填一次**；`prefillKey`（appId + changeSetId）写入 localStorage 标记，刷新/重挂载不重复；已有非空草稿不覆盖、不标记。详见 §7.5。

验证（Playwright，临时应用）：
- 构造 active change set（scope requirements 或 requirements+design）且需求文档为 draft；
- 打开需求页：Composer 预填包含变更标题与说明，未自动发消息（无 user 消息、无 prompt 请求）；
- 发送后正常进入对话；刷新/再次打开时若有历史则不覆盖；
- 无 activeChangeSet 的初始应用不预填。

---

## 5. 验证与边界

```powershell
npm test --prefix backend
npm test --prefix frontend
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm run check:vue --prefix frontend
npm run build --prefix backend
```

- 后端基线 149；前端基线 87（本批新增测试后按实际回传）。
- Playwright 临时目录：`C:\Users\icecream\AppData\Local\Temp\opencode\dev-ux-batch\`；不调真实模型；可 route mock 开发页，变更单用 API/临时应用。
- 0 console/page error、0 意外 API>=400、无横向溢出；结束停止临时后端/端口；真实 app1/data 不变。

## 6. 文档

- 本交接单追加 `## 7. 实施结果`（改动/命令/截图/偏差/未验证）。
- `docs/STATUS.md` 新增本次小改批小节 + 摘要表行；写明 #3 按用户确认删除。
- 不改 `AGENTS.md`（主会话评审后统一更新）。

## 7. 实施结果

**日期**：2026-11-13（实施会话）

**范围**：#1 Composer 对齐、#2 Enter 发送、#4 开发 agent 中文提示、#5 变更单预填。#3（原“开发阶段条/布局遮挡”）按用户确认**不做**，本批未改阶段条/阶段布局。

### 7.1 改动文件

前端：

- `frontend/src/dev/Composer.vue`：新增 `.composer-inner`（`width: min(880px,100%); margin:0 auto`），横向 padding 与 `.timeline-scroll` 一致（20px；≤768 为 10px）；Enter 发送、Shift+Enter 换行、Ctrl/Cmd+Enter 兼容；`isComposing`/`keyCode 229` 输入法保护；placeholder/hint 更新为 `Enter 发送 · Shift+Enter 换行`；空内容不发送。
- `frontend/src/dev/DevView.vue`：`Composer` 与 `readonly-bar` 移入 `main.timeline`，作为时间线 flex-shrink 0 footer；新增 `.timeline-main` 包裹滚动区与“回到最新”，避免按钮压住输入框；未改阶段条与阶段弹窗。
- `frontend/src/requirements/RequirementsDocView.vue`：由 `activeChangeSet` 计算 `initialChatPrompt` 与 `prefillKey`（appId + 变更单 ID）并传给 `DocChatPanel`（无 active / 初始开发 #1 为空）。
- `frontend/src/requirements/DocChatPanel.vue`：新增可选 `initialPrompt`/`prefillKey`；`load()` 完成后即使已有历史对话也可预填一次；同一变更单用 localStorage 标记防重复；已有非空草稿不覆盖、不标记；绝不自动发送，只读不预填。
- `frontend/src/changesets/change-set-prompt.js`（新增）：变更单预填纯函数（标题/说明，说明空写“（未填写）”）、预填 key、预填决策与标记（存储不可用时仍按空草稿预填）。
- `frontend/src/changesets/change-set-prompt.test.mjs`（新增）：9 项单测（生成/key/一次标记/草稿不覆盖/只读/存储不可用）。
- `frontend/package.json`：`test` 脚本加入 `change-set-prompt.test.mjs`。

后端：

- `backend/src/dev/service.ts`：`DEFAULT_DEV_PROMPT`、`REGENERATED_DEV_PROMPT`、变更单 prompt 统一追加 `请全程使用中文回复；思考/进度说明也使用中文。`（不改模型/agent 配置）。
- `backend/src/dev/phases.ts#buildPhasePrompt`：阶段 brief 增加同一句中文要求。
- `backend/src/apps/scaffold.ts`：新应用 `AGENTS.md` 增加 `- 所有回复与思考/进度说明使用中文。`（`writeIfMissing`，不改已有 app1）。
- `backend/src/dev/service.test.ts`：新增初次/重新生成/变更单三种首条提示的中文断言。
- `backend/src/dev/phases.test.ts`：阶段 brief 中文要求断言。
- `backend/src/apps/scaffold.test.ts`：`AGENTS.md` 中文行断言。

### 7.2 命令与结果

```powershell
npm test --prefix backend        # 150/150 通过（基线 149，+1；本次 must-fix 未改后端）
npm test --prefix frontend       # 96/96 通过（基线 87，+9）
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm run check:vue --prefix frontend
npm run build --prefix backend
```

typecheck / frontend build / check:vue（“OK: 全部 SFC 导入完整”）/ backend build 均通过。未调用真实模型。

### 7.3 Playwright（临时目录）

目录：`C:\Users\icecream\AppData\Local\Temp\opencode\dev-ux-batch\`
（临时后端 `PORT=3463`，`RG_DATA_DIR`/`RG_PROJECTS_DIR` 指向该目录；`OPENCODE_AUTO_START=false`；结束时已停止，3463 已释放。）

#1/#2 开发页路由 mock（不调模型），结果：

- 1440/1280/1024/768：`.composer-inner` 与 `.timeline-content` 左右边界差 **0.00px / 0.00px**；Composer 位于 `main.timeline`；1440/1280 不覆盖左会话栏/右信息栏；均无横向溢出。
- 深色 1440/1024：`html.dark` 生效，对齐仍为 0.00px，无横向溢出。
- Enter 发送 1 次并清空；Shift+Enter 换行且不发送；Ctrl+Enter 发送；`isComposing=true` 与 `keyCode 229` 均不发送；空白内容不发送。
- 只读会话：`.readonly-bar` 位于 `main.timeline`，不覆盖左侧会话栏，不渲染 Composer。
- 截图 10 张（`shots/`）：`dev-composer-{1440,1280,1024,768}-light.png`、`dev-composer-{1440,1024}-dark.png`、`dev-readonly-1440-light.png`、`req-change-prefill.png`、`req-change-history-prefill.png`、`req-change-draft-preserved.png`。

#5 真实后端临时应用（`ux-change` 无历史；`ux-change-history` 已有历史对话；`ux-draft` 用于草稿不覆盖；`ux-plain` 无变更单）+ 聊天 SSE 路由 mock：

- `ux-change`：输入框预填标题/说明/处理指令，无历史消息、无自动 prompt 请求（0 次）；预填后写 localStorage 标记（`rg.change-prefill.ux-change.cs-ux-change-2`）；刷新后不重复预填、仍无历史消息。
- `ux-change-history`（**must-fix 回归**）：已有历史对话时仍预填变更标题/说明（历史消息正常显示），不自动发送；用户 Enter 后才发送 1 次；发送并刷新后不重复预填、保留历史。
- `ux-draft`：加载期间用户已有非空草稿时不被覆盖，且不写标记；清空草稿并重载后同一变更单仍可预填，预填成功才写标记。
- `ux-plain`：无 activeChangeSet 不预填、不显示变更 chip。
- 全程 0 console/page error、0 意外 API>=400。

### 7.4 偏差 / 未验证

- 偏差：为让“回到最新”按钮不压住移入 timeline 的 Composer，额外新增 `.timeline-main` 包裹层（`position: relative`）；未改阶段条/阶段语义。
- 偏差：#5 的 active 变更单 #2 通过临时 SQLite 直接插入（应用/需求文档/对话均走真实 API），未走完整 `startChangeSet` 确认链；仅用于 UI 预填验收。
- #3 不做（用户确认），未改阶段条/布局。
- 未验证：真实模型是否 100% 遵守中文要求（prompt 层约束，按设计不保证）；设计阶段 chat 预填未做（本批范围外）；真实 app1 未做功能回归（按要求不触碰）。
- 真实工作台 3300 仍在运行；`projects/app1`、真实 `data/` 未被修改/删除。临时环境仅在 `C:\Users\icecream\AppData\Local\Temp\opencode\dev-ux-batch\`。

### 7.5 主会话 must-fix（2026-11-13）

- 问题：原实现 `messages.length > 0` 直接跳过预填；真实变更流程中需求阶段已有历史，导致 #5 在最需要的场景不生效。
- 修复：预填不再依赖历史消息；`RequirementsDocView` 传入 `prefillKey`（`rg.change-prefill.<appId>.<changeSetId>`），`DocChatPanel` 在 `load()` 后按“有 prompt + 非只读 + 草稿为空 + 未标记”预填；真正预填后才写 localStorage 标记，刷新/重挂载不重复。
- 草稿策略（确定性）：已有非空草稿 → 不覆盖且**不标记**，之后草稿为空时仍可预填；存储不可用（隐私模式/抛错）→ 仍按空草稿预填（刷新后可能再次预填）。
- 验证：前端 **96/96**；Playwright 新增/更新 5 类场景（无历史预填、有历史预填回归、刷新不重复、草稿不覆盖后清空可预填、无 active 不预填）全部通过，0 console/page/API 错误。

