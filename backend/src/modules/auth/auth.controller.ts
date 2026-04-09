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

  async getSetupStatus(_req: Request, res: Response) {
    try {
      res.json(await authService.getSetupStatus());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async setupFirstAdmin(req: Request, res: Response) {
    try {
      const { username, password, name } = req.body || {};
      const result = await authService.setupFirstAdmin({ username, password, name }, req.ip);
      res.json(result);
    } catch (err: any) {
      // 409 Conflict nếu đã có user (chống re-setup); 400 cho validation
      const status = err?.alreadyInitialized ? 409 : 400;
      res.status(status).json({ error: err.message });
    }
  },
};
