# Frontend — CLAUDE.md

## Stack

- **React 18** + **TypeScript** + **Vite**
- **React Router v6** (single-page, `BrowserRouter`)
- **Axios** (`src/api.ts`) — auto-attaches JWT, logs errors về backend
- **CSS thuần** — không có Tailwind, không có UI library

---

## Cấu trúc thư mục

```
src/
├── api.ts                  # Axios instance (baseURL, auth interceptor)
├── App.tsx                 # Router, sidebar nav, AppLayout, rank config load
├── main.tsx                # Entry point
├── index.css               # Toàn bộ CSS (CSS variables, components, animations)
├── context/
│   └── AuthContext.tsx     # AuthProvider, useAuth() hook
├── hooks/
│   └── useKeyboard.ts      # useEscKey()
├── components/
│   ├── HoloCard.tsx        # Terminal-style info card + rank system (module singleton)
│   ├── FilterBar.tsx       # Shared filter/search/sort bar
│   ├── ConfirmModal.tsx    # Confirm/delete dialog (KHÔNG dùng window.confirm)
│   ├── RequestDeleteModal.tsx  # Staff yêu cầu xóa (non-admin)
│   ├── SearchSelect.tsx    # React Portal dropdown (dùng trong table để tránh clip)
│   ├── DatePicker.tsx      # Custom date picker
│   ├── Toast.tsx           # Toast notifications + ToastContainer
│   ├── EmptyState.tsx      # Empty state placeholder
│   └── Clock.tsx           # Real-time clock (topbar)
└── pages/
    ├── Dashboard.tsx       # Charts, KPI, top customers (clickable HoloCard)
    ├── Customers.tsx
    ├── Suppliers.tsx
    ├── Products.tsx
    ├── Invoices.tsx        # XML import (HĐĐT), bán hàng
    ├── Purchases.tsx       # Nhập hàng
    ├── Cashflow.tsx        # Thu/Chi với period selector
    ├── CashflowCategories.tsx
    ├── Reports.tsx
    ├── Users.tsx           # Nhân sự (admin-only), HoloCard click
    ├── Requests.tsx        # Quản lý yêu cầu xóa + cập nhật hồ sơ
    ├── RankConfig.tsx      # Cấu hình ngưỡng rank (admin-only)
    ├── SystemAdmin.tsx     # Purge data, backup/restore DB
    ├── SystemHealth.tsx    # Server stats
    ├── AutoBackup.tsx      # Cài đặt backup tự động
    ├── MyProfile.tsx       # Hồ sơ cá nhân, đổi mật khẩu
    └── Login.tsx
```

---

## Auth

```ts
// context/AuthContext.tsx
const { user, loading, login, logout } = useAuth();
// user = { id, username, name, role: 'admin' | 'staff' }

// Token lưu trong localStorage (remember me) hoặc sessionStorage
// api.ts tự attach: Authorization: Bearer <token>
```

- `loading = true` → app đang verify token, không render gì
- `user = null` → render `<Login />`
- `user.role === 'admin'` → hiện sidebar Hệ thống (Users, RankConfig, SystemAdmin…)

---

## API client (`src/api.ts`)

```ts
import api from '../api';

// Tất cả calls dùng relative path (không cần /api prefix trong code page):
api.get('/customers')
api.post('/invoices', body)
api.put('/users/1', data)
api.delete('/products/5')
```

- Dev: `http://localhost:3001/api`
- Dev LAN: set `VITE_API_URL=http://192.168.1.11:3001/api` trong `frontend/.env.local`
- Production: `/api` (backend serve frontend)
- Lỗi API tự động log về `POST /logs/client-error` (trừ `/auth/login`)

---

## CSS — Neon Terminal Theme

Tất cả CSS variables trong `index.css`:

```css
--cyan: #00f5ff        /* màu chính */
--purple: #bf00ff
--green: #00ff88
--red: #ff0055
--yellow: #ffcc00
--text-dim: #505070
--text-bright: #e8e8ff
--bg-root: #07070f
--bg-card: #0d0d1a
--font: 'JetBrains Mono', monospace
```

