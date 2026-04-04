import { Request, Response } from 'express';
import { paymentService } from './payment.service';

export const paymentController = {
  async getAll(req: Request, res: Response) {
    try {
      res.json(await paymentService.getAll());
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { invoiceId, amount, method, note } = req.body;
      if (!invoiceId || !amount) {
        return res.status(400).json({ error: 'Thiếu thông tin thanh toán' });
      }
      const payment = await paymentService.create({ invoiceId, amount, method, note });
      res.status(201).json(payment);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
