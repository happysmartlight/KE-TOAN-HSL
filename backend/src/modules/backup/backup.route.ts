import { Router } from 'express';
import { backupController } from './backup.controller';

export const backupRouter = Router();

backupRouter.get('/config',           backupController.getConfig);
backupRouter.post('/config',          backupController.saveConfig);
backupRouter.get('/list',             backupController.listBackups);
backupRouter.post('/run',             backupController.runNow);
backupRouter.get('/files/:filename',  backupController.downloadFile);
backupRouter.delete('/files/:filename', backupController.deleteFile);
