# Changelog

## [Unreleased]

### Sửa lỗi

#### Admin — Seed demo & purge dữ liệu (MariaDB)
- **Lỗi `P2002 User_username_key`**: dùng `upsert` thay `create` cho toàn bộ user seed → idempotent, chạy lại nhiều lần không báo trùng
- **Lỗi `P2003 Foreign key constraint`** khi `product.deleteMany()` / `supplierPayment.create()`: bọc block purge (cả trong `seedDemoData` và `admin.purgeAll()` / `resetForProduction`) trong `SET FOREIGN_KEY_CHECKS = 0 … 1` để xóa sạch orphan rows từ lần seed fail trước
- Bỏ `$transaction` trong `purgeAll` vì `FOREIGN_KEY_CHECKS` là session-scoped — phải chạy trên cùng 1 connection

#### CI — vitest version.test.ts
- Fix `ReferenceError: __APP_VERSION__ is not defined` trên CI: mirror Vite's `define` trong `vitest.config.ts` để inject version từ `package.json`

#### Git — Runtime config files
- Untrack `backend/prisma/rank-config.json` + `backup-config.json` khỏi repo (2 file này do admin UI tự generate khi save lần đầu) → server không còn bị block khi `git pull`

### Cải tiến

#### Admin — Demo seed & Reset panel
- Chuyển seed logic sang `backend/src/seed/seed-demo.ts` (có thể import từ admin runtime, không chỉ từ CLI)
- Thêm 2 endpoint `POST /admin/seed-demo` và `POST /admin/reset-production` — giữ nguyên admin đang đăng nhập để không bị logout
- Trang `/system-admin`: thêm form-panel với 2 nút "Chạy dữ liệu demo" (typeToConfirm `DEMO`) và "Reset để sử dụng thực tế" (typeToConfirm `BAT DAU`)

#### Frontend — Version sync từ package.json
- `vite.config.ts` inject `__APP_VERSION__` qua `define` từ `package.json` → màn hình login luôn hiển thị đúng version (trước đây hardcode trong `src/version.ts`)

#### UI — Table column width (Users & Products)
- Cột "Họ tên" ở `/users` → `minWidth: 220px, width: 22%` (giảm wrap xuống nhiều hàng)
- Cột "Tên SP" ở `/products` → `minWidth: 280px, width: 28%` (phù hợp tên LED dài)

#### UI — Products page "+ Thêm mới" button
- Nút "+ Thêm mới" giờ hiển thị ở cả 2 tab (Danh sách + Phân tích) → tránh giao diện thụt lên thụt xuống khi chuyển tab
- Click nút ở tab Phân tích tự chuyển về tab Danh sách rồi mở form

#### UI — Products Dashboard mobile responsive
- Fix panel "🔥 Bán chạy", "⚠️ Tồn kho thấp", "😴 Không bán" bị phình rộng quá viewport trên mobile
- Thêm `min-width: 0; overflow: hidden` cho `.form-panel` + override `white-space: nowrap` → tên sản phẩm dài wrap xuống hàng thay vì ellipsis
- Ép `min-width: 0` cho grid-3 children để chặn flex/grid content overflow

---

## [0.3.6] — 2026-04-07

### Tính năng mới

#### Dashboard — Biểu đồ Nhập hàng & Xuất bán + Panel Công nợ
- **📦 Nhập hàng & Xuất bán {year}**: Dual line chart hiển thị tổng giá trị nhập kho (cam) vs doanh thu bán ra (xanh lá) theo từng tháng
  - Cùng style animation với chart "Tăng trưởng khách hàng": GlowDot pulse, GlowActiveDot halo, light tracer chạy dọc đường
  - Floating background symbols `📦` + `IN`/`OUT` (`.trade-flow`) theo style chuẩn `moneyFloat`
- **⚖️ Công nợ — Phải thu vs Phải trả**:
  - 2 progress bar ngang scale theo bên lớn hơn (xanh = phải thu, đỏ = phải trả)
  - Top 3 khách hàng đang nợ (clickable → mở HoloCard) và Top 3 NCC mình đang nợ
  - Net balance row: hiển thị thu ròng (xanh `+`) hoặc trả ròng (đỏ `⚠`)

### Cải tiến

#### Purchase — Logic thanh toán nhà cung cấp
- **Trang Nhập hàng**: thêm nút "Trả tiền" (xanh) + modal thanh toán (mirror pattern Invoices)
- **Cột mới trong bảng**: "Đã trả" (xanh), "Còn lại" (đỏ nếu > 0)
- **Confirm hủy**: thay `window.confirm()` bằng `ConfirmModal` (theo CLAUDE.md convention) — cảnh báo nếu đã trả tiền

