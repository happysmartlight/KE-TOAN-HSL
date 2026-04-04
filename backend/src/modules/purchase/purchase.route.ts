import { Router } from 'express';
import { purchaseController } from './purchase.controller';
import { supplierPaymentController } from './supplier-payment.controller';
import { requireAdmin } from '../../middleware/auth.middleware';

export const purchaseRouter = Router();

purchaseRouter.get('/', purchaseController.getAll);
purchaseRouter.get('/:id', purchaseController.getById);
purchaseRouter.post('/', purchaseController.create);
purchaseRouter.patch('/:id/cancel', requireAdmin, purchaseController.cancel);

// Supplier payments
purchaseRouter.get('/supplier-payments/all', supplierPaymentController.getAll);
purchaseRouter.post('/supplier-payments', supplierPaymentController.create);
