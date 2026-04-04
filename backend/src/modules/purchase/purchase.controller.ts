import { Request, Response } from 'express';
import { purchaseService } from './purchase.service';

export const purchaseController = {
  async getAll(req: Request, res: Response) {
    try {
      res.json(await purchaseService.getAll());
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const purchase = await purchaseService.getById(Number(req.params.id));
      if (!purchase) return res.status(404).json({ error: 'Không tìm thấy đơn nhập hàng' });
      res.json(purchase);
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { supplierId, items, note } = req.body;
      if (!supplierId || !items || items.length === 0) {
        return res.status(400).json({ error: 'Thiếu thông tin đơn nhập hàng' });
      }
      const purchase = await purchaseService.create({ supplierId, items, note });
      res.status(201).json(purchase);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async cancel(req: Request, res: Response) {
    try {
      await purchaseService.cancel(Number(req.params.id));
      res.json({ message: 'Đã hủy đơn nhập hàng' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
