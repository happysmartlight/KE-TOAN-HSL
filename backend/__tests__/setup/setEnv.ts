// Runs in each test worker before modules are loaded.
// Points Prisma at the test database instead of dev.db.
import path from 'path';

const TEST_DB = path.resolve(__dirname, '../../prisma/test.db');
process.env.DATABASE_URL = `file:${TEST_DB}`;
process.env.JWT_SECRET = 'test-secret-for-ci';
process.env.NODE_ENV = 'test';
