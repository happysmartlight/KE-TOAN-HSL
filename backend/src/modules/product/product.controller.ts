import { Request, Response } from 'express';
import { productService } from './product.service';

export const productController = {
  async getAll(req: Request, res: Response) {
    try {
      res.json(await productService.getAll());
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const product = await productService.getById(Number(req.params.id));
      if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
      res.json(product);
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { name, sku, unit, costPrice, sellingPrice, stock } = req.body;
      if (!name) return res.status(400).json({ error: 'Tên sản phẩm là bắt buộc' });
      res.status(201).json(await productService.create({ name, sku, unit, costPrice, sellingPrice, stock }));
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      res.json(await productService.update(Number(req.params.id), req.body));
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await productService.delete(Number(req.params.id));
      res.json({ message: 'Đã xóa sản phẩm' });
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },
};
