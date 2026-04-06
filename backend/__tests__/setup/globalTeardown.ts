import fs from 'fs';
import path from 'path';

const TEST_DB = path.resolve(__dirname, '../../prisma/test.db');

export default async function globalTeardown() {
  // Remove test database after all system tests complete
  if (fs.existsSync(TEST_DB)) {
    fs.unlinkSync(TEST_DB);
    console.log('[globalTeardown] Test DB removed');
  }
  // Also clean up WAL/SHM files if present (SQLite artifacts)
  for (const ext of ['-wal', '-shm']) {
    const f = TEST_DB + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}
