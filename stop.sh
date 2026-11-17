#!/usr/bin/env bash
# ================================================================
#  AI Dev Workbench - Linux 停止脚本
#  优先按 data/workbench.pid 优雅停止（会同时关闭 opencode serve 子进程）；
#  PID 文件丢失时退回按端口查找占用进程。
#  两条路径都会校验目标是本工作台（node dist/index.js，工作目录为 backend），
#  校验不通过时不结束任何进程。
# ================================================================
set -euo pipefail

# 用物理路径（pwd -P）：/proc/<pid>/cwd 是物理路径，仓库通过符号链接访问时也能对上。
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PID_FILE="$ROOT/data/workbench.pid"
PORT="${PORT:-3300}"

log() { printf '[workbench] %s\n' "$*"; }

# 读取 backend/.env 中的 PORT（与后端 dotenv 行为保持一致）
if [[ -f "$ROOT/backend/.env" ]]; then
  ENV_PORT="$(sed -nE 's/^[[:space:]]*PORT[[:space:]]*=[[:space:]]*//p' "$ROOT/backend/.env" | tail -n 1 | tr -d '\r' | sed -E 's/[[:space:]]+$//')"
  ENV_PORT="${ENV_PORT%\"}"; ENV_PORT="${ENV_PORT#\"}"
  ENV_PORT="${ENV_PORT%\'}"; ENV_PORT="${ENV_PORT#\'}"
  if [[ -n "$ENV_PORT" ]]; then PORT="$ENV_PORT"; fi
fi

alive() { [[ -n "${1:-}" ]] && kill -0 "$1" 2>/dev/null; }

# 是否为本工作台后端：/proc/<pid>/cmdline 含 dist/index.js，
# 且 /proc/<pid>/cwd 可读并等于 <repo>/backend；不可读时不强杀。
is_workbench() {
  local pid="${1:-}" cmdline cwd
  [[ -n "$pid" ]] || return 1
  [[ -r "/proc/$pid/cmdline" ]] || return 1
  cmdline="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"
  [[ "$cmdline" == *dist/index.js* ]] || return 1
  cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null || true)"
  [[ -n "$cwd" ]] || return 1
  [[ "$cwd" == "$ROOT/backend" ]]
}

KILLED=0
STOPPED_PID=""

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(tr -d '[:space:]' < "$PID_FILE" || true)"
  if alive "$OLD_PID"; then
    if is_workbench "$OLD_PID"; then
      log "停止工作台进程（PID $OLD_PID）..."
      kill -TERM "$OLD_PID" 2>/dev/null || true
      for _ in $(seq 1 20); do
        alive "$OLD_PID" || break
        sleep 0.5
      done
      if alive "$OLD_PID"; then
        log "进程 10 秒内未退出，强制结束（含进程组）..."
        kill -KILL "-$OLD_PID" 2>/dev/null || kill -KILL "$OLD_PID" 2>/dev/null || true
      fi
      KILLED=1
      STOPPED_PID="$OLD_PID"
    else
      log "PID 文件指向的进程（PID $OLD_PID）不是本工作台，未结束；请手工确认。"
    fi
  else
    log "PID 文件已过期（进程 ${OLD_PID:-未知} 不存在）。"
  fi
  rm -f "$PID_FILE"
fi

# 兜底：PID 文件缺失或过期时，按端口查找
if [[ "$KILLED" -eq 0 ]]; then
  PORT_PID=""
  if command -v ss >/dev/null 2>&1; then
    PORT_PID="$(ss -ltnp "sport = :$PORT" 2>/dev/null | grep -oE 'pid=[0-9]+' | head -n 1 | cut -d= -f2 || true)"
  elif command -v lsof >/dev/null 2>&1; then
    PORT_PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  fi
  if [[ -n "$PORT_PID" ]]; then
    if ! is_workbench "$PORT_PID"; then
      log "端口 $PORT 被 PID $PORT_PID 占用，但不是本工作台进程，未结束；请手工确认。"
      exit 1
    fi
    log "端口 $PORT 仍被 PID $PORT_PID 占用，正在结束..."
    kill -TERM "$PORT_PID" 2>/dev/null || true
    sleep 1
    alive "$PORT_PID" && kill -KILL "$PORT_PID" 2>/dev/null || true
    KILLED=1
    STOPPED_PID="$PORT_PID"
  fi
fi

if [[ "$KILLED" -eq 1 ]]; then
  log "已停止（PID $STOPPED_PID）。"
else
  log "未发现运行中的工作台进程（端口 $PORT 未被占用）。"
fi
exit 0
