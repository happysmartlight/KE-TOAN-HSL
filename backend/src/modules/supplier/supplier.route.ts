import { Router } from 'express';
import { supplierController } from './supplier.controller';
import { requireAdmin } from '../../middleware/auth.middleware';

export const supplierRouter = Router();

supplierRouter.get('/tax-lookup/:taxCode', supplierController.taxLookup);
supplierRouter.get('/', supplierController.getAll);
supplierRouter.get('/:id', supplierController.getById);
supplierRouter.post('/', supplierController.create);
supplierRouter.put('/:id', supplierController.update);
// Xoá NCC → admin only.
supplierRouter.delete('/:id', requireAdmin, supplierController.delete);
