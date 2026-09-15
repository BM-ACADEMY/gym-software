const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createSubAdmin, createMember, createRootAdmin } = require('./helpers/factories');

// One continuous story touching every role in the doc, each hitting a real
// endpoint — not isolated unit checks, but a single flow a real gym would go
// through: owner onboards a member and a trainer, the trainer books a PT
// session, the member checks in and is billed, and the platform (Root Admin)
// can see and act on all of it.
describe('Cross-role QA walkthrough', () => {
  let gym, memberFixture, trainerFixture, rootAdmin, session;

  beforeAll(async () => {
    await db.connect();
    gym = await createTenant({ gymName: 'Walkthrough Gym' });
    rootAdmin = await createRootAdmin();
  });

  afterAll(async () => {
    await db.clearDatabase();
    await db.closeDatabase();
  });

  test('Root Admin sees the new gym in the subscriber list', async () => {
    const res = await request(app)
      .get('/api/root-admin/subscribers')
      .set('Authorization', `Bearer ${rootAdmin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((s) => s.gymName === 'Walkthrough Gym')).toBe(true);
  });

  test('Gym Owner onboards a member', async () => {
    const res = await request(app)
      .post('/api/admin/members')
      .set('Authorization', `Bearer ${gym.adminToken}`)
      .send({ name: 'Walkthrough Member', phone: `7${Date.now()}` });
    expect(res.status).toBe(201);
    memberFixture = res.body.data;
  });

  test('Gym Owner hires a trainer (sub-admin) with pt-sessions permission', async () => {
    trainerFixture = await createSubAdmin(gym.subscriber, { 'pt-sessions': { view: true, edit: true, viewAll: true } }, { template: 'trainer', name: 'Walkthrough Trainer' });
    expect(trainerFixture.subAdmin._id).toBeTruthy();
  });

  test('Trainer (sub-admin) books a PT session for the member', async () => {
    const res = await request(app)
      .post('/api/subadmin/pt-sessions')
      .set('Authorization', `Bearer ${trainerFixture.token}`)
      .send({ memberId: memberFixture._id, subAdminId: trainerFixture.subAdmin._id, scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
    expect(res.status).toBe(201);
    session = res.body.data;
  });

  test('Member checks in for the day', async () => {
    const memberToken = require('../utils/jwt').generateToken({ id: memberFixture._id, role: 'member', subscriberId: gym.subscriber._id });
    const res = await request(app)
      .post('/api/member/attendance/check-in')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(201);
  });

  test('Gym Owner records a payment for the member', async () => {
    const res = await request(app)
      .post('/api/admin/payment')
      .set('Authorization', `Bearer ${gym.adminToken}`)
      .send({ memberId: memberFixture._id, amount: 1500, amountNow: 1500, method: 'cash' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('paid');
  });

  test('Trainer completes the PT session', async () => {
    const res = await request(app)
      .patch(`/api/subadmin/pt-sessions/${session._id}/complete`)
      .set('Authorization', `Bearer ${trainerFixture.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
  });

  test("Root Admin drills into the gym and sees the real member/revenue numbers", async () => {
    const res = await request(app)
      .get(`/api/root-admin/subscribers/${gym.subscriber._id}`)
      .set('Authorization', `Bearer ${rootAdmin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.stats.memberCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.stats.totalRevenue).toBeGreaterThanOrEqual(1500);
  });

  test('Root Admin can impersonate the Gym Owner and act as them (audited)', async () => {
    const impersonateRes = await request(app)
      .post(`/api/root-admin/subscribers/${gym.subscriber._id}/impersonate`)
      .set('Authorization', `Bearer ${rootAdmin.token}`);
    expect(impersonateRes.status).toBe(200);

    const impersonatedToken = impersonateRes.body.data.token;
    const asImpersonated = await request(app)
      .get('/api/admin/members')
      .set('Authorization', `Bearer ${impersonatedToken}`);
    expect(asImpersonated.status).toBe(200);
    expect(asImpersonated.body.data.members.some((m) => m.name === 'Walkthrough Member')).toBe(true);
  });
});
