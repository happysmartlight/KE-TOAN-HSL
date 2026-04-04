import { Router } from 'express';
import { userController } from './user.controller';
import { requireAdmin } from '../../middleware/auth.middleware';

export const userRouter = Router();

userRouter.get('/', requireAdmin, userController.getAll);
userRouter.post('/', requireAdmin, userController.create);
userRouter.put('/:id', requireAdmin, userController.update);
userRouter.delete('/:id', requireAdmin, userController.delete);
