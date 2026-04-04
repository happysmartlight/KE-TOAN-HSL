import prisma from '../../utils/prisma';

export const inventoryService = {
  async getLogs(productId?: number) {
    return prisma.inventoryLog.findMany({
      where: productId ? { productId } : undefined,
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getLowStock(threshold = 5) {
    return prisma.product.findMany({
      where: { stock: { lte: threshold }, status: 'active' },
      orderBy: { stock: 'asc' },
    });
  },
};
