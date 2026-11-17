# 一键启动/停止脚本验证（2026-11-12）

验证对象：仓库根 `start.cmd` / `stop.cmd` / `start.sh` / `stop.sh`（2026-11-10 引入）是否仍与当前工作台实现一致。
性质：**只验证与评审，未修改任何脚本/产品代码**；发现的问题只给建议补丁文本。

## 0. 结论

- **默认配置（PORT=3300、无 `backend/.env`）下功能可用**：启动→健康检查→首页/前端资源→重复启动拒绝→停止（进程树+PID 文件+端口）全部通过。
- 脚本对当前实现的路径/构建/静态托管/DB 名/PID/日志/健康检查/停止语义**仍然匹配**，没有指向已删除的 legacy 结构（无 `workbench.db`、`/api/dev`、`backend-dev`、5180 等残留引用）。
- 发现 **1 个真实功能缺陷（major）**：`start.cmd` / `stop.cmd` 读不到 `backend/.env` 的 `PORT`（`for /f` 缺 `usebackq`），Windows 上端口被硬编码成 3300；README 宣称的“端口取自 `backend/.env`”在 Windows 不成立，改端口即启动失败。
- 发现 **1 个安全隐患（major，行为已实证）**：`stop.cmd` / `stop.sh` 的“按端口兜底”不做身份校验，会 `taskkill /T /F` 掉任何占用该端口的进程（本次用自建 dummy 监听器实证）。
- 其余为 minor/observation：`node_modules` 只判目录存在、日志被截断（`.cmd`）vs 追加（`.sh`）、PORT 优先级（`.sh`）、`taskkill /F` 导致 WAL/`opencode-serve-*.json` 残留、`health` 只代表后端就绪不代表 opencode 就绪等。

## 1. 环境

| 项 | 值 |
| --- | --- |
| OS / Shell | Windows 10/11 本机，PowerShell 5.1 + `cmd.exe`；WSL 有 `Ubuntu-22.04` |
| Node / npm | v20.20.1 / 10.8.2 |
| opencode | v2.2.5（`E:\applications\nodejs20\node_global\opencode.cmd` → `@opencode\cli\bin\opencode.exe`） |
| 仓库 | `E:\work_space_primeton\ai-dev-workbench` |
| `backend/.env` | **不存在**（`backend/.env.example` 存在，`PORT=3300`、`OPENCODE_PORT=4771`） |
| 数据目录 | `data/requirements.db`（540672B，mtime 2026-11-12 11:50，验证期间未变） |
| 基线数据 | `apps=0`、`app_sessions=0`、`projects/` 0 个条目 |
| 依赖/产物 | `backend/node_modules`、`frontend/node_modules`、`backend/dist/index.js`、`frontend/dist/` 均存在 |
| 起始端口 | 3300 / 4771 无监听；无 `data/workbench.pid` |
| 无关进程（未动） | PID 4320/43644（`d5-e2e` 临时目录的 `npm run dev`/vite）、PID 40800/4684/5644/28204（其它 opencode 会话，父进程 powershell，创建于 09:11–11:17） |

> `backend/.env` 全程未创建、未读取、未打印；仅读取 `backend/.env.example`（无凭据）。

## 2. 静态核对

