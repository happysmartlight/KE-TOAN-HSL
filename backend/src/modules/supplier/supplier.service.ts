import prisma from '../../utils/prisma';

export const supplierService = {
  async getAll() {
    return prisma.supplier.findMany({ where: { status: 'active' }, orderBy: { createdAt: 'desc' } });
  },

  async getById(id: number) {
    return prisma.supplier.findUnique({
      where: { id },
      include: { purchases: true },
    });
  },

  async create(data: { name: string; phone?: string; email?: string; address?: string }) {
    return prisma.supplier.create({ data });
  },

  async update(id: number, data: Partial<{ name: string; phone: string; email: string; address: string }>) {
    return prisma.supplier.update({ where: { id }, data });
  },

  async delete(id: number) {
    return prisma.supplier.delete({ where: { id } });
  },
};
