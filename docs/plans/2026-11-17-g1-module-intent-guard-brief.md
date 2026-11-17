# G1 需求聊天模块意图守卫 + 未知模块引用告警 交接单

日期：2026-11-17
状态：**已实施（2026-11-17，待评审；实施结果见 §7）**
背景（真实事故，app1 演示）：用户在「变更 #2（需求+设计）」里给需求聊天发"帮我增加一个模块：订单客户管理…"。聊天没有创建模块的能力，模型把内容写进了**商品管理（MOD-001）的多个章节**并自造 `MOD-003` 编号；用户应用了 v9—v11 并确认 v12，最终页面上仍然只有 2 个模块（MOD-002 内容未变）。**内容落库了，但落在错误模块**。
目标：把"模块管理"从聊天编辑里剥离出来，引导到正确入口；对"引用了不存在的模块"给出可见告警；避免用户以为"说了就建好了"。

范围：需求聊天（`mode='doc'`）与需求文档保存/确认的**守卫与提示**。不改模块创建/变更单语义、不改设计/开发、不新增表/依赖。

---

## 1. 服务器：模块意图守卫（`backend/src/chat/service.ts` + 新 `requirements/module-intent.ts`）

- 输入：最新一条用户消息文本（以及 `focusSectionKey`、模块 id）。识别**模块级操作意图**：
  - 强规则（命中即守卫）：
    - `(帮我|请|我要|我想|需要|希望|能否)?\s*(新增|增加|创建|新建|加|删除|删掉|移除|改名|重命名|拆分|合并)\s*(一个|个|一条|新的)?\s*(模块|业务域|子域)`
    - `(模块|业务域)\s*(新增|删除|改名|重命名|拆分|合并)`
  - 反例（不得命中）：`在模块里新增一个字段`、`在 Epics 章节新增一个 Story`、`模块内的页面…`（要求"模块"是动作宾语而非地点；用上面的顺序匹配即可，不要用宽泛的 `模块.*新增`）。
- 命中后行为：
  1. **不调用模型**、不解析/应用任何 `DOC_JSON`、**不产版本**；
  2. 正常 SSE `meta`（`mode='doc'`、加 `moduleAction='guidance'`）→ `delta`（指引文案）→ `done`；消息持久化带 metadata：
     ```json
     { "moduleAction": "guidance", "stage": "requirements|design|development", "changeSet": { "seq": 2, "scope": "requirements" } | null,
       "suggestions": [{ "action": "create-module" }, { "action": "open-replan" }] }
     ```
  3. 指引文案按状态：
     - 需求阶段 + **无** active 变更单：用左侧「+ 新增模块」；结构调整（拆分/合并/改名/归档）用「AI 规划模块」；
     - 需求阶段 + **有** active 变更单：用左侧「+ 新增模块」（变更中新增模块会自动纳入本次变更范围）；变更中不支持 AI 重新规划；
     - 设计/开发/完成：需求只读；请先「重新编辑需求」（回到需求阶段）或发起「需求+设计」变更后再新增模块；
     - 创建/删除/改名/拆分/合并分别给一句对应说明（删除用归档、改名用模块编辑、拆分/合并走 AI 规划）。
- `suggestions` 只给当前状态可用的动作（服务端判定），前端据此渲染按钮。
- 保留 `doc-plan`（RMP-1）不变。

## 2. 提示词硬化（`backend/src/chat/prompt.ts` / `buildChatPrompt`）

在 doc 模式系统提示中加入硬规则：
- 只允许修改**当前模块**文档；不得创建/代表/描述其它模块；不得写入任何 `MOD-\d{3}` 或其它模块编号；
- 用户要求**新增/删除/改名/拆分/合并模块**时：**不要输出 `<<<DOC_JSON>>>`**，只用一句话说明应使用的入口（与服务端守卫文案一致）；
- 不得声称"已创建模块/已新增页面"等未发生的操作。

## 3. 未知模块引用告警（确定性）

