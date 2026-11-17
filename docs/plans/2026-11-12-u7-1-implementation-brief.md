# U7-1 后端：分阶段开发实施交接单

日期：2026-11-12
用途：**新开实施会话**使用；主会话负责设计/评审。
状态：**已实施并评审（2026-11-12）**，实施结果见 §8。
上游：`docs/plans/2026-11-12-u7-phased-development-design.md`（方案定稿）、`docs/plans/2026-11-09-stage-ux-and-dev-session-design.md` §4.3.3。
范围：**只做 U7-1 后端**——阶段表/会话标签、`manifest.phases`、按需生成、start/complete/skip/reopen、phase brief、模型摘要 + fallback、API/测试/冒烟。**不做 U7-2 前端**；不改需求/设计/交接包版本/Change Set 语义。

---

## 1. 已确认决策

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | 生成时机 | 按需：U6 large 后开发页按钮调用 `phases/generate`；普通交接包不建阶段。 |
| 2 | 完成/会话 | 阶段完成不归档当前会话；开始下一阶段时才归档 active。 |
| 3 | 上一阶段摘要 | 阶段完成时模型生成 5—10 行；失败/超时 fallback 最后 assistant 文本；状态仍完成。 |
| 4 | 会话列表 | 保持按变更单分组；会话项加阶段字段（U7-2 展示）。 |
| 5 | 门禁 | 无 Git/证据/测试/阶段门禁；不自动完成应用。 |
| 6 | 会话 | 同一时间仍只有一个 active。 |

---

## 2. 数据与 manifest

### 2.1 阶段草案 key

`backend/src/handoff/design-scale.ts`：

- `DesignHandoffPhaseDraft` 增加 `key: string`：
  - base → `base`
  - Epic → `epic:${epic.id}`
  - 其他页面 → `other`
  - 无 Epic 页面集分组 → `pageSets:${first.code}`（或 `pageSets:1`）
  - 全量实现 → `all`
- `derivePhases` 填充 key；U6 `04-PLAN` 渲染不变（key 不写文档）。

### 2.2 `manifest.phases`

- `backend/src/handoff/design-render.ts` 的 `renderManifest(bundle, files, scale, phases)` 在 `scale.suggested` 时增加：
  ```json
  "phases": [
    { "key": "base", "kind": "base", "title": "...", "goal": "...",
      "storyIds": [], "pageSetCodes": [], "pageCodes": [], "note": "..." }
  ]
  ```
- `RenderedHandoff` 增加 `phases`；`renderHandoff` 已有 `phases`，传给 manifest；preview/generate 的 manifest 均含（preview 不写盘）。
- 旧交接包无 `phases` → U7 `phases/generate` 返回 409，引导重新生成交接包。
- 不改变 `04-PLAN`/README 文案；`phaseCount` 保留。

### 2.3 表/列

`backend/src/db.ts` 新增：

```sql
CREATE TABLE IF NOT EXISTS app_dev_phases (
  id              TEXT PRIMARY KEY,
  app_id          TEXT NOT NULL,
  change_set_id   TEXT,
  handoff_version INTEGER NOT NULL,
  phase_key       TEXT NOT NULL,
  title           TEXT NOT NULL,
  goal            TEXT,
  scope_json      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'not_started',
  summary         TEXT,
  summary_source  TEXT,
  started_at      TEXT,
  completed_at    TEXT,
  ord             INTEGER NOT NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE(app_id, handoff_version, phase_key)
);
CREATE INDEX IF NOT EXISTS idx_dev_phases_app ON app_dev_phases(app_id, handoff_version, ord);
```

- `ensureColumn('app_sessions','dev_phase_id','TEXT')`。
- ID 用 `randomUUID()`（全局唯一）。
- 删除应用清理 `app_dev_phases`；`app_sessions` 随现有逻辑清理。
- 不建真实外键；服务层校验归属。

---

## 3. 后端 API / service

建议新增 `backend/src/dev/phases.ts`（或 service 内分节）：

- `GET /api/apps/:id/development/phases?handoffVersion=`
  - 默认最新 handoff；返回 phase 列表 + 当前/最新会话摘要 + `handoffVersion/changeSet/canGenerate`。
  - `canGenerate`：最新 handoff `manifest.scale.suggested && manifest.phases.length` 且尚未生成。
