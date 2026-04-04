import { Router } from 'express';
import { cashflowCategoryController } from './cashflow-category.controller';
import { requireAdmin } from '../../middleware/auth.middleware';

export const cashflowCategoryRouter = Router();

cashflowCategoryRouter.get('/',     cashflowCategoryController.getAll);
cashflowCategoryRouter.post('/',    requireAdmin, cashflowCategoryController.create);
cashflowCategoryRouter.put('/:id',  requireAdmin, cashflowCategoryController.update);
cashflowCategoryRouter.delete('/:id', requireAdmin, cashflowCategoryController.delete);
