import prisma from '../../utils/prisma';

export const productService = {
  async getAll() {
    return prisma.product.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' } });
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

