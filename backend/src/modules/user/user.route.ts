import { Router } from 'express';
import { userController } from './user.controller';
import { requireAdmin } from '../../middleware/auth.middleware';

export const userRouter = Router();

// Staff-accessible routes (requireAuth applied at index.ts level)
userRouter.get('/me',           userController.getMe);
userRouter.put('/me/password',  userController.updateMyPassword);

// Admin-only routes
userRouter.get('/',                       requireAdmin, userController.getAll);
userRouter.get('/kpi',                    requireAdmin, userController.getKpi);
userRouter.post('/',                      requireAdmin, userController.create);
userRouter.put('/:id',                    requireAdmin, userController.update);
userRouter.delete('/:id',                 requireAdmin, userController.delete);
userRouter.get('/:id/employment-history', requireAdmin, userController.getEmploymentHistory);
userRouter.post('/:id/resign',            requireAdmin, userController.resign);
userRouter.post('/:id/reinstate',         requireAdmin, userController.reinstate);
