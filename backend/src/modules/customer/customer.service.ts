import prisma from '../../utils/prisma';

export const customerService = {
  async getAll() {
    const customers = await prisma.customer.findMany({
      where: { status: 'active' },
      include: {
        invoices: {
          where: { status: { not: 'cancelled' } },
          select: { totalAmount: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return customers.map((c) => ({
      ...c,
      totalPurchased: c.invoices.reduce((s, inv) => s + inv.totalAmount, 0),
      invoiceCount: c.invoices.length,
    }));
  },

  async getById(id: number) {
    return prisma.customer.findUnique({
      where: { id },
      include: { invoices: true, payments: true },
    });
  },

  async create(data: { name: string; phone?: string; email?: string; address?: string; companyName?: string; taxCode?: string }) {
    return prisma.customer.create({ data });
  },

  async update(id: number, data: Partial<{ name: string; phone: string; email: string; address: string; companyName: string; taxCode: string }>) {
    return prisma.customer.update({ where: { id }, data });
  },

  async taxLookup(taxCode: string) {
    const url = `https://api.xinvoice.vn/gdt-api/tax-payer/${taxCode.trim()}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Không tìm thấy thông tin MST');
    const raw = await response.json() as any;
    // Normalize các định dạng response khác nhau
    const data = raw?.data || raw;
    if (!data || (!data.name && !data.tenDoanhNghiep && !data.ten)) {
      throw new Error('MST không tồn tại hoặc không có dữ liệu');
    }
    return {
      name:    data.name || data.tenDoanhNghiep || data.ten || '',
      address: data.address || data.diaChi || data.diaChiKinhDoanh || '',
      status:  data.status || data.trangThai || data.tinhTrang || '',
      taxCode: taxCode.trim(),
    };
  },

  async delete(id: number) {
    return prisma.customer.delete({ where: { id } });
  },
};
