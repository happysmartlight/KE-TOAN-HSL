import { Router } from 'express';
import { inventoryController } from './inventory.controller';

export const inventoryRouter = Router();

inventoryRouter.get('/logs', inventoryController.getLogs);
inventoryRouter.get('/low-stock', inventoryController.getLowStock);
