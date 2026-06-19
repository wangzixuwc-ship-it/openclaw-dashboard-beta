#!/usr/bin/env bash
set -euo pipefail

PORT="${OPENCLAW_PUBLIC_PORT:-31021}"
USER_NAME="${OPENCLAW_PUBLIC_USER:-openclaw}"
PASSWORD="${OPENCLAW_PUBLIC_PASSWORD:-}"
AUTHTOKEN="${NGROK_AUTHTOKEN:-}"
POLICY_FILE="$(mktemp -t openclaw-ngrok-policy.XXXXXX.yml)"

cleanup() {
  rm -f "$POLICY_FILE"
}
trap cleanup EXIT

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok 未安装。请先安装 ngrok，或改用 Cloudflare Tunnel / Tailscale。"
  exit 1
fi

if [[ -z "$AUTHTOKEN" ]]; then
  echo "缺少 NGROK_AUTHTOKEN。"
  echo "获取后运行：NGROK_AUTHTOKEN=你的token OPENCLAW_PUBLIC_PASSWORD=至少8位密码 npm run tunnel:v2"
  exit 1
fi

if [[ ${#PASSWORD} -lt 8 || ${#PASSWORD} -gt 128 ]]; then
  echo "缺少 OPENCLAW_PUBLIC_PASSWORD，或长度不在 8-128 位之间。"
  echo "示例：NGROK_AUTHTOKEN=你的token OPENCLAW_PUBLIC_PASSWORD='一个强密码' npm run tunnel:v2"
  exit 1
fi

cat > "$POLICY_FILE" <<YAML
on_http_request:
  - actions:
      - type: "basic-auth"
        config:
          realm: "OpenClaw Workbench"
          credentials:
            - "${USER_NAME}:${PASSWORD}"
          enforce: true
YAML

echo "正在公开 OpenClaw 2.0：本机 http://127.0.0.1:${PORT}"
echo "公网入口会要求 Basic Auth：用户名 ${USER_NAME}"
echo "停止公开：在此终端按 Ctrl+C"

exec ngrok http "127.0.0.1:${PORT}" \
  --authtoken "$AUTHTOKEN" \
  --traffic-policy-file "$POLICY_FILE"
