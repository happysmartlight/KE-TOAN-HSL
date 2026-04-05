import { Request, Response } from 'express';
import { dashboardService } from './dashboard.service';

export const dashboardController = {
  async getChartData(req: Request, res: Response) {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      const data = await dashboardService.getChartData(year);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
