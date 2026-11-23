# P12 实施单：启动脚本构建可见化 + 一键 restart（2026-11-20）

> 用户反馈：希望启动脚本自动编译前后端，不用每次手动执行多条命令。
> 现状核对：`start.cmd` / `start.sh` **已经**每次启动执行构建（`npm run build` = backend tsc + frontend vite）；但：
> 1. 已在运行时 start 直接退出（不重建），用户需先 stop 再 start；
> 2. 构建只打印一行“building backend and frontend”，失败时不区分前后端；
> 3. 没有一键“停止 + 重建 + 启动”。
> 本单只改启动/停止脚本与 README；不改业务代码、不启停真实 3300。

---

## 0. 出口标准

1. `start.cmd` / `start.sh` 仍**每次启动必构建**，但拆成明确两步：
   - `构建后端（tsc）…` → `npm run build`（backend）
   - `构建前端（vite）…` → `npm run build`（frontend）
   - 任一步失败立即退出，并打印是后端还是前端失败。
2. 新增一键 `restart.cmd` / `restart.sh`：
   - 先调用 `stop.cmd`/`stop.sh`（失败则中止），再调用 `start.cmd`/`start.sh`（含构建）；
   - 一条命令完成“停止旧实例 → 重建前后端 → 启动 → 健康检查”。
3. 启动脚本发现“已在运行”时，提示改为：
   - `工作台已在运行（PID x）。要重建并重启请运行 restart.cmd（或先 stop.cmd 再 start.cmd）。`
4. README「一键启动/停止」补充：
   - `start` 每次都会构建前后端（不需要手动 npm run build）；
   - 已运行时请用 `restart`；
   - 前端静态资源虽即时生效，但源码改动仍需 restart 构建；后端改动必须 restart。
5. 不改变端口/PID/健康检查/依赖安装/防重复启动逻辑；不改 `backend/src/**`、`frontend/src/**`。

---

## 1. 改动

### 1.1 `start.cmd`

- 把现有：
  ```bat
  echo [workbench] building backend and frontend...
  call npm run build
  if errorlevel 1 goto :fail
  ```
  改为：
  ```bat
  echo [workbench] building backend (tsc)...
  call npm run build --prefix backend
  if errorlevel 1 (
    echo [workbench] ERROR: backend build failed.
    goto :fail
  )
  echo [workbench] building frontend (vite)...
  call npm run build --prefix frontend
  if errorlevel 1 (
    echo [workbench] ERROR: frontend build failed.
    goto :fail
  )
  ```
- 已在运行提示改为建议 `restart.cmd`（见 §0.3）。
- 保持：依赖缺失安装、PORT 解析、端口占用检查、PID、健康检查、失败清理。

### 1.2 `start.sh`

- 把 `npm run build` 拆为：
  ```bash
  log "构建后端（tsc）..."
  npm run build --prefix backend
  log "构建前端（vite）..."
  npm run build --prefix frontend
  ```
  （`set -e` 下任一步失败即退出；可在前后加 `|| fail "后端构建失败"` 更明确。）
- 已在运行提示加 `./restart.sh`。
- 其余不变。

### 1.3 新增 `restart.cmd`

```bat
@echo off
setlocal
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

echo [workbench] restart: stop -> build -> start
call "%ROOT%\stop.cmd"
if errorlevel 1 (
  echo [workbench] ERROR: stop failed; abort restart.
  endlocal & exit /b 1
)
call "%ROOT%\start.cmd"
set "RC=%errorlevel%"
endlocal & exit /b %RC%
```

- 注意：`stop.cmd` 在“未发现进程”时返回 0；在“端口被非本工作台占用”时返回 1，restart 应中止。
- 不额外杀进程、不改 PID 逻辑。

