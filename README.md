# AI Dev Workbench（智能开发工作台 v2）

三阶段智能开发工作台：**需求 → 设计 → 开发**。

- 需求/设计：文档模式需求（模板/章节/Scene/Epic/Story）+ 设计 Studio（实体/ER、页面原型、需求覆盖、设计输入同步）。
- 设计完成：确定性生成「开发交接包」（`00-README` / `01-REQUIREMENTS` / `02-DATA-MODEL` / `03-PAGES` / `04-PLAN` / `05-CHANGES`、参考 DDL `schema.sql`、`prototype-template.json`、`manifest.json`、`prototypes/`），创建 Change Set #1 并进入开发。
- 开发：直接把交接包交给 **opencode 原生 agent**，工作台只提供项目目录、会话 UI、权限/表单转发和用户确认；不做自定义开发 agent/skill/固定骨架/批次/证据/Git 流程。
- 后端模板：参考用户提供的 `eos-demo`（EOS 9.0.0，`src/` 结构，`eos-pom` parent，最小依赖见 `templates/eos-app/pom.xml`）。
- 前端：目标应用只告知使用 Vue3，不强制目录结构。

> 当前状态：**P0—P5、R1、设计阶段 D1—D4、需求→设计 H1—H4、设计→开发 D5、C1、R2a/R2b/R2c、I-10、I-09a、R4a、R4b-1、R4b-2、R4c 已完成**。R4b-2（2026-11-11）移除了后端 structured 兼容（旧 P3 交接包、`/api/workspace`、`/api/modules/*`、`/api/settings/*`、`/api/agents`、旧 spec 对话、`requirements_mode` 列），drop 旧 `modules`/`module_docs`/`handoffs` 表，并删除旧应用登记与 `projects/quarterly-reporting`、`projects/app1`（已备份到仓库外）。R4c（2026-11-11）生成 MySQL demo 清理 SQL（[`docs/ops/cleanup-demo.sql`](docs/ops/cleanup-demo.sql)，**由你自行连接数据库执行，工作台不连库**）、移除未使用依赖（`@element-plus/icons-vue`、`ai-dev-workbench: file:..`）、文档收尾。当前全量：后端 113 测试、前端 63 测试。真实应用 `quarterly-reporting` 的历史交付记录见 `docs/STATUS.md`（目录已删除，MySQL demo 行待按 SQL 清理）。遗留：视觉/响应式/深浅色打磨（单独一轮）、I-09b（分阶段，后续评估）、真实模型需求/设计重跑、Nacos/Redis/团队 license、真实 401/403 权限接入。工作台/需求/设计仍使用 SQLite，不使用 MySQL。
>
> 入口：
> - 当前状态与接续：[`docs/STATUS.md`](docs/STATUS.md)
> - 设计稿：[`docs/plans/2026-11-09-workbench-v2-design.md`](docs/plans/2026-11-09-workbench-v2-design.md)
> - 实施任务：[`docs/plans/2026-11-09-implementation-tasks.md`](docs/plans/2026-11-09-implementation-tasks.md)

## 目录

```text
ai-dev-workbench/
  backend/              # Express + SQLite；/api/health、/api/apps（需求文档/设计/开发/变更单）、/api/requirement-templates、/api/prototype-templates、/api/opencode/*
  frontend/             # Vue3 + Vite；应用列表 + 应用工作区（需求文档/设计 Studio/开发页）
  templates/eos-app/    # 脱敏的 EOS demo 模板（应用 backend/ 的起点）
  docs/plans/           # 设计稿；2026-11-04-* 为 requirements-grooming 历史计划
  docs/ops/             # 运维脚本（如 cleanup-demo.sql：清理 P5 demo 的 MySQL 行，需手动执行）
  projects/             # 运行时生成的应用目录（gitignored）
  data/                 # 运行时 SQLite / serve pid 文件（gitignored）
```

## 开发命令

