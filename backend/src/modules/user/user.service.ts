import bcrypt from 'bcryptjs';
import prisma from '../../utils/prisma';
import { authService } from '../auth/auth.service';

const BCRYPT_ROUNDS = 12;
const ALLOWED_ROLES = new Set(['admin', 'staff']);

const USER_SELECT = {
  id: true, username: true, name: true, role: true,
  email: true, phone: true,
  startDate: true, endDate: true, employmentStatus: true,
  createdAt: true,
};

export const userService = {
  async getAll() {
    return prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  },

  async getMe(userId: number) {
    return prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: USER_SELECT,
    });
  },

  async create(data: {
    username: string; password: string; name: string; role: string;
    email?: string; phone?: string; startDate?: string; employmentStatus?: string;
  }) {
    const exists = await prisma.user.findUnique({ where: { username: data.username } });
    if (exists) throw new Error('Tên đăng nhập đã tồn tại');
    const hashed = await authService.hashPassword(data.password);
    const role = ALLOWED_ROLES.has(data.role) ? data.role : 'staff';
    return prisma.user.create({
      data: {
        username: data.username,
        password: hashed,
        name: data.name,
        role,
        email: data.email || null,
        phone: data.phone || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        employmentStatus: data.employmentStatus || 'active',
      },
      select: USER_SELECT,
    });
  },

  async update(id: number, data: {
    name?: string; role?: string; password?: string;
    email?: string; phone?: string; startDate?: string; employmentStatus?: string;
  }) {
    const update: any = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.role !== undefined) {
      if (!ALLOWED_ROLES.has(data.role)) throw new Error('Role không hợp lệ');
      update.role = data.role;
    }
    if (data.password) update.password = await authService.hashPassword(data.password);
    if (data.email !== undefined) update.email = data.email || null;
    if (data.phone !== undefined) update.phone = data.phone || null;
    if (data.startDate !== undefined) update.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.employmentStatus !== undefined) update.employmentStatus = data.employmentStatus;
    return prisma.user.update({
      where: { id },
      data: update,
      select: USER_SELECT,
    });
  },

  async updateMyPassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new Error('Mật khẩu hiện tại không đúng');
    const hashed = await authService.hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
  },

  async getEmploymentHistory(userId: number) {
    return prisma.employmentCycle.findMany({
      where: { userId },
      orderBy: { cycleNo: 'asc' },
    });
  },

  /** Nhân viên nghỉ việc: đóng chu kỳ hiện tại, cập nhật trạng thái */
  async resign(userId: number, endDate: Date, note?: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.employmentStatus === 'resigned') throw new Error('Nhân viên đã ở trạng thái đã nghỉ');

    await prisma.$transaction(async (tx) => {
      // Đóng chu kỳ đang mở (nếu có)
      const openCycle = await tx.employmentCycle.findFirst({
        where: { userId, endDate: null },
        orderBy: { cycleNo: 'desc' },
      });
      if (openCycle) {
        await tx.employmentCycle.update({
          where: { id: openCycle.id },
          data: { endDate, note: note || null },
        });
      } else if (user.startDate) {
        // Tạo chu kỳ đã hoàn chỉnh nếu chưa có record
        const count = await tx.employmentCycle.count({ where: { userId } });
        await tx.employmentCycle.create({
          data: { userId, cycleNo: count + 1, startDate: user.startDate, endDate, note: note || null },
        });
      }
      // Cập nhật User
      await tx.user.update({
        where: { id: userId },
        data: { employmentStatus: 'resigned', endDate },
      });
    });
  },

  /** Khôi phục việc làm: bắt đầu chu kỳ mới */
  async reinstate(userId: number, startDate: Date, note?: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.employmentStatus === 'active') throw new Error('Nhân viên đang trong trạng thái làm việc');

    await prisma.$transaction(async (tx) => {
      const count = await tx.employmentCycle.count({ where: { userId } });
      await tx.employmentCycle.create({
        data: { userId, cycleNo: count + 1, startDate, endDate: null, note: note || null },
      });
      await tx.user.update({
        where: { id: userId },
        data: { employmentStatus: 'active', startDate, endDate: null },
      });
    });
  },

  async getKpi() {
    const groups = await prisma.invoice.groupBy({
      by: ['createdByUserId'],
      where: { createdByUserId: { not: null }, status: { not: 'cancelled' } },
      _sum:   { totalAmount: true },
      _count: { id: true },
    });
    return Object.fromEntries(
      groups.map((g) => [g.createdByUserId!, {
        totalRevenue: g._sum.totalAmount || 0,
        invoiceCount: g._count.id,
      }])
    );
  },

  async delete(id: number, requesterId: number) {
    if (id === requesterId) throw new Error('Không thể xóa tài khoản đang đăng nhập');
    const admins = await prisma.user.count({ where: { role: 'admin' } });
    const target = await prisma.user.findUnique({ where: { id } });
    if (target?.role === 'admin' && admins <= 1) throw new Error('Phải có ít nhất 1 admin');
    return prisma.$transaction(async (tx) => {
      await tx.employmentCycle.deleteMany({ where: { userId: id } });
      await tx.deleteRequest.deleteMany({ where: { requesterId: id } });
      await tx.profileUpdateRequest.deleteMany({ where: { userId: id } });
      return tx.user.delete({ where: { id } });
    });
  },
};
