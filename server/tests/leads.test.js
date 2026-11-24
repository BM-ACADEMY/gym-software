const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createSubAdmin } = require('./helpers/factories');
const { _resetRateLimits } = require('../middleware/security');
const Lead = require('../models/Lead');
const Subscriber = require('../models/Subscriber');

const DAY = 86400000;
const auth = (t) => ({ Authorization: `Bearer ${t.adminToken}` });

describe('lead capture and CRM', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });
  beforeEach(() => _resetRateLimits());

  const gym = (extra = {}) => createTenant({ subscriber: { planKey: 'growth', paidUntil: new Date(Date.now() + 30 * DAY), ...extra } });
  const linkOf = async (t) => (await request(app).get('/api/admin/leads/form-link').set(auth(t))).body.data.key;
  const submit = (key, body) => request(app).post(`/api/public/leads/${key}`).send(body);

  test('owner routes need a login; staff cannot open them', async () => {
    expect((await request(app).get('/api/admin/leads')).status).toBe(401);
    const t = await gym();
    const { token } = await createSubAdmin(t.subscriber, {});
    expect((await request(app).get('/api/admin/leads').set({ Authorization: `Bearer ${token}` })).status).toBe(403);
  });

  test('the enquiry link is made once, is long and random, and replacing it kills the old one', async () => {
    const t = await gym();
    const k1 = await linkOf(t); const k2 = await linkOf(t);
    expect(k1).toBe(k2); expect(k1.length).toBeGreaterThanOrEqual(20);
    expect((await request(app).get(`/api/public/leads/${k1}`)).body.data.gymName).toBe(t.subscriber.gymName);
    const r = await request(app).post('/api/admin/leads/form-link/replace').set(auth(t));
    expect(r.body.data.key).not.toBe(k1);
    expect((await request(app).get(`/api/public/leads/${k1}`)).status).toBe(404);
    expect((await submit(k1, { name: 'Ravi', phone: '9876543210', consent: true })).status).toBe(404);
    expect((await request(app).get('/api/public/leads/short')).status).toBe(404);
  });

  test('public form: needs the tick box, saves one lead in the right gym, shows only the gym name', async () => {
    const a = await gym(); const b = await gym();
    const key = await linkOf(a);
    expect((await submit(key, { name: 'Ravi', phone: '9876543210' })).status).toBe(400); // no consent
    expect(await Lead.countDocuments({})).toBe(0);
    const ok = await submit(key, { name: 'Ravi', phone: '98765 43210', consent: true, goal: 'lose weight' });
    expect(ok.status).toBe(201); expect(JSON.stringify(ok.body)).not.toMatch(/9876543210|Ravi/);
    const lead = await Lead.findOne({ subscriberId: a.subscriber._id });
    expect(lead.phone).toBe('9876543210'); expect(lead.source).toBe('form'); expect(lead.consentAt).toBeTruthy();
    expect(await Lead.countDocuments({ subscriberId: b.subscriber._id })).toBe(0);
  });

  test('a repeat enquiry joins the same lead and brings a lost one back; no second row', async () => {
    const t = await gym(); const key = await linkOf(t);
    await submit(key, { name: 'Ravi', phone: '9876543210', consent: true });
    await Lead.updateOne({ subscriberId: t.subscriber._id }, { $set: { status: 'lost' } });
    await submit(key, { name: 'Ravi K', phone: '+91 9876543210', consent: true, note: 'asked again' });
    const all = await Lead.find({ subscriberId: t.subscriber._id });
    expect(all).toHaveLength(1); expect(all[0].enquiries).toBe(2); expect(all[0].status).toBe('new'); expect(all[0].note).toMatch(/asked again/);
  });

  test('bots and bad input: the hidden field is ignored quietly, objects are refused, the form is rate limited', async () => {
    const t = await gym(); const key = await linkOf(t);
    expect((await submit(key, { name: 'Bot', phone: '9876543210', consent: true, website: 'http://spam' })).status).toBe(201);
    expect(await Lead.countDocuments({ subscriberId: t.subscriber._id })).toBe(0); // nothing saved
    expect((await submit(key, { name: { $ne: '' }, phone: '9876543210', consent: true })).status).toBe(400);
    // Rate limits are off in tests unless asked for (middleware/security.js).
    process.env.RATE_LIMIT_IN_TESTS = '1';
    try {
      let last;
      for (let i = 0; i < 12; i += 1) last = await submit(key, { name: 'Test', phone: '98765432' + String(10 + i), consent: true });
      expect(last.status).toBe(429);
    } finally {
      delete process.env.RATE_LIMIT_IN_TESTS;
      _resetRateLimits();
    }
  });

  test('an expired or switched-off gym takes no new enquiries', async () => {
    const t = await gym(); const key = await linkOf(t);
    await Subscriber.updateOne({ _id: t.subscriber._id }, { $set: { paidUntil: new Date(Date.now() - 30 * DAY) } });
    expect((await submit(key, { name: 'Ravi', phone: '9876543210', consent: true })).status).toBe(404);
    await Subscriber.updateOne({ _id: t.subscriber._id }, { $set: { paidUntil: new Date(Date.now() + 30 * DAY), isActive: false } });
    expect((await request(app).get(`/api/public/leads/${key}`)).status).toBe(404);
  });

  test('owner list masks numbers; one lead shows the whole number; own gym only', async () => {
    const a = await gym(); const b = await gym();
    await request(app).post('/api/admin/leads').set(auth(a)).send({ name: 'Walk In', phone: '9123456780', source: 'walkin' });
    await request(app).post('/api/admin/leads').set(auth(b)).send({ name: 'Other Gym', phone: '9988776655' });
    const list = await request(app).get('/api/admin/leads').set(auth(a));
    expect(list.body.data.items).toHaveLength(1); expect(list.body.data.items[0].phone).toBe('XXXXXXX780');
    expect(JSON.stringify(list.body)).not.toMatch(/9988776655|Other Gym|9123456780/);
    const one = await request(app).get(`/api/admin/leads/${list.body.data.items[0].id}`).set(auth(a));
    expect(one.body.data.phone).toBe('9123456780');
    expect((await request(app).post('/api/admin/leads').set(auth(a)).send({ name: 'Dup', phone: '91234 56780' })).status).toBe(409);
  });

  test('another gym cannot read, change or delete a lead; bad ids are not found', async () => {
    const a = await gym(); const b = await gym();
    const made = await request(app).post('/api/admin/leads').set(auth(a)).send({ name: 'Walk In', phone: '9123456780' });
    const id = made.body.data.id;
    expect((await request(app).get(`/api/admin/leads/${id}`).set(auth(b))).status).toBe(404);
    expect((await request(app).patch(`/api/admin/leads/${id}`).set(auth(b)).send({ status: 'lost' })).status).toBe(404);
    expect((await request(app).delete(`/api/admin/leads/${id}`).set(auth(b))).status).toBe(404);
    expect((await request(app).get('/api/admin/leads/not-an-id').set(auth(b))).status).toBe(404);
    expect((await Lead.findById(id)).status).toBe('new');
  });

  test('owner can move a lead along, set a follow-up and delete it; other fields cannot be changed', async () => {
    const t = await gym();
    const id = (await request(app).post('/api/admin/leads').set(auth(t)).send({ name: 'Walk In', phone: '9123456780' })).body.data.id;
    const up = await request(app).patch(`/api/admin/leads/${id}`).set(auth(t)).send({ status: 'trial', nextFollowUpAt: new Date(Date.now() + DAY).toISOString(), phone: '9000000000', subscriberId: '000000000000000000000000' });
    expect(up.status).toBe(200); expect(up.body.data.status).toBe('trial');
    const after = await Lead.findById(id);
    expect(after.phone).toBe('9123456780'); expect(String(after.subscriberId)).toBe(String(t.subscriber._id));
    expect((await request(app).patch(`/api/admin/leads/${id}`).set(auth(t)).send({ status: 'nonsense' })).status).toBe(400);
    expect((await request(app).get('/api/admin/leads?status=trial').set(auth(t))).body.data.total).toBe(1);
    expect((await request(app).get('/api/admin/leads?status=bogus').set(auth(t))).status).toBe(400);
    expect((await request(app).delete(`/api/admin/leads/${id}`).set(auth(t))).status).toBe(200);
    expect(await Lead.countDocuments({ subscriberId: t.subscriber._id })).toBe(0);
  });
});
