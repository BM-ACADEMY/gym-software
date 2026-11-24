// RM-03: attack tests on Leads (owner screens and the public join form) and Owner reports.
// Each test is an attempt to reach or change another gym's data, or to plant data through the join form.
jest.mock('../utils/whatsapp', () => ({
  ...jest.requireActual('../utils/whatsapp'),
  sendTemplate: jest.fn(async () => ({ ok: true, demo: false })),
}));

const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createMember, createRootAdmin } = require('./helpers/factories');
const { _resetRateLimits } = require('../middleware/security');
const { sendTemplate } = require('../utils/whatsapp');
const { runOwnerReports } = require('../services/ownerReport');
const Lead = require('../models/Lead');
const OwnerReport = require('../models/OwnerReport');

const DAY = 86400000;
const auth = (t) => ({ Authorization: `Bearer ${t.adminToken}` });
const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const gym = (extra = {}) => createTenant({ subscriber: { planKey: 'growth', whatsappEnabled: true, paidUntil: new Date(Date.now() + 30 * DAY), ...extra } });
const linkOf = async (t) => (await request(app).get('/api/admin/leads/form-link').set(auth(t))).body.data.key;
const submit = (key, body) => request(app).post(`/api/public/leads/${key}`).send(body);

describe('RM-03 attacks: leads and the join form', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });
  beforeEach(() => _resetRateLimits());

  test('join form: extra fields cannot plant a lead in another gym or set its status, source or count', async () => {
    const a = await gym(); const b = await gym(); const key = await linkOf(a);
    const r = await submit(key, { name: 'Ravi', phone: '9876543210', consent: true, subscriberId: String(b.subscriber._id), status: 'joined', source: 'walkin', enquiries: 999 });
    expect(r.status).toBe(201);
    expect(await Lead.countDocuments({ subscriberId: b.subscriber._id })).toBe(0);
    const lead = await Lead.findOne({ subscriberId: a.subscriber._id });
    expect(lead.status).toBe('new'); expect(lead.source).toBe('form'); expect(lead.enquiries).toBe(1);
  });

  test('join form: a number already in gym A, sent on gym B\'s link, leaves gym A\'s lead untouched', async () => {
    const a = await gym(); const b = await gym();
    await request(app).post('/api/admin/leads').set(auth(a)).send({ name: 'Walk In', phone: '9123456780' });
    await Lead.updateOne({ subscriberId: a.subscriber._id }, { $set: { status: 'lost' } });
    expect((await submit(await linkOf(b), { name: 'Walk In', phone: '9123456780', consent: true, note: 'from B' })).status).toBe(201);
    const inA = await Lead.findOne({ subscriberId: a.subscriber._id });
    expect(inA.status).toBe('lost'); expect(inA.enquiries).toBe(1); expect(inA.note || '').not.toMatch(/from B/);
    expect(await Lead.countDocuments({ subscriberId: b.subscriber._id })).toBe(1);
  });

  test('join form: odd, long or operator-looking link keys find nothing', async () => {
    const a = await gym(); const key = await linkOf(a);
    for (const k of [encodeURIComponent('{"$ne":""}'), encodeURIComponent('[$ne]'), 'x'.repeat(65), `${key}x`, key.slice(0, -1)]) {
      expect((await request(app).get(`/api/public/leads/${k}`)).status).toBe(404);
      expect((await submit(k, { name: 'Ravi', phone: '9876543210', consent: true })).status).toBe(404);
    }
    expect(await Lead.countDocuments({ subscriberId: a.subscriber._id })).toBe(0);
  });

  test('owner add: a subscriberId in the body is ignored; the lead stays in the owner\'s gym', async () => {
    const a = await gym(); const b = await gym();
    const r = await request(app).post('/api/admin/leads').set(auth(a)).send({ name: 'Walk In', phone: '9123456780', subscriberId: String(b.subscriber._id) });
    expect(r.status).toBe(201);
    expect(await Lead.countDocuments({ subscriberId: b.subscriber._id })).toBe(0);
    expect(await Lead.countDocuments({ subscriberId: a.subscriber._id })).toBe(1);
  });

  test('owner list: operator and junk query values never widen the list to another gym', async () => {
    const a = await gym(); const b = await gym();
    await request(app).post('/api/admin/leads').set(auth(b)).send({ name: 'Other Gym', phone: '9988776655' });
    for (const q of ['status[$ne]=x', 'status[$gt]=', 'page=-5', 'page=99999999', 'page[$gt]=0']) {
      const r = await request(app).get(`/api/admin/leads?${q}`).set(auth(a));
      expect([200, 400]).toContain(r.status);
      expect(JSON.stringify(r.body)).not.toMatch(/Other Gym|9988776655/);
    }
  });

  test('members and the Root Admin cannot use the owner lead routes', async () => {
    const a = await gym();
    const { token: memberToken } = await createMember(a.subscriber, {});
    const { token: rootToken } = await createRootAdmin();
    for (const token of [memberToken, rootToken]) {
      expect((await request(app).get('/api/admin/leads').set(bearer(token))).status).toBe(403);
      expect((await request(app).get('/api/admin/leads/form-link').set(bearer(token))).status).toBe(403);
      expect((await request(app).post('/api/admin/leads').set(bearer(token)).send({ name: 'X', phone: '9123456780' })).status).toBe(403);
    }
    expect(await Lead.countDocuments({ subscriberId: a.subscriber._id })).toBe(0);
  });
});

