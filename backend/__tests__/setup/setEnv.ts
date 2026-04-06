// Runs in each test worker before modules are loaded.
// Points Prisma at the test database instead of dev.db.
process.env.DATABASE_URL = 'file:./prisma/test.db';
process.env.JWT_SECRET = 'test-secret-for-ci';
process.env.NODE_ENV = 'test';
