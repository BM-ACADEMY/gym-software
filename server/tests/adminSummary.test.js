// Database test: the summary route needs the internal key and returns counts only.
const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant } = require('./helpers/factories');

describe('GET /api/internal/admin-summary', () => {
  beforeAll(async () => { await db.connect(); process.env.INTERNAL_API_KEY = 'k'.repeat(32); await createTenant({}); });
  afterAll(async () => { delete process.env.INTERNAL_API_KEY; await db.clearDatabase(); await db.closeDatabase(); });
  test('refused without the key or with a wrong key', async () => {
    expect((await request(app).get('/api/internal/admin-summary')).status).toBe(401);
    expect((await request(app).get('/api/internal/admin-summary').set('x-internal-key', 'x'.repeat(32))).status).toBe(401);
  });
  test('returns the shared shape with the right key', async () => {
    const r = await request(app).get('/api/internal/admin-summary').set('x-internal-key', 'k'.repeat(32));
    expect(r.status).toBe(200); expect(r.body.data.schema).toBe(1); expect(r.body.data.product).toBe('gym');
    expect(r.body.data.businesses.total).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(r.body)).not.toMatch(/phone|email|password/i);
  });
});
