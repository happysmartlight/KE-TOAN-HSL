// Generator: tạo 25 file XML hóa đơn mẫu dựa trên template 3502535621_1C25TSL_2.xml
// Chạy: node scripts/gen-sample-invoices.js
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'sample-invoices');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ===== Dữ liệu mẫu =====
const buyers = [
  // Doanh nghiệp
  { ten: 'CÔNG TY TNHH SỨC SỐNG ENTERTAINMENT', mst: '0318180604', dchi: '1073/22 Cách Mạng Tháng Tám, Phường 7, Quận Tân Bình, TP. Hồ Chí Minh', hvt: 'LÊ PHƯỚC QUỐC' },
  { ten: 'CÔNG TY CỔ PHẦN ĐIỆN TỬ VIỄN ĐÔNG', mst: '0301234567', dchi: '15 Nguyễn Văn Cừ, Phường Cầu Kho, Quận 1, TP. Hồ Chí Minh', hvt: 'NGUYỄN VĂN AN' },
  { ten: 'CÔNG TY TNHH XÂY DỰNG MINH PHÚC', mst: '0312345678', dchi: '88 Trần Hưng Đạo, Phường Phan Chu Trinh, Quận Hoàn Kiếm, Hà Nội', hvt: 'TRẦN MINH PHÚC' },
  { ten: 'CÔNG TY TNHH THIẾT BỊ ÁNH SÁNG SAO MAI', mst: '0314567890', dchi: '120 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh', hvt: 'PHẠM THỊ MAI' },
  { ten: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ ABC', mst: '0315678901', dchi: '256 Điện Biên Phủ, Phường 7, Quận 3, TP. Hồ Chí Minh', hvt: 'HOÀNG VĂN BÌNH' },
  { ten: 'CÔNG TY TNHH TM DV HOÀNG GIA', mst: '0316789012', dchi: '45 Nguyễn Thị Minh Khai, Phường Bến Nghé, Quận 1, TP. HCM', hvt: 'LÝ HOÀNG GIA' },
  { ten: 'CÔNG TY TNHH NỘI THẤT VIỆT NHẬT', mst: '0317890123', dchi: '99 Phan Xích Long, Phường 2, Quận Phú Nhuận, TP. HCM', hvt: 'ĐỖ THÀNH TRUNG' },
  { ten: 'CÔNG TY CỔ PHẦN GIẢI PHÁP IOT VIỆT', mst: '0318901234', dchi: '12 Nguyễn Trãi, Phường Thanh Xuân Trung, Quận Thanh Xuân, Hà Nội', hvt: 'VŨ MINH ĐỨC' },
  { ten: 'CÔNG TY TNHH KỸ THUẬT ĐIỆN BÁCH KHOA', mst: '0319012345', dchi: '1A Đại Cồ Việt, Phường Bách Khoa, Quận Hai Bà Trưng, Hà Nội', hvt: 'NGUYỄN QUANG HẢI' },
  { ten: 'CÔNG TY TNHH SẢN XUẤT BAO BÌ TÂN PHÚ', mst: '0310123456', dchi: '78 Tân Hòa Đông, Phường 14, Quận 6, TP. HCM', hvt: 'BÙI THỊ LAN' },
  { ten: 'CÔNG TY CỔ PHẦN NĂNG LƯỢNG XANH', mst: '0311234567', dchi: '300 Nguyễn Văn Linh, Phường Tân Phong, Quận 7, TP. HCM', hvt: 'PHAN ANH TUẤN' },
  { ten: 'CÔNG TY TNHH PHÒNG THU ÂM STAR', mst: '0312345670', dchi: '20 Lý Tự Trọng, Phường Bến Nghé, Quận 1, TP. HCM', hvt: 'TRƯƠNG THỊ KIM' },
  { ten: 'CÔNG TY TNHH SỰ KIỆN ÁNH DƯƠNG', mst: '0313456701', dchi: '50 Nguyễn Đình Chiểu, Phường Đa Kao, Quận 1, TP. HCM', hvt: 'CAO MINH CHÂU' },
  { ten: 'CÔNG TY TNHH GIẢI TRÍ ĐÔNG DƯƠNG', mst: '0314567012', dchi: '15 Cao Thắng, Phường 5, Quận 3, TP. HCM', hvt: 'NGÔ VĂN HÙNG' },
  { ten: 'CÔNG TY CỔ PHẦN TRUYỀN THÔNG VINA', mst: '0315670123', dchi: '88 Tôn Đức Thắng, Phường Bến Nghé, Quận 1, TP. HCM', hvt: 'ĐẶNG THỊ HƯƠNG' },
  // Cá nhân (không MST)
  { ten: 'NGUYỄN VĂN HẢI', mst: '', dchi: '24 Lê Văn Sỹ, Phường 13, Quận 3, TP. HCM', hvt: 'NGUYỄN VĂN HẢI' },
  { ten: 'TRẦN THỊ THANH HẰNG', mst: '', dchi: '102 Nguyễn Văn Đậu, Phường 11, Quận Bình Thạnh, TP. HCM', hvt: 'TRẦN THỊ THANH HẰNG' },
  { ten: 'LÊ MINH KHÔI', mst: '', dchi: '67 Hoàng Diệu, Phường 12, Quận 4, TP. HCM', hvt: 'LÊ MINH KHÔI' },
  { ten: 'PHẠM QUỐC VIỆT', mst: '', dchi: '8 Hà Đức Trọng, Phường Long Toàn, TP. Bà Rịa, Bà Rịa - Vũng Tàu', hvt: 'PHẠM QUỐC VIỆT' },
  { ten: 'HOÀNG THỊ NGỌC ÁNH', mst: '', dchi: '156 Nguyễn Trãi, Phường 3, Quận 5, TP. HCM', hvt: 'HOÀNG THỊ NGỌC ÁNH' },
  { ten: 'VŨ ĐÌNH NAM', mst: '', dchi: '32 Trần Quang Khải, Phường Tân Định, Quận 1, TP. HCM', hvt: 'VŨ ĐÌNH NAM' },
  { ten: 'BÙI THANH TÙNG', mst: '', dchi: '45 Phạm Văn Đồng, Phường Linh Đông, TP. Thủ Đức, TP. HCM', hvt: 'BÙI THANH TÙNG' },
  { ten: 'ĐẶNG HỮU PHÚC', mst: '', dchi: '12 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. HCM', hvt: 'ĐẶNG HỮU PHÚC' },
  { ten: 'NGÔ THỊ MỸ LINH', mst: '', dchi: '78 Võ Thị Sáu, Phường 6, Quận 3, TP. HCM', hvt: 'NGÔ THỊ MỸ LINH' },
  { ten: 'CHU VĂN BÌNH', mst: '', dchi: '90 Cộng Hòa, Phường 4, Quận Tân Bình, TP. HCM', hvt: 'CHU VĂN BÌNH' },
];

// Bộ sản phẩm: tên, đơn vị, đơn giá (chưa VAT) — chuyên LED, POI Lighttoys, mạch ĐK, màn hình LED, cabin LED
const products = [
  // POI Lighttoys (đạo cụ biểu diễn ánh sáng)
  { ten: 'POI Lighttoys Pixel Poi V3 (cặp)', dvt: 'Cặp', dgia: 14500000 },
  { ten: 'POI Lighttoys Visual Poi (cặp)', dvt: 'Cặp', dgia: 9800000 },
  { ten: 'POI Lighttoys Contact Staff LED 1.2m', dvt: 'Cây', dgia: 12500000 },
  { ten: 'POI Lighttoys Levitation Wand LED', dvt: 'Cây', dgia: 6500000 },
  { ten: 'POI Lighttoys Fans LED V2 (cặp)', dvt: 'Cặp', dgia: 11200000 },
  { ten: 'POI Lighttoys Hoop LED 90cm', dvt: 'Cái', dgia: 8900000 },
  { ten: 'POI Lighttoys Buugeng LED S-Staff (cặp)', dvt: 'Cặp', dgia: 7600000 },
  { ten: 'POI Lighttoys Juggling Ball LED 70mm (set 3)', dvt: 'Bộ', dgia: 5400000 },
  // Mạch điều khiển LED
  { ten: 'Mạch FPP-HSL Điều khiển LED Pixel 8 port', dvt: 'Bộ', dgia: 3390000 },
  { ten: 'Mạch điều khiển LED Pixel Artnet 16 port', dvt: 'Bộ', dgia: 5800000 },
  { ten: 'Mạch điều khiển LED ma trận DMX512 32 kênh', dvt: 'Bộ', dgia: 4200000 },
  { ten: 'Mạch điều khiển LED Wifi+Bluetooth HSL Pro', dvt: 'Bộ', dgia: 3750000 },
  { ten: 'Mạch điều khiển LED Madrix Nebula 4 universe', dvt: 'Bộ', dgia: 12800000 },
  { ten: 'Bộ xử lý tín hiệu LED Novastar MCTRL300', dvt: 'Bộ', dgia: 9500000 },
  // Màn hình LED (module / tấm)
  { ten: 'Module màn hình LED P2.5 indoor 320x160mm', dvt: 'Tấm', dgia: 3200000 },
  { ten: 'Module màn hình LED P3 indoor 192x192mm', dvt: 'Tấm', dgia: 3450000 },
  { ten: 'Module màn hình LED P4 outdoor 256x128mm', dvt: 'Tấm', dgia: 3850000 },
  { ten: 'Module màn hình LED P5 outdoor SMD 320x160mm', dvt: 'Tấm', dgia: 4100000 },
  { ten: 'Tấm màn hình LED P10 outdoor full color 320x160mm', dvt: 'Tấm', dgia: 3600000 },
  // Cabin LED
  { ten: 'Cabin màn hình LED đúc nhôm P2.6 500x500mm', dvt: 'Cabin', dgia: 13500000 },
  { ten: 'Cabin màn hình LED đúc nhôm P3.91 500x500mm', dvt: 'Cabin', dgia: 11800000 },
  { ten: 'Cabin màn hình LED outdoor P4.81 500x1000mm', dvt: 'Cabin', dgia: 14900000 },
  { ten: 'Cabin LED sân khấu P3.91 sự kiện 500x500mm', dvt: 'Cabin', dgia: 12200000 },
  // Phụ kiện cao cấp đi kèm
  { ten: 'Nguồn LED Meanwell HLG-300H-5 5V 60A', dvt: 'Cái', dgia: 3150000 },
  { ten: 'Bộ nhận tín hiệu LED Novastar A8s', dvt: 'Cái', dgia: 4600000 },
  { ten: 'Phần mềm điều khiển LED Madrix 5 Professional', dvt: 'Bản', dgia: 8900000 },
];

// Số chuyển sang chữ tiếng Việt (rút gọn cho mẫu)
function numToWords(n) {
  // Implementation đơn giản
  if (n === 0) return 'Không đồng';
  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  function readGroup(num) {
    const tr = Math.floor(num / 100);
    const ch = Math.floor((num % 100) / 10);
    const dv = num % 10;
    let s = '';
    if (tr > 0) s += units[tr] + ' trăm ';
    if (ch > 1) { s += units[ch] + ' mươi '; if (dv === 1) s += 'mốt'; else if (dv === 5) s += 'lăm'; else if (dv > 0) s += units[dv]; }
    else if (ch === 1) { s += 'mười '; if (dv === 5) s += 'lăm'; else if (dv > 0) s += units[dv]; }
    else if (ch === 0 && dv > 0) { if (tr > 0) s += 'lẻ '; s += units[dv]; }
    return s.trim();
  }
  const ty = Math.floor(n / 1e9);
  const tr = Math.floor((n % 1e9) / 1e6);
  const ng = Math.floor((n % 1e6) / 1e3);
  const dv = n % 1e3;
  let result = '';
  if (ty > 0) result += readGroup(ty) + ' tỷ ';
  if (tr > 0) result += readGroup(tr) + ' triệu ';
  if (ng > 0) result += readGroup(ng) + ' nghìn ';
  if (dv > 0) result += readGroup(dv);
  result = result.trim() + ' đồng';
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad2(n) { return String(n).padStart(2, '0'); }

function genInvoice(idx, buyer, opts = {}) {
  const { year = 2025, monthFrom = 1, monthTo = 12, sttStart = 10, khh = 'C25TSL' } = opts;
  const sttHd = idx + sttStart;
  const month = rand(monthFrom, monthTo);
  const day = rand(1, 28);
  const dateStr = `${year}-${pad2(month)}-${pad2(day)}`;

  // Random 1-5 items
  const numItems = rand(1, 5);
  const picked = [];
  const used = new Set();
  while (picked.length < numItems) {
    const i = rand(0, products.length - 1);
    if (used.has(i)) continue;
    used.add(i);
    picked.push({ ...products[i], sl: rand(1, 6) });
  }

  // Random thuế suất chung cho hóa đơn (đa số 10%, một số 8% hoặc 5%)
  const taxOptions = ['10%', '10%', '10%', '8%', '5%'];
  const tsuat = taxOptions[rand(0, taxOptions.length - 1)];
  const taxPct = parseInt(tsuat) / 100;

  let tgTCThue = 0;
  const itemsXml = picked.map((p, i) => {
    const thTien = p.sl * p.dgia;
    tgTCThue += thTien;
    return `<HHDVu><TChat>1</TChat><STT>${i + 1}</STT><THHDVu>${esc(p.ten)}</THHDVu><DVTinh>${p.dvt}</DVTinh><SLuong>${p.sl}</SLuong><DGia>${p.dgia}</DGia><TLCKhau>0</TLCKhau><STCKhau>0</STCKhau><ThTien>${thTien}</ThTien><TSuat>${tsuat}</TSuat></HHDVu>`;
  }).join('');

  const tgTThue = Math.round(tgTCThue * taxPct);
  const tgTTTBSo = tgTCThue + tgTThue;
  const chu = numToWords(tgTTTBSo);

  const mstXml = buyer.mst ? `<MST>${buyer.mst}</MST>` : '';

  const xml = `<HDon><DLHDon Id="DLHDon"><TTChung><PBan>2.0.1</PBan><THDon>Hóa đơn điện tử giá trị gia tăng</THDon><KHMSHDon>1</KHMSHDon><KHHDon>${khh}</KHHDon><SHDon>${sttHd}</SHDon><NLap>${dateStr}</NLap><HTTToan>Tiền mặt/Chuyển khoản</HTTToan><DVTTe>VND</DVTTe><TGia>1</TGia><MSTTCGP>0309612872</MSTTCGP></TTChung><NDHDon><NBan><Ten>CÔNG TY TNHH THƯƠNG MẠI VÀ CÔNG NGHỆ HAPPY SMART LIGHT</Ten><MST>3502535621</MST><DChi>42 Hà Đức Trọng, Phường Long Toàn, Thành phố Bà Rịa, Tỉnh Bà Rịa - Vũng Tàu</DChi></NBan><NMua><Ten>${esc(buyer.ten)}</Ten>${mstXml}<DChi>${esc(buyer.dchi)}</DChi><HVTNMHang>${esc(buyer.hvt)}</HVTNMHang></NMua><DSHHDVu>${itemsXml}</DSHHDVu><TToan><TgTCThue>${tgTCThue}</TgTCThue><TgTThue>${tgTThue}</TgTThue><THTTLTSuat><LTSuat><TSuat>${tsuat}</TSuat><ThTien>${tgTCThue}</ThTien><TThue>${tgTThue}</TThue></LTSuat></THTTLTSuat><TTCKTMai>0</TTCKTMai><TgTTTBSo>${tgTTTBSo}</TgTTTBSo><TgTTTBChu>${chu}</TgTTTBChu></TToan></NDHDon><TTKhac><TTin><TTruong>Trangtracuu</TTruong><KDLieu>String</KDLieu><DLieu>tracuuhd.smartsign.com.vn</DLieu></TTin><TTin><TTruong>Matracuu</TTruong><KDLieu>String</KDLieu><DLieu>SAMPLE${pad2(sttHd)}VN</DLieu></TTin></TTKhac></DLHDon><MCCQT>SAMPLE-${sttHd}</MCCQT></HDon>`;

  const fname = `3502535621_1${khh}_${sttHd}.xml`;
  fs.writeFileSync(path.join(OUT_DIR, fname), xml, 'utf8');
  return { fname, buyer: buyer.ten, total: tgTTTBSo, items: numItems };
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// CLI args: --year=2026 --from=1 --to=4 --start=10 --khh=C26TSL
const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)=(.+)$/); return m ? [m[1], m[2]] : [a, true];
}));
const opts = {
  year: parseInt(argv.year || '2025'),
  monthFrom: parseInt(argv.from || '1'),
  monthTo: parseInt(argv.to || '12'),
  sttStart: parseInt(argv.start || '10'),
  khh: argv.khh || 'C25TSL',
};

const results = buyers.map((b, i) => genInvoice(i, b, opts));
console.log(`Đã tạo ${results.length} file XML trong: ${OUT_DIR}`);
console.log(`  Năm: ${opts.year}, tháng ${opts.monthFrom}-${opts.monthTo}, KHHDon: ${opts.khh}, SHDon từ: ${opts.sttStart}`);
results.forEach(r => console.log(`  ${r.fname}  —  ${r.buyer}  —  ${r.total.toLocaleString('vi-VN')} đ  (${r.items} mục)`));
