import prisma from '../../utils/prisma';

export const dashboardService = {
  async getChartData(year: number) {
    const dateRange = {
      gte: new Date(`${year}-01-01`),
      lte: new Date(`${year}-12-31T23:59:59`),
    };

    // ── 1. Cashflow — filter theo date (ngày giao dịch thực tế) ──
    const allCashflow = await prisma.cashflow.findMany({
      where: { date: dateRange },
    });

    // ── 2. Invoices — filter theo invoiceDate (ưu tiên) hoặc createdAt ──
    const allInvoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { invoiceDate: dateRange },
          { invoiceDate: null, createdAt: dateRange },
        ],
        status: { not: 'cancelled' },
      },
      include: { items: { include: { product: true } } },
    });

    // ── 3. Monthly breakdown ──
    const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;

      // Invoice: dùng invoiceDate nếu có, fallback createdAt
      const inv = allInvoices.filter((v) => {
        const d = v.invoiceDate ?? v.createdAt;
        return new Date(d).getFullYear() === year && new Date(d).getMonth() + 1 === m;
      });

      // Cashflow: dùng date field
      const cf = allCashflow.filter((c) => new Date(c.date).getMonth() + 1 === m);

      const revenue = inv.reduce((s, v) => s + v.totalAmount, 0);
      const cogs    = inv.reduce((s, v) => s + v.items.reduce((si, it) => si + it.product.costPrice * it.quantity, 0), 0);
      const income  = cf.filter((c) => c.type === 'income').reduce((s, c) => s + c.amount, 0);
      const expense = cf.filter((c) => c.type === 'expense').reduce((s, c) => s + c.amount, 0);

      return { month: `T${m}`, revenue, profit: revenue - cogs, income, expense };
    });

    // ── 4. Cashflow by category (current year) ──
    const categoryMap: Record<string, { income: number; expense: number }> = {};
    for (const c of allCashflow) {
      if (!categoryMap[c.category]) categoryMap[c.category] = { income: 0, expense: 0 };
      if (c.type === 'income') categoryMap[c.category].income += c.amount;
      else                     categoryMap[c.category].expense += c.amount;
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

    // ── 5. Customer growth — dùng ngày lập hóa đơn đầu tiên làm "ngày tham gia"
    //       nếu KH chưa có HĐ nào thì fallback về createdAt ──
    const allCustomers = await prisma.customer.findMany({
      where: { status: 'active' },
      select: {
        createdAt: true,
        invoices: {
          where: { status: { not: 'cancelled' } },
          orderBy: [{ invoiceDate: 'asc' }, { createdAt: 'asc' }],
          take: 1,
          select: { invoiceDate: true, createdAt: true },
        },
      },
    });
    // "firstDate" = ngày lập HĐ đầu tiên (invoiceDate ưu tiên), nếu không có HĐ thì dùng createdAt
    const customerFirstDates = allCustomers.map((c) => {
      const inv = c.invoices[0];
      return inv ? new Date(inv.invoiceDate ?? inv.createdAt) : new Date(c.createdAt);
    });
    const prevYearCount = customerFirstDates.filter((d) => d.getFullYear() < year).length;
    let cumulative = prevYearCount;
    const customerGrowth = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const newThisMonth = customerFirstDates.filter((d) =>
        d.getFullYear() === year && d.getMonth() + 1 === m
      ).length;
      cumulative += newThisMonth;
      return { month: `T${m}`, total: cumulative, new: newThisMonth };
    });

    // ── 6. Top products by revenue (filtered by year) ──
    const invoiceItems = await prisma.invoiceItem.findMany({
      where: {
        invoice: {
          OR: [
            { invoiceDate: dateRange },
            { invoiceDate: null, createdAt: dateRange },
          ],
          status: { not: 'cancelled' },
        },
      },
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

    // ── 7. Top customers by revenue (filtered by year) ──
    const customerRevGroups = await prisma.invoice.groupBy({
      by: ['customerId'],
      where: {
        OR: [
          { invoiceDate: dateRange },
          { invoiceDate: null, createdAt: dateRange },
        ],
        status: { not: 'cancelled' },
      },
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
      id:             g.customerId,
      name:           customerMap[g.customerId]?.name || '(Ẩn)',
      companyName:    customerMap[g.customerId]?.companyName || '',
      totalPurchased: g._sum.totalAmount || 0,
      invoiceCount:   g._count.id,
    }));

    // ── 8. Summary KPIs ──
    const totalIncome   = allCashflow.filter((c) => c.type === 'income').reduce((s, c) => s + c.amount, 0);
    const totalExpense  = allCashflow.filter((c) => c.type === 'expense').reduce((s, c) => s + c.amount, 0);
    const totalRevenue  = allInvoices.reduce((s, v) => s + v.totalAmount, 0);
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