describe('RM-03 attacks: owner reports', () => {
  // Wednesday 11:00 IST: the finished week is Mon 9 Nov to Sun 15 Nov.
  const now = new Date('2026-11-18T05:30:00Z');
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });
  beforeEach(() => sendTemplate.mockClear());

  test('members and the Root Admin cannot open, send or dismiss reports', async () => {
    const a = await gym();
    await runOwnerReports({ subscriberId: a.subscriber._id, now });
    const doc = await OwnerReport.findOne({ subscriberId: a.subscriber._id, period: 'weekly' });
    const { token: memberToken } = await createMember(a.subscriber, {});
    const { token: rootToken } = await createRootAdmin();
    for (const token of [memberToken, rootToken]) {
      expect((await request(app).get('/api/admin/owner-reports').set(bearer(token))).status).toBe(403);
      expect((await request(app).post(`/api/admin/owner-reports/${doc._id}/send`).set(bearer(token))).status).toBe(403);
      expect((await request(app).post(`/api/admin/owner-reports/${doc._id}/dismiss`).set(bearer(token))).status).toBe(403);
    }
    expect((await OwnerReport.findById(doc._id)).status).toBe('ready');
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  test('another gym\'s report ids never appear in this gym\'s list or history', async () => {
    const a = await gym(); const b = await gym();
    await runOwnerReports({ subscriberId: a.subscriber._id, now });
    const aIds = (await OwnerReport.find({ subscriberId: a.subscriber._id })).map((d) => String(d._id));
    const list = await request(app).get('/api/admin/owner-reports').set(auth(b));
    expect(list.status).toBe(200);
    const text = JSON.stringify(list.body);
    for (const id of aIds) expect(text).not.toContain(id);
    expect(text).not.toContain(a.subscriber.gymName);
  });

  test('send goes only to the signed-in owner\'s own number; a phone in the body is ignored', async () => {
    const a = await gym();
    await runOwnerReports({ subscriberId: a.subscriber._id, now });
    const doc = await OwnerReport.findOne({ subscriberId: a.subscriber._id, period: 'weekly' });
    const r = await request(app).post(`/api/admin/owner-reports/${doc._id}/send`).set(auth(a)).send({ to: '9000000001', phone: '9000000001' });
    expect(r.status).toBe(200);
    expect(sendTemplate).toHaveBeenCalledTimes(1);
    const sentTo = JSON.stringify(sendTemplate.mock.calls[0][0]);
    expect(sentTo).toContain(a.admin.phone.slice(-10)); expect(sentTo).not.toContain('9000000001');
  });
});