```bash
# 安装（内部在 backend/frontend 各自目录内执行 npm install；不要用 npm install --prefix，
# 本机 npm 会把仓库根包写成目标包的 file:.. 依赖）
npm run install:all

# 开发（后端 3300 + 前端 Vite 5180）
npm run dev

# 构建
npm run build

# 单元测试（opencode 事件/密码/脱敏、EOS 渲染、需求文档/设计/交接包/变更单/开发会话）
npm test --prefix backend

# 集成冒烟（真实 opencode serve + 真实模型，默认独立端口 4788）
npm run smoke:opencode --prefix backend

# 需求文档冒烟（临时 data/projects；模板/文档/版本/AI 建议/确认/删除）
npm run smoke:requirements --prefix backend

# 设计 Studio / 设计输入 / 设计→开发交接包 / 变更循环
npm run smoke:design --prefix backend
npm run smoke:handoff-input --prefix backend
npm run smoke:design-handoff --prefix backend
npm run smoke:change-set --prefix backend

# 开发会话冒烟（真实 opencode build agent + 真实模型；创建会话 → 提示 → 恢复 → 完成/继续/停止）
npm run smoke:dev --prefix backend
npm run smoke:dev-sessions --prefix backend   # 会话列表/切换/重命名/归档
npm run smoke:dev-health --prefix backend     # 上下文健康度 + 原生 compact

# 生产启动（需先构建前端）
npm start
```

## 一键启动 / 停止（推荐）

工作台以「后端托管 `frontend/dist`」的方式运行，脚本会按顺序完成：检查 Node/npm → 缺依赖时自动安装（比如删掉 `frontend/node_modules` 之后）→ `npm run build` → 后台启动 → 健康检查。

```bat
:: Windows 本地
start.cmd   :: 启动（默认 http://localhost:3300）
stop.cmd    :: 停止（会连同 opencode serve 子进程一起结束）
```

```bash
# Linux 线上
chmod +x start.sh stop.sh
./start.sh
./stop.sh
```

说明：

- 端口优先级与后端一致：环境变量 `PORT` > `backend/.env` 的 `PORT` > 默认 `3300`；`start.*` 会先校验端口（1—65535），非法时启动脚本直接报错退出。
- PID 记录在 `data/workbench.pid`，日志在 `data/logs/workbench.log`、`data/logs/workbench.error.log`。
- 重复执行 `start.*` 会提示已在运行；端口被其他进程占用时直接报错退出。
- 停止时优先按 PID 结束整个进程树（含工作台拉起的 `opencode serve`）；PID 文件丢失时退回按端口查找。两条路径都会校验目标确实是本工作台（`node dist/index.js`），不是本工作台时只提示、不结束进程。
- `start.cmd` / `stop.cmd` 的提示信息使用英文，避免 Windows 控制台代码页把批处理中的中文解析错位。

## 运维：清理 P5 demo 数据（手动执行）

P5 验证真实 MySQL 非空界面时，在演示应用的库里写入了 2 条季度 + 2 条 ATM demo 行（ID 含 `-demo-`）。应用目录与工作台登记已删除，库里这几行需要你自行清理：

- 脚本：[`docs/ops/cleanup-demo.sql`](docs/ops/cleanup-demo.sql)（先跑预览 `SELECT`，确认只命中 `-demo-` 行，再在事务里先删 ATM 后删季度，可 `ROLLBACK`）。
- **工作台不会连接 MySQL、不会自动执行**；请用你自己的客户端连接演示应用所用的 schema 执行，并先备份。
- 连接信息当时只写进了 `projects/quarterly-reporting/backend/`（应用已删除）；删除前的源码/配置备份在仓库外的临时目录 `r4b2-backup-20261111-155329/projects.zip`（**含配置，用后建议删除**，不要提交）。

## 配置

复制 `backend/.env.example` 为 `backend/.env`（该文件被 gitignore）：

| 变量 | 说明 |
| --- | --- |
| `PORT` | 工作台后端端口，默认 3300 |
| `RG_DATA_DIR` | SQLite/运行态目录，默认 `<repo>/data` |
| `RG_PROJECTS_DIR` | 应用目录根，默认 `<repo>/projects` |
| `OPENCODE_BIN` | opencode 可执行文件；默认从 PATH 查找（Windows 会自动解析 npm `.cmd` shim 到真实 exe） |
| `OPENCODE_PORT` | 工作台拥有的 serve 端口，默认 4771，只监听 127.0.0.1 |
| `OPENCODE_DEFAULT_MODEL` | 可选，`provider/model`；默认取 opencode `/api/model/default` |

