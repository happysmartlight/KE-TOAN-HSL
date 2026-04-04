import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../utils/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'ke-toan-noi-bo-secret-2024';
const JWT_EXPIRES = '7d';

export const authService = {
  async login(username: string, password: string) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) throw new Error('Sai tên đăng nhập hoặc mật khẩu');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error('Sai tên đăng nhập hoặc mật khẩu');

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    return {
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    };
  },

  async register(data: { username: string; password: string; name: string; role?: string }) {
    const exists = await prisma.user.findUnique({ where: { username: data.username } });
    if (exists) throw new Error('Tên đăng nhập đã tồn tại');

    const hashed = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { ...data, password: hashed, role: data.role || 'staff' },
    });

    return { id: user.id, username: user.username, name: user.name, role: user.role };
  },

  async getMe(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, name: true, role: true, createdAt: true },
    });
    if (!user) throw new Error('Không tìm thấy người dùng');
    return user;
  },
};
