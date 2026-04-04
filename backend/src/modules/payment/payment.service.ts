import prisma from '../../utils/prisma';

export const paymentService = {
  async getAll() {
    return prisma.payment.findMany({
      include: { customer: true, invoice: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(data: { invoiceId: number; amount: number; method?: string; note?: string }) {
    const { invoiceId, amount, method = 'cash', note } = data;

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new Error('Không tìm thấy hóa đơn');

    const remaining = invoice.totalAmount - invoice.paidAmount;
    if (amount > remaining) {
      throw new Error(`Số tiền thanh toán vượt quá số còn nợ (${remaining.toLocaleString('vi-VN')} đ)`);
    }

    const payment = await prisma.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          invoiceId,
          customerId: invoice.customerId,
          amount,
          method,
          note,
        },
      });

      const newPaidAmount = invoice.paidAmount + amount;
      const newStatus =
        newPaidAmount >= invoice.totalAmount
          ? 'paid'
          : newPaidAmount > 0
          ? 'partial'
          : 'unpaid';

      // Cập nhật trạng thái hóa đơn
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { paidAmount: newPaidAmount, status: newStatus },
      });

      // Giảm công nợ khách hàng
      await tx.customer.update({
        where: { id: invoice.customerId },
        data: { debt: { decrement: amount } },
      });

      // Ghi cashflow (tiền mặt thu vào)
      await tx.cashflow.create({
        data: {
          type: 'income',
          category: 'payment_received',
          amount,
          date: new Date(),
          description: `Thu tiền hóa đơn ${invoice.code}`,
          refId: newPayment.id,
          refType: 'payment',
        },
      });

      return newPayment;
    });

    return payment;
  },
};