| # | 检查项 | 结果 | 证据 |
| --- | --- | --- | --- |
| S1 | R4c 后的安装流程（按包目录安装、不用 `npm install --prefix`） | **pass** | `start.cmd:73-88` `pushd backend/frontend` + `call npm install`；`start.sh:81,83` `cd "$target" && npm ci/install --include=dev`；根 `install:all` 为 `cd backend && npm install …`。脚本内无 `install --prefix`（`--prefix` 只出现在根 `build/dev/test/start` 的 `npm run`，属正常用法） |
| S2 | 构建命令（根 `npm run build` 覆盖前后端） | **pass** | `start.cmd:91`、`start.sh:91` 调根 `npm run build` → `backend tsc` + `frontend vite build`；本次实测均成功（vite v6.4.5） |
| S3 | 入口 `backend/dist/index.js` + `WorkingDirectory=backend` | **pass** | `start.cmd:105` `-ArgumentList 'dist/index.js' -WorkingDirectory '%ROOT%\backend'`；实测进程命令行 `"…\node.exe" dist/index.js`，`dotenv` 能找到 `backend/.env`；`start.sh:97-103` `cd "$ROOT/backend"` 后 `node dist/index.js` |
| S4 | 前端静态托管 | **pass** | `backend/src/index.ts:49-55` `express.static(<repo>/frontend/dist)` + SPA 回退；实测 `/` 200、`/assets/index-CeOx2pnn.js` 200（`application/javascript`，679691B） |
| S5 | 数据目录/DB 名（`data/requirements.db`，不是 `workbench.db`） | **pass（脚本不涉及 DB 名）** | `backend/src/db.ts:37` `path.join(dataDir,'requirements.db')`；`config.ts:39` 默认 `<repo>/data`；脚本只用 `data/workbench.pid`、`data/logs/*` |
| S6 | `RG_DATA_DIR` / `RG_PROJECTS_DIR` 默认值 | **pass（观察）** | `config.ts:39-41` 默认 `<repo>/data`、`<repo>/projects`；脚本审计路径固定为 `data/`（PID/日志属脚本自管，可接受）。若自定义 `RG_DATA_DIR`，`data/opencode-serve-*.json` 会跟着 DB 走，`stop.cmd` 的“残留 serve 清理”建议需相应调整（见 O5） |
| S7 | PORT 解析（`backend/.env`，默认 3300） | **fail（Windows）/ pass（Linux）** | `start.cmd:19-27`、`stop.cmd:15-22` 用 `for /f "eol=# tokens=1,* delims==" %%A in ("%ROOT%\backend\.env")` **缺少 `usebackq`** → cmd 把带引号的参数当“字面字符串”而非文件名，永远读不到 `PORT`。实测探针：文件内 `PORT=3999`，当前写法得 `3300`，加 `usebackq` 得 `3999`。另 `start.cmd:19` 先 `set PORT=3300`，进程环境变量 `PORT` 也会被覆盖（实测 `set PORT=3401` 仍打印 `port: 3300`）。`start.sh:23-29`/`stop.sh:16-21` 用 `sed` 读 `.env`，实现正确 |
| S8 | 健康检查语义（后端就绪 vs opencode 就绪） | **pass（观察）** | `index.ts:35-37` `/api/health` 直接返回 200 + `runtime: opencode.status()`；`index.ts:62` `opencode.autoDetect()` 为**非阻塞**（`runtime.ts:271-290`），`serve` 就绪还需 `startTimeoutMs`（默认 60s）。脚本只等后端 200（`start.cmd:117` 60×0.5s，`start.sh:108-121`），**不会等 opencode**。实测 serve 在健康检查后约 0.3s 就绪（`startedAt` 06:14:06.992、事件流 06:14:07.261），未见“等太多/等太少”的实际问题；但“started successfully”不代表 opencode 可用，属可改进项（O1） |
| S9 | 停止：PID 文件树杀 + 过期 PID | **pass** | `stop.cmd:27-42`、`stop.sh:28-47`；实测过期 PID（写入 999999）→ `stale pid file (process 999999 not running)`、退 0、PID 文件删除 |
| S10 | 停止：端口兜底 | **pass（有安全隐患）** | `stop.cmd:44-54`、`stop.sh:49-65`；实测自建 dummy 监听 3300（PID 20952）被 `stop.cmd` 直接 `taskkill /T /F`，端口释放、退 0。**无身份校验**（见 B2） |
| S11 | opencode serve 子进程清理 | **pass** | `stop.cmd:34` `taskkill /PID <pid> /T /F` 杀整棵树，实测 serve（PID 26584/13864）随之退出，4771 无监听；`stop.sh` 先 SIGTERM，后端 `index.ts:65-74` → `opencode.stop()` → `killChild()`（`runtime.ts:518-529`），10s 后强杀进程组兜底 |
| S12 | `data/opencode-serve-*.json` 残留 | **observation** | `runtime.ts:304-324` 写 `data/opencode-serve-<port>.json`；`stop.cmd` 用 `/F` 强杀，后端拿不到 SIGTERM → 文件不删（实测每次停止后留下**已死 PID** 的记录）。下次启动 `reapStaleServe()`（`runtime.ts:336-354`，用 pid+进程名双重校验）会清理，本次实测 `37316 → 26584 → … → 13864` 每次都被正常替换，未出现误杀 |
| S13 | Windows 批处理引号/退出码 | **pass** | 实测：正常启动 `0`；重复启动 `1`（`goto :exit1` 在块外，未复现历史坑）；停止 `0`；`:start_failed` 只用 `!NEW_PID!`，为空时 `taskkill /PID /T /F` 被 `>nul 2>nul` 吞掉，不会误报 |
| S14 | ASCII 提示 | **pass** | `start.cmd`/`stop.cmd` 全部英文提示；中文只出现在后端日志（非批处理） |
| S15 | 重复启动“已在运行” | **pass** | `start.cmd:51-62` 读 PID → `tasklist /FI` 校验 → 退 1；实测输出 `already running (PID 12440). Run stop.cmd first to restart.`，PID/监听未变 |
| S16 | 端口占用预检 | **pass** | `start.cmd:64-70` `netstat | findstr /R ":PORT .*LISTENING"`；`start.sh:50-63` `ss/lsof//dev/tcp` 三级兜底 |
| S17 | `start.sh` / `stop.sh` 换行与语法 | **pass** | 两文件 CRLF 计数 0（LF）；`wsl -d Ubuntu-22.04 bash -n start.sh`、`bash -n stop.sh` 均 `rc=0` |
| S18 | Linux 特有命令是否过期 | **pass（含观察）** | `npm ci --include=dev`、`ss -ltn/lsof`、`setsid nohup`、`/dev/tcp` 均有效；`backend/package-lock.json`、`frontend/package-lock.json` 均存在（`npm ci` 可用）。无 legacy 路径。见 L1/L2 观察 |
| S19 | 脚本对已删除 legacy 的引用 | **pass** | `grep workbench\.db|legacy|5180|backend-dev|api/dev` 于四个脚本：0 命中 |
| S20 | 日志/PID 路径约定 | **pass** | `data/logs/workbench.log`、`data/logs/workbench.error.log`、`data/workbench.pid`，均在 gitignore 的 `data/` 下；与 STATUS「一键启动/停止脚本」一致 |

## 3. 功能验证（本机 Windows）

> 说明：`cmd /c start.cmd 2>&1` 直接管道捕获会**一直挂住**（start.cmd 拉起的 node 存活，无法读到 EOF；`Start-Process -Wait` 也会等后代进程）。这是自动化捕获的问题，不是脚本逻辑错误（双击/交互式终端不受影响），见 O3。为拿到退出码，使用 `%TEMP%` 下的临时 wrapper `.cmd`（`call start.cmd > log`；`echo %RC% > rc`），**未改仓库任何文件**。

