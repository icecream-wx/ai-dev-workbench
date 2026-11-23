#!/usr/bin/env bash
# ================================================================
#  AI Dev Workbench - Linux 重启脚本
#  用法: ./restart.sh
#  流程: 停止旧实例 -> 重建前后端（在 start.sh 内） -> 启动 -> 健康检查
#  停止失败即中止；不额外杀进程、不改 PID 逻辑。
# ================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

printf '[workbench] restart: stop -> build -> start\n'
"$ROOT/stop.sh"
exec "$ROOT/start.sh"
