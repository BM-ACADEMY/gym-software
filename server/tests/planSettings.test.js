// SET-01 route test (needs MongoDB, written not yet run by a person).
const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createRootAdmin } = require('./helpers/factories');
const SystemSettings = require('../models/SystemSettings');
const { PLANS } = require('../config/plans');
const planSettings = require('../services/planSettings');

describe('plan settings (Root Admin)', () => {
  let root;
  beforeAll(async () => { await db.connect(); root = await createRootAdmin(); planSettings.init({ SystemSettings, PLANS }); });
  afterAll(async () => { await planSettings.get().reset('growth', 'test', 'cleanup after test'); await db.clearDatabase(); await db.closeDatabase(); });
  const R = () => ({ Authorization: `Bearer ${root.token || root.rootToken || root.adminToken}` });

  test('gym owners and signed-out visitors cannot read or change plans', async () => {
    const t = await createTenant();
    expect([401, 403]).toContain((await request(app).get('/api/root-admin/plan-settings')).status);
    expect([401, 403]).toContain((await request(app).get('/api/root-admin/plan-settings').set({ Authorization: `Bearer ${t.adminToken}` })).status);
    expect([401, 403]).toContain((await request(app).put('/api/root-admin/plan-settings/growth').set({ Authorization: `Bearer ${t.adminToken}` }).send({ monthly: 1, reason: 'attack attempt' })).status);
  });
  test('change needs a reason; below the floor needs a confirm; the public price page and checkout price follow', async () => {
    expect((await request(app).put('/api/root-admin/plan-settings/growth').set(R()).send({ monthly: 1099, yearly: 10999 })).status).toBe(400);
    const low = await request(app).put('/api/root-admin/plan-settings/growth').set(R()).send({ monthly: 700, yearly: 7000, reason: 'test low price' });
    expect(low.status).toBe(409); expect(low.body.needsConfirm).toBe(true);
    const ok = await request(app).put('/api/root-admin/plan-settings/growth').set(R()).send({ monthly: 1099, yearly: 10999, reason: 'raise price for test' });
    expect(ok.status).toBe(200);
    const pub = await request(app).get('/api/public/plans');
    expect(pub.body.data.plans.find((p) => p.key === 'growth').monthly).toBe(1099);
    expect(JSON.stringify(pub.body)).not.toMatch(/floor|history|reason/);
    expect((await request(app).post('/api/root-admin/plan-settings/growth/reset').set(R()).send({ reason: 'back to default' })).status).toBe(200);
    expect((await request(app).get('/api/public/plans')).body.data.plans.find((p) => p.key === 'growth').monthly).toBe(999);
  });
  test('unknown plan and unknown fields are refused', async () => {
    expect((await request(app).put('/api/root-admin/plan-settings/gold').set(R()).send({ monthly: 5, reason: 'no such plan' })).status).toBe(400);
    expect((await request(app).put('/api/root-admin/plan-settings/growth').set(R()).send({ name: 'Gold', reason: 'rename attempt' })).status).toBe(400);
  });
});
