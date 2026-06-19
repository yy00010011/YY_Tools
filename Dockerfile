# ============================================================
# Git 可视化工具 — 多阶段 Docker 构建
# ============================================================

# ---- Stage 1: 构建阶段 ----
FROM node:20-alpine AS builder

WORKDIR /build

# 安装依赖（利用 layer cache：先复制 package.json）
COPY server/package*.json server/
RUN cd server && npm ci

COPY client/package*.json client/
RUN cd client && npm ci

# 复制源码
COPY server/tsconfig.json server/
COPY server/src/ server/src/
COPY client/webpack.config.js client/
COPY client/babel.config.* client/ 2>/dev/null || true
COPY client/src/ client/src/
COPY client/public/ client/public/

# 编译后端 TypeScript
RUN cd server && npx tsc

# 构建前端 bundle
RUN cd client && npx webpack --mode production

# ---- Stage 2: 运行阶段 ----
FROM node:20-alpine

WORKDIR /app

# 只复制运行时需要的文件
COPY --from=builder /build/server/package*.json /build/server/.npmrc* ./server/
COPY --from=builder /build/server/node_modules ./server/node_modules
COPY --from=builder /build/server/dist ./server/dist

COPY --from=builder /build/client/dist ./client/dist

# 安全：以非 root 用户运行
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "server/dist/index.js"]
