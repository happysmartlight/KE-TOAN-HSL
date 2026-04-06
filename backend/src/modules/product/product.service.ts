import prisma from '../../utils/prisma';

export const productService = {
  async getAll() {
    const products = await prisma.product.findMany({
      where: { status: 'active' },
      orderBy: { name: 'asc' },
    });

    // Tổng hợp doanh số từ các hóa đơn chưa hủy
    const items = await prisma.invoiceItem.findMany({
      where: { invoice: { status: { not: 'cancelled' } } },
      select: { productId: true, quantity: true, price: true },
    });
    const salesMap = new Map<number, { totalSold: number; totalRevenue: number }>();
    for (const it of items) {
      const cur = salesMap.get(it.productId) ?? { totalSold: 0, totalRevenue: 0 };
      salesMap.set(it.productId, {
        totalSold:    cur.totalSold + it.quantity,
        totalRevenue: cur.totalRevenue + it.quantity * it.price,
      });
    }

    return products.map((p) => ({
      ...p,
      totalSold:    salesMap.get(p.id)?.totalSold    ?? 0,
      totalRevenue: salesMap.get(p.id)?.totalRevenue ?? 0,
    }));
  },

  async getById(id: number) {
    return prisma.product.findUnique({ where: { id } });
  },

  async create(data: {
    name: string;
    sku?: string;
    unit?: string;
    costPrice?: number;
    sellingPrice?: number;
    stock?: number;
    taxRate?: string;
  }) {
    return prisma.product.create({ data });
  },

  async update(id: number, data: Partial<{
    name: string;
    sku: string;
    unit: string;
    costPrice: number;
    sellingPrice: number;
    stock: number;
    taxRate: string;
  }>) {
    return prisma.product.update({ where: { id }, data });
  },

  async delete(id: number) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new Error('Sản phẩm không tồn tại');
    // Soft delete – giữ dữ liệu lịch sử hóa đơn / kho, chỉ ẩn khỏi danh sách
    return prisma.product.update({
      where: { id },
      data: { status: 'deleted', deletedAt: new Date() },
    });
  },

  async getDashboard(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [products, inventoryLogs, invoiceItems] = await Promise.all([
      prisma.product.findMany({
        where: { status: 'active' },
        select: { id: true, name: true, unit: true, stock: true, costPrice: true, sellingPrice: true },
      }),
      prisma.inventoryLog.findMany({
        where: { createdAt: { gte: since } },
        select: { type: true, quantity: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.invoiceItem.findMany({
        where: { invoice: { status: { not: 'cancelled' } } },
        select: {
          productId: true, quantity: true, price: true,
          invoice: { select: { invoiceDate: true, createdAt: true } },
        },
      }),
    ]);

    // ── Summary ──────────────────────────────────────────────────────────────
    const totalProducts    = products.length;
    const totalStock       = products.reduce((s, p) => s + p.stock, 0);
    const totalStockValue  = products.reduce((s, p) => s + p.stock * p.costPrice, 0);
    const lowStockCount    = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
    const outOfStockCount  = products.filter((p) => p.stock <= 0).length;

    // ── Inventory chart (group by day, last N days) ──────────────────────────
    const chartMap = new Map<string, { in: number; out: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      chartMap.set(d.toISOString().slice(0, 10), { in: 0, out: 0 });
    }
    for (const log of inventoryLogs) {
      const key = log.createdAt.toISOString().slice(0, 10);
      const cur = chartMap.get(key);
      if (cur) {
        if (log.type === 'in') cur.in += log.quantity;
        else cur.out += log.quantity;
      }
    }
    const inventoryChart = Array.from(chartMap.entries()).map(([date, v]) => ({ date, ...v }));

    // ── Sales aggregation per product ────────────────────────────────────────
    type SalesEntry = { totalSold: number; totalRevenue: number; lastSoldAt: Date | null };
    const salesMap = new Map<number, SalesEntry>();
    for (const it of invoiceItems) {
      const cur = salesMap.get(it.productId) ?? { totalSold: 0, totalRevenue: 0, lastSoldAt: null };
      const saleDate = it.invoice.invoiceDate ?? it.invoice.createdAt;
      salesMap.set(it.productId, {
        totalSold:    cur.totalSold + it.quantity,
        totalRevenue: cur.totalRevenue + it.quantity * it.price,
        lastSoldAt:   !cur.lastSoldAt || saleDate > cur.lastSoldAt ? saleDate : cur.lastSoldAt,
      });
    }

    // ── Top 10 sản phẩm bán chạy (theo doanh thu) ──────────────────────────
    const topProducts = products
      .map((p) => ({ ...p, ...(salesMap.get(p.id) ?? { totalSold: 0, totalRevenue: 0, lastSoldAt: null }) }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    // ── Sản phẩm tồn kho thấp ────────────────────────────────────────────────
    const lowStockProducts = products
      .filter((p) => p.stock <= 5)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);

    // ── Sản phẩm không bán trong N ngày ─────────────────────────────────────
    const now = Date.now();
    const inactiveProducts = products
      .map((p) => {
        const sale = salesMap.get(p.id);
        const lastSoldAt = sale?.lastSoldAt ?? null;
        const daysSince = lastSoldAt ? Math.floor((now - lastSoldAt.getTime()) / 86_400_000) : null;
        return { id: p.id, name: p.name, unit: p.unit, stock: p.stock, lastSoldAt, daysSince };
      })
      .filter((p) => !p.lastSoldAt || (p.daysSince !== null && p.daysSince >= days))
      .sort((a, b) => (b.daysSince ?? 99999) - (a.daysSince ?? 99999))
      .slice(0, 10);

    return {
      summary: { totalProducts, totalStock, totalStockValue, lowStockCount, outOfStockCount },
      inventoryChart,
      topProducts,
      lowStockProducts,
      inactiveProducts,
      days,
    };
  },
};

