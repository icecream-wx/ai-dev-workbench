# R4b-2 后端 structured 移除 + 旧应用/数据删除实施交接单

日期：2026-11-11
用途：**新开实施会话**使用；主会话负责设计/评审。
状态：**已完成（2026-11-11），待主会话评审**。实施结果见 §8；验证记录见 `docs/STATUS.md`「R4b-2 完成」。
上游：`docs/STATUS.md`（R4b-1 评审、R4 讨论）、`AGENTS.md`。
范围：**R4b-2**——删除本地旧 structured 应用登记/目录、移除后端 structured 兼容（旧 P3 交接包、modules/workspace、旧 agents/spec 对话、`requirements_mode`），drop 旧表。**MySQL demo 数据不在本批**（R4c；本批只做目录备份，保留后续选择）。

---

## 1. 前置：备份（必须先做）

1. 创建临时备份（**仓库外**）：
   - `C:\Users\icecream\AppData\Local\Temp\opencode\r4b2-backup-<timestamp>\projects.zip`
   - 内容：`projects/quarterly-reporting/`、`projects/app1/`（包含配置文件；**不要打印/提交密码**）。
2. 备份成功后再删除 `projects/quarterly-reporting/`、`projects/app1/`。
3. 备份保留用于 R4c 可能的 MySQL 清理（若要执行 B 方案，可解压取连接配置，不打印）。

## 2. 删除旧应用（真实 `data/requirements.db`）

- 用临时端口启动后端（`OPENCODE_AUTO_START=false`，使用真实 `data/`/`projects/`），调用：
  - `DELETE /api/apps/quarterly-reporting?confirm=true`
  - `DELETE /api/apps/app1?confirm=true`
- 停止后端；校验：
  - `apps` 表为空；
  - 关联表（requirement docs/sections/versions、design、design inputs、sessions、change sets、handoffs、app_settings）无这两个 app 的残留；
  - `projects/` 为空（或只剩非应用文件）；
  - 清理旧 `app_settings` 中 `module*` 键。
- 若 DELETE 接口因旧代码问题失败，先记录，再用等价 SQL + `removeAppDir` 清理；不要留下半删除状态。

## 3. 后端 structured 移除（代码）

删除/收敛（以审计为准，保证 doc/design/dev 不受影响）：

- 旧 P3 交接包：`backend/src/handoff/{bundle,render,service,validate,routes,types}.ts` + `bundle.test.ts` / `service.test.ts`；`apps/routes.ts` 的 `handoffRoutes` 挂载/import；`backend/scripts/handoff-smoke.ts`、`package.json` 的 `smoke:handoff`、test 脚本条目。
- 旧 workspace/modules：`backend/src/routes.ts`（workspace/module 路由）及 `index.ts` 挂载；`apps/routes.ts` 旧 module/workspace 端点、`module*` 设置写入/清理、`validateRequirements`、旧 structured 阶段确认分支。
- 旧 agents：`agents/{decompose,testgen,layout,prompts,queue,types}.ts` 及未挂载的旧任务路由；**保留** `agents/llm.ts`（design `chatJson` 使用，审计确认）。
- `requirements_mode`：移除所有代码分支（apps/payload、dev/service、changesets/service、requirements/routes 守卫、chat/service doc 守卫、design 服务、design-handoff appRow、apps 创建/类型）；`apps` 表移除该列（`ALTER TABLE ... DROP COLUMN requirements_mode`，SQLite 3.35+；旧库迁移 guard），新应用固定 doc。
- 旧 spec 对话：`chat/service.ts` 只保留 doc/design 模式（保留 req/design agent）；删除 `<<<SPEC_JSON>>>`/旧 `buildChatPrompt`/旧 prompt 文件（审计后）。`agents/llm` 的 JSON 提取仍为 design 所用则保留。
- `db.ts`：删除 `modules`、`handoffs` 表定义与相关迁移；对旧库 `DROP TABLE IF EXISTS modules; DROP TABLE IF EXISTS handoffs;`；移除 `modules.app_id` 迁移等。
- `apps/routes.ts`：创建只写 doc；`appPayload` 去掉 modules/stats/requirementsMode/旧 handoff；应用删除清理去掉 modules/handoffs；保留 doc/design/change-set/session 清理。
- `apps/payload.ts`：去掉 `requirements_mode`/modules/stats/旧 handoff；保留 requirementDoc、designProject、handoff(设计)、activeChangeSet。
- `dev/service.ts`：去掉 requirementsMode/旧 `handoffSummary` 分支，固定设计交接包。
- `changesets/service.ts`：去掉 structured 409 检查。
- `requirements/routes.ts`：去掉 doc mode 中间件（不再有 structured）；`chat/service.ts` doc 守卫同删。
- `index.ts`/注释/README：移除 requirements-grooming/structured 旧描述。

