import prisma from '../../utils/prisma';

type PurchaseItem = {
  productId: number;
  quantity: number;
  costPrice: number;
};

export const purchaseService = {
  async getAll() {
    return prisma.purchaseOrder.findMany({
      include: { supplier: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(id: number) {
    return prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, items: { include: { product: true } } },
    });
  },

  async create(data: { supplierId: number; items: PurchaseItem[]; note?: string }) {
    const { supplierId, items, note } = data;

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new Error('Không tìm thấy nhà cung cấp');

    const totalAmount = items.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);

    const count = await prisma.purchaseOrder.count();
    const code = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const purchase = await prisma.$transaction(async (tx) => {
      const newPurchase = await tx.purchaseOrder.create({
        data: {
          code,
          supplierId,
          totalAmount,
          note,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              costPrice: item.costPrice,
              subtotal: item.costPrice * item.quantity,
            })),
          },
        },
        include: { items: true },
      });

      // Tăng tồn kho + ghi inventory log + cập nhật giá vốn
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
            costPrice: item.costPrice, // cập nhật giá vốn mới nhất
          },
        });

        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            type: 'in',
            quantity: item.quantity,
            reason: 'purchase',
            refId: newPurchase.id,
          },
        });
      }

      // Tăng công nợ nhà cung cấp
      await tx.supplier.update({
        where: { id: supplierId },
        data: { debt: { increment: totalAmount } },
      });

      // Ghi cashflow (chi phí nhập hàng)
      await tx.cashflow.create({
        data: {
          type: 'expense',
          category: 'purchase',
          amount: totalAmount,
          description: `Nhập hàng đơn ${code}`,
          refId: newPurchase.id,
          refType: 'purchase',
        },
      });

      return newPurchase;
    });

    return purchase;
  },

  async cancel(id: number) {
    const purchase = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!purchase) throw new Error('Không tìm thấy đơn nhập hàng');
    if (purchase.status === 'cancelled') throw new Error('Đơn nhập đã bị hủy rồi');

    await prisma.$transaction(async (tx) => {
      // Đổi trạng thái
      await tx.purchaseOrder.update({ where: { id }, data: { status: 'cancelled' } });

      // Trừ lại tồn kho
      for (const item of purchase.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            type: 'out',
            quantity: item.quantity,
            reason: 'cancel',
            refId: id,
          },
        });
      }

      // Hoàn công nợ nhà cung cấp (chỉ phần chưa trả)
      const remaining = purchase.totalAmount - purchase.paidAmount;
      if (remaining > 0) {
        await tx.supplier.update({
          where: { id: purchase.supplierId },
          data: { debt: { decrement: remaining } },
        });
      }

      // Xóa bút toán cashflow gốc
      await tx.cashflow.deleteMany({
        where: { refId: id, refType: 'purchase' },
      });
    });
  },
};
