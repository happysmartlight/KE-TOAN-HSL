import prisma from '../../utils/prisma';

export const supplierService = {
  async getAll() {
    const suppliers = await prisma.supplier.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      include: {
        purchases: { select: { totalAmount: true } },
      },
    });
    return suppliers.map((s) => ({
      ...s,
      totalOrdered: s.purchases.reduce((sum, p) => sum + p.totalAmount, 0),
      orderCount:   s.purchases.length,
    }));
  },

  async getById(id: number) {
    return prisma.supplier.findUnique({
      where: { id },
      include: { purchases: true },
    });
  },

  async create(data: {
    name: string; phone?: string; email?: string; address?: string;
    companyName?: string; taxCode?: string; supplierType?: string;
  }) {
    return prisma.supplier.create({ data });
  },

  async update(id: number, data: Partial<{
    name: string; phone: string; email: string; address: string;
    companyName: string; taxCode: string; supplierType: string;
  }>) {
    return prisma.supplier.update({ where: { id }, data });
  },

  async taxLookup(taxCode: string) {
    const url = `https://api.xinvoice.vn/gdt-api/tax-payer/${taxCode.trim()}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Không tìm thấy thông tin MST');
    const raw = await response.json() as any;
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
    return prisma.supplier.delete({ where: { id } });
  },
};
