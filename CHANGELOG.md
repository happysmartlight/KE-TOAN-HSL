# Changelog

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
