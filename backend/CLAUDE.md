# Backend — CLAUDE.md

## Stack

- **Node.js** + **TypeScript** + **Express.js**
- **Prisma ORM** + **SQLite** (`prisma/dev.db`)
- **JWT** auth (`jsonwebtoken` + `bcryptjs`)
- **Multer** — file upload (restore DB)

---

## Cấu trúc thư mục

```
backend/
├── prisma/
│   ├── schema.prisma           # Prisma schema (nguồn sự thật cho DB)
│   ├── dev.db                  # SQLite database
│   ├── migrations/             # Migration history
│   ├── rank-config.json        # Cấu hình ngưỡng rank (auto-created khi save)
│   └── backup-config.json      # Cấu hình auto-backup
├── src/
│   ├── index.ts                # Express app, route mounting, middleware
│   ├── middleware/
│   │   └── auth.middleware.ts  # requireAuth, requireAdmin
│   ├── utils/
│   │   ├── logger.ts           # writeLog() — non-blocking activity log
│   │   └── backupCrypto.ts     # Encrypt/decrypt backup file
│   └── modules/
│       ├── auth/               # Login, /me
│       ├── user/               # CRUD nhân sự, employment cycles
│       ├── customer/           # CRUD + tax lookup (MST API)
│       ├── supplier/           # CRUD
│       ├── product/            # CRUD + stock
│       ├── invoice/            # Tạo/hủy/xóa hóa đơn — nghiệp vụ phức tạp
│       ├── purchase/           # Đơn nhập hàng
│       ├── payment/            # Thanh toán hóa đơn
│       ├── cashflow/           # Thu/Chi
│       ├── cashflow-category/  # Danh mục thu/chi (có seed data)
│       ├── inventory/          # Xem log tồn kho
│       ├── report/             # Báo cáo doanh thu, lãi lỗ
│       ├── dashboard/          # KPI tổng quan, top customers
│       ├── deleterequest/      # Staff yêu cầu xóa → admin duyệt
│       ├── profile-update-request/  # Staff yêu cầu cập nhật hồ sơ
│       ├── log/                # ActivityLog viewer (admin)
│       ├── admin/              # Purge data, health, rank-config
│       └── backup/             # Auto-backup scheduler (cron)
```

Mỗi module có 3 file: `*.controller.ts` · `*.service.ts` · `*.route.ts`

---

## Route mounting (`src/index.ts`)

```ts
// Public
app.use('/api/auth', authRouter)
app.get('/api/health', ...)

// Authenticated (requireAuth)
app.use('/api/customers',           requireAuth, customerRouter)
app.use('/api/invoices',            requireAuth, invoiceRouter)
app.use('/api/cashflow',            requireAuth, cashflowRouter)
app.use('/api/payments',            requireAuth, paymentRouter)
app.use('/api/inventory',           requireAuth, inventoryRouter)
app.use('/api/reports',             requireAuth, reportRouter)
app.use('/api/suppliers',           requireAuth, supplierRouter)
app.use('/api/purchases',           requireAuth, purchaseRouter)
app.use('/api/products',            requireAuth, productRouter)
app.use('/api/users',               requireAuth, userRouter)
app.use('/api/dashboard',           requireAuth, dashboardRouter)
app.use('/api/delete-requests',     requireAuth, deleteRequestRouter)
app.use('/api/logs',                requireAuth, logRouter)
app.use('/api/cashflow-categories', requireAuth, cashflowCategoryRouter)
app.use('/api/profile-update-requests', requireAuth, purRouter)

// Admin only (requireAdmin)
app.use('/api/admin',  requireAdmin, adminRouter)
app.use('/api/backup', requireAdmin, backupRouter)
app.get('/api/admin/backup', requireAdmin, ...)   // download DB
app.post('/api/admin/restore', requireAdmin, ...) // upload DB
```

---

## Auth Middleware

```ts
// src/middleware/auth.middleware.ts
requireAuth   // kiểm tra JWT Bearer token → gán (req as any).user
requireAdmin  // requireAuth + kiểm tra role === 'admin'

// Trong controller:
const userId = (req as any).user?.id;
const role   = (req as any).user?.role;
```

JWT secret: `process.env.JWT_SECRET || 'ke-toan-noi-bo-secret-2024'`

---

## Prisma Schema — Models chính

```prisma
User          id, username, password, name, role, email, phone,
              startDate, endDate, employmentStatus
              Relations: employmentCycles, createdInvoices

Customer      id, name, phone, email, address, companyName, taxCode,
              debt (Float), status, deletedAt
              Relations: invoices, payments

Supplier      id, name, ..., supplierType, debt, status, deletedAt
              Relations: purchaseOrders, supplierPayments

Product       id, name, sku, unit, costPrice, sellingPrice,
              stock (Int), taxRate, status, deletedAt
              Relations: invoiceItems, purchaseItems, inventoryLogs

Invoice       id, customerId, status, totalAmount, totalAmountOverride,
              invoiceDate, eInvoiceCode, createdById
              Relations: items (InvoiceItem), payments

InvoiceItem   invoiceId, productId, quantity, unitPrice, taxRate

PurchaseOrder supplierId, status, totalAmount
PurchaseItem  purchaseOrderId, productId, quantity, unitPrice

Payment       invoiceId, customerId, amount, method, note
SupplierPayment purchaseOrderId, supplierId, amount

Cashflow      type (income/expense), amount, category, date,
              refType, refId, description

InventoryLog  productId, type, quantity, note, refType, refId

ActivityLog   action, module, message, level, ip, username, userId

DeleteRequest modelName, recordId, recordLabel, status, reason,
              requesterId, reviewerId, reviewedAt

ProfileUpdateRequest userId, requestedData (JSON), reason,
                     status, adminNote, reviewedAt

EmploymentCycle userId, cycleNo, startDate, endDate, note
```

