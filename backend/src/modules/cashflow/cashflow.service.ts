import prisma from '../../utils/prisma';

export const cashflowService = {
  async getAll(from?: string, to?: string) {
    const where: any = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59');
    }
    return prisma.cashflow.findMany({ where, orderBy: { createdAt: 'desc' } });
  },

  async create(data: { type: string; category: string; amount: number; description?: string }) {
    return prisma.cashflow.create({ data });
  },

  async getSummary(from?: string, to?: string) {
    const entries = await cashflowService.getAll(from, to);
    const income = entries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const expense = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    return { income, expense, balance: income - expense };
  },

  async delete(id: number) {
    return prisma.cashflow.delete({ where: { id } });
  },
};
