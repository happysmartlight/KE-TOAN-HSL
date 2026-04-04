import { Request, Response } from 'express';
import { supplierPaymentService } from './supplier-payment.service';

export const supplierPaymentController = {
  async getAll(req: Request, res: Response) {
    try {
      res.json(await supplierPaymentService.getAll());
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { supplierId, amount, method, note } = req.body;
      if (!supplierId || !amount) return res.status(400).json({ error: 'Thiếu thông tin' });
      res.status(201).json(await supplierPaymentService.create({ supplierId, amount, method, note }));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
