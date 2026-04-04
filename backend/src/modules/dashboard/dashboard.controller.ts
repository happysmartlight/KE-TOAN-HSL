import { Request, Response } from 'express';
import { dashboardService } from './dashboard.service';

export const dashboardController = {
  async getChartData(req: Request, res: Response) {
    try {
      const data = await dashboardService.getChartData();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
