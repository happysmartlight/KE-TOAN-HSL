import { Router } from 'express';
import { customerController } from './customer.controller';
import { requireAdmin } from '../../middleware/auth.middleware';

export const customerRouter = Router();

customerRouter.get('/', customerController.getAll);
customerRouter.get('/tax-lookup/:taxCode', customerController.taxLookup);
customerRouter.get('/:id', customerController.getById);
customerRouter.post('/', customerController.create);
customerRouter.put('/:id', customerController.update);
// Xoá khách hàng → admin only. Staff phải đi qua quy trình DeleteRequest.
customerRouter.delete('/:id', requireAdmin, customerController.delete);
