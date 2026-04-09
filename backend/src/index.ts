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
 * Bootstrap admin từ env var — escape hatch cho deploy headless (Docker CI/CD,
 * automation seed). Nếu env var KHÔNG set, im lặng bỏ qua: flow chuẩn cho người
 * dùng cuối là First-run Setup UI (xem auth.service#setupFirstAdmin + frontend
 * pages/FirstRunSetup.tsx).
 *
 * Quy tắc:
 *  - Chỉ chạy khi INITIAL_ADMIN_PASSWORD được set
 *  - Chỉ tạo nếu DB hoàn toàn rỗng (User.count() === 0)
 *  - Không log warning gì cả nếu env var trống — UI flow sẽ xử lý
 */
async function seedAdminIfNeeded() {
  const initial = process.env.INITIAL_ADMIN_PASSWORD;
  if (!initial) return; // Im lặng — UI First-run Setup sẽ lo

  const count = await prisma.user.count();
  if (count > 0) return;

  const username = process.env.INITIAL_ADMIN_USERNAME || 'admin';
  try {
    const hashed = await authService.hashPassword(initial);
    await prisma.user.create({
      data: { username, password: hashed, name: 'Quản trị viên', role: 'admin' },
    });
    console.log(`[seed] Bootstrap admin "${username}" từ INITIAL_ADMIN_PASSWORD (env var).`);
    console.log('[seed] ⚠️  Đổi mật khẩu sau khi đăng nhập và xoá INITIAL_ADMIN_PASSWORD khỏi env.');
  } catch (err: any) {
    console.error('[seed] Bootstrap admin thất bại:', err.message);
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
