# Batch XML Invoice Import

## Goal
Import nhiều file XML HĐĐT cùng lúc, chuẩn kế toán: giá & VAT lấy từ XML (không từ master), sản phẩm tự tạo nếu chưa có, không trừ tồn kho khi import hồi tố.

## Nguyên tắc kế toán áp dụng

| Trường XML | Mapping | Lý do |
|-----------|---------|-------|
| `DGia` | `InvoiceItem.price` | Giá tại thời điểm bán, không dùng giá master |
| `TSuat` | `InvoiceItem.taxRate` | VAT theo chính sách lúc đó |
| `TgTTTBSo` | `totalAmountOverride` | Tổng bao gồm VAT theo XML |
| `NLap` | `invoiceDate` | Ngày lập thực tế |

**Giá master product KHÔNG ảnh hưởng đến hóa đơn đã import.**

## Tasks

- [ ] **Task 1 — Backend: flag `skipInventory`**
  Thêm param `skipInventory: boolean` vào `invoiceService.create()`
  Nếu `true` → bỏ qua bước `product.update({ stock: decrement })` và `inventoryLog`
  → Verify: POST invoice với `skipInventory: true`, stock không thay đổi

- [ ] **Task 2 — Backend: auto-create product khi không khớp**
  Nếu không tìm thấy sản phẩm theo tên → tạo mới với:
  `name=THHDVu`, `unit=DVTinh`, `sellingPrice=DGia`, `stock=0`, `taxRate=TSuat`
  Trả về `{ productId, created: true }` để frontend biết
  → Verify: import XML có sản phẩm lạ → product mới xuất hiện trong danh sách

- [ ] **Task 3 — Backend: endpoint batch preview**
  `POST /invoices/xml-preview` nhận mảng parsed XML objects
  Trả về preview array: mỗi item gồm `{ invoiceData, matchedCustomer, items[{ matched, productId, willCreate }], warnings[] }`
  Không write DB
  → Verify: gọi API, nhận preview JSON không tạo dữ liệu

- [ ] **Task 4 — Backend: endpoint batch commit**
  `POST /invoices/xml-batch` nhận mảng invoice data đã confirm
  Chạy tuần tự (không parallel để tránh lỗi tồn kho)
  Trả về `{ success: [], failed: [{ index, error }] }`
  → Verify: import 3 file, 2 thành công 1 lỗi → response đúng format

- [ ] **Task 5 — Frontend: multi-file upload UI**
  Thay input đơn bằng `multiple` file input
  Sau khi chọn files → gọi preview endpoint → hiện bảng review
  Mỗi row: checkbox chọn/bỏ + trạng thái match (✓ khớp / ⚠ tạo mới / ✗ lỗi)
  → Verify: chọn 3 file XML → thấy 3 row trong bảng preview

- [ ] **Task 6 — Frontend: batch review table**
  Columns: `[ ] | Mã HĐĐT | Ngày lập | Khách hàng | Tổng | Sản phẩm mới | Cảnh báo`
  Row expand → xem chi tiết từng line item + giá XML
  Toggle `skipInventory` global (mặc định ON cho import hồi tố)
  → Verify: expand row → thấy đúng items và giá từ XML

- [ ] **Task 7 — Frontend: commit batch**
  Nút "Import X hóa đơn đã chọn" → gọi batch commit
  Hiển thị progress + kết quả từng invoice (success/failed)
  → Verify: import batch → thấy các hóa đơn xuất hiện trong danh sách

## Done When
- [ ] Chọn 10 file XML → preview → review → import 1 click
- [ ] Giá và VAT trong hóa đơn = đúng theo XML, không bị ghi đè bởi giá master
- [ ] Sản phẩm mới tự tạo, không block import
- [ ] Hóa đơn cũ import không ảnh hưởng tồn kho hiện tại

## Notes
- **Task 1 & 2 trước**, vì Task 3-7 phụ thuộc
- Task 3 (preview) không write DB → an toàn để test
- Sản phẩm auto-created có `stock=0` — cần reconcile thủ công sau nếu cần
- Duplicate check: kiểm tra `eInvoiceCode` trước khi insert tránh import 2 lần cùng 1 HĐĐT