## 4. 测试/脚本更新

- 删除旧测试/脚本条目：`handoff/bundle.test.ts`、`handoff/service.test.ts`、`smoke:handoff`、`scripts/handoff-smoke.ts`、旧 agents 测试（若删）。
- 更新仍插入 `requirements_mode`/modules/handoffs 的测试（`design-handoff.test.ts` 的 legacy-app、changesets/doc 测试、apps 测试等）；旧 structured 用例改删或改为 doc。
- `package.json` test 列表/scripts 清理。
- 保留并跑通：`smoke:design`、`smoke:design-handoff`、`smoke:handoff-input`、`smoke:change-set`、`smoke:requirements`、`smoke:dev`、`smoke:dev-sessions`、`smoke:dev-health`。

## 5. 验证

- `npm run build --prefix backend`、`npm test --prefix backend`（计数下降属预期，删的是旧 structured 测试）。
- `npm run typecheck --prefix frontend`、`npm run build --prefix frontend`、`npm test --prefix frontend`、`node check-vue-imports.cjs`。
- 全量冒烟（上列）；`smoke:dev` 真实模型可选，至少 `dev-sessions`/`dev-health` 真实 opencode。
- 真实 DB：`apps` 空；`sqlite_master` 无 `modules`/`handoffs`；`projects/` 空；`rg requirements_mode` 零残留。
- 启动真实/临时后端：`GET /api/apps` 空；创建一个 doc 应用 → 需求文档/设计/开发页可打开/删除；0 非预期 API >=400。
- 记录备份 zip 路径；MySQL demo 行未动。

## 6. 不做

- 不动 MySQL demo 行（R4c，等用户选 A/B/C）。
- 不做视觉/响应式打磨。
- 不删除 `templates/eos-app`、`docs/` 历史设计文档。
- 不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交。

## 7. 文档

更新 `README.md`、`AGENTS.md`、`docs/STATUS.md`（「R4b-2 完成」+ 摘要表/总状态/未验证）、本交接单状态与实施结果、`docs/plans/2026-11-11-main-review-handoff.md`（下一步 R4c）、旧 P3/P5 文档标注“历史/已由 doc 模式取代”（不删除）。

完成后回传：删除/备份清单、代码删除清单、测试/冒烟结果、真实 DB/projects 校验、偏差、R4c 待办（MySQL 选择）。

---

## 8. 实施结果（2026-11-11，实施会话）

### 8.1 备份

- `C:\Users\icecream\AppData\Local\Temp\opencode\r4b2-backup-20261111-155329\projects.zip`（226 项，0.9MB）。
- 含 `projects/quarterly-reporting/`、`projects/app1/` 的源码/配置/文档（`backend/src/application.properties`、`bootstrap*.properties`、`META-INF/_srv/config/user-config.xml` 等）。
- **排除** `backend/target`（各 ~606MB）、`frontend/node_modules`、`dist`、`.git`：两应用合计约 1.4GB，首次全量压缩超时；R4c 所需的 MySQL 连接配置已保留。未打印/提交任何密码。

