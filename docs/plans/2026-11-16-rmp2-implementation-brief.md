# RMP-2：随时 AI 重新规划模块（实施交接单）

日期：2026-11-16
用途：新开实施会话执行；主会话评审。**只做 RMP-2；不改 RMP-1 首次规划/生成主链路。**
状态：**已完成并复评（2026-11-16，含真实模型 E2E 通过；§10 已回填）**。
上游：`docs/plans/2026-11-16-requirements-module-planning-design.md`（已定稿 §4.2/§5/§9/§10）、`docs/plans/2026-11-16-rmp1-implementation-brief.md`（已完成并真实 E2E 通过）、`docs/STATUS.md`「RMP-1 完成」。
基线：后端 **244**、前端 **138**；真实库 `apps=0`（用户可能已新建应用，**不得触碰真实 3300/data/projects**）；验证只用临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`/端口；不调真实模型（主会话后续 E2E）。

---

## 1. 目标（RMP-2 验收）

1. 需求阶段（最终“完成需求阶段”之前）随时可点 **「AI 规划模块」**：
   - 读取当前**全部未归档模块**的需求文档/结构化 Epics/Stories/模块说明；
   - 用户可输入调整指令（默认“根据当前全部需求内容重新拆分模块”）；
   - AI 返回新的模块划分建议（保留/改名/重新生成/新建/未匹配归档），预览 diff 后确认；
   - 结构应用后，仅对 `create`/`regenerate` 模块生成完整 PRD；`keep`/`rename` 不动内容；
   - 旧模块未匹配时归档（内容/版本/对话保留，可恢复），不机械搬运章节/Epic。
2. 支持用户样例这类调整：
   - “把订单管理拆成订单管理和售后管理，商品管理不变” → 商品 `keep`、订单 `keep` 或 `regenerate`、售后 `create`；
   - “把商品管理和订单管理合并成交易管理” → 交易管理 `create`，商品/订单未匹配 → `archive`；生成交易管理完整 PRD；
   - “商品明细并入商品管理，不要单独模块” → 商品管理 `keep`/`regenerate`，无明细模块。
3. 已确认模块：预览明确警告；应用需用户显式勾选“允许重新打开已确认模块”；受影响模块退回 draft，应用级需求确认清除，需重新确认。
4. 最终“完成需求阶段”后模块/需求锁定：设计/开发阶段不再提供本入口；走 Change Set（按用户确认口径）。
5. 不新增数据库表；不改设计阶段、交接包、Change Set、U7；RMP-1 首次规划/生成回归不变。

---

## 2. 边界与守卫（必须写死）

- 入口/API 仅当：
  - `app.status === 'requirements'`；
  - **无 active Change Set**；
  - `apps.requirements_confirmed_at` 为空（最终需求确认后锁定）；
  - 至少 1 个未归档模块。
- 设计/开发/完成阶段：入口禁用并提示“先重新编辑需求 / 发起 Change Set”；API 409。
- 变更进行中：入口禁用并提示先完成/取消变更；API 409（RMP-2 不做 Change Set 内重规划）。
- 不修改已归档模块；归档模块不参与规划/生成。
- 模块数量不设硬上限；>8 warning；技术保护 50（超过 400）。
- 不按 CRUD/实体拆模块；标题非空且唯一。
- 旧模块未被新计划匹配 → 归档（不是删除）；最终至少 1 个未归档模块。
- 只允许“重新生成完整 PRD”，不把章节/Epic 从旧模块搬到新模块；旧内容保留在旧模块归档与版本历史。

---

## 3. 复用基线

- RMP-1：`module-plan.ts`（解析/归一化/校验、settings、apply 初始）、`module-generation.ts`（prepare/prompt/DOC_JSON/saveDoc/SSE 事件/重试/取消）、`ModulePlanCard/ModuleGenerationProgress`、`module-plan-protocol/helpers`、`requirements/api.ts`。
- 模块/文档：`createModuleWithEmptyDoc`、`archiveModule/restoreModule`、`reopenRequirementDoc`（confirmed → draft、清 `apps.requirements_confirmed_at`、同模块设计退回 draft）、`updateModule`、`listModules`。
- 计划消息/设置：`app.<id>.modulePlanApplied`、`modulePlanSource`（RMP-1 已用于生成）；RMP-2 扩展 kind/action。
- 现有需求总览/大纲/模块树、主题 token、响应式。

---

## 4. 规划协议（RMP-2 扩展）

仍用 `<<<MODULE_PLAN_JSON>>>`，新增 `kind='replan'` 与动作：

```jsonc
{
  "kind": "replan",
  "instruction": "把订单管理拆成订单管理和售后管理，商品管理不变",
  "modules": [
    {
      "key": "product",
      "title": "商品管理",
      "description": "商品与商品明细维护",
      "scope": ["商品档案", "商品明细", "商品与明细 1:1"],
      "suggestedEpics": [{ "title": "商品档案", "stories": ["..."] }],
      "existingModuleId": "m-001",      // keep/rename/regenerate 必填；create 必须 null
      "action": "keep"                  // keep | rename | regenerate | create
    },
    {
      "key": "order",
      "title": "订单管理",
      "description": "下单与订单查询，不含售后",
      "scope": ["订单创建", "订单查询"],
      "suggestedEpics": [...],
      "existingModuleId": "m-002",
      "action": "regenerate"
    },
    {
      "key": "aftersale",
      "title": "售后管理",
      "description": "售后工单与处理",
      "scope": ["售后申请", "售后处理"],
      "suggestedEpics": [...],
      "existingModuleId": null,
      "action": "create"
    }
  ],
  "dependencies": [{ "from": "order", "to": "product", "description": "订单引用商品" }],
  "coverage": [{ "requirement": "商品 CRUD", "moduleKey": "product" }],
  "unassigned": [{ "requirement": "...", "reason": "..." }],
  "openIssues": ["..."],
  "warnings": ["商品与订单合并后原两个模块将归档"]
}
```

### 4.1 动作语义

| 动作 | existingModuleId | 内容 | 确认状态 | 生成 |
| --- | --- | --- | --- | --- |
| `keep` | 必填 | **不改**标题/说明/范围；可改 position | 保留 | 否 |
| `rename` | 必填 | 可改标题/说明；**范围必须不变** | 受影响：需重开 | 否（仅更新模块/文档标题） |
| `regenerate` | 必填 | 可改标题/说明/范围 | 需重开 | 是（保留 ID/对话/版本历史，生成新 `ai` 版本） |
| `create` | 必须 null | 新模块 | 新 draft | 是（空 v1 → `ai` v2） |

- 旧模块未出现在新计划中 → **归档**（不删除；内容/版本/对话保留）。预览明确列出“将归档”。
- 合并：新模块 `create` 或选一个旧模块 `regenerate`；其它旧模块未匹配 → 归档。
- 拆分：新模块 `create`；原模块可 `keep`（保留一部分）或归档/重新生成。
- `keep`/`rename` 若范围与当前不同 → 校验错误，要求改 `regenerate`（避免“范围变了内容没变”）。
- `keep` 若标题/说明变化 → 自动按 `rename` 处理（后端归一化，不静默丢改动）；`rename` 范围变化仍报错。
- 每个 existingModuleId 只能出现一次；必须属于本应用、未归档。
- 新计划标题唯一；>8 warning；≤50。
- `coverage`/`unassigned`/`warnings` 仅提示，不阻塞 apply；范围变化/确认重开/归档等错误才阻塞。

### 4.2 确认模块重开

- 预览计算 `requiresReopenConfirmed` 与 `confirmedModules`：
  - 受影响：`rename`、`regenerate`、被归档的已确认模块；`keep` 不影响。
  - `create` 不直接影响已确认模块。
- 若存在受影响已确认模块：
  - 前端显示警告 + 必选勾选“允许重新打开已确认模块”；
  - apply body 必须 `reopenConfirmed: true`，否则 409（列出模块 key/title）。
- apply 时对受影响已确认模块调用/复用 `reopenRequirementDoc`（或等价内部事务）：
  - 文档退回 draft、清 `confirmed_at`、清 `apps.requirements_confirmed_at`、同模块已确认设计退回 draft；
  - 应用保持/回到 requirements。
- `keep` 的已确认模块保持 confirmed；`rename` 视为受影响（标题/说明变化），需重开。
- 最终需求确认（`requirements_confirmed_at` 非空 / app 非 requirements）→ 本入口整体 409/禁用，不在这里重开。

---

## 5. 后端实现

### 5.1 聚合当前需求

新增（建议 `backend/src/requirements/module-replan.ts`）：
- `collectReplanSource(appId)`：
  - 遍历全部未归档模块（position 顺序）；
  - 每模块：id/key/title/description/doc status/version + 模板章节正文 + 结构化 scenes/epics/stories（标题/目标/验收/优先级）；
  - 截断：每章节/每模块/总计上限（建议总计 80k，单章节 4k，单模块 16k；超限在 warnings 标记“规划基于截断摘要”）；
  - 返回 `{ text, modules, truncated }`；不写库。
- 生成 prompt `buildModuleReplanPrompt(source, instruction)`：
  - 当前模块列表带 **moduleId/key/title/status/version/scope**，要求 AI 尽量保留未变业务域（keep），只有边界变化才 regenerate/create；
  - 禁止按 CRUD/实体拆；同域实体/明细归一个模块；排除项不生成模块；
  - 明确输出动作/映射/覆盖/依赖/未分配/openIssues/warnings；
  - 输出 `MODULE_PLAN_JSON`，kind=replan；
  - 只规划，不写文档。
- 解析/归一化/校验（可与 RMP-1 共用基础函数，但不得放宽 RMP-1 initial 校验）：
  - 动作/ID/范围规则见 §4；返回 `plan`+`errors`+`warnings`+`requiresReopenConfirmed`+`confirmedModules`+`archiveModules`（旧模块未匹配）。
  - 预览接口不写库；错误可读。

### 5.2 预览 API

`POST /api/apps/:id/requirements-modules/replan/preview`

body：`{ "instruction": "可选的调整指令" }`

- 守卫 §2；不满足 → 普通 HTTP 409/400（不进入模型）。
- 聚合当前需求 → prompt → `opencode.generateText`（需求阶段 req agent/model；独立短会话；客户端断开尽量 abort；使用 `res.on('close')` 口径）。
- 返回：
```jsonc
{
  "plan": { /* kind=replan, modules/actions/deps/... */ },
  "currentModules": [{ "id","moduleKey","title","status","version","scope","confirmed" }],
  "archiveModules": [{ "id","moduleKey","title","status" }],
  "confirmedModules": [{ "id","moduleKey","title" }],
  "requiresReopenConfirmed": true,
  "warnings": [...],
  "sourceTruncated": false
}
```
- 模型失败/JSON 非法 → 可读错误，不写库；前端可重试。
- 不写 settings/模块/文档/版本。

### 5.3 结构应用 API

`POST /api/apps/:id/requirements-modules/replan/apply`

body：`{ "plan": {...}, "reopenConfirmed": false }`

单事务（建议）：
1. 守卫 §2 + 校验 plan（动作/ID/范围/唯一/归档/至少 1 个）；
2. 计算 `archiveIds`（当前 active 中未被 plan 映射的模块）；
3. 若受影响已确认模块且 `reopenConfirmed !== true` → 409（列模块）；
4. **先聚合 source**（旧模块全部需求）并写入 `app.<id>.modulePlanSource`（replan 版本；足够生成新/重生成模块；截断策略同 §5.1）；写 `modulePlanApplied`（kind=replan，planned modules 映射 moduleId/key/action）；
5. 对受影响 confirmed 模块重开（reopen 语义）；
6. 处理 plan modules（按顺序）：
   - `keep`：不更新内容标题/说明/范围（可更新 position）；
   - `rename`：更新模块 title/description/position；更新文档标题 `${appName} · ${title} 需求文档`；不产文档版本；
   - `regenerate`：更新 title/description/position；更新文档标题；确保 draft（已重开）；加入 generation；
   - `create`：`createModuleWithEmptyDoc`（空 v1，position）；加入 generation；
7. 归档未匹配旧模块（**先建新模块再归档**，或内部归档 helper 跳过“至少 1 个”临时校验；最终 active ≥1）；归档保留内容/版本/对话；如已确认受影响，已重开/清应用确认；
8. 记录 `app_stage_events`（如 `module-replan-applied`，含 kept/renamed/regenerated/created/archived/reopened 数量）；
9. 返回：
```jsonc
{
  "modules": [{ "id","moduleKey","title","position" }],
  "kept": [...], "renamed": [...], "regenerated": [...],
  "created": [...], "archived": [...], "reopened": [...],
  "generation": [{ "moduleId","title" }]
}
```
- **不生成文档**；生成由前端接着调用 RMP-1 生成接口。
- 不删除历史版本/bundle；应用保持 requirements；应用级需求确认清除（如有）。
- 如果 `generation` 为空（全 keep/rename/archive），apply 直接完成。

### 5.4 生成扩展

- `ModuleGenerationReason` 增加 `'replan'`：
  - `prepareModuleGeneration`：replan 必须有 `modulePlanApplied` + `modulePlanSource`；`moduleIds` 必须非空且全部属于 plan、未归档、可写；
  - 生成 prompt 复用 RMP-1 `buildModuleGeneratePrompt`（source=aggregate、plan=新计划）；只写指定模块；新模块/重生成模块生成后 draft、`ai` 版本；不确认；
  - `retry` 继续可用（失败模块重试）；
  - 不生成 keep/rename 模块。
- source 截断：aggregate 可达 60k；generation prompt 现有 30k 截断需评估提升到 60k（replan 时），并在 warnings 提示；不影响 RMP-1 初始 source。
- 事件/进度/取消复用 RMP-1 SSE；真实 Express 用 `res.on('close')`（MF7 已修，不要回退）。

---

## 6. 前端实现

### 6.1 入口

- 在需求文档头部操作区（`需求总览` 附近）增加 **「AI 规划模块」** 按钮（仅 requirements 且最终未确认、无 active Change Set 显示/可用）。
- 设计/开发/完成阶段、active Change Set、最终确认：隐藏或禁用 + tooltip/提示路径（Change Set / 重新编辑需求）。
- 不放在模块聊天里；不自动触发；点击打开 `ModuleReplanDialog`。
- 窄屏（≤1024/768）按钮随头部换行；不横向溢出。

### 6.2 弹窗 `ModuleReplanDialog.vue`

两步：

**Step 1：生成建议**
- 当前模块概览（key/title/状态/版本/确认/scope）；
- 指令 textarea（默认“根据当前全部需求内容重新拆分模块”）；
- `生成建议` → `replan/preview`（loading/可取消；失败可重试）；
- 展示 `sourceTruncated`/warnings。

**Step 2：预览/调整/应用**
- 建议模块列表（可编辑 title/description/scope、上移下移、增删）：
  - 映射 select：现有未归档模块（每个最多映射一次）或“新建”；
  - 动作 select：keep/rename/regenerate/create（由映射推导并可按规则限制）；
  - `keep`/`rename` 若用户改了 scope → 提示/禁用，必须选择 regenerate；
  - `rename` 只允许标题/说明变化；
  - 建议 Epics 折叠；依赖/覆盖/未分配/warnings/openIssues；
- “将归档”列表：当前模块未被映射/未保留；点“保留”可映射到某个建议模块；显示确认状态；
- 已确认模块警告 + 必选勾选“允许重新打开已确认模块”（`requiresReopenConfirmed` 时）；
- 校验错误展示（非空/唯一/映射重复/范围变化/新增模块标题冲突）；
- 按钮：`应用调整`（可同时生成）、`返回修改`、`取消`（不写库）。
- 应用后：
  - 调 `replan/apply`（带 `reopenConfirmed`）；
  - 刷新 modules/bundle，选中第一个 keep/kept 或 generation 模块；
  - 若 `generation` 非空 → 调 `/requirements-modules/generate`（reason=`replan`），在弹窗内复用 `ModuleGenerationProgress` 显示进度/重试/取消；
  - 全部完成 → 刷新文档/大纲/bundle，提示“已保留 X、改名 Y、重新生成 Z、新建 N、归档 M”；关闭/可继续查看；
  - 失败/取消保留模块结构；重试失败模块；若关闭后丢失运行态，用户可再次打开规划（RMP-2 不做全局恢复入口，交接单记录）。
- 关闭弹窗不写库（除已应用/生成）。
- 样式 token/深浅色/响应式；弹窗内部滚动；0 横向溢出。

### 6.3 前端文件

新增：
- `frontend/src/requirements/ModuleReplanDialog.vue`
- `frontend/src/requirements/module-replan-protocol.js` + `.test.mjs`（解析/归一化/校验/动作规则/diff/映射）
- 如需 `module-replan-helpers.js` + `.test.mjs`（映射唯一性/archive 计算/范围变化判定/摘要）

修改：
- `frontend/src/requirements/RequirementsDocView.vue`（入口/状态/apply/generate/刷新/门禁）
- `frontend/src/requirements/api.ts`（preview/apply 类型与请求；generate reason `replan`）
- 复用 `ModuleGenerationProgress.vue`；不改 RMP-1 `ModulePlanCard` 首启流程（除非共享纯逻辑）。
- `DocChatPanel` 不需要改（RMP-2 不走模块聊天）。

---

## 7. 测试计划

### 7.1 命令

```powershell
npm run build --prefix backend
npm test --prefix backend        # 基线 244 + 新增；临时 RG_DATA_DIR/RG_PROJECTS_DIR
npm test --prefix frontend       # 基线 138 + 新增
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm run check:vue --prefix frontend
```

### 7.2 后端单测（不调真实模型）

- 聚合 source：模块顺序/章节/结构化/截断/warnings；不写库。
- replan prompt：含全部模块 ID/标题/状态/scope/Epics、指令、动作规则、分隔符、只规划。
- 解析/校验：动作/ID/range/keep→rename 归一化/范围变化错误/重复映射/标题唯一/>8 warning/50 上限/未匹配 archive。
- apply：
  - keep 不改文档/不改确认；rename 改标题/文档标题/不产版本；regenerate 保持 ID/对话/版本、reopen、generation；create 空 v1 + generation；未匹配 archive；position；active ≥1；
  - confirmed 模块：无 reopenConfirmed 409；有则退回 draft、清应用确认、同模块设计退回 draft；keep 的确认保留；
  - app status/active Change Set/final confirmed 守卫；
  - settings `modulePlanApplied/Source`（kind replan/映射/action）、source 截断；
  - apply 不生成文档；generation 列表只含 create/regenerate；事务回滚（如重复 ID/归档失败）。
- 生成 replan：prepare 需要 plan+source+moduleIds；只生成指定模块；keep/rename 不生成；生成后 draft/ai；retry 可用；不改 RMP-1 行为。
- HTTP：preview 不写库/守卫；apply 409/200；generate replan 守卫；真实 HTTP SSE（res close）回归。

### 7.3 前端纯逻辑

- replan 协议解析/归一化/动作规则；
- 映射唯一性、archive 计算、范围变化判定、keep→rename、confirmed 标记；
- 计划编辑/排序/增删/转 API；摘要/进度复用。

### 7.4 Playwright（临时数据/端口、mock 规划/生成，不调真实模型）

- 入口：requirements 可见；设计/开发/final/active change set 隐藏/禁用提示；
- 打开弹窗：当前模块概览/指令/生成建议 loading/失败重试；
- 预览 diff：keep/rename/regenerate/create、archive 列表、coverage/unassigned/warnings/openIssues；
- 编辑/映射：改 title/scope、增删/排序、重复映射/范围变化校验；
- confirmed：警告 + 未勾选不能 apply（或 409 提示）+ 勾选后 apply/reopen；
- apply：keep 文档/版本/确认不变；rename 文档标题变、版本不变；regenerate/new 生成进度、draft/ai；archive 大纲已归档、内容仍可查看/恢复；
- 全 keep/rename 无生成直接完成；
- 生成失败/重试/取消；关闭弹窗不写库；
- 1440/1280/1024/768、浅/深色；0 console/page/API 错误、0 横向溢出；截图临时目录。

### 7.5 真实模型 E2E（主会话后续）

- 临时应用（先用 RMP-1 生成 2 模块，或 seed 2 模块文档），调用 replan：
  - 场景 A：“把订单管理拆成订单管理和售后管理，商品管理保持不变” → 商品 keep/订单 keep 或 regenerate/售后 create；生成售后；旧内容保留。
  - 场景 B：“把商品管理和订单管理合并成交易管理” → 交易管理 create，商品/订单 archive；生成交易管理完整 PRD；旧模块归档可恢复。
- 记录规划质量/耗时/生成结果；跑完删除临时应用；不触碰用户真实应用。

---

## 8. 验收标准

- 需求阶段可随时打开“AI 规划模块”，基于当前全部需求给出可编辑 diff；
- keep/rename 保留原 ID/文档/版本/对话/确认（rename 确认按 §4.2 重开）；regenerate/create 生成完整 PRD；未匹配旧模块归档保留；
- 合并/拆分样例可完成；不出现按 CRUD/实体拆模块；无支付/排除项模块；
- confirmed 模块警告/重开/清应用确认正确；final/设计/开发/active Change Set 门禁正确；
- 无新表；RMP-1 首启流程/生成回归不变；
- 后端/前端/typecheck/build/check:vue/Playwright 通过；真实模型 E2E（主会话）通过。

---

## 9. 交付物

- 代码 + 测试；更新 `docs/STATUS.md` 新增「RMP-2 完成」段；
- 回填本交接单 **§10 实施结果**（改动/测试数/Playwright/偏差/未验证）；
- 不提交临时脚本/截图/日志；不提交 `projects/`、`data/`、`.env`；
- 明确说明未触碰真实 3300/真实数据、未调真实模型。

---

## 10. 实施结果（2026-11-16）

状态：**RMP-2 已完成并复评（2026-11-16，含主会话真实模型 E2E 通过）**。只做 RMP-2；未做 Change Set 内重规划、未做章节/Epic 搬运、未新增数据库表；未改 RMP-1 首次 `doc-plan`/plan apply/生成主链路（仅扩展 kind 读取与 `reason='replan'` 分支）；未启停/修改真实 3300；未读写真实 `data/`/`projects/`/`.env`；真实模型仅在临时实例调用（临时应用已删除）。

### 改动文件

后端：
- 新增 `backend/src/requirements/module-replan.ts`：`collectReplanSource`（只读聚合 + 截断）、`buildModuleReplanPrompt`、`normalizeReplanPlan`（keep→rename 归一化）、`validateModuleReplan`、`splitModuleReplanOutput`、`replanEligibility`、`previewModuleReplan`、`applyModuleReplan`（单事务 keep/rename/regenerate/create/archive/reopen + settings + 事件）。
- `backend/src/requirements/module-plan.ts`：`ModulePlan.kind` 支持 `replan`（+ `instruction?`）；`readAppliedModulePlan` 读取存储 kind；initial 校验/apply 不变。
- `backend/src/requirements/module-generation.ts`：`reason='replan'`（plan+source+moduleIds，只生成 create/regenerate；replan 后 initial 409；retry 限 create/regenerate；source 上限 60k；prompt 标题按 kind）。
- `backend/src/requirements/doc.ts`：`updateRequirementDocTitle`（不产版本）。
- `backend/src/requirements/routes.ts`：`POST /requirements-modules/replan/preview`（JSON/只读/`res.on('close')` abort）与 `/replan/apply`。
- 测试：新增 `module-replan.test.ts`（11 项）；`module-ui-support.test.ts` 新增 1 项 RMP-2 HTTP（preview 只读/守卫/apply/generate replan 真实 HTTP SSE）；`package.json` test 列表加入新文件。

前端：
- 新增 `ModuleReplanDialog.vue`、`module-replan-protocol.js` + `.test.mjs`（4 项）、`module-replan-helpers.js` + `.test.mjs`（6 项）。
- `api.ts`：`ModuleReplan*` 类型、preview/apply、`ModuleGenerationReason` 增加 `replan`、request 支持 signal。
- `RequirementsDocView.vue`：入口/门禁/弹窗接线/apply 后刷新/生成结束刷新与提示/`replanBusy` 禁用 Composer。
- `frontend/package.json` test 列表加入两个新测试文件。

文档：`docs/STATUS.md` 新增「RMP-2 完成」+ 摘要表行；本 §10。

### 验证（实际数字）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **256/256**（基线 244 + 12） |
| `npm test --prefix frontend` | **148/148**（基线 138 + 10） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | OK |

Playwright（临时 backend/data/projects + 端口 3417，`OPENCODE_AUTO_START=false`，真实后端 API + **mock 模型**，不调真实模型）：**133/133 断言通过**（含复核 must-fix MF-RMP2-1—4），0 console/page error（仅 1 次预期规划 502 资源错误被过滤）、0 意外 API≥400、0 横向溢出。覆盖：
- 入口：requirements 可用；design/development/active Change Set 禁用 + 路径提示；首次规划未完成（空默认模块/首启建议卡 pending）禁用；
- 预览：默认指令、split diff（keep/regenerate/create）、增删行、无归档；
- apply：keep 内容/版本/标题不变；regenerate 文档标题更新/版本+1/ai 内容；create v2；settings kind=replan；大纲 3 根；
- confirmed：警告 + 未勾选禁用 + 勾选后 rename 重开（draft、版本不变）/keep 保持 confirmed；
- merge：归档 2 旧模块、“保留”恢复行、apply 后 1 活跃/2 归档/内容保留、归档只读、可恢复；
- 校验：范围变化/空标题/映射缺失错误且不写库；关闭弹窗不写库/不触发生成；服务端 preview `errors[]` 展示且编辑后可应用；
- 生成：失败→重试 2/2；取消剩余→重试部分（不误报全部生成）→全部重试完成；
- 旧 RMP-1 建议卡：replan 后隐藏“重新生成全部模块”，initial 仍显示；API `planKind` 一致；
- 规划失败 502 → 重试成功；浅/深 × 1440/1280/1024/768 截图 + 无横向溢出。
截图临时目录：`C:\Users\icecream\AppData\Local\Temp\rmp2-pw-1794820456290\screens`（未提交）。

RMP-1 回归：后端 `module-plan.test.ts`、`module-generation.test.ts`、`module-ui-support.test.ts`（plan apply + 真实 HTTP generate）与前端 RMP-1 protocol/helpers 全部在 256/148 内通过；RMP-1 初始链路行为不变。

### 偏差（逐条）

1. **范围变化基线**：仅当 `modulePlanApplied` 中该模块有 scope 时比较 keep/rename 范围；手工模块/无规划时 scope 未知不阻塞（空 scope 也视为未指定），避免误报；已在 STATUS 记录。
2. **preview 语义错误返回 200 + `errors[]`**（便于前端继续编辑）；仅模型失败/JSON 不可解析返回 502（相对交接单 §5.2 的响应是超集，向后兼容）。
3. **空需求 fail-closed**：apply 且存在 create/regenerate 时，若当前全部需求内容为空 → 409，不写半应用状态（与 RMP-1 MF6 同口径）；纯 keep/rename/归档允许。
4. **不做刷新恢复运行态**：生成中刷新/关闭后结构已应用，用户可再次打开“AI 规划模块”重新预览；本批不做全局恢复入口。
5. **replan 后 retry 范围**：只允许 create/regenerate（keep/rename 不生成）；RMP-1 “重新生成全部模块”逻辑不变（仅 kind=initial 出现）。

### 未验证 / 已知风险

- **真实模型 E2E 已通过（2026-11-16，主会话）**：临时 backend/opencode；RMP-1 seed 商品/订单 v2 → 重规划 商品 keep / 订单 regenerate / 售后 create；应用后订单 v3（13/13、6 Story）、售后首次解析失败→重试 v2（13/13、7 Story）、商品 v2 不变；planKind=replan、3 模块、应用保持 requirements；7/7 断言；临时应用已删除、临时服务已停止；真实 3300/data/projects 未触碰。详见 `docs/STATUS.md`「RMP-2…真实模型 E2E」。
- 真实模型波动：AI 可能把 scope 微调误标 `rename`（预览 errors 拦截，用户可改 regenerate/恢复 scope）；生成偶发不可解析 DOC_JSON（重试成功）。UI 路径已验证。
- `<768` 移动端未验证（沿用既有范围）；真实模型“合并/归档”场景由单测 + Playwright mock 覆盖，未跑真实 merge E2E。
- Change Set 内重规划明确不在本批；设计/开发阶段入口只提示路径。
- 真实 3300 / 真实 `data/`、`projects/`、`.env` 未触碰；真实模型仅在临时实例调用。
- **注意**：真实 3300 后端进程仍是 RMP-2 之前的构建（本轮未启停）；`frontend/dist` 已更新。需用户确认后 `stop.cmd` → `start.cmd` 重启后端，才能使用 `/requirements-modules/replan/*` 接口。

### 主会话复核 must-fix（2026-11-16，已修并复验）

| # | 问题 | 修复 |
| --- | --- | --- |
| MF-RMP2-1 | RMP-1 旧建议卡“重新生成全部模块”在 replan 后仍显示，点击 retry 会因 keep/rename 被 400 | 后端 `GET /requirements-modules` 返回只读 `planKind`（initial/replan/null）；前端 `RequirementModuleList`/`RequirementsDocView.appliedPlanKind`/`DocChatPanel.plan-kind`/`ModulePlanCard.planKind` 透传；`canRegenerate` 仅 `planKind !== 'replan'` |
| MF-RMP2-2 | 首次模块规划未完成时可打开“AI 规划模块” | `replanAvailable` 增加 `!planEligible` + `status !== applying` + `!generation.running`；`replanHint` 增加“先完成首次模块拆分/生成”“模块生成中…”提示 |
| MF-RMP2-3 | 取消后仅重试部分模块时结果页误报“已生成 N 个” | 结果页用 `generationSummary`：`finished && done===total && failed===0 && cancelled===0 && !globalError && !state.cancelled` 才显示“已生成 N 个（草稿）”；否则“部分模块未完成…” |
| MF-RMP2-4 | preview 服务端 `errors[]` 未展示 | 弹窗新增“服务端校验提示（可继续编辑）”，每条前缀“服务端：”；不进入客户端 errors、不阻塞编辑后的 apply（客户端校验 + 后端 400 兜底） |
| 文案 | 设计/开发阶段优先 Change Set；busy 不限生成 | `replanHint`/`replanEligibility` 设计阶段改为“需求变更请发起‘需求+设计’变更（或先重新编辑需求回到需求阶段）”、开发/完成“请发起‘需求+设计’变更”；`beforeClose` busy 改为“正在处理或生成，请先取消或等待完成” |

复核验证：后端 **256/256**、前端 **148/148**、typecheck/build/check:vue 通过；Playwright **133/133 断言**（新增 MF-RMP2-1 7 项、MF-RMP2-2 2 项、MF-RMP2-3 净增 4 项、MF-RMP2-4 9 项；原 111 项全回归），0 console/page error、0 意外 API≥400、0 横向溢出。