模型/provider 由 opencode 自身配置管理；工作台不保存、不代理模型 API Key。需求/设计/任务拆解/测试用例统一走 `OpencodeRuntime`。

## API

### 应用与阶段

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/POST | `/api/apps` | 应用列表 / 创建（固定文档模式；渲染 EOS 模板到 `projects/<id>/`） |
| GET/DELETE | `/api/apps/:id` | 应用详情 / 删除（删除需 `?confirm=true`） |
| POST | `/api/apps/:id/stage/confirm` | `{stage:'requirements'}` 确认需求（设计在 Studio 确认并生成交接包） |
| POST | `/api/apps/:id/complete` | 用户确认开发完成 |

### 需求文档

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/PUT | `/api/apps/:id/requirements-doc` | 文档/章节（模板、版本、AI 建议预览与应用） |
| PUT | `/api/apps/:id/requirements-doc/sections/:key` | 自动保存单章节（不产版本） |
| PUT | `/api/apps/:id/requirements-doc/template` | 切换模板（产版本） |
| POST | `/api/apps/:id/requirements-doc/confirm` | 确认需求（必填校验 → 应用进入 design） |
| GET/POST | `/api/apps/:id/requirements-doc/versions` | 版本列表 / 手动保存版本 |
| GET | `/api/apps/:id/requirements-doc/export` | 导出 `01-REQUIREMENTS.md` |

### 设计 Studio

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/apps/:id/design` | 设计项目（实体/页面集/页面/覆盖度/版本摘要） |
| PUT | `/api/apps/:id/design/entities` | 保存实体（字段/关系/需求引用） |
| POST | `/api/apps/:id/design/page-sets/generate` | 按场景/Epic 生成页面集与页面（列表/创建/编辑/详情） |
| PUT | `/api/apps/:id/design/page-sets`、`/page-sets/:pageSetId` | 保存页面集 / 单个页面集 |
| PUT | `/api/apps/:id/design/pages/:pageId` | 保存页面规格/布局 |
| POST | `/api/apps/:id/design/pages/:pageId/snapshot` | 保存 PNG 快照（校验 PNG 魔数） |
| GET | `/api/apps/:id/design/input`、`/coverage` | 设计输入（DesignInputBundle）/ 需求覆盖度 |
| POST | `/api/apps/:id/design/input/sync` | 需求变更后同步设计输入 |
| POST | `/api/apps/:id/design/confirm`、`/reopen` | 确认设计（只读）/ 重新编辑 |
| GET/POST | `/api/apps/:id/design/versions` | 设计版本列表 / 手动保存版本（回滚 `POST /versions/:v/rollback`） |

### 设计→开发交接包（D5）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/apps/:id/design/handoff/preview` | 校验 + 渲染，不写盘；失败返回 `issues`/`warnings` |
| POST | `/api/apps/:id/design/handoff/generate` | 写入 `projects/<id>/docs/handoff/`，版本递增 + SHA-256，创建/绑定 Change Set |
| GET | `/api/apps/:id/design/handoff` | 当前交接包元数据/文件清单/内容 |

### 变更单（C1）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST/GET | `/api/apps/:id/change-sets` | 发起变更 / 变更历史 |
| POST | `/api/apps/:id/change-sets/:csid/cancel` | 取消变更（恢复基线） |
| POST | `/api/apps/:id/change-sets/:csid/scope` | 仅设计 → 需求+设计 升级 |

