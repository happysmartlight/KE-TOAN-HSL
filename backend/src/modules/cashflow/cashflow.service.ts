import prisma from '../../utils/prisma';

export const cashflowService = {
  async getAll(from?: string, to?: string) {
    const where: any = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to + 'T23:59:59');
    }
    return prisma.cashflow.findMany({ where, orderBy: { date: 'desc' } });
  },

  async create(data: { type: string; category: string; amount: number; description?: string; date?: string }) {
    return prisma.cashflow.create({
      data: {
        ...data,
        date: data.date ? new Date(data.date) : new Date(),
      },
    });
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
