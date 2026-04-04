import prisma from '../../utils/prisma';

const DEFAULTS = [
  // income
  { type: 'income',  name: 'Thu bán hàng',        slug: 'sales',            isBuiltin: true },
  { type: 'income',  name: 'Thu công nợ',          slug: 'debt_collection',  isBuiltin: true },
  { type: 'income',  name: 'Thu khác',             slug: 'income_other',     isBuiltin: true },
  // expense
  { type: 'expense', name: 'Nhập hàng',            slug: 'purchase',         isBuiltin: true },
  { type: 'expense', name: 'Chi vận hành',         slug: 'operations',       isBuiltin: true },
  { type: 'expense', name: 'Lương nhân viên',      slug: 'salary',           isBuiltin: true },
  { type: 'expense', name: 'Marketing / Quảng cáo', slug: 'marketing',      isBuiltin: true },
  { type: 'expense', name: 'Chi khác',             slug: 'expense_other',    isBuiltin: true },
];

export const cashflowCategoryService = {
  async seed() {
    for (const cat of DEFAULTS) {
      await prisma.cashflowCategory.upsert({
        where: { slug: cat.slug },
        update: {},
        create: cat,
      });
    }
  },

  async getAll() {
    return prisma.cashflowCategory.findMany({ orderBy: [{ type: 'asc' }, { id: 'asc' }] });
  },

  async create(data: { type: string; name: string }) {
    const slug = `custom_${Date.now()}`;
    return prisma.cashflowCategory.create({ data: { ...data, slug, isBuiltin: false } });
  },

  async update(id: number, data: { name?: string; isActive?: boolean }) {
    return prisma.cashflowCategory.update({ where: { id }, data });
  },

  async delete(id: number) {
    const cat = await prisma.cashflowCategory.findUnique({ where: { id } });
    if (cat?.isBuiltin) throw new Error('Không thể xóa danh mục mặc định');
    return prisma.cashflowCategory.delete({ where: { id } });
  },
};
