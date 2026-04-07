// PHẢI load .env TRƯỚC khi import './app' — vì app.ts đọc process.env.ALLOWED_ORIGINS
// ở top-level lúc module load. Nếu không pre-load, biến sẽ undefined → CORS chặn frontend.
import 'dotenv/config';
import { app } from './app';
import { cashflowCategoryService } from './modules/cashflow-category/cashflow-category.service';
import { backupService } from './modules/backup/backup.service';
import { authService } from './modules/auth/auth.service';
import { writeLog } from './utils/logger';
import prisma from './utils/prisma';

const PORT = process.env.PORT || 3001;
// Mặc định bind 127.0.0.1 — yêu cầu chạy sau reverse proxy (nginx/caddy).
// Chỉ đổi BIND_HOST khi bạn thực sự cần expose Node trực tiếp ra LAN.
const BIND_HOST = process.env.BIND_HOST || '127.0.0.1';

/**
 * Chỉ tạo admin đầu tiên khi DB chưa có user nào VÀ INITIAL_ADMIN_PASSWORD được cấu hình.
 * Không còn fallback về 'admin123'. Nếu thiếu env, in cảnh báo rồi bỏ qua —
 * người vận hành phải set INITIAL_ADMIN_PASSWORD và restart, hoặc tạo user thủ công qua DB.
 */
async function seedAdminIfNeeded() {
  const count = await prisma.user.count();
  if (count > 0) return;

  const initial = process.env.INITIAL_ADMIN_PASSWORD;
  const username = process.env.INITIAL_ADMIN_USERNAME || 'admin';

  if (!initial) {
    console.warn('[seed] DB rỗng nhưng INITIAL_ADMIN_PASSWORD chưa được set.');
    console.warn('[seed] Hãy đặt INITIAL_ADMIN_PASSWORD trong .env (≥12 ký tự, gồm 3/4 nhóm chữ/số/đặc biệt) và khởi động lại.');
    return;
  }

  try {
    const hashed = await authService.hashPassword(initial);
    await prisma.user.create({
      data: { username, password: hashed, name: 'Quản trị viên', role: 'admin' },
    });
    console.log(`[seed] Đã tạo admin "${username}" theo INITIAL_ADMIN_PASSWORD.`);
    console.log('[seed] ⚠️  Đổi mật khẩu sau khi đăng nhập lần đầu và xoá INITIAL_ADMIN_PASSWORD khỏi .env.');
  } catch (err: any) {
    console.error('[seed] Không thể tạo admin:', err.message);
  }
}

async function bootstrap() {
  await seedAdminIfNeeded();
  await cashflowCategoryService.seed();
  backupService.startCron();
  app.listen(Number(PORT), BIND_HOST, () => {
    console.log(`Server running on ${BIND_HOST}:${PORT}`);
    writeLog({
      action:  'info',
      module:  'system',
      message: `Server khởi động trên port ${PORT}`,
      level:   'info',
    });
  });
}

bootstrap();
