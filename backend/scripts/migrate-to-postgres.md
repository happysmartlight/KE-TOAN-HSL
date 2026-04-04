# Hướng dẫn migrate SQLite → PostgreSQL

## Bước 1: Cài PostgreSQL
```bash
# Raspberry Pi / Ubuntu
sudo apt install postgresql postgresql-client -y
sudo -u postgres createuser --superuser ketoan
sudo -u postgres createdb ke_toan_noi_bo -O ketoan
sudo -u postgres psql -c "ALTER USER ketoan PASSWORD 'your_password';"
```

## Bước 2: Cập nhật schema.prisma
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

## Bước 3: Cập nhật .env
```
DATABASE_URL="postgresql://ketoan:your_password@localhost:5432/ke_toan_noi_bo"
```

## Bước 4: Tạo migration mới
```bash
npx prisma migrate dev --name switch-to-postgres
```

## Bước 5: Export data từ SQLite
```bash
# Cài pgloader
sudo apt install pgloader -y

# Chạy migration data
pgloader prisma/dev.db postgresql://ketoan:your_password@localhost/ke_toan_noi_bo
```

## Bước 6: Seed lại admin nếu cần
```bash
npm run db:seed
```

## Lưu ý
- Backup SQLite trước khi migrate
- Test kỹ trên môi trường staging trước
- PostgreSQL hỗ trợ concurrent users tốt hơn SQLite
