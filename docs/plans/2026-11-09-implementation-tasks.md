# 智能开发工作台 v2 实施任务

日期：2026-11-09
依据：[v2 设计](2026-11-09-workbench-v2-design.md)
状态：设计已确认（需求/设计 A、开发 B）；P0—P5 已完成（真实应用 + MySQL 空/非空 E2E + 用户确认完成；遗留真实模型需求/设计重跑、Nacos/Redis/license、真实 401/403 权限、打磨）。

> **历史说明（2026-11-11，R4b-2）**：本文档的 P3「结构化需求卡片 + 旧交接包（`/api/apps/:id/handoff`、`modules`/`handoffs` 表）」已被文档模式需求（R1）+ 设计交接包（D5）取代，相关接口/表/代码已在 R4b-2 删除。P1 的 workspace/modules 接口同样已删除。当前实现以 `docs/STATUS.md` 与 `docs/plans/2026-11-11-design-to-development-handoff.md` 为准。

> 原则：先做一条可运行的最小纵向链路，再逐步补齐。不要先铺全部页面/全部数据表。

---

## 0. 实施前核验（0.5 天）

| # | 事项 | 验收 |
| --- | --- | --- |
| 0.1 | Node/npm 版本 | `node -v` / `npm -v` 可用；与 Vite 6 / Element Plus 2.14 兼容 |
| 0.2 | Java/Maven | `java -version` 17；`mvn -v` 可用 |
| 0.3 | opencode | `opencode --version` 为 v2.2.5；`serve` 能启动并捕获密码 |
| 0.4 | EOS 制品 | 内部 Maven 仓库能解析 `com.primeton.eos:eos-pom:9.0.0` 与模板依赖 |
| 0.5 | EOS license | `templates/eos-app/src/META-INF/_srv/primetonlicense.xml` 可用或替换为团队 license |
| 0.6 | 模型 | opencode `/api/model` 能看到团队模型；默认模型可调用 |
| 0.7 | 基线 | 记录核验命令、退出码、未通过项；不把未通过项写成已通过 |

**0 节结果（2026-11-09）**：0.1—0.3 通过；0.4 以 offline `mvn dependency:resolve` + `compile` 验证通过（依赖来自本机 `~/.m2`，在线 Nexus 未测）；0.5 license 运行态未验证；0.6 默认模型已由 `npm run smoke:opencode` 实际调用通过。详见 `docs/STATUS.md`。

---

## P0：新项目骨架与 opencode 运行时

> ✅ 2026-11-09 已完成；验证记录见 `docs/STATUS.md`。

### P0-1 清理旧开发模块 ✅

- 目标：让新项目只保留需求/设计 + 新的开发骨架。
- 文件：
  - 删除/停用 `backend/src/dev/codegen.ts`、`runner.ts`、`agents/harness.ts`、`agents/opencode.ts`、`dev/routes.ts`（先保留在 `legacy/` 或直接删除，二选一）。
  - 删除/停用 `frontend/src/requirements-grooming/ui/dev/` 旧开发页。
  - 保留 `backend/src/agents/` 的需求分析任务层，后续统一改 opencode。
- 验收：后端 `npm run build` 通过；前端 `npm run typecheck` 通过；旧 dev 路由不再挂载。

### P0-2 工作台骨架 ✅

- 目标：一个能启动的前后端空壳。
- 文件：
  - `backend/src/index.ts`：只挂载 `/api/health`、`/api/apps`、`/api/opencode/*`、静态前端。
  - `backend/src/config.ts`（或扩展现有配置）：`RG_PROJECTS_DIR`、`RG_DATA_DIR`、`OPENCODE_BIN`、`OPENCODE_PORT`、默认模型。
  - `frontend/src/`：保留 App.vue/main.ts，新增应用列表空壳。
- 验收：`npm run dev` 启动；`GET /api/health` 返回 ok；前端可打开。

### P0-3 OpencodeRuntime ✅

- 目标：统一封装 opencode serve。
- 文件：`backend/src/opencode/runtime.ts`、`client.ts`、`events.ts`。
- 能力：
  - 启动/停止 `opencode serve`，捕获 password，Basic Auth。
  - 健康检查、模型列表、默认模型、agent 列表。
  - 创建/删除会话、发送 prompt、读消息、SSE 订阅、权限/表单/取消。
  - 事件按 sessionID/appID 过滤，不把其他项目事件广播给当前应用。
