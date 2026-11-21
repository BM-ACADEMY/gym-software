const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createMember } = require('./helpers/factories');
const Subscriber = require('../models/Subscriber');
const PlatformPlan = require('../models/PlatformPlan');
const { _resetRateLimits } = require('../middleware/security');
const { escapeRegex } = require('../utils/escapeRegex');
const { generateOtp } = require('../utils/otp');

// Regression tests for the pilot-launch security fixes (SEC / PAY / PLAT
// areas of the QA workbook). They flip NODE_ENV to "production" inside the
// individual tests that need it and always restore it afterwards.
describe('Pilot launch security fixes', () => {
  let gym, member;
  const originalEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    await db.connect();
    gym = await createTenant({ gymName: 'Pilot Gym' });
    member = await createMember(gym.subscriber);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    delete process.env.RATE_LIMIT_IN_TESTS;
    delete process.env.BULKSMS_API_URL;
    _resetRateLimits();
  });

  afterAll(async () => {
    await db.clearDatabase();
    await db.closeDatabase();
  });

  describe('input validation', () => {
    test('login with a NoSQL operator object is rejected (login-phone)', async () => {
      const res = await request(app).post('/api/auth/login-phone').send({ phone: { $ne: null }, password: 'x' });
      expect(res.status).toBe(400);
    });

    test('login with a NoSQL operator object is rejected (root admin)', async () => {
      const res = await request(app).post('/api/auth/login-root').send({ email: { $ne: null }, password: 'x' });
      expect(res.status).toBe(400);
    });

    test('non-string password is rejected', async () => {
      const res = await request(app).post('/api/auth/login-phone').send({ phone: '9999999999', password: { a: 1 } });
      expect(res.status).toBe(400);
    });

    test('member search treats regex characters literally', async () => {
      const res = await request(app).get('/api/admin/members').query({ search: '.*' }).set('Authorization', `Bearer ${gym.adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.members.length).toBe(0);
    });

    test('escapeRegex escapes special characters', () => {
      expect(escapeRegex('a.b*c')).toBe('a\\.b\\*c');
    });
  });

  describe('rate limiting', () => {
    test('9th wrong login for the same phone is blocked with 429', async () => {
      process.env.RATE_LIMIT_IN_TESTS = '1';
      let last;
      for (let i = 0; i < 9; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        last = await request(app).post('/api/auth/login-phone').send({ phone: '9000000001', password: 'wrong' });
      }
      expect(last.status).toBe(429);
      expect(last.headers['retry-after']).toBeDefined();
    });
  });

  describe('OTP', () => {
    test('OTPs are 6 digits', () => {
      for (let i = 0; i < 50; i += 1) expect(generateOtp()).toMatch(/^\d{6}$/);
    });

    test('in production an OTP request never returns demoOtp and fails when SMS is not configured', async () => {
      const phone = gym.admin.phone;
      process.env.NODE_ENV = 'production';
      const res = await request(app).post('/api/auth/request-otp').send({ phone });
      expect(res.body.demoOtp).toBeUndefined();
      expect(res.status).toBe(500);
    });

    test('public sign-up is closed in production unless PUBLIC_SIGNUP=true', async () => {
      process.env.NODE_ENV = 'production';
      const res = await request(app).post('/api/auth/register-otp-request').send({ type: 'phone', identifier: '9111111111', gymName: 'X', ownerName: 'Y' });
      expect(res.status).toBe(403);
    });
  });

  describe('payments', () => {
    test('the member self-pay route no longer exists', async () => {
      const res = await request(app)
        .post('/api/member/payments/000000000000000000000000/pay')
        .set('Authorization', `Bearer ${member.token}`)
        .send({ amount: 100, method: 'upi' });
      expect(res.status).toBe(404);
    });

    test('simulate-payment is not available in production (member)', async () => {
      process.env.NODE_ENV = 'production';
      const res = await request(app)
        .post('/api/member/payments/000000000000000000000000/simulate-payment')
        .set('Authorization', `Bearer ${member.token}`)
        .send({});
      expect(res.status).toBe(404);
    });

    test('simulate-payment is not available in production (gym owner)', async () => {
      process.env.NODE_ENV = 'production';
      const res = await request(app)
        .post('/api/admin/billing/invoices/000000000000000000000000/simulate-payment')
        .set('Authorization', `Bearer ${gym.adminToken}`)
        .send({});
      expect(res.status).toBe(404);
    });

    test('a webhook is rejected in production when no gateway secret is configured', async () => {
      process.env.NODE_ENV = 'production';
      const res = await request(app).post('/api/payments/webhook').send({ eventId: 'evt_x', orderId: 'order_x', status: 'paid', amount: 1, signature: 'abc' });
      expect([401, 503]).toContain(res.status);
      expect(res.status).not.toBe(200);
    });
  });

  describe('plan limits and trial lock', () => {
    test('member creation is blocked at the plan member limit', async () => {
      const tenant = await createTenant({ gymName: 'Limited Gym' });
      const plan = await PlatformPlan.create({ name: 'Tiny', price: 1, memberLimit: 1 });
      await Subscriber.findByIdAndUpdate(tenant.subscriber._id, { platformPlanId: plan._id });
      await createMember(tenant.subscriber);

      const res = await request(app).post('/api/admin/members').set('Authorization', `Bearer ${tenant.adminToken}`).send({ name: 'One Too Many' });
      expect(res.status).toBe(403);
      expect(res.body.limitReached).toBe(true);
    });

    test('a gym with no plan limit can still add members', async () => {
      const tenant = await createTenant({ gymName: 'Unlimited Gym' });
      const res = await request(app).post('/api/admin/members').set('Authorization', `Bearer ${tenant.adminToken}`).send({ name: 'Fine Member' });
      expect(res.status).toBe(201);
    });

    test('an expired trial makes the gym read-only', async () => {
      const tenant = await createTenant({ gymName: 'Expired Trial Gym', subscriber: { trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
      const write = await request(app).post('/api/admin/members').set('Authorization', `Bearer ${tenant.adminToken}`).send({ name: 'Blocked' });
      expect(write.status).toBe(403);
      expect(write.body.trialExpired).toBe(true);
      const read = await request(app).get('/api/admin/members').set('Authorization', `Bearer ${tenant.adminToken}`);
      expect(read.status).toBe(200);
    });
  });
});
