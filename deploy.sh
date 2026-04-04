#!/bin/bash
# Script deploy lên Raspberry Pi 5

echo "=== Build Backend ==="
cd backend
npm install --production=false
npx prisma generate
npm run build
cd ..

echo "=== Build Frontend ==="
cd frontend
npm install
npm run build
cd ..

echo "=== Copy frontend dist vào backend/public ==="
mkdir -p backend/public
cp -r frontend/dist/* backend/public/

echo "=== Khởi động PM2 ==="
pm2 stop ke-toan-backend 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "=== Done! Truy cập: http://$(hostname -I | awk '{print $1}'):3001 ==="
