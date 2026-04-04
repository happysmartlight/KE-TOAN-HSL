import { Request, Response } from 'express';
import { userService } from './user.service';

export const userController = {
  async getAll(req: Request, res: Response) {
    try {
      res.json(await userService.getAll());
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { username, password, name, role } = req.body;
      if (!username || !password || !name) return res.status(400).json({ error: 'Thiếu thông tin' });
      res.status(201).json(await userService.create({ username, password, name, role: role || 'staff' }));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      res.json(await userService.update(Number(req.params.id), req.body));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await userService.delete(Number(req.params.id), (req as any).user.id);
      res.json({ message: 'Đã xóa người dùng' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
