# 启动/停止脚本修复交接单（B1+B2）

日期：2026-11-12
用途：新开实施会话执行；主会话评审。
上游：`docs/plans/2026-11-12-start-stop-script-verification.md`（问题/证据/建议补丁）。
状态：**已实施（2026-11-12，见 §6）**。
范围：**只修脚本**——`start.cmd`、`stop.cmd`、`stop.sh`（必要时 README 一句说明）+ 验证/文档。**不改工作台产品代码/接口/表**；不引入新的依赖或安装流程。

---

## 1. 要修的两个 major

### B1 Windows 读不到 `backend/.env` 的 `PORT`
- 现状：`start.cmd`/`stop.cmd` 用 `for /f ... in ("<file>")`，缺 `usebackq`，把路径当字符串；`PORT` 永远回退 3300；同时 `start.cmd` 先 `set PORT=3300` 覆盖外部环境变量。
- 要求：
  1. 读取 `.env` 必须用 `usebackq`；去掉值两端空格与成对引号。
  2. **优先级与 dotenv 一致**：进程环境变量 `PORT` > `backend/.env` 的 `PORT` > 默认 `3300`。
  3. 端口校验：必须是 `1—65535` 的整数（至少 `^[0-9]+$` 且 1..65535）。
  4. `start.cmd`：非法/越界 → 打印明确错误并在构建/启动前 `exit 1`。
  5. `stop.cmd`：非法/越界 → 打印 warning，**仍先按 PID 文件停止**；端口兜底跳过（不要因端口非法而拒绝停止）。
  6. 不创建/提交 `backend/.env`；测试可用临时 `.env`（只写 `PORT=...`）并在结束时删除，确保仓库最终无 `.env`。
  7. 外部环境变量 `PORT` 仍应生效（修复后实测：`set PORT=3401` → 打印/监听 3401）。
- `.sh` 的 PORT 读取已正确，B1 本轮不改 `.sh` 优先级（M3 不在范围）。

### B2 停止脚本端口兜底误杀无关进程
- 现状：`stop.cmd`/`stop.sh` 在 PID 文件缺失/过期时，按端口找 PID 直接强杀，无身份校验。
- 要求（**两个脚本都改**）：
  1. **PID 文件路径**也做身份校验，避免 PID 复用误杀：
     - Windows：`Get-CimInstance Win32_Process` 查 PID，要求 `Name` 为 `node.exe` 且 `CommandLine` 匹配 `dist[\\/]index\.js`。
     - Linux：`/proc/<pid>/cmdline` 含 `dist/index.js`，且（可读时）`readlink /proc/<pid>/cwd` 等于 `$ROOT/backend`；不可读则拒绝强杀并提示。
     - 身份不符：提示“PID 文件指向非本工作台进程”，删除过期 PID 文件，不杀；继续走端口兜底（端口兜底同样校验）。
  2. **端口兜底**：同样身份校验通过才杀；不符 → 打印 `port <p> is held by PID <pid>, which is not this workbench. Not killed.`（中文脚本对应中文），`exit 1`，不 kill。
  3. 正常本工作台路径行为不变：PID 文件树杀（Windows `/T /F`，Linux 先 TERM 再 KILL）、opencode serve 子进程清理、端口释放。
  4. 不依赖新增工具（Windows 只用 PowerShell 内置；Linux 只用 coreutils/`/proc`；`ss`/`lsof` 保持现状）。
  5. 身份校验失败不得误删/误改其它进程；可以删除本工作台的过期 PID 文件。

---

## 2. 实施约束

- 只改 `start.cmd`、`stop.cmd`、`stop.sh`；`start.sh` 仅在需要与 B2 对齐时改（B2 要求改 stop.sh）；不动后端/前端代码。
- 保持 `.cmd` 提示 ASCII；`.sh` 保持 LF 与 `bash -n` 通过。
- 保持现有退出码语义：启动成功 0、重复启动 1、启动失败 1；停止成功/无进程 0；**检测到非本工作台端口占用 1**（安全拒绝）。
- 不读取/打印 `backend/.env` 其它内容或真实凭据；测试写入的临时 `.env` 只含 `PORT`。
- 不污染真实 `data/`/`projects/`（apps=0、projects 空）；不创建应用。
- 不改 README 的既有启动方式；如需要，只补一句“非 3300 端口请同时确认 `backend/.env`/环境变量 PORT 已生效”或安全提示。

