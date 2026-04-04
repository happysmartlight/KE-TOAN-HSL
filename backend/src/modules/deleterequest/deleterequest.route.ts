import { Router } from 'express';
import { deleteRequestController } from './deleterequest.controller';
import { requireAdmin } from '../../middleware/auth.middleware';

export const deleteRequestRouter = Router();

deleteRequestRouter.get('/',        requireAdmin, deleteRequestController.getAll);
deleteRequestRouter.get('/pending', deleteRequestController.getPending);   // cả staff lẫn admin
deleteRequestRouter.get('/count',   deleteRequestController.countPending); // badge counter
deleteRequestRouter.post('/',       deleteRequestController.create);
deleteRequestRouter.patch('/:id',   requireAdmin, deleteRequestController.review);
