const path = require('path');
const fs   = require('fs');

// Đọc backend/.env thủ công — PM2 env block ghi đè .env nên phải parse tại đây
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .reduce((acc, line) => {
      const match = line.match(/^\s*([^#\s=]+)\s*=\s*["']?(.*?)["']?\s*$/);
      if (match) acc[match[1]] = match[2];
      return acc;
    }, {});
}

const env = loadEnv(path.join(__dirname, 'backend/.env'));

module.exports = {
  apps: [
    {
      name: 'ke-toan-backend',
      script: path.join(__dirname, 'backend/dist/index.js'),
      cwd: path.join(__dirname, 'backend'),
      env: {
        NODE_ENV:     'production',
        PORT:         env.PORT         || 3001,
        DATABASE_URL: env.DATABASE_URL || '',
        JWT_SECRET:   env.JWT_SECRET   || 'ke-toan-noi-bo-secret-2025',
      },
      watch: false,
      autorestart: true,
      max_memory_restart: '300M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