- 参考：`primeton-agent-capabilities/workbench-stub/src/opencode.js`（移植，不直接依赖旧项目）。
- 验收：
  - 单测：事件过滤、密码捕获、错误处理。
  - 集成：启动 serve → 创建会话 → 发一条 echo prompt → 收到 SSE 文本 → 删除会话 → 停止 serve。
  - 不启动真实模型也可先测会话创建/删除；真实模型测试单独记录。

### P0-4 配置与密钥边界 ✅

- 目标：不把宿主环境/密钥全量暴露。
- 规则：
  - 不代理 LLM API Key；模型/provider 由 opencode 配置。
  - 日志不记录 serve password、模型 key、DB/Nacos 密码。
  - `.env`、`projects/`、`data/` 不进版本控制。
- 验收：日志/API 响应扫描无凭据；模板占位符扫描通过。

---

## P1：应用、阶段与 EOS 模板

> ✅ 2026-11-09 已完成；验证记录见 `docs/STATUS.md`。设计阶段的交接包校验/生成按计划留到 P3，当前确认设计只切换阶段并返回 warning。

### P1-1 应用表与 API ✅

- 目标：创建应用、列出应用、查看应用。
- 文件：`backend/src/apps/routes.ts`、`backend/src/db.ts` 迁移。
- 表：`apps`、`app_stage_events`；`modules.app_id`。
- API：`GET/POST /api/apps`、`GET/DELETE /api/apps/:id`。
- 验收：创建后目录存在、`apps` 行存在、删除只删本地目录/登记（不删远端）。

### P1-2 应用目录与 EOS 模板渲染 ✅

- 目标：把 `templates/eos-app` 渲染到 `projects/<app-id>/backend/`。
- 文件：`backend/src/apps/scaffold.ts`、`templates/eos-app/`。
- 占位符：`{{APP_ID}}`、`{{APP_NAME}}`、`{{PORT}}`、`{{EOS_SYS_KEY}}`、DB/邮件占位符。
- 目录：`docs/handoff/`、`backend/`、`.opencode/agents/`、`AGENTS.md`、`README.md`。
- 验收：
  - 渲染后无 `{{...}}` 残留；未提供项写显式 `CHANGE_ME`。
  - 无示例真实凭据；创建时提供的敏感值只落 `projects/`。
  - `pom.xml` 的 artifactId、`spring.application.name`、`server.port` 正确。
  - EOS 模板 README 转 UTF-8 可读。

### P1-3 应用级工作区 ✅

- 目标：需求/设计数据按应用隔离。
- 文件：`backend/src/apps/routes.ts`、`backend/src/db.ts`、前端 `storage/workspace-persist.ts`、`conversation/store.ts`。
- 变更：
  - `modules.app_id`、应用级 `app_settings` 键（scenes/activeId/batches/conversation）。
  - `/api/apps/:id/workspace`、`/api/apps/:id/modules/:mid/doc`、`/api/apps/:id/conversation`。
  - 前端加载前设置 `activeAppId`；切换应用整页刷新。
  - 旧全局接口限定 `app_id='default'`。
- 验收：两个应用的需求点/场景互不串联；刷新后保持。

### P1-4 三阶段状态与确认 ✅

- 目标：需求 → 设计 → 开发渐进解锁。
- 文件：`backend/src/apps/routes.ts`、前端 `workbench/AppShell.vue`。
- API：`POST /api/apps/:id/stage/confirm`、`POST /api/apps/:id/complete`。
- 规则：
  - 需求完成校验：至少 1 个需求点，卡片已确认且有目标/角色/验收要点。
  - 设计完成校验：交接包校验通过（P1 当时只切换阶段；P3 已接入校验/生成）。
  - 开发完成：用户点击确认完成。
- 验收：未完成前一阶段不能点后一阶段；确认弹窗有“进入下一阶段/稍后”；完成状态刷新后保持。

### P1-5 首页与应用创建 ✅

- 目标：进入工作台先看到应用列表/创建。
- 文件：`frontend/src/workbench/HomeShell.vue`、`NewAppDialog.vue`。
- 表单：app-id、名称、描述、端口；高级折叠 EOS sys-key/DB/邮件（模型选择在 P2）。
- 验收：创建成功后进入应用需求阶段；错误提示明确。

---

## P2：需求/设计统一 opencode（A 方案）

> ✅ 2026-11-09 已完成；验证记录见 `docs/STATUS.md`。模型选择按“应用 + 阶段”保存；旧 OpenAI 兼容入口已移除。

### P2-1 自定义 req/design agent ✅

