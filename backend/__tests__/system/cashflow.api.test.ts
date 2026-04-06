/**
 * System tests — Cashflow API
 * Tests full CRUD flow through the real Express app + test DB.
 */
import request from 'supertest';
import { app } from '../../src/app';

let adminToken: string;
let staffToken: string;

beforeAll(async () => {
  const [adminRes, staffRes] = await Promise.all([
    request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'admin123' }),
    request(app).post('/api/auth/login').send({ username: 'teststaff', password: 'staff123' }),
  ]);
  adminToken = adminRes.body.token;
  staffToken = staffRes.body.token;
});

describe('POST /api/cashflow — tạo giao dịch', () => {
  it('tạo giao dịch income thành công', async () => {
    const res = await request(app)
      .post('/api/cashflow')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type:        'income',
        category:    'Bán hàng',
        amount:      500_000,
        description: 'Test income',
        date:        '2025-06-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('income');
    expect(res.body.amount).toBe(500_000);
    expect(res.body).toHaveProperty('id');
  });

  it('tạo giao dịch expense thành công', async () => {
    const res = await request(app)
      .post('/api/cashflow')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        type:     'expense',
        category: 'Tiện ích',
        amount:   150_000,
        date:     '2025-06-02',
      });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('expense');
  });

  it('thiếu amount → 400', async () => {
    const res = await request(app)
      .post('/api/cashflow')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'income', category: 'Test' });

    expect(res.status).toBe(400);
  });

  it('không có token → 401', async () => {
    const res = await request(app)
      .post('/api/cashflow')
      .send({ type: 'income', category: 'Test', amount: 100 });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/cashflow — lấy danh sách', () => {
  it('trả về mảng giao dịch', async () => {
    const res = await request(app)
      .get('/api/cashflow')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('filter theo from/to date', async () => {
    const res = await request(app)
      .get('/api/cashflow?from=2025-06-01&to=2025-06-30')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Tất cả kết quả phải trong khoảng tháng 6/2025
    for (const entry of res.body) {
      const d = new Date(entry.date);
      expect(d.getFullYear()).toBe(2025);
      expect(d.getMonth()).toBe(5); // 0-indexed
    }
  });
});
