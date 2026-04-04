#!/bin/bash
# Backup SQLite database tự động
# Chạy bằng cron: 0 2 * * * /path/to/backup.sh

BACKUP_DIR="$(dirname "$0")/../backups"
DB_PATH="$(dirname "$0")/../prisma/dev.db"
DATE=$(date +%Y-%m-%d_%H-%M)
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"

# Copy database
cp "$DB_PATH" "$BACKUP_DIR/backup_$DATE.db"

# Nén file backup
gzip "$BACKUP_DIR/backup_$DATE.db"

echo "[$(date)] Backup thành công: backup_$DATE.db.gz"

# Xóa backup cũ hơn KEEP_DAYS ngày
find "$BACKUP_DIR" -name "backup_*.db.gz" -mtime +$KEEP_DAYS -delete
echo "[$(date)] Đã xóa backup cũ hơn $KEEP_DAYS ngày"