| 步骤 | 命令 | 退出码 | 关键输出/结果 |
| --- | --- | --- | --- |
| F0 预检 | `Test-Path data/workbench.pid`；`Get-NetTCPConnection -State Listen` | — | 无 PID 文件；3300/4771 均无监听；无关进程已登记（未动） |
| F1 启动（第 1 次，直接管道） | `cmd /c start.cmd` | 未捕获（管道阻塞；见上） | `port: 3300` → 构建成功（vite v6.4.5，6.44s）→ `process started (PID 12440)` → `started successfully` |
| F2 健康 | `GET /api/health` | 200 | `ok:true`；`runtime.ready:true, starting:false, installed:true, autoStart:true, autoStartAttempted:true, version:"2.2.5", bin:"opencode.exe", streamState:"open", passwordCaptured:true, lastError:null` |
| F3 前端 | `GET /`、`GET /assets/index-CeOx2pnn.js` | 200 / 200 | 首页 2255B；资源 `application/javascript` 679691B |
| F4 进程/端口 | `netstat -ano | findstr :3300`；`Get-Content data/workbench.pid` | — | `0.0.0.0:3300 LISTENING 12440`；PID 文件 `12440`；serve 监听 `127.0.0.1:4771` |
| F5 重复启动 | `cmd /c start.cmd`（wrapper） | **1** | `already running (PID 12440). Run stop.cmd first to restart.`；监听仍为 12440（无重复进程、端口未变） |
| F6 停止 | `cmd /c stop.cmd`（wrapper） | **0**（2.1s） | `stopping process tree (PID 12440)...` / `stopped (PID 12440).` |
| F7 停止后校验 | health / netstat / PID 文件 / 进程 | — | health 连接失败；3300/4771 无 LISTENING（仅 TIME_WAIT 客户端套接字）；PID 文件已删；node 12440、serve 26584 均不存在 |
| F8 再次停止 | `cmd /c stop.cmd` | **0** | `no running workbench process found (port 3300 is free).` |
| F9 过期 PID | 写 `data/workbench.pid=999999` → `cmd /c stop.cmd` | **0** | `stale pid file (process 999999 not running).` + no-process 提示；PID 文件删除 |
| F10 端口兜底（自建 dummy） | 自建 node 监听 3300（PID 20952）→ `cmd /c stop.cmd` | **0** | `port 3300 is held by PID 20952, stopping it...` / `stopped (PID 20952).`；dummy 被杀、端口释放（**证实 B2 的破坏性**） |
| F11 冷启动（wrapper，取退出码） | `call start.cmd > log` + `echo %RC% > rc` | **0** | `started successfully`（PID 33720）；health 200、`runtime.ready:true`、`version 2.2.5`；首页 200、前端资源 200；`data/workbench.pid=33720` |
| F12 非默认端口（无 `.env`，仅环境变量） | `set PORT=3401` + `call start.cmd` | **0** | 仍打印 `port: 3300` 并成功 —— 证明 `start.cmd` 硬覆盖/忽略外部 PORT（B1 连带证据） |
| F13 收尾停止 | `cmd /c stop.cmd` | **0** | `stopped (PID 30224)`；3300/4771 无监听；无残留进程 |

验证期间共 5 次启动、4 次停止，均无 `workbench.error.log` 内容（0 字节），后端日志正常：`后端已启动` / `数据目录` / `应用目录` / `opencode: 127.0.0.1:4771（自动探测/启动）` / `serve 已捕获密码（仅内存）` / `serve 就绪：v2.2.5 port=4771` / `事件流已连接`。

## 4. 问题与风险

### B1（major）Windows 下 `backend/.env` 的 `PORT` 读不到
- 位置：`start.cmd:21-27`、`stop.cmd:17-22`。
- 原因：`for /f ... in ("<file>")` **没有 `usebackq`**；cmd 把引号内容当字面字符串解析（一次迭代 = 路径本身），`%%A` 恒为路径而不是 `PORT`。
- 实证：临时探针文件含 `PORT=3999` → 现有写法结果 `3300`，`usebackq` 写法结果 `3999`。
- 影响链：`backend/src/config.ts:37` 的 `numberEnv(process.env.PORT, 3300)`（dotenv 读取 `backend/.env`）会让后端监听 `.env` 里的端口，而 `start.cmd` 用 3300 做端口预检/健康检查 → 非 3300 配置下 30s 后 `startup failed`、杀掉刚启动的进程、退 1；`stop.cmd` 的端口兜底也会查错端口。默认 3300（含复制 `.env.example` 的默认值）时恰好 “看起来正常”，所以 2026-11-10 的验证没暴露。
- 相关：`start.cmd:19` 先 `set PORT=3300`，进程环境变量 `PORT` 也会被覆盖（实测 F12），即 Windows 上**无法**通过环境变量改端口。

### B2（major，安全隐患）停止脚本的端口兜底不做身份校验
- 位置：`stop.cmd:44-54`、`stop.sh:49-65`。
- 现象：只要 PID 文件缺失/过期且该端口有监听，就 `taskkill /PID … /T /F`（Windows）/ `kill -TERM/-KILL`（Linux），**不确认是不是本工作台**。
- 实证：自建 dummy node 监听 3300 被直接杀掉（F10）。
- 风险：用户在本机跑别的服务占用 3300 且恰好没有 PID 文件时，`stop.cmd` 会误杀无关进程（且是整棵进程树）。
- 触发概率低（正常停止走 PID 文件；`start.cmd` 也会拒绝在 3300 被占时启动），但后果是强杀。

