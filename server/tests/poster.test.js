const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createMember } = require('./helpers/factories');

describe('entrance poster', () => {
  beforeAll(async () => { await db.connect(); process.env.CLIENT_URL = 'https://app.example.com/'; });
  afterAll(async () => { delete process.env.CLIENT_URL; await db.clearDatabase(); await db.closeDatabase(); });

  test('owner gets own gym name, the sign-in URL and a PNG QR', async () => {
    const a = await createTenant({ gymName: 'Alpha Gym' });
    const b = await createTenant({ gymName: 'Beta Gym' });
    const r = await request(app).get('/api/admin/poster').set({ Authorization: `Bearer ${a.adminToken}` });
    expect(r.status).toBe(200);
    expect(r.body.data.gymName).toBe('Alpha Gym');
    expect(r.body.data.url).toBe('https://app.example.com/login');
    expect(r.body.data.qr.startsWith('data:image/png;base64,')).toBe(true);
    const r2 = await request(app).get('/api/admin/poster').set({ Authorization: `Bearer ${b.adminToken}` });
    expect(r2.body.data.gymName).toBe('Beta Gym');
  });

  test('members and anonymous callers are refused; missing CLIENT_URL gives a clear error', async () => {
    const a = await createTenant();
    const m = await createMember(a.subscriber);
    expect((await request(app).get('/api/admin/poster').set({ Authorization: `Bearer ${m.token}` })).status).toBe(403);
    expect((await request(app).get('/api/admin/poster')).status).toBe(401);
    const saved = process.env.CLIENT_URL; const cors = process.env.CORS_ORIGINS;
    delete process.env.CLIENT_URL; delete process.env.CORS_ORIGINS;
    expect((await request(app).get('/api/admin/poster').set({ Authorization: `Bearer ${a.adminToken}` })).status).toBe(503);
    process.env.CLIENT_URL = saved; if (cors) process.env.CORS_ORIGINS = cors;
  });
});
