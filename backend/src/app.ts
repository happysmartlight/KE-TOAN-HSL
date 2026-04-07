import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
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
import { adminRouter } from './modules/admin/admin.route';
import { purRouter } from './modules/profile-update-request/profile-update-request.route';
import { backupRouter } from './modules/backup/backup.route';
import { requireAuth, requireAdmin } from './middleware/auth.middleware';
import { writeLog } from './utils/logger';
import { encryptBuffer, decryptBuffer, isEncrypted } from './utils/backupCrypto';

const execFileAsync = promisify(execFile);

export const app = express();

/** Parse DATABASE_URL dạng mysql://user:pass@host:port/dbname
 *  Hỗ trợ password có ký tự đặc biệt (kể cả '@') bằng greedy match tới '@' cuối cùng
 *  trước host:port, và tự decodeURIComponent cho user/password.
 */
function parseDbUrl(url: string) {
  const match = url.match(/^mysql:\/\/([^:@]+):(.*)@([^:@/]+):(\d+)\/([^?]+)(?:\?.*)?$/);
  if (!match) throw new Error('DATABASE_URL không đúng định dạng');
  const dec = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
  return {
    user:     dec(match[1]),
    password: dec(match[2]),
    host:     match[3],
    port:     match[4],
    database: match[5],
  };
}

// ── Trust proxy ──
// Backend chạy sau nginx/caddy → tin tưởng X-Forwarded-* từ 1 hop ngược lại,
// để req.ip phản ánh IP client thật (cần cho rate-limit & audit log).
app.set('trust proxy', 1);

// ── CORS whitelist ──
// ALLOWED_ORIGINS = danh sách origin cách nhau bằng dấu phẩy
// (vd: "https://ketoan.example.com,https://lan.example.com").
// Bỏ trống → đồng nghĩa same-origin only (frontend đã được serve cùng host).
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin / curl / server-to-server (no Origin header) → cho qua.
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.length === 0) return cb(null, false);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error('Origin không được phép'));
    },
    credentials: true,
  }),
);

// ── Security headers (helmet) ──
// CSP để mặc định an toàn cho SPA: chỉ cho phép tài nguyên cùng origin
// + inline style cho Tailwind/Vite và data:/blob: cho ảnh.
// Nếu bạn nhúng iframe / font CDN ngoài, mở rộng ở đây.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'"],
        styleSrc:   ["'self'", "'unsafe-inline'"],
        imgSrc:     ["'self'", 'data:', 'blob:'],
        fontSrc:    ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc:  ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    // HSTS chỉ có hiệu lực khi truy cập qua HTTPS — nginx sẽ xử lý cert.
    hsts: { maxAge: 60 * 60 * 24 * 180, includeSubDomains: true },
  }),
);

app.use(express.json({ limit: '2mb' }));

// ── Rate limit ──
// Bỏ qua khi chạy test (NODE_ENV=test) để supertest không bị 429.
const RATE_LIMIT_DISABLED = process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === '1';
const noopLimiter = (_req: Request, _res: Response, next: NextFunction) => next();

// Auth endpoints (login...) — chống brute-force credential.
const authLimiter = RATE_LIMIT_DISABLED ? noopLimiter : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  limit: 10,                // tối đa 10 request / IP / 15 phút
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Quá nhiều lần thử. Hãy đợi vài phút rồi thử lại.' },
});
// Global limiter — chống abuse / scrape.
const globalLimiter = RATE_LIMIT_DISABLED ? noopLimiter : rateLimit({
  windowMs: 60 * 1000, // 1 phút
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);

// ── Global error logger middleware ──
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.path.startsWith('/api/') || req.path === '/api/health') return next();

  const _json = res.json.bind(res);
  (res.json as any) = function (body: any) {
    if (res.statusCode >= 400) {
      const module = req.path.split('/').filter(Boolean)[1];
      const errMsg = body?.error || body?.message || '';
      writeLog({
        action:   'error',
        module,
        message:  `[${res.statusCode}] ${req.method} ${req.path}${errMsg ? ' — ' + errMsg : ''}`,
        level:    res.statusCode >= 500 ? 'error' : 'warning',
        ip:       req.ip || undefined,
        username: (req as any).user?.username,
        userId:   (req as any).user?.id,
      });
    }
    return _json(body);
  };
  next();
});

// Public routes
app.use('/api/auth', authLimiter, authRouter);
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected routes
app.use('/api/customers',               requireAuth, customerRouter);
app.use('/api/invoices',                requireAuth, invoiceRouter);
app.use('/api/cashflow',                requireAuth, cashflowRouter);
app.use('/api/payments',                requireAuth, paymentRouter);
app.use('/api/inventory',               requireAuth, inventoryRouter);
app.use('/api/reports',                 requireAuth, reportRouter);
app.use('/api/suppliers',               requireAuth, supplierRouter);
app.use('/api/purchases',               requireAuth, purchaseRouter);
app.use('/api/products',                requireAuth, productRouter);
app.use('/api/users',                   requireAuth, userRouter);
app.use('/api/dashboard',               requireAuth, dashboardRouter);
app.use('/api/delete-requests',         requireAuth, deleteRequestRouter);
app.use('/api/logs',                    requireAuth, logRouter);
app.use('/api/cashflow-categories',     requireAuth, cashflowCategoryRouter);
app.use('/api/profile-update-requests', requireAuth, purRouter);