## 3. 验证（必须实跑）

### 3.1 静态
- `start.cmd`/`stop.cmd` 中 `.env` 读取使用 `usebackq`；PORT 优先级/校验逻辑存在。
- `stop.cmd`/`stop.sh` 的 PID 文件与端口兜底都有身份校验；错误路径不调用 kill/taskkill。
- `wsl -d Ubuntu-22.04 bash -n stop.sh`（及 `start.sh` 若改）通过；`.sh` LF。
- 确认四个脚本无 `workbench.db`/`legacy`/旧端口等残留引用。

### 3.2 Windows 功能
先确保无工作台实例/PID/3300 监听；测试期间不得杀无关进程。

1. **默认启动/停止**：`start.cmd` → 0；health 200、首页 200、PID 文件、opencode 2.2.5；重复 `start.cmd` → 1（无重复进程）；`stop.cmd` → 0，3300/4771 释放、PID 删除；再次 `stop.cmd` → 0。
2. **B1 `.env`**：临时创建 `backend/.env` 仅一行 `PORT=3459`（无其它内容）→ `start.cmd` 打印 `port: 3459`、health 3459 200、PID 正常；`stop.cmd` 停止 3459；删除 `.env`。
3. **B1 环境变量优先**：`set PORT=3460`（无 `.env`）→ `start.cmd` 使用 3460；停止后清理该环境变量。
4. **B1 非法端口**：临时 `.env` 写 `PORT=abc` → `start.cmd` 退出 1 且不启动；`stop.cmd` 不应误杀（无进程时退 0、有 PID 时仍按 PID 停止）；删除 `.env`。
5. **B2 端口兜底安全**：临时 `.env` 写 `PORT=3462`；用 node 起一个 dummy 监听 3462（无 PID 文件）；`stop.cmd` → **退出 1**、打印非本工作台、dummy 仍存活；手工结束 dummy；删除 `.env`。
6. **B2 正常兜底仍可用**：无 PID 文件但本工作台在运行（可启动后删 PID 文件模拟）→ `stop.cmd` 能识别本工作台并停止（不要用 dummy 反向验证）。
7. **B2 PID 文件身份**：写一个无关存活进程的 PID 到 `data/workbench.pid` → `stop.cmd` 不杀该进程、提示身份不符、删除 PID 文件；随后清理。
8. 每次测试后确认 3300/3459/3460/3462/4771 无监听、无残留 PID；真实数据 `apps=0`、`app_sessions=0`、`projects/` 空；`backend/.env` 不存在。

### 3.3 Linux（静态/尽力）
- `bash -n`、LF；如 WSL 可安全运行，可只测 `stop.sh` 对 dummy 监听（本工作台身份不符）拒绝强杀；不要求完整 Linux 启停。若无法隔离测试，记录未验证。

## 4. 文档与回传

1. 更新 `docs/plans/2026-11-12-start-stop-script-verification.md`：新增 `## 6. 修复结果（2026-11-12）`，写明 B1/B2 修复、测试命令/退出码、未验证项。
2. 更新 `docs/STATUS.md`「一键启动/停止脚本」小节：新增 2026-11-12 修复说明（B1/B2 + 验证结果）；不改其它章节。
3. 不改 `AGENTS.md`（主会话评审后更新）。
4. 最终回复：改动文件、关键 diff 摘要、实测退出码/端口/PID、未验证项、是否还发现新问题。

## 5. 不做

- 不修 M1（node_modules 完整性）、M2（日志追加）、M3（.sh PORT 优先级）、M4（opencode json/WAL 清理）、O1（等待 opencode 就绪）、O3（管道捕获）——留待后续。
- 不改后端优雅退出/信号处理；不新增脚本依赖；不做工作台产品逻辑变更。

## 6. 实施结果

状态：**已完成**（B1 + B2）；验证见 `docs/plans/2026-11-12-start-stop-script-verification.md`「9. 修复结果（2026-11-12）」。

### 6.1 改动文件

