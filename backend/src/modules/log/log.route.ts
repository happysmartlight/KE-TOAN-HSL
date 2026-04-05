import { Router } from 'express';
import { logController } from './log.controller';
import { requireAdmin } from '../../middleware/auth.middleware';

export const logRouter = Router();

// Staff-accessible: frontend gửi lỗi client lên đây
logRouter.post('/client-error', logController.clientError);

// Admin-only
logRouter.get('/',         requireAdmin, logController.getAll);
logRouter.delete('/clear', requireAdmin, logController.clear);
