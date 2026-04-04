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
  }>) {
    return prisma.product.update({ where: { id }, data });
  },

  async delete(id: number) {
    return prisma.product.delete({ where: { id } });
  },
};
