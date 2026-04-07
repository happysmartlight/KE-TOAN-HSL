import { Request, Response } from 'express';
import { authService } from './auth.service';

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: 'Thiếu thông tin đăng nhập' });
      const result = await authService.login(username, password, req.ip);
      res.json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  },

  async getMe(req: Request, res: Response) {
    try {
      const user = await authService.getMe((req as any).user.id);
      res.json(user);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  },
};
