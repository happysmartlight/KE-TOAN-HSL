import { execSync } from 'child_process';
import path from 'path';
import bcrypt from 'bcryptjs';

const TEST_DB_URL = process.env.DATABASE_URL || 'mysql://ketoan:ketoantest@localhost:3306/ke_toan_test';

export default async function globalSetup() {
  process.env.DATABASE_URL = TEST_DB_URL;
  // Phải ≥32 ký tự (utils/jwt.ts validate ngay tại import)
  process.env.JWT_SECRET   = process.env.JWT_SECRET || 'test-secret-for-ci-do-not-use-in-production-0123456789abcdef';

  // Reset schema và tạo lại toàn bộ bảng
  execSync('npx prisma db push --force-reset --skip-generate', {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'pipe',
  });

  // Seed test users
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({
    datasources: { db: { url: TEST_DB_URL } },
  });

  try {
    const hash = await bcrypt.hash('admin123', 10);
    await prisma.user.upsert({
      where: { username: 'testadmin' },
      update: {},
      create: { username: 'testadmin', password: hash, name: 'Test Admin', role: 'admin' },
    });

    const staffHash = await bcrypt.hash('staff123', 10);
    await prisma.user.upsert({
      where: { username: 'teststaff' },
      update: {},
      create: { username: 'teststaff', password: staffHash, name: 'Test Staff', role: 'staff' },
    });
  } finally {
    await prisma.$disconnect();
  }

  console.log('[globalSetup] Test DB ready:', TEST_DB_URL);
}