### M1（minor）`start.cmd` 只判断 `node_modules` 目录是否存在
- 位置：`start.cmd:73,81`。而 STATUS 写的是“缺失/不完整时自动安装”，`start.sh:66-86` 用 `node_modules/.bin/tsc|vite` 做哨兵。
- 影响：安装中断（目录存在但缺 `vite`/`tsc`）时 `start.cmd` 直接进构建，报 `'vite' 不是内部或外部命令`——正是 2026-11-10 记录过的失败模式。

### M2（minor）`start.cmd` 截断日志，`start.sh` 追加
- `start.cmd:105` `-RedirectStandardOutput/-RedirectStandardError` 每次启动覆盖 `data/logs/workbench*.log`；`start.sh:99-101` 用 `>>` 追加。跨次启动的历史在 Windows 上丢失（本次实测二次启动后只剩当次日志）。

### M3（minor）`.sh` 的 PORT 优先级与后端不一致
- `start.sh:17,23-28`（`stop.sh:11,16-21`）：先取环境变量，随后 `.env` **覆盖**；`backend/src/config.ts:37` + dotenv 语义是**进程环境变量优先**。两者同时设置且不同时，Linux 脚本会检查错端口。Windows 侧则是 `.env`(失效) 覆盖环境变量（见 B1）。

### M4（minor）强杀导致的运行态残留
- `stop.cmd:34` 恒用 `/T /F`，后端 `SIGTERM` 优雅退出路径（`index.ts:65-74` → `opencode.stop()` → `clearPidFile()`）不会执行：
  - `data/opencode-serve-4771.json` 留下已死 PID（实测每次都有，下次启动 `reapStaleServe` 清理，未出错）；
  - `data/requirements.db-wal` 未 checkpoint（实测 0B → 24752B → 98912B 逐次增大，主库文件 mtime 未变，`apps` 仍为 0；SQLite 会自动恢复，不构成损坏，但 WAL 会持续变大）。
- 建议：停止成功后顺带清理本工作台的 `data/opencode-serve-*.json`；或改为先尝试优雅停止（HTTP/`taskkill` 不带 `/F` 对无窗口 node 无效，故更现实的是接受 `/F` + 清理）。

### L1（minor，Linux）`stop.sh` 非 root 时可能找不到端口占用者
- `stop.sh:52-56`：有 `ss` 时只用 `ss -ltnp` 取 pid；非 root 常拿不到 pid，且**不会**回退到 `lsof` → 报“未发现运行中的工作台进程”但端口仍被占（后端已死、serve 残留的场景）。

### O1（observation）`started successfully` ≠ opencode 就绪
- `/api/health` 在 Express `listen` 后立即可用，`autoDetect()` 异步；实测 serve 约 0.3s 后就绪，但慢机器/首次加载配置时可能 >30s（`OPENCODE_START_TIMEOUT_MS=60000`）。脚本不会等、也不打印 `runtime` 摘要。

### O2（observation）`start.cmd` 的 opencode 警告只看环境变量
- `start.cmd:45-48` 只检查 `where opencode` 与 `%OPENCODE_BIN%`；若把 `OPENCODE_BIN` 写在 `backend/.env`（backend 会读），仍会打印 “opencode not found” 误导。`start.sh:37-39` 已顺带 grep `.env`，两者不一致。

### O3（observation）管道捕获会挂住（自动化场景）
- `cmd /c start.cmd 2>&1` 在脚本退出后仍阻塞（拉起的 node 占着控制台/管道）；`PowerShell Start-Process -Wait` 也会等后代进程。双击/交互式运行无影响。建议文档提示：自动化里用文件重定向（`call start.cmd > log 2>&1`）而不是管道。

### O4（observation）PID 复用的极低概率误判
- `start.cmd:55`、`stop.cmd:31` 用 `tasklist /FI "PID eq X" | findstr X` 判活；PID 恰好被别的进程复用时，`start.cmd` 会误报“已在运行”（`stop.cmd` 则可能误杀该 PID 的进程树）。

### O5（observation）自定义 `RG_DATA_DIR` 与残留 serve 文件位置
- `data/opencode-serve-<port>.json` 写的是 `config.dataDir`（`runtime.ts:304-305`）；`RG_DATA_DIR` 自定义后文件不在 `data/`。当前 `stop.cmd` 不读该文件（靠 `/T` 杀树），所以不影响停止；若采纳 M4 的“清理残留文件”补丁，需要用与后端一致的目录解析。

## 5. 建议补丁（文本，未应用）

### P1 修复 `.env` 的 PORT 解析（B1）
`start.cmd:21-27` 与 `stop.cmd:17-22` 同样修改（加 `usebackq`，并做数字校验）：

```bat
rem Read PORT from backend\.env (same value the backend reads via dotenv)
if exist "%ROOT%\backend\.env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ROOT%\backend\.env") do (
    if /i "%%A"=="PORT" set "PORT=%%B"
  )
  set "PORT=!PORT: =!"
)
echo(!PORT!| findstr /R /C:"^[0-9][0-9]*$" >nul
if errorlevel 1 (
  echo [workbench] ERROR: invalid PORT in backend\.env: !PORT!
  goto :exit1
)
```

并明确优先级（与 dotenv 一致：进程环境变量优先）。`start.cmd` 里把 `set "PORT=3300"` 改成“仅在未设置时给默认值”，再让 `.env` 只填充未设置的端口：

