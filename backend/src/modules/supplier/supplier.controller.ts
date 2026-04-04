import { Request, Response } from 'express';
import { supplierService } from './supplier.service';

export const supplierController = {
  async getAll(req: Request, res: Response) {
    try {
      res.json(await supplierService.getAll());
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const supplier = await supplierService.getById(Number(req.params.id));
      if (!supplier) return res.status(404).json({ error: 'Không tìm thấy nhà cung cấp' });
      res.json(supplier);
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { name, phone, email, address } = req.body;
      if (!name) return res.status(400).json({ error: 'Tên nhà cung cấp là bắt buộc' });
      res.status(201).json(await supplierService.create({ name, phone, email, address }));
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      res.json(await supplierService.update(Number(req.params.id), req.body));
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await supplierService.delete(Number(req.params.id));
      res.json({ message: 'Đã xóa nhà cung cấp' });
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },
};
