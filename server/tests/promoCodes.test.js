const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createRootAdmin } = require('./helpers/factories');
const PromoCode = require('../models/PromoCode');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const M = require('../services/billingMath');
const billing = require('../services/subscriptionBilling');

const auth = (t) => ({ Authorization: `Bearer ${t.adminToken}` });

describe('billingMath discount', () => {
  test('percent comes off before GST', () => {
    const q = M.quote({ plan: 'growth', cycle: 'monthly', discountPercent: 20 });
    expect(q.discount).toBe(199);
    expect(q.taxable).toBe(800);
    expect(q.gst).toBe(144);
    expect(q.total).toBe(944);
  });
  test('no discount keeps old numbers', () => {
    expect(M.quote({ plan: 'growth', cycle: 'monthly' }).total).toBe(1179);
  });
});

describe('promo codes at checkout', () => {
  let root;
  beforeAll(async () => { await db.connect(); root = await createRootAdmin(); });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });
  const rootAuth = () => ({ Authorization: `Bearer ${root.token || root.rootToken || root.adminToken}` });

  test('root admin creates a code; gym owners cannot', async () => {
    const t = await createTenant();
    const denied = await request(app).post('/api/root-admin/promo-codes').set(auth(t)).send({ code: 'NOPE10', percentOff: 10 });
    expect([401, 403]).toContain(denied.status);
    const ok = await request(app).post('/api/root-admin/promo-codes').set(rootAuth()).send({ code: 'partner20', kind: 'partner', ownerLabel: 'Coach Ravi', percentOff: 20, maxRedemptions: 2 });
    expect(ok.status).toBe(201);
    expect(ok.body.data.code).toBe('PARTNER20');
    const tooBig = await request(app).post('/api/root-admin/promo-codes').set(rootAuth()).send({ code: 'HUGE', percentOff: 90 });
    expect(tooBig.status).toBe(400);
  });

  test('code lowers the invoice, is counted once, and cannot be reused after a first payment', async () => {
    const t = await createTenant({ subscriber: { state: 'Puducherry', trialEndsAt: new Date(Date.now() + 86400000) } });
    const q = await request(app).post('/api/admin/subscription/quote').set(auth(t)).send({ plan: 'growth', cycle: 'monthly', promoCode: 'partner20' });
    expect(q.status).toBe(200);
    expect(q.body.data.quote.total).toBe(944);

    const co = await request(app).post('/api/admin/subscription/checkout').set(auth(t)).send({ plan: 'growth', cycle: 'monthly', promoCode: 'PARTNER20' });
    expect(co.status).toBe(201);
    expect(co.body.data.amount).toBe(944);
    await Promise.all([
      billing.activate({ orderId: co.body.data.orderId, paymentId: 'pay_p1' }),
      billing.activate({ orderId: co.body.data.orderId, paymentId: 'pay_p1' }),
    ]);
    expect((await PromoCode.findOne({ code: 'PARTNER20' })).redeemedCount).toBe(1);
    const p = await SubscriptionPayment.findOne({ razorpayOrderId: co.body.data.orderId });
    expect(p.discount).toBe(199);

    const again = await request(app).post('/api/admin/subscription/quote').set(auth(t)).send({ plan: 'growth', cycle: 'monthly', promoCode: 'PARTNER20' });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('bad_promo');
  });

  test('unknown, expired, inactive and exhausted codes are refused', async () => {
    await PromoCode.create({ code: 'OLD10', percentOff: 10, expiresAt: new Date(Date.now() - 1000) });
    await PromoCode.create({ code: 'OFF10', percentOff: 10, isActive: false });
    await PromoCode.create({ code: 'FULL10', percentOff: 10, maxRedemptions: 1, redeemedCount: 1 });
    const t = await createTenant({ subscriber: { state: 'Puducherry', trialEndsAt: new Date(Date.now() + 86400000) } });
    for (const code of ['NOSUCH', 'OLD10', 'OFF10', 'FULL10', '$ne']) {
      const r = await request(app).post('/api/admin/subscription/quote').set(auth(t)).send({ plan: 'growth', cycle: 'monthly', promoCode: code });
      expect(r.status).toBe(400);
    }
  });

  test('a code limited to other plans is refused', async () => {
    await PromoCode.create({ code: 'PROONLY', percentOff: 10, planKeys: ['pro'] });
    const t = await createTenant({ subscriber: { state: 'Puducherry', trialEndsAt: new Date(Date.now() + 86400000) } });
    const r = await request(app).post('/api/admin/subscription/quote').set(auth(t)).send({ plan: 'growth', cycle: 'monthly', promoCode: 'PROONLY' });
    expect(r.status).toBe(400);
  });
});
