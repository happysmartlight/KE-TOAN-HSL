import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { customerRouter } from './modules/customer/customer.route';
import { invoiceRouter } from './modules/invoice/invoice.route';
import { cashflowRouter } from './modules/cashflow/cashflow.route';
import { paymentRouter } from './modules/payment/payment.route';
import { inventoryRouter } from './modules/inventory/inventory.route';
import { reportRouter } from './modules/report/report.route';
import { supplierRouter } from './modules/supplier/supplier.route';
import { purchaseRouter } from './modules/purchase/purchase.route';
import { productRouter } from './modules/product/product.route';
import { authRouter } from './modules/auth/auth.route';
import { userRouter } from './modules/user/user.route';
import { dashboardRouter } from './modules/dashboard/dashboard.route';
import { deleteRequestRouter } from './modules/deleterequest/deleterequest.route';
import { logRouter } from './modules/log/log.route';
import { cashflowCategoryRouter } from './modules/cashflow-category/cashflow-category.route';
import { cashflowCategoryService } from './modules/cashflow-category/cashflow-category.service';
import { adminRouter } from './modules/admin/admin.route';
import { purRouter } from './modules/profile-update-request/profile-update-request.route';
import { backupRouter } from './modules/backup/backup.route';
import { backupService } from './modules/backup/backup.service';
import { requireAuth, requireAdmin } from './middleware/auth.middleware';
import { writeLog } from './utils/logger';
import { encryptBuffer, decryptBuffer, isEncrypted } from './utils/backupCrypto';

const app = express();
const PORT = process.env.PORT || 3001;

// Allow all origins — needed for LAN mobile access
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── Global error logger middleware ──
// Intercepts all API responses with status >= 400 and auto-logs them
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.path.startsWith('/api/') || req.path === '/api/health') return next();

  const _json = res.json.bind(res);
  (res.json as any) = function (body: any) {
    if (res.statusCode >= 400) {
      const module = req.path.split('/').filter(Boolean)[1]; // /api/users/1 → 'users'
      const errMsg = body?.error || body?.message || '';
      writeLog({
        action:   'error',
        module,
        message:  `[${res.statusCode}] ${req.method} ${req.path}${errMsg ? ' — ' + errMsg : ''}`,
        level:    res.statusCode >= 500 ? 'error' : 'warning',
        ip:       req.ip || undefined,
        username: (req as any).user?.username,
        userId:   (req as any).user?.id,
      }); // fire-and-forget, writeLog tự handle lỗi
    }
    return _json(body);
  };
  next();
});

// Public routes
app.use('/api/auth', authRouter);
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected routes
app.use('/api/customers',          requireAuth, customerRouter);
app.use('/api/invoices',           requireAuth, invoiceRouter);
app.use('/api/cashflow',           requireAuth, cashflowRouter);
app.use('/api/payments',           requireAuth, paymentRouter);
app.use('/api/inventory',          requireAuth, inventoryRouter);
app.use('/api/reports',            requireAuth, reportRouter);
app.use('/api/suppliers',          requireAuth, supplierRouter);
app.use('/api/purchases',          requireAuth, purchaseRouter);
app.use('/api/products',           requireAuth, productRouter);
app.use('/api/users',              requireAuth, userRouter);
app.use('/api/dashboard',          requireAuth, dashboardRouter);
app.use('/api/delete-requests',    requireAuth, deleteRequestRouter);
app.use('/api/logs',               requireAuth, logRouter);
app.use('/api/cashflow-categories',     requireAuth, cashflowCategoryRouter);
app.use('/api/profile-update-requests', requireAuth, purRouter);

// Admin data management (admin only)
app.use('/api/admin',  requireAdmin, adminRouter);
app.use('/api/backup', requireAdmin, backupRouter);

const DB_PATH = path.join(__dirname, '../prisma/dev.db');