```bat
set "PORT_ENV=!PORT!"
if not defined PORT set "PORT=3300"
rem .env 只在环境变量未设置时生效（dotenv 不覆盖已存在的环境变量）
if exist "%ROOT%\backend\.env" (
  set "ENV_PORT="
  for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ROOT%\backend\.env") do (
    if /i "%%A"=="PORT" set "ENV_PORT=%%B"
  )
  set "ENV_PORT=!ENV_PORT: =!"
  if defined ENV_PORT if not defined PORT_ENV set "PORT=!ENV_PORT!"
)
```

### P2 端口兜底前做身份校验（B2）
`stop.cmd:44-54`：

```bat
rem Fallback: only stop the listener when it is really this workbench's backend
if "!KILLED!"=="0" (
  set "PORT_PID="
  for /f "tokens=5" %%P in ('netstat -ano -p tcp ^| findstr /R /C:":%PORT% .*LISTENING"') do set "PORT_PID=%%P"
  if defined PORT_PID (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Get-CimInstance Win32_Process -Filter 'ProcessId=!PORT_PID!'; if ($p -and $p.Name -eq 'node.exe' -and $p.CommandLine -match 'dist[\\/]index\.js') { exit 0 } else { exit 1 }"
    if errorlevel 1 (
      echo [workbench] WARN: port %PORT% is held by PID !PORT_PID!, which is not this workbench. Not killed.
      echo [workbench] Inspect it with: tasklist /FI "PID eq !PORT_PID!"
      goto :exit1
    )
    echo [workbench] port %PORT% is held by PID !PORT_PID!, stopping it...
    taskkill /PID !PORT_PID! /T /F >nul 2>nul
    set "KILLED=1"
    set "STOPPED_PID=!PORT_PID!"
  )
)
```

`stop.sh:57-64` 对应改成：

```bash
  if [[ -n "$PORT_PID" ]]; then
    if [[ ! -r "/proc/$PORT_PID/cmdline" ]] || ! tr '\0' ' ' < "/proc/$PORT_PID/cmdline" 2>/dev/null | grep -q 'dist/index.js'; then
      log "端口 $PORT 被 PID $PORT_PID 占用，但不是本工作台进程，已跳过（请手工确认）。"
      exit 1
    fi
    log "端口 $PORT 仍被 PID $PORT_PID 占用，正在结束..."
    ...
```

### P3 `start.cmd` 依赖完整性哨兵（M1）
```bat
if not exist "%ROOT%\backend\node_modules\.bin\tsc.cmd" (
  echo [workbench] installing backend dependencies...
  ...
)
if not exist "%ROOT%\frontend\node_modules\.bin\vite.cmd" (
  echo [workbench] installing frontend dependencies...
  ...
)
```

### P4 启动前轮转日志（M2）
`start.cmd` 在 `rem Install dependencies…` 之前加：
```bat
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
if exist "%OUT_LOG%" move /y "%OUT_LOG%" "%OUT_LOG%.prev" >nul 2>nul
if exist "%ERR_LOG%" move /y "%ERR_LOG%" "%ERR_LOG%.prev" >nul 2>nul
```

### P5 `.sh` 的 PORT 优先级对齐 dotenv（M3）
`start.sh:17-28`、`stop.sh:11-21`：
```bash
PORT_FROM_ENV="${PORT:-}"
PORT="${PORT:-3300}"
if [[ -f "$ROOT/backend/.env" && -z "$PORT_FROM_ENV" ]]; then
  ENV_PORT="$(sed -nE 's/^[[:space:]]*PORT[[:space:]]*=[[:space:]]*//p' "$ROOT/backend/.env" | tail -n 1 | tr -d '\r' | sed -E 's/[[:space:]]+$//')"
  ENV_PORT="${ENV_PORT%\"}"; ENV_PORT="${ENV_PORT#\"}"
  ENV_PORT="${ENV_PORT%\'}"; ENV_PORT="${ENV_PORT#\'}"
  if [[ -n "$ENV_PORT" ]]; then PORT="$ENV_PORT"; fi
fi
```

### P6 停止后清理本工作台残留 serve 记录（M4，可选）
`stop.cmd` 在 `if "!KILLED!"=="1"` 且端口已释放后：
```bat
del /q "%ROOT%\data\opencode-serve-*.json" >nul 2>nul
```
（若支持自定义 `RG_DATA_DIR`，应先从 `backend\.env` 解析该目录再删；后端下次启动本来也会 `reapStaleServe`，故此项纯属整洁性。）

### P7 停止后打印运行时摘要 / 等 opencode 就绪（O1，可选）
`start.cmd:117` 之后追加（不阻塞成功判定）：
```bat
powershell -NoProfile -Command "try { $h = Invoke-RestMethod '%HEALTH_URL%'; if ($h.runtime.starting) { Write-Host '  opencode : starting (auto-detect in progress)' } elseif ($h.runtime.ready) { Write-Host ('  opencode : ready v' + $h.runtime.version) } else { Write-Host '  opencode : not ready - check /api/health' } } catch { }"
```

### P8 `stop.sh` 增加 `lsof` 回退（L1）
`stop.sh:52-56` 取到空 pid 时：
```bash
  if [[ -z "$PORT_PID" ]] && command -v lsof >/dev/null 2>&1; then
    PORT_PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  fi
```

### P9 `start.cmd` 的 OPENCODE_BIN 判断补 `.env`（O2，可选）
```bat
where opencode >nul 2>nul
if errorlevel 1 (
  if not defined OPENCODE_BIN (
    findstr /I /R /C:"^[ ]*OPENCODE_BIN[ ]*=" "%ROOT%\backend\.env" >nul 2>nul
    if errorlevel 1 echo [workbench] WARN: opencode not found in PATH; requirements/design/dev sessions will be unavailable until installed or OPENCODE_BIN is set.
  )
)
```