// Admin only
app.use('/api/admin',  requireAdmin, adminRouter);
app.use('/api/backup', requireAdmin, backupRouter);

// ── Backup — tải về file .sql ──
app.get('/api/admin/backup', requireAdmin, async (req, res) => {
  try {
    const db = parseDbUrl(process.env.DATABASE_URL || '');
    const password = req.query.password as string | undefined;
    const date = new Date().toISOString().slice(0, 10);

    const args = [
      `--host=${db.host}`,
      `--port=${db.port}`,
      `--user=${db.user}`,
      '--single-transaction',
      '--routines',
      '--triggers',
      db.database,
    ];
    const { stdout } = await execFileAsync('mysqldump', args, {
      env: { ...process.env, MYSQL_PWD: db.password },
      maxBuffer: 1024 * 1024 * 512, // 512MB
    });
    let data: Buffer = Buffer.from(stdout, 'utf-8');
    let filename: string;

    if (password) {
      data = Buffer.from(encryptBuffer(data, password));
      filename = `backup-ke-toan-${date}.sql.enc`;
    } else {
      filename = `backup-ke-toan-${date}.sql`;
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
    res.status(500).json({ error: 'Lỗi backup: ' + err.message });
  }
});

// ── Restore — upload file .sql ──
const uploadTmp = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../prisma')),
    filename:    (_req, _file, cb) => cb(null, `restore-tmp-${Date.now()}.sql`),
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.originalname.endsWith('.sql')
      || file.originalname.endsWith('.sql.enc')
      || file.mimetype === 'application/octet-stream'
      || file.mimetype === 'text/plain';
    ok ? cb(null, true) : cb(new Error('Chỉ chấp nhận file .sql hoặc .sql.enc'));
  },
});

app.post('/api/admin/restore', requireAdmin, uploadTmp.single('db'), async (req, res) => {
  const tmpPath = (req as any).file?.path;
  if (!tmpPath) return res.status(400).json({ error: 'Không nhận được file upload' });

  try {
    let data = fs.readFileSync(tmpPath);

    // Giải mã nếu file được mã hoá
    if (isEncrypted(data)) {
      const password = req.body.restorePassword as string;
      if (!password) {
        fs.unlinkSync(tmpPath);
        return res.status(400).json({ error: 'File mã hoá cần nhập mật khẩu để khôi phục' });
      }
      try {
        data = Buffer.from(decryptBuffer(data, password));
      } catch (err: any) {
        fs.unlinkSync(tmpPath);
        return res.status(400).json({ error: err.message });
      }
    }

    // Validate: file phải là MariaDB/MySQL dump
    const header = data.subarray(0, 200).toString('utf-8');
    if (!header.includes('MariaDB dump') && !header.includes('MySQL dump')) {
      fs.unlinkSync(tmpPath);
      return res.status(400).json({ error: 'File không phải MariaDB/MySQL dump hợp lệ' });
    }

    // Chạy mysql để restore — pipe data vào stdin
    const db = parseDbUrl(process.env.DATABASE_URL || '');
    await new Promise<void>((resolve, reject) => {
      const child = spawn('mysql', [
        `--host=${db.host}`,
        `--port=${db.port}`,
        `--user=${db.user}`,
        db.database,
      ], {
        env: { ...process.env, MYSQL_PWD: db.password },
      });
      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
      child.on('close', (code) => {
        code === 0 ? resolve() : reject(new Error(`mysql exit ${code}: ${stderr}`));
      });
      child.on('error', reject);
      child.stdin.write(data);
      child.stdin.end();
    });

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
    res.status(500).json({ error: 'Lỗi khi restore: ' + err.message });
  }
});

// Serve frontend static files (production)
const publicPath = path.join(__dirname, '../public');
if (fs.existsSync(publicPath)) {
  // Vite sinh file hash-based trong thư mục /assets (vd: index-abc123.js).
  // Những file này an toàn để cache lâu dài vì đổi filename mỗi build.
  app.use(
    express.static(publicPath, {
      // index.html sẽ được xử lý riêng bên dưới để set no-cache
      index: false,
      setHeaders: (res, filePath) => {
        if (/[\\/]assets[\\/]/.test(filePath)) {
          // Asset có hash → cache 1 năm, immutable
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          // Các file tĩnh khác (favicon, robots.txt...) → cache ngắn
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
      },
    }),
  );

  // index.html phải LUÔN được revalidate để browser lấy reference tới
  // bundle JS/CSS mới nhất sau mỗi lần deploy.
  const sendIndex = (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma',        'no-cache');
    res.setHeader('Expires',       '0');
    res.sendFile(path.join(publicPath, 'index.html'));
  };
  app.get('/',  sendIndex);
  app.get('*',  sendIndex);
}

// ── Global unhandled Express error handler ──
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
