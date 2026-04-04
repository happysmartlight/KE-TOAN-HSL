import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
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
import { requireAuth, requireAdmin } from './middleware/auth.middleware';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Public routes
app.use('/api/auth', authRouter);
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected routes
app.use('/api/customers', requireAuth, customerRouter);
app.use('/api/invoices', requireAuth, invoiceRouter);
app.use('/api/cashflow', requireAuth, cashflowRouter);
app.use('/api/payments', requireAuth, paymentRouter);
app.use('/api/inventory', requireAuth, inventoryRouter);
app.use('/api/reports', requireAuth, reportRouter);
app.use('/api/suppliers', requireAuth, supplierRouter);
app.use('/api/purchases', requireAuth, purchaseRouter);
app.use('/api/products', requireAuth, productRouter);
app.use('/api/users', requireAuth, userRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);
app.use('/api/delete-requests', requireAuth, deleteRequestRouter);

// Backup endpoint (admin only)
app.get('/api/admin/backup', requireAdmin, (_req, res) => {
  const dbPath = path.join(__dirname, '../../prisma/dev.db');
  if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'Database không tìm thấy' });
  const date = new Date().toISOString().slice(0, 10);
  res.download(dbPath, `backup-ke-toan-${date}.db`);
});

// Serve frontend static files (production)
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
