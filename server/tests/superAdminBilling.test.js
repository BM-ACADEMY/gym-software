const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createRootAdmin } = require('./helpers/factories');
const Subscriber = require('../models/Subscriber');
const AuditLog = require('../models/AuditLog');

const day = 86400000;

describe('super admin subscription overview, extend and reminders', () => {
  let root;
  beforeAll(async () => {
    await db.connect();
    root = await createRootAdmin();
    process.env.INTERNAL_API_KEY = 'k'.repeat(32);
  });
  afterAll(async () => {
    delete process.env.INTERNAL_API_KEY;
    await db.clearDatabase();
    await db.closeDatabase();
  });
  const rootAuth = () => ({ Authorization: `Bearer ${root.token || root.rootToken || root.adminToken}` });

  test('overview counts statuses and computes MRR from plans', async () => {
    await createTenant({ subscriber: { trialEndsAt: new Date(Date.now() + 2 * day) } });
    await createTenant({ subscriber: { planKey: 'growth', billingCycle: 'monthly', paidUntil: new Date(Date.now() + 20 * day) } });
    await createTenant({ subscriber: { planKey: 'pro', billingCycle: 'yearly', paidUntil: new Date(Date.now() + 200 * day) } });
    await createTenant({ subscriber: { trialEndsAt: new Date(Date.now() - day) } });
    const res = await request(app).get('/api/root-admin/subscriptions/overview').set(rootAuth());
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.counts.trial).toBeGreaterThanOrEqual(1);
    expect(d.counts.expired).toBeGreaterThanOrEqual(1);
    expect(d.payingGyms).toBe(2);
    expect(d.mrr).toBe(999 + Math.round(19999 / 12));
    expect(d.trialsEndingSoon.length).toBeGreaterThanOrEqual(1);
  });

  test('gym owners cannot see the overview', async () => {
    const t = await createTenant();
    const res = await request(app).get('/api/root-admin/subscriptions/overview').set({ Authorization: `Bearer ${t.adminToken}` });
    expect(res.status).toBe(403);
  });

  test('extend needs a reason, adds days and writes an audit entry', async () => {
    const t = await createTenant({ subscriber: { trialEndsAt: new Date(Date.now() - day) } });
    const bad = await request(app).post(`/api/root-admin/subscriptions/${t.subscriber._id}/extend`).set(rootAuth()).send({ days: 7, reason: '' });
    expect(bad.status).toBe(400);
    const ok = await request(app).post(`/api/root-admin/subscriptions/${t.subscriber._id}/extend`).set(rootAuth()).send({ days: 7, reason: 'Demo run delayed' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('trial');
    const sub = await Subscriber.findById(t.subscriber._id);
    expect(sub.trialEndsAt.getTime()).toBeGreaterThan(Date.now() + 6 * day);
    expect(await AuditLog.countDocuments({ subscriberId: t.subscriber._id, module: 'subscription' })).toBe(1);
  });

  test('billing reminders need the internal key and list the right gyms', async () => {
    const t = await createTenant({ subscriber: { trialEndsAt: new Date(Date.now() + 1 * day - 1000) } });
    const none = await request(app).get('/api/internal/billing-reminders');
    expect(none.status).toBe(401);
    const wrong = await request(app).get('/api/internal/billing-reminders').set('x-internal-key', 'x'.repeat(32));
    expect(wrong.status).toBe(401);
    const res = await request(app).get('/api/internal/billing-reminders').set('x-internal-key', 'k'.repeat(32));
    expect(res.status).toBe(200);
    const mine = res.body.data.find((r) => String(r.subscriberId) === String(t.subscriber._id));
    expect(mine.kind).toBe('trial_ending');
    expect(mine.phone).toBeTruthy();
  });
});
