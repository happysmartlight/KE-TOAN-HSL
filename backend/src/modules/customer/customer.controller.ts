import { Request, Response } from 'express';
import { customerService } from './customer.service';

export const customerController = {
  async getAll(req: Request, res: Response) {
    try {
      const customers = await customerService.getAll();
      res.json(customers);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const customer = await customerService.getById(Number(req.params.id));
      if (!customer) return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
      res.json(customer);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { name, phone, email, address, companyName, taxCode } = req.body;
      if (!name) return res.status(400).json({ error: 'Tên khách hàng là bắt buộc' });
      const customer = await customerService.create({ name, phone, email, address, companyName, taxCode });
      res.status(201).json(customer);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const customer = await customerService.update(Number(req.params.id), req.body);
      res.json(customer);
    } catch (err) {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async taxLookup(req: Request, res: Response) {
    try {
      const { taxCode } = req.params;
      if (!taxCode || taxCode.length < 10) {
        return res.status(400).json({ error: 'MST không hợp lệ (tối thiểu 10 số)' });
      }
      const result = await customerService.taxLookup(taxCode);
      res.json(result);
    } catch (err: any) {
      res.status(404).json({ error: err.message || 'Không tìm thấy thông tin MST' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await customerService.delete(Number(req.params.id));
      res.json({ message: 'Đã xóa khách hàng' });
    } catch (err) {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },
};