### Soft delete
Customer, Supplier, Product dùng soft delete:
```ts
status: 'active' | 'deleted'
deletedAt: DateTime?
// Query luôn filter: where: { status: 'active' }
```

### Invoice fields quan trọng
- `totalAmountOverride` — ghi đè tổng tiền (từ XML import, bao gồm VAT)
- `invoiceDate` — ngày lập thực tế (từ XML); `createdAt` — ngày nhập hệ thống
- `eInvoiceCode` — mã HĐĐT từ XML (ví dụ `"C25TSL-2"`)
- `status`: `'draft' | 'active' | 'paid' | 'cancelled'`

---

## Business Logic — Quy tắc nghiệp vụ

### Tạo Invoice
```
InvoiceItem.quantity → product.stock -= quantity   (giảm tồn kho)
Invoice.totalAmount  → customer.debt += amount     (tăng công nợ)
→ InventoryLog (type: 'out')
```

### Thanh toán (Payment)
```
payment.amount → customer.debt -= amount           (giảm công nợ)
              → Cashflow entry (type: 'income')
Invoice.status → 'paid' nếu debt == 0
```

### Huỷ Invoice (`status = 'cancelled'`)
```
→ product.stock += quantity    (hoàn lại tồn kho)
→ customer.debt -= (total - paid)
→ Xóa các Cashflow entries liên quan (refType: 'payment')
```

### Tạo PurchaseOrder
```
PurchaseItem.quantity → product.stock += quantity  (tăng tồn kho)
PurchaseOrder.total   → supplier.debt += amount    (tăng nợ NCC)
→ InventoryLog (type: 'in')
```

### Thanh toán NCC (SupplierPayment)
```
→ supplier.debt -= amount
→ Cashflow entry (type: 'expense')
```

---

## Activity Log (`src/utils/logger.ts`)

```ts
import { writeLog } from '../utils/logger';

// Non-blocking — không throw, không block response
writeLog({
  action:   'create' | 'update' | 'delete' | 'login' | 'error',
  module:   'invoice',           // tên module
  message:  'Tạo hóa đơn #42',
  level:    'info' | 'warning' | 'error',
  userId:   (req as any).user?.id,
  username: (req as any).user?.username,
  ip:       req.ip,
});
```

Global error middleware tự log tất cả response >= 400.

---

## File config (JSON files trong `prisma/`)

### `prisma/rank-config.json`
Lưu ngưỡng rank của 4 groups — auto-created khi admin save lần đầu.
```json
{
  "customer": [{ "label": "THÁCH ĐẤU", "min": 50000000, "icon": "⚔️", "color": "#ff2244", "glow": "#ff223344" }],
  "supplier": [...],
  "product":  [...],
  "user":     [...]
}
```

API: `GET /api/admin/rank-config` · `PUT /api/admin/rank-config`  
Service: `adminService.getRankConfig()` · `adminService.saveRankConfig(partial)`  
Đọc file tươi mỗi GET (không cache trong memory).

### `prisma/backup-config.json`
Cấu hình auto-backup (schedule cron, số file giữ, encrypt, password).

---

## Path conventions trong modules

`__dirname` tại runtime = `src/modules/<module>/`

```ts
// Đúng — 3 cấp lên để ra backend/, rồi vào prisma/
const DB_PATH = path.join(__dirname, '../../../prisma/dev.db');

// Sai — 4 cấp sẽ ra project root (không có prisma/ ở đó)
// path.join(__dirname, '../../../../prisma/...')  ← BUG
```

---

## Module pattern chuẩn

```ts
// *.route.ts
export const xyzRouter = Router();
xyzRouter.get('/',    controller.getAll);
xyzRouter.post('/',   controller.create);
xyzRouter.put('/:id', controller.update);
// Admin-only trong route-level:
xyzRouter.delete('/:id', requireAdmin, controller.delete);

// *.service.ts — thuần business logic, gọi Prisma
export const xyzService = {
  async getAll() { ... },
  async create(data) { ... },
};

// *.controller.ts — parse req, gọi service, trả res
export const xyzController = {
  async getAll(req, res) {
    try {
      const data = await xyzService.getAll();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
```

---

## Prisma — Tips

```ts
// Soft delete query
prisma.customer.findMany({ where: { status: 'active' } })

// Transaction cho nghiệp vụ phức tạp
await prisma.$transaction(async (tx) => {
  await tx.invoice.create({ ... });
  await tx.product.update({ ... });
  await tx.customer.update({ ... });
});

// Relation include
prisma.invoice.findMany({
  include: { customer: true, items: { include: { product: true } } }
})
```

### Fix lỗi EPERM Windows (`prisma generate`)
```bash
taskkill //F //IM node.exe
npx prisma generate
```

---

## LAN / Deployment

- Backend listen: `0.0.0.0:3001` (tất cả interface)
- CORS: `origin: '*'` (LAN mobile access)
- Frontend dev LAN: `frontend/.env.local` → `VITE_API_URL=http://192.168.1.11:3001/api`
- Production: backend serve frontend build, frontend dùng `/api` relative

---

## Lưu ý quan trọng

- `admin.route.ts` routes (`/api/admin/*`) đều cần `requireAdmin` — **không đặt public routes trong adminRouter**
- `GET /api/admin/rank-config` dành cho admin; staff dùng default ranks từ HoloCard.tsx
- Backup/Restore: validate SQLite magic bytes (`SQLite format 3`) trước khi ghi đè DB
- `totalAmountOverride` trên Invoice: nếu có, dùng giá trị này thay `totalAmount` (XML import VAT included)
- Cashflow `refType`/`refId`: liên kết với payment/purchase để trace nguồn gốc bút toán