### P10 文档补一句自动化提示（O3，可选）
README「一键启动/停止」加：自动化里请用文件重定向（`call start.cmd > log 2>&1`），不要用管道/`Start-Process -Wait`，否则会等待后台 node 退出。

## 6. 数据未污染

| 项 | 验证前 | 验证后 |
| --- | --- | --- |
| `apps` | 0 | **0** |
| `app_sessions` | 0 | **0** |
| `app_settings` | — | 0 |
| `requirement_templates` / `prototype_templates` | — | 4 / 2（内置 seed，未重复插入） |
| `projects/` | 0 条目 | **0 条目** |
| `data/requirements.db` | 540672B，mtime 11:50 | 同（mtime 未变） |
| `data/requirements.db-wal` | 0B | 98912B（启动期 bootstrap 写入 + 强杀未 checkpoint；SQLite 自动恢复，下次启动会继续使用；不是应用数据） |
| `data/opencode-serve-4771.json` | `{pid:37316}`（旧残留） | `{pid:13864,…}`（本次最后一个 serve，已退出；下次启动自动清理） |
| `data/logs/*` | 旧日志（2026-11-10） | 被本次启动覆盖（M2） |
| `data/workbench.pid` | 不存在 | **不存在**（停止后删除） |

未创建应用、未读写 `backend/.env`、未打印任何凭据（`workbench.log` 内仅有“密码已捕获（仅内存保存）”提示）。

## 7. 未验证 / 不在范围

- **依赖安装分支未触发**：未删除 `node_modules`（避免联网安装）；`start.cmd:73-88`、`start.sh:66-88` 只做静态核对。
- **Linux 端到端未执行**（按要求）：仅 `bash -n`（WSL Ubuntu 22.04，`rc=0`）与命令/路径静态核对。
- **非默认 PORT 的端到端失败未实测**：不应创建 `backend/.env`；B1 由“临时探针证明 `.env` 解析失效 + `config.ts` 证明后端读 `.env`”两点闭合。
- 未验证真实 opencode 会话/需求/设计/开发功能（与本次脚本验证无关）。
- 仓库无 git，无法给出 diff 证明“只改了 build 产物”；实际只写入 `backend/dist`、`frontend/dist`（脚本自身构建）与 `data/` 运行态文件。

## 8. 收尾状态

- 3300、4771 均无 LISTENING（`Get-NetTCPConnection -State Listen` 计数 0）。
- 无 `data/workbench.pid`；无任何 `node.exe`/`opencode.exe`/`cmd.exe` 进程的命令行包含 `ai-dev-workbench`。
- 无关进程未被影响：4320、43644（`d5-e2e` dev/vite）与 40800、4684、5644、28204（其它 opencode 会话）仍在。
- 临时 wrapper/日志均在 `%TEMP%`，未落仓库。

## 9. 修复结果（2026-11-12）

> 交接单要求新增“## 6. 修复结果（2026-11-12）”，但本文 §6 已被「数据未污染」占用，故按顺序追加为 §9（未改动既有章节编号）。

范围：**只改脚本** `start.cmd`、`stop.cmd`、`stop.sh`，外加 `README.md` 一句端口优先级说明；未改后端/前端/接口/表/测试；未创建或提交 `backend/.env`（仅在测试期写入临时文件并在结束前删除）。

### 9.1 B1 修复（Windows `backend/.env` 的 PORT）

`start.cmd`、`stop.cmd` 的 `.env` 读取全部替换为：

```bat
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ROOT%\backend\.env") do (
  set "ENV_KEY=%%A"
  set "ENV_KEY=!ENV_KEY: =!"
  if /i "!ENV_KEY:~0,6!"=="export" set "ENV_KEY=!ENV_KEY:~6!"
  if "!ENV_KEY!"=="PORT" set "ENV_VAL=%%B"
)
```

- `usebackq` 必填：没有它 cmd 把带引号的路径当字面字符串，永远读不到文件（原 B1 根因）。
- 值处理：去空格 → 去掉 `"`/`'` → 按 `#` 截断内联注释；支持 `export PORT=` 前缀；**key 大小写敏感**（`port=` 被忽略，与 dotenv 一致）。
- 优先级：`PORT_FROM_SHELL`（进程环境变量）→ `PORT_FROM_FILE`（`backend/.env`）→ `3300`，顺序赋值，最后生效者优先，与 dotenv“已有环境变量不覆盖”一致。旧的 `set "PORT=3300"` 无条件覆盖已删除。
- 端口校验：`for /f "delims=0123456789"` 做纯数字扫描（不把值拼进命令行）+ 拒绝前导零/0 + 长度 ≤ 5 + `GTR 65535` 上界。
  - `start.cmd`：不合法 → 打印 `invalid PORT "<值>" - must be an integer in 1..65535 (no leading zeros)` 并在构建/启动前 `exit /b 1`。
  - `stop.cmd`：不合法 → 打印 warning，`PORT_OK=0`，**仍按 PID 文件停止**，只跳过端口兜底（以及停止后的端口复检）。
- 说明：该校验比后端 `numberEnv()` 更严（后端对非法值静默回退 3300），目的是避免“脚本查 3300、后端听别的端口”的错位；代价是 `PORT=03300` 这类前导零写法会被要求改。

### 9.2 B2 修复（停止前身份校验）

