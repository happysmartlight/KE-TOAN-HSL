# Kế Toán Nội Bộ

[![CI](https://github.com/happysmartlight/KE-TOAN-HSL/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/happysmartlight/KE-TOAN-HSL/actions/workflows/ci.yml)

Hệ thống kế toán nội bộ cho doanh nghiệp nhỏ.

**Stack:** Node.js · TypeScript · Express · Prisma · **MariaDB** · React · Vite

---

## Mục lục

- [Tính năng](#tính-năng)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt để phát triển (Dev mode)](#cài-đặt-để-phát-triển-dev-mode)
- [Cài đặt trên Raspberry Pi (Production)](#cài-đặt-trên-raspberry-pi-production)
- [Cập nhật hệ thống](#cập-nhật-hệ-thống)
- [Tài khoản mặc định](#tài-khoản-mặc-định)
- [Truy cập hệ thống](#truy-cập-hệ-thống)
- [Cấu hình môi trường](#cấu-hình-môi-trường)
- [Lệnh quản lý (Production)](#lệnh-quản-lý-production)
- [Cấu trúc project](#cấu-trúc-project)
- [Troubleshooting](#troubleshooting)

---

## Tính năng

### Nghiệp vụ kế toán

| Tính năng | Mô tả |
|---|---|
| **Dòng tiền (Cashflow)** | Thu/Chi theo danh mục, lọc theo kỳ (ngày/tháng/năm), ngày giao dịch thực tế |
| **Hóa đơn bán hàng** | Tạo hóa đơn, hủy, xóa; tự động giảm tồn kho + tăng công nợ |
| **Nhập hàng (Purchase)** | Tạo đơn nhập; tự động tăng tồn kho + tăng công nợ nhà cung cấp |
| **Import hóa đơn XML** | Nhập HĐĐT điện tử (`.xml`) — tự ghép khách hàng theo MST, sản phẩm theo tên |
| **Thanh toán** | Ghi nhận thanh toán → giảm công nợ, cập nhật trạng thái hóa đơn, tạo cashflow |
| **Khách hàng & Nhà cung cấp** | Quản lý danh sách, công nợ, lịch sử giao dịch |
| **Sản phẩm & Tồn kho** | Quản lý sản phẩm, tồn kho, lịch sử nhập/xuất |
| **Báo cáo** | Dòng tiền, Lợi nhuận/Lỗ, doanh thu theo kỳ |
| **Dashboard** | KPI tổng quan, biểu đồ doanh thu, top khách hàng (click xem chi tiết) |

### Quản trị hệ thống (Admin)

| Tính năng | Mô tả |
|---|---|
| **Quản lý người dùng** | Tạo/sửa/xóa tài khoản, phân quyền Admin / Staff |
| **Hồ sơ cá nhân** | Đổi tên, avatar, mật khẩu; Staff gửi yêu cầu cập nhật → Admin duyệt |
| **Yêu cầu xóa** | Staff gửi yêu cầu xóa dữ liệu → Admin duyệt hoặc từ chối |
| **Rank khách hàng / NCC** | Hệ thống rank (Vàng / Bạch Kim / Kim Cương / Thách Đấu) theo doanh số; ngưỡng cấu hình độc lập cho từng nhóm |
| **Danh mục thu/chi** | Tạo/sửa/xóa danh mục cashflow tùy chỉnh |
| **Xóa toàn bộ dữ liệu** | Purge theo nhóm (khách hàng, hóa đơn…) hoặc purge all |

### Sao lưu & Phục hồi

| Tính năng | Mô tả |
|---|---|
| **Sao lưu thủ công** | Admin download file `.sql` (mysqldump) trực tiếp từ giao diện |
| **Phục hồi từ file** | Admin upload file `.sql`; validate trước khi import vào MariaDB |
| **Sao lưu tự động** | Lên lịch cron (hàng giờ / hàng ngày / hàng tuần / tuỳ chỉnh); giữ N bản gần nhất; tùy chọn mã hóa AES |
| **Quản lý bản backup** | Liệt kê, tải xuống, xóa từng file backup |

### Trạng thái hệ thống & Cập nhật

| Tính năng | Mô tả |
|---|---|
| **Monitor tài nguyên** | RAM, CPU, dung lượng ổ đĩa, kích thước DB, uptime, thông tin Node.js |
| **Nhân sự đang online** | Hiển thị danh sách user đang đăng nhập (username, role, IP, thời gian) |
| **Activity Logs** | Xem log hoạt động hệ thống (info / warning / error / critical) |
| **Khởi động lại server** | Admin restart service ngay từ giao diện web (không cần SSH) |
| **Cấu hình tự khởi động** | Thiết lập PM2 startup để server tự chạy sau khi reboot Pi |
| **Kiểm tra & cài cập nhật** | So sánh commit hiện tại với GitHub remote; xem danh sách commit mới; cài cập nhật 1 click (`git pull` + build + reload PM2) ngay từ trình duyệt |

### Mạng & Truy cập từ xa

| Tính năng | Mô tả |
|---|---|
| **Thiết lập mạng** | Xem IP nội bộ, URL đầy đủ, QR code để truy cập nhanh từ điện thoại |
| **Tailscale VPN** | Wizard cài đặt Tailscale trực tiếp từ giao diện; truy cập hệ thống từ bất kỳ đâu qua internet |

---

## Yêu cầu hệ thống

| Phần mềm | Phiên bản tối thiểu | Kiểm tra |
|---|---|---|
| Node.js | 20.x trở lên | `node -v` |
| npm | 9.x trở lên | `npm -v` |
| Git | Bất kỳ | `git -v` |
| MariaDB | 10.6 trở lên | `mysql --version` |

> **Windows:** Tải Node.js tại [nodejs.org](https://nodejs.org) (bản LTS). Tải MariaDB tại [mariadb.org/download](https://mariadb.org/download/).  
> **Raspberry Pi / Linux:** `install.sh` sẽ tự cài MariaDB, không cần làm thủ công.

---

## Cài đặt để phát triển (Dev mode)

Dành cho developer muốn chỉnh sửa code trên máy Windows/Mac/Linux.  
Frontend và backend chạy song song, có hot-reload.

### Bước 1 — Clone repo

```bash
git clone <repo-url> ke-toan-noi-bo
cd ke-toan-noi-bo
```

### Bước 2 — Cài đặt MariaDB và tạo database

Cài MariaDB nếu chưa có → mở MariaDB client (Start Menu → **MySQL Client (MariaDB)**) rồi chạy:

```sql
CREATE DATABASE IF NOT EXISTS ke_toan_noi_bo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ketoan'@'localhost' IDENTIFIED VIA mysql_native_password USING PASSWORD('ketoan@hsl2025');
GRANT ALL PRIVILEGES ON ke_toan_noi_bo.* TO 'ketoan'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Bước 3 — Cài đặt và khởi tạo Backend

```bash
cd backend

# Tạo file .env từ mẫu
cp .env.example .env        # Linux/Mac
copy .env.example .env      # Windows (Command Prompt)

# Cài dependencies
npm install

# Generate Prisma client
npx prisma generate

# Tạo bảng trong database
npx prisma db push
```

> **Tài khoản web app được tạo tự động** khi backend khởi động lần đầu (nếu DB còn trống).  
> **Windows — lỗi EPERM khi `prisma generate`:** Chạy `taskkill /F /IM node.exe` rồi thử lại.

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
- Cài MariaDB (nếu chưa có)
- Tạo database `ke_toan_noi_bo` + user `ketoan`
- Tạo `backend/.env` từ `.env.example`
- Cài dependencies backend + frontend
- `prisma db push` — tạo toàn bộ bảng
- Build backend + frontend
- Copy frontend build vào `backend/public/`
- Khởi động service với PM2
- Tài khoản `admin/admin123` được tạo tự động lần đầu khởi động

### Bước 4 — Bật tự khởi động khi reboot

**Cách 1 — Qua giao diện web (khuyên dùng):**

Sau khi cài xong, đăng nhập admin → **Hệ thống → Trạng thái hệ thống → tab Trạng thái → panel "Tự khởi động"** → nhấn **Cài đặt tự khởi động**.

Hệ thống sẽ tự chạy lệnh `pm2 startup` và `pm2 save` thay bạn.

**Cách 2 — Thủ công qua terminal:**

Sau khi `install.sh` chạy xong, nó in ra một lệnh dạng:
```
sudo env PATH=... pm2 startup systemd -u pi --hp /home/pi
```

Copy chính xác lệnh đó và chạy, sau đó:
```bash
pm2 save
```

---

## Cập nhật hệ thống

### Cách 1 — Qua giao diện web (khuyên dùng, không cần SSH)

1. Đăng nhập admin → **Hệ thống → Trạng thái hệ thống → tab Cập nhật**
2. Nhấn **Kiểm tra cập nhật** — hệ thống so sánh commit hiện tại với GitHub
3. Nếu có bản mới: xem danh sách commit sắp được cài, nhấn **Cài cập nhật**
4. Hệ thống tự chạy `git pull` → cài dependencies → migrate DB → build → reload PM2
5. Theo dõi log trực tiếp trong giao diện; khi xong nhấn **Khởi động lại server** nếu cần

> **Lưu ý:** Tính năng này chỉ hoạt động khi server chạy trên Linux (Raspberry Pi).  
> Yêu cầu server có kết nối internet để `git pull` về GitHub.

### Cách 2 — Qua terminal

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

Tài khoản được **tự động tạo khi backend khởi động lần đầu** (nếu database chưa có user nào):

| Username | Password | Quyền |
|---|---|---|
| `admin` | `admin123` | Admin — toàn quyền |

> **Bắt buộc đổi mật khẩu ngay sau lần đăng nhập đầu tiên.**  
> Vào: **Hồ sơ của tôi → Đổi mật khẩu**

---

## Thông tin tài khoản — 2 tầng tách biệt

Hệ thống có 2 loại tài khoản **hoàn toàn độc lập nhau**:

| Loại | Dùng để làm gì | Ai cần biết |
|---|---|---|
| **Tài khoản MariaDB** | Backend kết nối vào database | Người cài đặt server (1 lần) |
| **Tài khoản Web App** | Đăng nhập vào giao diện web | Người dùng hàng ngày |

```
Người dùng (trình duyệt)
    ↓  đăng nhập bằng  admin / admin123
Giao diện Web (React)
    ↓  gọi API
Backend (Node.js)
    ↓  kết nối bằng  ketoan / ketoan@hsl2025
MariaDB  (ke_toan_noi_bo)
```

> Người dùng cuối **không cần biết** thông tin MariaDB. Chỉ người cài server mới cần cấu hình 1 lần duy nhất.

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

**Cách 1 — Qua giao diện web:**

Đăng nhập admin → **Hệ thống → Thiết lập mạng** → làm theo wizard Tailscale.

**Cách 2 — Thủ công:**

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
# Kết nối MariaDB — format: mysql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL="mysql://ketoan:ketoan@hsl2025@localhost:3306/ke_toan_noi_bo"

# JWT secret — PHẢI đổi trước khi dùng thật
JWT_SECRET="ke-toan-noi-bo-secret-2025"

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
│   │   ├── schema.prisma       # Định nghĩa database (MariaDB)
│   │   ├── seed.ts             # Dữ liệu mẫu (dev only)
│   │   ├── rank-config.json    # Cấu hình ngưỡng rank (tự tạo)
│   │   └── backup-config.json  # Cấu hình auto-backup (tự tạo)
│   ├── src/
│   │   ├── index.ts            # Entry point, route mounting
│   │   ├── middleware/         # Auth middleware (JWT), online-user tracker
│   │   ├── utils/              # Logger, backup utilities
│   │   └── modules/
│   │       ├── admin/          # Health, update, network, Tailscale, rank config
│   │       ├── backup/         # Auto backup (cron), manual backup/restore
│   │       ├── cashflow/       # Thu/Chi
│   │       ├── cashflow-category/
│   │       ├── customer/
│   │       ├── supplier/
│   │       ├── invoice/        # Hóa đơn + XML import
│   │       ├── purchase/       # Nhập hàng
│   │       ├── product/
│   │       ├── payment/
│   │       ├── report/
│   │       ├── log/            # Activity logs
│   │       └── user/           # Users + profile requests
│   ├── .env.example            # Mẫu cấu hình (commit)
│   ├── .env                    # Cấu hình thật (KHÔNG commit)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # Router, sidebar
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Invoices.tsx    # Bán hàng + XML import HĐĐT
│   │   │   ├── Purchases.tsx   # Nhập hàng
│   │   │   ├── Cashflow.tsx
│   │   │   ├── CashflowCategories.tsx
│   │   │   ├── Customers.tsx
│   │   │   ├── Suppliers.tsx
│   │   │   ├── Products.tsx
│   │   │   ├── Reports.tsx
│   │   │   ├── Users.tsx
│   │   │   ├── RankConfig.tsx  # Cấu hình ngưỡng rank
│   │   │   ├── Requests.tsx    # Yêu cầu xóa + cập nhật hồ sơ
│   │   │   ├── SystemAdmin.tsx # Purge data, backup/restore DB
│   │   │   ├── AutoBackup.tsx  # Sao lưu tự động (cron)
│   │   │   ├── SystemHealth.tsx# Monitor server + logs + cập nhật
│   │   │   ├── NetworkSetup.tsx# Thiết lập mạng, QR, Tailscale
│   │   │   ├── Logs.tsx        # Activity logs viewer
│   │   │   ├── MyProfile.tsx
│   │   │   └── Login.tsx
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

**Tính năng "Cập nhật" báo lỗi "không phải Linux"**  
Tính năng cập nhật qua web chỉ hỗ trợ Linux (Raspberry Pi). Trên Windows, dùng `git pull` + `deploy.sh` thủ công.

**Tính năng "Cập nhật" báo lỗi git / không thể pull**  
- Kiểm tra server có kết nối internet không: `curl -I https://github.com`
- Đảm bảo không có file bị chỉnh sửa local gây conflict: `git status`
- Nếu có conflict: `git stash` rồi thử lại

**Reset database (chỉ dùng trong dev, không dùng production)**
```bash
# Xóa toàn bộ bảng rồi tạo lại
cd backend
npx prisma db push --force-reset
# Tài khoản admin/admin123 sẽ tự tạo lại khi khởi động backend
npm run dev
```

**Xem log lỗi chi tiết (production)**
```bash
pm2 logs ke-toan-backend --lines 100
```

**Build lỗi "tsc not found" / "vite not found" (production)**  
`deploy.sh` dùng `npm install --include=dev` để giữ lại devDependencies khi build.  
Nếu lỗi vẫn xảy ra:
```bash
cd backend && npm install --include=dev
cd ../frontend && npm install
```

**Login báo "Network error" / không kết nối được server (dev mode)**  
Lần lượt kiểm tra:
1. Backend có đang chạy không? `netstat -ano | grep 3001` (Windows) hoặc `ss -tlnp | grep 3001` (Linux). Nếu không thấy, cd vào `backend/` chạy `npm run dev`.
2. File `backend/.env` có tồn tại không? Nếu mất, copy lại từ `.env.example` và điền `DATABASE_URL`, `JWT_SECRET`, `INITIAL_ADMIN_PASSWORD`.
3. Sau khi sửa `.env`, **phải restart backend thủ công** (`Ctrl+C` rồi `npm run dev` lại) — ts-node-dev không tự reload khi `.env` đổi.
4. Test trực tiếp bằng curl để loại trừ vấn đề browser:
   ```bash
   curl -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"<mật khẩu>"}'
   ```
   - Trả `{"error":"Sai tên..."}` → backend OK, chỉ là sai credentials.
   - Trả `Connection refused` → backend chưa chạy.
5. Nếu frontend chạy ở origin khác backend (vd `localhost:5173` → `localhost:3001`), thêm origin vào `ALLOWED_ORIGINS` trong `backend/.env`:
   ```env
   ALLOWED_ORIGINS=http://localhost:5173,http://192.168.1.x:5173
   ```

**Quên mật khẩu admin / cần reset password**
```bash
cd backend
node -e "const{PrismaClient}=require('@prisma/client');const b=require('bcryptjs');(async()=>{const p=new PrismaClient();await p.user.update({where:{username:'admin'},data:{password:await b.hash('MatKhauMoi@123',10)}});console.log('OK');await p.\$disconnect();})()"
```
Đổi `MatKhauMoi@123` thành mật khẩu bạn muốn. Áp dụng cho cả dev lẫn Pi.

**Truy cập `http://<IP-Pi>:3001` báo `Cannot GET /` (production)**  
Backend chạy bình thường nhưng không serve frontend → thiếu thư mục/symlink `backend/public`. Express serve frontend từ `backend/public/`, mặc định `install.sh` / `deploy.sh` sẽ copy `frontend/dist` vào đây. Nếu vì lý do nào đó folder bị mất, tạo lại bằng symlink:
```bash
cd ~/KE-TOAN-HSL
ln -sfn $(pwd)/frontend/dist $(pwd)/backend/public
pm2 restart ke-toan-backend
```

**Wipe toàn bộ database và làm lại từ đầu (dev hoặc Pi)**
```bash
cd backend
# Dừng backend trước (Ctrl+C nếu dev, pm2 stop ke-toan-backend nếu Pi)
npx prisma db push --force-reset --accept-data-loss
npx prisma db seed   # tùy chọn — chỉ nếu muốn dữ liệu mẫu (dev)
# Khởi động lại backend, admin sẽ tự tạo theo INITIAL_ADMIN_PASSWORD trong .env
```

**Bật full security headers khi deploy sau HTTPS reverse proxy**  
Khi đặt backend sau nginx/caddy có TLS, set biến môi trường để bật HSTS + COOP + Origin-Agent-Cluster cùng lúc:
```env
# backend/.env
ENABLE_HSTS=1
```
Mặc định 3 header này tắt vì trên LAN HTTP (vd `192.168.1.x`) browser sẽ ignore và in warning trong console. Khi đã có HTTPS thật thì bật lại để tận dụng tối đa security.
