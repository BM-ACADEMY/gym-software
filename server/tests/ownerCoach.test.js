const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant } = require('./helpers/factories');
const Member = require('../models/Member');
const GymPlan = require('../models/GymPlan');
const CopilotAction = require('../models/CopilotAction');
const OwnerCoach = require('../models/OwnerCoach');

const auth = (t) => ({ Authorization: `Bearer ${t.adminToken}` });
const DAY = 86400000;

describe('weekly owner coach (AI-05)', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });

  test('needs a login', async () => {
    expect((await request(app).get('/api/admin/coach')).status).toBe(401);
  });

  test('builds this week once, with rupees from the gym own plan, and tracks the Copilot taps', async () => {
    const t = await createTenant();
    await GymPlan.create({ subscriberId: t.subscriber._id, name: 'Monthly', durationDays: 30, price: 1000 });
    const now = Date.now();
    const members = await Member.insertMany([1, 2, 3].map((n) => ({ subscriberId: t.subscriber._id, name: 'M' + n, phone: '90000000' + n + '0', status: 'active', expiresAt: new Date(now + 2 * DAY), createdAt: new Date(now - 60 * DAY) })));
    const first = await request(app).get('/api/admin/coach').set(auth(t));
    expect(first.status).toBe(200);
    const renew = first.body.data.actions.find((a) => a.kind === 'renew');
    expect(renew.target).toBe(3); expect(renew.rupees).toBe(3000); expect(renew.status).toBe('open');
    await CopilotAction.create({ subscriberId: t.subscriber._id, memberId: members[0]._id, kind: 'renew' });
    await CopilotAction.create({ subscriberId: t.subscriber._id, memberId: members[1]._id, kind: 'renew' });
    const second = await request(app).get('/api/admin/coach').set(auth(t));
    expect(second.body.data.actions.find((a) => a.kind === 'renew').status).toBe('done'); // 2 of 3 contacted
    expect(await OwnerCoach.countDocuments({ subscriberId: t.subscriber._id })).toBe(1); // made once for the week
    expect(JSON.stringify(second.body)).not.toMatch(/M1|M2|9000000/);
  });

  test('one gym never sees another gym data', async () => {
    const a = await createTenant(); const b = await createTenant();
    await GymPlan.create({ subscriberId: a.subscriber._id, name: 'Monthly', durationDays: 30, price: 1000 });
    await Member.create({ subscriberId: a.subscriber._id, name: 'Only A', phone: '9111111111', status: 'active', expiresAt: new Date(Date.now() + 2 * DAY) });
    const rb = await request(app).get('/api/admin/coach').set(auth(b));
    expect(rb.body.data.actions.find((x) => x.kind === 'renew')).toBeUndefined();
    expect(await OwnerCoach.countDocuments({ subscriberId: a.subscriber._id })).toBe(0);
  });
});