- `POST /api/apps/:id/development/phases/generate`
  - `assertDevReady`（development/completed）+ 最新 handoff；
  - 从最新 handoff manifest 读 `scale.suggested` + `phases`；缺失 409；
  - 已有当前 handoff 阶段 → 幂等返回；
  - 事务插入（not_started，ord 按数组顺序，scope_json 存 kind/storyIds/pageSetCodes/pageCodes/note）；
  - 返回 `{ phases, handoffVersion, changeSet }`。
- `POST /api/apps/:id/development/phases/:phaseId/start`
  - 阶段属于本 app；绑定当前 handoff（历史版本阶段只读，MVP 可拒绝 409）；
  - 有会话：
    - active → 返回当前 DevState + phase；
    - archived → 复用 I-10 activate（interrupt 当前 active、归档、激活目标）；阶段 in_progress；
  - 无会话：
    - best-effort interrupt/归档当前 active；
    - 创建 build 会话；`app_sessions.dev_phase_id`、handoff/change set 同当前；标题 `<应用名> 开发 · 阶段 N <title>`；
    - `defaultPrompt = buildPhasePrompt(phase, previousSummary)`；阶段 in_progress/started_at；
    - 返回 DevState + phase；**不自动发送**。
- `POST .../:phaseId/complete`
  - 阶段 completed/completed_at；**不归档会话**；
  - 若会话有 assistant 消息：best-effort 模型摘要（§4）；失败 fallback；返回 `{ phase, warnings }`；
  - 无会话/无 assistant：summary=''、summary_source='none'，不调模型。
- `POST .../:phaseId/skip`：skipped；不摘要。
- `POST .../:phaseId/reopen`：in_progress；清 completed_at；保留 summary（再次完成覆盖）。
- 以上不改 `apps.status`/`/complete`/Change Set/交接包。
- `POST /development/prompt`：若 active 会话阶段为 completed/skipped，自动置 in_progress（并记录事件/响应 warning）。
- `GET /development`：`session.phase`（id/key/title/order/status）+ 可选 `phases` 摘要。
- `GET /development/sessions`：返回 `phaseId/phaseKey/phaseTitle/phaseOrder/phaseStatus`。
- `DELETE /api/apps/:id`：清 `app_dev_phases`（db/routes 清理链）。

---

## 4. 模型摘要与 phase brief

### 4.1 摘要

- 触发：complete 且阶段有会话 + 至少一条 assistant 消息。
- 输入：阶段 title/goal/scope + 会话最后一条 assistant 文本（截断 4000 字符）；不塞完整长会话。
- 调用：`opencode.generateText({ directory, agent: <design|req>, model: resolveChatModel(appId,'development',dir), prompt, timeoutMs: 60000 })`。**摘要必须使用无工具/只读 agent（优先 `design`，其次 `req`），不得使用 `build`**（build 有工具权限，可能读写文件）；模型返回、prompt 输入、fallback、warnings 全部经 `scrubText` 脱敏。生产实现见 `backend/src/dev/phases.ts#defaultPhaseSummarizer` / `pickSummaryAgent`。
- Prompt：要求 5—10 行中文摘要（已实现/关键文件/未完成或风险/下一阶段注意），只输出摘要。
- 失败/超时：fallback 最后 assistant 文本（截断 800 字），`summary_source='fallback'`；阶段仍 completed；返回 warnings。
- 无会话/无 assistant：`summary_source='none'`，不调模型。
- 写 `summary`/`summary_source`；下一阶段 brief 读上一 ord 阶段的 summary。
- 测试需可注入摘要生成器（stub）或 mock `generateText`，避免真实模型。

### 4.2 Phase brief

```
你现在在阶段 N/M：<title>。
目标：<goal>
范围：Story ...；页面集 ...；页面 ...
交接包：docs/handoff/00-README.md、04-PLAN.md（阶段章节）、相关 03-PAGES/02-DATA-MODEL。
要求：只做本阶段范围；不要扩展/重写其它阶段；完成后总结已实现/未完成/关键文件/下一阶段注意。
上一阶段摘要：
<summary 或 “无上一阶段摘要”>
```

