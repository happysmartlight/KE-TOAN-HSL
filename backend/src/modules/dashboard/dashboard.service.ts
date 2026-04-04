import prisma from '../../utils/prisma';

export const dashboardService = {
  async getChartData() {
    const now = new Date();
    const year = now.getFullYear();

    // ── 1. Monthly revenue + cashflow for current year ──
    const allCashflow = await prisma.cashflow.findMany({
      where: { createdAt: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59`) } },
    });

    const allInvoices = await prisma.invoice.findMany({
      where: {
        createdAt: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59`) },
        status: { not: 'cancelled' },
      },
      include: { items: { include: { product: true } } },
    });

    const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const inv = allInvoices.filter((v) => new Date(v.createdAt).getMonth() + 1 === m);
      const cf  = allCashflow.filter((c) => new Date(c.createdAt).getMonth() + 1 === m);
      const revenue = inv.reduce((s, v) => s + v.totalAmount, 0);
      const cogs    = inv.reduce((s, v) => s + v.items.reduce((si, it) => si + it.product.costPrice * it.quantity, 0), 0);
      const income  = cf.filter((c) => c.type === 'income').reduce((s, c) => s + c.amount, 0);
      const expense = cf.filter((c) => c.type === 'expense').reduce((s, c) => s + c.amount, 0);
      return { month: `T${m}`, revenue, profit: revenue - cogs, income, expense };
    });

    // ── 2. Cashflow breakdown by category (current year) ──
    const categoryMap: Record<string, { income: number; expense: number }> = {};
    for (const c of allCashflow) {
      if (!categoryMap[c.category]) categoryMap[c.category] = { income: 0, expense: 0 };
      if (c.type === 'income') categoryMap[c.category].income += c.amount;
      else categoryMap[c.category].expense += c.amount;
    }
    const categoryLabels: Record<string, string> = {
      sales: 'Doanh thu', payment_received: 'Thu tiền HĐ',
      purchase: 'Nhập hàng', salary: 'Lương', other: 'Khác',
    };
    const cashflowByCategory = Object.entries(categoryMap).map(([key, val]) => ({
      name: categoryLabels[key] || key,
      income: val.income,
      expense: val.expense,
      total: val.income + val.expense,
    }));

    // ── 3. Customer growth (cumulative by month, current year) ──
    const allCustomers = await prisma.customer.findMany({
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const prevYearCount = allCustomers.filter((c) => new Date(c.createdAt).getFullYear() < year).length;
    let cumulative = prevYearCount;
    const customerGrowth = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const newThisMonth = allCustomers.filter((c) => {
        const d = new Date(c.createdAt);
        return d.getFullYear() === year && d.getMonth() + 1 === m;
      }).length;
      cumulative += newThisMonth;
      return { month: `T${m}`, total: cumulative, new: newThisMonth };
    });

    // ── 4. Top 5 products by revenue ──
    const invoiceItems = await prisma.invoiceItem.findMany({
      where: { invoice: { status: { not: 'cancelled' } } },
      include: { product: true },
    });
    const productRevMap: Record<number, { name: string; revenue: number; qty: number }> = {};
    for (const it of invoiceItems) {
      if (!productRevMap[it.productId]) productRevMap[it.productId] = { name: it.product.name, revenue: 0, qty: 0 };
      productRevMap[it.productId].revenue += it.subtotal;
      productRevMap[it.productId].qty     += it.quantity;
    }
    const topProducts = Object.values(productRevMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((p) => ({ name: p.name, revenue: p.revenue, qty: p.qty }));

    // ── 5. Top customers by revenue (all time) ──
    const customerRevGroups = await prisma.invoice.groupBy({
      by: ['customerId'],
      where: { status: { not: 'cancelled' } },
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 10,
    });
    const customerIds = customerRevGroups.map((g) => g.customerId);
    const customerInfos = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, companyName: true },
    });
    const customerMap = Object.fromEntries(customerInfos.map((c) => [c.id, c]));
    const topCustomers = customerRevGroups.map((g) => ({
      name:         customerMap[g.customerId]?.name || '(Ẩn)',
      companyName:  customerMap[g.customerId]?.companyName || '',
      totalPurchased: g._sum.totalAmount || 0,
      invoiceCount: g._count.id,
    }));

    // ── 6. Summary KPIs ──
    const totalIncome  = allCashflow.filter((c) => c.type === 'income').reduce((s, c) => s + c.amount, 0);
    const totalExpense = allCashflow.filter((c) => c.type === 'expense').reduce((s, c) => s + c.amount, 0);
    const totalRevenue = allInvoices.reduce((s, v) => s + v.totalAmount, 0);
    const totalCustomers = await prisma.customer.count({ where: { status: 'active' } });
    const totalProducts  = await prisma.product.count({ where: { status: 'active' } });
    const pendingInvoices = await prisma.invoice.count({ where: { status: { in: ['unpaid', 'partial'] } } });
    const customerDebt = await prisma.customer.aggregate({ _sum: { debt: true } });
    const supplierDebt = await prisma.supplier.aggregate({ _sum: { debt: true } });
    const pendingDeleteRequests = await prisma.deleteRequest.count({ where: { status: 'pending' } });

    return {
      year,
      kpis: {
        totalRevenue,
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        totalCustomers,
        totalProducts,
        pendingInvoices,
        receivable: customerDebt._sum.debt || 0,
        payable:    supplierDebt._sum.debt || 0,
        pendingDeleteRequests,
      },
      monthlyRevenue,
      cashflowByCategory,
      customerGrowth,
      topProducts,
      topCustomers,
    };
  },
};