- `stop.cmd`：新增 `Get-CimInstance Win32_Process` 校验，要求 `Name -eq 'node.exe'` 且 `CommandLine -match 'dist[\\/]index\.js'`；**PID 文件路径与端口兜底都先校验**。
  - PID 文件指向非本工作台 → `WARN: pid file points to PID <pid>, which is not this workbench. Not killed.` → 删除该 PID 文件 → 继续端口兜底（兜底同样校验）。
  - 端口被非本工作台占用 → `WARN: port <p> is held by PID <pid>, which is not this workbench. Not killed.` + `tasklist` 提示 → `exit /b 1`，不 kill。
  - `taskkill` 在全文只剩 2 处（`stop.cmd:83`、`stop.cmd:112`），都在身份校验通过之后；两个拒绝分支不含任何 kill。
- `stop.sh`：新增 `is_workbench()`：`/proc/<pid>/cmdline` 含 `dist/index.js` **且** `readlink /proc/<pid>/cwd` 等于 `$ROOT/backend`；cwd 不可读时拒绝强杀。
  - PID 文件不符 → 提示“PID 文件指向的进程（PID x）不是本工作台，未结束；请手工确认。”→ 删除 PID 文件、继续端口兜底。
  - 端口兜底不符 → 提示“端口 p 被 PID x 占用，但不是本工作台进程，未结束；请手工确认。”→ `exit 1`。
- 正常路径不变：Windows PID 文件 `taskkill /PID .. /T /F`（连带 opencode serve）；Linux 先 `SIGTERM`、10s 后 `SIGKILL`（含进程组）；端口释放与“无进程 → 0 / 重复停止 → 0”语义不变。

### 9.3 静态核对（实跑）

| # | 检查 | 结果 |
| --- | --- | --- |
| S1 | `start.cmd`/`stop.cmd` 的 `.env` 读取含 `usebackq` | pass（`start.cmd:31`、`stop.cmd:28`） |
| S2 | 优先级/校验逻辑存在（`PORT_FROM_SHELL`/`PORT_FROM_FILE`/digits/`GTR 65535`） | pass（`start.cmd:21-63`、`stop.cmd:19-65`） |
| S3 | `stop.cmd` PID 文件与端口兜底都有身份校验 | pass（`stop.cmd:79`、`stop.cmd:104`） |
| S4 | 拒绝分支不调用 kill | pass（`taskkill` 仅 `stop.cmd:83`、`stop.cmd:112`，均在 `IS_WB=1` 之后；端口不符分支 `goto :exit1` 在 taskkill 之前） |
| S5 | `stop.sh` 两条路径都有身份校验 | pass（`stop.sh:29-37`，调用点 `:46`、`:77`） |
| S6 | `bash -n` | pass（`start.sh` rc=0、`stop.sh` rc=0，WSL Ubuntu-22.04） |
| S7 | `.sh` 换行 | pass（`start.sh`/`stop.sh` CRLF=0，LF；`file` 识别为 UTF-8 bash 脚本） |
| S8 | 四个脚本无 legacy 残留（`workbench.db`/`legacy`/`5180`/`backend-dev`/`api/dev`） | pass（0 命中） |
| S9 | `.cmd` 提示仍为 ASCII、语法可运行 | pass（`cmd /c` 实跑全流程） |

### 9.4 功能验证（Windows，实跑，最终脚本）

起点：无 `backend/.env`、无 `data/workbench.pid`、3300/3459/3460/3462/3463/4771 无监听；`apps=0`、`app_sessions=0`、`projects/` 空；无关进程 4320/43644（`d5-e2e`）在册。退出码用 `%TEMP%` 下 wrapper（`call start.cmd > log` + `exit /b %errorlevel%`）取得，未改仓库文件。

