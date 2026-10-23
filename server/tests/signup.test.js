const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant } = require('./helpers/factories');
const Subscriber = require('../models/Subscriber');
const Admin = require('../models/Admin');
const { generateToken } = require('../utils/jwt');

const body = (o = {}) => ({ gymName: 'Iron House', ownerName: 'Ravi', email: 'ravi@example.com', phone: '9876543210', password: 'strongpass1', ...o });

describe('self-serve sign-up and subscription', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });

  test('creates a gym on a 14 day trial and lets the owner log in with email', async () => {
    const res = await request(app).post('/api/auth/signup').send(body());
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.trialDays).toBe(14);
    const sub = await Subscriber.findById(res.body.data.subscriberId);
    const days = (sub.trialEndsAt - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThanOrEqual(14);
    const login = await request(app).post('/api/auth/login-email').send({ email: 'ravi@example.com', password: 'strongpass1' });
    expect(login.status).toBe(200);
  });

  test('rejects duplicates, weak passwords and operator objects', async () => {
    expect((await request(app).post('/api/auth/signup').send(body())).status).toBe(409);
    expect((await request(app).post('/api/auth/signup').send(body({ email: 'a@b.com', phone: '9000000001', password: 'short' }))).status).toBe(400);
    expect((await request(app).post('/api/auth/signup').send(body({ email: { $ne: null } }))).status).toBe(400);
  });

  test('subscription endpoint shows trial, usage and prices', async () => {
    const t = await createTenant({ subscriber: { trialEndsAt: new Date(Date.now() + 5 * 86400000) } });
    const res = await request(app).get('/api/admin/subscription').set('Authorization', `Bearer ${t.adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('trial');
    expect(res.body.data.currentPlan.key).toBe('growth');
    expect(res.body.data.plans).toHaveLength(3);
    expect(res.body.data.plans[1].monthly.total).toBe(1179);
  });

  test('an expired gym can still read its subscription but cannot write', async () => {
    const t = await createTenant({ subscriber: { planKey: 'growth', paidUntil: new Date(Date.now() - 10 * 86400000) } });
    const read = await request(app).get('/api/admin/subscription').set('Authorization', `Bearer ${t.adminToken}`);
    expect(read.body.data.status).toBe('expired');
    const write = await request(app).post('/api/admin/members').set('Authorization', `Bearer ${t.adminToken}`).send({ name: 'X', phone: '9111111111' });
    expect(write.status).toBe(403);
    expect(write.body.subscriptionStatus).toBe('expired');
  });

  test('starter plan blocks AI plans, growth allows them', async () => {
    const starter = await createTenant({ subscriber: { planKey: 'starter', paidUntil: new Date(Date.now() + 20 * 86400000) } });
    const blocked = await request(app).get('/api/admin/ai-plans').set('Authorization', `Bearer ${starter.adminToken}`);
    expect(blocked.status).toBe(403);
    const growth = await createTenant({ subscriber: { planKey: 'growth', paidUntil: new Date(Date.now() + 20 * 86400000) } });
    const ok = await request(app).get('/api/admin/ai-plans').set('Authorization', `Bearer ${growth.adminToken}`);
    expect(ok.status).not.toBe(403);
  });
});
