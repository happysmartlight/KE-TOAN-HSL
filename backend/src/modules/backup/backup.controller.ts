import { Request, Response } from 'express';
import fs from 'fs';
import { backupService } from './backup.service';
import { writeLog } from '../../utils/logger';

export const backupController = {
  async getConfig(_req: Request, res: Response) {
    try {
      const cfg = backupService.getConfig();
      res.json({ ...cfg, password: cfg.password ? '••••••' : '' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async saveConfig(req: Request, res: Response) {
    try {
      const { enabled, schedule, keepCount, encrypt, password } = req.body;
      const current = backupService.getConfig();
      const updated = backupService.saveConfig({
        enabled:   enabled   !== undefined ? Boolean(enabled)   : current.enabled,
        schedule:  schedule  || current.schedule,
        keepCount: keepCount ? Number(keepCount) : current.keepCount,
        encrypt:   encrypt   !== undefined ? Boolean(encrypt)   : current.encrypt,
        // Chỉ cập nhật password nếu không phải chuỗi masked
        password:  password && password !== '••••••' ? password : current.password,
      });
      backupService.startCron(); // restart cron với lịch mới
      await writeLog({
        userId:   (req as any).user?.id,
        username: (req as any).user?.username,
        action:   'update',
        module:   'backup',
        message:  `Cập nhật auto backup: ${updated.enabled ? 'BẬT' : 'TẮT'}, lịch: ${updated.schedule}`,
        level:    'info',
      });
      res.json({ ...updated, password: updated.password ? '••••••' : '' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  async listBackups(_req: Request, res: Response) {
    try {
      res.json(backupService.listBackups());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async runNow(req: Request, res: Response) {
    try {
      const filename = await backupService.performBackup('manual');
      await writeLog({
        userId:   (req as any).user?.id,
        username: (req as any).user?.username,
        action:   'backup',
        module:   'backup',
        message:  `Backup thủ công thành công: ${filename}`,
        level:    'info',
      });
      res.json({ ok: true, filename });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async downloadFile(req: Request, res: Response) {
    try {
      const filePath = backupService.getBackupFilePath(req.params.filename);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File không tồn tại' });
      res.download(filePath, req.params.filename);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async deleteFile(req: Request, res: Response) {
    try {
      backupService.deleteBackup(req.params.filename);
      await writeLog({
        userId:   (req as any).user?.id,
        username: (req as any).user?.username,
        action:   'delete',
        module:   'backup',
        message:  `Xoá file backup: ${req.params.filename}`,
        level:    'warning',
      });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
};
