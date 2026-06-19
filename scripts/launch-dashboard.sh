#!/bin/bash
# OpenClaw 工作台 2.0 启动器
# 被 ~/Desktop/OpenClaw工作台.app 调用：在则不重启，不在则拉起后端+前端，就绪后开浏览器
# 端口固定：前端 31021 / 后端 31022（与 1.0 隔离）

set -u

PROJECT_DIR="/Users/apple/clawd/openclaw-dashboard"
FRONTEND_PORT=31021
BACKEND_PORT=31022
URL="http://127.0.0.1:${FRONTEND_PORT}"
LOG_DIR="/tmp"

cd "$PROJECT_DIR" || { osascript -e 'display notification "找不到工作台目录" with title "OpenClaw 工作台"'; exit 1; }

# 找 node（GUI 启动的 .app 没有 shell 的 PATH，需手动补）
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -1)/bin:$PATH"
NODE_BIN="$(command -v node)"
[ -z "$NODE_BIN" ] && { osascript -e 'display notification "未找到 node，请检查安装" with title "OpenClaw 工作台"'; exit 1; }

port_open() { nc -z 127.0.0.1 "$1" >/dev/null 2>&1; }

# 1) 后端
if port_open "$BACKEND_PORT"; then
  echo "[启动器] 后端已在运行（:$BACKEND_PORT）"
else
  echo "[启动器] 拉起后端…"
  BACKEND_PORT=$BACKEND_PORT nohup "$NODE_BIN" scripts/unified-service.js > "$LOG_DIR/v2-backend.log" 2>&1 &
fi

# 2) 前端（vite）
if port_open "$FRONTEND_PORT"; then
  echo "[启动器] 前端已在运行（:$FRONTEND_PORT）"
else
  echo "[启动器] 拉起前端…"
  FRONTEND_PORT=$FRONTEND_PORT BACKEND_PORT=$BACKEND_PORT nohup "$NODE_BIN" node_modules/.bin/vite --host 0.0.0.0 > "$LOG_DIR/v2-vite.log" 2>&1 &
fi

# 3) 等前端就绪（最多 ~30 秒）
for i in $(seq 1 60); do
  port_open "$FRONTEND_PORT" && break
  sleep 0.5
done

# 4) 开浏览器
if port_open "$FRONTEND_PORT"; then
  open "$URL"
else
  osascript -e 'display notification "前端启动超时，请查看 /tmp/v2-vite.log" with title "OpenClaw 工作台"'
  open "$URL"
fi
