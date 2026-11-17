# 主会话/评审接续单（2026-11-12，U7-2 前端）

用途：当前会话过长，新开**主会话 + 评审会话**继续 U7-2。文档是事实来源；不依赖旧聊天记录。
状态：**U6、P1、P2、U7-1、U7-2、U7-3 已完成/验证；U7 全部收口。后续按用户真实体验反馈排优化/问题。**
原则：主会话负责设计/评审/交接单，不直接改代码；新功能通过新开实施会话完成；同一时间只一个会话改文件。

---

## 1. 当前基线

| 项 | 状态 |
| --- | --- |
| 后端测试 | ✅ **145/145**（`npm test --prefix backend`） |
| 前端测试 | ✅ **78/78**（`npm test --prefix frontend`） |
| 前端检查 | ✅ `typecheck` / `build` / `check:vue` |
| 冒烟 | ✅ `smoke:dev-phases`（真实 opencode 2.2.5，不调模型）+ `dev-sessions`/`dev-health`/`requirements`/`design`/`design-handoff`/`change-set`/`handoff-input` |
| 真实模型 E2E | ✅ 需求 5 场景/5 Epic/15 Story、实体 10、页面 20、交接包 **large**（stories/pages/textBytes 三阈值全命中，6 阶段）、开发会话 v1；0 console/API 错误 |
| 真实数据 | `apps=0`、`projects/` 空；E2E 只在临时目录 `C:\Users\icecream\AppData\Local\Temp\opencode\i09b-real-e2e` |
| 仓库 | 非 git；不提交；`projects/`、`data/`、`.env` 不碰 |

已完成并评审：U6（规模识别 + 04-PLAN 建议）、P1（设计 ID 跨应用冲突 + 写事务 + U6 caveat）、P2（页面集主实体匹配）、U7-1（阶段后端）、U7-2（阶段前端）。

U7-1 代码/数据（新会话需要知道）：

- 新表 `app_dev_phases`；`app_sessions.dev_phase_id`；阶段 ID 用 `randomUUID()`。
- `manifest.phases`（仅在 `scale.suggested` 时）：`key/kind/title/goal/storyIds/pageSetCodes/pageCodes/note`。
- API：`GET /api/apps/:id/development/phases`、`POST .../phases/generate`、`POST .../phases/:id/start|complete|skip|reopen`。
- `GET /development` 返回 `session.phase` + `phases`；`GET /development/sessions` 返回 `phaseId/phaseKey/phaseTitle/phaseOrder/phaseStatus`。
- `POST /development/prompt` 对 completed/skipped 阶段自动置 in_progress，并返回 warning。
- 阶段完成不归档；开始下一阶段才归档当前 active；摘要模型 `design`/`req` 只读 agent + `scrubText`；失败 fallback；历史交接包阶段 409 只读；跳过阶段可重新 start；无门禁。

---

## 2. 必读（按顺序）

1. `AGENTS.md`
2. `docs/STATUS.md`：
   - 「U7-1 完成」+「主会话复验」
   - 「真实模型 E2E（2026-11-12）」
   - 「页面集主实体匹配修复完成」
   - 「设计 ID 跨应用冲突修复完成」
   - 「I-09b-1 完成」
3. `docs/plans/2026-11-12-u7-phased-development-design.md`（U7 方案定稿；§8 前端）
4. `docs/plans/2026-11-12-u7-1-implementation-brief.md` §8（后端契约/偏差/未验证）
5. `docs/plans/2026-11-09-stage-ux-and-dev-session-design.md` §4.3.3（摘要）
6. 代码：`frontend/src/dev/DevView.vue`、`SessionList.vue`、`Composer.vue`、`StepCard/ToolCard`、`dev/api.ts`、`dev/types.ts`、`dev/session-labels.js`、`dev/dev-health.js`；后端 `dev/phases.ts`、`dev/routes.ts`、`dev/service.ts`、`dev/types.ts`。

---

## 3. U7-2 前端范围（已完成并评审）

> 实施与评审结果见 `docs/plans/2026-11-12-u7-2-implementation-brief.md` §8、`docs/STATUS.md`「U7-2 完成」。以下保留原始范围作为验收依据。

### 3.1 API/类型

- `frontend/src/dev/types.ts`：
  - `DevPhaseStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped'`
  - `DevPhaseRef`（id/key/title/order/status）
  - `DevPhaseView`（goal/scope/summary/summarySource/handoffVersion/changeSetId/session/sessionCount）
  - `DevPhasesResponse`（handoffVersion/changeSet/canGenerate/generated/phases）
  - `DevStateResponse` 增加 `phases`；`DevSessionInfo`/`DevStateResponse.session` 增加 `phase?: DevPhaseRef | null`；`DevSessionListItem` 增加 phase 字段。
- `frontend/src/dev/api.ts`：`getDevPhases(appId, handoffVersion?)`、`generateDevPhases(appId)`、`startDevPhase(appId, phaseId)`、`completeDevPhase`、`skipDevPhase`、`reopenDevPhase`；`promptDevSession` 返回 warning/phase（若后端已返回）。

### 3.2 开发页交互

- **未生成阶段**：当 `handoff.scale.suggested` 且 `canGenerate` 时，显示“按阶段开发”按钮（放在 U6 规模提示旁/顶部）。
  - 二次确认：阶段数、不门禁、可随时单会话/跳过；调用 generate；成功后加载阶段。
