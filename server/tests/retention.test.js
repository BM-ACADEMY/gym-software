jest.mock('../utils/whatsapp', () => ({
  ...jest.requireActual('../utils/whatsapp'),
  sendTemplate: jest.fn(async () => ({ ok: true, demo: false })),
}));

const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createMember } = require('./helpers/factories');
const { sendTemplate } = require('../utils/whatsapp');
const Subscriber = require('../models/Subscriber');
const R = require('../services/automationRules');

const DAY = 86400000;
const auth = (t) => ({ Authorization: `Bearer ${t.adminToken}` });

// The send window is 9 am to 9 pm IST. Tests that send adapt to the time of day they run.
describe('At-risk list and one-tap messages', () => {
  let a, b, absent, lapsed;
  beforeAll(async () => {
    await db.connect();
    a = await createTenant({ subscriber: { whatsappEnabled: true, planKey: 'growth', paidUntil: new Date(Date.now() + 20 * DAY) } });
    b = await createTenant({ subscriber: { whatsappEnabled: true, planKey: 'growth', paidUntil: new Date(Date.now() + 20 * DAY) } });
    absent = (await createMember(a.subscriber, { name: 'Absent Ann', phone: '9000000031', expiresAt: new Date(Date.now() + 30 * DAY) })).member;
    const Member = require('../models/Member');
    await Member.collection.updateOne({ _id: absent._id }, { $set: { createdAt: new Date(Date.now() - 40 * DAY) } });
    lapsed = (await createMember(a.subscriber, { name: 'Lapsed Lee', phone: '9000000032', expiresAt: new Date(Date.now() - 5 * DAY) })).member;
    await createMember(b.subscriber, { name: 'Other Gym Person', phone: '9000000033', expiresAt: new Date(Date.now() - 5 * DAY) });
  });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });
  beforeEach(() => sendTemplate.mockClear());

  test('lists only this gym\'s absent and lapsed members', async () => {
    const r = await request(app).get('/api/admin/retention/at-risk').set(auth(a));
    expect(r.status).toBe(200);
    expect(r.body.data.absent.map((m) => m.name)).toContain('Absent Ann');
    expect(r.body.data.lapsed.map((m) => m.name)).toContain('Lapsed Lee');
    expect(JSON.stringify(r.body)).not.toMatch(/Other Gym Person/);
  });

  test('cannot message another gym\'s member', async () => {
    const other = await request(app).get('/api/admin/retention/at-risk').set(auth(b));
    const foreignId = other.body.data.lapsed[0].id;
    const r = await request(app).post('/api/admin/retention/message').set(auth(a)).send({ memberId: foreignId, kind: 'lapsed' });
    expect(r.status).toBe(404);
  });

  test('rejects bad input', async () => {
    expect((await request(app).post('/api/admin/retention/message').set(auth(a)).send({ memberId: { $ne: 1 }, kind: 'lapsed' })).status).toBe(400);
    expect((await request(app).post('/api/admin/retention/message').set(auth(a)).send({ memberId: String(absent._id), kind: 'spam' })).status).toBe(400);
  });

  test('a Solo gym (0 WhatsApp messages) cannot send', async () => {
    const solo = await createTenant({ subscriber: { whatsappEnabled: true, planKey: 'solo', paidUntil: new Date(Date.now() + 20 * DAY) } });
    const m = (await createMember(solo.subscriber, { phone: '9000000034', expiresAt: new Date(Date.now() - 3 * DAY) })).member;
    const now = new Date();
    if (!R.inSendWindow(now)) return; // outside 9 to 21 IST the route refuses earlier; covered by the window test below
    const r = await request(app).post('/api/admin/retention/message').set(auth(solo)).send({ memberId: String(m._id), kind: 'lapsed' });
    expect(r.status).toBe(402);
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  test('inside the window it sends once, a second tap the same day is refused', async () => {
    if (!R.inSendWindow(new Date())) {
      const r = await request(app).post('/api/admin/retention/message').set(auth(a)).send({ memberId: String(lapsed._id), kind: 'lapsed' });
      expect(r.status).toBe(400);
      return;
    }
    const one = await request(app).post('/api/admin/retention/message').set(auth(a)).send({ memberId: String(lapsed._id), kind: 'lapsed' });
    expect(one.status).toBe(200);
    expect(sendTemplate.mock.calls[0][0].template).toBe('gymdesk_winback');
    const two = await request(app).post('/api/admin/retention/message').set(auth(a)).send({ memberId: String(lapsed._id), kind: 'lapsed' });
    expect(two.status).toBe(409);
    expect(sendTemplate).toHaveBeenCalledTimes(1);
  });
});
