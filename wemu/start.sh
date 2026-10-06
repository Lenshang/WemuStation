#!/usr/bin/env bash
# WemuStation 一键启动（Linux / macOS / Git Bash）
# 首次运行前请先执行: npm install && npm run build && npm run gen-cert
set -e
cd "$(dirname "$0")"

echo "[WemuStation] 启动服务器 (HTTP :4464 / HTTPS :4465)..."
node server/index.js &
SERVER_PID=$!

# Ctrl+C 时一并停止服务器
trap 'kill $SERVER_PID 2>/dev/null' EXIT INT TERM

sleep 2

# 尝试打开浏览器（非交互环境自动跳过）
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:4464/" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then
  open "http://localhost:4464/" >/dev/null 2>&1 || true
fi

echo "[WemuStation] 运行中，Ctrl+C 停止。"
wait $SERVER_PID
