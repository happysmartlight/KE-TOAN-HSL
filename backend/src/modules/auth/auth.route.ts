import { Router } from 'express';
import { authController } from './auth.controller';
import { requireAuth } from '../../middleware/auth.middleware';

export const authRouter = Router();

authRouter.post('/login', authController.login);
authRouter.post('/register', authController.register);
authRouter.get('/me', requireAuth, authController.getMe);
