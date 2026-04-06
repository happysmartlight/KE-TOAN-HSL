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

  async getHealth(_req: Request, res: Response) {
    try {
      res.json(await adminService.getHealth());
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

  getTailscaleState(_req: Request, res: Response) {
    res.json(adminService.getTailscaleState());
  },

  startTailscaleSetup(_req: Request, res: Response) {
    const result = adminService.startTailscaleSetup();
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  },

  resetTailscaleState(_req: Request, res: Response) {
    adminService.resetTailscaleState();
    res.json({ ok: true });
  },

  // ── Server control ────────────────────────────────────────────────────────
  restartServer(_req: Request, res: Response) {
    adminService.restartServer();
    res.json({ ok: true });
  },

  async getStartupStatus(_req: Request, res: Response) {
    try {
      res.json(await adminService.getStartupStatus());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async setupStartup(_req: Request, res: Response) {
    try {
      res.json(await adminService.setupStartup());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  getNetworkInfo(_req: Request, res: Response) {
    try {
      res.json(adminService.getNetworkInfo());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // ── Update ──────────────────────────────────────────────────────────────
  getUpdateState(_req: Request, res: Response) {
    res.json(adminService.getUpdateState());
  },

  async checkForUpdates(_req: Request, res: Response) {
    try {
      await adminService.checkForUpdates();
      res.json(adminService.getUpdateState());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  startUpdate(_req: Request, res: Response) {
    const result = adminService.startUpdate();
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
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

  getVersion(_req: Request, res: Response) {
    try {
      res.json(adminService.getVersion());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
