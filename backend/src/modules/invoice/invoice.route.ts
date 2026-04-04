import { Router } from 'express';
import { invoiceController } from './invoice.controller';
import { requireAdmin } from '../../middleware/auth.middleware';

export const invoiceRouter = Router();

invoiceRouter.get('/', invoiceController.getAll);
invoiceRouter.get('/:id', invoiceController.getById);
invoiceRouter.post('/', invoiceController.create);
invoiceRouter.patch('/:id/cancel', requireAdmin, invoiceController.cancel);
invoiceRouter.delete('/:id', requireAdmin, invoiceController.delete);