- 不注入批次/证据/Git/测试门禁。
- 开始阶段创建会话后作为 defaultPrompt 返回；用户在 Composer 编辑后发送。

---

## 5. 测试与验证

新增 `backend/src/dev/phases.test.ts`（或 service 内）：

1. 生成：manifest.phases → 阶段行；幂等；非 large/无 phases 409；ord/key/scope 正确。
2. start：无会话新建（归档旧 active、tag、handoff/CS、brief、in_progress）；已有 active 返回；已归档 activate；跨应用 404；历史 handoff 409。
3. complete/skip/reopen：状态、completed_at、不归档；完成后 prompt 自动 in_progress。
4. 摘要：mock/stub 成功（summary_source=model）；失败 fallback 最后 assistant（fallback）；无会话 none；不阻塞完成。
5. phase brief：上一阶段 summary/无摘要；范围/路径。
6. session list/state phase 字段；旧会话 null。
7. 删除应用清理 phases。
8. 回归：`npm run build --prefix backend`、`npm test --prefix backend`（136 基线）、全部现有冒烟。

新增 `backend/scripts/dev-phases-smoke.ts` + `smoke:dev-phases`：

- 临时 SQLite/projects + 真实 opencode 2.2.5（不调模型）；
- doc 应用 → large 交接包（可用现有 smoke 方式构造 10 Story/12 页面/PNG）→ `phases/generate` → start phase1（会话 tag/brief）→ start phase2（phase1 归档、phase2 active）→ phase1 列表只读/恢复 → complete/skip/reopen → session list phase 字段 → 删除清理。
- 摘要路径在 smoke 中用无 assistant/无会话或 stub 覆盖，不调用真实模型。

前端本批不改；仍跑 `npm test --prefix frontend` / `typecheck` / `build` / `check:vue` 回归。

---

## 6. 不做 / 边界

- 不做 U7-2 前端（阶段条/弹窗/chip 由下一批）。
- 不自动生成阶段（按需按钮）。
- 不自动发送首条提示；不自动归档完成阶段；不自动完成应用。
- 不做阶段门禁、Git/证据/测试门禁、批次。
- 不改需求/设计/交接包版本/Change Set/`05-CHANGES`；不改 AI 页面集。
- 不迁移旧阶段/旧会话；旧交接包重新生成才有 `manifest.phases`。
- 不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交。

---

## 7. 文档与回传

实施完成后：

- 更新本交接单 §8（改动/命令/偏差/未验证）。
- 更新 `docs/STATUS.md`：U7-1 完成 + 摘要表 + 总状态/测试数；U7-2 待实施。
- 更新 `docs/plans/2026-11-12-u7-phased-development-design.md` 状态（U7-1 已实施）。
- 更新 `docs/plans/2026-11-09-stage-ux-and-dev-session-design.md` §4.3.3 状态。
- 更新 `AGENTS.md`、`docs/plans/2026-11-11-main-review-handoff.md` 下一步。
- 回传主会话：改动文件、命令/结果、未验证、偏差、需决策。

---

## 8. 实施结果（2026-11-12，实施会话；待评审）

### 8.1 结论

U7-1 后端按本交接单完成：`manifest.phases`（稳定 key）+ 按需生成阶段 + start/complete/skip/reopen + phase brief + 模型摘要（只读 design/req agent，可注入，失败 fallback，全链路脱敏）+ 会话/状态/列表 phase 字段 + 删除清理；`smoke:dev-phases`（真实 opencode 2.2.5，不调模型）通过。未做 U7-2 前端；未改需求/设计/交接包版本/Change Set/`05-CHANGES`/AI 页面集。

### 8.2 改动文件

