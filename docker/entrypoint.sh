#!/bin/sh
# Container entrypoint cho backend kế toán nội bộ.
#
# Việc cần làm trước khi exec node:
# 1. Sync prisma/schema.prisma + migrations từ image vào volume (./data/prisma)
#    — JSON config (rank-config.json, backup-config.json) KHÔNG bị overwrite,
#      sống trong cùng volume nên persistent qua các lần rebuild.
# 2. Tạo thư mục backups nếu chưa có (volume mount lần đầu sẽ rỗng).
# 3. Chạy `prisma migrate deploy` để DB sync schema mới (idempotent — an toàn re-run).
# 4. exec "$@" — bàn giao PID cho `node dist/index.js` (đã được tini chuyển signal).

set -e

PRISMA_DIR="/app/backend/prisma"
PRISMA_TEMPLATE="/app/backend/prisma.template"
BACKUPS_DIR="/app/backend/backups"

mkdir -p "$PRISMA_DIR" "$BACKUPS_DIR"

# Schema LUÔN lấy từ image (overwrite) → container mới nhận đúng schema khi rebuild.
# Config JSON do app tự ghi (rank-config.json, backup-config.json) KHÔNG bị động vào.
cp -f "$PRISMA_TEMPLATE/schema.prisma" "$PRISMA_DIR/schema.prisma"

# Sync prisma migrations folder nếu có (project hiện chưa có — dùng db push).
if [ -d "$PRISMA_TEMPLATE/migrations" ]; then
  rm -rf "$PRISMA_DIR/migrations"
  cp -rf "$PRISMA_TEMPLATE/migrations" "$PRISMA_DIR/migrations"
fi

# Chiến lược sync DB:
#   - Nếu có thư mục migrations → dùng `migrate deploy` (production-grade, có version)
#   - Không có → dùng `db push` (sync schema trực tiếp, đúng workflow hiện tại của project)
#
# `db push` KHÔNG truyền --accept-data-loss → nếu có thay đổi destructive (drop column,
# đổi type), nó sẽ DỪNG và yêu cầu xử lý thủ công thay vì âm thầm xoá dữ liệu.
if [ -d "$PRISMA_DIR/migrations" ]; then
  echo "[entrypoint] migrations/ tồn tại → prisma migrate deploy"
  npx --no-install prisma migrate deploy --schema "$PRISMA_DIR/schema.prisma"
else
  echo "[entrypoint] Không có migrations → prisma db push --skip-generate"
  npx --no-install prisma db push --schema "$PRISMA_DIR/schema.prisma" --skip-generate
fi

echo "[entrypoint] Starting application: $*"
exec "$@"
