# Kế Toán Nội Bộ

[![CI](https://github.com/happysmartlight/KE-TOAN-HSL/actions/workflows/ci.yml/badge.svg)](https://github.com/happysmartlight/KE-TOAN-HSL/actions/workflows/ci.yml)

Hệ thống kế toán nội bộ cho doanh nghiệp nhỏ.

**Stack:** Node.js · TypeScript · Express · Prisma · SQLite · React · Vite

---

## Mục lục

- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt để phát triển (Dev mode)](#cài-đặt-để-phát-triển-dev-mode)
- [Cài đặt trên Raspberry Pi (Production)](#cài-đặt-trên-raspberry-pi-production)
- [Cập nhật sau khi có code mới](#cập-nhật-sau-khi-có-code-mới)
- [Tài khoản mặc định](#tài-khoản-mặc-định)
- [Truy cập hệ thống](#truy-cập-hệ-thống)
- [Cấu hình môi trường](#cấu-hình-môi-trường)
- [Lệnh quản lý (Production)](#lệnh-quản-lý-production)
- [Cấu trúc project](#cấu-trúc-project)
- [Troubleshooting](#troubleshooting)

---

## Yêu cầu hệ thống

| Phần mềm | Phiên bản tối thiểu | Kiểm tra |
|---|---|---|
| Node.js | 20.x trở lên | `node -v` |
| npm | 9.x trở lên | `npm -v` |
| Git | Bất kỳ | `git -v` |

> **Windows:** Tải Node.js tại [nodejs.org](https://nodejs.org) (bản LTS).  
> **Raspberry Pi / Linux:** Xem hướng dẫn bên dưới.

---

## Cài đặt để phát triển (Dev mode)

Dành cho developer muốn chỉnh sửa code trên máy Windows/Mac/Linux.  
Frontend và backend chạy song song, có hot-reload.

### Bước 1 — Clone repo

```bash
git clone <repo-url> ke-toan-noi-bo
cd ke-toan-noi-bo
```

### Bước 2 — Cài đặt và khởi tạo Backend

```bash
cd backend

# Cài dependencies
npm install

# Tạo file .env từ mẫu
cp .env.example .env        # Linux/Mac
copy .env.example .env      # Windows (Command Prompt)

# Tạo database và chạy migrations
npx prisma migrate dev

# Seed dữ liệu mặc định (tài khoản admin, staff, danh mục...)
npx ts-node --transpile-only prisma/seed.ts
```

> **Windows — lỗi EPERM khi `prisma generate`:**  
> Chạy `taskkill /F /IM node.exe` rồi thử lại.

### Bước 3 — Cài đặt Frontend

```bash
# Mở terminal mới, từ thư mục gốc project
cd frontend
npm install
```

### Bước 4 — Chạy hệ thống

Mở **2 terminal riêng biệt:**

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# → Chạy tại http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# → Chạy tại http://localhost:5173
```

Mở trình duyệt: **http://localhost:5173**

### Truy cập từ điện thoại / máy khác cùng WiFi (dev)

Tìm IP máy tính của bạn:
```bash
# Windows
ipconfig

# Mac / Linux
hostname -I
```

Tạo file `frontend/.env.local`:
```
VITE_API_URL=http://<IP-máy-bạn>:3001/api
```

Ví dụ: `VITE_API_URL=http://192.168.1.11:3001/api`

Truy cập từ điện thoại: `http://<IP-máy-bạn>:5173`

---

## Cài đặt trên Raspberry Pi (Production)

Dùng cho môi trường chạy thật. Backend tự phục vụ cả frontend, chạy nền với PM2.

### Bước 1 — Cài Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Kiểm tra: `node -v` → phải là v20.x trở lên.

### Bước 2 — Clone repo

```bash
git clone <repo-url> ke-toan-noi-bo
cd ke-toan-noi-bo
```

### Bước 3 — Chạy script cài đặt

```bash
bash install.sh
```

Script này tự động làm tất cả:
- Cài PM2 (process manager, nếu chưa có)
- Tạo `backend/.env` từ `.env.example`
- Cài dependencies backend + frontend
- Chạy Prisma migrations
- Seed dữ liệu mặc định (nếu database mới)
- Build backend + frontend
- Copy frontend build vào `backend/public/`
- Khởi động service với PM2

### Bước 4 — Bật tự khởi động khi reboot

Sau khi script chạy xong, nó sẽ in ra một lệnh dạng:
```
sudo env PATH=... pm2 startup systemd -u pi --hp /home/pi
```

**Copy chính xác lệnh đó và chạy.** Sau đó lưu cấu hình:
```bash
pm2 save
```

Từ lần sau, khi Raspberry Pi khởi động lại, hệ thống sẽ tự chạy.

---

## Cập nhật sau khi có code mới

```bash
git pull
bash deploy.sh
```

Hoặc dùng `make`:
```bash
make deploy
```

`deploy.sh` sẽ: cài dependencies mới → migrate DB → build lại → reload PM2 (zero-downtime).

---

## Tài khoản mặc định

| Username | Password | Quyền |
|---|---|---|
| `admin` | `admin123` | Admin — toàn quyền |
| `nhanvien` | `staff123` | Staff — xem và tạo dữ liệu |

> **Bắt buộc đổi mật khẩu ngay sau lần đăng nhập đầu tiên.**  
> Vào: **Hồ sơ của tôi → Đổi mật khẩu**

---

## Truy cập hệ thống

### Dev mode

| Loại | URL |
|---|---|
| Máy đang chạy code | `http://localhost:5173` |
| Điện thoại / máy khác cùng WiFi | `http://<IP-máy-bạn>:5173` |

### Production (Raspberry Pi)

| Loại | URL |
|---|---|
| Trình duyệt trên Pi | `http://localhost:3001` |
| Điện thoại / máy khác cùng WiFi | `http://<IP-Raspberry-Pi>:3001` |
| Từ xa qua Tailscale VPN | `http://<IP-Tailscale>:3001` |

Xem IP hiện tại của Raspberry Pi:
```bash
hostname -I
```

### Truy cập từ xa qua Tailscale (ngoài mạng nội bộ)

1. Cài Tailscale trên Raspberry Pi:
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```
2. Cài Tailscale trên thiết bị cần truy cập (Windows / Mac / iOS / Android)
3. Đăng nhập cùng một tài khoản Tailscale
4. Truy cập qua IP Tailscale (dải `100.x.x.x`): `http://100.x.x.x:3001`

Sau khi đăng nhập admin, vào **Hệ thống → Thiết lập mạng** để xem URL đầy đủ và QR code.

---

## Cấu hình môi trường

File `backend/.env` (được tạo tự động từ `.env.example` khi chạy `install.sh`):

```env
# Đường dẫn SQLite database
DATABASE_URL="file:./prisma/dev.db"

# JWT secret — PHẢI đổi trước khi dùng thật
JWT_SECRET="ke-toan-noi-bo-secret-2024"

# Port backend
PORT=3001
```

> **Quan trọng:** Đổi `JWT_SECRET` thành chuỗi ngẫu nhiên trước khi chạy production.  
> Tạo chuỗi ngẫu nhiên: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## Lệnh quản lý (Production)

```bash
make install    # Cài đặt lần đầu (sau khi clone)
make deploy     # Cập nhật sau git pull
make logs       # Xem logs realtime
make status     # Trạng thái PM2
make restart    # Restart service
make stop       # Dừng service
```

Hoặc dùng PM2 trực tiếp:
```bash
pm2 status                    # Xem trạng thái
pm2 logs ke-toan-backend      # Xem logs
pm2 restart ke-toan-backend   # Restart
pm2 reload ke-toan-backend    # Reload không mất kết nối
```

---

## Cấu trúc project

```
ke-toan-noi-bo/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Định nghĩa database
│   │   ├── migrations/         # Lịch sử migration
│   │   ├── seed.ts             # Dữ liệu khởi tạo
│   │   └── dev.db              # SQLite database (tạo tự động, không commit)
│   ├── src/
│   │   ├── index.ts            # Entry point, route mounting
│   │   ├── middleware/         # Auth middleware (JWT)
│   │   ├── utils/              # Logger, backup utilities
│   │   └── modules/            # Các module nghiệp vụ
│   ├── .env.example            # Mẫu cấu hình (commit)
│   ├── .env                    # Cấu hình thật (KHÔNG commit)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # Router, sidebar
│   │   ├── pages/              # Các trang
│   │   ├── components/         # Components dùng chung
│   │   └── api.ts              # Axios client
│   ├── .env.local              # Cấu hình dev LAN (KHÔNG commit, tự tạo nếu cần)
│   └── package.json
├── install.sh                  # Script cài đặt lần đầu (Linux/Pi)
├── deploy.sh                   # Script cập nhật (Linux/Pi)
├── ecosystem.config.js         # Cấu hình PM2
└── Makefile                    # Lệnh tắt
```

---

## Troubleshooting

**`prisma generate` lỗi EPERM (Windows)**
```bash
taskkill /F /IM node.exe
npx prisma generate
```

**Backend không start — lỗi "Cannot find module"**
```bash
cd backend
npm run build
```

**Frontend không kết nối được backend (dev mode)**  
Kiểm tra file `frontend/.env.local` có đúng URL chưa:
```
VITE_API_URL=http://localhost:3001/api
```

**Port 3001 đang bị chiếm (production)**
```bash
sudo lsof -i :3001
sudo kill -9 <PID>
pm2 start ecosystem.config.js
```

**Reset database (chỉ dùng trong dev, không dùng production)**
```bash
cd backend
rm prisma/dev.db
npx prisma migrate deploy
npx ts-node --transpile-only prisma/seed.ts
```

**Xem log lỗi chi tiết (production)**
```bash
pm2 logs ke-toan-backend --lines 100
```
