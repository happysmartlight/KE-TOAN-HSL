import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import cron, { ScheduledTask } from 'node-cron';
import { encryptBuffer } from '../../utils/backupCrypto';
import { writeLog } from '../../utils/logger';

const execFileAsync = promisify(execFile);

const CONFIG_PATH   = path.join(__dirname, '../../../prisma/backup-config.json');
export const BACKUP_DIR = path.join(__dirname, '../../../backups');

export interface BackupConfig {
  enabled:   boolean;
  schedule:  string;   // cron expression, vd: "0 2 * * *"
  keepCount: number;   // giữ tối đa N file
  encrypt:   boolean;
  password:  string;
}

const DEFAULT_CONFIG: BackupConfig = {
  enabled:   false,
  schedule:  '0 2 * * *',
  keepCount: 7,
  encrypt:   false,
  password:  '',
};

let cronTask: ScheduledTask | null = null;

/** Parse DATABASE_URL dạng mysql://user:pass@host:port/dbname */
function parseDbUrl(url: string) {
  const match = url.match(/^mysql:\/\/([^:]+):([^@]*)@([^:]+):(\d+)\/(.+)$/);
  if (!match) throw new Error('DATABASE_URL không đúng định dạng mysql://user:pass@host:port/dbname');
  return {
    user:     match[1],
    password: match[2],
    host:     match[3],
    port:     match[4],
    database: match[5],
  };
}

export const backupService = {
  getConfig(): BackupConfig {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) };
      }
    } catch {}
    return { ...DEFAULT_CONFIG };
  },

  saveConfig(data: Partial<BackupConfig>): BackupConfig {
    const current = this.getConfig();
    const updated: BackupConfig = { ...current, ...data };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
    return updated;
  },

  ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  },

  listBackups(): { filename: string; size: number; createdAt: string; encrypted: boolean }[] {
    this.ensureBackupDir();
    return fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('backup-') && (f.endsWith('.sql') || f.endsWith('.sql.enc')))
      .map((f) => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          filename:  f,
          size:      stat.size,
          createdAt: stat.mtime.toISOString(),
          encrypted: f.endsWith('.enc'),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /** Thực hiện backup lưu vào thư mục backups/ */
  async performBackup(triggeredBy: 'manual' | 'cron' = 'cron'): Promise<string> {
    this.ensureBackupDir();
    const config = this.getConfig();

    const db = parseDbUrl(process.env.DATABASE_URL || '');
    const ts  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const ext = config.encrypt && config.password ? '.sql.enc' : '.sql';
    const filename = `backup-${ts}${ext}`;
    const destPath = path.join(BACKUP_DIR, filename);

    // Chạy mysqldump
    const args = [
      `--host=${db.host}`,
      `--port=${db.port}`,
      `--user=${db.user}`,
      `--password=${db.password}`,
      '--single-transaction',
      '--routines',
      '--triggers',
      db.database,
    ];
    const { stdout } = await execFileAsync('mysqldump', args);
    let data: Buffer = Buffer.from(stdout, 'utf-8');

    if (config.encrypt && config.password) {
      data = Buffer.from(encryptBuffer(data, config.password));
    }
    fs.writeFileSync(destPath, data);

    // Xoá bớt backup cũ vượt keepCount
    const all = this.listBackups();
    if (all.length > config.keepCount) {
      all.slice(config.keepCount).forEach((b) => {
        try { fs.unlinkSync(path.join(BACKUP_DIR, b.filename)); } catch {}
      });
    }

    await writeLog({
      action:  'backup',
      module:  'backup',
      message: `Backup ${triggeredBy === 'manual' ? 'thủ công' : 'tự động'} thành công: ${filename}`,
      level:   'info',
    });

    return filename;
  },

  getBackupFilePath(filename: string): string {
    // Chặn path traversal
    const safe = path.basename(filename);
    return path.join(BACKUP_DIR, safe);
  },

  deleteBackup(filename: string): void {
    const filePath = this.getBackupFilePath(filename);
    if (!fs.existsSync(filePath)) throw new Error('File không tồn tại');
    fs.unlinkSync(filePath);
  },

  /** Khởi động hoặc restart cron job theo config hiện tại */
  startCron(): void {
    if (cronTask) { cronTask.stop(); cronTask = null; }
    const config = this.getConfig();
    if (!config.enabled || !config.schedule) return;
    if (!cron.validate(config.schedule)) {
      console.error('[backup-cron] Lịch không hợp lệ:', config.schedule);
      return;
    }
    cronTask = cron.schedule(config.schedule, async () => {
      try {
        const filename = await this.performBackup('cron');
        console.log('[backup-cron] Thành công:', filename);
      } catch (err: any) {
        console.error('[backup-cron] Thất bại:', err.message);
        writeLog({
          action:  'error',
          module:  'backup',
          message: `Auto backup thất bại: ${err.message}`,
          level:   'error',
        });
      }
    });
    console.log('[backup-cron] Đã lên lịch:', config.schedule);
  },

  stopCron(): void {
    if (cronTask) { cronTask.stop(); cronTask = null; }
  },
};
