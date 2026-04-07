import { Request, Response } from 'express';
import { supplierPaymentService } from './supplier-payment.service';

export const supplierPaymentController = {
  async getAll(_req: Request, res: Response) {
    try {
      res.json(await supplierPaymentService.getAll());
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { purchaseOrderId, supplierId, amount, method, note } = req.body;
      if (!amount) return res.status(400).json({ error: 'Thiếu số tiền' });
      if (!purchaseOrderId && !supplierId) return res.status(400).json({ error: 'Thiếu mã đơn nhập hoặc mã NCC' });
      res.status(201).json(await supplierPaymentService.create({ purchaseOrderId, supplierId, amount, method, note }));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
