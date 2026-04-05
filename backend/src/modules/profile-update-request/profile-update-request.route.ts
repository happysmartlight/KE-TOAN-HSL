import { Router } from 'express';
import { purController } from './profile-update-request.controller';
import { requireAdmin } from '../../middleware/auth.middleware';

export const purRouter = Router();

purRouter.post('/',                purController.create);           // staff: submit request
purRouter.get('/mine',             purController.getMine);          // staff: own requests
purRouter.get('/count',            requireAdmin, purController.getPendingCount); // admin: badge count
purRouter.get('/',                 requireAdmin, purController.getAll);          // admin: all
purRouter.patch('/:id/approve',    requireAdmin, purController.approve);
purRouter.patch('/:id/reject',     requireAdmin, purController.reject);
