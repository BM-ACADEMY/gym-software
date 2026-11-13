const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant } = require('./helpers/factories');
const Member = require('../models/Member');
const Attendance = require('../models/Attendance');
const CopilotAction = require('../models/CopilotAction');
const auth = (t) => ({ Authorization: `Bearer ${t.adminToken}` });
const DAY = 86400000;
describe('churn risk and win-back (AI-04)', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });
  test('needs a login', async () => { expect((await request(app).get('/api/admin/copilot/risk')).status).toBe(401); });
  test('lists a member who stopped coming, and the next win-back step; marking it done moves to no repeat', async () => {
    const t = await createTenant(); const sid = t.subscriber._id; const now = Date.now();
    const risky = await Member.create({ subscriberId: sid, name: 'Risky Ravi', phone: '9000000011', status: 'active', createdAt: new Date(now - 200 * DAY), expiresAt: new Date(now + 10 * DAY) });
    await Attendance.insertMany([20, 21, 22, 24, 26, 27].map((n) => ({ subscriberId: sid, memberId: risky._id, checkedInAt: new Date(now - n * DAY), method: 'manual' })));
    const lapsed = await Member.create({ subscriberId: sid, name: 'Lapsed Lata', phone: '9000000012', status: 'active', createdAt: new Date(now - 200 * DAY), expiresAt: new Date(now - 6 * DAY) });
    const r1 = await request(app).get('/api/admin/copilot/risk?lang=en').set(auth(t));
    expect(r1.status).toBe(200);
    expect(r1.body.data.atRisk.map((x) => x.name)).toContain('Risky Ravi');
    const w = r1.body.data.winBack.find((x) => x.name === 'Lapsed Lata'); expect(w.step).toBe(2);
    const done = await request(app).post('/api/admin/copilot/done').set(auth(t)).send({ memberId: String(lapsed._id), kind: 'lapsed', step: 2 });
    expect(done.status).toBe(200);
    const r2 = await request(app).get('/api/admin/copilot/risk').set(auth(t));
    expect(r2.body.data.winBack.find((x) => x.name === 'Lapsed Lata')).toBeUndefined();
    expect((await CopilotAction.findOne({ memberId: lapsed._id })).step).toBe(2);
  });
  test('another gym never sees these members', async () => {
    const a = await createTenant(); const b = await createTenant();
    await Member.create({ subscriberId: a.subscriber._id, name: 'Only A', phone: '9000000013', status: 'active', expiresAt: new Date(Date.now() - 3 * DAY) });
    const rb = await request(app).get('/api/admin/copilot/risk').set(auth(b));
    expect(rb.body.data.winBack.length).toBe(0); expect(rb.body.data.atRisk.length).toBe(0);
  });
});
