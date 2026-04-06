#!/bin/bash
# ============================================================
# deploy.sh — Cập nhật sau khi git pull (không cần cài lại)
# Usage: bash deploy.sh
# ============================================================
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

GREEN='\033[0;32m'
NC='\033[0m'
log() { echo -e "${GREEN}[✔]${NC} $1"; }

echo ""
echo "=================================================="
echo "   Kế Toán Nội Bộ — Cập nhật"
echo "=================================================="
echo ""

# --- Backend ---
log "Cài backend dependencies..."
cd "$BACKEND_DIR"
npm install --include=dev

log "Prisma generate..."
npx prisma generate

log "Prisma push schema..."
npx prisma db push --accept-data-loss

log "Build backend..."
npm run build

# --- Frontend ---
log "Cài frontend dependencies..."
cd "$FRONTEND_DIR"
npm install --include=dev

log "Build frontend..."
npm run build

log "Copy frontend dist → backend/public..."
mkdir -p "$BACKEND_DIR/public"
cp -r "$FRONTEND_DIR/dist/." "$BACKEND_DIR/public/"

# --- Reload PM2 (zero-downtime) ---
cd "$PROJECT_DIR"
log "Reload PM2..."
pm2 reload ke-toan-backend

LAN_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "=================================================="
log "Cập nhật xong! http://$LAN_IP:3001"
echo "=================================================="
echo ""
