import prisma from '../../utils/prisma';

/**
 * Tính status mới cho 1 PO dựa trên paidAmount.
 * Không đổi 'cancelled'.
 */
function calcStatus(totalAmount: number, paidAmount: number, currentStatus: string) {
  if (currentStatus === 'cancelled') return 'cancelled';
  if (paidAmount >= totalAmount)     return 'paid';
  if (paidAmount > 0)                return 'partial';
  return 'unpaid';
}

export const supplierPaymentService = {
  async getAll() {
    return prisma.supplierPayment.findMany({
      include: { supplier: true, purchaseOrder: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Thanh toán cho nhà cung cấp.
   * 2 mode:
   *   - `purchaseOrderId`: trả thẳng cho 1 đơn nhập cụ thể (update PO + supplier + cashflow)
   *   - `supplierId`: trả tổng cho NCC → tự động FIFO apply vào các PO chưa trả xong
   */
  async create(data: {
    purchaseOrderId?: number;
    supplierId?: number;
    amount: number;
    method?: string;
    note?: string;
  }) {
    const { purchaseOrderId, supplierId, amount, method = 'cash', note } = data;

    if (!amount || amount <= 0) throw new Error('Số tiền không hợp lệ');

    // ── Mode 1: Trả cho 1 PO cụ thể ─────────────────────────────────────────
    if (purchaseOrderId) {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: { supplier: true },
      });
      if (!po) throw new Error('Không tìm thấy đơn nhập hàng');
      if (po.status === 'cancelled') throw new Error('Đơn nhập đã bị hủy, không thể thanh toán');

      const remaining = po.totalAmount - po.paidAmount;
      if (amount > remaining) {
        throw new Error(`Số tiền thanh toán vượt quá số còn nợ (${remaining.toLocaleString('vi-VN')} đ)`);
      }

      return prisma.$transaction(async (tx) => {
        const payment = await tx.supplierPayment.create({
          data: { purchaseOrderId, supplierId: po.supplierId, amount, method, note },
        });

        const newPaid = po.paidAmount + amount;
        await tx.purchaseOrder.update({
          where: { id: purchaseOrderId },
          data: { paidAmount: newPaid, status: calcStatus(po.totalAmount, newPaid, po.status) },
        });

        await tx.supplier.update({
          where: { id: po.supplierId },
          data: { debt: { decrement: amount } },
        });

        await tx.cashflow.create({
          data: {
            type: 'expense',
            category: 'supplier_payment',
            amount,
            date: new Date(),
            description: `Trả tiền đơn nhập ${po.code} — ${po.supplier.name}`,
            refId: payment.id,
            refType: 'supplier_payment',
          },
        });

        return payment;
      });
    }

    // ── Mode 2: Trả tổng cho NCC (FIFO apply vào các PO) ────────────────────
    if (supplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) throw new Error('Không tìm thấy nhà cung cấp');
      if (amount > supplier.debt) {
        throw new Error(`Số tiền vượt quá công nợ (đang nợ ${supplier.debt.toLocaleString('vi-VN')} đ)`);
      }

      // Lấy các PO chưa trả xong, cũ nhất trước
      const unpaidPOs = await prisma.purchaseOrder.findMany({
        where: {
          supplierId,
          status: { in: ['unpaid', 'partial'] },
        },
        orderBy: { createdAt: 'asc' },
      });

      return prisma.$transaction(async (tx) => {
        const payment = await tx.supplierPayment.create({
          data: { supplierId, amount, method, note },
        });

        // FIFO: phân bổ amount vào các PO
        let remainingAmount = amount;
        for (const po of unpaidPOs) {
          if (remainingAmount <= 0) break;
          const poRemaining = po.totalAmount - po.paidAmount;
          if (poRemaining <= 0) continue;
          const apply = Math.min(remainingAmount, poRemaining);
          const newPaid = po.paidAmount + apply;
          await tx.purchaseOrder.update({
            where: { id: po.id },
            data: { paidAmount: newPaid, status: calcStatus(po.totalAmount, newPaid, po.status) },
          });
          remainingAmount -= apply;
        }

        // Giảm công nợ NCC (luôn giảm đúng `amount` — phần dư nếu có là trả trước)
        await tx.supplier.update({
          where: { id: supplierId },
          data: { debt: { decrement: amount } },
        });

        await tx.cashflow.create({
          data: {
            type: 'expense',
            category: 'supplier_payment',
            amount,
            date: new Date(),
            description: `Trả tiền nhà cung cấp: ${supplier.name}`,
            refId: payment.id,
            refType: 'supplier_payment',
          },
        });

        return payment;
      });
    }

    throw new Error('Thiếu mã đơn nhập hoặc mã nhà cung cấp');
  },
};
