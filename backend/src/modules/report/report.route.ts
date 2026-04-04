import { Router } from 'express';
import { reportController } from './report.controller';

export const reportRouter = Router();

reportRouter.get('/cashflow', reportController.getCashflow);
reportRouter.get('/profit-loss', reportController.getProfitLoss);
reportRouter.get('/debt', reportController.getDebtSummary);
