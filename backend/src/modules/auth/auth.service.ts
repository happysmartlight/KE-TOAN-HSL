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

  /**
   * First-run setup status — public endpoint.
   * Frontend gọi lúc khởi động: nếu DB chưa có user nào → render trang FirstRunSetup
   * thay vì Login. Một khi có user, endpoint này trả false vĩnh viễn.
   */
  async getSetupStatus() {
    const count = await prisma.user.count();
    return { needsSetup: count === 0 };
  },

  /**
   * Tạo admin đầu tiên qua UI setup. Chỉ hoạt động khi DB hoàn toàn rỗng (không user nào).
   *
   * Bảo vệ:
   *  - Validate password policy như mọi nơi khác (≥12 ký tự, 3/4 nhóm)
   *  - Bcrypt hash NGOÀI transaction (250ms — không giữ lock DB)
   *  - Wrap trong $transaction + recheck count==0 → chống race condition giữa 2 request đồng thời
   *  - Trả token luôn để UX auto-login (giống Wordpress install)
   *  - Throw có cờ `alreadyInitialized` để controller biết phải trả 409 thay vì 400
   */
  async setupFirstAdmin(
    data: { username?: string; password?: string; name?: string },
    ip?: string,
  ) {
    const username = (data?.username || '').trim();
    const password = data?.password || '';
    const name = (data?.name || '').trim() || 'Quản trị viên';

    if (username.length < 3) {
      throw new Error('Tên đăng nhập phải có ít nhất 3 ký tự');
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      throw new Error('Tên đăng nhập chỉ chấp nhận chữ, số và các ký tự . _ -');
    }
    assertPasswordPolicy(password);

    // Hash trước khi vào transaction để không giữ DB lock 250ms
    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const created = await prisma.$transaction(async (tx) => {
      const count = await tx.user.count();
      if (count > 0) {
        const err: any = new Error('Hệ thống đã được khởi tạo, không thể chạy setup lại');
        err.alreadyInitialized = true;
        throw err;
      }
      return tx.user.create({
        data: { username, password: hashed, name, role: 'admin' },
      });
    });

    await writeLog({
      userId:   created.id,
      username: created.username,
      action:   'setup',
      module:   'auth',
      message:  `First-run setup: tạo admin "${created.username}" qua UI`,
      level:    'info',
      ip,
    });

    // Auto-login: trả token + user — frontend lưu token và vào dashboard luôn
    const token = signToken(
      { id: created.id, username: created.username, role: created.role },
      JWT_EXPIRES,
    );
    return {
      token,
      user: { id: created.id, username: created.username, name: created.name, role: created.role },
    };
  },
};