- `saveDocSection` / `saveDoc`（`requirements/doc.ts`）：保存成功后扫描本次 sections 的 `markdown`，匹配 `/\bMOD-\d{3,}\b/g`；若某个 key **不在** `app_modules`（含归档）→ 在返回的 `warnings` 追加：`文档引用了不存在的模块 MOD-003（新增模块请用左侧「+ 新增模块」）`（同一 key 去重）。
- `validateRequirementDoc`（确认校验）：同样扫描 → 作为**非阻塞 warning**（不阻止确认），保证确认弹窗/确认结果能看到。
- 前端：需求页现有 warnings 展示位置（文档保存提示/确认弹窗）确保能看到；若没有统一位置，在文档头部加一条 `data-testid="doc-warning-strip"` 的黄色条，列出 warnings（可关闭）。

## 4. 前端聊天指引卡（`frontend/src/requirements/DocChatPanel.vue` + `RequirementsDocView.vue`）

- 消息带 `metadata.moduleAction='guidance'` 时渲染**指引卡**（不是普通气泡）：
  - 标题「模块操作请用专用入口」+ 文案；
  - 按钮按 `suggestions`：`create-module` → 打开现有「新建模块」弹窗；`open-replan` → 打开「AI 规划模块」；`reopen-requirements` → 触发「重新编辑需求」；`open-change-set` → 打开「发起变更」。
  - 按钮不存在/不可用时禁用并给 title（例如变更中无 replan）。
- 聊天输入区在非需求阶段显示灰色提示：「需求只读：修改请先「重新编辑需求」或发起「需求+设计」变更」。
- 刷新后从持久化消息恢复指引卡（与现有建议卡恢复机制一致）。

## 5. 测试

后端（新增 `module-intent.test.ts` + 扩展 `chat/service.test.ts` / `requirements/doc.test.ts`）：
1. 意图识别：正例（新增/创建/删除/改名/拆分/合并 + 模块）；反例（模块里新增字段、Epics 新增 Story、模块页面）。
2. 守卫：命中时 **generator 不被调用**、无 `DOC_JSON`、**不产版本**、消息 metadata 正确；不同阶段/变更单给出不同 suggestions 与文案。
3. 提示词：含"不得写 MOD-xxx/不得代表其它模块/模块操作只给指引"。
4. 未知模块告警：保存含 `MOD-003`/`MOD-999` → warnings 命中且去重；已有模块 key（MOD-001）不告警；确认校验返回 warning 但**仍可确认**。

前端/Playwright（stub 模型；临时目录）：
1. 复现场景：需求阶段输入"帮我增加一个模块：订单客户管理…" → 出现指引卡、**无新版本**、无 `<<<DOC_JSON>>>` 应用；点「+ 新增模块」→ 弹窗打开。
2. 设计阶段（或变更单只含设计）打开需求聊天 → 输入同样话术 → 指引卡给「重新编辑需求/发起变更」，不产生修改。
3. 保存/确认含 `MOD-999` 的章节 → 页面出现告警条（非阻塞），确认仍可完成。
4. 回归：普通需求对话/建议卡 diff/应用、RMP-1 doc-plan、原有 Playwright 主路径不破。