#### Backend — Fix double-count chi phí nhập hàng
- **Bỏ tạo Cashflow khi tạo PurchaseOrder** → chuyển sang cash-based: chi phí chỉ phát sinh khi thực sự trả tiền NCC qua `SupplierPayment`
- **Trước**: 1 PO 20tr → Dashboard hiển thị `Nhập hàng 20tr + supplier_payment 20tr = 40tr` (sai)
- **Sau**: 1 PO 20tr trả đủ → chỉ ghi nhận 20tr 1 lần

#### Supplier Payment — Schema relation + 2 modes
- **schema.prisma**: thêm relation `PurchaseOrder ↔ SupplierPayment` (`purchaseOrderId` nullable cho legacy bulk payments)
- **Service** với 2 mode:
  - Mode 1 (`purchaseOrderId`): trả thẳng cho 1 PO cụ thể, update `paidAmount` + status
  - Mode 2 (`supplierId`): trả tổng cho NCC → FIFO apply vào các PO chưa trả xong (oldest first)

#### Products — Mobile responsive
- Replace 5 hardcoded `gridTemplateColumns` bằng utility classes `.grid-6`, `.grid-3`, `.grid-2` (responsive 768px / 480px breakpoints)
- Thêm card thứ 6 "Lưu lượng" → fill ô trống ở mobile 2-col layout

#### Dashboard — Top staff filter + Floating symbols
- "🏅 Top 3 nhân viên" chỉ list user có `totalRevenue > 0`
- Thêm `.money-flow` ($ + VNĐ) bay nền chart "📈 Doanh thu & Lợi nhuận"
- Thêm `.growth-flow` (+1 / ★ / NEW) bay nền chart "👥 Tăng trưởng khách hàng"

---

## [0.3.5] — 2026-04-06

### Tính năng mới

#### Hiển thị version hệ thống
- **Sidebar logo**: thêm version (v1.0.0) bên cạnh "HAPPY" — font-size nhỏ, màu cyan mờ
- **SystemHealth page**: hiển thị version trong banner info cùng dòng với Node/OS/CPU
- **Backend API**: mới `GET /api/admin/version` (lấy version từ backend/package.json)

---

## [0.3.4] — 2026-04-06

### Cải tiến

#### Dashboard — Tối ưu hóa UI/UX
- **Top khách hàng**: Thay đổi layout từ `textOverflow: 'ellipsis'` → `wordBreak: 'break-word'` để tên dài có thể xuống dòng thay vì bị nén
- **Pie charts (Nguồn thu / Chi phí)**:
  - Xóa animation rotate → Legend dễ đọc hơn
  - Thêm drop-shadow glow trên mỗi phần chart để tạo chiều sâu
- **Layout Row 3**: Tách "⚡ Thu/Chi theo tháng" thành 2 phần (T1-T6, T7-T12) cùng hàng với "🏅 Top 3 nhân viên" → Grid 3 cột cân bằng với Row 2
- **Làm mịn hiệu ứng**:
  - Top khách hàng top 3: glow border + shimmer overlay, bỏ zoom hover
  - Minor: font-size, spacing adjustments cho tổng thể nhất quán

---

## [0.3.3] — 2026-04-06

### Tính năng mới

#### Trang Sản phẩm — Tab "Phân tích & Báo cáo" (Product Dashboard)
- Tách trang Sản phẩm thành **2 tab**: Danh sách (giữ nguyên) và Phân tích & Báo cáo
- **API mới**: `GET /api/products/dashboard?days=N` — tổng hợp dữ liệu từ InventoryLog và InvoiceItem, không tính toán dư thừa từ bảng products
- **Summary cards** (5 thẻ): Tổng SP, Tổng tồn kho, Giá trị tồn kho, Sắp hết hàng, Hết hàng — click vào thẻ cảnh báo để jump sang tab Danh sách với filter tương ứng
- **Biểu đồ nhập/xuất kho** theo ngày (LineChart) — chọn kỳ 7/30/90 ngày
- **Biểu đồ top doanh thu** (BarChart ngang) — top 7 sản phẩm mọi thời gian
- **Danh sách bán chạy nhất**: ranked list với progress bar tỉ lệ + rank icon
- **Danh sách tồn kho thấp** (≤5): nút "Xem tất cả" jump sang tab Danh sách filter `low`
- **Danh sách không bán trong N ngày**: hiển thị ngày bán cuối + số ngày trôi qua
- Selector kỳ phân tích (7/30/90 ngày) ảnh hưởng đồng thời chart nhập/xuất và danh sách không bán
- Skeleton loading state đầy đủ khi đang tải
- Indicator filter (khi jump từ dashboard → danh sách) kèm nút "Bỏ lọc"

