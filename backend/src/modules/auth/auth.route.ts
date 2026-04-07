import { Router } from 'express';
import { authController } from './auth.controller';
import { requireAuth } from '../../middleware/auth.middleware';

export const authRouter = Router();

authRouter.post('/login', authController.login);
// /register đã được gỡ — tạo user mới phải đi qua POST /api/users (admin-only).
// Cho phép self-registration trên app tài chính nội bộ là rủi ro privilege escalation.
authRouter.get('/me', requireAuth, authController.getMe);
