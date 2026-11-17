# R4a 安全清理实施交接单

日期：2026-11-11
用途：**新开实施会话**使用；主会话负责设计/评审。
状态：**已完成（2026-11-11，实施会话），待主会话评审**；实施结果见本文 §5，摘要见 `docs/STATUS.md`「R4a 完成」。
上游：`AGENTS.md`、`docs/STATUS.md`（R2c/I-09a 评审）、R4 讨论。
范围：**R4a**——只做安全、无行为变更的死代码/legacy 清理。**不删** structured 旧路径（R4b）、**不删**应用目录/登记、**不删**数据库数据（R4c）。

---

## 1. 范围

1. 删除 `legacy/`（`backend-dev/`、`frontend-dev-ui/`）；确认 package/tsconfig/构建脚本无引用。
2. 删除 `frontend/src/requirements/DesignPending.vue`（已不挂载、无引用）；清理相关 import/旧文案。
3. 删除未注册的 `backend/src/design/routes.ts` `designErrorHandler`（实际由 `appsErrorHandler` 处理）；确认无其他引用。
4. 修掉 `frontend/src/design/DesignHandoffDialog.vue` 里无效的 `mode === 'view'` 条件（本地 ref 遮蔽 props；按实际 props 修正或删除该装饰性 chip）。
5. 审计并删除**明确无引用**的旧文件/导出（例如仅被已删组件引用的工具）；不确定属于 structured 兼容的，**保留给 R4b**，不要扩大范围。
6. 不修改任何运行时行为（除第 4 条 UI 装饰修正），不改接口、数据库、交接包内容。

---

## 2. 不做

- 不移除 structured 兼容（旧 P3 交接包、旧场景/卡片/批次 UI、旧 modules/workspace API）。
- 不删除 `quarterly-reporting` / `app1` 登记或目录。
- 不删除 MySQL demo 数据。
- 不做视觉/响应式/深浅色打磨。
- 不删除历史设计文档（保留作为记录）。
- 不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交。

---

## 3. 验证

- `npm run build --prefix backend`
- `npm test --prefix backend`（计数应与 R4c 前一致或只因删除死测试减少；不得跳过既有行为测试）
- `npm run typecheck --prefix frontend`、`npm run build --prefix frontend`、`npm test --prefix frontend`、`node check-vue-imports.cjs`
- 回归：`smoke:design`、`smoke:design-handoff`、`smoke:handoff-input`、`smoke:change-set`、`smoke:requirements`、`smoke:dev-sessions`、`smoke:dev-health`（至少主链路，按时间）
- 搜索确认无 `legacy/`、`DesignPending`、`designErrorHandler` 引用残留。

---

## 4. 文档

更新 `docs/STATUS.md`（「R4a 完成」+ 摘要表/总状态）、本交接单状态与实施结果、`AGENTS.md`（下一步 R4b）、`docs/plans/2026-11-11-main-review-handoff.md`。

完成后回传：删除文件清单、验证命令/结果、是否发现需要 R4b 处理的引用、偏差。

---

## 5. 实施结果（2026-11-11，实施会话）

### 删除文件清单

- `legacy/backend-dev/`（`dev/agents/*`、`dev/codegen.ts`、`dev/contract.ts`、`dev/routes.ts`、`dev/runner.ts`、`opencode-adapter.ts`）
- `legacy/frontend-dev-ui/`（`DevView.vue`、`store.ts`）
- 共 10 个文件（`legacy/` 整目录移除）。
- `frontend/src/requirements/DesignPending.vue`

### 删除代码

- `backend/src/design/routes.ts`：`designErrorHandler` + 无用 `DesignError` import。
- `backend/src/apps/routes.ts`：`templateDirExists` + 无用 `node:path` import。
- `backend/src/changesets/query.ts`：`CLOSED_CHANGE_SET_STATUSES`、`ChangeSetStatus`。
- `backend/src/changesets/service.ts`：`completeActiveChangeSetRow`、`latestChangeSetView` + 无用 import。
- `backend/src/design/input.ts`：`requirementFingerprint`、`emptyDiff`。
- `backend/src/design/prompt.ts`：`clipDesignJson`、`MAX_JSON_CHARS`。
- `backend/src/design/types.ts`：`DesignProjectSummary`。
- `backend/src/handoff/design-types.ts`：`DesignHandoffPrototypeFile`。
- `backend/src/requirements/builtin-templates.ts`：`REQUIREMENTS_TEMPLATES`。
- `backend/src/requirements/doc.ts`：`confirmRequirementDocForStage`、`assertSections` + 无用 import。
- `backend/src/requirements/outline.ts`：`outlineSummary`。

### 修改

- `frontend/src/design/DesignHandoffDialog.vue`：`mode === 'view'` → `props.mode === 'view'`（原条件被本地 `mode` ref 遮蔽）。
- `README.md`（目录树移除 `legacy/`）、`backend/src/db.ts`、`backend/src/index.ts`（注释更新）。

### 验证

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ |
| `npm test --prefix backend` | ✅ 126/126 |
| `npm run typecheck --prefix frontend` | ✅ |
| `npm run build --prefix frontend` | ✅ |
| `npm test --prefix frontend` | ✅ 63/63 |
| `node check-vue-imports.cjs` | ✅ |
| `smoke:design` / `smoke:design-handoff` / `smoke:handoff-input` / `smoke:change-set` / `smoke:requirements` | ✅ 全部通过 |
| `smoke:dev-sessions` / `smoke:dev-health`（真实 opencode 2.2.5） | ✅ 通过 |
| 全局搜索 `legacy/`、`DesignPending`、`designErrorHandler` | ✅ 代码无残留（`docs/` 历史记录保留） |

### 偏差 / 留给 R4b

1. `frontend/src/requirements-grooming/` 仍有多处零引用旧 UI（`agent/store.ts`、`ui/design/DataModelPanel|NavGraph|PageRoutePanel|PointSpecGraph`、`ui/doc/DocMetaSection|FreeSectionBlock`、`ui/ModuleDialog`、`ui/TemplateDialog`、`ui/panels/IssuePanel|ValidationPanel`、`ui/shared/HistoryDrawer`）；属 structured/旧需求-设计 UI 兼容面，按交接单保留 R4b。
2. `backend/src/agents/{prompts,queue,types}.ts` 的零引用导出（`REVIEW_SYSTEM`、`decomposeBrief`、`updateTask`、`TaskStatus`、`TaskEmitter`）与前端未挂载的 `useAgentTasksStore` 同属 structured 需求分析兼容面，留 R4b。
3. 未改接口/数据库/交接包/版本语义，未删应用登记/目录/数据。
4. 历史文档中的 `legacy/` 描述按记录保留。
