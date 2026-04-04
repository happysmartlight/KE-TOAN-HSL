const path = require('path');

module.exports = {
  apps: [
    {
      name: 'ke-toan-backend',
      script: path.join(__dirname, 'backend/dist/index.js'),
      cwd: path.join(__dirname, 'backend'),
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        // DATABASE_URL dùng đường dẫn tuyệt đối để tránh lỗi khi PM2 chạy từ thư mục khác
        DATABASE_URL: 'file:' + path.join(__dirname, 'backend/prisma/dev.db'),
        JWT_SECRET: 'ke-toan-noi-bo-secret-2024',
      },
      watch: false,
      autorestart: true,
      max_memory_restart: '300M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
