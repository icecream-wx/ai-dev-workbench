# Agent-First 工作台 P1「底座」实施交接单（2026-11-18）

> 上游：`docs/plans/2026-11-18-agent-first-workbench-design.md` v3（§3 文件契约、§4 skills、§5 commands、§6 模板分发、§8 会话、§9 数据/接口、§13.1 P0 结论）。
> P0 spike 已完成（opencode 2.2.5 实证），本单只做 **P1 底座 + 全量清理**，不做 P2—P4 的视图 UI。
> **不做任何 git 操作**（不 init、不 commit、不 revert、不写 `.gitignore`）；不设计文件丢失/回滚/并发等兜底。
> 真实 3300 **保持旧构建、不重建、不重启**；P1 全部在临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` + 独立端口验证。

---

## 0. 出口标准（P1 完成时）

1. 新库只有 5 张表；旧结构 + 有应用数据 → **fail-closed**（不迁移、不删数据）。
2. 新建应用后工作区结构完整：`AGENTS.md`、`.opencode/{skills,commands}`、`opencode.json`、`docs/requirements/`、`docs/design/`、`backend/`。**不创建任何 git 相关文件**。
3. `GET /api/skill` 能看到 2 个项目级 skill（`adw-requirements-document`、`adw-design-artifacts`）；`GET /api/command` 能看到 4 个命令。
4. `POST /api/apps/:id/requirements-modules` 能按应用默认模板生成 `docs/requirements/MOD-001-<标题>.md`（frontmatter + 章节骨架），不写任何 DB 记录。
5. 全局模板 `PUT` 保存 → 自动同步所有携带应用；`POST /api/templates/:kind/:id/sync` 幂等；删除仍被引用 → 409。
6. `GET /api/apps/:id/artifacts` 返回模块列表、文档正文/章节、设计解析结果、校验错误、文件 hash。
7. `POST /api/apps/:id/chat`（SSE）可用：`view` + 可选 `module` / `command`；每视图一个活跃会话 + 历史。
8. `GET /api/apps/:id/events`（SSE）在 `docs/` 变化时推送 `artifacts-changed`。
9. 后端测试、`build`、`smoke:workspace` 全绿；前端删除旧组件后仍可 `typecheck`/`build`（需求/设计为占位页，开发视图保留时间线）。

## 1. 不做

- P2/P3/P4 的完整视图 UI（需求/设计只做占位；开发视图只做 phase/handoff 清理）。
- 交接包、Change Set、版本、确认、覆盖度、stale、G1、模块管理状态、U7 阶段、M7-2。
- MCP、plugins、自定义 tool、subagent 链。
- **任何 git 操作**（init、commit、revert、`.gitignore`、git 集成）。
- 文件丢失/回滚/并发/多实例锁等兜底（前期开发不设计）。
- 旧应用数据迁移。
- 触碰真实 `data/`/`projects/`/`.env`；真实 3300 不重建不重启。

## 2. 数据层（`backend/src/db.ts`）

保留 5 表：

| 表 | 关键列 |
| --- | --- |
| `apps` | id/name/status/requirement_template_id/prototype_template_id/created_at |
| `app_settings` | app_id/key/value（沿用） |
| `app_sessions` | 现有列 + **`view`**（`requirements`/`design`/`development`）+ `archived_at`（沿用） |
| `requirement_templates` | 沿用现有（名称/描述/阶段/章节结构/内置标记） |
| `prototype_templates` | 沿用现有 |

- 删除：`app_modules`、`app_requirement_bundles`、`app_requirement_docs(_sections/_versions)`、`app_design_*`、`app_change_sets(_modules)`、`design_handoffs`、`app_dev_phases`、`app_stage_events`。
- 启动升级：
  - 新结构已存在 → no-op；
  - 旧结构 + `apps` 为空 → 重建为新结构（drop 旧表）；
  - 旧结构 + `apps` 非空 → **抛错退出**，文案含"请删除应用或重置数据库（本版不做旧数据兼容）"。
- `app_sessions.view` 用 `ensureColumn` 加列，不回填。

## 3. 工作区（`backend/src/apps/scaffold.ts`）

创建应用时生成：

```
AGENTS.md
README.md
opencode.json
.opencode/skills/adw-requirements-document/{SKILL.md,assets/templates/*,_manifest.json}
.opencode/skills/adw-design-artifacts/{SKILL.md,references/*,assets/templates/*,scripts/validate.mjs,_manifest.json}
.opencode/commands/{update-requirements,generate-design,preview-app,check-consistency}.md
docs/requirements/            （空目录，首个模块由按钮/agent 生成）
docs/design/                  （空目录）
backend/                      （现有 EOS 模板渲染不变）
```

- 移除 `REQ_AGENT`/`DESIGN_AGENT` 生成（`.opencode/agents` 不再创建）。
- `AGENTS.md` 内容要点：产物路径、模块与设计文件契约、需求↔设计必须一致、需求写目标与验收、中文回复、汇报格式、不要改 `.opencode/skills/**` 与 `.opencode/commands/**`。
- `opencode.json`（应用级）：
  - `permission.edit`：`*` allow；`.opencode/skills/**`、`.opencode/commands/**` deny（P0 已验证 deny 硬生效）。
- **不创建 `.gitignore`、不执行任何 git 命令。**

## 4. skills / commands 资产

- 仓库内置源：`templates/agent/skills/…`、`templates/agent/commands/…`（新目录，与 `templates/eos-app` 并列）。
- 两个 skill（命名带 `adw-` 前缀，P0 已证实项目级会静默覆盖同名内置）：
  - `adw-requirements-document`：正文 ~100 行，按设计稿 §4.1 六条要点。
  - `adw-design-artifacts`：正文 + `references/design.schema.json`（唯一校验源）+ `design-example.json` + `scripts/validate.mjs`（读同一 schema，输出 `{ok, errors[]}`）。
  - 两个 `SKILL.md` 必须含 `name` + `description`（缺 description 视为废 skill，P0）。
- 4 个 command（设计稿 §5），正文含目标、产物路径、模板路径占位，不写死步骤。
- 写入后调用现有 `reloadLocations()`，并用 `GET /api/skill`、`GET /api/command` 校验实际加载（校验失败 → 记录 warning，不阻塞创建）。

## 5. 模板分发与同步（新 `backend/src/templates/distribution.ts`）

- **渲染**：`requirement_templates.sections`（现有结构）→ 模块文件骨架（frontmatter + `## 章节标题`，可带 description 作提示行）；`prototype_templates` 原样复制 JSON。
- **manifest**：`{managed:true, skill, skillVersion, templates:{<id>:{sourceId,hash}}}`，hash = 文件内容 sha256。
- **分发**：创建应用时按应用默认模板写副本；`POST /api/apps/:id/requirements-modules` 时确保该模板副本存在。
- **同步**：
  - 全局模板保存 → 遍历 `projects/*`，覆盖匹配副本 + 更新 manifest；
  - `POST /api/templates/:kind/:id/sync` 幂等（可重复调用）；
  - 应用启动/会话启动时做一次幂等对齐（覆盖式）。
- **删除保护**：扫描各应用模块 frontmatter 的 `template`，仍被引用 → 409 并列出应用；否则移除副本与 manifest 条目。
- 只写 `assets/templates/*` 与 `_manifest.json`，**不改正文**。

## 6. 统一 chat 与会话（`backend/src/chat/service.ts`）

- `POST /api/apps/:id/chat`：body `{ view, text, module?, command?, model? }`。
  - `view` 决定活跃会话（`app_sessions.view`）；无活跃 → 创建；归档 → 新建。
  - `command` 存在时走 `POST /api/session/:id/command {name, text}`（P0 已验证），否则走普通 prompt。
  - 沿用现有 SSE 事件格式（meta/delta/done/error/permission/form/tool…）。
- 会话 API：列表（按 view 过滤）/新建/归档/重命名（沿用现有，补 `view`）。
- 上下文：返回健康度字段（沿用 `DevProgress.context` 计算）；`POST /api/apps/:id/compact`（按会话）。
- 模型：沿用应用级默认 + 请求覆盖（P0：prompt 体 model 被忽略，切换走模型设置）。

## 7. 产物解析 / 校验 / 监听

- `backend/src/workspace/artifacts.ts`：
  - 需求：解析 `docs/requirements/*.md`（排除 `README.md`）的 YAML frontmatter（`module/title/order/template`）+ 按 `##` 切章节；缺失/重复 key → 结构化错误。
  - 设计：解析 `docs/design/<MOD>/design.json`；用 `design.schema.json` 校验；返回 `{module, entities, relations, pages, errors[]}`。
  - 聚合为 `GET /api/apps/:id/artifacts`：`{ modules[], designs[], errors[], hashes{} }`。
- `backend/src/workspace/watcher.ts`：`fs.watch(docs/, {recursive:true})` + 300ms 防抖 → 事件 → SSE `/api/apps/:id/events` 推 `artifacts-changed {paths, hashes}`；进程退出清理。
- 校验错误**不抛 500**：作为 artifacts 的一部分返回，供 UI 显示"文件/字段/期望"。

## 8. 运行时扩展（`backend/src/opencode/runtime.ts`）

- `listSkills(directory)`（`GET /api/skill`）、`listCommands(directory)`（`GET /api/command`）、`runCommand(sessionId, name, text)`（`POST /api/session/:id/command`）。
- 不需要新增 revert（本版不做回滚 UI）。

## 9. 全量清理（P1 一次性完成，不留半套）

> 目标：P1 结束时仓库里**不存在**被本版淘汰的功能代码、测试、冒烟脚本与 UI 组件。旧设计文档按 §9.4 处理。

### 9.1 后端

- 路由：`requirements-doc/*`（保留模板）、`requirements-modules/*`（保留新建/改名/排序新实现）、`requirements-bundle/*`、`requirements-prototype/*`、`design/*`（保留模板）、`handoff/*`、`change-sets/*`、`development/phases`；`apps/routes.ts` 移除对应挂载。
- 代码：`changesets/*`、`handoff/*`、`requirements/{doc,modules,module-generation,module-plan,module-replan,module-intent,module-migration,outline,prototype-preview,prototype-spec,types}.ts`、`design/{service,input,prompt,epic-context,module-migration,types,errors}.ts`。
- 测试：删除上述模块对应 `*.test.ts`。
- 保留：`opencode/*`、`apps/{payload,scaffold,template-resolution}.ts`、`design/{templates,template-routes,builtin-templates}.ts`、`requirements/{templates,builtin-templates}.ts`、`dev/*`（去掉 phases 相关）。

### 9.2 前端

- **删除**：`src/changesets/**`；需求侧 `AiSuggestionCard`、`AppTemplateSwitchDialog`、`DocChatPanel`、`ModuleEditDialog`、`ModuleGenerationProgress`、`ModuleGuidanceCard`、`ModulePlanCard`、`ModuleReplanDialog`、`OutlineEditor`、`RequirementOutlineTree`、`RequirementOverview`、`RequirementsDocView`、`RequirementsPrototypePreview`、`VersionHistoryDialog`、`doc-diff.js`、`doc-protocol.js`、`module-*.js`、`module-intent.js`、`prototype-*.js`、`api-query.js`、`requirements/api.ts`；设计侧 `DesignChatPanel`、`DesignEpicGenerationProgress`、`DesignHandoffDialog`、`DesignOverviewDialog`、`DesignOutlineTree`、`DesignSyncDialog`、`DesignTemplateSwitchDialog`、`DesignVersionsDialog`、`RequirementCoveragePanel`、`design-epic-helpers.js`、`design-module-helpers.js`、`design-protocol.js`、`handoff-scale.js`、`version-labels.js`、`design/api.ts`；开发侧 `PhaseBar.vue`、`PhaseDialog.vue`、`phase-labels.js` 及 `DevView`/`dev/api.ts`/`dev/types.ts` 中的 phase/handoff 引用。
- **保留**：`design/prototype/**`、`ErGraph.vue`、`er-layout.js`、`PrototypeCanvas.vue`、`PrototypeTab.vue`、`PrototypeTemplateDialog.vue`、`snapshot.ts`、`MarkdownView.vue`、`TemplateCenterDialog.vue`（改为全局模板库）、`dev/*`（除 phase）、`shared/*`、`settings/*`、`workbench/*`。
- **视图占位**：P1 结束时需求/设计视图为"构建中"占位页（说明新契约 + 指向设计稿），P2/P3 重写；开发视图保留时间线/会话（去掉 phase/handoff）。
- 同步删除对应 `*.test.mjs`；`package.json` 脚本移除失效项。

### 9.3 脚本

- 删除：`smoke:requirements`、`smoke:modules`、`smoke:design`、`smoke:design-handoff`、`smoke:change-set`、`smoke:dev-phases`。
- 保留：`smoke:dev-sessions`、`smoke:dev-health`、`smoke:dev`。
- 新增：`smoke:workspace`（§10）。

### 9.4 文档

- 新建 `docs/plans/README.md`：声明**只有 `2026-11-18-*` 为当前有效**，其余为历史。
- 在 `2026-11-09-workbench-v2-design.md`、`2026-11-13-module-requirements-design.md`、`2026-11-11-iterative-change-design.md` 顶部加"已被 2026-11-18 Agent-First 取代"提示。
- 旧设计稿**不删除**（无 git，删除不可恢复；保留决策历史）。如需连历史文档一起删，由用户单独确认。

## 10. 测试与验收

| 项 | 要求 |
| --- | --- |
| 后端单测（新） | 迁移三态（no-op/空库重建/fail-closed）；scaffold 结构；skill/command 种子与 reload 调用；模块文件生成/解析/frontmatter 错误；设计 JSON 解析与 schema 校验；manifest/hash/同步/删除保护；artifacts 聚合；watcher 防抖事件；chat 路由与视图会话选择；command 触发 |
| 后端单测（保留/改写） | 模板 CRUD、应用 CRUD、EOS 渲染、opencode runtime 既有单测 |
| 冒烟 `smoke:workspace` | 临时库 + 临时目录：建应用 → 校验文件树/skill/command → 生成模块 → 改模板同步 → artifacts → 事件（用真实 opencode 可选，默认 `OPENCODE_AUTO_START=false`） |
| 静态 | `npm run build --prefix backend`、`npm test --prefix backend`、前端 `typecheck`/`build` 不回归 |
| 明确不做 | Playwright、真实模型、真实 3300 重启 |

## 11. 交付

- P1 完成 → 主会话评审（独立复跑测试 + 临时实例冒烟）→ 再开 P2「需求视图」交接单。
- 真实 3300 保持旧构建，直到 P4/P5 全链路通过后再由**用户**重建/重启。

## 12. 风险与注意

1. `fs.watch` 在 Windows 的递归监听：需处理重命名/删除与防抖；失败时降级为"轮询（2s）+ 手动刷新"。
2. skill 命名冲突：两个 skill 均带 `adw-` 前缀；分发后必须用 `GET /api/skill` 校验（坏 YAML 静默失效）。
3. schema 漂移：`design.schema.json` 单一源，后端与 `validate.mjs` 都读它；不允许各写一套。
4. 测试大面积删除：删除前确认无保留模块引用；新基线数字写进交接单回填与 `docs/STATUS.md`。
5. 数据处置：真实库 `apps=0`（用户已删 app1）；P1 不在真实库执行升级，等 P5 由用户重启时生效。
6. **不设计兜底**：不处理文件丢失、回滚、并发、多实例（本版明确不做）；出问题直接修。