- `backend/src/db.ts`：新表 `app_dev_phases` + `idx_dev_phases_app`；`ensureColumn('app_sessions','dev_phase_id','TEXT')` + `idx_app_sessions_phase`。
- `backend/src/handoff/design-scale.ts`：`DesignHandoffPhaseDraft.key`（`base` / `epic:<EPIC-ID>` / `other` / `pageSets:<PS-CODE>` / `all`）；`derivePhases` 填充。
- `backend/src/handoff/design-render.ts`：`renderManifest(bundle, files, scale?, phases?)`，`scale.suggested` 时写 `phases`（key/kind/title/goal/storyIds/pageSetCodes/pageCodes/note）；`04-PLAN`/README 文案不变。
- `backend/src/handoff/design-service.ts`：`RenderedHandoff.phases`；manifest 传入 phases；新增 `designHandoffManifest(appId, version?)`（只读元数据 + manifest，不读文件）。
- `backend/src/dev/phases.ts`（新）：阶段类型/scope、`parseManifestPhases`、`getDevPhases`、`generateDevPhases`、`startDevPhase`、`completeDevPhase`（可注入 `summarize`）、`skipDevPhase`、`reopenDevPhase`、`reopenPhaseForPrompt`、`buildPhasePrompt`、`lastAssistantText`、`deleteDevPhaseData` 等。
- `backend/src/dev/service.ts`：导出 `appOrThrow`/`assertDevReady`；`DevSessionInfo.phase`；`DevSessionListItem` phase 字段；`DevStateResponse.phases`；`createDevSession` 支持 `devPhaseId/title/defaultPrompt`；`promptDevSession` 自动重开阶段并返回 warning。
- `backend/src/dev/routes.ts`：`GET /phases`、`POST /phases/generate`、`POST /phases/:phaseId/start|complete|skip|reopen`。
- `backend/src/apps/routes.ts`：删除应用事务调用 `deleteDevPhaseData`。
- `backend/src/dev/phases.test.ts`（新，9 项）；`backend/src/handoff/design-scale.test.ts`（key 断言）；`backend/src/handoff/design-handoff.test.ts`（大交接包 `manifest.phases`、normal 无 phases）。
- `backend/scripts/dev-phases-smoke.ts`（新）；`backend/package.json`（`test` 列表 + `smoke:dev-phases`）。
- 文档：`docs/STATUS.md`、`docs/plans/2026-11-12-u7-phased-development-design.md`、`docs/plans/2026-11-09-stage-ux-and-dev-session-design.md`、`AGENTS.md`、`docs/plans/2026-11-11-main-review-handoff.md`、本交接单。

### 8.3 命令 / 结果

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **145/145**（基线 136 + 新增 9） |
| `npm run smoke:dev-phases --prefix backend` | 通过（真实 opencode 2.2.5，不调模型） |
| `npm run smoke:requirements --prefix backend` | 通过 |
| `npm run smoke:design --prefix backend` | 通过 |
| `npm run smoke:design-handoff --prefix backend` | 通过 |
| `npm run smoke:change-set --prefix backend` | 通过 |
| `npm run smoke:handoff-input --prefix backend` | 通过 |
| `npm run smoke:dev-sessions --prefix backend` | 通过（回归：会话列表 phase 字段） |
| `npm run smoke:dev-health --prefix backend` | 通过（回归：开发状态 phases 字段） |
| `npm test --prefix frontend` | 69/69（本批未改前端） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |

### 8.4 与交接单的偏差

1. `start` 允许从 `skipped` 重新开始（置 `in_progress`）；交接单未明确，选择与“重新打开”一致的宽松语义。
2. 历史交接包阶段 `start/complete/skip/reopen` 统一 409（只读）；交接单只要求 start 拒绝，统一后避免历史阶段被改状态。
3. `complete` 对已 `completed` 阶段幂等返回（不重复调模型、不覆盖 summary）；交接单未明确重复完成。
4. 仅这些偏差；未改接口主路径、表结构字段、阶段 brief/摘要文案口径。

### 8.5 未验证 / 需关注

- **阶段摘要真实模型调用未执行**：冒烟按交接单用注入 stub / 无 assistant 路径覆盖，避免额外成本；真实模型摘要质量与 60s 超时下 fallback 的实际效果待 U7-3 或真实使用验证。
- `manifest.phases` 仅在新生成交接包中出现；真实 DB `apps=0`，未做旧交接包迁移（按设计重新生成即可）。
- U7-2 前端（按钮/阶段条/弹窗/chip/Playwright）未实施。
- 阶段数量较多时 `GET /development` 的 `phases` 摘要查询未做性能测量（当前按最新 handoff 版本一次查询，量级很小）。
- 未读取/打印/提交真实凭据；未触碰真实 `data/`、`projects/`、`.env`。