### 1.4 新增 `restart.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
printf '[workbench] restart: stop -> build -> start\n'
"$ROOT/stop.sh"
exec "$ROOT/start.sh"
```

- 赋予可执行权限（若仓库中已有脚本权限约定；不要做 git 操作）。

### 1.5 README

- 「一键启动 / 停止」补：
  - `start.cmd|start.sh`：每次启动都会构建前后端（无需手动 `npm run build`）。
  - `restart.cmd|restart.sh`：停止旧实例 → 重建前后端 → 启动 → 健康检查（推荐用于更新代码后）。
  - 已在运行时 `start` 会提示；前端 dist 虽静态托管即时生效，但源码改动仍需 restart 构建；后端改动必须 restart。
- 保持“PID 在 data/workbench.pid / 日志在 data/logs/”说明。

### 1.6 文档

- `docs/STATUS.md` 新增 P12 短节（启动脚本现状/restart/验证）。
- `docs/plans/README.md` 加本实施单。
- 不需要改 AGENTS（工作方式未变）；如需一句“改代码后用 restart 构建”可加到 README 即可。

---

## 2. 验证（不启停真实 3300）

- 静态/构建验证：
  - `npm run build`（根）通过（确认后端+前端构建命令有效；会更新 dist，不重启 3300）。
  - `bash -n start.sh`、`bash -n restart.sh`（Linux 语法）。
  - Windows：不执行 `start.cmd`/`restart.cmd`（会停/起真实 3300）；只做语法/内容审查（`cmd /c` 不运行完整脚本）。
- 检查：
  - `start.cmd`/`start.sh` 均包含两步构建与失败分支；
  - `restart` 先 stop 后 start，stop 失败中止；
  - 已在运行提示包含 `restart`；
  - README 说明与脚本一致。
- 不跑 e2e/不调模型；不改业务代码。

---

## 3. 边界

- 只改：`start.cmd`、`start.sh`、`stop.cmd`（如提示文案需要）、`stop.sh`（如提示文案）、新增 `restart.cmd`/`restart.sh`、`README.md`、`docs/STATUS.md`、`docs/plans/README.md`。
- 不改：`package.json` 的 build 脚本（已正确）、`backend/src/**`、`frontend/src/**`、DB/表、templates。
- 不启停真实 3300/4771；不读写真实 `data/`、`projects/`、`.env`；不做 git；不调模型。
- 注意：`start.cmd` 的 PID/日志路径是仓库 `data/`；验证时不要执行完整 start，避免覆盖真实 `data/workbench.pid`。

---

## 4. 收尾

- 本实施单末尾追加「实施结果（2026-11-20）」：改动文件、验证命令/结果、偏差、未验证、环境确认。
- 回报：start 是否每次构建、restart 行为、README 更新、未执行真实 start、环境确认。

---

## 实施结果（2026-11-20）

改动文件：

| 文件 | 改动 |
| --- | --- |
| `start.cmd` | 构建拆两步（`npm run build --prefix backend` / `--prefix frontend`），失败分别打印 `backend build failed (tsc)` / `frontend build failed (vite)` 后 `goto :fail`；已在运行提示改为 `Run restart.cmd to rebuild and restart (or stop.cmd then start.cmd).`；其余逻辑（依赖安装/PORT/端口占用/PID/健康检查/失败清理）未动 |
| `start.sh` | 构建拆两步（`npm run build --prefix backend \|\| fail "后端构建失败（tsc），已中止"`、`--prefix frontend`）；已在运行提示改为 `./restart.sh（或先 ./stop.sh 再 ./start.sh）` |
| `restart.cmd`（新增） | `call stop.cmd` → `errorlevel 1` 打印 `stop failed; abort restart` 并 `exit /b 1`；否则 `call start.cmd`（含两步构建 + 健康检查）并透传退出码；不额外杀进程、不改 PID |
| `restart.sh`（新增） | `stop.sh` → `exec start.sh`；`set -euo pipefail` 下 stop 失败即中止 |
| `README.md` | 「一键启动 / 停止」：新增 `restart.cmd` / `restart.sh`，Linux `chmod +x start.sh stop.sh restart.sh`；说明 start 每次构建后端+前端（失败指明哪端）、更新代码用 restart、`frontend/dist` 静态托管刷新即生效但源码改动仍需 restart、后端改动必须 restart |
| `docs/STATUS.md` | 顶部状态补 P12；新增「P12 实施（2026-11-20）」短节（改动/验证/偏差/未验证） |
| `docs/plans/README.md` | 索引加本实施单，标题行补 P12 |

验证（实跑）：

| 命令 | 结果 |
| --- | --- |
| `npm run build`（根） | 通过：后端 `tsc -p tsconfig.json` 成功；前端 `vite build` 2818 modules，`✓ built in 30.37s`（会更新 `backend/dist`、`frontend/dist`，未重启 3300） |
| `bash -n start.sh` / `bash -n restart.sh` / `bash -n stop.sh` | 均通过 |
| 静态审查 `start.cmd` / `restart.cmd` | 含两步构建 + 各自失败分支；restart 先 stop、stop 失败中止；已在运行提示含 restart |
| 行尾/编码 | 6 个脚本均为 LF、无 BOM（与仓库其余脚本一致） |

结论：

- **start 仍然每次启动必构建**，但现在分「后端（tsc）」「前端（vite）」两步，失败能指明是哪一端。
- **restart 行为**：`stop`（失败即中止）→ `start`（构建后端 → 构建前端 → 启动 → 健康检查）；一条命令完成“停止旧实例 → 重建 → 启动”。stop 在“未发现进程”时返回 0，因此未运行时也可直接 restart。
- **未执行真实 `start.cmd` / `restart.cmd` / `start.sh` / `restart.sh` 完整流程**（避免停/起真实 3300 与覆盖真实 `data/workbench.pid`）。

偏差：

1. 构建失败仍落到原 `goto :fail` / `fail`，`start.cmd` 会多打印一行通用 “dependency install or build failed”，但其前已有明确的前端/后端错误行。
2. `restart.sh` 未设置 git 可执行位（不做 git 操作），README 已注明 `chmod +x restart.sh`。
3. 验证用根 `npm run build` 重建了 `backend/dist`（含 P11 的 `/design-preview.html` 显式路由与文案）；真实 3300 仍是 13:10 启动的旧进程，**需用户自行 restart 才生效**。
4. 未改 `package.json` build 脚本、`backend/src/**`、`frontend/src/**`、DB、templates；未新增依赖、未 npm install。

未验证：真实 3300 上的 restart 端到端（耗时、日志、健康检查、opencode serve 子进程回收）；Windows 交互式 cmd 下 `call` 链的实际退出码透传（只做静态审查）；Linux 下 `restart.sh` 的实际 stop/start 串联（只做 `bash -n`）。

环境确认：Node 20.20.1 / npm 10.8.2；未启停真实 3300/4771；未读写真实 `data/`、`projects/`、`.env`；未调模型；未做 git。
