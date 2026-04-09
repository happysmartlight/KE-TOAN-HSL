import { Router } from 'express';
import { authController } from './auth.controller';
import { requireAuth } from '../../middleware/auth.middleware';

export const authRouter = Router();

authRouter.post('/login', authController.login);
// /register đã được gỡ — tạo user mới phải đi qua POST /api/users (admin-only).
// Cho phép self-registration trên app tài chính nội bộ là rủi ro privilege escalation.
authRouter.get('/me', requireAuth, authController.getMe);

// ── First-run setup (public) ─────────────────────────────────
// Cả 2 endpoint cố ý KHÔNG có requireAuth — đây là flow init lần đầu khi DB rỗng.
// Service tự kiểm tra User.count() === 0 trong transaction để chống re-setup,
// và authLimiter (10 req/15 phút) đã mount sẵn ở app.ts cho /api/auth.
authRouter.get('/setup-status', authController.getSetupStatus);
authRouter.post('/setup',       authController.setupFirstAdmin);
