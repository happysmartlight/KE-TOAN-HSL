import prisma from '../../utils/prisma';

export const deleteRequestService = {
  async getAll() {
    return prisma.deleteRequest.findMany({
      include: { requester: { select: { id: true, name: true, username: true } },
                 reviewer:  { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getPending() {
    return prisma.deleteRequest.findMany({
      where: { status: 'pending' },
      include: { requester: { select: { id: true, name: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(requesterId: number, data: { modelName: string; recordId: number; recordLabel: string; reason: string }) {
    // Chỉ được tạo 1 pending request per record
    const existing = await prisma.deleteRequest.findFirst({
      where: { modelName: data.modelName, recordId: data.recordId, status: 'pending' },
    });
    if (existing) throw new Error('Đã có yêu cầu xóa đang chờ duyệt cho bản ghi này');
    return prisma.deleteRequest.create({ data: { requesterId, ...data } });
  },

  async review(id: number, reviewerId: number, action: 'approved' | 'rejected') {
    const req = await prisma.deleteRequest.findUnique({ where: { id } });
    if (!req) throw new Error('Không tìm thấy yêu cầu');
    if (req.status !== 'pending') throw new Error('Yêu cầu đã được xử lý');

    await prisma.deleteRequest.update({
      where: { id },
      data: { status: action, reviewerId, reviewedAt: new Date() },
    });

    if (action === 'approved') {
      await softDeleteRecord(req.modelName, req.recordId);
    }

    return { ok: true };
  },

  async countPending() {
    return prisma.deleteRequest.count({ where: { status: 'pending' } });
  },
};

async function softDeleteRecord(modelName: string, recordId: number) {
  const now = new Date();
  switch (modelName) {
    case 'Customer':
      await prisma.customer.update({ where: { id: recordId }, data: { status: 'deleted', deletedAt: now } });
      break;
    case 'Supplier':
      await prisma.supplier.update({ where: { id: recordId }, data: { status: 'deleted', deletedAt: now } });
      break;
    case 'Product':
      await prisma.product.update({ where: { id: recordId }, data: { status: 'deleted', deletedAt: now } });
      break;
    default:
      throw new Error(`Model ${modelName} chưa hỗ trợ soft delete`);
  }
}
