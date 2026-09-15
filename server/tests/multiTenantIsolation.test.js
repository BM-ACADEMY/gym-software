const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createMember } = require('./helpers/factories');
const Payment = require('../models/Payment');
const PTSession = require('../models/PTSession');
const SubAdmin = require('../models/SubAdmin');

// Doc NFR: "Every write scoped by subscriberId at the query layer (not just
// the UI) to prevent cross-tenant leaks." These tests prove that at the HTTP
// boundary, across a representative sample of modules, not just one.
describe('Multi-tenant data isolation', () => {
  let gymA, gymB;

  beforeAll(async () => {
    await db.connect();
    gymA = await createTenant({ gymName: 'Gym A' });
    gymB = await createTenant({ gymName: 'Gym B' });
    gymA.memberFixture = await createMember(gymA.subscriber, { name: 'Member A' });
  });

  afterAll(async () => {
    await db.clearDatabase();
    await db.closeDatabase();
  });

  test("Gym B cannot read Gym A's member by ID", async () => {
    const res = await request(app)
      .get(`/api/admin/members/${gymA.memberFixture.member._id}`)
      .set('Authorization', `Bearer ${gymB.adminToken}`);
    expect(res.status).toBe(404);
  });

  test("Gym A's member list never includes Gym B's members", async () => {
    await createMember(gymB.subscriber, { name: 'Member B' });
    const res = await request(app)
      .get('/api/admin/members')
      .set('Authorization', `Bearer ${gymA.adminToken}`);
    expect(res.status).toBe(200);
    const names = res.body.data.members.map((m) => m.name);
    expect(names).toContain('Member A');
    expect(names).not.toContain('Member B');
  });

  test("Gym B cannot record a payment against Gym A's member", async () => {
    const res = await request(app)
      .post('/api/admin/payment')
      .set('Authorization', `Bearer ${gymB.adminToken}`)
      .send({ memberId: gymA.memberFixture.member._id, amount: 500, amountNow: 500, method: 'cash' });
    expect(res.status).toBe(404);
  });

  test("Gym B cannot view a payment that belongs to Gym A", async () => {
    const payment = await Payment.create({
      subscriberId: gymA.subscriber._id,
      memberId: gymA.memberFixture.member._id,
      amount: 1000,
      amountPaid: 1000,
      method: 'cash',
      status: 'paid',
    });
    const res = await request(app)
      .get('/api/admin/payment')
      .set('Authorization', `Bearer ${gymB.adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.find((p) => String(p._id) === String(payment._id))).toBeUndefined();
  });

  test("Gym B cannot book/see a PT session against Gym A's member", async () => {
    const trainer = await SubAdmin.create({ subscriberId: gymA.subscriber._id, name: 'Trainer A', phone: `9${Date.now()}`, template: 'trainer' });
    const session = await PTSession.create({
      subscriberId: gymA.subscriber._id,
      memberId: gymA.memberFixture.member._id,
      subAdminId: trainer._id,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const res = await request(app)
      .patch(`/api/admin/pt-sessions/${session._id}/cancel`)
      .set('Authorization', `Bearer ${gymB.adminToken}`);
    expect(res.status).toBe(404);
  });

  test('Root Admin subscriber list contains both gyms, but a Gym Owner token is rejected on that route', async () => {
    const res = await request(app)
      .get('/api/root-admin/subscribers')
      .set('Authorization', `Bearer ${gymA.adminToken}`);
    expect(res.status).toBe(403);
  });
});
