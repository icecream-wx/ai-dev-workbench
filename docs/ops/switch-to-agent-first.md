# 切换到 Agent-First 版本（真实实例切换清单）

> 适用：本机真实工作台（默认 `http://localhost:3300`）从旧构建切换到 2026-11-20 的 Agent-First 版本（P1—P6-4 已评审，P7-1～P7-6c + P7-4b + P8-1 + P8-2 已实施待评审）。
> **本文只给步骤，不在文档里执行任何命令**；由用户在确认备份后手动操作。
> 旧方向（版本/确认/变更单/交接包/U7/M7-2）已移除；旧库只支持“空应用库”升级，不做旧数据迁移。

> **2026-11-23 运行态提示**：当前真实实例**正在运行**——3300 PID **39828**（`node dist/index.js`，启动 **2026-11-23 09:10:41**）、4771 PID **19608**（`opencode serve` 2.2.5，启动 **09:10:42**），`/api/health` 200（`ok:true`、`runtime.ready:true`、`pendingSessions:0`）；`backend/dist` **2026-11-23 10:08:23**、`frontend/dist` **2026-11-23 10:08:49**（后端进程比 dist 早约 58 分钟）。§0 的「133/111」基线、PID 34988/15628 与启动 10:35:47 是 2026-11-20 的历史口径；真实 3300 人工验收已于 2026-11-23 由用户确认全部通过（P7-7 评审仍待定）。**以下步骤不变。**

---

## 0. 前提检查

- [ ] 新版本已在临时目录/端口通过验收：后端 133/133、前端 111/111、`smoke:workspace`/`assets`/`dev`、`e2e:preview`/`p8-2`/`p7-3b`/`p7-4b`/`p7-6a` = 83/28/38/48/15、`e2e:p2/p3/p4` 116/126/128。
- [ ] 确认真实 3300 当前状态：**2026-11-20 评审只读核对为有监听**——3300（PID 34988，`node dist/index.js`）与 4771（PID 15628，`opencode serve`）均启动于 10:35:47。**运行后端已是 P8-1**（app1 产物可证：`tokens.json` 含 `styleId: data-cyan`、`design-system.json` 用新风格路径、新建应用无「旧版兼容」；`backend/dist` 11:36 只是重建，后端 src 未变）；`frontend/dist` 11:28 为 P8-2，由 Express 静态托管**即时生效**，**P8-2 前端已生效、无需为 P8-2 重启**。当前库已是 P8-1 的 **4 表新结构**，`apps>0` 是正常状态。
- [ ] fail-closed 只针对「旧 5 表结构 + `apps>0`」的旧库升级：若你从更早的旧构建升级且真实库有应用，新版会拒绝启动，需先备份后删除应用或重置库。**当前（4 表新结构 + app1）不属于该情况。**
- [ ] 确认无人正在使用旧实例；切换窗口内不要同时启动两个工作台（同一 `3300`/`4771` 会互相占用）。
- [ ] 根目录 `.git` 状态干净或已自行记录当前提交（回退依赖 git 历史/GitHub，见 §7）。

## 1. 备份（停之前）

停止前先做文件级备份（不要只依赖 git；`data/`、`projects/`、`.env` 均被 gitignore）：

```text
1) 复制 data/ 整个目录（至少 requirements.db、requirements.db-wal、requirements.db-shm）
2) 复制 projects/ 整个目录（所有应用工作区文件）
3) 复制 backend/.env（若有）
4) 记录当前 git 提交：git rev-parse HEAD（只记录，不要提交/回滚）
5) 记录 opencode 版本与模型配置位置（模型/provider 在 opencode 自身配置，不在本仓库）
```

建议备份目录带日期，例如 `D:\backup\ai-dev-workbench-20261118\`。

## 2. 停止旧实例

> 当前（2026-11-20 核对）3300/4771 **有监听**（PID 34988/15628，启动 10:35:47），运行后端已是 P8-1、P8-2 前端已生效；**仅为 P8-2 不需要重启**。只有当你**改后端代码或切换构建**时才需要按本节停止 + §3 重建 + §5 启动；若只是使用当前 P8-1/P8-2 实例，可跳过 §2—§5。

Windows：

```bat
stop.cmd
```

Linux：

```bash
./stop.sh
```

确认：

- `http://localhost:3300/api/health` 不再响应；
- 端口 `3300` 与 `4771` 上没有残留的本工作台/opencode serve 进程（旧实例的 serve 由 stop 脚本连同子进程结束）。

