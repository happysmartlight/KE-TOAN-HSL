import prisma from '../../utils/prisma';

export const reportService = {
  async getCashflowReport(from?: string, to?: string) {
    const where: any = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59');
    }
    const entries = await prisma.cashflow.findMany({ where });
    const income = entries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const expense = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    return { income, expense, balance: income - expense, entries };
  },

  async getProfitLoss(from?: string, to?: string) {
    const where: any = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59');
    }

    const invoices = await prisma.invoice.findMany({
      where: { ...where, status: { not: 'cancelled' } },
      include: { items: { include: { product: true } } },
    });

    let revenue = 0;
    let cogs = 0; // Cost of Goods Sold

    for (const invoice of invoices) {
      revenue += invoice.totalAmount;
      for (const item of invoice.items) {
        cogs += item.product.costPrice * item.quantity;
      }
    }

    const grossProfit = revenue - cogs;

    // Chi phí khác (salary, other expenses)
    const otherExpenses = await prisma.cashflow.aggregate({
      where: {
        ...where,
        type: 'expense',
        category: { in: ['salary', 'other'] },
      },
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
