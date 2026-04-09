# syntax=docker/dockerfile:1.7
#
# Multi-stage build cho hệ thống kế toán nội bộ.
# - Stage 1: build frontend (Vite) → static files
# - Stage 2: build backend (TypeScript + Prisma generate) → dist/
# - Stage 3: runtime tối thiểu (Node + mariadb-client cho backup/restore)
#
# Backend tự serve frontend từ ./public (xem backend/src/app.ts).

# ─────────────────────────────────────────────────────────────
# Stage 1 — Frontend build
# ─────────────────────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /frontend

# Cache npm install riêng với source để tận dụng layer cache
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# Frontend gọi API qua relative `/api` ở production → không cần VITE_API_URL
RUN npm run build


# ─────────────────────────────────────────────────────────────
# Stage 2 — Backend build
# ─────────────────────────────────────────────────────────────
FROM node:20-slim AS backend-builder

# openssl cần cho prisma query engine; ca-certificates cho npm registry HTTPS
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

# Copy schema TRƯỚC khi generate để cache layer prisma client
COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build


# ─────────────────────────────────────────────────────────────
# Stage 3 — Runtime
# ─────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

# - openssl: prisma query engine
# - mariadb-client: cung cấp `mysqldump` & `mysql` cho /api/admin/backup & /restore
# - tini: PID 1 đúng chuẩn → nhận SIGTERM, graceful shutdown khi `docker stop`
# - tzdata: cho TZ=Asia/Ho_Chi_Minh
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      openssl \
      ca-certificates \
      mariadb-client \
      tini \
      tzdata \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Copy artefact từ backend-builder
# Lưu ý: KHÔNG prune devDependencies vì entrypoint cần `prisma` CLI để chạy migrate deploy.
# Trade-off: image lớn hơn ~50MB, nhưng tránh phiền hà version mismatch giữa CLI & client.
COPY --from=backend-builder /backend/node_modules ./node_modules
COPY --from=backend-builder /backend/dist ./dist
COPY --from=backend-builder /backend/package.json ./package.json

# Stash prisma schema/migrations vào "template" — entrypoint sẽ sync vào volume khi start
COPY --from=backend-builder /backend/prisma ./prisma.template

# Frontend build → backend serve qua express.static('./public') trong app.ts
COPY --from=frontend-builder /frontend/dist ./public

# Entrypoint script
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Image node:20-slim đã có sẵn user `node` (UID/GID 1000) — chạy non-root để
# (1) giảm blast radius nếu RCE, (2) file ghi vào bind mount thuộc UID 1000
# trên host (dễ chown/quản lý hơn root).
RUN chown -R node:node /app
USER node

# ENV mặc định runtime
ENV NODE_ENV=production \
    PORT=3001 \
    BIND_HOST=0.0.0.0 \
    TZ=Asia/Ho_Chi_Minh

EXPOSE 3001

# tini xử lý zombie + signal forwarding; entrypoint sync prisma → migrate → exec node
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/index.js"]
