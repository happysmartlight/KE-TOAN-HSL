import { Request, Response } from 'express';
import { inventoryService } from './inventory.service';

export const inventoryController = {
  async getLogs(req: Request, res: Response) {
    try {
      const productId = req.query.productId ? Number(req.query.productId) : undefined;
      res.json(await inventoryService.getLogs(productId));
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async getLowStock(req: Request, res: Response) {
    try {
      const threshold = req.query.threshold ? Number(req.query.threshold) : 5;
      res.json(await inventoryService.getLowStock(threshold));
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },
};
