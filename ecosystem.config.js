const path = require('path');
const fs   = require('fs');

// ─────────────────────────────────────────────────────────────
// Đọc backend/.env thủ công.
//
// Lý do: PM2 env block GHI ĐÈ process.env của tiến trình con. Nếu chỉ
// liệt kê 1 vài biến ở đây, các biến khác trong .env sẽ KHÔNG được forward
// (đã từng gây lỗi BIND_HOST/ALLOWED_ORIGINS không có hiệu lực).
//
// Cách xử lý: parse toàn bộ backend/.env và spread vào env block để mọi
// biến hợp lệ trong .env đều được PM2 truyền sang Node process.
// ─────────────────────────────────────────────────────────────
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .reduce((acc, line) => {
      // Bỏ qua dòng trống và comment
      if (!line.trim() || line.trim().startsWith('#')) return acc;
      const match = line.match(/^\s*([^#\s=]+)\s*=\s*["']?(.*?)["']?\s*$/);
      if (match) acc[match[1]] = match[2];
      return acc;
    }, {});
}

const env = loadEnv(path.join(__dirname, 'backend/.env'));

// Validate sớm để fail loudly thay vì để Node crash loop âm thầm.
// Trước đây từng có fallback "ke-toan-noi-bo-secret-2025" (25 ký tự) gây
// crash loop vì backend yêu cầu JWT_SECRET >= 32 ký tự — đã loại bỏ.
if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
  throw new Error(
    'ecosystem.config.js: JWT_SECRET trong backend/.env không tồn tại hoặc quá ngắn (<32 ký tự).\n' +
    '  Sinh chuỗi an toàn: openssl rand -hex 64\n' +
    '  Rồi thêm vào backend/.env: JWT_SECRET=<chuỗi-vừa-sinh>'
  );
}
if (!env.DATABASE_URL) {
  throw new Error('ecosystem.config.js: DATABASE_URL trong backend/.env chưa được cấu hình.');
}

module.exports = {
  apps: [
    {
      name: 'ke-toan-backend',
      script: path.join(__dirname, 'backend/dist/index.js'),
      cwd: path.join(__dirname, 'backend'),
      env: {
        // Spread toàn bộ biến từ .env trước...
        ...env,
        // ...rồi override những biến cần fix cứng cho PM2
        NODE_ENV: 'production',
        PORT:     env.PORT     || 3001,
      },
      watch: false,
      autorestart: true,
      max_memory_restart: '300M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
