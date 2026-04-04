import * as XLSX from 'xlsx';

const COMPANY   = 'HAPPY SMART LIGHT';
const SUBTITLE  = 'Hệ thống Kế Toán Nội Bộ';
const GENERATED = () => `Xuất ngày: ${new Date().toLocaleString('vi-VN')}`;

/** Thêm 3 dòng header thương hiệu vào đầu mỗi sheet */
function addBrandHeader(ws: XLSX.WorkSheet, cols: number) {
  XLSX.utils.sheet_add_aoa(ws, [
    [COMPANY],
    [SUBTITLE],
    [GENERATED()],
    [],  // dòng trống
  ], { origin: 'A1' });

  // Merge cells cho tiêu đề (A1 đến cột cuối)
  const endCol = XLSX.utils.encode_col(cols - 1);
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push(
    { s: { r: 0, c: 0 }, e: { r: 0, c: cols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: cols - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: cols - 1 } },
  );

  // Style cho header rows
  const headerStyle = { font: { bold: true, sz: 14, color: { rgb: '00B0F0' } }, alignment: { horizontal: 'center' } };
  const subStyle    = { font: { sz: 11, color: { rgb: '808080' } }, alignment: { horizontal: 'center' } };

  ws['A1'] = { v: COMPANY,         t: 's', s: headerStyle };
  ws['A2'] = { v: SUBTITLE,        t: 's', s: subStyle };
  ws['A3'] = { v: GENERATED(),     t: 's', s: subStyle };
  ws[`${endCol}1`]; // ensure ref

  return ws;
}

/** Tạo sheet có brand header + data */
function makeSheet(data: any[]): XLSX.WorkSheet {
  if (data.length === 0) return XLSX.utils.json_to_sheet(data);
  const cols = Object.keys(data[0]).length;
  // Tạo sheet từ data, offset 4 dòng (3 header + 1 trống)
  const ws = XLSX.utils.json_to_sheet(data, { origin: 'A5' });
  addBrandHeader(ws, cols);

  // Cột rộng tự động
  const colWidths = Object.keys(data[0]).map((k) => ({
    wch: Math.max(k.length, ...data.map((r) => String(r[k] ?? '').length)) + 2,
  }));
  ws['!cols'] = colWidths;

  return ws;
}

export function exportToExcel(data: any[], sheetName: string, fileName: string) {
  const ws = makeSheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export function exportReportExcel(pl: any, debt: any, cashflow: any) {
  const wb   = XLSX.utils.book_new();
  const date = new Date().toISOString().slice(0, 10);

  // Sheet 1: Lãi/Lỗ
  XLSX.utils.book_append_sheet(wb, makeSheet([
    { 'Chỉ tiêu': 'Doanh thu',          'Số tiền (₫)': pl.revenue       },
    { 'Chỉ tiêu': 'Giá vốn hàng bán',  'Số tiền (₫)': pl.cogs          },
    { 'Chỉ tiêu': 'Lãi gộp',           'Số tiền (₫)': pl.grossProfit   },
    { 'Chỉ tiêu': 'Chi phí khác',       'Số tiền (₫)': pl.otherExpenses },
    { 'Chỉ tiêu': 'Lợi nhuận ròng',    'Số tiền (₫)': pl.netProfit     },
  ]), 'Lãi Lỗ');

  // Sheet 2: Công nợ
  XLSX.utils.book_append_sheet(wb, makeSheet([
    { 'Loại': 'Phải thu (khách hàng)',   'Số tiền (₫)': debt.totalReceivable },
    { 'Loại': 'Phải trả (nhà cung cấp)','Số tiền (₫)': debt.totalPayable    },
  ]), 'Công Nợ');

  // Sheet 3: Top KH nợ
  if (debt.topDebtors?.length) {
    XLSX.utils.book_append_sheet(wb, makeSheet(
      debt.topDebtors.map((c: any) => ({
        'Khách hàng': c.name, 'Điện thoại': c.phone || '', 'Công nợ (₫)': c.debt,
      }))
    ), 'KH Nợ');
  }

  // Sheet 4: Cashflow
  if (cashflow?.entries?.length) {
    XLSX.utils.book_append_sheet(wb, makeSheet(
      cashflow.entries.map((e: any) => ({
        'Loại': e.type === 'income' ? 'Thu' : 'Chi',
        'Danh mục': e.category,
        'Số tiền (₫)': e.amount,
        'Mô tả': e.description || '',
        'Ngày': new Date(e.createdAt).toLocaleDateString('vi-VN'),
      }))
    ), 'Thu Chi');
  }

  XLSX.writeFile(wb, `bao-cao-ke-toan-${date}.xlsx`);
}