| 文件 | 改动 |
| --- | --- |
| `start.cmd` | B1：`usebackq` 读 `.env`、dotenv 优先级、端口校验（构建前 `exit 1`） |
| `stop.cmd` | B1：同上（仅告警 + 禁用端口兜底）；B2：PID 文件与端口兜底的身份校验（`node.exe` + `dist\index.js`） |
| `stop.sh` | B2：`is_workbench()`（`/proc/<pid>/cmdline` + `readlink cwd`），PID 文件与端口兜底都校验；不符时拒绝并 `exit 1` |
| `README.md` | 一句话：端口优先级（环境变量 > `backend/.env` > 3300）+ 非法端口校验 + 停止时身份校验 |

未改：后端/前端代码、接口、表、测试、`AGENTS.md`；未创建/提交 `backend/.env`。

### 6.2 与建议补丁（P1/P2）的差异

- P1 的端口数字校验用 `echo|findstr`；实施改为 batch 内建 `for /f "delims=0123456789"` 扫描 + 长度/上界检查，避免把配置值拼进命令行，并额外拒绝前导零（`PORT=03300` 会被要求修正，后端 `numberEnv()` 其实会接受，提示已写 `no leading zeros`）。
- 在 P1 基础上补齐 dotenv 解析细节：单/双引号、`export PORT=` 前缀、内联 `#` 注释、key 大小写敏感（`port=` 忽略）、多行取最后一条、`PORT=`（空）回落 3300。
- P2 的 Windows 校验按交接单写成 `Name -eq 'node.exe'` + `CommandLine -match 'dist[\\/]index\.js'`；`stop.sh` 额外要求 cwd 等于 `$ROOT/backend`（不可读即拒绝），比建议补丁更严。
- 退出码：PID 文件身份不符 → 不杀、删过期 PID、继续兜底（最终无进程时 0）；端口兜底身份不符 → 1。未新增其它退出码。

### 6.3 验证摘要（全部实跑）

- 静态：两处 `usebackq`；优先级/校验逻辑齐备；`stop.cmd` 只有 2 处 `taskkill` 且在身份校验通过之后；`taskkill`/`kill` 不在任何拒绝分支；`bash -n` 均 rc=0；`.sh` LF；四个脚本无 `workbench.db`/`legacy`/`5180`/`backend-dev`/`api/dev` 残留。
- Windows：默认启动 0 / 健康 200 / 首页 200 / opencode 2.2.5 / 重复启动 1 / 停止 0 / 端口释放 / PID 删除 / 再次停止 0；`.env` 3459、环境变量 3460、二者同时（环境变量优先）、`.env` 非法（启动 1，停止仍按 PID 成功）、非法环境变量 4 种（均 1）；dummy 占用端口（1、不杀）、删除 PID 文件后的正常兜底（0、识别并停止）、无关 node/非 node 进程占 PID 文件（告警、不杀、PID 文件删除）、过期 PID（0）。
- Linux（WSL 22.04）：`stop.sh` 对 `sleep`/`python3 -m http.server` 拒绝（rc=0/1，进程存活）；对 `node … dist/index.js`（cwd=`backend`）stub 正常 TERM 停止（rc=0）；无 PID + 端口空闲 0。
- 收尾：3300/3459/3460/3462/3463/4771 无监听、无 `data/workbench.pid`、无 `backend/.env`；`apps=0`、`app_sessions=0`、`projects/` 空；无关进程（4320/43644、其它 opencode 会话）未被影响。

### 6.4 未验证 / 未修

- Linux 真实工作台 `start.sh` → `stop.sh` 端到端（无 Linux 运行环境）；仅用 stub 验证身份判定与停止路径。
- M1（`node_modules` 只判目录）、M2（`.cmd` 日志截断）、M3（`.sh` PORT 优先级）、M4（`opencode-serve-*.json` 残留 / WAL）、O1（不等 opencode 就绪）、O3（管道捕获）按要求未修；本次仍观察到 `data/opencode-serve-4771.json` 留下已退出 serve 记录（M4）。
- 新发现（非阻塞）：脚本端口校验比后端更严（前导零被拒）；`.env` 小写 `port=` 现在按 dotenv 语义忽略；`stop.cmd` 每次停止多约 0.1–0.3s（PowerShell 身份校验）。

