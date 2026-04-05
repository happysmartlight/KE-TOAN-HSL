import { Router } from 'express';
import { deleteRequestController } from './deleterequest.controller';
import { requireAdmin } from '../../middleware/auth.middleware';

export const deleteRequestRouter = Router();

deleteRequestRouter.get('/',            requireAdmin, deleteRequestController.getAll);
deleteRequestRouter.get('/pending',     deleteRequestController.getPending);    // cả staff lẫn admin
deleteRequestRouter.get('/count',       deleteRequestController.countPending);  // badge counter (admin)
deleteRequestRouter.get('/mine',        deleteRequestController.getMine);       // staff: own requests
deleteRequestRouter.get('/mine/count',  deleteRequestController.countMine);     // staff: own pending count
deleteRequestRouter.post('/',           deleteRequestController.create);
deleteRequestRouter.patch('/:id',       requireAdmin, deleteRequestController.review);