## 3. 构建新版本

在仓库根目录（**不要**用 `npm install --prefix` 安装根依赖）：

```bash
npm run install:all   # 根 npm install + backend + frontend
npm run build         # 后端 tsc + 前端 vite build
```

说明：

- `install:all` 会安装根依赖（`concurrently`、`playwright`）与两个子包依赖；新机器必须走这一步。
- 只有需要跑 Playwright 验收时才需要浏览器：`npx playwright install chromium`。
- 构建产物：`backend/dist/`、`frontend/dist/`；工作台以“后端托管 frontend/dist”的方式运行。

## 4. 启动并验证数据层

启动：

```bat
start.cmd
```

```bash
./start.sh
```

启动日志会打印数据目录、应用目录与 opencode 地址；PID/日志在 `data/workbench.pid`、`data/logs/`。

**升级行为（必须知道）**：

- **4 张表**：`apps`、`app_settings`、`app_sessions`、`requirement_templates`（P8-1 起 `prototype_templates` 与 `apps.prototype_template_id` 已删除）。
- 旧结构 + `apps` 为空 → 自动重建为 4 表，**保留需求模板库**；旧库里的原型模板表/旧列一并删除。
- 旧结构 + `apps` 非空 → **拒绝启动**并提示“请删除应用或重置数据库（本版不做旧数据兼容）”。
- 应用工作区（P7）：新建应用前端为 MF remote（`frontend/`，webpack + Module Federation + PageTemplates + GlobalPreference）；`docs/design/design-system.json` + `docs/design/template/<type>/{pages,structure.css,assets}` + `docs/design/template/styles/{shared.css,<styleId>/style.css}`；团队 skill（`afcenter-page-generation`、`pm-components-usage`）、开发方法 skill（`adw-frontend-implementation`）与设计模板 skill（`adw-template-proto-<applicationType>`）；另有需求模板 skill（`adw-template-req-*`）与设计参考包（`design-brief.md`、`tokens.json`、`prototypes/*.png`）。旧**结构**库不迁移：从旧 5 表结构升级时须 `apps = 0`；**当前库已是 4 表新结构（app1 在其后创建），`apps>0` 属正常，不需要清空**。

验证（任选其一）：

```bash
# 有 sqlite3 CLI
sqlite3 data/requirements.db "select name from sqlite_master where type='table' order by name;"
sqlite3 data/requirements.db "select count(*) from apps;"
sqlite3 data/requirements.db "select id,name from requirement_templates order by id;"
```

```bat
:: 无 sqlite3 CLI（在仓库根目录执行）
node -e "const D=require('./backend/node_modules/better-sqlite3');const db=new D('data/requirements.db',{readonly:true});console.log(db.prepare(\"select name from sqlite_master where type='table' order by name\").all());console.log('apps=',db.prepare('select count(*) c from apps').get().c);console.log('reqTpl=',db.prepare('select count(*) c from requirement_templates').get().c);db.close()"
```

通过标准：

- [ ] 只存在上述 **4 张**业务表（另有 SQLite 内部表可忽略；不应再有 `prototype_templates`）；
- [ ] `apps = 0` —— **仅从旧 5 表结构升级时要求**；若启动前已是 4 表新结构，`apps>0`（如当前 `app1`）属正常，直接核对 4 表与 `app_settings` 三键即可；
- [ ] 需求模板 ≥ 4（内置 4 个；用户自建模板应保留）；
- [ ] `/api/health` 返回 `ok:true`，`runtime.ready` 为 true（serve 已连接）；
- [ ] 旧 `projects/` 下若有旧应用目录，确认已自行清理（新版本不会自动删除）。

如果启动因旧应用数据失败：先备份，再按提示删除旧应用目录/登记或重置数据库（删除 `data/requirements.db*` 后重启），**不要**期望自动迁移。

## 5. 新建应用跑一遍（人工验收）

