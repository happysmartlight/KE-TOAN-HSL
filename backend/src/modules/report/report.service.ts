import prisma from '../../utils/prisma';

export const reportService = {
  async getCashflowReport(from?: string, to?: string) {
    const where: any = {};
    if (from || to) {
      // Dùng `date` (ngày giao dịch thực tế) thay vì `createdAt`
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to + 'T23:59:59');
    }
    const entries = await prisma.cashflow.findMany({ where });
    const income = entries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const expense = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    return { income, expense, balance: income - expense, entries };
  },

  async getProfitLoss(from?: string, to?: string) {
    // Hóa đơn: ưu tiên invoiceDate (ngày lập thực tế), fallback về createdAt
    // Tránh tình trạng HĐ năm 2025 import vào 2026 bị tính vào 2026
    let invoiceWhere: any = { status: { not: 'cancelled' } };

    if (from || to) {
      const dateRange: any = {};
      if (from) dateRange.gte = new Date(from);
      if (to) dateRange.lte = new Date(to + 'T23:59:59');

      invoiceWhere.OR = [
        { invoiceDate: dateRange },        // HĐ có ngày lập (XML import) — null tự động bị loại
        { invoiceDate: null, createdAt: dateRange }, // HĐ tạo thủ công — dùng createdAt
      ];
    }

    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere,
      include: { items: { include: { product: true } } },
    });

    let revenue = 0;
    let cogs = 0;

    for (const invoice of invoices) {
      revenue += invoice.totalAmount;
      for (const item of invoice.items) {
        cogs += item.product.costPrice * item.quantity;
      }
    }

    const grossProfit = revenue - cogs;

    // Chi phí khác: dùng `date` field
    const cfWhere: any = { type: 'expense', category: { in: ['salary', 'other'] } };
    if (from || to) {
      cfWhere.date = {};
      if (from) cfWhere.date.gte = new Date(from);
      if (to) cfWhere.date.lte = new Date(to + 'T23:59:59');
    }
    const otherExpenses = await prisma.cashflow.aggregate({
      where: cfWhere,
      _sum: { amount: true },
    });

    const totalOtherExpenses = otherExpenses._sum.amount || 0;
    const netProfit = grossProfit - totalOtherExpenses;

    return { revenue, cogs, grossProfit, otherExpenses: totalOtherExpenses, netProfit };
  },

  async getDebtSummary() {
    const customerDebt = await prisma.customer.aggregate({ _sum: { debt: true } });
    const supplierDebt = await prisma.supplier.aggregate({ _sum: { debt: true } });
    const topDebtors = await prisma.customer.findMany({
      where: { debt: { gt: 0 } },
      orderBy: { debt: 'desc' },
      take: 10,
    });
    return {
      totalReceivable: customerDebt._sum.debt || 0,
      totalPayable: supplierDebt._sum.debt || 0,
      topDebtors,
    };
  },
};
