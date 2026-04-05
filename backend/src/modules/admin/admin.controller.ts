import { Request, Response } from 'express';
import { adminService, GroupName } from './admin.service';

const VALID_GROUPS: GroupName[] = ['customers', 'suppliers', 'products', 'invoices', 'purchases', 'cashflow', 'logs'];

async function verifyPassword(req: Request, res: Response): Promise<boolean> {
  const { password } = req.body;
  if (!password) {
    res.status(400).json({ error: 'Cần nhập mật khẩu để xác nhận' });
    return false;
  }
  const userId = (req as any).user?.id;
  const valid = await adminService.verifyAdminPassword(userId, password);
  if (!valid) {
    res.status(403).json({ error: 'Mật khẩu không đúng' });
    return false;
  }
  return true;
}

export const adminController = {
  async getStats(req: Request, res: Response) {
    try {
      const stats = await adminService.getStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  getHealth(_req: Request, res: Response) {
    try {
      res.json(adminService.getHealth());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async purgeGroup(req: Request, res: Response) {
    const { group } = req.params;
    if (!VALID_GROUPS.includes(group as GroupName)) {
      return res.status(400).json({ error: 'Group không hợp lệ' });
    }
    if (!await verifyPassword(req, res)) return;
    try {
      await adminService.purgeGroup(group as GroupName);
      res.json({ ok: true, group });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async purgeAll(req: Request, res: Response) {
    if (!await verifyPassword(req, res)) return;
    try {
      await adminService.purgeAll();
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  getRankConfig(_req: Request, res: Response) {
    try {
      res.json(adminService.getRankConfig());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  saveRankConfig(req: Request, res: Response) {
    try {
      const body = req.body; // { customer?, supplier?, product?, user? }
      const VALID_GROUPS = ['customer', 'supplier', 'product', 'user'];
      const hasValid = VALID_GROUPS.some((g) => Array.isArray(body[g]) && body[g].length > 0);
      if (!hasValid) {
        return res.status(400).json({ error: 'Cần ít nhất một group hợp lệ (customer/supplier/product/user)' });
      }
      const config = adminService.saveRankConfig(body);
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