// ── Backup — tải về file db (có thể mã hoá) ──
app.get('/api/admin/backup', requireAdmin, async (req, res) => {
  if (!fs.existsSync(DB_PATH)) {
    await writeLog({ action: 'error', module: 'backup', message: 'Backup thất bại: DB không tìm thấy', level: 'error' });
    return res.status(404).json({ error: 'Database không tìm thấy' });
  }
  try {
    const password = req.query.password as string | undefined;
    const date = new Date().toISOString().slice(0, 10);
    let data = fs.readFileSync(DB_PATH);
    let filename: string;
    if (password) {
      data = Buffer.from(encryptBuffer(data, password));
      filename = `backup-ke-toan-${date}.db.enc`;
    } else {
      filename = `backup-ke-toan-${date}.db`;
    }
    await writeLog({
      userId:   (req as any).user?.id,
      username: (req as any).user?.username,
      action:   'backup',
      module:   'backup',
      message:  `Backup tải về: ${filename}${password ? ' (mã hoá)' : ''}`,
      level:    'info',
      ip:       req.ip || undefined,
    });
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(data);
  } catch (err: any) {
    await writeLog({ action: 'error', module: 'backup', message: `Backup thất bại: ${err.message}`, level: 'error' });
    res.status(500).json({ error: 'Lỗi backup: ' + err.message });
  }
});

// ── Restore — upload file db để khôi phục ──
const uploadTmp = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../prisma')),
    filename:    (_req, _file, cb) => cb(null, `restore-tmp-${Date.now()}.db`),
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // max 100MB
  fileFilter: (_req, file, cb) => {
    // Chỉ chấp nhận .db file
    if (file.originalname.endsWith('.db') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file .db'));
    }
  },
});

app.post('/api/admin/restore', requireAdmin, uploadTmp.single('db'), async (req, res) => {
  const tmpPath = (req as any).file?.path;
  if (!tmpPath) return res.status(400).json({ error: 'Không nhận được file upload' });

  try {
    let data = fs.readFileSync(tmpPath);

    // Nếu file được mã hoá → giải mã trước
    if (isEncrypted(data)) {
      const password = req.body.restorePassword as string;
      if (!password) {
        fs.unlinkSync(tmpPath);
        return res.status(400).json({ error: 'File mã hoá (.enc) cần nhập mật khẩu để khôi phục' });
      }
      try {
        data = Buffer.from(decryptBuffer(data, password));
      } catch (err: any) {
        fs.unlinkSync(tmpPath);
        return res.status(400).json({ error: err.message });
      }
    }

    // Validate: kiểm tra SQLite magic bytes
    if (!data.subarray(0, 16).toString('ascii').startsWith('SQLite format 3')) {
      fs.unlinkSync(tmpPath);
      return res.status(400).json({ error: 'File không phải SQLite database hợp lệ' });
    }

    // Backup db hiện tại trước khi ghi đè
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, DB_PATH + '.pre-restore-' + Date.now());
    }

    // Ghi đè db bằng dữ liệu đã giải mã
    fs.writeFileSync(DB_PATH, data);
    fs.unlinkSync(tmpPath);

    await writeLog({
      userId:   (req as any).user?.id,
      username: (req as any).user?.username,
      action:   'restore',
      module:   'backup',
      message:  'Khôi phục database thành công',
      level:    'warning',
      ip:       req.ip || undefined,
    });

    res.json({ ok: true, message: 'Khôi phục thành công. Vui lòng khởi động lại server.' });
  } catch (err: any) {
    if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    await writeLog({ action: 'error', module: 'backup', message: `Restore thất bại: ${err.message}`, level: 'critical' });
    res.status(500).json({ error: 'Lỗi khi restore: ' + err.message });
  }
});

// Serve frontend static files (production)
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// ── Global unhandled Express error handler (next(err) calls) ──
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const module = req.path.split('/').filter(Boolean)[1];
  writeLog({
    action:   'error',
    module,
    message:  `[500] ${req.method} ${req.path} — ${err?.message || 'Unhandled error'}`,
    level:    'critical',
    ip:       req.ip || undefined,
    username: (req as any).user?.username,
    userId:   (req as any).user?.id,
  });
  if (!res.headersSent) res.status(500).json({ error: err?.message || 'Lỗi server' });
});

// Seed default cashflow categories then start
cashflowCategoryService.seed().then(() => {
  backupService.startCron(); // Khởi động auto backup theo config đã lưu
  // Bind to all interfaces (0.0.0.0) so it's accessible on LAN
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (accessible on LAN)`);
    writeLog({
      action:  'info',
      module:  'system',
      message: `Server khởi động trên port ${PORT}`,
      level:   'info',
    });
  });
}).catch((err) => {
  console.error('Seed failed:', err);
  writeLog({ action: 'error', module: 'system', message: `Seed thất bại: ${err?.message}`, level: 'critical' });
  process.exit(1);
});

export default app;
