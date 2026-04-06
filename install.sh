#!/bin/bash
# ============================================================
# install.sh — Cài đặt lần đầu (Raspberry Pi / Linux / macOS)
# Usage: bash install.sh
# ============================================================
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
ENV_FILE="$BACKEND_DIR/.env"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✔]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✘]${NC} $1"; exit 1; }
info() { echo -e "${CYAN}[i]${NC} $1"; }

echo ""
echo "=================================================="
echo "   Kế Toán Nội Bộ — Cài đặt lần đầu"
echo "=================================================="
echo ""

# ── 1. Kiểm tra Node.js ──────────────────────────────────────
if ! command -v node &>/dev/null; then
  err "Node.js chưa được cài. Chạy: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
fi
log "Node.js: $(node -v)"

# ── 2. Kiểm tra & cài MariaDB ────────────────────────────────
if ! command -v mysql &>/dev/null; then
  warn "MariaDB chưa được cài. Đang cài..."
  sudo apt update -qq
  sudo apt install -y mariadb-server
  sudo systemctl start mariadb
  sudo systemctl enable mariadb
  log "Đã cài MariaDB"
else
  log "MariaDB: $(mysql --version | awk '{print $1,$2,$3}')"
fi

# ── 3. Tạo database + user MariaDB ───────────────────────────
DB_NAME="ke_toan_noi_bo"
DB_USER="ketoan"
DB_PASS="ketoan@hsl2025"

info "Đang tạo database và user MariaDB..."

sudo mysql -e "
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED VIA mysql_native_password USING PASSWORD('${DB_PASS}');
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
" && log "Database '${DB_NAME}' và user '${DB_USER}' đã sẵn sàng."

# ── 4. Tạo backend/.env nếu chưa có ─────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  warn "Chưa có backend/.env — tạo từ .env.example..."
  cp "$BACKEND_DIR/.env.example" "$ENV_FILE"
  log "Đã tạo backend/.env"
else
  log "backend/.env đã tồn tại, giữ nguyên."
fi

# ── 5. Cài PM2 nếu chưa có ───────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  warn "PM2 chưa được cài. Đang cài..."
  npm install -g pm2
fi
log "PM2: $(pm2 -v)"

# ── 6. Cài backend dependencies ──────────────────────────────
log "Cài backend dependencies..."
cd "$BACKEND_DIR"
npm install

# ── 7. Prisma generate + push schema ─────────────────────────
log "Prisma generate..."
npx prisma generate

log "Prisma push schema vào database..."
npx prisma db push --accept-data-loss

# ── 8. Build backend ─────────────────────────────────────────
log "Build backend TypeScript..."
npm run build

# ── 9. Build frontend ────────────────────────────────────────
log "Cài frontend dependencies..."
cd "$FRONTEND_DIR"
npm install

log "Build frontend..."
npm run build

log "Copy frontend dist → backend/public..."
mkdir -p "$BACKEND_DIR/public"
cp -r "$FRONTEND_DIR/dist/." "$BACKEND_DIR/public/"

# ── 10. Khởi động PM2 ────────────────────────────────────────
cd "$PROJECT_DIR"
log "Khởi động PM2..."
pm2 delete ke-toan-backend 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

# ── 11. PM2 startup ──────────────────────────────────────────
echo ""
warn "Chạy lệnh sau để PM2 tự khởi động khi reboot (copy & paste):"
echo ""
pm2 startup | tail -1
echo ""

# ── Done ─────────────────────────────────────────────────────
LAN_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "=================================================="
log "Hoàn tất! Truy cập hệ thống:"
echo ""
echo "   Local:  http://localhost:3001"
echo "   LAN:    http://$LAN_IP:3001"
echo ""
echo "   Tài khoản mặc định: admin / admin123"
echo "   ⚠️  Đổi mật khẩu sau khi đăng nhập lần đầu!"
echo "=================================================="
echo ""
