import { Router } from 'express';
import { customerController } from './customer.controller';

export const customerRouter = Router();

customerRouter.get('/', customerController.getAll);
customerRouter.get('/tax-lookup/:taxCode', customerController.taxLookup);
customerRouter.get('/:id', customerController.getById);
customerRouter.post('/', customerController.create);
customerRouter.put('/:id', customerController.update);
customerRouter.delete('/:id', customerController.delete);
