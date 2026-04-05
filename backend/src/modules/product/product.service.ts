import prisma from '../../utils/prisma';

export const productService = {
  async getAll() {
    const products = await prisma.product.findMany({
      where: { status: 'active' },
      orderBy: { name: 'asc' },
    });

    // Tổng hợp doanh số từ các hóa đơn chưa hủy
    const items = await prisma.invoiceItem.findMany({
      where: { invoice: { status: { not: 'cancelled' } } },
      select: { productId: true, quantity: true, price: true },
    });
    const salesMap = new Map<number, { totalSold: number; totalRevenue: number }>();
    for (const it of items) {
      const cur = salesMap.get(it.productId) ?? { totalSold: 0, totalRevenue: 0 };
      salesMap.set(it.productId, {
        totalSold:    cur.totalSold + it.quantity,
        totalRevenue: cur.totalRevenue + it.quantity * it.price,
      });
    }

    return products.map((p) => ({
      ...p,
      totalSold:    salesMap.get(p.id)?.totalSold    ?? 0,
      totalRevenue: salesMap.get(p.id)?.totalRevenue ?? 0,
    }));
  },

  async getById(id: number) {
    return prisma.product.findUnique({ where: { id } });
  },

  async create(data: {
    name: string;
    sku?: string;
    unit?: string;
    costPrice?: number;
    sellingPrice?: number;
    stock?: number;
    taxRate?: string;
  }) {
    return prisma.product.create({ data });
  },

  async update(id: number, data: Partial<{
    name: string;
    sku: string;
    unit: string;
    costPrice: number;
    sellingPrice: number;
    stock: number;
    taxRate: string;
  }>) {
    return prisma.product.update({ where: { id }, data });
  },

  async delete(id: number) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new Error('Sản phẩm không tồn tại');
    // Soft delete – giữ dữ liệu lịch sử hóa đơn / kho, chỉ ẩn khỏi danh sách
    return prisma.product.update({
      where: { id },
      data: { status: 'deleted', deletedAt: new Date() },
    });
  },
};

