import { Router } from 'express';
import { supplierController } from './supplier.controller';

export const supplierRouter = Router();

supplierRouter.get('/tax-lookup/:taxCode', supplierController.taxLookup);
supplierRouter.get('/', supplierController.getAll);
supplierRouter.get('/:id', supplierController.getById);
supplierRouter.post('/', supplierController.create);
supplierRouter.put('/:id', supplierController.update);
supplierRouter.delete('/:id', supplierController.delete);
