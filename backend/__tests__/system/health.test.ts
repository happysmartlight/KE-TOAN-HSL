/**
 * System tests — Health endpoint
 * Verifies the server responds correctly to basic requests.
 */
import request from 'supertest';
import { app } from '../../src/app';

describe('GET /api/health', () => {
  it('trả về 200 với status ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('timestamp');
  });
});

describe('Protected route without token', () => {
  it('GET /api/cashflow không có token → 401', async () => {
    const res = await request(app).get('/api/cashflow');

    expect(res.status).toBe(401);
  });

  it('GET /api/customers không có token → 401', async () => {
    const res = await request(app).get('/api/customers');

    expect(res.status).toBe(401);
  });
});
