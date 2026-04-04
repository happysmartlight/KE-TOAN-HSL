import { Request, Response } from 'express';
import { cashflowService } from './cashflow.service';

export const cashflowController = {
  async getAll(req: Request, res: Response) {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      res.json(await cashflowService.getAll(from, to));
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { type, category, amount, description } = req.body;
      if (!type || !amount) return res.status(400).json({ error: 'Thiếu thông tin' });
      res.status(201).json(await cashflowService.create({ type, category: category || 'other', amount, description }));
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async getSummary(req: Request, res: Response) {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      res.json(await cashflowService.getSummary(from, to));
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await cashflowService.delete(Number(req.params.id));
      res.json({ message: 'Đã xóa bút toán' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
