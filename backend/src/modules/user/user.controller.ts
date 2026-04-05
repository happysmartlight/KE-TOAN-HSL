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

  async getKpi(_req: Request, res: Response) {
    try {
      res.json(await userService.getKpi());
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async getMe(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      res.json(await userService.getMe(userId));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { username, password, name, role, email, phone, startDate, employmentStatus } = req.body;
      if (!username || !password || !name) return res.status(400).json({ error: 'Thiếu thông tin' });
      res.status(201).json(await userService.create({
        username, password, name, role: role || 'staff',
        email, phone, startDate, employmentStatus,
      }));
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

  async updateMyPassword(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Thiếu thông tin' });
      await userService.updateMyPassword(userId, currentPassword, newPassword);
      res.json({ ok: true, message: 'Đổi mật khẩu thành công' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async getEmploymentHistory(req: Request, res: Response) {
    try {
      res.json(await userService.getEmploymentHistory(Number(req.params.id)));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async resign(req: Request, res: Response) {
    try {
      const { endDate, note } = req.body;
      if (!endDate) return res.status(400).json({ error: 'Cần nhập ngày nghỉ' });
      await userService.resign(Number(req.params.id), new Date(endDate), note);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async reinstate(req: Request, res: Response) {
    try {
      const { startDate, note } = req.body;
      if (!startDate) return res.status(400).json({ error: 'Cần nhập ngày kích hoạt' });
      await userService.reinstate(Number(req.params.id), new Date(startDate), note);
      res.json({ ok: true });
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
