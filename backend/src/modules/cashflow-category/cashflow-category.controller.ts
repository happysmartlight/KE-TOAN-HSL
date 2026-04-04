import { Request, Response } from 'express';
import { cashflowCategoryService } from './cashflow-category.service';

export const cashflowCategoryController = {
  async getAll(_req: Request, res: Response) {
    try {
      res.json(await cashflowCategoryService.getAll());
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { type, name } = req.body;
      if (!type || !name) return res.status(400).json({ error: 'Thiếu thông tin' });
      res.status(201).json(await cashflowCategoryService.create({ type, name }));
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { name, isActive } = req.body;
      res.json(await cashflowCategoryService.update(Number(req.params.id), { name, isActive }));
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await cashflowCategoryService.delete(Number(req.params.id));
      res.json({ message: 'Đã xóa' });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Lỗi server' });
    }
  },
};
