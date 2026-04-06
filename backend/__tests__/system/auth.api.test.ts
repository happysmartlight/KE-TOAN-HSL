/**
 * System tests — Auth API
 * Uses real test SQLite DB (created by globalSetup).
 * Test users: testadmin / admin123, teststaff / staff123
 */
import request from 'supertest';
import { app } from '../../src/app';

describe('POST /api/auth/login', () => {
  it('đăng nhập thành công → 200 + token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.username).toBe('testadmin');
    expect(res.body.user.role).toBe('admin');
    // Password không được leak ra ngoài
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('staff đăng nhập thành công', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'teststaff', password: 'staff123' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('staff');
  });

  it('sai mật khẩu → 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'wrongpass' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('username không tồn tại → 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ghost', password: 'pass' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('thiếu body → 400 hoặc 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect([400, 401]).toContain(res.status);
  });
});

describe('GET /api/auth/me', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'admin123' });
    token = res.body.token;
  });

  it('trả về thông tin user khi có token hợp lệ', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('testadmin');
  });

  it('không có token → 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('token giả → 401 hoặc 403', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect([401, 403]).toContain(res.status);
  });
});