- **已生成阶段**：
  - 时间线上方“阶段条”：`阶段 2/6 · 标题 · 进行中` + 选择阶段/完成/跳过/重新打开/查看范围；状态 chip 颜色沿用 token。
  - 阶段弹窗/抽屉：
    - 全部阶段（order/status/范围 Story/页面集/页面/摘要/会话）；
    - 当前高亮；历史交接包阶段只读；
    - 按钮 start/complete/skip/reopen；开始阶段前若当前 active 运行中，提示会归档当前会话；
    - 完成显示“生成摘要中…”/失败提示（后端 best-effort；U7-2 可先展示 warning）；
    - 全部阶段完成提示“可确认完成开发”，不自动完成。
  - 当前阶段若 `completed/skipped` 但用户继续发消息，后端会自动 in_progress；UI 刷新阶段条并显示 warning/notice。
- **会话列表**：保持按变更单分组；列表项加 `阶段 N` 或 `阶段 N · 标题` chip；active/只读不变。
- **右侧“会话”卡**：增加“阶段”行（无阶段显示—）。
- **开始卡片**：有阶段时优先“开始/继续阶段”（选择阶段）；无阶段保持现有“开始开发/新会话”；不自动发送 brief。
- **只读/归档**：阶段按钮禁用；session 只读；历史阶段只读。
- **响应式/深浅色**：阶段条 1024/768 换行；阶段弹窗内部滚动；不溢出；沿用 V1—V3 token；不新增一级导航。
- **摘要重试（可选）**：后端暂无 retry API；可先用“重新打开→完成”重生成，UI 明确提示；如要专门 retry，需另开小后端项，不在 U7-2 默认范围。

### 3.3 纯逻辑与测试

- `frontend/src/dev/phase-labels.js` + `.test.mjs`：阶段状态标签/颜色、`阶段 N/M`、范围摘要、canGenerate 文案、完成提示；加入 `package.json test`。
- 组件/typecheck/build/check:vue。
- Playwright（API 预置 large 交接包 + 真实 opencode 建会话，不调模型）：
  - 未生成阶段 → 按阶段开发 → 阶段条/弹窗；
  - 开始阶段 1/2（旧 active 归档、一个 active）、会话 list chip；
  - 完成不归档、跳过、重新打开；归档只读/恢复；
  - 历史阶段只读；
  - 浅/深 × 1440/1024/768，0 console/意外 API>=400、无溢出/白底。

---

## 4. 工作顺序（已执行）

1. ✅ 主会话写 `docs/plans/2026-11-12-u7-2-implementation-brief.md`。
2. ✅ 新开实施会话完成前端；同一时间只一个会话改文件。
3. ✅ 主会话独立跑测试/构建/Playwright，并更新 `docs/STATUS.md`「U7-2 完成」、U7 设计稿、U7-2 交接单、`AGENTS.md`、本接续单。
4. ✅ U7-3 真实模型全链路验证（2026-11-12）：model 摘要 + fallback + P2 + 6 阶段 + 只读/恢复；见 `docs/plans/2026-11-12-u7-3-real-model-e2e-brief.md` §8。
5. 后续按用户真实体验反馈排优化/问题（不阻塞）：摘要失败重试、阶段条“确认完成开发”快捷入口、<768 移动端、长会话摘要/60s 边界、fallback 需 opencode 重载 agent（仅删 agent 场景）。

---

## 5. 已知观察/风险

- U7-1 真实模型摘要未实机调用（stub）；`design`/`req` agent 缺失时 fallback；真实摘要质量待 U7-3/使用观察。
- 旧交接包没有 `manifest.phases`：`phases/generate` 409，需重新生成交接包；当前 `apps=0`。
- 历史交接包阶段 start/complete/skip/reopen 统一 409 只读；U7-2 已实现为按钮禁用 + 原因，不提供可操作按钮。
- 阶段完成不归档、不自动发送、不自动完成；U7-2 已按此实现，未加门禁。
- `manifest.phases` 只在 large 时存在；普通交接包无阶段 UI（已 Playwright 覆盖）。
- 真实模型 E2E 的 6 阶段交接包可作为 Playwright 预置数据参考；临时目录可复用，但不要污染真实 data/projects。
- 旧真实 E2E 的页面集已由 P2 修复；旧应用需重新生成页面集（当前 apps=0）。
- U7-2 复核修复：阶段刷新改为请求序号（并发/旧响应不覆盖新数据）。
- 未验证（不阻塞）：长会话摘要质量/60s 超时边界（实测摘要 5.1s/1s、会话很短）；<768 移动端；EOS/MySQL/Nacos/Redis/license 与真实 401/403（环境项，与 U7 无关）。
- fallback 观察：应用目录缺少 design/req 时需 opencode 重新加载/重启 serve 才生效（本机缓存）；正常使用不会删除 agent，不影响主路径；是否在摘要前 reload location 需产品决策。

---

## 6. 验证命令（主会话复核）

```powershell
npm run build --prefix backend
npm test --prefix backend
npm run smoke:dev-phases --prefix backend
npm run smoke:dev-sessions --prefix backend
npm run smoke:dev-health --prefix backend
npm test --prefix frontend
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm run check:vue --prefix frontend
```

后端 145/145；前端 78/78。真实 opencode 2.2.5；模型 `packycode-deepseek/deepseek-flash`（U7-2 未调模型）。

---

## 7. 新主会话开场提示（可直接粘贴）

> 在 `E:\work_space_primeton\ai-dev-workbench` 继续，作为主会话/评审。先读 `docs/plans/2026-11-12-u7-2-implementation-brief.md` §8 与 `docs/STATUS.md`「U7-2 完成」。
> 当前 U6、P1、P2、U7-1、U7-2、U7-3 已完成/验证；后端 145/145、前端 78/78；U7 全部收口，后续等用户真实体验反馈再排优化/问题。
> 本轮目标：按用户真实体验反馈处理；不要重做已评审链路，不要改后端语义除非有明确缺陷。
> 不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交；不要污染真实 data/projects。