### 8.6 需决策

1. 阶段 `start` 从 `skipped` 是否应保持可重新开始？（当前允许；若要求“跳过即结束”，改为 409。）
2. 历史交接包阶段的只读策略是否按当前“start/complete/skip/reopen 全部 409”收口？
3. 完成阶段摘要是否需要在 U7-2 加“生成中/失败可重试”入口（当前失败只回退，无重试 API）。

### 8.7 主会话复核 must-fix（2026-11-12，已修复）

**问题**：阶段摘要直接使用 `opencode.messages` 的最后 assistant 文本（prompt / fallback / `phase.summary` / API / 下一阶段 brief），未脱敏；默认摘要器用 `build`（有工具权限），超出“只生成摘要”。

**修复**：

- `completeDevPhase` 读取消息前 `registerAppSecrets(appId, appDirOf(appId))`；最后 assistant 文本、摘要 prompt、模型返回摘要、fallback、warnings 全部经 `dev/timeline.ts#scrubText`（含 `redact` 注册密钥 + `password=` / `Authorization: Bearer` / properties/JSON/URL userinfo）。
- defense-in-depth：`DevPhaseView.summary`（GET `/development/phases` 返回）、`previousSummaryOf`、`buildPhasePrompt` 的 `previousSummary`、`buildSummaryPrompt` 输入都再次 `scrubText`；旧数据/直接 DB 写入也不会明文返回。
- 默认摘要器改 `pickSummaryAgent`：`design` 优先、`req` 兜底，均 `tools: false`（无读写/命令）；**绝不使用 `build`**。无可用只读 agent → 抛错走 fallback。新增纯函数单测覆盖 agent 选择。
- 新增单测（第 8 项）：assistant 含 `password=supersecret` / `Authorization: Bearer ...` / `redis_password=...`、模型摘要复述 `token=...`、fallback 与 warning 含 secret、旧 DB 摘要含 secret、brief previousSummary 含 secret —— 均断言明文不出现；`pickSummaryAgent(['design'...]) === 'design'`、`(['req','build']) === 'req'`、`(['build']) === null`。
- 回归：后端 **145/145**、`smoke:dev-phases`、`smoke:dev-sessions`、`smoke:requirements`/`design`/`design-handoff`/`change-set`/`handoff-input` 通过；前端 69/69（未改前端）。

**仍未验证**：真实 `design`/`req` agent 的 transient 摘要调用未实机执行（单测不调模型）；opencode 2.2.5 下 design agent 的 `tools` deny 行为以 `smoke:dev-phases`（不摘要）与配置为准，未跑真实摘要。若真实环境的应用目录缺少 `design`/`req` agent，摘要会走 fallback（last assistant 800 字），需在 U7-3 真实环境确认。

### 8.8 主会话复核 must-fix #2（2026-11-12，已修复）

**问题**：`markInProgress` 只把 `status` 置 `in_progress`、补 `started_at`，没有清 `completed_at`。`startDevPhase` 允许从 `skipped` 重新开始，导致阶段显示“进行中 + 旧的跳过完成时间”。

**修复**：

- `markInProgress` 的 UPDATE 增加 `completed_at = NULL`（保留 `started_at = COALESCE(started_at, ?)`）；create 会话分支与已有会话 resume/activate 分支共用，两处都生效。
- 新增独立单测（`phases.test.ts` 第 9 项）：skip（`completed_at` 非空）→ start（无会话分支）断言 `status=in_progress`、`completedAt=null`、DB `completed_at=null`；随后 complete 正常（无 assistant → none）；再 skip → start（已有 active 会话分支）同样清 `completedAt`。
- 回归：后端 **145/145**、`smoke:dev-phases`、`smoke:dev-sessions`、`smoke:requirements`/`design`/`design-handoff`/`change-set`/`handoff-input` 通过；前端未改。
