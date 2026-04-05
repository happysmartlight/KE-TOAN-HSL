import prisma from '../../utils/prisma';

export const purService = {
  async create(userId: number, requestedData: object, reason?: string) {
    return prisma.profileUpdateRequest.create({
      data: { userId, requestedData: JSON.stringify(requestedData), reason },
    });
  },

  async getMine(userId: number) {
    return prisma.profileUpdateRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getAll() {
    return prisma.profileUpdateRequest.findMany({
      include: { user: { select: { id: true, name: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getPendingCount() {
    return prisma.profileUpdateRequest.count({ where: { status: 'pending' } });
  },

  async approve(id: number, reviewerId: number) {
    const req = await prisma.profileUpdateRequest.findUniqueOrThrow({ where: { id } });
    if (req.status !== 'pending') throw new Error('Yêu cầu đã được xử lý');
    const data = JSON.parse(req.requestedData);
    // Only allow safe fields: name, email, phone
    const allowedUpdate: any = {};
    if (data.name !== undefined) allowedUpdate.name = data.name;
    if (data.email !== undefined) allowedUpdate.email = data.email || null;
    if (data.phone !== undefined) allowedUpdate.phone = data.phone || null;
    await prisma.$transaction([
      prisma.user.update({ where: { id: req.userId }, data: allowedUpdate }),
      prisma.profileUpdateRequest.update({
        where: { id },
        data: { status: 'approved', reviewerId, reviewedAt: new Date() },
      }),
    ]);
  },

  async reject(id: number, reviewerId: number, adminNote: string) {
    const req = await prisma.profileUpdateRequest.findUniqueOrThrow({ where: { id } });
    if (req.status !== 'pending') throw new Error('Yêu cầu đã được xử lý');
    return prisma.profileUpdateRequest.update({
      where: { id },
      data: { status: 'rejected', reviewerId, adminNote, reviewedAt: new Date() },
    });
  },
};
