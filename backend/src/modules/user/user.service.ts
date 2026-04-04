import bcrypt from 'bcryptjs';
import prisma from '../../utils/prisma';

export const userService = {
  async getAll() {
    return prisma.user.findMany({
      select: { id: true, username: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  },

  async create(data: { username: string; password: string; name: string; role: string }) {
    const exists = await prisma.user.findUnique({ where: { username: data.username } });
    if (exists) throw new Error('Tên đăng nhập đã tồn tại');
    const hashed = await bcrypt.hash(data.password, 10);
    return prisma.user.create({
      data: { ...data, password: hashed },
      select: { id: true, username: true, name: true, role: true, createdAt: true },
    });
  },

  async update(id: number, data: { name?: string; role?: string; password?: string }) {
    const update: any = {};
    if (data.name) update.name = data.name;
    if (data.role) update.role = data.role;
    if (data.password) update.password = await bcrypt.hash(data.password, 10);
    return prisma.user.update({
      where: { id },
      data: update,
      select: { id: true, username: true, name: true, role: true, createdAt: true },
    });
  },

  async delete(id: number, requesterId: number) {
    if (id === requesterId) throw new Error('Không thể xóa tài khoản đang đăng nhập');
    const admins = await prisma.user.count({ where: { role: 'admin' } });
    const target = await prisma.user.findUnique({ where: { id } });
    if (target?.role === 'admin' && admins <= 1) throw new Error('Phải có ít nhất 1 admin');
    return prisma.user.delete({ where: { id } });
  },
};