### 8.2 旧应用删除

- 临时端口 3499 + 真实 `data/`/`projects/`（`OPENCODE_AUTO_START=false`）：`DELETE /api/apps/quarterly-reporting?confirm=true`、`DELETE /api/apps/app1?confirm=true` 均 200。
- 真实 DB：`apps` 空；`app_sessions`/`app_stage_events`/`app_requirement_docs`/`app_requirement_doc_sections`/`app_requirement_doc_versions`/`app_design_*`/`app_change_sets`/`design_handoffs`/`handoffs`/`modules` 均 0 行；`projects/` 空；旧 `module*` 与全局设置键已清空。
- MySQL demo 行未动（R4c）。

### 8.3 代码删除/收敛

见 `docs/STATUS.md`「R4b-2 完成 → 后端删除/收敛」表。要点：

- 删除：`backend/src/routes.ts`；`backend/src/agents/{decompose,prompts,queue,routes,types}.ts`；`backend/src/handoff/{bundle,render,service,validate,routes,types}.ts` 及对应 2 个测试；`backend/scripts/handoff-smoke.ts`。
- 保留：`backend/src/agents/llm.ts`（设计 `chatJson`）+ `llm.test.ts`；`backend/src/handoff/design-*.ts`（D5）。
- `db.ts`：删旧表定义 + `DROP TABLE IF EXISTS module_docs/modules/handoffs`；`ALTER TABLE apps DROP COLUMN requirements_mode`（带失败兜底）；清理旧全局设置键；删 `ModuleRow/ModuleDocRow`。
- `chat/service.ts`：只保留 `mode:'doc'|'design'`，其它 mode 400；删 `buildChatPrompt` 与 `<<<SPEC_JSON>>>`。
- `apps/routes.ts` / `apps/payload.ts` / `dev/service.ts` / `changesets/service.ts` / `design/service.ts` / `handoff/design-service.ts` / `requirements/routes.ts`：移除 `requirements_mode` 与 structured 分支；`stage/confirm` 设计固定 409（DesignStudio 生成交接包）。

### 8.4 测试/冒烟

- `npm run build --prefix backend` ✅；`npm test --prefix backend` ✅ 113/113（126 → 113，删旧 P3 两个测试文件与 structured 守卫用例）。
- 前端 `typecheck` / `build` / `test` 63/63 / `check-vue-imports.cjs` ✅。
- `smoke:requirements`、`smoke:design`、`smoke:design-handoff`、`smoke:handoff-input`、`smoke:change-set`、`smoke:dev-sessions`、`smoke:dev-health`、`smoke:dev`（真实模型）✅。
- Playwright（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`，PORT=3400）：首页/需求文档/设计 Studio wireframe/开发页/变更历史/删除后空状态；0 console error、0 page error、0 意外 API >=400。
- 真实后端：`r4b2-check` 创建 → 需求文档 200（13 节）→ 设计 200 → 删除 200 → 列表空；旧接口 `/api/workspace`、`/api/modules/*`、`/api/agents/*`、`/api/settings/*`、`/api/apps/:id/handoff` 均 404。

### 8.5 偏差 / 待主会话确认

1. 备份排除构建产物（`target`/`node_modules`/`dist`），只保留源码与配置；如 R4c 需要运行态产物需另行备份。
2. `requirements_mode` 用 `DROP COLUMN` 删除；失败时保留列 + 警告（本机已成功删除，代码仅保留迁移守卫）。
3. `/api/settings/:key`（theme/ui/docTemplate/conversation）随 `routes.ts` 一并删除并清理设置行（R4b-1 后前端已无调用方）。
4. 实施中一次 PowerShell 重写损坏了 `backend/src/dev/service.ts` 的中文文案，已恢复并逐处校对；最终 build/测试/真实 opencode 冒烟/Playwright 复验通过。

