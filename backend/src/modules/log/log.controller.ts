import { Request, Response } from 'express';
import { logService } from './log.service';
import { writeLog } from '../../utils/logger';

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

  async clientError(req: Request, res: Response) {
    try {
      const { message, level, source } = req.body;
      if (!message) return res.status(400).json({ error: 'Thiếu message' });
      await writeLog({
        userId:   (req as any).user?.id,
        username: (req as any).user?.username,
        action:   'error',
        module:   source || 'frontend',
        message:  String(message).slice(0, 2000), // giới hạn độ dài
        level:    ['info','warning','error','critical'].includes(level) ? level : 'error',
        ip:       req.ip || undefined,
      });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },
};
