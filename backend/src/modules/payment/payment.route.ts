import { Router } from 'express';
import { paymentController } from './payment.controller';

export const paymentRouter = Router();

paymentRouter.get('/', paymentController.getAll);
paymentRouter.post('/', paymentController.create);
