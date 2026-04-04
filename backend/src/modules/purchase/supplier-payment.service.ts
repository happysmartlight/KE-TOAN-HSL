import prisma from '../../utils/prisma';

export const supplierPaymentService = {
  async getAll() {
    return prisma.supplierPayment.findMany({
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(data: { supplierId: number; amount: number; method?: string; note?: string }) {
    const { supplierId, amount, method = 'cash', note } = data;

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new Error('Không tìm thấy nhà cung cấp');
    if (amount > supplier.debt) {
      throw new Error(`Số tiền vượt quá công nợ (đang nợ ${supplier.debt.toLocaleString('vi-VN')} đ)`);
    }

    return prisma.$transaction(async (tx) => {
      const payment = await tx.supplierPayment.create({
        data: { supplierId, amount, method, note },
      });

      await tx.supplier.update({
        where: { id: supplierId },
        data: { debt: { decrement: amount } },
      });

      await tx.cashflow.create({
        data: {
          type: 'expense',
          category: 'purchase',
          amount,
          description: `Trả tiền nhà cung cấp: ${supplier.name}`,
          refId: payment.id,
          refType: 'supplier_payment',
        },
      });

      return payment;
    });
  },
};
