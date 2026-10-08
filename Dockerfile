# syntax=docker/dockerfile:1

# ---------- 阶段 1：构建前端 ----------
FROM node:24-alpine AS builder
WORKDIR /app

COPY wemu/package.json wemu/package-lock.json ./
RUN npm ci

COPY wemu/index.html wemu/vite.config.ts wemu/tsconfig.json ./
COPY wemu/src src
COPY wemu/public public
RUN npm run build

# ---------- 阶段 2：运行时 ----------
# 服务端零 npm 依赖（node:sqlite 为 Node 22.13+/24 内置模块）
FROM node:24-alpine
WORKDIR /app

ENV NODE_ENV=production \
    PORT=4464 \
    ROM_DIR=/app/roms \
    DATA_DIR=/app/data

COPY wemu/server server
COPY wemu/public public
COPY wemu/themes themes
COPY wemu/retroarch retroarch
COPY wemu/ppsspp ppsspp
COPY wemu/emulator emulator
COPY --from=builder /app/dist dist

RUN mkdir -p /app/roms /app/data

VOLUME ["/app/roms", "/app/data"]
EXPOSE 4464 4465

HEALTHCHECK --interval=60s --timeout=5s --start-period=30s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/systems" >/dev/null 2>&1 || exit 1

CMD ["node", "server/index.js"]
