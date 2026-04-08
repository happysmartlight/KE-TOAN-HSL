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

  /**
   * Hoàn tác (xóa) một payment + đảo ngược toàn bộ hậu quả:
   *  - Trừ paidAmount của hóa đơn, recompute status
   *  - Tăng lại công nợ khách hàng (nếu hóa đơn không bị hủy)
   *  - Xóa cashflow income tương ứng
   */
  async delete(id: number) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { invoice: true },
    });
    if (!payment) throw new Error('Không tìm thấy phiếu thu');
    if (!payment.invoice) throw new Error('Hóa đơn của phiếu thu không tồn tại');

    return prisma.$transaction(async (tx) => {
      const newPaidAmount = Math.max(0, payment.invoice!.paidAmount - payment.amount);
      const recomputed =
        newPaidAmount >= payment.invoice!.totalAmount && payment.invoice!.totalAmount > 0
          ? 'paid'
          : newPaidAmount > 0
          ? 'partial'
          : 'unpaid';

      // Hóa đơn đã hủy → giữ status 'cancelled', không revert
      const finalStatus = payment.invoice!.status === 'cancelled' ? 'cancelled' : recomputed;

      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { paidAmount: newPaidAmount, status: finalStatus },
      });

      // Tăng lại công nợ KH (chỉ khi hóa đơn không bị hủy — nếu hủy thì
      // debt đã được decrement khi cancel, không cần tăng lại)
      if (payment.invoice!.status !== 'cancelled') {
        await tx.customer.update({
          where: { id: payment.customerId },
          data: { debt: { increment: payment.amount } },
        });
      }

      // Xóa cashflow tương ứng (refType='payment', refId=payment.id)
      await tx.cashflow.deleteMany({
        where: { refType: 'payment', refId: payment.id },
      });

      // Xóa payment record
      await tx.payment.delete({ where: { id: payment.id } });

      return { ok: true };
    });
  },
};
