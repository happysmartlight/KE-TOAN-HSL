#!/bin/bash
# ============================================================
# install.sh — Chạy 1 lần duy nhất sau khi clone repo
# Usage: bash install.sh
# ============================================================
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
DB_PATH="$BACKEND_DIR/prisma/dev.db"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✔]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✘]${NC} $1"; exit 1; }

echo ""
echo "=================================================="
echo "   Kế Toán Nội Bộ — Cài đặt lần đầu"
echo "=================================================="
echo ""

# --- Kiểm tra Node.js ---
if ! command -v node &>/dev/null; then
  err "Node.js chưa được cài. Chạy: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
fi
NODE_VER=$(node -v)
log "Node.js: $NODE_VER"

# --- Kiểm tra npm ---
if ! command -v npm &>/dev/null; then
  err "npm chưa được cài."
fi

# --- Cài PM2 nếu chưa có ---
if ! command -v pm2 &>/dev/null; then
  warn "PM2 chưa được cài. Đang cài..."
  npm install -g pm2
fi
log "PM2: $(pm2 -v)"

# --- Tạo backend/.env nếu chưa có ---
if [ ! -f "$BACKEND_DIR/.env" ]; then
  warn "Chưa có backend/.env — tạo từ .env.example..."
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  # Ghi đường dẫn tuyệt đối vào DATABASE_URL
  sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"file:$DB_PATH\"|" "$BACKEND_DIR/.env"
  log "Đã tạo backend/.env"
else
  log "backend/.env đã tồn tại, giữ nguyên."
fi

# --- Cài backend dependencies ---
log "Cài backend dependencies..."
cd "$BACKEND_DIR"
npm install

# --- Prisma ---
log "Prisma generate..."
npx prisma generate

log "Prisma migrate (production)..."
npx prisma migrate deploy

# --- Seed nếu DB mới (kiểm tra bằng Prisma) ---
log "Kiểm tra dữ liệu database..."
USER_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count().then(n => { console.log(n); p.\$disconnect(); }).catch(() => { console.log(0); p.\$disconnect(); });
" 2>/dev/null || echo "0")

if [ "$USER_COUNT" = "0" ]; then
  log "Database mới — đang seed dữ liệu mặc định..."
  npx ts-node --transpile-only prisma/seed.ts
else
  log "Database đã có dữ liệu ($USER_COUNT user), bỏ qua seed."
fi

# --- Build backend ---
log "Build backend TypeScript..."
npm run build

# --- Build frontend ---
log "Cài frontend dependencies..."
cd "$FRONTEND_DIR"
npm install

log "Build frontend..."
npm run build

# --- Copy dist vào backend/public ---
log "Copy frontend dist → backend/public..."
mkdir -p "$BACKEND_DIR/public"
cp -r "$FRONTEND_DIR/dist/." "$BACKEND_DIR/public/"

# --- Khởi động PM2 ---
cd "$PROJECT_DIR"
log "Khởi động PM2..."
pm2 delete ke-toan-backend 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

# --- PM2 startup (tự khởi động khi reboot) ---
echo ""
warn "Chạy lệnh sau (copy & paste) để PM2 tự khởi động khi reboot:"
echo ""
pm2 startup | tail -1
echo ""

# --- Done ---
LAN_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "=================================================="
log "Hoàn tất! Truy cập hệ thống:"
echo ""
echo "   Local:  http://localhost:3001"
echo "   LAN:    http://$LAN_IP:3001"
echo ""
echo "   Tài khoản mặc định: admin / admin123"
echo "=================================================="
echo ""
