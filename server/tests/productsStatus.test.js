// Database test: only a root admin can read the launch tracker.
const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createRootAdmin } = require('./helpers/factories');

describe('Super Admin product launch tracker', () => {
  let t; let root;
  beforeAll(async () => { await db.connect(); t = await createTenant({}); root = await createRootAdmin(); });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });

  test('no token or a gym admin token is refused', async () => {
    expect((await request(app).get('/api/root-admin/products')).status).toBe(401);
    expect((await request(app).get('/api/root-admin/products').set({ Authorization: `Bearer ${t.adminToken}` })).status).toBeGreaterThanOrEqual(401);
  });
  test('root admin sees all seven products', async () => {
    const r = await request(app).get('/api/root-admin/products').set({ Authorization: `Bearer ${root.token}` });
    expect(r.status).toBe(200); expect(r.body.data.products).toHaveLength(7);
    expect(r.body.data.products[0].checklistTotal).toBeGreaterThan(0);
  });
});