### Classes hay dùng

| Class | Dùng cho |
|---|---|
| `.btn.cyan / .red / .green / .yellow / .ghost` | Button variants |
| `.btn-sm` | Small button |
| `.inp` | Text input |
| `.lbl` | Form label |
| `.tag.cyan / .red / .green / .yellow / .purple` | Status badge — **KHÔNG dùng `.tag-cyan`** |
| `.nt` | Table (`<table class="nt">`) |
| `.table-wrap` | Wrapper cho table (overflow scroll) |
| `.form-panel` | Form container với border/glow |
| `.page-header` | Flex row: title + action button |
| `.page-title` | h1 tiêu đề trang |
| `.td-act` | Flex container cho action buttons trong table cell |
| `.c-dim / .c-cyan / .c-bright / .c-red / .c-green` | Text color helpers |
| `.fw7` | font-weight: 700 |
| `.fg2` | 2-column form grid |
| `.modal-bg / .modal` | Generic modal overlay + container |
| `.holo-modal-bg / .holo-modal-inner` | HoloCard popup |
| `.empty-row` | Table row "không có dữ liệu" |

---

## Rank System (`src/components/HoloCard.tsx`)

### Module singleton pattern
Ranks được lưu trong **module-level variables** — không phải React state:

```ts
// HoloCard.tsx exports:
setRankConfig(cfg: { customer?, supplier?, product?, user? })  // gọi sau khi load/save config
getCustomerRank(totalPurchased: number): RankTier | null
getSupplierRank(totalOrdered: number): RankTier | null
getProductRank(totalRevenue: number): RankTier | null
getUserRank(totalRevenue: number): RankTier | null
```

### Lifecycle
1. **App.tsx**: sau khi admin login → `GET /admin/rank-config` → `setRankConfig(data)`
2. **RankConfig.tsx**: sau khi admin save → `setRankConfig(configs)` (áp dụng ngay, không reload)
3. Mỗi group (customer/supplier/product/user) có ngưỡng **độc lập**

### Rank tiers (default)
| Rank | Ngưỡng | Icon | Màu |
|---|---|---|---|
| THÁCH ĐẤU | ≥ 50,000,000 ₫ | ⚔️ | `#ff2244` |
| KIM CƯƠNG | ≥ 20,000,000 ₫ | 💎 | `#00d4ff` |
| BẠCH KIM | ≥ 10,000,000 ₫ | 🔮 | `#bf80ff` |
| VÀNG | ≥ 5,000,000 ₫ | ⭐ | `#ffcc00` |

### Row styling khi có rank
```tsx
<tr style={{ background: `${rank.color}08` }}>
  <td style={{ borderLeft: `2px solid ${rank.color}55` }}>
    {rank && <span>{rank.icon}</span>}
    <span style={{ color: rank.color }}>{name}</span>
```

### HoloCard popup pattern
```tsx
const [cardData, setCardData] = useState<HoloData | null>(null);

// Trigger (click vào row):
onClick={() => setCardData({ type: 'customer', id, name, createdAt, ...fields })}

// Render:
{cardData && (
  <div className="holo-modal-bg" onClick={() => setCardData(null)}>
    <div className="holo-modal-inner" onClick={(e) => e.stopPropagation()}>
      <HoloCard data={cardData} />
      <button className="holo-modal-close" onClick={() => setCardData(null)}>[ Đóng ]</button>
    </div>
  </div>
)}
```

HoloData types: `'customer' | 'supplier' | 'product' | 'user'`

---

## FilterBar