| # | 场景 | 命令 | 结果 |
| --- | --- | --- | --- |
| F1 | 默认启动 | `start.cmd` | **rc=0**；`port: 3300`；`started successfully`；PID 文件 22776；`:::3300` 监听 22776、`127.0.0.1:4771` 监听 47116 |
| F2 | 健康/首页 | `GET :3300/api/health`、`GET :3300/` | **200 / 200**（首页 2345B）；初次 200 时 `runtime.ready=false`，约 0.5s 后 `ready=true version=2.2.5`（O1 未变） |
| F3 | 重复启动 | `start.cmd` | **rc=1**；`already running (PID 22776)`；3300 仍只有 22776 |
| F4 | 停止 | `stop.cmd` | **rc=0**（1.8s）；`stopping process tree (PID 22776)` / `stopped`；PID 文件删除；3300/4771 均无监听；22776 与 serve 47116 均已退出 |
| F5 | 再次停止 | `stop.cmd` | **rc=0**；`no running workbench process found (port 3300 is free).` |
| F6 | B1 `.env` | 临时 `backend/.env`=`PORT=3459` → `start.cmd` | **rc=0**；`port: 3459`；`health :3459` **200**、`:3300` 不可达；PID 11648；`stop.cmd` **rc=0**，3459/4771 释放；`.env` 删除 |
| F7 | B1 环境变量 | `PORT=3460`（无 `.env`）→ `start.cmd` | **rc=0**；`port: 3460`；`health :3460` **200**；`stop.cmd` **rc=0** |
| F8 | B1 优先级 | `.env`=`PORT=3459` + 环境变量 `PORT=3460` | **rc=0**；`port: 3460`；`:3460` **200**、`:3459` 不可达（环境变量优先，与 dotenv 一致）；`stop.cmd` **rc=0** |
| F9 | B1 非法 `.env` | `.env`=`PORT=abc` → `start.cmd` | **rc=1**（0.1s，未构建/未启动）；打印 invalid PORT 提示；无 PID 文件、无监听 |
| F10 | B1 非法时仍能停 | 先按 F6 启动，再把 `.env` 改成 `PORT=abc` → `stop.cmd` | **rc=0**；warning + `stopping process tree (PID 30604)` + `stopped`；PID 文件删除、端口释放（端口兜底被跳过） |
| F11 | B1 非法环境变量 | `PORT=abc` / `70000` / `0` / `3459abc` | 4 次均 **rc=1**，提示一致，均未启动 |
| F12 | B2 端口兜底安全 | `.env`=`PORT=3462`；dummy `node dummy-listen.cjs 3462`（PID 5872，无 PID 文件）→ `stop.cmd` | **rc=1**；`WARN: port 3462 is held by PID 5872, which is not this workbench. Not killed.`；dummy 存活、3462 仍在监听 |
| F13 | B2 正常兜底 | 启动（3462，PID 9920）→ 删除 `data/workbench.pid` → `stop.cmd` | **rc=0**；`port 3462 is held by PID 9920, stopping it...` / `stopped`；3462/4771 释放（本工作台可识别） |
| F14 | B2 PID 文件身份（node） | 无关 node（`dummy-listen.cjs`，PID 38020）PID 写入 `data/workbench.pid` → `stop.cmd` | **rc=0**；`WARN: pid file points to PID 38020, which is not this workbench. Not killed.`；该进程存活；PID 文件删除 |
| F15 | B2 PID 文件身份（非 node） | 无关 `powershell -Command Start-Sleep 300`（PID 29656）同上 | **rc=0**；同样 warning；该进程存活；PID 文件删除 |
| F16 | 过期 PID | `data/workbench.pid`=999999 → `stop.cmd` | **rc=0**；`stale pid file (process 999999 not running).`；PID 文件删除 |
| F17 | `.env` 解析矩阵 | 用 `stop.cmd`（端口空闲时打印解析结果）逐项验证 | `PORT=3459`→3459；`PORT = "3460"`→3460；`PORT=3462 # note`→3462；`export PORT=3463`→3463；`port=3464`→**3300**（大小写敏感）；`OTHER=1`+`PORT=3465`→3465；`PORT='3466'`→3466；`PORT=`→3300；`#PORT=9999`→3300；`PORT`（无 `=`）→3300；重复行→最后一行 3460 |

### 9.5 Linux（WSL Ubuntu 22.04，仅停止脚本身份校验）

`/mnt/e` 下直接跑 `stop.sh`（未跑真实 Linux 工作台；数据未触碰）：

| # | 场景 | 结果 |
| --- | --- | --- |
| L1 | `data/workbench.pid` → `sleep 300`（PID 348） | **rc=0**；“PID 文件指向的进程（PID 348）不是本工作台，未结束”；sleep 存活；PID 文件删除 |
| L2 | 端口 3490 被 `python3 -m http.server`（PID 379）占用、无 PID 文件、`PORT=3490` | **rc=1**；“端口 3490 被 PID 379 占用，但不是本工作台进程，未结束”；dummy 存活 |
| L3 | `data/workbench.pid` → `node <stub> dist/index.js`，cwd=`$ROOT/backend`（PID 419，身份匹配） | **rc=0**；`停止工作台进程（PID 419）` / `已停止`；进程退出；PID 文件删除（正面路径未被误拒） |
| L4 | 无 PID 文件、端口空闲 | **rc=0**；“未发现运行中的工作台进程” |

### 9.6 收尾状态（本次实测）

| 项 | 结果 |
| --- | --- |
| 3300 / 3459 / 3460 / 3462 / 3463 / 4771 | 监听数均为 **0** |
| `data/workbench.pid` | **不存在** |
| `backend/.env` | **不存在**（测试期临时文件均删除） |
| `apps` / `app_sessions` / `app_settings` | **0 / 0 / 0** |
| `projects/` | **0 条目** |
| 无关进程 | 4320、43644（`d5-e2e`）与 40800/4684/5644/28204（其它 opencode 会话）均未被影响 |
| 测试进程 | dummy/stub 全部由手工/脚本清理，无残留 |
| `data/opencode-serve-4771.json` | 仍为已退出 serve 的记录（如 `{"pid":31128,...}`），属 M4 范围，未改 |

### 9.7 未验证 / 新发现

- **Linux 真实工作台启停未执行**：只验证了 `stop.sh` 的拒绝路径（L1/L2）与身份匹配路径（L3，用 stub 进程模拟 `node dist/index.js` + `backend` cwd）；真实 `start.sh` → `stop.sh` 端到端仍需 Linux 环境。
- **`start.cmd` 依赖安装分支**（M1）未触发，未删除 `node_modules`。
- **opencode 就绪仍不等**（O1）：`started successfully` 之后 `runtime.ready` 可能还是 false，需继续轮询 `/api/health`（本次约 0.5s 后才 `ready=true`）。
- **M1/M2/M3/O3 未修**；**M4**（强杀导致 `opencode-serve-*.json` 残留、WAL 未 checkpoint）仍在。
- 新发现（非阻塞）：
  - 端口校验比后端更严：`PORT=03300`（前导零）在两个 `.cmd` 中会被判非法并拒绝启动，而后端 `numberEnv()` 会接受；提示信息已写明 `(no leading zeros)`，属有意收紧。
  - `.env` 中 `port=`（小写）现在被忽略（与 dotenv 一致）；旧代码用 `if /i` 比较，但因当时根本没读到文件，实际未生效。
  - `stop.cmd` 每次停止多花约 0.1–0.3s（一次 PowerShell `Get-CimInstance` 身份校验），Windows 实测停止总耗时仍 ~1.8s。