### 开发会话

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/apps/:id/development` | 当前会话 + 归一化时间线 + pending 权限/表单 |
| POST/DELETE | `/api/apps/:id/development/session` | 创建/恢复会话；`{new:true}` 重开；DELETE 归档 |
| GET | `/api/apps/:id/development/sessions` | 会话列表（按变更单分组信息） |
| POST | `/api/apps/:id/development/sessions/:sid/activate` | 切换会话 |
| PATCH | `/api/apps/:id/development/sessions/:sid` | 重命名/备注 |
| POST | `/api/apps/:id/development/sessions/:sid/archive` | 归档会话（幂等） |
| POST | `/api/apps/:id/development/prompt` | 发送消息；completed 后自动恢复 development |
| POST | `/api/apps/:id/development/interrupt` | 停止 |
| POST | `/api/apps/:id/development/compact` | opencode 原生上下文压缩 |
| GET | `/api/apps/:id/development/events` | SSE（按 opencode sessionID 过滤） |
| POST | `/api/apps/:id/development/permission/:rid/reply` | 回复权限 |
| POST | `/api/apps/:id/development/form/:fid/reply` | 回复表单 |

### 对话与模型

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/apps/:id/chat` | 需求文档（`mode:'doc'`）/ 设计（`mode:'design'`）聊天：短暂会话 + prompt + SSE（`meta/delta/done/error`） |
| GET/PUT | `/api/apps/:id/model` | 当前阶段模型（providerID/modelID）；PUT 校验模型存在 |

> R4b-2 起旧 structured 接口已删除：`/api/workspace`、`/api/modules/*`、`/api/settings/*`、`/api/agents/*`、`/api/apps/:id/handoff*`（旧 P3 交接包）与 `/api/apps/:id/conversation` 均返回 404。

### opencode 运行时

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/opencode/health` | serve 状态（不含密码） |
| POST | `/api/opencode/start` / `stop` | 启动/停止 serve |
| GET | `/api/opencode/models`、`/default-model`、`/agents` | 模型/agent 列表（响应已剔除 provider 密钥） |
| POST/GET | `/api/opencode/sessions` | 创建/列出会话 |
| GET/DELETE | `/api/opencode/sessions/:id` | 会话详情/删除 |
| POST | `/api/opencode/sessions/:id/prompt` | 发送消息 |
| GET | `/api/opencode/sessions/:id/messages` | 消息 |
| GET | `/api/opencode/sessions/:id/pending` | 待处理权限/表单 |
| POST | `/api/opencode/sessions/:id/interrupt` | 中断 |
| POST | `/api/opencode/sessions/:id/permissions/:rid/reply` | 回复权限 |
| POST | `/api/opencode/sessions/:id/forms/:fid/reply` | 回复表单 |
| GET | `/api/opencode/events?sessionID=&directory=` | SSE 事件（按会话/目录过滤） |

`directory` 参数必须位于 `RG_PROJECTS_DIR` 下。R4b-2 起不再有旧的全局 `/api/workspace`、`/api/modules/*` 兼容层。

## 安全

- `templates/eos-app/` 已把示例中的 DB 密码、Nacos 密码、Redis 地址、`eos.application.sys-key`、邮件账号替换为占位符。
- 不要提交任何真实凭据；`projects/`、`data/`、`.env` 已在 `.gitignore` 中忽略。
- serve 随机密码只存在内存；日志与 API 响应统一脱敏（`backend/src/opencode/redact.ts`）。
- 应用创建时填写的 EOS sys-key / DB / 邮件信息只写入 `projects/<app-id>/`，不写入工作台数据库；未填写项为 `CHANGE_ME`。
- serve 子进程不继承 `RG_*` / `LLM_*` / `WORKBENCH_*` / `WB_*` / `PORT` 等工作台环境变量。
- `templates/eos-app/src/META-INF/_srv/primetonlicense.xml` 是示例 license，正式使用前替换为团队自己的 license。
- 内部 Maven 仓库、EOS 制品、Nacos/MySQL/Redis 是应用构建/运行的外部前提，尚未做运行态验证。

## 历史计划

`docs/plans/2026-11-04-agent-upgrade.md` 与 `docs/plans/2026-11-04-dual-view-refactor.md` 来自 requirements-grooming，描述的是需求/设计阶段的历史改造，**不代表新开发阶段的设计**。`docs/plans/2026-11-09-implementation-tasks.md` 的 P1/P3（workspace/modules、结构化需求卡片 + 旧交接包）与 P5（真实应用 `quarterly-reporting`）同样是历史记录：相关接口/表/目录已在 R4b-2、R4c 删除或清理。当前方向以 `2026-11-09-workbench-v2-design.md` 与 `docs/STATUS.md` 为准。