- 目标：需求/设计专用 agent，禁止写文件/执行 shell。
- 文件：应用目录 `.opencode/agents/req.md`、`design.md`。
- 内容：角色说明 + 协议提示；2.2.5 实测 `tools: {bash/edit/write/read/grep/glob/list/webfetch/…: false}` 生成 deny 权限。
- 验收：`GET /api/opencode/agents?directory=<app>` 能看到 req/design；agent 不发起写/命令工具。

### P2-2 短暂会话聊天 API ✅

- 目标：`POST /api/apps/:id/chat`，短暂会话 + prompt + SSE。
- 文件：`backend/src/chat/service.ts`；route 挂在 `backend/src/apps/routes.ts`。
- 流程：
  1. 创建会话（location=应用目录，agent=req/design）。
  2. 把 `messages` 拼成 prompt（系统指令 + 历史 + 用户输入）。
  3. 发送 prompt，订阅事件，收集 assistant 文本增量。
  4. 通过工作台 SSE 转发 `{type:'meta'|'delta'|'done'|'error'}`。
  5. 结束/取消时删除会话。
- 验收：真实模型流式输出；前端能解析 `<<<SPEC_JSON>>>`；取消不残留会话。

### P2-3 前端聊天改造 ✅

- 目标：保留现有对话 UI/协议，替换传输。
- 文件：`frontend/src/requirements-grooming/llm/client.ts`、`conversation/store.ts`、`ChatPanel.vue`、`SettingsDialog.vue`。
- 变更：
  - `opencodeChat` + 兼容入口 `streamChat`；解析 `{type:'meta'|'delta'|'done'|'error'}`。
  - 保留 `buildSystemPrompt`、`splitModelOutput`、`validateEnvelopeData`、`applyReply`、撤销。
  - 设置面板改为 opencode 模型选择（应用 + 阶段）。
- 验收：需求/设计聊天流式、diff 卡、actions、撤销正常。

### P2-4 统一其他 LLM 调用 ✅

- 目标：`agents/decompose.ts`、`testgen.ts`、评审等不再直连 OpenAI 兼容接口。
- 文件：`backend/src/agents/llm.ts`、`backend/src/agents/decompose.ts`、`frontend/src/requirements-grooming/llm/testgen.ts`。
- 变更：全部走 `OpencodeRuntime.generateText()`；删除 `backend/src/llm.ts`、`/api/llm`、`/api/settings/llm`。
- 验收：任务拆解/测试用例生成仍可用；无 `LLM_BASE_URL/LLM_API_KEY` 依赖。

---

## P3：开发交接包

> ✅ 2026-11-09 已完成；验证记录见 `docs/STATUS.md`。

### P3-1 Bundle 加载与校验 ✅

- 目标：按 appId 加载全部已确认需求/设计/测试用例。
- 文件：`backend/src/handoff/bundle.ts`、`validate.ts`、`types.ts`。
- 实现：
  - 读取 `apps/modules/module_docs/app_settings`；只导出已确认需求点卡片与已确认设计项；
  - 草稿/未确认项进入 `openRequirements`/`openDesignItems`/`unconfirmedTestCases`；
  - 稳定编号 FEAT/ENT/PAGE/API/FLOW/RULE/TRIGGER/DICT/INT/FN/NFR/NAV/TC；
  - 支持 `moduleId:entityId` 跨需求点引用；
  - 校验至少 1 个确认需求点、目标/验收标准、页面/实体/角色/服务/规则/导航引用完整性、测试用例步骤/预期。
- 验收：未确认项被排除；引用完整性校验；错误可读。

### P3-2 4 份 Markdown 渲染 ✅

- 目标：`00-README.md`、`01-REQUIREMENTS.md`、`02-DESIGN.md`、`03-PLAN.md`。
- 文件：`backend/src/handoff/render.ts`（模板直接内置为确定性函数，未另建 `templates/handoff/`）。
- 内容：见设计 §7.3；Mermaid ER；已确认实体时额外生成 `schema.sql`。
- 决策：不生成 OpenAPI（缺少确定性 HTTP 路径/方法，避免虚构契约）。
- 验收：文档自包含、无内部 DB ID、验收标准明确、长度可控（简单应用约 11KB/5 文件）。

### P3-3 预览/生成/写盘 ✅

- 目标：设计确认时生成到 `projects/<app>/docs/handoff/`。
- 文件：`backend/src/handoff/service.ts`、`routes.ts`、`backend/src/db.ts`。
- API：`POST /api/apps/:id/handoff/preview`、`generate`、`GET /handoff`。
- 实现：`handoffs` 表（version/hash/docs_dir/files_json/source_spec）；SHA-256；版本递增；清理过期可选文件；`apps.handoff_hash` 同步。
- 验收：生成成功记录 hash；文档列表/预览可读；重新生成有版本/hash 变化。

