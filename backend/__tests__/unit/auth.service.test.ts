/**
 * Unit tests — authService
 * Prisma và bcrypt đều được mock.
 */

jest.mock('../../src/utils/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('../../src/utils/logger', () => ({
  writeLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import prisma from '../../src/utils/prisma';
import bcrypt from 'bcryptjs';
import { authService } from '../../src/modules/auth/auth.service';

const mockFindUnique = prisma.user.findUnique as jest.Mock;
const mockCompare    = bcrypt.compare as jest.Mock;
const mockHash       = bcrypt.hash    as jest.Mock;

const fakeUser = {
  id: 1,
  username: 'admin',
  password: '$2a$10$hashed',
  name: 'Admin',
  role: 'admin',
};

describe('authService.login()', () => {
  it('throw khi username không tồn tại', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(authService.login('nobody', 'pass')).rejects.toThrow(
      'Sai tên đăng nhập hoặc mật khẩu'
    );
  });

  it('throw khi password sai', async () => {
    mockFindUnique.mockResolvedValue(fakeUser);
    mockCompare.mockResolvedValue(false);

    await expect(authService.login('admin', 'wrong')).rejects.toThrow(
      'Sai tên đăng nhập hoặc mật khẩu'
    );
  });

  it('trả về token và user info khi đăng nhập thành công', async () => {
    mockFindUnique.mockResolvedValue(fakeUser);
    mockCompare.mockResolvedValue(true);

    const result = await authService.login('admin', 'correct');

    expect(result).toHaveProperty('token');
    expect(typeof result.token).toBe('string');
    expect(result.user).toMatchObject({
      id: 1,
      username: 'admin',
      name: 'Admin',
      role: 'admin',
    });
    // Password hash không được trả về
    expect(result.user).not.toHaveProperty('password');
  });
});

describe('authService.hashPassword()', () => {
  it('throw khi password ngắn hơn 12 ký tự', async () => {
    await expect(authService.hashPassword('short')).rejects.toThrow(/12 ký tự/);
  });

  it('throw khi password thiếu nhóm ký tự (chỉ 2/4)', async () => {
    await expect(authService.hashPassword('abcdefghijkl')).rejects.toThrow(/3 trong 4 nhóm/);
  });

  it('hash thành công khi password đạt policy', async () => {
    mockHash.mockResolvedValue('$2a$12$newhash');
    const result = await authService.hashPassword('Abcdef123!@#');
    expect(result).toBe('$2a$12$newhash');
    expect(mockHash).toHaveBeenCalledWith('Abcdef123!@#', 12);
  });
});
