import { Request, Response } from 'express';
import { deleteRequestService } from './deleterequest.service';

export const deleteRequestController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await deleteRequestService.getAll()); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  },

  async getPending(req: Request, res: Response) {
    try { res.json(await deleteRequestService.getPending()); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  },

  async countPending(req: Request, res: Response) {
    try { res.json({ count: await deleteRequestService.countPending() }); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  },

  async create(req: Request, res: Response) {
    try {
      const requesterId = (req as any).user.id;  // JWT payload: { id, username, role }
      const result = await deleteRequestService.create(requesterId, req.body);
      res.status(201).json(result);
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  },

  async review(req: Request, res: Response) {
    try {
      const reviewerId = (req as any).user.id;  // JWT payload: { id, username, role }
      const { action } = req.body; // 'approved' | 'rejected'
      const result = await deleteRequestService.review(Number(req.params.id), reviewerId, action);
      res.json(result);
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  },

  async getMine(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      res.json(await deleteRequestService.getMine(userId));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  },

  async countMine(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      res.json({ count: await deleteRequestService.countMine(userId) });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  },
};
