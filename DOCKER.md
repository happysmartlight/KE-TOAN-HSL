# Docker — Triển khai trên Linux / Raspberry Pi 5

Hướng dẫn ngắn để chạy hệ thống bằng Docker Compose. Phù hợp cho RPi5 (arm64),
VPS Linux x86_64, hoặc bất kỳ máy nào có Docker Engine + Compose plugin.

---

## 1. Yêu cầu

- Docker Engine ≥ 24
- Docker Compose plugin (`docker compose version`)
- RPi5: dùng Raspberry Pi OS 64-bit (arm64)

Cài Docker trên RPi5:
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo systemctl enable --now docker
```
Logout/login lại để nhóm `docker` có hiệu lực.

---

## 2. Cấu hình + start (1 lệnh)

```bash
git clone <repo> ke-toan-noi-bo
cd ke-toan-noi-bo
make up
```

Hoặc nếu không có `make`:
```bash
bash scripts/docker-init.sh
```

Script tự động:
1. Kiểm tra `docker`, `docker compose`, `openssl` đã có
2. Nếu `.env` chưa có → sinh ngẫu nhiên `DB_PASSWORD`, `DB_ROOT_PASSWORD`,
   `JWT_SECRET` (bằng `openssl rand -hex`) và ghi ra `.env` (chmod 600)
3. Nếu `.env` đã có → giữ nguyên (idempotent)
4. Chạy `docker compose up -d --build`

> `INITIAL_ADMIN_PASSWORD` mặc định để trống → frontend sẽ tự hiện trang
> **"Khởi tạo hệ thống lần đầu"** ở bước 3 để bạn đặt admin qua UI.

---

## 3. Build & start (cách thủ công, nếu không dùng script)

```bash
cp .env.docker.example .env
# Sửa .env: DB password, JWT_SECRET, ...
docker compose up -d --build
```

Lần đầu chậm (~5–15 phút trên RPi5 vì build TS + Vite). Lần sau cache layer rất nhanh.

Theo dõi log:
```bash
docker compose logs -f app
```

Mở trình duyệt: `http://<ip-server>:3001`

Lần đầu chạy (DB rỗng), frontend sẽ tự hiển thị trang **"Khởi tạo hệ thống lần đầu"**
— điền username + họ tên + mật khẩu (≥12 ký tự, mix chữ/số/đặc biệt) → Khởi tạo →
đăng nhập tự động vào dashboard. Không cần sửa `.env` thêm lần nào.

> Nếu bạn đã set `INITIAL_ADMIN_PASSWORD` trong `.env` thì backend tự seed admin
> trước khi UI render, nên trang setup sẽ bị skip — đi thẳng tới Login.

---

## 4. Kiến trúc container

```
┌─────────────────────────────┐     ┌──────────────────┐
│  app (Node 20 + Vite SPA)   │────▶│  db (MariaDB 11) │
│  port 3001 → host           │     │  internal only   │
│  /api/* + serves frontend   │     │                  │
└─────────────────────────────┘     └──────────────────┘
        │                                   │
        ▼                                   ▼
  ./data/prisma     ./data/backups     dbdata (named volume)
  (schema +              (mysqldump
   rank/backup            output)
   config JSON)
```

- **`app`**: serve cả API và frontend từ cùng port 3001 → không cần nginx
- **`db`**: chỉ accessible từ network nội bộ Docker, không expose port 3306 ra host
- **`dbdata`**: named volume cho `/var/lib/mysql`
- **`./data/prisma`**: bind mount — chứa `schema.prisma`, `migrations/`, `rank-config.json`,
  `backup-config.json`. Schema và migrations được sync từ image mỗi lần start
  (entrypoint), nên rebuild ảnh là tự động lên schema mới.
- **`./data/backups`**: bind mount — output của auto-backup cron + tải về thủ công

---

## 5. Vận hành

| Việc cần làm | Lệnh |
|---|---|
| Start | `docker compose up -d` |
| Stop | `docker compose down` |
| Restart | `docker compose restart app` |
| Xem log | `docker compose logs -f app` |
| Vào shell container app | `docker compose exec app sh` |
| Vào MariaDB CLI | `docker compose exec db mariadb -u root -p` |
| Cập nhật code (sau git pull) | `docker compose up -d --build` |
| Backup thủ công (CLI) | `docker compose exec db sh -c 'mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"' > backup.sql` |

> Backup tải về qua UI Admin (Hệ thống → Sao lưu) cũng hoạt động bình thường —
> container `app` đã có sẵn `mysqldump`/`mysql` CLI để gọi sang `db`.

---

## 6. Cập nhật lên schema mới

Khi bạn pull code có migration mới:
```bash
git pull
docker compose up -d --build
```
Entrypoint tự chạy `prisma migrate deploy` trước khi server khởi động → DB tự sync.

Migration là idempotent — chạy lại an toàn. Không cần thao tác thủ công.

---

## 7. Backup chiến lược (production)

1. **Auto-backup cron** (built-in): vào UI Admin → "Tự động sao lưu" để bật.
   Output ghi vào `./data/backups` (bind mount → backup được kể cả khi container bị xoá).
2. **Backup volume MariaDB** (offsite): copy hoặc rsync `./data/backups/*.sql` lên S3,
   NAS, hoặc máy khác. Khuyến nghị daily.
3. **Snapshot thư mục `./data/`** trước mỗi lần `--build` lớn để có rollback nhanh.

---

## 8. Troubleshooting

**App không start, log báo `Can't reach database server at db:3306`**
→ Đợi MariaDB healthy (lần đầu init DB mất ~30s). Compose đã có `depends_on` healthcheck
nên thường tự xử lý. Nếu vẫn lỗi: `docker compose logs db`.

**Lỗi `EACCES` khi ghi vào `./data/`**
→ Trên Linux, bind mount kế thừa UID/GID host. Chạy:
```bash
sudo chown -R 1000:1000 data/
```
(node:20-slim chạy user `node` UID 1000.)

**Cần đổi port 3001**
→ Sửa `APP_PORT` trong `.env` rồi `docker compose up -d` (không cần build lại).

**Reset toàn bộ DB (nguy hiểm)**
```bash
docker compose down -v   # xoá luôn volume dbdata
rm -rf data/prisma data/backups
docker compose up -d --build
```

---

## 9. Build trên RPi5 vs build trên máy dev

Khuyến nghị: **build thẳng trên RPi5** (clone repo + `docker compose up -d --build`).
Đơn giản, không cần lo cross-platform.

Nếu muốn build từ máy dev x86_64 rồi đẩy image sang RPi5:
```bash
docker buildx build --platform linux/arm64 -t ketoan-app:latest --load .
docker save ketoan-app:latest | ssh pi@rpi 'docker load'
```
Sau đó trên RPi5 chỉnh `docker-compose.yml` để dùng `image:` thay vì `build:`.
