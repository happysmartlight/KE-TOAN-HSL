import { Request, Response } from 'express';
import { logService } from './log.service';

export const logController = {
  async getAll(req: Request, res: Response) {
    try {
      const { level, username, from, to, search, limit, offset } = req.query as any;
      const data = await logService.getAll({
        level, username, from, to, search,
        limit:  limit  ? Number(limit)  : 200,
        offset: offset ? Number(offset) : 0,
      });
      res.json(data);
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async clear(req: Request, res: Response) {
    try {
      const days = Number(req.query.days) || 30;
      const result = await logService.clear(days);
      res.json(result);
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },
};