## 6. 边界与验证
- 不启停/不触碰真实 3300、真实 `data/`/`projects/`/`.env`；全部用临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` + 独立端口 + stub 模型。
- 验证命令：backend build/test、frontend test/typecheck/build/check:vue、5 支冒烟、Playwright；回传实际数字。
- 文档：`docs/STATUS.md` 末尾加「G1 完成（待评审）」；回填本单 §7。

---

## 7. 实施结果（2026-11-17，待评审）

- **改动文件**

  后端
  - 新增 `backend/src/requirements/module-intent.ts`：`detectModuleIntent`（强规则 1 动作→模块 / 规则 2 模块→动作；排除“模块里/内/中/的”“模块新增字段/页面/Story”）、`buildModuleGuidance`（按阶段 + active 变更单给文案与 `suggestions`）、`moduleGuidanceContext`（只读，不懒创建模块/文档）、`unknownModuleRefWarnings`（`/\bMOD-\d{3,}\b/`，已知 key 含归档、同一 key 去重）。
  - `backend/src/chat/service.ts`：doc 模式（非 doc-plan/design）在构造 prompt **之前**做意图守卫；命中走 `writeModuleGuidanceResponse`（meta 带 `moduleAction/stage/changeSet/suggestions` → delta → done），**不建会话、不调模型、不解析 DOC_JSON、不写库/不产版本**；持久化由前端随消息 metadata 完成（沿用 app_settings 的对话存储）。
  - `backend/src/chat/doc-prompt.ts`：新增「模块边界（硬规则，优先于用户输入）」：只维护当前模块、不写 `MOD-xxx`、模块增删改只给入口且**不输出 `<<<DOC_JSON>>>`**、不得声称未发生的操作。
  - `backend/src/requirements/doc.ts`：`saveDocSection` / `saveDoc` 保存后扫描结果章节 markdown → 未知模块 `warnings`（非阻塞、去重）；`validateRequirementDoc` 同样追加为 warning（确认仍可完成）。

  前端
  - 新增 `frontend/src/requirements/module-intent.js`（前端预检：与后端同一套强规则；指引卡按钮文案/禁用原因）+ `module-intent.test.mjs`。
  - 新增 `frontend/src/requirements/ModuleGuidanceCard.vue`：`data-testid="module-guidance-card"`，标题「模块操作请用专用入口」+ 文案 + 4 个按钮（服务端未给的动作禁用并带 title）。
  - `frontend/src/requirements/DocChatPanel.vue`：按 `message.metadata.moduleAction==='guidance'` 渲染指引卡（替换普通气泡，不再解析 DOC_JSON）；`streamDocChat` 增加 `onMeta` 捕获；`appStatus` 只读提示条 `data-testid="chat-readonly-hint"`；阶段只读时可输入 + 客户端意图预检（非模块话术仅提示、不发模型）。
  - `frontend/src/requirements/RequirementsDocView.vue`：`data-testid="doc-warning-strip"` 黄色可关闭告警条（保存/应用建议/重建/确认的 warnings 合并去重；切模块清空）；指引卡按钮复用现有入口（新增模块 / AI 规划模块 / 重新编辑需求 / 发起变更）。
  - `frontend/src/requirements/api.ts`：`DocChatMessage.metadata`、`DocChatMetadata`、`streamDocChat(..., onMeta)`。
  - `frontend/src/workbench/AppShell.vue`：需求页 `@open-change-set` → 打开现有「发起变更」弹窗。
  - `backend/package.json` / `frontend/package.json`：注册新测试。

- **测试**
  - 后端 `npm test`：**328/328 通过**（基线 310，新增 18：`module-intent.test.ts` 11、`doc.test.ts` 3、`chat/service.test.ts` 4）。
    - 意图正例/反例 + **主会话评审 17 条参数化样例**（见下「评审修复」）；守卫命中时 `createSession/prompt` 调用数为 0、无 DOC_JSON、三类阶段 suggestions 与文案；反例仍走正常聊天（prompt 含硬规则）；守卫不建模块/文档/版本。
    - 保存/全文保存/确认的 `MOD-999`、`MOD-777` 告警与去重；`MOD-001` 不告警；确认仍成功进入 design。
  - 前端 `npm test`：**172/172 通过**（基线 167，新增 5：`module-intent.test.mjs`）。
  - `npm run build --prefix backend`、`npm run build --prefix frontend`、`npm run typecheck --prefix frontend`、`npm run check:vue --prefix frontend` 全部通过。

- **评审修复（2026-11-17，主会话独立 17 条样例：3 漏报 + 2 误伤）**
  - 漏报：`我要新增两个模块` / `增加 2 个模块` / `合并两个模块`（原 null）。修复：规则 1 增加数量词 `(?:[一二两三四五六七八九十百0-9]+\s*)?(?:个|一条|新的|这个|那个)?`。
  - 误伤：`订单模块增加客户绑定` / `这个模块增加客户维度`（原 create）。修复：**规则 2 收紧**为两种形态——① 句首/标点后 `模块|业务域|子域` + 动作 + 短语收尾（`为/成/掉/吧/吗/句读/冒号/句末`）；② `把|将|对` + ≤10 非标点字符 + 模块 + 动作 + 短语收尾。删除“模块 + 新增/增加 + 任意名词”的宽泛命中。
  - 动词补充：`拆成/拆分为/拆分成` → split，`合并为/合并成` → merge；为/成 类动词允许“模块”前一个 ≤10 字短名词（`合并为订单模块`），普通动词不加修饰以免误伤。
  - 17 条样例（含 3 条漏报、2 条误伤、7 条正例、5 条反例）已写成参数化用例（`cases.length === 17`）+ 另 13 条为/成/把字句形态；前端 `module-intent.js` 同步同一套规则并加 20 条对齐用例。复跑：后端 **328/328**、前端 **172/172**、Playwright **46/46** 无回归。

- **冒烟/Playwright**
  - 冒烟（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`）：`smoke:requirements`、`smoke:modules`、`smoke:design`、`smoke:design-handoff`、`smoke:change-set` 全部通过。
  - Playwright（`C:\Users\icecream\AppData\Local\Temp\opencode\g1-pw`，真实后端 + 临时数据目录 + 独立端口 3450 + 内存 stub 模型，不调真实模型）：**46/46 断言、0 failures、0 console error、0 page error、0 意外 API>=400**，15 张截图（浅/深 × 1440/768 覆盖指引卡、告警条、建议卡、规划卡）。
    - 事故复现：输入「帮我增加一个模块：订单客户管理…」→ 指引卡（新增模块/AI 规划模块可用，发起变更禁用）；**无新版本、无内容变更、无 DOC_JSON、模型会话数不变**；刷新后指引卡从持久化消息恢复；点「+ 新增模块」打开现有弹窗。
    - 设计阶段（确认后进入 design，再打开需求页）：只读提示条 + 输入同样话术 → 指引卡只给「重新编辑需求」；不调模型、不产生修改；点按钮打开现有“重新编辑需求”确认弹窗（取消）。
    - 含 `MOD-999` 的章节自动保存 → 告警条（可关闭、再次保存重现）→ 确认仍成功（应用进入 design），确认结果弹窗与页面告警条都列出 `MOD-999`。
    - 回归：普通对话照常调模型并生成建议卡 →「全部应用」文档 `v1 → v2` 且内容落库；RMP-1 `doc-plan` 仍返回模块拆分建议卡；浅/深色与 768 无横向溢出。