1. 首页 → 新建应用：填写应用 ID/名称、后端端口（避免 3300）、需求模板（默认即可）、**设计模板（类型 × 风格，默认企业级 · 平台蓝白）**、EOS/DB/邮件可留空（写 `CHANGE_ME`）。
2. 首页「设计模板」→ 设计模板中心：4 应用类型卡片/分类/搜索、风格切换、页面集 iframe 预览；「模板库」（需求模板中心）保持原样。
3. 检查工作区：`projects/<app>/AGENTS.md`、`README.md`、`opencode.json`、`.opencode/skills/`（2 方法 + 设计模板 skill + 2 团队 skill + `adw-frontend-implementation`；需求模板 skill）、`.opencode/commands/*.md`（5 个）、`docs/requirements/`、`docs/design/design-system.json` + `template/`、`frontend/`（MF remote）。
4. 需求视图：新建模块 → 文件 `docs/requirements/MOD-001-*.md` 出现 → 文档渲染与 TOC；手动改文件 → ≤1.5s 刷新；发送消息时可见“思考中…”占位，完成后被正文替换。
5. 设计视图：徽标显示「设计模板：类型 · 风格」，「模板页面库」可打开并定位；「生成/更新设计」可用（需 opencode + 模型）；ER/原型可渲染；非法 design.json 出现错误条 +「让 AI 修」；打开设计视图后自动导出 `prototypes/*.png`、`tokens.json`。
6. 开发视图：模块下拉选择设计模块；「设计参考」显示应用类型/风格/页面库/ui-check/蓝图根；发送“先读 AGENTS.md、docs/ 与设计参考包，再实现页面” → 工具卡/文件变化/权限卡正常；首次生成 `docs/design/<MOD>/ui-check.md` 骨架（不覆盖已有内容），实现前先填表。
7. 开发视图点「检查一致性」→ 只读报告（设计系统/页面契约/蓝图/实现/PageTemplates/pm-*/表单/列表/GlobalPreference/样式/ui-check/PNG），只报告、不阻断。
8. 刷新页面/重启工作台：应用、会话、模板默认值仍在；产物仍以文件为准。

> 若只想验证“不调模型”的基础能力：执行 `npm run smoke:workspace --prefix backend`、`npm run smoke:assets --prefix backend`、`npm run smoke:dev --prefix backend`（均使用临时目录/端口）。

## 6. 切换后观察项

- [ ] `data/logs/` 无持续报错；opencode serve 仅在 `127.0.0.1:4771`（或配置端口）。
- [ ] 新建多个应用时，会话按 `view` 独立，不串应用。
- [ ] 模板库修改 → 应用内模板 skill 同步（`_manifest.json` hash 变化），需求/设计正文不被改写。
- [ ] 已有应用改设计模板只更新 `design-system.json`/蓝图/设计模板 skill，不补建 `frontend/`、不清理旧类型蓝图目录；需要新前端时新建应用。
- [ ] 删除应用（确认框）只删除本地目录与登记，不处理远端数据库/已部署服务。

## 7. 回退

本版本**不做自动回滚**，回退依赖你的事前备份与 git 历史：

1. 停止新实例（`stop.cmd` / `stop.sh`）。
2. 恢复代码：`git log`/GitHub 历史找到切换前提交，`git checkout <commit>`（或从 GitHub 拉取历史版本）；重新 `npm run install:all` + `npm run build`。
3. 恢复数据：用 §1 的备份覆盖 `data/`（旧库结构）与 `projects/`；恢复 `backend/.env`。
4. 启动旧实例并确认 `/api/health`、应用列表与旧版页面可用。

注意事项：

- 新版本使用过之后，`data/requirements.db` 已被升级为 4 表；**不能用新库直接回退旧版本**，必须用备份恢复。
- `projects/` 中新建的应用目录按需保留或移走（旧版本不认识新目录也无害，但避免混淆）。
- 回退是人工操作，工作台不提供“版本/回滚”功能（本版明确不做）。

## 8. 常见问题

| 现象 | 处理 |
| --- | --- |
| 启动提示“检测到旧版数据库（N 个应用）” | 旧库有应用数据，本版不迁移；备份后删除应用/重置数据库 |
| 端口 3300/4771 被占用 | 先确认旧实例已停；必要时 `stop.cmd` 或按端口清理残留进程 |
| `runtime.ready=false` | 检查 opencode 是否安装、`OPENCODE_BIN`/`OPENCODE_PORT`；首次启动 serve 需要几秒 |
| 页面 404/空白 | 确认已 `npm run build`（`frontend/dist` 存在）；刷新浏览器 |
| Playwright 报浏览器缺失 | `npx playwright install chromium`（仅验收需要，运行工作台不需要） |
| 模板被删后新建应用回退默认 | 属预期：应用默认值解析时回退全局默认；全局模板库是唯一权威 |
