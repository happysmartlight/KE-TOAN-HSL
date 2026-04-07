// Runs in each test worker before modules are loaded.
// Points Prisma at the test database instead of dev.db.
process.env.DATABASE_URL = process.env.DATABASE_URL || 'mysql://ketoan:ketoantest@localhost:3306/ke_toan_test';
// JWT_SECRET phải ≥32 ký tự (yêu cầu của utils/jwt.ts từ wave 1 hardening)
process.env.JWT_SECRET   = process.env.JWT_SECRET || 'test-secret-for-ci-do-not-use-in-production-0123456789abcdef';
process.env.NODE_ENV     = 'test';
