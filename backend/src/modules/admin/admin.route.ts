import { Router } from 'express';
import { adminController } from './admin.controller';

export const adminRouter = Router();

adminRouter.get('/stats',           adminController.getStats);
adminRouter.delete('/purge/:group', adminController.purgeGroup);
adminRouter.delete('/purge-all',    adminController.purgeAll);
