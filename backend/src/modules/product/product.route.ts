import { Router } from 'express';
import { productController } from './product.controller';
import { requireAdmin } from '../../middleware/auth.middleware';

export const productRouter = Router();

productRouter.get('/', productController.getAll);
productRouter.get('/dashboard', productController.getDashboard);
productRouter.get('/:id', productController.getById);
productRouter.post('/', productController.create);
productRouter.put('/:id', productController.update);
// Xoá sản phẩm → admin only.
productRouter.delete('/:id', requireAdmin, productController.delete);