```tsx
import FilterBar, { defaultFilter } from '../components/FilterBar';
import type { FilterState } from '../components/FilterBar';

const [filter, setFilter] = useState<FilterState>(defaultFilter);
// hoặc override default:
const [filter, setFilter] = useState<FilterState>({ ...defaultFilter, sortBy: 'purchased', sortDir: 'desc' });

<FilterBar
  value={filter} onChange={setFilter}
  totalCount={rows.length} resultCount={filtered.length}
  searchPlaceholder="Tìm..."
  statusOptions={[{ value: 'has_debt', label: 'Đang nợ' }]}
  sortOptions={[
    { value: 'date_desc', label: '↓ Mới nhất' },
    { value: 'name_asc',  label: 'A→Z Tên' },
  ]}
/>
```

SortBy value format: `"field_dir"` (ví dụ `"date_desc"`, `"name_asc"`, `"purchased_desc"`).

---

## ConfirmModal

**KHÔNG dùng `window.confirm()`** — luôn dùng `ConfirmModal`:

```tsx
import ConfirmModal from '../components/ConfirmModal';

const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

{confirmDelete && (
  <ConfirmModal
    title="Xóa khách hàng"
    message={`Bạn có chắc muốn xóa "${confirmDelete.name}"?`}
    warning="Dữ liệu liên quan sẽ không thể khôi phục."
    confirmLabel="Xóa vĩnh viễn"
    onConfirm={() => doDelete(confirmDelete.id)}
    onCancel={() => setConfirmDelete(null)}
  />
)}
```

---

## ESC Key chaining

```tsx
import { useEscKey } from '../hooks/useKeyboard';

useEscKey(
  cardData       ? () => setCardData(null) :    // ưu tiên cao nhất
  historyModal   ? () => setHistoryModal(null) :
  open           ? () => setOpen(false) : null
);
```

---

## Toast

```tsx
import { toast } from '../components/Toast';

toast.success('Lưu thành công');
toast.error('Lỗi: ' + err?.response?.data?.error);
```

---

## SearchSelect

Dùng khi dropdown nằm **trong table** (để tránh overflow clip):

```tsx
import SearchSelect from '../components/SearchSelect';
// Portal-based, tự tính vị trí tuyệt đối
```

---

## Date/Period

- `invoiceDate` = ngày lập hoá đơn thực tế (từ XML); `createdAt` = ngày nhập hệ thống
- Hiển thị/filter luôn ưu tiên: `invoiceDate ?? createdAt`
- Cashflow: `date` = ngày giao dịch thực tế (không phải `createdAt`)
- Period filter: `getPeriodRange(type, year, month)` → `{ from, to }` → truyền vào API params

---

## Sidebar Logo

```tsx
// App.tsx — sidebar
<div className="sidebar-logo">
  <div className="logo-text">
    <span className="logo-prompt">{'>'}_</span>
    <span className="logo-line1">HAPPY</span>
    <span className="logo-line2">SMART<span className="logo-accent"> LIGHT</span></span>
  </div>
</div>
```

CSS animations: `logo-flicker` (CRT), `logo-pulse` (cyan glow), `logo-prompt-blink` (cursor).

---

## Quy ước import type

```ts
// Luôn dùng import type riêng cho interface (Vite yêu cầu):
import FilterBar, { defaultFilter } from '../components/FilterBar';
import type { FilterState } from '../components/FilterBar';

import HoloCard, { getCustomerRank } from '../components/HoloCard';
import type { HoloData } from '../components/HoloCard';
```

---

## Số tiền

```ts
const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫';
// → "50.000.000 ₫"

// Ngưỡng rank:
const fmtNum = (n: number) => n.toLocaleString('vi-VN');
const parseNum = (s: string) => parseInt(s.replace(/[^\d]/g, ''), 10) || 0;
```

---

## Quy tắc chung

- `import type` riêng cho TypeScript interfaces
- Không dùng `window.confirm()` — dùng `ConfirmModal`
- Không dùng `.tag-cyan` — dùng `.tag.cyan`
- `SearchSelect` thay `<select>` khi dropdown nằm trong table
- Admin-only UI: kiểm tra `user?.role === 'admin'` trước khi render
- Non-admin delete: dùng `RequestDeleteModal` thay vì xóa thẳng
