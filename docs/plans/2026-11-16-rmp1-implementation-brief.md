# RMP-1：首次模块规划 + 逐模块生成（实施交接单）

日期：2026-11-16
用途：新开实施会话执行；主会话评审。**只做 RMP-1；RMP-2（随时重规划）等 RMP-1 评审通过后再做。**
状态：**已完成并复评（2026-11-16，含真实模型 E2E 通过）**。
上游：`docs/plans/2026-11-16-requirements-module-planning-design.md`（已定稿）、`docs/plans/2026-11-13-module-requirements-design.md`、`docs/plans/2026-11-11-r2a-implementation-brief.md`、`docs/plans/2026-11-16-requirements-outline-modules-brief.md`、`docs/STATUS.md`。
基线：后端 **224**、前端 **128**；`apps=0`、`projects/` 空（app1 已按用户要求删除）。真实实例 3300 运行中，**不得启停/修改**；验证只用临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`/端口；不调真实模型（除主会话后续 E2E）。

---

## 1. 目标（RMP-1 验收）

1. 新应用（仅一个空默认模块）首次输入实质需求时，AI **先只返回模块拆分建议**，不直接写文档。
2. 聊天中展示可编辑的「模块拆分建议」卡；用户确认后：
   - **复用空默认模块**为第一个模块（保留 ID/对话）；
   - 新建其余模块；
   - 逐模块生成完整模板 PRD（SSE 进度、失败重试、可取消）；
   - 每模块 draft，不自动确认。
3. 用户样例：
   > 做一个订单管理系统，含有商品列表、新增、修改、删除；含有商品明细列表、新增、修改、删除；含有订单管理，选择商品生成订单，但不做支付，直接生成订单；订单和商品一对多关系；商品和明细一对一关系
   应建议 **商品管理 + 订单管理** 两个模块；不出现“商品明细模块”“支付模块”；商品明细归商品管理；订单引用商品作为跨模块依赖。
4. 支持「保持单模块」：不拆分，按现有单模块流程生成默认模块 PRD。
5. 规划消息随聊天持久化；刷新/重进可继续看到建议卡（已应用则展示已应用状态）。
6. 不改设计阶段、交接包、Change Set、U7；不改数据库表（不新增表）。

---

## 2. 边界与守卫（本轮必须写死）

- 仅当**全部满足**时才进入首次规划模式：
  - `app.status === 'requirements'`；
  - 无 active Change Set；
  - 未归档模块恰好 **1 个**；
  - 当前模块文档 **所有章节为空**（`markdown.trim()===''`）、`doc.status==='draft'`；
  - 应用级需求尚未最终确认（app 未进入 design）。
- 一旦默认模块文档有任何内容、或出现第二个未归档模块：**不再自动进入规划模式**；按现有 doc 聊天。
- 规划建议卡**不写库**；只有用户点“应用拆分并生成”才创建模块。
- 应用前再次校验上述条件；若文档已被手动编辑/已有多个模块 → **409**，提示先使用现有单模块流程（RMP-2 再提供重规划），不得覆盖内容。
- **最终“完成需求阶段”后**：模块/已确认需求锁定；设计/开发阶段不提供本入口（RMP-2 才做入口/门禁提示；RMP-1 只需不在这些阶段触发）。
- 模块数量不设硬上限；>8 个给 warning/时长提示；技术保护 **50**（超过 400）。
- 不按 CRUD/实体拆模块（prompt 规则 + 简单 warning）；标题非空且唯一。

---

## 3. 复用基线

- 后端：`chat/service.ts`（SSE/opencode/model/agent）、`chat/doc-prompt.ts`（历史/模板/协议风格）、`requirements/doc.ts`（`saveDoc`、`getRequirementDoc`、`applySectionUpdates`、`source='ai'` 版本）、`requirements/modules.ts`（`createModule`/`createModuleRow`/`docTitleFor`/`ensureDefaultModule`）、`requirements/routes.ts`、`app_settings`（chat 历史/模型）。
- 前端：`DocChatPanel.vue`（SSE、消息持久化、DOC_JSON 解析/建议）、`requirements/api.ts`（`streamDocChat`）、`RequirementsDocView.vue`（模块/文档/大纲）、`module-helpers.js`、现有主题 token/响应式。
- 协议解析：参考 `doc-protocol.js`（分隔符/容错 JSON/回退）。

---

## 4. 规划协议 `MODULE_PLAN_JSON`

分隔符：`<<<MODULE_PLAN_JSON>>>`（新增，与 `DOC_JSON`/`DESIGN_JSON` 并列）。

```jsonc
{
  "kind": "initial",
  "modules": [
    {
      "key": "product",
      "title": "商品管理",
      "description": "商品与商品明细的档案维护",
      "scope": ["商品档案 CRUD", "商品明细 CRUD", "商品与明细 1:1"],
      "suggestedEpics": [
        { "title": "商品档案", "stories": ["商品列表", "新增商品", "修改商品", "删除商品"] },
        { "title": "商品明细", "stories": ["明细列表", "新增明细", "修改明细", "删除明细"] }
      ],
      "existingModuleId": null,
      "action": "create"
    },
    {
      "key": "order",
      "title": "订单管理",
      "description": "选择商品生成订单，不做支付",
      "scope": ["订单创建", "订单查询", "订单状态（待确认）"],
      "suggestedEpics": [
        { "title": "订单创建", "stories": ["选择商品生成订单", "订单列表/详情"] }
      ],
      "existingModuleId": null,
      "action": "create"
    }
  ],
  "dependencies": [
    { "from": "order", "to": "product", "description": "订单引用商品，N:1；订单模块不重复建商品实体" }
  ],
  "coverage": [
    { "requirement": "商品 CRUD", "moduleKey": "product" },
    { "requirement": "商品明细 CRUD", "moduleKey": "product" },
    { "requirement": "订单创建/查询", "moduleKey": "order" }
  ],
  "unassigned": [
    { "requirement": "订单状态流转", "reason": "需求未明确状态机，作为待确认" }
  ],
  "openIssues": ["订单是否需要库存扣减？", "商品/明细删除是否受订单引用限制？"],
  "warnings": ["未发现支付模块（符合“不做支付”）"]
}
```

规则（prompt 必须写明）：
- 模块按**业务域/协作边界**拆；禁止按“列表/新增/修改/删除”或单个实体拆；
- 同域实体与明细归一个模块（商品 + 商品明细 → 商品管理）；
- 明确排除项不生成模块（不做支付 → 不生成支付模块）；
- 模块数由内容决定；通常 1—6；不设硬上限；过多给 warning；
- 标题用业务域名词；非空、唯一；
- `scope` 写边界与排除项；`suggestedEpics` 只用于预览；
- `coverage` 列已覆盖需求；`unassigned` 列未分配/待确认；不阻塞应用但显示 warning；
- `existingModuleId`/`action` 在 RMP-1 固定为 `null`/`create`（RMP-2 才用 keep/rename/regenerate/archive）；
- 首次规划 `kind='initial'`；只输出计划，不输出 DOC_JSON、不写文档。

解析/校验：
- 容错（代码块/尾随分隔符/尾逗号）；无法解析 → 不写库，返回可读错误；
- 后端校验模块数 ≥1、≤50、标题非空唯一、`existingModuleId` 为空、`action='create'`；
- 前端展示校验错误并允许重试/继续聊天 refinement。

---

## 5. 后端实现

### 5.1 规划聊天模式

- `POST /api/apps/:id/chat` 新增 `mode: 'doc-plan'`（仅 requirements stage）：
  - 守卫：阶段、请求体、opencode/模型沿用现有；
  - 若应用不满足首次规划条件 → 409（错误信息说明先用单模块/后续重规划）；
  - 新增 `chat/module-plan-prompt.ts`：`buildModulePlanChatPrompt(context, messages)`；
    - 输入：应用名、模板（章节/guidance）、当前模块（应为 1 个空默认）、用户消息/历史；
    - 输出：简短中文回复 + 分隔符 + JSON；
    - 明确“只规划、不写文档”；
  - SSE 仍用现有 `meta/delta/done/error`；
  - 消息持久化仍写默认模块 chat key（`app.<id>.requirementsDocChat.<moduleId>`）；
  - 规划模式**不得**写文档/产版本/建模块。
- 规划模式可连续多轮（用户补充“再加售后模块”），每次返回更新后的计划；doc 仍为空。
- 测试：prompt 包含规则/分隔符/模板；mode 守卫；非首次条件 409；无文档写入。

### 5.2 应用模块结构

`POST /api/apps/:id/requirements-modules/plan/apply`

Body：
```jsonc
{ "plan": { /* 编辑后的 MODULE_PLAN_JSON */ } }
```

行为（事务）：
1. 重新校验首次规划条件 + plan 校验（§4）；不满足 → 409/400，不写库。
2. 第一个模块复用默认模块：
   - 更新 `title/description/required/position`（保留 ID、文档、版本、对话）；
   - 更新文档标题为 `${appName} · ${title} 需求文档`（显式覆盖 `MOD-001` 旧特例，保证新语义）；
   - 章节保持空；
3. 其余模块按顺序新建（复用 `createModuleRow` + 空文档 v1；key 依次 MOD-002…；position 0..n-1）；
4. 在 `app_settings` 写入（供生成使用）：
   - `app.<id>.modulePlanApplied` = 校验后的 plan JSON（含模块 ID 映射，建议补 `moduleId`）；
   - `app.<id>.modulePlanSource` = 默认模块 chat 中全部 user 消息拼接（截断上限，例如 60k 字符）；
5. 返回：
```jsonc
{
  "modules": [{ "id","moduleKey","title","position" }],
  "created": [...], "reused": { ... },
  "generation": [{ "moduleId","title" }]
}
```
- 不生成文档、不确认、不进入 design。
- 重复 apply（已多模块/文档有内容）→ 409；前端会禁用按钮。
- 测试：复用/改名/标题/新建顺序/key/position、source/settings、守卫、事务回滚。

### 5.3 逐模块生成

`POST /api/apps/:id/requirements-modules/generate`（SSE）

Body：
```jsonc
{ "moduleIds": ["..."], "reason": "initial" | "single" | "retry" }
```
- `initial`：读取 `modulePlanApplied` + `modulePlanSource`；默认生成 plan 中全部模块（或前端传 moduleIds）。
- `single`：不拆分；只生成当前默认模块（moduleIds 应为该模块）。
- `retry`：只生成指定失败模块；plan/source 仍从 settings 读取。
- 守卫：requirements、无 active Change Set、模块属于本应用且未归档、模块可写；plan/source 缺失且非 single → 409。
- 逐模块顺序生成；每个模块：
  1. 读取模板/当前模块；
  2. `buildModuleGeneratePrompt`：
     - 应用/模板全部章节/required/guidance；
     - `modulePlanSource`（原始需求/补充）；
     - 全部模块规划（标题/scope/依赖/覆盖/openIssues），强调只写当前模块；
     - 当前模块 scope/out-of-scope/建议 Epics；
     - 输出协议 `<<<DOC_JSON>>>`（沿用现有规则）+ 本模块约束：
       - 完整覆盖模板章节；required 不能空；不适用写“本模块不涉及”；
       - Scene/Epic/Story 只属于本模块；省略 ID（后端分配）；
       - 每个 Epic 至少 1 Story；
       - 跨模块关系写约束/数据章节，不重复建实体；
       - 排除项不得写成功能；
       - 信息不足 `> 待确认：...`；
  3. 调 opencode（需求阶段 agent/model；独立 session，不写模块 chat 历史）；
  4. 解析 DOC_JSON（容错）；校验/应用：复用 `saveDoc`（`source:'ai'`, snapshot true）或等价内部函数；只写该模块；
  5. 事件/版本：空 v1 → 生成后 `ai` 版本；不自动确认。
- SSE 事件（建议）：
```jsonc
{ "type":"module-start", "moduleId","moduleKey","title","index","total" }
{ "type":"module-done", "moduleId","version","warnings":[] }
{ "type":"module-error", "moduleId","error" }
{ "type":"all-done", "ok":true, "failed":[] }
```
- 失败：记录错误、继续其它模块（或可配置停止；建议继续）；已完成模块保留；前端可重试失败模块。
- 取消：客户端断开/Abort → 尽力中止当前 opencode 会话；已完成保留；未完成模块保持空/部分。
- 测试（不调真实模型，注入生成器/结果）：
  - prompt 只含当前模块边界/依赖；
  - DOC_JSON 应用、版本 `ai`、不确认；
  - 失败/重试/取消；守卫；事件顺序；
  - 全局 ID 由后端分配，不信任 AI ID。

---

## 6. 前端实现

### 6.1 首次规划模式

- `RequirementsDocView` 计算 `initialPlanEligible`：
  - requirements、无 activeChangeSet、1 个未归档模块、`payload.sections` 全空、doc draft、无最终确认。
- 传给 `DocChatPanel`：
  - `plan-mode`（是否用 `doc-plan`）；
  - `plan-applied`/`plan-generating` 状态；
  - 事件 `plan-updated`、`apply-plan`、`keep-single`。
- `DocChatPanel`：
  - `streamDocChat` 支持 `mode: 'doc' | 'doc-plan'`；
  - 新增 `module-plan-protocol.js`：`splitModulePlanOutput(raw)` → `{ reply, plan }`，容错；
  - `runTurn`：plan 模式解析 plan，push assistant 消息（metadata 含 `modulePlan`），不发 DOC_JSON 建议/不写文档；
  - 加载历史时解析含 `MODULE_PLAN_JSON` 的 assistant 消息，恢复计划卡并 emit；
  - 计划消息持久化（metadata 随消息保存）；刷新可恢复；
  - 计划模式下若干轮 refinement 都走 `doc-plan`；
  - 应用/生成后 `plan-mode` 关闭，恢复普通 doc 聊天。
- 计划卡 `ModulePlanCard.vue`：
  - 展示/编辑模块标题、说明、scope（可增删）、排序；建议 Epics（只读/折叠）；
  - 依赖、覆盖、未分配、warnings、openIssues；
  - 校验非空/唯一/≥1；
  - 按钮：`应用拆分并生成`、`保持单模块`；应用后显示“已应用/生成中/已生成”；
  - 失败/无效 plan 显示错误 + 重试（再次聊天或重新应用）。
- 初始用户消息仍进入默认模块 chat；计划卡在同一 chat 中。

### 6.2 应用与生成

- `applyModulePlan(plan)`：
  - 调 `POST /requirements-modules/plan/apply`；
  - 成功后刷新 modules/bundle，选中第一个模块；
  - 调生成 SSE（`reason:'initial'`，moduleIds=generation）；
  - 生成完成后刷新文档/模块/bundle，选中第一个生成模块，提示“已生成 N 个模块，请逐模块确认”。
- `keepSingle()`：
  - 不 apply 结构；调生成 SSE `reason:'single'`、moduleIds=[默认模块]；
  - 完成后刷新；计划卡标记“已保持单模块/已生成”。
- 生成进度 `ModuleGenerationProgress.vue`：
  - 模块列表/状态（等待/生成中/成功/失败/跳过）、当前模块、失败原因；
  - 重试失败模块（`reason:'retry'` + moduleIds）；取消剩余（Abort）；
  - 生成中禁用再次 apply/重规划；允许查看已完成模块。
- 计划卡/进度在 1440/1280/1024/768、浅/深色均正常；使用 `--rg-*` token；无横向溢出。

### 6.3 文件

新增：
- `frontend/src/requirements/module-plan-protocol.js` + `.test.mjs`
- `frontend/src/requirements/module-plan-helpers.js` + `.test.mjs`（编辑/排序/校验/进度纯逻辑）
- `frontend/src/requirements/ModulePlanCard.vue`
- `frontend/src/requirements/ModuleGenerationProgress.vue`

修改：
- `backend/src/chat/service.ts`、新增 `backend/src/chat/module-plan-prompt.ts`
- `backend/src/requirements/routes.ts`、`doc.ts`（如需导出/复用）、`modules.ts`（复用创建/重命名）
- 新增 `backend/src/requirements/module-generation.ts`、`module-plan.ts`（解析/校验/apply）
- `backend/src/requirements/types.ts`、`frontend/src/requirements/api.ts`
- `frontend/src/requirements/DocChatPanel.vue`、`RequirementsDocView.vue`
- 测试、STATUS、本交接单

不改：设计阶段、交接包、Change Set、U7、数据库表结构（仅复用 `app_settings`）。

---

## 7. 验证计划

### 7.1 命令

```powershell
npm run build --prefix backend
npm test --prefix backend        # 基线 224 + 新增；临时 RG_DATA_DIR/RG_PROJECTS_DIR
npm test --prefix frontend       # 基线 128 + 新增
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm run check:vue --prefix frontend
```

### 7.2 Playwright（临时数据、mock 规划/生成，不调真实模型）

- 新应用：默认模块空 → 首条消息走 doc-plan（mock SSE 返回 2 模块计划）→ 计划卡显示商品管理/订单管理、依赖、覆盖；
- 编辑标题/scope、增删/排序、校验；
- 应用 → mock apply → mock 生成 SSE 两模块成功 → 大纲 2 根节点、两份文档、draft、默认模块复用（ID/chat 保留）、新模块 key；
- 保持单模块 → 只生成默认模块；
- 规划失败/非法 JSON → 不写库/可重试；
- 生成失败 → 失败模块标记、重试成功；取消剩余；
- 刷新/重进：计划卡从历史恢复；已应用显示已应用/已生成；
- 守卫：手动编辑文档后不再进入 plan；多模块不再进入 plan；apply 409；
- 1440/1280/1024/768、浅/深色；0 console/page error、0 意外 API≥400、无横向溢出；
- 截图临时目录，不提交。

### 7.3 真实模型 E2E（主会话后续执行，不在实施会话）

- 临时应用 + `packycode-deepseek/deepseek-flash`：
  - 用户样例 → 期望 2 模块（商品管理/订单管理）；商品明细不单独成模块；不生成支付；
  - 应用 → 两模块完整 PRD；商品/明细/订单内容归属正确；订单→商品依赖；
  - 记录耗时/质量；跑完删除临时应用。
- 若真实模型规划质量不足，记录并调整 prompt，不静默接受错误拆分。

---

## 8. 验收标准

- 新应用首条实质需求不再直接生成一份“应用名”PRD，而是先出模块建议；
- 用户样例得到 2 个业务域模块；商品明细归商品管理；无支付模块；
- 应用后复用空默认模块（ID/对话保留），新模块顺序/key 正确；两模块文档逐模块生成；
- 生成 draft、不自动确认；进度/失败重试/取消可用；
- 保持单模块可用；
- 规划卡持久化/刷新可恢复；
- 所有守卫/测试通过；未触碰真实实例/数据；未改设计/交接包/Change Set。

---

## 9. 交付物

- 代码 + 测试；更新 `docs/STATUS.md` 新增「RMP-1 完成」段；
- 回填本交接单 **§10 实施结果**（改动/测试数/Playwright/偏差/未验证）；
- 不提交临时脚本/截图/日志；不提交 `projects/`、`data/`、`.env`；
- 明确说明未触碰 3300/真实数据、未调真实模型。

---

## 10. 实施结果（2026-11-16）

状态：**RMP-1 已完成 + 主会话复核 must-fix（MF1—MF7）已修 + 真实模型 E2E 通过（2026-11-16），已复评**。只做 RMP-1；未做 RMP-2、Change Set 内重规划；未改设计阶段 `DesignModuleRail`、交接包、U7；**未新增数据库表**。

### 改动文件

后端：
- 新增 `backend/src/chat/module-plan-prompt.ts`（首次模块规划 prompt：模板/拆分规则/`MODULE_PLAN_JSON` 协议/只规划不写文档；多轮 refinement）。
- `backend/src/chat/service.ts`：新增 `mode='doc-plan'`（守卫 `initialPlanEligibility`；不满足 409；不写文档/不建模块；SSE 沿用）。
- 新增 `backend/src/requirements/module-plan.ts`（分隔符/容错解析/归一化/校验、首次守卫、apply 单事务：复用默认模块 + 新建其余 + 文档标题 + `app_settings` 计划/原始需求）。
- `backend/src/requirements/modules.ts`：抽取 `createModuleWithEmptyDoc`（`createModule` 共用），`createModuleRow` 支持显式 position；行为不变。
- 新增 `backend/src/requirements/module-generation.ts`（prepare 守卫、逐模块 prompt、DOC_JSON 容错解析、`saveDoc(source='ai')` 应用、顺序生成/失败继续/取消/全局 ID）。
- `backend/src/requirements/routes.ts`：`POST /requirements-modules/plan/apply`、`POST /requirements-modules/generate`（SSE）。
- 测试：新增 `module-plan.test.ts`（8 项）、`module-generation.test.ts`（7 项）；`routes.test.ts`/`module-ui-support.test.ts` 增加 HTTP 守卫（2 项）。

前端：
- 新增 `module-plan-protocol.js` + `.test.mjs`（5 项）、`module-plan-helpers.js` + `.test.mjs`（5 项）。
- 新增 `ModulePlanCard.vue`（编辑/排序/增删/建议 Epics/依赖/覆盖/未分配/warnings/openIssues/应用/保持单模块/已应用/生成进度）、`ModuleGenerationProgress.vue`（状态/重试/取消）。
- `DocChatPanel.vue`（plan 模式/计划卡/历史恢复/apply 前落盘/refinement）、`RequirementsDocView.vue`（资格/应用/生成/重试/取消/刷新推导）、`api.ts`（类型 + apply + 生成 SSE + chat mode）。
- `frontend/package.json` 测试脚本加入两个新测试文件。

文档：`docs/STATUS.md` 新增「RMP-1 完成」段；本 §10；摘要表新增 RMP-1 行。

### 验证

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **244/244**（基线 224 + 20；含 MF1、MF6、MF7） |
| `npm test --prefix frontend` | **138/138**（基线 128 + 10） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |

Playwright（临时 data/projects + 端口 3401，`OPENCODE_AUTO_START=false`，mock 规划/生成 SSE，不调真实模型）：**80/80 断言通过（本轮复验脚本）**，0 console error / 0 pageerror / 0 意外 API≥400 / 0 横向溢出；截图临时目录 `C:\Users\icecream\AppData\Local\Temp\opencode\rmp1-pw\screens`。覆盖：规划提示/`doc-plan` 请求/2 模块建议卡/编辑与增删排序/应用（复用默认 ID、MOD-001·002、编辑标题、两文档 draft v2 ai、大纲 2 根、提示消失）/保持单模块/非法计划不写库/刷新恢复/生成失败→重试/多模块守卫/重复 apply 409/手动编辑后不再规划/生成中取消→重试/单模块失败→retry/刷新后重新生成全部模块（取消与确认）/生成中 Composer 禁用/取消后部分完成显示与全部完成/1440·1280·1024·768 × 浅深。

### 复核 must-fix（2026-11-16，主会话发现，已修并复验）

| # | 问题 | 修复与验证 |
| --- | --- | --- |
| MF1 | “保持单模块”失败后 `reason='retry'` 因无 `modulePlanApplied` → 409 | `prepareModuleGeneration`：`single` 要求未归档模块恰好 1 个（moduleIds 若传必须是它；已拆分 >1 → 409，提示用已应用规划重试）；无 plan 的 `retry` 在 moduleIds 恰好 1 个且匹配唯一未归档模块时按单模块重试（plan=null，source 读 settings/chat），否则维持 409；有 plan 的 retry 不变。后端新增 1 项测试（单模块失败→retry 成功、拆分 single 409、无 plan 多模块 retry 409），Playwright MF1 断言 reason single→retry 且文档 v1→v2 |
| MF2 | 取消/跳过模块无重试入口 | `ModuleGenerationProgress.vue`：error/cancelled/skipped 在生成结束且非只读时均显示「重试」；取消文案“可对未完成模块点‘重试’”；重试沿用 retry（MF1 保证 single 可重试）。Playwright：取消后 2 个重试按钮 → 点击重试成功（1/2 完成、文档 v2） |
| MF3 | 拆分 apply 后刷新丢失生成入口 | `ModulePlanCard` 已应用 + 无运行态 generation + 非 busy 时显示「重新生成全部模块」及说明（刷新后进度不保留、生成新 AI 版本、旧版本保留）；`RequirementsDocView.onRegenerateAll` 二次确认后按 activeModules 调 `runModuleGeneration`（1 个→single，多个→retry），不自动触发。Playwright：刷新后按钮可见；取消确认不请求；确认后 2/2 完成、两模块 v3、旧版本 ≥3 |
| MF4 | 生成中 Composer 可并发对话 | `DocChatPanel` 新 prop `generationRunning`：textarea/发送/next-step 禁用，placeholder/hint “模块生成中，完成后可继续对话”；不影响聊天流式停止按钮；`RequirementsDocView` 传 `Boolean(planState.generation?.running)`。Playwright：生成中 textarea/发送 disabled，取消后 enabled |
| MF5 | 取消后重试一个模块时，其它模块仍 `cancelled`，但头部/底部/卡片误报“已完成/已生成 N 个模块” | `ModuleGenerationProgress` 头部按 running → `cancelled`/`cancelled>0`（`N 个已取消`）→ 失败 → 已完成；底部按 running → 未完成可重试 → 失败 → 已生成。`ModulePlanCard` 有 generation 且 `done<total` 时显示 `已应用 · done/total 模块`（单模块 `已保持单模块 · 未完成`），全部 done 才显示“已生成 N 个模块”。定向 `retry` 成功后不再切换模块，避免建议卡/进度消失。Playwright：取消→重试 1 个后头部“1 个已取消”、底部重试提示、卡片 `1/2`、无“已完成”；再重试第二个后头部已完成、底部/卡片“已生成 2 个模块” |
| MF6 | `POST /plan/apply` 在 `modulePlanSource` 为空时先建/复用模块、写 settings，生成接口才 409，留下半应用状态 | `applyModulePlan` 在事务前计算 source；`source.trim()` 为空 → 409「缺少原始需求记录，无法应用模块拆分；请先发送需求后重试」，不写模块/文档/settings/stage event；显式 `options.source` 空白同样视为空；正常 apply 不变。后端新增 1 项测试（无聊天/空白 source 409 且模块/settings/文档/事件不变；显式 source 正常 2 模块）+ HTTP 路由测试补无 source 409 且仍 1 模块、补聊天后 apply 成功 |
| MF7 | 真实 Node/Express 下生成 SSE 客户端收到 `module-start` 后立即 terminated、无 all-done，生成未执行 | `req.on('close')` 在请求体完成后即触发，误判断开并 abort。改为 `res.on('close')` / `res.removeListener('close')`（与聊天 SSE 同口径；onClose 保留 `res.writableEnded` 早退），不改其它 SSE 路由。新增真实 HTTP 回归测试（stub opencode 生成器）：完整收到 module-start/module-done/all-done + `ok:true`、文档 v2；旧 `req.on` 下该测试失败。真实服务器 E2E 由主会话在保留临时应用上复跑 |

复验结果：后端 **244/244**、前端 **138/138**、`typecheck`/`build`/`check:vue` 通过；Playwright **80/80（本轮复验脚本）**（MF6/MF7 为纯后端，无需重跑 Playwright），0 console/page error、0 意外 API≥400、0 横向溢出；新增截图 `c-regenerate-1024-dark`、`e-generating-composer-1024-light`、`e-partial-cancelled-1024-light`、`e-cancel-retry-complete-1024-light`。

### 偏差（逐条）

1. **生成应用方式**：`applyGeneratedDoc` 将模型 `doc` 按模板标题映射为 sections 更新（结构化 data 取 `sections[].data`），再复用 `saveDoc(source='ai', snapshot)`；未直接把 `doc` 作为 `contentMd` 全文保存——全文保存会以解析标题为准、丢弃漏写的模板章节。协议仍是 `DOC_JSON`，符合“复用 saveDoc”。
2. **生成失败/取消不切换模块**：有失败/取消时保持当前模块，避免建议卡与重试入口因切模块从聊天中消失；全部成功才切到第一个生成模块。
3. **刷新后已应用状态推导**：按“未归档模块 >1 → 已拆分；文档有内容 → 已保持单模块”展示；无法区分“手动编辑过文档但仍保留空计划卡”，此时卡片显示已保持单模块、不再提供 apply（后端 apply 仍 409）。计划卡原始编辑内容不跨刷新保留（只恢复 AI 原始建议）。
4. **规划守卫时机**：`mode='doc-plan'` 在 chat 入口先校验；不满足直接 409。前端 `planEligible` 仅预判，后端为权威。
5. **原始需求来源**：apply 时读取默认模块 chat 的 user 消息并截断 60k；前端 apply/keep-single 前强制落盘聊天，避免防抖导致后端读到空历史；`single` 允许无计划、计划源缺失时回退 chat。
6. **提示语/范围**：设计/开发阶段不提供入口（按边界）；`planOutcome` 兜底逻辑见上；未做规划草稿 `modulePlanDraft` 持久化（消息 metadata 已满足刷新恢复）。

### 未验证 / 已知风险

- 真实模型规划质量与逐模块生成：**已由主会话 E2E 通过（2026-11-16）**：临时 backend/opencode + 当前默认模型；用户样例 → 商品管理/订单管理 + order→product；生成两文档 13/13 节（6/2/10 与 5/2/6）、draft v2、无支付模块、必填缺失 0，8/8 断言；临时应用已删除，临时 backend/opencode 已停止；真实 3300/data/projects 未触碰。详见 `docs/STATUS.md`「主会话真实模型 E2E」。
- 真实 opencode 生成失败/取消的实际 interrupt 行为仍仅以注入生成器单测 + mock SSE 覆盖（E2E 未主动取消真实生成）。
- 生成只按模板标题映射 sections；模型若自造标题会落为自定义章节（不阻塞，必填缺失给 warning）。
- `<768` 移动端沿用既有范围未验证。
- 未触碰 3300、真实 `data/`/`projects/`/`.env`；真实模型仅在临时实例调用。**真实 3300 后端仍是 RMP-1 之前构建，需用户确认后 `stop.cmd` → `start.cmd` 重启才能使用 RMP-1 接口。**
