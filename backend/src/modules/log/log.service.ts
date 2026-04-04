import prisma from '../../utils/prisma';

export const logService = {
  async getAll(opts: {
    level?: string; username?: string;
    from?: string; to?: string; search?: string;
    limit?: number; offset?: number;
  } = {}) {
    const where: any = {};
    if (opts.level)    where.level    = opts.level;
    if (opts.username) where.username = { contains: opts.username };
    if (opts.search) {
      where.OR = [
        { message:  { contains: opts.search } },
        { action:   { contains: opts.search } },
        { username: { contains: opts.search } },
        { module:   { contains: opts.search } },
      ];
    }
    if (opts.from || opts.to) {
      where.createdAt = {};
      if (opts.from) where.createdAt.gte = new Date(opts.from);
      if (opts.to)   where.createdAt.lte = new Date(opts.to + 'T23:59:59');
    }

    const [rows, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take:  opts.limit  ?? 200,
        skip:  opts.offset ?? 0,
      }),
      prisma.activityLog.count({ where }),
    ]);
    return { rows, total };
  },

  async clear(olderThanDays = 30) {
    const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
    const { count } = await prisma.activityLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return { deleted: count };
  },
};
