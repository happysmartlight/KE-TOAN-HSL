import { Request, Response } from 'express';
import { purService } from './profile-update-request.service';

export const purController = {
  async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { requestedData, reason } = req.body;
      if (!requestedData || typeof requestedData !== 'object') {
        return res.status(400).json({ error: 'Thiếu dữ liệu yêu cầu' });
      }
      const result = await purService.create(userId, requestedData, reason);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async getMine(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      res.json(await purService.getMine(userId));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getAll(req: Request, res: Response) {
    try {
      res.json(await purService.getAll());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getPendingCount(req: Request, res: Response) {
    try {
      res.json({ count: await purService.getPendingCount() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async approve(req: Request, res: Response) {
    try {
      const reviewerId = (req as any).user.id;
      await purService.approve(Number(req.params.id), reviewerId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async reject(req: Request, res: Response) {
    try {
      const reviewerId = (req as any).user.id;
      const { adminNote } = req.body;
      await purService.reject(Number(req.params.id), reviewerId, adminNote || '');
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