---

## [0.3.2] — 2026-04-06

### Tính năng mới

#### Trạng thái hệ thống — Hiển thị nhân sự đang online
- Panel **"👥 Nhân sự đang online"** trong tab Trạng thái server
- Hiển thị số lượng người đang hoạt động (badge xanh lá)
- Danh sách từng người: tên, vai trò (admin / nhân viên), địa chỉ IP, thời gian hoạt động gần nhất
- Tính "online" = có gửi request trong vòng **5 phút** gần nhất
- Cơ chế: `auth.middleware.ts` ghi `lastSeen` theo userId mỗi request xác thực (bỏ qua `/health`)
- Endpoint mới: `GET /api/admin/online-users` (chỉ admin)
- Tự động làm mới cùng chu kỳ 10 giây của trang Trạng thái server

---

## [0.3.1] — 2026-04-06

### Sửa lỗi

#### Nút Copy không hoạt động khi truy cập qua HTTP (LAN/IP)
- **Nguyên nhân**: `navigator.clipboard.writeText` chỉ hoạt động trên HTTPS hoặc `localhost`. Khi truy cập qua địa chỉ IP nội bộ (`http://192.168.x.x`) thì `navigator.clipboard` là `undefined`, dẫn đến lỗi JS.
- **Sửa**: `clipboard.ts` kiểm tra tường minh `navigator.clipboard` trước khi gọi, tự động fallback sang `document.execCommand('copy')` (hoạt động trên HTTP).
- **Fallback cuối**: nếu cả `execCommand` không được hỗ trợ (trình duyệt cũ) → hiện hộp `prompt` để người dùng tự copy thủ công.
- Áp dụng cho tất cả nút **Copy** trong toàn hệ thống (Thiết lập mạng, trang Login, v.v.).

---

## [0.3.0] — 2026-04-05

### Tính năng mới

#### Admin: Backup & Restore database
- Trang Quản trị hệ thống có thêm panel **Khôi phục dữ liệu** bên cạnh panel Sao lưu
- Upload file `.db` trực tiếp trên giao diện — với progress bar upload
- Backend validate magic bytes SQLite trước khi ghi đè, tự backup file cũ trước khi restore
- Endpoint: `POST /api/admin/restore` (multer, max 100MB, chỉ nhận `.db`)

#### XML Import — tách tên công ty / tên người
- `<Ten>` → `companyName` của khách hàng
- `<HVTNMHang>` → `name` (người đại diện) của khách hàng
- Trước đây bị gộp nhầm, gây dữ liệu KH sai khi import HĐĐT

#### XML Batch Import — chống duplicate thông minh
- **Khách hàng**: cùng MST trong một batch → tự động merge thành 1 KH, không tạo bản ghi mới
- Preview hiển thị "↗ Merge với #N" (cyan) thay "⚠ Tạo KH mới" khi phát hiện trùng trong batch
- **Sản phẩm**: cùng tên + cùng giá bán → merge; cùng tên khác giá → coi là sản phẩm khác
- Default "Đã thu" = 100% (trước là 0%)

#### Rank System — Khách hàng, Nhà cung cấp, Sản phẩm
- 4 mốc rank: ⚔️ THÁCH ĐẤU (≥50M) / 💎 KIM CƯƠNG (≥20M) / 🔮 BẠCH KIM (≥10M) / ⭐ VÀNG (≥5M)
- Khách hàng rank theo `totalPurchased`, NCC theo `totalOrdered`, Sản phẩm theo `totalRevenue`
- Table row highlight màu rank, icon rank trước tên
- HoloCard hiển thị rank banner với glow effect
- Default sort tự động theo "mua/đặt/bán nhiều nhất"

#### HoloCard — cải tiến
- Luôn hiển thị đầy đủ tất cả fields (phone, MST, địa chỉ, email, công nợ) — rỗng → "—"
- Thêm section sản phẩm: "Đã bán" + "Doanh thu"
- NCC: hiển thị "Tổng đặt" + "Số đơn"

#### Dashboard — cải tiến toàn diện
- **Biểu đồ Doanh thu & Lợi nhuận**: glowing dot tại mỗi điểm dữ liệu (staggered pulse), spark chạy theo đường line, activeDot với halo glow
- **Biểu đồ Tăng trưởng KH**: cùng hiệu ứng spark + glow dot
- **Biểu đồ Thu/Chi**: bỏ cursor trắng chói → cursor cyan mờ; activeBar glow đúng màu (xanh lá / đỏ)
- **Top khách hàng**: click vào bất kỳ KH → mở HoloCard popup đầy đủ thông tin
- **Top sản phẩm**: thay BarChart (bị cắt tên dài) bằng danh sách ranked list với progress bar tỉ lệ
- **Customer growth**: dùng ngày lập HĐ đầu tiên (không phải `createdAt`) làm mốc "tham gia"
- **Tooltip**: số người/KH hiển thị đúng không còn kèm ký hiệu "₫"
- `topCustomers` trả về thêm `id` để hỗ trợ click → HoloCard

