import { Router } from 'express';
import { adminController } from './admin.controller';

export const adminRouter = Router();

adminRouter.get('/stats',           adminController.getStats);
adminRouter.get('/health',          adminController.getHealth);
adminRouter.delete('/purge/:group', adminController.purgeGroup);
adminRouter.delete('/purge-all',    adminController.purgeAll);
adminRouter.get('/rank-config',     adminController.getRankConfig);
adminRouter.put('/rank-config',     adminController.saveRankConfig);
