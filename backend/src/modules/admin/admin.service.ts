import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export type GroupName = 'customers' | 'suppliers' | 'products' | 'invoices' | 'purchases' | 'cashflow' | 'logs';

export const adminService = {
  async verifyAdminPassword(userId: number, password: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
    if (!user) return false;
    return bcrypt.compare(password, user.password);
  },

  async getStats() {
    const [
      customers, suppliers, products,
      invoices, invoiceItems,
      purchases, purchaseItems,
      payments, supplierPayments,
      cashflow, inventoryLogs, logs, deleteRequests,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.supplier.count(),
      prisma.product.count(),
      prisma.invoice.count(),
      prisma.invoiceItem.count(),
      prisma.purchaseOrder.count(),
      prisma.purchaseItem.count(),
      prisma.payment.count(),
      prisma.supplierPayment.count(),
      prisma.cashflow.count(),
      prisma.inventoryLog.count(),
      prisma.activityLog.count(),
      prisma.deleteRequest.count(),
    ]);
    return {
      customers, suppliers, products,
      invoices, invoiceItems,
      purchases, purchaseItems,
      payments, supplierPayments,
      cashflow, inventoryLogs, logs, deleteRequests,
    };
  },

  async purgeGroup(group: GroupName) {
    switch (group) {
      case 'customers':
        // Xóa: cashflow liên quan → payments → invoiceItems → invoices → customers
        // Reset: stock không thay đổi (dữ liệu bán đã tồn tại)
        await prisma.$transaction(async (tx) => {
          const invoiceIds = (await tx.invoice.findMany({ select: { id: true } })).map((i) => i.id);
          await tx.cashflow.deleteMany({ where: { refType: 'payment' } });
          await tx.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
          await tx.invoiceItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
          await tx.invoice.deleteMany();
          await tx.deleteRequest.deleteMany({ where: { modelName: 'Customer' } });
          await tx.customer.deleteMany();
        });
        break;

      case 'suppliers':
        // Xóa: supplierPayments → purchaseItems → purchaseOrders → suppliers
        await prisma.$transaction(async (tx) => {
          await tx.supplierPayment.deleteMany();
          await tx.purchaseItem.deleteMany();
          await tx.purchaseOrder.deleteMany();
          await tx.deleteRequest.deleteMany({ where: { modelName: 'Supplier' } });
          await tx.supplier.deleteMany();
        });
        break;

      case 'products':
        // Xóa: inventoryLogs → invoiceItems → purchaseItems → products
        // Lưu ý: invoices & purchases vẫn còn nhưng không có items
        await prisma.$transaction(async (tx) => {
          await tx.inventoryLog.deleteMany();
          await tx.invoiceItem.deleteMany();
          await tx.purchaseItem.deleteMany();
          await tx.deleteRequest.deleteMany({ where: { modelName: 'Product' } });
          await tx.product.deleteMany();
        });
        break;

      case 'invoices':
        // Xóa: cashflow payment_received → payments → invoiceItems → invoices
        // Reset: customer.debt = 0
        await prisma.$transaction(async (tx) => {
          await tx.cashflow.deleteMany({ where: { refType: 'payment' } });
          await tx.payment.deleteMany();
          await tx.invoiceItem.deleteMany();
          await tx.deleteRequest.deleteMany({ where: { modelName: 'Invoice' } });
          await tx.invoice.deleteMany();
          await tx.customer.updateMany({ data: { debt: 0 } });
          // Restore stock: reset to 0 + recalculate from purchase history
          const purchases = await tx.purchaseItem.findMany({ select: { productId: true, quantity: true } });
          const stockMap: Record<number, number> = {};
          for (const pi of purchases) {
            stockMap[pi.productId] = (stockMap[pi.productId] || 0) + pi.quantity;
          }
          for (const [productId, stock] of Object.entries(stockMap)) {
            await tx.product.update({ where: { id: Number(productId) }, data: { stock } });
          }
          // Products with no purchases → stock = 0
          const withPurchases = Object.keys(stockMap).map(Number);
          if (withPurchases.length > 0) {
            await tx.product.updateMany({ where: { id: { notIn: withPurchases } }, data: { stock: 0 } });
          } else {
            await tx.product.updateMany({ data: { stock: 0 } });
          }
        });
        break;

      case 'purchases':
        // Xóa: supplierPayments → purchaseItems → purchaseOrders
        // Reset: supplier.debt = 0, product.stock recalculate from invoices
        await prisma.$transaction(async (tx) => {
          await tx.supplierPayment.deleteMany();
          await tx.purchaseItem.deleteMany();
          await tx.purchaseOrder.deleteMany();
          await tx.supplier.updateMany({ data: { debt: 0 } });
          // Recalculate stock: sold quantity from invoiceItems
          const sold = await tx.invoiceItem.findMany({ select: { productId: true, quantity: true } });
          const soldMap: Record<number, number> = {};
          for (const item of sold) {
            soldMap[item.productId] = (soldMap[item.productId] || 0) + item.quantity;
          }
          // stock = 0 - sold (negative means oversold, that's their problem)
          const allProducts = await tx.product.findMany({ select: { id: true } });
          for (const p of allProducts) {
            await tx.product.update({ where: { id: p.id }, data: { stock: -(soldMap[p.id] || 0) } });
          }
        });
        break;

      case 'cashflow':
        await prisma.cashflow.deleteMany();
        break;

      case 'logs':
        await prisma.activityLog.deleteMany();
        break;

      default:
        throw new Error(`Unknown group: ${group}`);
    }
  },

  async purgeAll() {
    // Xóa toàn bộ dữ liệu nghiệp vụ, giữ lại: User, CashflowCategory
    await prisma.$transaction(async (tx) => {
      await tx.deleteRequest.deleteMany();
      await tx.activityLog.deleteMany();
      await tx.cashflow.deleteMany();
      await tx.supplierPayment.deleteMany();
      await tx.inventoryLog.deleteMany();
      await tx.invoiceItem.deleteMany();
      await tx.purchaseItem.deleteMany();
      await tx.payment.deleteMany();
      await tx.invoice.deleteMany();
      await tx.purchaseOrder.deleteMany();
      await tx.customer.deleteMany();
      await tx.supplier.deleteMany();
      await tx.product.deleteMany();
    });
  },
};
