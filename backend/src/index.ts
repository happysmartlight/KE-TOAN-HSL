import express from 'express';
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
import { requireAuth, requireAdmin } from './middleware/auth.middleware';

const app = express();
const PORT = process.env.PORT || 3001;

// Allow all origins — needed for LAN mobile access
app.use(cors({ origin: '*' }));
app.use(express.json());

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
app.use('/api/cashflow-categories', requireAuth, cashflowCategoryRouter);

// Admin data management (admin only)
app.use('/api/admin', requireAdmin, adminRouter);

const DB_PATH = path.join(__dirname, '../../prisma/dev.db');

// ── Backup — tải về file db ──
app.get('/api/admin/backup', requireAdmin, (_req, res) => {
  if (!fs.existsSync(DB_PATH)) return res.status(404).json({ error: 'Database không tìm thấy' });
  const date = new Date().toISOString().slice(0, 10);
  res.download(DB_PATH, `backup-ke-toan-${date}.db`);
});

// ── Restore — upload file db để khôi phục ──
const uploadTmp = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../prisma')),
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
    // Validate: kiểm tra SQLite magic bytes (53 51 4C 69 74 65 ...)
    const buf = Buffer.alloc(16);
    const fd  = fs.openSync(tmpPath, 'r');
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    const magic = buf.toString('ascii', 0, 16);
    if (!magic.startsWith('SQLite format 3')) {
      fs.unlinkSync(tmpPath);
      return res.status(400).json({ error: 'File không phải SQLite database hợp lệ' });
    }

    // Backup db hiện tại trước khi ghi đè
    if (fs.existsSync(DB_PATH)) {
      const safeBak = DB_PATH + '.pre-restore-' + Date.now();
      fs.copyFileSync(DB_PATH, safeBak);
    }

    // Ghi đè db bằng file upload
    fs.copyFileSync(tmpPath, DB_PATH);
    fs.unlinkSync(tmpPath);

    res.json({ ok: true, message: 'Khôi phục thành công. Vui lòng khởi động lại server.' });
  } catch (err: any) {
    if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    res.status(500).json({ error: 'Lỗi khi restore: ' + err.message });
  }
});

// Serve frontend static files (production)
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Seed default cashflow categories then start
cashflowCategoryService.seed().then(() => {
  // Bind to all interfaces (0.0.0.0) so it's accessible on LAN
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (accessible on LAN)`);
  });
}).catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

export default app;
