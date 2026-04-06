import { execSync } from 'child_process';
import path from 'path';
import bcrypt from 'bcryptjs';

const TEST_DB = path.resolve(__dirname, '../../prisma/test.db');

export default async function globalSetup() {
  // Point Prisma at the test database
  process.env.DATABASE_URL = `file:${TEST_DB}`;
  process.env.JWT_SECRET = 'test-secret-for-ci';

  // Reset and apply schema to the test database
  execSync('npx prisma db push --force-reset --skip-generate', {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB}` },
    stdio: 'pipe',
  });

  // Seed a test admin user so auth tests can log in
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${TEST_DB}` } },
  });

  try {
    const hash = await bcrypt.hash('admin123', 10);
    await prisma.user.upsert({
      where: { username: 'testadmin' },
      update: {},
      create: {
        username: 'testadmin',
        password: hash,
        name: 'Test Admin',
        role: 'admin',
      },
    });

    const staffHash = await bcrypt.hash('staff123', 10);
    await prisma.user.upsert({
      where: { username: 'teststaff' },
      update: {},
      create: {
        username: 'teststaff',
        password: staffHash,
        name: 'Test Staff',
        role: 'staff',
      },
    });
  } finally {
    await prisma.$disconnect();
  }

  console.log('[globalSetup] Test DB ready at', TEST_DB);
}
