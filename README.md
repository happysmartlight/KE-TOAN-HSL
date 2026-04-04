# Kế Toán Nội Bộ

Hệ thống kế toán nội bộ cho doanh nghiệp nhỏ.  
Stack: Node.js + TypeScript + Express + Prisma + SQLite + React + Vite

---

## Cài đặt trên Raspberry Pi (lần đầu)

```bash
# 1. Cài Node.js 20 (nếu chưa có)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Clone repo
git clone <repo-url> ke-toan-noi-bo
cd ke-toan-noi-bo

# 3. Cài đặt & chạy (1 lệnh duy nhất)
bash install.sh
```

Sau khi xong, copy lệnh PM2 startup được in ra và chạy nó (để tự khởi động khi reboot).

---

## Cập nhật (sau khi có thay đổi code)

```bash
git pull
bash deploy.sh
```

Hoặc dùng `make`:

```bash
make deploy
```

---

## Lệnh quản lý

| Lệnh | Tác dụng |
|------|----------|
| `make install` | Cài đặt lần đầu |
| `make deploy` | Cập nhật sau git pull |
| `make logs` | Xem logs realtime |
| `make status` | Trạng thái PM2 |
| `make restart` | Restart service |
| `make stop` | Dừng service |

---

## Tài khoản mặc định

| Username | Password | Quyền |
|----------|----------|-------|
| `admin` | `admin123` | Admin |
| `nhanvien` | `staff123` | Staff |

> **Đổi mật khẩu ngay sau lần đăng nhập đầu tiên.**

---

## Truy cập

- Local: `http://localhost:3001`
- LAN: `http://<IP-Raspberry-Pi>:3001`

Xem IP: `hostname -I`

---

## Cấu trúc

```
ke-toan-noi-bo/
├── backend/          # Express + Prisma API
│   ├── prisma/       # Schema & migrations
│   └── src/          # Source TypeScript
├── frontend/         # React + Vite
├── install.sh        # Cài đặt lần đầu
├── deploy.sh         # Cập nhật
├── ecosystem.config.js  # PM2 config
└── Makefile          # Lệnh tắt
```
