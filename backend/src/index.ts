import { app } from './app';
import { cashflowCategoryService } from './modules/cashflow-category/cashflow-category.service';
import { backupService } from './modules/backup/backup.service';
import { writeLog } from './utils/logger';
import prisma from './utils/prisma';
import bcrypt from 'bcryptjs';

const PORT = process.env.PORT || 3001;

/** Tự động tạo tài khoản admin mặc định nếu DB chưa có user nào */
async function seedAdminIfNeeded() {
  const count = await prisma.user.count();
  if (count > 0) return;

  const hashed = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: { username: 'admin', password: hashed, name: 'Quản trị viên', role: 'admin' },
  });
  console.log('[seed] Đã tạo tài khoản mặc định: admin / admin123');
  console.log('[seed] ⚠️  Vui lòng đổi mật khẩu sau khi đăng nhập lần đầu!');
}

async function bootstrap() {
  await seedAdminIfNeeded();
  await cashflowCategoryService.seed();
  backupService.startCron();
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (accessible on LAN)`);
    writeLog({
      action:  'info',
      module:  'system',
      message: `Server khởi động trên port ${PORT}`,
      level:   'info',
    });
  });
}

bootstrap();