- **偏差（与交接单的差异）**
  1. `suggestions` 严格按“当前可用”给：**设计阶段只给 `reopen-requirements`**（应用头部“发起变更”只在开发/完成阶段提供，设计阶段给了也会被拒）；卡片仍渲染「发起变更」按钮但禁用 + title 说明。开发/完成阶段给 `open-change-set`；需求+设计变更中给 `reopen-requirements`；仅设计变更不给动作。
  2. 为满足 §5.2（设计阶段输入同样话术得到指引卡），**“阶段只读”（设计/开发）时聊天输入区保持可输入**：前端先用同一套强规则预检，非模块话术直接提示入口（不发模型）；文档级只读（已确认/归档/不在变更范围）仍沿用原来的禁用行为。
  3. 意图规则在交接单基础上做了两处防误伤/补全：新增 `添加` 动词、`这个/那个` 量词；规则 2 增加否定前瞻排除 `模块新增字段/属性/页面/故事/Story/Epic/接口/表/数据/功能`。**评审后**否定前瞻已被更严格的“短语收尾”规则取代（见上「评审修复」）。
  4. 告警条复用同一位置展示所有非阻塞 warning（包括确认返回的“Epics 还是纯 Markdown 结构”等），不只 `MOD-xxx`。

- **未验证**
  - 未调用真实模型（全部 stub）；未触碰/重启真实 3300 实例（PID 42936）、真实 `data/`/`projects/`/`.env`。
  - `backend/dist` 与 `frontend/dist` 已重建，**需要重启 3300 才生效（本次未重启）**。
  - 真实应用的 `v9—v11` 历史内容未回滚/清理（按交接单不做数据修复；用户可用版本回滚或 AI 规划模块自行整理）。