#### UI / UX
- **Logo sidebar**: thay SVG bằng text terminal-style "HAPPY / SMART LIGHT" với hiệu ứng flicker CRT + cursor nhấp nháy + cyan pulse
- **Logo trang Login**: cùng style, size lớn hơn (36px)
- **"Hệ thống kế toán nội bộ"**: căn giữa trên trang Login
- **Year selector Dashboard**: desktop = button row, mobile (≤640px) = dropdown `<select>` styled cyan

### Sửa lỗi
- `mode: 'insensitive'` không hỗ trợ trên SQLite — đã chuyển sang exact match khi tìm KH theo `companyName` trong batch import
- `batchMergeIndex` bị mất sau refactor — đã khôi phục logic `results.push` trong `xmlPreview()`

---

## [0.2.0] — 2026-04-04

### Tính năng mới

#### Import hóa đơn XML HĐĐT
- Import đơn lẻ: chọn 1 file XML, tự khớp khách hàng & sản phẩm, hỗ trợ nhập "Đã thu" với quick-pick 0/50%/70/100%
- **Import batch**: chọn nhiều file XML cùng lúc, hiển thị bảng review trước khi commit
  - Tự động khớp khách hàng theo MST hoặc tên
  - Tự động tạo sản phẩm mới nếu chưa tồn tại trong hệ thống
  - Duplicate check theo mã HĐĐT — không cho import 2 lần
  - Toggle "Bỏ qua trừ tồn kho" cho import hồi tố (mặc định bật)
  - Expand từng row xem chi tiết line item, giá & VAT từ XML
  - Nhập "Đã thu" per-row với quick-pick 0/50%/70%/100%

#### Ngày lập hóa đơn (`invoiceDate`)
- Lưu đúng ngày lập từ XML (`NLap`) thay vì ngày import
- Hóa đơn tạo thủ công dùng `createdAt`
- Hiển thị cột "Ngày lập" riêng trong danh sách hóa đơn
- Sort và filter theo ngày lập thực tế

#### Cashflow — ngày giao dịch (`date`)
- Thêm field `date` vào bảng Cashflow (migration `20260404_add_cashflow_date`)
- Import XML: cashflow ghi ngày lập hóa đơn, không phải ngày import
- Thu tiền thủ công: ghi ngày thu thực tế
- Trang Thu/Chi hiển thị và lọc theo `date`

#### Deployment scripts
- `install.sh` — cài đặt lần đầu trên Raspberry Pi: tự tạo `.env`, migrate DB, seed, build, khởi động PM2
- `deploy.sh` — cập nhật sau `git pull`: build + `pm2 reload` (zero-downtime)
- `Makefile` — lệnh tắt: `make install`, `make deploy`, `make logs`, `make status`
- `backend/.env.example` — template môi trường
- `README.md` — hướng dẫn deploy

### Sửa lỗi

- **Báo cáo sai năm**: `getProfitLoss` filter invoice theo `invoiceDate` (ưu tiên) hoặc `createdAt` (fallback) thay vì luôn dùng `createdAt` → HĐ năm 2025 không còn bị tính vào năm 2026
- **Cashflow x2 doanh thu**: bỏ entry `sales` tự động khi tạo hóa đơn — chỉ ghi `payment_received` khi có tiền thực thu
- **Ngày cashflow sai**: report và trang Thu/Chi dùng `date` thay `createdAt`
- **Import XML không lưu ngày lập**: controller chỉ lấy 3 field từ `req.body`, bỏ sót `invoiceDate`, `eInvoiceCode`, `totalAmountOverride`, `initialPaid` — đã fix
- **`ecosystem.config.js`**: `DATABASE_URL` dùng đường dẫn tương đối → lỗi khi PM2 chạy từ thư mục khác, đã chuyển sang `__dirname`
- **Sort ngày hóa đơn**: sửa logic nhân đôi `-1` trong sort

### Thay đổi schema (migrations)
- `20260404062314` — thêm `SupplierType`, `ActivityLog`, `CashflowCategory`
- `20260404120000` — thêm `Product.taxRate`, `InvoiceItem.taxRate`, `Invoice.eInvoiceCode`, `Invoice.invoiceDate`
- `20260404104110` — thêm `Cashflow.date`

---

## [0.1.0] — 2026-04-04

- Initial commit: backend API + frontend MVP
