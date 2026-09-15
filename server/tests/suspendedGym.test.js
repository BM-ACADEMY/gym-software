const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createSubAdmin, createMember, createRootAdmin } = require('./helpers/factories');
const Subscriber = require('../models/Subscriber');
const { generateToken } = require('../utils/jwt');

// Root Admin → Subscriber Management → Suspend must lock every one of that
// gym's users (owner, staff, member) into read-only: GETs still work, every
// write is blocked, and the response carries X-Gym-Suspended so the frontend
// can show a banner. Two exemptions: Root Admin's own impersonation session
// (support can still act on the gym's behalf), and submitting a support
// ticket (the one way for a suspended owner to ask for reactivation).
describe('Suspended gym — read-only lockdown', () => {
  let gym, trainerFixture, memberFixture, rootAdmin;

  beforeAll(async () => {
    await db.connect();
    gym = await createTenant({ gymName: 'Suspendable Gym' });
    trainerFixture = await createSubAdmin(gym.subscriber, { members: { view: true, edit: true, viewAll: true } });
    memberFixture = await createMember(gym.subscriber);
    rootAdmin = await createRootAdmin();
    await Subscriber.findByIdAndUpdate(gym.subscriber._id, { isActive: false });
  });

  afterAll(async () => {
    await db.clearDatabase();
    await db.closeDatabase();
  });

  test('GET requests still work for a suspended gym (owner)', async () => {
    const res = await request(app).get('/api/admin/members').set('Authorization', `Bearer ${gym.adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['x-gym-suspended']).toBe('true');
  });

  test('a write request from the Gym Owner is blocked with 403', async () => {
    const res = await request(app)
      .post('/api/admin/members')
      .set('Authorization', `Bearer ${gym.adminToken}`)
      .send({ name: 'Should Not Be Created' });
    expect(res.status).toBe(403);
    expect(res.body.suspended).toBe(true);
  });

  test('a write request from a Sub-Admin (trainer) is blocked with 403', async () => {
    const res = await request(app)
      .post('/api/subadmin/members')
      .set('Authorization', `Bearer ${trainerFixture.token}`)
      .send({ name: 'Should Not Be Created' });
    expect(res.status).toBe(403);
  });

  test('a write request from a Member (self check-in) is blocked with 403', async () => {
    const res = await request(app)
      .post('/api/member/attendance/check-in')
      .set('Authorization', `Bearer ${memberFixture.token}`);
    expect(res.status).toBe(403);
  });

  test('a Sub-Admin can still GET (read-only access preserved)', async () => {
    const res = await request(app).get('/api/subadmin/members').set('Authorization', `Bearer ${trainerFixture.token}`);
    expect(res.status).toBe(200);
  });

  test("Root Admin's own routes are never blocked by a gym's suspension", async () => {
    const res = await request(app).get('/api/root-admin/subscribers').set('Authorization', `Bearer ${rootAdmin.token}`);
    expect(res.status).toBe(200);
  });

  test('an impersonation session is exempt and can still write on the suspended gym\'s behalf', async () => {
    const impersonationToken = generateToken({ id: gym.admin._id, role: 'admin', subscriberId: gym.subscriber._id, impersonatedBy: rootAdmin.rootAdmin._id }, '1h');
    const res = await request(app)
      .post('/api/admin/members')
      .set('Authorization', `Bearer ${impersonationToken}`)
      .send({ name: 'Created via impersonation' });
    expect(res.status).toBe(201);
  });

  test('the Gym Owner can still submit a support ticket while suspended', async () => {
    const res = await request(app)
      .post('/api/admin/support')
      .set('Authorization', `Bearer ${gym.adminToken}`)
      .send({ subject: 'Please reactivate my gym', description: 'Not sure why we were suspended.' });
    expect(res.status).toBe(201);
  });

  test('reactivating the gym immediately lifts the write block', async () => {
    await Subscriber.findByIdAndUpdate(gym.subscriber._id, { isActive: true });
    const res = await request(app)
      .post('/api/admin/members')
      .set('Authorization', `Bearer ${gym.adminToken}`)
      .send({ name: 'Created after reactivation' });
    expect(res.status).toBe(201);
    expect(res.headers['x-gym-suspended']).toBe('false');
  });
});
