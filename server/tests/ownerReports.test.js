// Database test with a mocked WhatsApp sender (nothing is really sent).
jest.mock('../utils/whatsapp', () => ({
  ...jest.requireActual('../utils/whatsapp'),
  sendTemplate: jest.fn(async () => ({ ok: true, demo: false })),
}));

const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createSubAdmin, createMember } = require('./helpers/factories');
const { sendTemplate } = require('../utils/whatsapp');
const { runOwnerReports } = require('../services/ownerReport');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const OwnerReport = require('../models/OwnerReport');
const Notification = require('../models/Notification');

const DAY = 86400000;
const auth = (t) => ({ Authorization: `Bearer ${t.adminToken}` });
// Wednesday 11:00 IST. The finished week is Mon 9 Nov to Sun 15 Nov.
const now = new Date('2026-11-18T05:30:00Z');
const lastWeek = new Date('2026-11-11T05:30:00Z');

describe('owner autopilot reports', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });
  beforeEach(() => sendTemplate.mockClear());

  const gym = (extra = {}) => createTenant({ subscriber: { whatsappEnabled: true, planKey: 'growth', paidUntil: new Date(now.getTime() + 30 * DAY), ...extra } });

  test('needs a login, and staff or members cannot open it', async () => {
    expect((await request(app).get('/api/admin/owner-reports')).status).toBe(401);
    const t = await gym();
    const { token } = await createSubAdmin(t.subscriber, {});
    expect((await request(app).get('/api/admin/owner-reports').set({ Authorization: `Bearer ${token}` })).status).toBe(403);
  });

  test('the job makes each period once with rupee totals from this gym only, and a repeat run changes nothing', async () => {
    const a = await gym(); const b = await gym();
    const { member: m } = await createMember(a.subscriber, { name: 'Ravi', phone: '9876543210' });
    await Payment.create({ subscriberId: a.subscriber._id, memberId: m._id, amount: 1000, amountPaid: 1000, method: 'cash', status: 'paid', installments: [{ amount: 1000, method: 'cash', paidAt: lastWeek }] });
    await Expense.create({ subscriberId: a.subscriber._id, category: 'rent', amount: 400, date: lastWeek });
    const { member: bm } = await createMember(b.subscriber, { name: 'Other', phone: '9123456780' });
    await Payment.create({ subscriberId: b.subscriber._id, memberId: bm._id, amount: 9999, amountPaid: 9999, method: 'cash', status: 'paid', installments: [{ amount: 9999, method: 'cash', paidAt: lastWeek }] });

    await runOwnerReports({ subscriberId: a.subscriber._id, now });
    await runOwnerReports({ subscriberId: a.subscriber._id, now });
    expect(await OwnerReport.countDocuments({ subscriberId: a.subscriber._id })).toBe(2); // weekly and monthly, once each
    const weekly = await OwnerReport.findOne({ subscriberId: a.subscriber._id, period: 'weekly' });
    expect(weekly.key).toBe('2026-11-09');
    const money = (k) => weekly.data.metrics.find((x) => x.key === k).value;
    expect(money('collected')).toBe(1000); expect(money('expenses')).toBe(400); expect(money('net')).toBe(600);
    expect(JSON.stringify(weekly.toObject())).not.toMatch(/Ravi|9876543210|Other|9999/);
    expect(await OwnerReport.countDocuments({ subscriberId: b.subscriber._id })).toBe(0);
  });

  test('suggest mode: nothing is sent by itself; one tap sends it once and marks it sent', async () => {
    const t = await gym();
    await runOwnerReports({ subscriberId: t.subscriber._id, now });
    expect(sendTemplate).not.toHaveBeenCalled();
    const doc = await OwnerReport.findOne({ subscriberId: t.subscriber._id, period: 'weekly' });
    expect(doc.status).toBe('ready');
    const r1 = await request(app).post(`/api/admin/owner-reports/${doc._id}/send`).set(auth(t));
    expect(r1.status).toBe(200);
    const r2 = await request(app).post(`/api/admin/owner-reports/${doc._id}/send`).set(auth(t));
    expect(r2.status).toBe(200);
    expect(sendTemplate).toHaveBeenCalledTimes(1);
    expect(sendTemplate.mock.calls[0][0].template).toBe('gymdesk_owner_weekly_report');
    expect((await OwnerReport.findById(doc._id)).status).toBe('sent');
  });

  test('auto-send only when the owner switched it on, only 9:00 to 21:00 IST, and only once', async () => {
    const off = await gym();
    await runOwnerReports({ subscriberId: off.subscriber._id, now });
    expect(sendTemplate).not.toHaveBeenCalled();
    const on = await gym({ automations: { renewal: true, dues: true, absence: true, dailySummary: true, weeklyReport: true, monthlyReport: true, reportsAutoSend: true } });
    await runOwnerReports({ subscriberId: on.subscriber._id, now: new Date('2026-11-18T01:00:00Z') }); // 06:30 IST, quiet hours
    expect(sendTemplate).not.toHaveBeenCalled();
    await runOwnerReports({ subscriberId: on.subscriber._id, now });
    await runOwnerReports({ subscriberId: on.subscriber._id, now });
    expect(sendTemplate.mock.calls.filter((c) => c[0].template === 'gymdesk_owner_weekly_report')).toHaveLength(1);
    expect(await Notification.countDocuments({ subscriberId: on.subscriber._id, type: 'owner_report_weekly' })).toBe(1);
  });

  test('a gym with the weekly report switched off, or a locked gym, gets nothing', async () => {
    const off = await gym({ automations: { renewal: true, dues: true, absence: true, dailySummary: true, weeklyReport: false, monthlyReport: true, reportsAutoSend: false } });
    await runOwnerReports({ subscriberId: off.subscriber._id, now });
    expect(await OwnerReport.countDocuments({ subscriberId: off.subscriber._id, period: 'weekly' })).toBe(0);
    expect(await OwnerReport.countDocuments({ subscriberId: off.subscriber._id, period: 'monthly' })).toBe(1);
    const locked = await createTenant({ subscriber: { whatsappEnabled: true, planKey: 'growth', paidUntil: new Date(now.getTime() - 30 * DAY) } });
    await runOwnerReports({ subscriberId: locked.subscriber._id, now });
    expect(await OwnerReport.countDocuments({ subscriberId: locked.subscriber._id })).toBe(0);
  });

  test('one gym cannot send or dismiss another gym report, and bad ids are not found', async () => {
    const a = await gym(); const b = await gym();
    await runOwnerReports({ subscriberId: a.subscriber._id, now });
    const doc = await OwnerReport.findOne({ subscriberId: a.subscriber._id, period: 'weekly' });
    expect((await request(app).post(`/api/admin/owner-reports/${doc._id}/send`).set(auth(b))).status).toBe(404);
    expect((await request(app).post(`/api/admin/owner-reports/${doc._id}/dismiss`).set(auth(b))).status).toBe(404);
    expect((await request(app).post('/api/admin/owner-reports/not-an-id/send').set(auth(b))).status).toBe(404);
    expect((await OwnerReport.findById(doc._id)).status).toBe('ready');
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  test('send needs WhatsApp turned on; dismiss hides a ready report', async () => {
    const t = await createTenant({ subscriber: { whatsappEnabled: false, planKey: 'growth', paidUntil: new Date(Date.now() + 30 * DAY) } });
    const list = await request(app).get('/api/admin/owner-reports').set(auth(t));
    expect(list.status).toBe(200); expect(list.body.data.weekly.text).toMatch(/Weekly report for/); expect(list.body.data.settings.whatsappEnabled).toBe(false);
    expect((await request(app).post(`/api/admin/owner-reports/${list.body.data.weekly.id}/send`).set(auth(t))).status).toBe(400);
    expect((await request(app).post(`/api/admin/owner-reports/${list.body.data.weekly.id}/dismiss`).set(auth(t))).status).toBe(200);
    expect((await OwnerReport.findById(list.body.data.weekly.id)).status).toBe('dismissed');
  });
});
