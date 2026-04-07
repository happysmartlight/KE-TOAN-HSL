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
# Người dùng có thể:
#   (a) Đặt trước biến môi trường DB_NAME / DB_USER / DB_PASS (non-interactive)
#   (b) Hoặc nhập tương tác khi được hỏi
#   (c) Hoặc tái sử dụng giá trị đã có trong backend/.env nếu đang chạy lại install

# URL-encode cho DATABASE_URL (chủ yếu để xử lý ký tự @ : / ? # & trong password)
urlencode() {
  local s="$1" out="" i c
  for (( i=0; i<${#s}; i++ )); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9.~_-]) out+="$c" ;;
      *) out+=$(printf '%%%02X' "'$c") ;;
    esac
  done
  printf '%s' "$out"
}

# Escape cho SQL single-quoted literal: ' → ''   \ → \\
sql_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\'/\'\'}"
  printf '%s' "$s"
}

# Sinh password mạnh ngẫu nhiên (chỉ dùng ký tự an toàn URL)
gen_pass() {
  if command -v openssl &>/dev/null; then
    openssl rand -base64 18 | tr -d '=+/' | cut -c1-20
  else
    tr -dc 'A-Za-z0-9' </dev/urandom 2>/dev/null | head -c 20
  fi
}

# Thử đọc giá trị cũ từ backend/.env để offer tái sử dụng
EXISTING_DB_NAME=""; EXISTING_DB_USER=""; EXISTING_DB_PASS=""
if [ -f "$ENV_FILE" ]; then
  EXISTING_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | sed -E 's/^DATABASE_URL=//; s/^"//; s/"$//')
  if [[ "$EXISTING_URL" =~ ^mysql://([^:@]+):(.*)@([^:@/]+):([0-9]+)/([^?]+) ]]; then
    EXISTING_DB_USER="${BASH_REMATCH[1]}"
    EXISTING_DB_PASS="${BASH_REMATCH[2]}"
    EXISTING_DB_NAME="${BASH_REMATCH[5]}"
    # Thử URL-decode password (nếu đang ở dạng percent-encoded)
    EXISTING_DB_PASS=$(printf '%b' "${EXISTING_DB_PASS//%/\\x}")
  fi
fi

# Interactive / non-interactive
DEFAULT_DB_NAME="${DB_NAME:-${EXISTING_DB_NAME:-ke_toan_noi_bo}}"
DEFAULT_DB_USER="${DB_USER:-${EXISTING_DB_USER:-ketoan}}"
DEFAULT_DB_PASS="${DB_PASS:-${EXISTING_DB_PASS:-}}"

# Nếu STDIN là TTY và chưa được cung cấp sẵn qua env → hỏi người dùng
if [ -t 0 ] && [ -z "$DB_NAME" ] && [ -z "$DB_USER" ] && [ -z "$DB_PASS" ]; then
  echo ""
  info "Thiết lập MariaDB — nhấn Enter để dùng giá trị mặc định trong [ngoặc]"

  read -r -p "  Tên database   [${DEFAULT_DB_NAME}]: " IN_DB_NAME
  DB_NAME="${IN_DB_NAME:-$DEFAULT_DB_NAME}"

  read -r -p "  Tên user       [${DEFAULT_DB_USER}]: " IN_DB_USER
  DB_USER="${IN_DB_USER:-$DEFAULT_DB_USER}"

  if [ -n "$DEFAULT_DB_PASS" ]; then
    read -r -s -p "  Mật khẩu       [giữ nguyên mật khẩu hiện tại]: " IN_DB_PASS
    echo ""
    DB_PASS="${IN_DB_PASS:-$DEFAULT_DB_PASS}"
  else
    SUGGESTED_PASS="$(gen_pass)"
    read -r -s -p "  Mật khẩu       [để trống = sinh ngẫu nhiên]: " IN_DB_PASS
    echo ""
    DB_PASS="${IN_DB_PASS:-$SUGGESTED_PASS}"
    if [ -z "$IN_DB_PASS" ]; then
      info "Đã sinh mật khẩu ngẫu nhiên: ${DB_PASS}"
      warn "Hãy lưu lại mật khẩu này vào nơi an toàn!"
    fi
  fi
else
  # Non-interactive: dùng env/defaults; nếu vẫn trống password thì sinh ngẫu nhiên
  DB_NAME="${DB_NAME:-$DEFAULT_DB_NAME}"
  DB_USER="${DB_USER:-$DEFAULT_DB_USER}"
  if [ -z "$DB_PASS" ]; then
    if [ -n "$DEFAULT_DB_PASS" ]; then
      DB_PASS="$DEFAULT_DB_PASS"
    else
      DB_PASS="$(gen_pass)"
      warn "Non-interactive mode: đã sinh mật khẩu ngẫu nhiên cho user '${DB_USER}':"
      echo "       ${DB_PASS}"
      warn "Hãy lưu lại trước khi mất!"
    fi
  fi
fi

# Validate cơ bản
if [[ ! "$DB_NAME" =~ ^[A-Za-z0-9_]+$ ]]; then
  err "Tên database chỉ được dùng chữ/số/gạch dưới: '${DB_NAME}'"
fi
if [[ ! "$DB_USER" =~ ^[A-Za-z0-9_]+$ ]]; then
  err "Tên user chỉ được dùng chữ/số/gạch dưới: '${DB_USER}'"
fi
if [ ${#DB_PASS} -lt 8 ]; then
  warn "Mật khẩu DB ngắn hơn 8 ký tự — nên đổi sang chuỗi mạnh hơn."
fi

info "Đang tạo database và user MariaDB..."

DB_PASS_SQL="$(sql_escape "$DB_PASS")"
DB_PASS_URL="$(urlencode "$DB_PASS")"

sudo mysql -e "
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED VIA mysql_native_password USING PASSWORD('${DB_PASS_SQL}');
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED VIA mysql_native_password USING PASSWORD('${DB_PASS_SQL}');
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
" && log "Database '${DB_NAME}' và user '${DB_USER}' đã sẵn sàng."

# ── 4. Tạo / cập nhật backend/.env ──────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  warn "Chưa có backend/.env — tạo từ .env.example..."
  cp "$BACKEND_DIR/.env.example" "$ENV_FILE"
  log "Đã tạo backend/.env"
fi

# Luôn ghi đè DATABASE_URL theo giá trị người dùng vừa chọn (password đã URL-encode)
NEW_URL="mysql://${DB_USER}:${DB_PASS_URL}@localhost:3306/${DB_NAME}"
if grep -q "^DATABASE_URL=" "$ENV_FILE"; then
  # dùng | làm delimiter để tránh xung đột với / trong URL; escape & cho sed replacement
  ESCAPED_URL=$(printf '%s' "$NEW_URL" | sed -e 's/[\\&|]/\\&/g')
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"${ESCAPED_URL}\"|" "$ENV_FILE"
else
  echo "DATABASE_URL=\"${NEW_URL}\"" >> "$ENV_FILE"
fi
log "Đã cập nhật DATABASE_URL trong backend/.env"

# Tự sinh JWT_SECRET ngẫu nhiên nếu đang dùng giá trị mặc định / để trống
CURRENT_JWT=$(grep "^JWT_SECRET=" "$ENV_FILE" | sed -E 's/^JWT_SECRET=//; s/^"//; s/"$//' || true)
if [ -z "$CURRENT_JWT" ] || [ "$CURRENT_JWT" = "ke-toan-noi-bo-secret-2025" ] || [ "$CURRENT_JWT" = "change-me" ]; then
  NEW_JWT="$(gen_pass)$(gen_pass)"
  ESCAPED_JWT=$(printf '%s' "$NEW_JWT" | sed -e 's/[\\&|]/\\&/g')
  if grep -q "^JWT_SECRET=" "$ENV_FILE"; then
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=\"${ESCAPED_JWT}\"|" "$ENV_FILE"
  else
    echo "JWT_SECRET=\"${NEW_JWT}\"" >> "$ENV_FILE"
  fi
  log "Đã sinh JWT_SECRET ngẫu nhiên."
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
