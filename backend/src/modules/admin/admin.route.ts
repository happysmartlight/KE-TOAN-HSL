import { Router, Request, Response } from 'express';
import { adminController } from './admin.controller';
import { getOnlineUsers } from '../../middleware/auth.middleware';

export const adminRouter = Router();

adminRouter.get('/online-users', (_req: Request, res: Response) => res.json(getOnlineUsers()));
adminRouter.get('/stats',           adminController.getStats);
adminRouter.get('/health',          adminController.getHealth);
adminRouter.delete('/purge/:group', adminController.purgeGroup);
adminRouter.delete('/purge-all',    adminController.purgeAll);
adminRouter.get('/network',               adminController.getNetworkInfo);
adminRouter.get('/tailscale/state',       adminController.getTailscaleState);
adminRouter.post('/tailscale/start',      adminController.startTailscaleSetup);
adminRouter.post('/tailscale/reset',      adminController.resetTailscaleState);
adminRouter.post('/restart',              adminController.restartServer);
adminRouter.get('/startup-status',        adminController.getStartupStatus);
adminRouter.post('/setup-startup',        adminController.setupStartup);
adminRouter.get('/update/state',          adminController.getUpdateState);
adminRouter.post('/update/check',         adminController.checkForUpdates);
adminRouter.post('/update/start',         adminController.startUpdate);
adminRouter.get('/rank-config',     adminController.getRankConfig);
adminRouter.put('/rank-config',     adminController.saveRankConfig);
adminRouter.get('/version',         adminController.getVersion);
