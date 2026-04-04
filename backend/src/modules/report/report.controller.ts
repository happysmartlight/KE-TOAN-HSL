import { Request, Response } from 'express';
import { reportService } from './report.service';

export const reportController = {
  async getCashflow(req: Request, res: Response) {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      res.json(await reportService.getCashflowReport(from, to));
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async getProfitLoss(req: Request, res: Response) {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      res.json(await reportService.getProfitLoss(from, to));
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },

  async getDebtSummary(req: Request, res: Response) {
    try {
      res.json(await reportService.getDebtSummary());
    } catch {
      res.status(500).json({ error: 'Lỗi server' });
    }
  },
};
