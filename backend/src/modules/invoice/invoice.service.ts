import prisma from '../../utils/prisma';

type InvoiceItem = {
  productId: number;
  quantity: number;
  price: number;
};

export const invoiceService = {
  async getAll() {
    return prisma.invoice.findMany({
      include: { customer: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(id: number) {
    return prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: true,
      },
    });
  },

  async create(data: { customerId: number; items: InvoiceItem[]; note?: string }) {
    const { customerId, items, note } = data;

    // Kiểm tra tồn kho trước
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new Error(`Sản phẩm ID ${item.productId} không tồn tại`);
      if (product.stock < item.quantity) {
        throw new Error(`Sản phẩm "${product.name}" không đủ tồn kho (còn ${product.stock})`);
      }
    }

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Tạo mã hóa đơn tự động
    const count = await prisma.invoice.count();
    const code = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    // Transaction: tạo hóa đơn + giảm tồn kho + tăng công nợ + ghi cashflow
    const invoice = await prisma.$transaction(async (tx) => {
      const newInvoice = await tx.invoice.create({
        data: {
          code,
          customerId,
          totalAmount,
          note,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              subtotal: item.price * item.quantity,
            })),
          },
        },
        include: { items: true },
      });

      // Giảm tồn kho + ghi inventory log
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });

        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            type: 'out',
            quantity: item.quantity,
            reason: 'sale',
            refId: newInvoice.id,
          },
        });
      }

      // Tăng công nợ khách hàng
      await tx.customer.update({
        where: { id: customerId },
        data: { debt: { increment: totalAmount } },
      });

      // Ghi cashflow (doanh thu phát sinh, chưa thu tiền)
      await tx.cashflow.create({
        data: {
          type: 'income',
          category: 'sales',
          amount: totalAmount,
          description: `Doanh thu hóa đơn ${code}`,
          refId: newInvoice.id,
          refType: 'invoice',
        },
      });

      return newInvoice;
    });

    return invoice;
  },

  async cancel(id: number) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!invoice) throw new Error('Không tìm thấy hóa đơn');
    if (invoice.status === 'cancelled') throw new Error('Hóa đơn đã bị hủy rồi');

    await prisma.$transaction(async (tx) => {
      // Đổi trạng thái sang cancelled
      await tx.invoice.update({ where: { id }, data: { status: 'cancelled' } });

      // Hoàn tồn kho cho từng sản phẩm
      for (const item of invoice.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            type: 'in',
            quantity: item.quantity,
            reason: 'cancel',
            refId: id,
          },
        });
      }

      // Hoàn công nợ khách hàng (chỉ phần chưa thanh toán)
      const remaining = invoice.totalAmount - invoice.paidAmount;
      if (remaining > 0) {
        await tx.customer.update({
          where: { id: invoice.customerId },
          data: { debt: { decrement: remaining } },
        });
      }

      // Xóa bút toán cashflow gốc của hóa đơn này
      await tx.cashflow.deleteMany({
        where: { refId: id, refType: 'invoice' },
      });
    });
  },

  async delete(id: number) {
    await prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { invoiceId: id } });
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.inventoryLog.deleteMany({ where: { refId: id, reason: 'cancel' } });
      await tx.invoice.delete({ where: { id } });
    });
  },
};
