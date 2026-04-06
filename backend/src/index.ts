import { app } from './app';
import { cashflowCategoryService } from './modules/cashflow-category/cashflow-category.service';
import { backupService } from './modules/backup/backup.service';
import { writeLog } from './utils/logger';

const PORT = process.env.PORT || 3001;

// Seed default cashflow categories then start
cashflowCategoryService.seed().then(() => {
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
});
