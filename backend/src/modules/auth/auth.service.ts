import bcrypt from 'bcryptjs';
import prisma from '../../utils/prisma';
import { writeLog } from '../../utils/logger';
import { signToken } from '../../utils/jwt';

// Hạ TTL token từ 7d → 8h cho app tài chính (giảm cửa sổ tấn công nếu token rò rỉ)
const JWT_EXPIRES = '8h';

// Bcrypt cost factor: 12 (≈250ms trên CPU hiện đại) — đủ chậm để chống brute force offline
const BCRYPT_ROUNDS = 12;

const PASSWORD_MIN_LENGTH = 12;

function assertPasswordPolicy(pwd: string) {
  if (typeof pwd !== 'string' || pwd.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`);
  }
  // Yêu cầu tối thiểu 3/4 nhóm ký tự (chữ thường, chữ hoa, số, ký tự đặc biệt)
  const groups = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pwd)).length;
  if (groups < 3) {
    throw new Error('Mật khẩu phải gồm ít nhất 3 trong 4 nhóm: chữ thường, chữ hoa, số, ký tự đặc biệt');
  }
}

export const authService = {
  async login(username: string, password: string, ip?: string) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      await writeLog({ action: 'login', module: 'auth', message: `Đăng nhập thất bại: username "${username}" không tồn tại`, level: 'warning', ip });
      throw new Error('Sai tên đăng nhập hoặc mật khẩu');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await writeLog({ userId: user.id, username: user.username, action: 'login', module: 'auth', message: `Đăng nhập thất bại: sai mật khẩu`, level: 'warning', ip });
      throw new Error('Sai tên đăng nhập hoặc mật khẩu');
    }

    const token = signToken(
      { id: user.id, username: user.username, role: user.role },
      JWT_EXPIRES,
    );

    await writeLog({ userId: user.id, username: user.username, action: 'login', module: 'auth', message: `Đăng nhập thành công`, level: 'info', ip });

    return {
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    };
  },

  /**
   * Hash password theo chính sách hiện hành. Dùng chung cho user.service / seed.
   */
  async hashPassword(plain: string): Promise<string> {
    assertPasswordPolicy(plain);
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  },

  assertPasswordPolicy,

  async getMe(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, name: true, role: true, createdAt: true },
    });
    if (!user) throw new Error('Không tìm thấy người dùng');
    return user;
  },
};
