.PHONY: install deploy logs status restart stop up down docker-logs docker-init

# Cài đặt lần đầu (sau khi clone)
install:
	bash install.sh

# Cập nhật sau khi git pull
deploy:
	bash deploy.sh

# Xem logs realtime
logs:
	pm2 logs ke-toan-backend

# Trạng thái PM2
status:
	pm2 status

# Restart service
restart:
	pm2 restart ke-toan-backend

# Dừng service
stop:
	pm2 stop ke-toan-backend

# ── Docker stack ──────────────────────────────────────────
# Lần đầu: tự sinh .env (random secret) rồi build & up.
# Lần sau: idempotent — .env có sẵn thì giữ nguyên.
up:
	bash scripts/docker-init.sh

# Chỉ sinh .env, không up (dùng khi muốn review trước)
docker-init:
	bash scripts/docker-init.sh --no-up

# Tắt stack (KHÔNG xoá volume → data còn nguyên)
down:
	docker compose down

# Logs realtime của container app
docker-logs:
	docker compose logs -f app
