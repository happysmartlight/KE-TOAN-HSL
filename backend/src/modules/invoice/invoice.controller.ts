import { Request, Response } from 'express';
import { invoiceService } from './invoice.service';

export const invoiceController = {
  async getAll(req: Request, res: Response) {
    try {
      res.json(await invoiceService.getAll());
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const invoice = await invoiceService.getById(Number(req.params.id));
      if (!invoice) return res.status(404).json({ error: 'Không tìm thấy hóa đơn' });
      res.json(invoice);
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { customerId, items, note } = req.body;
      if (!customerId || !items || items.length === 0) {
        return res.status(400).json({ error: 'Thiếu thông tin hóa đơn' });
      }
      const invoice = await invoiceService.create({ customerId, items, note });
      res.status(201).json(invoice);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async cancel(req: Request, res: Response) {
    try {
      await invoiceService.cancel(Number(req.params.id));
      res.json({ message: 'Đã hủy hóa đơn' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await invoiceService.delete(Number(req.params.id));
      res.json({ message: 'Đã xóa hóa đơn' });
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },
};
