import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ============================================================
// Helpers
// ============================================================
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[rand(0, arr.length - 1)];
const dt = (s: string) => new Date(s);

function pad2(n: number) { return String(n).padStart(2, '0'); }
function dayInMonth(year: number, month: number) {
  const d = rand(1, 28);
  return new Date(`${year}-${pad2(month)}-${pad2(d)}T${pad2(rand(8, 17))}:${pad2(rand(0, 59))}:00`);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('🌱  Bắt đầu seed dữ liệu demo (LED / POI Lighttoys / Màn hình LED)...\n');

  // ─── Reset transactional data (giữ lại CashflowCategory builtin) ───
  console.log('🧹  Xóa dữ liệu giao dịch cũ...');
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.supplierPayment.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.cashflow.deleteMany();
  await prisma.inventoryLog.deleteMany();
  await prisma.deleteRequest.deleteMany();
  await prisma.profileUpdateRequest.deleteMany();
  await prisma.employmentCycle.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();

  // ============================================================
  // 1. USERS — 1 admin + 6 staff (5 active + 1 đã nghỉ việc)
  // ============================================================
  console.log('👥  Tạo nhân viên...');
  const adminPass = await bcrypt.hash('admin123', 10);
  const staffPass = await bcrypt.hash('staff123', 10);

  const admin = await prisma.user.create({
    data: {
      username: 'admin', password: adminPass, name: 'Nguyễn Bằng',
      role: 'admin', email: 'admin@happysmartlight.vn', phone: '0901000001',
      startDate: dt('2024-01-01'), employmentStatus: 'active',
    },
  });

  const staffSeed = [
    { username: 'thuylinh',  name: 'Trần Thùy Linh',   email: 'linh@hsl.vn',   phone: '0901000010', start: '2024-02-01' },
    { username: 'minhquan',  name: 'Lê Minh Quân',     email: 'quan@hsl.vn',   phone: '0901000011', start: '2024-03-15' },
    { username: 'hoangnam',  name: 'Phạm Hoàng Nam',   email: 'nam@hsl.vn',    phone: '0901000012', start: '2024-05-20' },
    { username: 'thuhuong',  name: 'Đỗ Thu Hương',     email: 'huong@hsl.vn',  phone: '0901000013', start: '2024-08-01' },
    { username: 'kimanh',    name: 'Vũ Kim Anh',       email: 'kimanh@hsl.vn', phone: '0901000014', start: '2025-01-10' },
  ];

  const staffUsers = [];
  for (const s of staffSeed) {
    const u = await prisma.user.create({
      data: {
        username: s.username, password: staffPass, name: s.name, role: 'staff',
        email: s.email, phone: s.phone, startDate: dt(s.start), employmentStatus: 'active',
      },
    });
    await prisma.employmentCycle.create({
      data: { userId: u.id, cycleNo: 1, startDate: dt(s.start), note: 'Khởi đầu chu kỳ làm việc' },
    });
    staffUsers.push(u);
  }

  // 1 nhân viên đã nghỉ
  const resigned = await prisma.user.create({
    data: {
      username: 'oldnv', password: staffPass, name: 'Hoàng Văn Cũ', role: 'staff',
      email: 'old@hsl.vn', phone: '0901000099',
      startDate: dt('2024-01-15'), endDate: dt('2025-06-30'), employmentStatus: 'resigned',
    },
  });
  await prisma.employmentCycle.create({
    data: { userId: resigned.id, cycleNo: 1, startDate: dt('2024-01-15'), endDate: dt('2025-06-30'), note: 'Nghỉ việc theo nguyện vọng' },
  });

  // ============================================================
  // 2. SUPPLIERS — Nhà cung cấp linh kiện LED / POI / màn hình
  // ============================================================
  console.log('🏭  Tạo nhà cung cấp...');
  const supplierSeed = [
    { name: 'Lighttoys s.r.o.', companyName: 'Lighttoys s.r.o. (Czech Republic)', taxCode: 'CZ27916123',
      phone: '+420774112233', email: 'sales@lighttoys.com', address: 'Brno, Czech Republic',
      supplierType: 'international' },
    { name: 'Shenzhen Novastar Tech', companyName: 'Shenzhen Novastar Tech Co., Ltd', taxCode: 'CN91440300',
      phone: '+8675586722800', email: 'export@novastar-led.com', address: 'Shenzhen, China',
      supplierType: 'international' },
    { name: 'Absen LED Display', companyName: 'Shenzhen Absen Optoelectronic Co., Ltd', taxCode: 'CN91440300A',
      phone: '+8675589341800', email: 'sales@absen.com', address: 'Shenzhen, China',
      supplierType: 'international' },
    { name: 'Công ty TNHH Linh kiện Điện tử Minh Tâm', companyName: 'CT TNHH LK ĐT Minh Tâm',
      taxCode: '0312987654', phone: '0283971234', email: 'sales@minhtam.vn',
      address: '155 Lý Thường Kiệt, Quận 10, TP.HCM', supplierType: 'domestic' },
    { name: 'Công ty TNHH TMDV Ánh Sáng Việt', companyName: 'CT TNHH TMDV Ánh Sáng Việt',
      taxCode: '0314765432', phone: '0287306789', email: 'kd@anhsangviet.vn',
      address: '88 Tô Hiến Thành, Quận 10, TP.HCM', supplierType: 'domestic' },
    { name: 'Madrix GmbH (qua đại lý VN)', companyName: 'Inoage GmbH - Madrix Distribution',
      taxCode: '0316543210', phone: '0287900000', email: 'vn@madrix.com',
      address: 'Đại lý TP.HCM', supplierType: 'intermediary' },
  ];
  const suppliers = await Promise.all(supplierSeed.map((s) => prisma.supplier.create({ data: s })));

  // ============================================================
  // 3. PRODUCTS — LED, POI Lighttoys, mạch ĐK, màn hình, cabin
  // ============================================================
  console.log('💡  Tạo sản phẩm...');
  // costPrice ≈ 60-75% của sellingPrice
  const productSeed = [
    // POI Lighttoys (đạo cụ biểu diễn)
    { name: 'POI Lighttoys Pixel Poi V3 (cặp)',          sku: 'LT-PXP-V3', unit: 'Cặp',  cost: 9500000,  sell: 14500000 },
    { name: 'POI Lighttoys Visual Poi (cặp)',            sku: 'LT-VP',     unit: 'Cặp',  cost: 6300000,  sell: 9800000  },
    { name: 'POI Lighttoys Contact Staff LED 1.2m',      sku: 'LT-CS-120', unit: 'Cây',  cost: 8000000,  sell: 12500000 },
    { name: 'POI Lighttoys Levitation Wand LED',         sku: 'LT-WAND',   unit: 'Cây',  cost: 4100000,  sell: 6500000  },
    { name: 'POI Lighttoys Fans LED V2 (cặp)',           sku: 'LT-FAN-V2', unit: 'Cặp',  cost: 7200000,  sell: 11200000 },
    { name: 'POI Lighttoys Hoop LED 90cm',               sku: 'LT-HOOP90', unit: 'Cái',  cost: 5700000,  sell: 8900000  },
    { name: 'POI Lighttoys Buugeng LED S-Staff (cặp)',   sku: 'LT-BUU',    unit: 'Cặp',  cost: 4900000,  sell: 7600000  },
    { name: 'POI Lighttoys Juggling Ball LED 70mm (set 3)', sku: 'LT-JB70', unit: 'Bộ',  cost: 3400000,  sell: 5400000  },
    // Mạch điều khiển LED
    { name: 'Mạch FPP-HSL Điều khiển LED Pixel 8 port',  sku: 'HSL-FPP-8', unit: 'Bộ',  cost: 2100000,  sell: 3390000  },
    { name: 'Mạch điều khiển LED Pixel Artnet 16 port',  sku: 'HSL-ART16', unit: 'Bộ',  cost: 3700000,  sell: 5800000  },
    { name: 'Mạch điều khiển LED ma trận DMX512 32 kênh', sku: 'HSL-DMX32', unit: 'Bộ', cost: 2700000,  sell: 4200000  },
    { name: 'Mạch điều khiển LED Wifi+Bluetooth HSL Pro', sku: 'HSL-WBT',  unit: 'Bộ',  cost: 2400000,  sell: 3750000  },
    { name: 'Mạch điều khiển LED Madrix Nebula 4 universe', sku: 'MX-NEB4', unit: 'Bộ', cost: 8200000,  sell: 12800000 },
    { name: 'Bộ xử lý tín hiệu LED Novastar MCTRL300',   sku: 'NS-M300',   unit: 'Bộ',  cost: 6100000,  sell: 9500000  },
    // Module màn hình LED
    { name: 'Module màn hình LED P2.5 indoor 320x160mm', sku: 'MOD-P2.5',  unit: 'Tấm', cost: 2050000,  sell: 3200000  },
    { name: 'Module màn hình LED P3 indoor 192x192mm',   sku: 'MOD-P3',    unit: 'Tấm', cost: 2200000,  sell: 3450000  },
    { name: 'Module màn hình LED P4 outdoor 256x128mm',  sku: 'MOD-P4',    unit: 'Tấm', cost: 2450000,  sell: 3850000  },
    { name: 'Module màn hình LED P5 outdoor SMD 320x160mm', sku: 'MOD-P5', unit: 'Tấm', cost: 2600000,  sell: 4100000  },
    { name: 'Tấm màn hình LED P10 outdoor full color 320x160mm', sku: 'MOD-P10', unit: 'Tấm', cost: 2300000, sell: 3600000 },
    // Cabin LED
    { name: 'Cabin màn hình LED đúc nhôm P2.6 500x500mm', sku: 'CAB-P2.6', unit: 'Cabin', cost: 8700000, sell: 13500000 },
    { name: 'Cabin màn hình LED đúc nhôm P3.91 500x500mm', sku: 'CAB-P391', unit: 'Cabin', cost: 7600000, sell: 11800000 },
    { name: 'Cabin màn hình LED outdoor P4.81 500x1000mm', sku: 'CAB-P481', unit: 'Cabin', cost: 9600000, sell: 14900000 },
    { name: 'Cabin LED sân khấu P3.91 sự kiện 500x500mm', sku: 'CAB-EV',  unit: 'Cabin', cost: 7800000, sell: 12200000 },
    // Phụ kiện cao cấp
    { name: 'Nguồn LED Meanwell HLG-300H-5 5V 60A',       sku: 'PSU-MW300', unit: 'Cái',  cost: 2000000, sell: 3150000 },
    { name: 'Bộ nhận tín hiệu LED Novastar A8s',          sku: 'NS-A8S',    unit: 'Cái',  cost: 2950000, sell: 4600000 },
    { name: 'Phần mềm điều khiển LED Madrix 5 Professional', sku: 'SW-MX5', unit: 'Bản', cost: 5700000, sell: 8900000 },
  ];

  const products = await Promise.all(productSeed.map((p) =>
    prisma.product.create({
      data: { name: p.name, sku: p.sku, unit: p.unit, costPrice: p.cost, sellingPrice: p.sell, stock: 0, taxRate: '10%' },
    })
  ));
  const productByName = new Map(products.map((p) => [p.name, p]));

  // ============================================================
  // 4. CUSTOMERS — 12 KH (mix doanh nghiệp + cá nhân)
  // ============================================================
  console.log('🤝  Tạo khách hàng...');
  const customerSeed = [
    { name: 'Công ty TNHH Sức Sống Entertainment',  taxCode: '0318180604', phone: '0287123456', email: 'kd@sucsong.vn',
      address: '1073/22 CMT8, Phường 7, Quận Tân Bình, TP.HCM', companyName: 'CT TNHH Sức Sống Entertainment' },
    { name: 'Công ty CP Truyền thông Vina',         taxCode: '0315670123', phone: '0287789012', email: 'media@vina.vn',
      address: '88 Tôn Đức Thắng, Quận 1, TP.HCM', companyName: 'CT CP Truyền thông Vina' },
    { name: 'Công ty TNHH Sự kiện Ánh Dương',       taxCode: '0313456701', phone: '0287456789', email: 'events@anhduong.vn',
      address: '50 Nguyễn Đình Chiểu, Quận 1, TP.HCM', companyName: 'CT TNHH Sự kiện Ánh Dương' },
    { name: 'Công ty TNHH Giải trí Đông Dương',     taxCode: '0314567012', phone: '0287345678', email: 'info@dongduong.vn',
      address: '15 Cao Thắng, Quận 3, TP.HCM', companyName: 'CT TNHH Giải trí Đông Dương' },
    { name: 'Công ty CP Sân khấu Việt',             taxCode: '0316789012', phone: '0287234567', email: 'sk@sankhauviet.vn',
      address: '120 Lê Lợi, Quận 1, TP.HCM', companyName: 'CT CP Sân khấu Việt' },
    { name: 'Công ty TNHH Tổ chức Sự kiện Sao Mai', taxCode: '0314567890', phone: '0287901234', email: 'kd@saomai.vn',
      address: '256 Điện Biên Phủ, Quận 3, TP.HCM', companyName: 'CT TNHH TCSK Sao Mai' },
    { name: 'Công ty CP Quảng cáo LED Việt',        taxCode: '0315678901', phone: '0287012345', email: 'led@qcviet.vn',
      address: '300 Nguyễn Văn Linh, Quận 7, TP.HCM', companyName: 'CT CP Quảng cáo LED Việt' },
    { name: 'Công ty TNHH Trang trí Sự kiện HCM',   taxCode: '0317890123', phone: '0287456701', email: 'info@ttsk.vn',
      address: '99 Phan Xích Long, Quận Phú Nhuận, TP.HCM', companyName: 'CT TNHH TTSK HCM' },
    // Cá nhân nghệ sĩ / freelancer
    { name: 'Nguyễn Văn Hải',         phone: '0901222333', address: '24 Lê Văn Sỹ, Q.3, TP.HCM' },
    { name: 'Trần Thị Thanh Hằng',    phone: '0901333444', address: '102 Nguyễn Văn Đậu, Bình Thạnh, TP.HCM' },
    { name: 'Lê Minh Khôi',           phone: '0901444555', address: '67 Hoàng Diệu, Q.4, TP.HCM' },
    { name: 'Phạm Quốc Việt (Nghệ sĩ Poi)', phone: '0901555666', address: '8 Hà Đức Trọng, Bà Rịa - VT' },
    { name: 'Hoàng Thị Ngọc Ánh',     phone: '0901666777', address: '156 Nguyễn Trãi, Q.5, TP.HCM' },
    { name: 'Vũ Đình Nam (Visual artist)', phone: '0901777888', address: '32 Trần Quang Khải, Q.1, TP.HCM' },
  ];
  const customers = await Promise.all(customerSeed.map((c) => prisma.customer.create({ data: c })));

  // ============================================================
  // 5. PURCHASE ORDERS — Nhập hàng từ NCC
  // ============================================================
  console.log('📦  Tạo đơn nhập hàng (PO)...');

  // Helper: tạo 1 PO với danh sách sản phẩm + qty
  let poCounter = 1;
  async function createPO(supplierId: number, dateAt: Date, lines: { productName: string; qty: number }[], paidRatio = 1) {
    const items = lines.map((l) => {
      const p = productByName.get(l.productName)!;
      return { productId: p.id, quantity: l.qty, costPrice: p.costPrice, subtotal: p.costPrice * l.qty };
    });
    const total = items.reduce((s, i) => s + i.subtotal, 0);
    const paid = Math.round(total * paidRatio);
    const code = `PO-${dateAt.getFullYear()}-${pad2(poCounter++)}`;
    const status = paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

    const po = await prisma.purchaseOrder.create({
      data: {
        code, supplierId, totalAmount: total, paidAmount: paid, status,
        createdAt: dateAt, updatedAt: dateAt,
        items: { create: items },
      },
    });

    // Tăng tồn kho + InventoryLog
    for (const ln of lines) {
      const p = productByName.get(ln.productName)!;
      await prisma.product.update({ where: { id: p.id }, data: { stock: { increment: ln.qty } } });
      await prisma.inventoryLog.create({
        data: { productId: p.id, type: 'in', quantity: ln.qty, reason: `Nhập từ PO ${code}`, refId: po.id, createdAt: dateAt },
      });
    }

    // Tăng nợ NCC + Cashflow expense (nếu đã trả)
    if (paid < total) {
      await prisma.supplier.update({ where: { id: supplierId }, data: { debt: { increment: total - paid } } });
    }
    if (paid > 0) {
      await prisma.supplierPayment.create({
        data: { purchaseOrderId: po.id, supplierId, amount: paid, method: 'transfer',
                note: `Thanh toán PO ${code}`, createdAt: dateAt },
      });
      await prisma.cashflow.create({
        data: { type: 'expense', category: 'purchase', amount: paid,
                description: `Thanh toán nhập hàng ${code}`, date: dateAt,
                refId: po.id, refType: 'purchase', createdAt: dateAt },
      });
    }
    return po;
  }

  // PO #1 — Lighttoys (POI) Q1/2025 — nhập sỉ đạo cụ
  await createPO(suppliers[0].id, dt('2025-01-15'), [
    { productName: 'POI Lighttoys Pixel Poi V3 (cặp)',     qty: 8 },
    { productName: 'POI Lighttoys Visual Poi (cặp)',       qty: 6 },
    { productName: 'POI Lighttoys Contact Staff LED 1.2m', qty: 5 },
    { productName: 'POI Lighttoys Levitation Wand LED',    qty: 10 },
    { productName: 'POI Lighttoys Fans LED V2 (cặp)',      qty: 6 },
    { productName: 'POI Lighttoys Hoop LED 90cm',          qty: 4 },
    { productName: 'POI Lighttoys Buugeng LED S-Staff (cặp)', qty: 4 },
    { productName: 'POI Lighttoys Juggling Ball LED 70mm (set 3)', qty: 8 },
  ], 1);

  // PO #2 — Novastar Q1/2025 — mạch điều khiển + receiver
  await createPO(suppliers[1].id, dt('2025-02-10'), [
    { productName: 'Bộ xử lý tín hiệu LED Novastar MCTRL300', qty: 6 },
    { productName: 'Bộ nhận tín hiệu LED Novastar A8s',       qty: 20 },
  ], 0.7);

  // PO #3 — Absen Q1/2025 — module màn hình
  await createPO(suppliers[2].id, dt('2025-03-05'), [
    { productName: 'Module màn hình LED P2.5 indoor 320x160mm', qty: 30 },
    { productName: 'Module màn hình LED P3 indoor 192x192mm',   qty: 30 },
    { productName: 'Module màn hình LED P4 outdoor 256x128mm',  qty: 25 },
    { productName: 'Module màn hình LED P5 outdoor SMD 320x160mm', qty: 25 },
    { productName: 'Tấm màn hình LED P10 outdoor full color 320x160mm', qty: 20 },
  ], 0.5);

  // PO #4 — Minh Tâm Q2/2025 — mạch HSL nội địa
  await createPO(suppliers[3].id, dt('2025-04-20'), [
    { productName: 'Mạch FPP-HSL Điều khiển LED Pixel 8 port',  qty: 25 },
    { productName: 'Mạch điều khiển LED Pixel Artnet 16 port',  qty: 15 },
    { productName: 'Mạch điều khiển LED ma trận DMX512 32 kênh', qty: 12 },
    { productName: 'Mạch điều khiển LED Wifi+Bluetooth HSL Pro', qty: 18 },
  ], 1);

  // PO #5 — Ánh Sáng Việt Q2/2025 — cabin LED
  await createPO(suppliers[4].id, dt('2025-06-12'), [
    { productName: 'Cabin màn hình LED đúc nhôm P2.6 500x500mm',  qty: 12 },
    { productName: 'Cabin màn hình LED đúc nhôm P3.91 500x500mm', qty: 16 },
    { productName: 'Cabin màn hình LED outdoor P4.81 500x1000mm', qty: 8 },
    { productName: 'Cabin LED sân khấu P3.91 sự kiện 500x500mm',  qty: 14 },
    { productName: 'Nguồn LED Meanwell HLG-300H-5 5V 60A',        qty: 30 },
  ], 0.6);

  // PO #6 — Madrix Q3/2025
  await createPO(suppliers[5].id, dt('2025-09-08'), [
    { productName: 'Mạch điều khiển LED Madrix Nebula 4 universe', qty: 5 },
    { productName: 'Phần mềm điều khiển LED Madrix 5 Professional', qty: 4 },
  ], 1);

  // PO #7 — Lighttoys Q4/2025 — restock
  await createPO(suppliers[0].id, dt('2025-11-22'), [
    { productName: 'POI Lighttoys Pixel Poi V3 (cặp)',  qty: 6 },
    { productName: 'POI Lighttoys Visual Poi (cặp)',    qty: 4 },
    { productName: 'POI Lighttoys Fans LED V2 (cặp)',   qty: 5 },
  ], 0.8);

  // PO #8 — Absen Q1/2026 — restock module
  await createPO(suppliers[2].id, dt('2026-02-18'), [
    { productName: 'Module màn hình LED P2.5 indoor 320x160mm', qty: 20 },
    { productName: 'Module màn hình LED P3 indoor 192x192mm',   qty: 20 },
    { productName: 'Cabin màn hình LED đúc nhôm P3.91 500x500mm', qty: 8 },
  ], 0.5);

  // ============================================================
  // 6. INVOICES — Phân bổ theo nhân viên cho test KPI
  // ============================================================
  console.log('🧾  Tạo hóa đơn bán hàng (KPI distribution)...');

  // KPI distribution: nhân viên có số lượng và giá trị khác nhau
  // Tổng ~42 invoices: 14 + 10 + 8 + 6 + 3 + 1 (resigned)
  const kpiPlan: { user: any; count: number; periodMonths: [number, number][] }[] = [
    // [year, month] ranges để phân tán đều
    { user: staffUsers[0], count: 14, periodMonths: [[2025,3],[2025,5],[2025,7],[2025,9],[2025,10],[2025,11],[2025,12],[2026,1],[2026,1],[2026,2],[2026,2],[2026,3],[2026,3],[2026,4]] },
    { user: staffUsers[1], count: 10, periodMonths: [[2025,4],[2025,6],[2025,8],[2025,10],[2025,12],[2026,1],[2026,2],[2026,2],[2026,3],[2026,4]] },
    { user: staffUsers[2], count: 8,  periodMonths: [[2025,6],[2025,8],[2025,9],[2025,11],[2026,1],[2026,2],[2026,3],[2026,4]] },
    { user: staffUsers[3], count: 6,  periodMonths: [[2025,9],[2025,11],[2026,1],[2026,2],[2026,3],[2026,4]] },
    { user: staffUsers[4], count: 3,  periodMonths: [[2026,2],[2026,3],[2026,4]] },
    { user: admin,         count: 2,  periodMonths: [[2025,5],[2025,12]] },
    { user: resigned,      count: 4,  periodMonths: [[2025,2],[2025,3],[2025,4],[2025,5]] },
  ];

  let invCounter = 1;
  let totalInvoices = 0;

  for (const plan of kpiPlan) {
    for (let i = 0; i < plan.count; i++) {
      const [year, month] = plan.periodMonths[i % plan.periodMonths.length];
      const date = dayInMonth(year, month);

      // Random 1-4 sản phẩm
      const numItems = rand(1, 4);
      const usedIdx = new Set<number>();
      const lines: { product: typeof products[0]; qty: number }[] = [];
      while (lines.length < numItems) {
        const idx = rand(0, products.length - 1);
        if (usedIdx.has(idx)) continue;
        usedIdx.add(idx);
        const p = products[idx];
        // Đảm bảo còn tồn kho
        const fresh = await prisma.product.findUnique({ where: { id: p.id } });
        if (!fresh || fresh.stock < 1) continue;
        const maxQty = Math.min(fresh.stock, 5);
        lines.push({ product: p, qty: rand(1, maxQty) });
      }
      if (lines.length === 0) continue;

      const items = lines.map((l) => ({
        productId: l.product.id, quantity: l.qty, price: l.product.sellingPrice,
        taxRate: '10%', subtotal: l.product.sellingPrice * l.qty,
      }));
      const subtotal = items.reduce((s, it) => s + it.subtotal, 0);
      const total = Math.round(subtotal * 1.1); // VAT 10%

      const customer = pick(customers);
      const code = `INV-${year}-${pad2(invCounter++)}`;

      // Tỉ lệ thanh toán: 60% paid full, 25% partial, 15% unpaid
      const r = Math.random();
      const paidAmount = r < 0.6 ? total : r < 0.85 ? Math.round(total * (0.3 + Math.random() * 0.4)) : 0;
      const status = paidAmount >= total ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

      const inv = await prisma.invoice.create({
        data: {
          code, customerId: customer.id, createdByUserId: plan.user.id,
          status, totalAmount: total, paidAmount,
          invoiceDate: date, createdAt: date, updatedAt: date,
          note: `Hóa đơn bán hàng - ${plan.user.name}`,
          items: { create: items },
        },
      });

      // Trừ tồn kho + log
      for (const ln of lines) {
        await prisma.product.update({ where: { id: ln.product.id }, data: { stock: { decrement: ln.qty } } });
        await prisma.inventoryLog.create({
          data: { productId: ln.product.id, type: 'out', quantity: ln.qty, reason: `Bán theo HĐ ${code}`, refId: inv.id, createdAt: date },
        });
      }

      // Tăng công nợ KH (phần chưa trả)
      const debt = total - paidAmount;
      if (debt > 0) {
        await prisma.customer.update({ where: { id: customer.id }, data: { debt: { increment: debt } } });
      }

      // Tạo Payment + cashflow income (nếu có)
      if (paidAmount > 0) {
        await prisma.payment.create({
          data: { invoiceId: inv.id, customerId: customer.id, amount: paidAmount,
                  method: Math.random() < 0.6 ? 'transfer' : 'cash',
                  note: `Thanh toán HĐ ${code}`, createdAt: date },
        });
        await prisma.cashflow.create({
          data: { type: 'income', category: 'payment_received', amount: paidAmount,
                  description: `Thu tiền HĐ ${code} - ${customer.name}`, date,
                  refId: inv.id, refType: 'invoice', createdAt: date },
        });
      }

      totalInvoices++;
    }
  }

  // ============================================================
  // 7. CASHFLOW — Chi phí cố định: lương, thuê mặt bằng, điện, internet, marketing
  // ============================================================
  console.log('💸  Tạo bút toán thu/chi định kỳ...');

  // Sinh chi phí hàng tháng từ 2025-01 đến 2026-04
  const months: [number, number][] = [];
  for (let y = 2025; y <= 2026; y++) {
    const mEnd = y === 2026 ? 4 : 12;
    for (let m = 1; m <= mEnd; m++) months.push([y, m]);
  }

  for (const [y, m] of months) {
    const day1 = new Date(`${y}-${pad2(m)}-05T09:00:00`);
    const day10 = new Date(`${y}-${pad2(m)}-10T10:00:00`);
    const day15 = new Date(`${y}-${pad2(m)}-15T11:00:00`);

    // Lương nhân viên (tổng ~ 35-50 triệu)
    await prisma.cashflow.create({
      data: { type: 'expense', category: 'salary', amount: rand(35000000, 50000000),
              description: `Lương nhân viên tháng ${m}/${y}`, date: day10, createdAt: day10 },
    });
    // Thuê mặt bằng
    await prisma.cashflow.create({
      data: { type: 'expense', category: 'rent', amount: 12000000,
              description: `Thuê mặt bằng kho + showroom T${m}/${y}`, date: day1, createdAt: day1 },
    });
    // Điện nước
    await prisma.cashflow.create({
      data: { type: 'expense', category: 'utility', amount: rand(2500000, 4500000),
              description: `Tiền điện nước T${m}/${y}`, date: day15, createdAt: day15 },
    });
    // Internet
    await prisma.cashflow.create({
      data: { type: 'expense', category: 'utility', amount: 850000,
              description: `Internet FPT business T${m}/${y}`, date: day1, createdAt: day1 },
    });
    // Marketing (random)
    if (Math.random() < 0.7) {
      await prisma.cashflow.create({
        data: { type: 'expense', category: 'marketing', amount: rand(3000000, 12000000),
                description: `Quảng cáo Facebook + Google T${m}/${y}`, date: day15, createdAt: day15 },
      });
    }
  }

  // Một số khoản thu khác (cho thuê thiết bị, dịch vụ lắp đặt)
  for (let i = 0; i < 12; i++) {
    const y = i < 8 ? 2025 : 2026;
    const m = i < 8 ? rand(1, 12) : rand(1, 4);
    const date = dayInMonth(y, m);
    await prisma.cashflow.create({
      data: { type: 'income', category: 'service',
              amount: rand(2000000, 8000000),
              description: pick([
                'Cho thuê màn hình LED sự kiện',
                'Dịch vụ lắp đặt cabin LED tại địa điểm',
                'Sửa chữa mạch điều khiển LED',
                'Cho thuê đạo cụ POI biểu diễn',
                'Tư vấn thiết kế hệ thống màn hình LED',
              ]),
              date, createdAt: date },
    });
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  const counts = {
    users: await prisma.user.count(),
    suppliers: await prisma.supplier.count(),
    products: await prisma.product.count(),
    customers: await prisma.customer.count(),
    purchaseOrders: await prisma.purchaseOrder.count(),
    invoices: await prisma.invoice.count(),
    payments: await prisma.payment.count(),
    cashflow: await prisma.cashflow.count(),
    inventoryLogs: await prisma.inventoryLog.count(),
  };

  console.log('\n✅  Seed hoàn tất!\n');
  console.log('📊  Thống kê:');
  for (const [k, v] of Object.entries(counts)) console.log(`     ${k.padEnd(16)} ${v}`);
  console.log('\n👤  Tài khoản đăng nhập:');
  console.log('     admin    / admin123   (Quản trị viên)');
  console.log('     thuylinh / staff123   (Trần Thùy Linh - top sales)');
  console.log('     minhquan / staff123   (Lê Minh Quân)');
  console.log('     hoangnam / staff123   (Phạm Hoàng Nam)');
  console.log('     thuhuong / staff123   (Đỗ Thu Hương)');
  console.log('     kimanh   / staff123   (Vũ Kim Anh - mới vào)');
  console.log('     oldnv    / staff123   (Hoàng Văn Cũ - đã nghỉ)\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
