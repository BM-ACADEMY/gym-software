const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createMember } = require('./helpers/factories');
const GymPlan = require('../models/GymPlan');
const Member = require('../models/Member');

const auth = (t) => ({ Authorization: `Bearer ${t.adminToken}` });

describe('member import', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });

  test('preview checks without saving, commit saves, repeat skips existing', async () => {
    const t = await createTenant();
    await GymPlan.create({ subscriberId: t.subscriber._id, name: 'Monthly', durationDays: 30, price: 1000 });
    const rows = [
      { Name: 'Ravi', Mobile: '9876543210', Plan: 'Monthly', 'Start Date': '01/12/2026' },
      { Name: 'Sita', Mobile: '9123456780', Plan: 'Gold', 'Expiry Date': '15/01/2027' },
      { Name: '', Mobile: '9000000000' },
    ];
    const prev = await request(app).post('/api/admin/members/import').set(auth(t)).send({ rows, commit: false });
    expect(prev.status).toBe(200);
    expect(prev.body.data.willCreate).toBe(2);
    expect(prev.body.data.errorCount).toBe(1);
    expect(prev.body.data.unknownPlans).toEqual(['Gold']);
    expect(await Member.countDocuments({ subscriberId: t.subscriber._id })).toBe(0);

    const done = await request(app).post('/api/admin/members/import').set(auth(t)).send({ rows, commit: true });
    expect(done.status).toBe(201);
    expect(done.body.data.created).toBe(2);
    const ravi = await Member.findOne({ subscriberId: t.subscriber._id, phone: '9876543210' });
    expect(ravi.expiresAt.toISOString().slice(0, 10)).toBe('2026-12-31');

    const again = await request(app).post('/api/admin/members/import').set(auth(t)).send({ rows, commit: true });
    expect(again.body.data.created).toBe(0);
    expect(again.body.data.skippedExisting).toBe(2);
  });

  test('stops at the plan member limit and never touches another gym', async () => {
    const t = await createTenant({ subscriber: { planKey: 'starter', paidUntil: new Date(Date.now() + 20 * 86400000), state: 'Puducherry' } });
    for (let i = 0; i < 149; i++) await createMember(t.subscriber);
    const other = await createTenant();
    const rows = [{ Name: 'A', Mobile: '9111111111' }, { Name: 'B', Mobile: '9222222222' }];
    const r = await request(app).post('/api/admin/members/import').set(auth(t)).send({ rows, commit: true });
    expect(r.body.data.created).toBe(1);
    expect(r.body.data.errors[0].message).toMatch(/limit/);
    expect(await Member.countDocuments({ subscriberId: other.subscriber._id })).toBe(0);
  });

  test('bad input is refused', async () => {
    const t = await createTenant();
    expect((await request(app).post('/api/admin/members/import').set(auth(t)).send({ rows: 'x' })).status).toBe(400);
    expect((await request(app).post('/api/admin/members/import').set(auth(t)).send({ rows: [{ Foo: 'x' }] })).status).toBe(400);
    expect((await request(app).post('/api/admin/members/import').set(auth(t)).send({ rows: [['a']] })).status).toBe(400);
  });
});
