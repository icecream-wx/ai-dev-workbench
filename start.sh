#!/usr/bin/env bash
# ================================================================
#  AI Dev Workbench - Linux 启动脚本
#  用法: ./start.sh  或  bash start.sh
#  流程: 检查环境 -> 按需安装依赖 -> 构建 -> 后台启动 -> 健康检查
#  停止: ./stop.sh
# ================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PID_FILE="$ROOT/data/workbench.pid"
LOG_DIR="$ROOT/data/logs"
OUT_LOG="$LOG_DIR/workbench.log"
ERR_LOG="$LOG_DIR/workbench.error.log"
PORT="${PORT:-3300}"

log()  { printf '[workbench] %s\n' "$*"; }
fail() { printf '[workbench] 错误: %s\n' "$*" >&2; exit 1; }

# 读取 backend/.env 中的 PORT（与后端 dotenv 行为保持一致）
if [[ -f "$ROOT/backend/.env" ]]; then
  ENV_PORT="$(sed -nE 's/^[[:space:]]*PORT[[:space:]]*=[[:space:]]*//p' "$ROOT/backend/.env" | tail -n 1 | tr -d '\r' | sed -E 's/[[:space:]]+$//')"
  ENV_PORT="${ENV_PORT%\"}"; ENV_PORT="${ENV_PORT#\"}"
  ENV_PORT="${ENV_PORT%\'}"; ENV_PORT="${ENV_PORT#\'}"
  if [[ -n "$ENV_PORT" ]]; then PORT="$ENV_PORT"; fi
fi
[[ "$PORT" =~ ^[0-9]+$ ]] || fail "PORT 不是合法端口: $PORT"

log "项目目录: $ROOT"
log "端口: $PORT"

command -v node >/dev/null 2>&1 || fail "未找到 node，请安装 Node.js 20 及以上版本"
command -v npm >/dev/null 2>&1 || fail "未找到 npm，请检查 Node.js 安装"

if ! command -v opencode >/dev/null 2>&1 && ! grep -qE '^[[:space:]]*OPENCODE_BIN[[:space:]]*=[[:space:]]*[^[:space:]]+' "$ROOT/backend/.env" 2>/dev/null; then
  log "提示: PATH 中未找到 opencode，需求/设计/开发会话将不可用（可安装 opencode 或设置 OPENCODE_BIN）"
fi

# 已运行则不重复启动
if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(tr -d '[:space:]' < "$PID_FILE" || true)"
  if [[ -n "$OLD_PID" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    fail "工作台已在运行（PID $OLD_PID），如需重启请先执行 ./stop.sh"
  fi
  rm -f "$PID_FILE"
fi

port_busy() {
  local p="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "sport = :${p}" 2>/dev/null | tail -n +2 | grep -q .
  elif command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${p}" -sTCP:LISTEN -t >/dev/null 2>&1
  else
    (exec 3<>"/dev/tcp/127.0.0.1/${p}") 2>/dev/null
  fi
}

if port_busy "$PORT"; then
  fail "端口 $PORT 已被占用，请释放端口或修改 backend/.env 的 PORT"
fi

# 依赖缺失/不完整时自动安装（包含 devDependencies，构建需要 tsc / vite）
ensure_deps() {
  local dir="$1" target="$ROOT/$1" sentinel
  if [[ "$dir" == "frontend" ]]; then
    sentinel="$target/node_modules/.bin/vite"
  else
    sentinel="$target/node_modules/.bin/tsc"
  fi
  if [[ ! -x "$sentinel" ]]; then
    if [[ -d "$target/node_modules" ]]; then
      log "$dir 依赖不完整，重新安装..."
    else
      log "安装 $dir 依赖..."
    fi
    rm -rf "$target/node_modules"
    if [[ -f "$target/package-lock.json" ]]; then
      ( cd "$target" && npm ci --include=dev )
    else
      ( cd "$target" && npm install --include=dev )
    fi
  fi
}
ensure_deps backend
ensure_deps frontend

log "构建后端与前端..."
npm run build

mkdir -p "$LOG_DIR"

log "启动服务..."
(
  cd "$ROOT/backend"
  if command -v setsid >/dev/null 2>&1; then
    nohup setsid node dist/index.js >> "$OUT_LOG" 2>> "$ERR_LOG" &
  else
    nohup node dist/index.js >> "$OUT_LOG" 2>> "$ERR_LOG" &
  fi
  echo $! > "$PID_FILE"
)
NEW_PID="$(tr -d '[:space:]' < "$PID_FILE" || true)"
log "进程已启动（PID ${NEW_PID:-未知}），等待健康检查..."

wait_health() {
  local i
  for i in $(seq 1 60); do
    if command -v curl >/dev/null 2>&1; then
      curl -fsS --max-time 2 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && return 0
    elif command -v wget >/dev/null 2>&1; then
      wget -q -T 2 -O /dev/null "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && return 0
    else
      (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null && return 0
    fi
    sleep 0.5
  done
  return 1
}

if ! wait_health; then
  log "启动失败，最近日志:"
  if [[ -f "$ERR_LOG" ]]; then tail -n 40 "$ERR_LOG" || true; fi
  if [[ -f "$OUT_LOG" ]]; then tail -n 40 "$OUT_LOG" || true; fi
  if [[ -n "$NEW_PID" ]]; then
    kill -TERM "$NEW_PID" 2>/dev/null || true
    sleep 1
    kill -KILL "$NEW_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
  exit 1
fi

log "启动成功"
printf '  访问地址 : http://localhost:%s\n' "$PORT"
printf '  进程 PID : %s\n' "$NEW_PID"
printf '  运行日志 : %s\n' "$OUT_LOG"
printf '  错误日志 : %s\n' "$ERR_LOG"
printf '  停止服务 : ./stop.sh\n'
