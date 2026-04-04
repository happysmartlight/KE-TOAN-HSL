.PHONY: install deploy logs status restart stop

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
