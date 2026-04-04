import { Router } from 'express';
import { cashflowController } from './cashflow.controller';
import { requireAdmin } from '../../middleware/auth.middleware';

export const cashflowRouter = Router();

cashflowRouter.get('/', cashflowController.getAll);
cashflowRouter.get('/summary', cashflowController.getSummary);
cashflowRouter.post('/', cashflowController.create);
cashflowRouter.delete('/:id', requireAdmin, cashflowController.delete);
