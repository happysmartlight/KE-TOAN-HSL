import { Router } from 'express';
import { logController } from './log.controller';
import { requireAdmin } from '../../middleware/auth.middleware';

export const logRouter = Router();

logRouter.get('/',        requireAdmin, logController.getAll);
logRouter.delete('/clear', requireAdmin, logController.clear);
