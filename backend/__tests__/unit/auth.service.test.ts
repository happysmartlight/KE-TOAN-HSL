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

describe('authService.register()', () => {
  it('throw khi username đã tồn tại', async () => {
    mockFindUnique.mockResolvedValue(fakeUser);

    await expect(
      authService.register({ username: 'admin', password: 'pass', name: 'Duplicate' })
    ).rejects.toThrow('Tên đăng nhập đã tồn tại');
  });

  it('tạo user mới với role mặc định là staff', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockHash.mockResolvedValue('$2a$10$newhash');
    const newUser = { id: 2, username: 'newuser', name: 'New', role: 'staff' };
    (prisma.user.create as jest.Mock).mockResolvedValue(newUser);

    const result = await authService.register({
      username: 'newuser',
      password: 'pass123',
      name: 'New',
    });

    expect(result.role).toBe('staff');
    expect(result).not.toHaveProperty('password');
  });
});
