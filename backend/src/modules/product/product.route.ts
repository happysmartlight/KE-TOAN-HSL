import { Router } from 'express';
import { productController } from './product.controller';

export const productRouter = Router();

productRouter.get('/', productController.getAll);
productRouter.get('/dashboard', productController.getDashboard);
productRouter.get('/:id', productController.getById);
productRouter.post('/', productController.create);
productRouter.put('/:id', productController.update);
productRouter.delete('/:id', productController.delete);
