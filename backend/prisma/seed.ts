// CLI wrapper — chạy khi `npm run db:seed`
// Logic seed thực tế nằm ở backend/src/seed/seed-demo.ts để có thể được
// import từ admin runtime (vì rootDir của tsconfig là src/, prisma/ không build).
import { PrismaClient } from '@prisma/client';
import { seedDemoData } from '../src/seed/seed-demo';

const prisma = new PrismaClient();

seedDemoData(prisma, { verbose: true })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