### P3-4 设计完成接入 ✅

- 目标：设计阶段“完成”按钮先校验再生成交接包，再解锁开发。
- 文件：`backend/src/apps/routes.ts`、`frontend/src/workbench/HandoffDialog.vue`、`AppShell.vue`、`api.ts`。
- 实现：设计完成失败返回 400 + issues，不切换阶段；成功后生成并解锁开发；UI 支持预览/生成/单文件下载；顶栏“交接包”入口。
- 验收：校验失败不生成；成功后开发阶段解锁；弹窗可立即进入开发。

---

## P4：开发页与 opencode 原生会话（B 方案）

> ✅ 2026-11-09 已完成；验证记录见 `docs/STATUS.md`。

### P4-1 开发会话 API ✅

- 目标：创建/恢复/发送/取消/权限/表单。
- 文件：`backend/src/dev/routes.ts`、`service.ts`、`timeline.ts`；`backend/src/db.ts`。
- 存储：`app_sessions`（active/archived/stale）；opencode sessionID 持久化。
- 实现：
  - `GET /api/apps/:id/development`；
  - `POST/DELETE /development/session`；
  - `POST /development/prompt`、`/interrupt`；
  - `GET /development/events`（SSE）；
  - `POST /development/permission/:rid/reply`、`/form/:fid/reply`；
  - 模型阶段支持 `development`；agent 固定 `build`。
- 验收：opencode serve 重启后能恢复同一会话；消息/工具/状态从 opencode 读取并归一化。

### P4-2 新开发 UI ✅

- 目标：Codex App / opencode-web 风格的 vibe coding 界面。
- 文件：`frontend/src/dev/`：
  - `DevView.vue`、`ToolCard.vue`、`StepCard.vue`
  - `PermissionCard.vue`、`FormCard.vue`、`Composer.vue`
  - `api.ts`、`types.ts`
- 交接文档大纲/文件变化合并在 `DevView` 右侧栏；点击文档定位到 `HandoffDialog` 文件。
- 验收：时间线、工具卡、diff、shell 输出、权限/表单、停止、文件变化、文档大纲可用。

### P4-3 首条提示与完成 ✅

- 首条提示只指向 `docs/handoff/00-README.md`，可在开始开发前编辑。
- 顶部/开发页“确认完成” → `POST /api/apps/:id/complete`；记录最后会话 ID。
- 完成后继续发送消息自动恢复 `development`。
- 验收：用户可确认完成；完成后可继续开发；状态正确。

---

## P5：端到端与打磨

> ✅ 2026-11-09 完成：真实应用 `quarterly-reporting` 已由 opencode build agent 实现并确认完成；后端 10 个 H2 测试/打包、前端构建、EOS + 真实 MySQL 空/非空接口/UI E2E 通过（2+2 条 demo 行）；脱敏修复通过。遗留：真实模型需求/设计重跑、Nacos/Redis/license、真实 401/403 权限、打磨。
>
> **历史（2026-11-11）**：应用目录与工作台登记已在 R4b-2 删除（备份在仓库外）；MySQL 2+2 条 demo 行的清理 SQL 见 `docs/ops/cleanup-demo.sql`（R4c，由用户自行执行，工作台不连接数据库）。

- 创建真实小应用（EOS demo 模板）→ 需求 → 设计 → 交接包 → 开发 → 用户确认。
- 记录：
  - 每条命令、退出码、截图/日志；
  - 真实模型/真实 EOS 构建/启动；
  - 未验证项。
- 视觉打磨：空状态、错误、加载、响应式、深色/浅色。
- 性能：首字延迟、总耗时、工具数（仅记录，不设强制门槛）。

---

## 6. 首批建议（先做这一条纵向链路）

1. P0-1/P0-2/P0-3：清理旧 dev、骨架、OpencodeRuntime。
2. P1-1/P1-2：创建应用 + EOS 模板渲染（先不接需求/设计）。
3. P2-1/P2-2/P2-3：一个应用的需求对话跑通（真实模型、SSE、协议解析）。
4. P3-1/P3-2/P3-3：生成 4 份交接包。
5. P4-1/P4-2：开发页能创建会话、发首条提示、看到回复。
6. 再用真实 EOS 小应用做一次端到端。

**不要**在第一条链路跑通前铺全部需求/设计页面、全部数据表、全部 UI 主题。
