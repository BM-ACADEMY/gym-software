const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant } = require('./helpers/factories');
const Subscriber = require('../models/Subscriber');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const billing = require('../services/subscriptionBilling');

const auth = (t) => ({ Authorization: `Bearer ${t.adminToken}` });
const sign = (raw, secret) => crypto.createHmac('sha256', secret).update(raw).digest('hex');

// Uses the dummy gateway (no Razorpay keys in the test database), which has the
// same order/activate path the real gateway uses.
describe('subscription billing flow', () => {
  beforeAll(async () => {
    await db.connect();
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
  });
  afterAll(async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    await db.clearDatabase();
    await db.closeDatabase();
  });

  test('trial gym pays for Growth monthly: invoice, paid-until and plan are set', async () => {
    const t = await createTenant({ subscriber: { state: 'Puducherry', trialEndsAt: new Date(Date.now() + 3 * 86400000) } });
    const co = await request(app).post('/api/admin/subscription/checkout').set(auth(t)).send({ plan: 'growth', cycle: 'monthly' });
    expect(co.status).toBe(201);
    expect(co.body.data.amount).toBe(1179);

    const paid = await request(app).post('/api/admin/subscription/simulate').set(auth(t)).send({ orderId: co.body.data.orderId });
    expect(paid.status).toBe(200);
    expect(paid.body.data.status).toBe('paid');
    expect(paid.body.data.invoiceNo).toMatch(/^AV\/\d{4}-\d{2}\/0001$/);

    const sub = await Subscriber.findById(t.subscriber._id);
    expect(sub.planKey).toBe('growth');
    expect(sub.paidUntil.getTime()).toBeGreaterThan(Date.now() + 27 * 86400000);

    const status = await request(app).get('/api/admin/subscription').set(auth(t));
    expect(status.body.data.status).toBe('active');
  });

  test('paying the same order twice does not extend twice or burn a second invoice number', async () => {
    const t = await createTenant({ subscriber: { state: 'Puducherry', trialEndsAt: new Date(Date.now() + 86400000) } });
    const co = await request(app).post('/api/admin/subscription/checkout').set(auth(t)).send({ plan: 'starter', cycle: 'monthly' });
    await Promise.all([
      billing.activate({ orderId: co.body.data.orderId, paymentId: 'pay_1' }),
      billing.activate({ orderId: co.body.data.orderId, paymentId: 'pay_1' }),
    ]);
    const rows = await SubscriptionPayment.find({ razorpayOrderId: co.body.data.orderId });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('paid');
    const first = rows[0].invoiceNo;
    await billing.activate({ orderId: co.body.data.orderId, paymentId: 'pay_1' });
    const again = await SubscriptionPayment.findOne({ razorpayOrderId: co.body.data.orderId });
    expect(again.invoiceNo).toBe(first);
    expect(again.periodEnd.getTime()).toBe(rows[0].periodEnd.getTime());
  });

  test('renewing early extends from the old end date', async () => {
    const end = new Date(Date.now() + 10 * 86400000);
    const t = await createTenant({ subscriber: { state: 'Puducherry', planKey: 'growth', billingCycle: 'monthly', paidUntil: end } });
    const co = await request(app).post('/api/admin/subscription/checkout').set(auth(t)).send({ plan: 'growth', cycle: 'monthly' });
    const p = await billing.activate({ orderId: co.body.data.orderId, paymentId: 'pay_2' });
    expect(p.periodStart.getTime()).toBe(end.getTime());
  });

  test('downgrade while paid is refused; upgrade gets credit', async () => {
    const t = await createTenant({ subscriber: { state: 'Puducherry', planKey: 'pro', billingCycle: 'monthly', paidUntil: new Date(Date.now() + 15 * 86400000) } });
    const down = await request(app).post('/api/admin/subscription/quote').set(auth(t)).send({ plan: 'starter', cycle: 'monthly' });
    expect(down.status).toBe(400);
    expect(down.body.code).toBe('downgrade_later');

    const t2 = await createTenant({ subscriber: { state: 'Puducherry', planKey: 'starter', billingCycle: 'monthly', paidUntil: new Date(Date.now() + 15 * 86400000) } });
    const up = await request(app).post('/api/admin/subscription/quote').set(auth(t2)).send({ plan: 'pro', cycle: 'monthly' });
    expect(up.status).toBe(200);
    expect(up.body.data.quote.credit).toBeGreaterThan(200);
  });

  test('webhook: bad signature is rejected, good one activates once, wrong amount fails the order', async () => {
    const t = await createTenant({ subscriber: { state: 'Puducherry', trialEndsAt: new Date(Date.now() + 86400000) } });
    const co = await request(app).post('/api/admin/subscription/checkout').set(auth(t)).send({ plan: 'growth', cycle: 'monthly' });
    const body = (amountPaise) => JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_w1', order_id: co.body.data.orderId, amount: amountPaise } } } });

    const bad = await request(app).post('/api/payments/razorpay-webhook').set('Content-Type', 'application/json').set('X-Razorpay-Signature', 'nope').send(body(117900));
    expect(bad.status).toBe(401);

    const wrong = body(100);
    const mismatch = await request(app).post('/api/payments/razorpay-webhook').set('Content-Type', 'application/json').set('X-Razorpay-Signature', sign(wrong, 'whsec_test')).send(wrong);
    expect(mismatch.status).toBe(200);
    expect((await SubscriptionPayment.findOne({ razorpayOrderId: co.body.data.orderId })).status).toBe('failed');

    const t2 = await createTenant({ subscriber: { state: 'Puducherry', trialEndsAt: new Date(Date.now() + 86400000) } });
    const co2 = await request(app).post('/api/admin/subscription/checkout').set(auth(t2)).send({ plan: 'growth', cycle: 'monthly' });
    const ok = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_w2', order_id: co2.body.data.orderId, amount: 117900 } } } });
    for (let i = 0; i < 2; i++) {
      const r = await request(app).post('/api/payments/razorpay-webhook').set('Content-Type', 'application/json').set('X-Razorpay-Signature', sign(ok, 'whsec_test')).send(ok);
      expect(r.status).toBe(200);
    }
    const rows = await SubscriptionPayment.find({ razorpayOrderId: co2.body.data.orderId });
    expect(rows[0].status).toBe('paid');
    expect(rows[0].invoiceNo).toBeTruthy();
  });

  test('invoice PDF downloads for the owner only', async () => {
    const t = await createTenant({ subscriber: { state: 'Puducherry', trialEndsAt: new Date(Date.now() + 86400000) } });
    const co = await request(app).post('/api/admin/subscription/checkout').set(auth(t)).send({ plan: 'pro', cycle: 'yearly' });
    const p = await billing.activate({ orderId: co.body.data.orderId, paymentId: 'pay_3' });
    const pdf = await request(app).get(`/api/admin/subscription/payments/${p._id}/invoice`).set(auth(t));
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toMatch(/pdf/);

    const other = await createTenant();
    const denied = await request(app).get(`/api/admin/subscription/payments/${p._id}/invoice`).set(auth(other));
    expect(denied.status).toBe(404);
  });

  test('GST: Puducherry gym gets CGST+SGST, other states get IGST, missing state is refused', async () => {
    const pondy = await createTenant({ subscriber: { state: 'Puducherry', trialEndsAt: new Date(Date.now() + 86400000) } });
    const q1 = await request(app).post('/api/admin/subscription/quote').set(auth(pondy)).send({ plan: 'growth', cycle: 'monthly' });
    expect(q1.body.data.quote.cgst).toBe(90);
    expect(q1.body.data.quote.igst).toBe(0);

    const tn = await createTenant({ subscriber: { state: 'Tamil Nadu', trialEndsAt: new Date(Date.now() + 86400000) } });
    const q2 = await request(app).post('/api/admin/subscription/quote').set(auth(tn)).send({ plan: 'growth', cycle: 'monthly' });
    expect(q2.body.data.quote.igst).toBe(180);
    expect(q2.body.data.quote.cgst).toBe(0);
    expect(q2.body.data.quote.total).toBe(1179);

    const none = await createTenant({ subscriber: { trialEndsAt: new Date(Date.now() + 86400000) } });
    const q3 = await request(app).post('/api/admin/subscription/quote').set(auth(none)).send({ plan: 'growth', cycle: 'monthly' });
    expect(q3.status).toBe(400);
    expect(q3.body.code).toBe('state_required');
    const saved = await request(app).patch('/api/admin/subscription/billing-details').set(auth(none)).send({ state: 'Kerala' });
    expect(saved.status).toBe(200);
    const q4 = await request(app).post('/api/admin/subscription/quote').set(auth(none)).send({ plan: 'growth', cycle: 'monthly' });
    expect(q4.body.data.quote.igst).toBe(180);
  });

  test('a gym over the plan member limit cannot buy the smaller plan', async () => {
    const { createMember } = require('./helpers/factories');
    const t = await createTenant({ subscriber: { state: 'Puducherry', trialEndsAt: new Date(Date.now() + 86400000) } });
    for (let i = 0; i < 151; i++) await createMember(t.subscriber);
    const r = await request(app).post('/api/admin/subscription/quote').set(auth(t)).send({ plan: 'starter', cycle: 'monthly' });
    expect(r.status).toBe(402);
    expect(r.body.code).toBe('plan_limit');
  });

  test('a failed attempt does not kill the order: a retry on the same order still activates', async () => {
    const t = await createTenant({ subscriber: { state: 'Puducherry', trialEndsAt: new Date(Date.now() + 86400000) } });
    const co = await request(app).post('/api/admin/subscription/checkout').set(auth(t)).send({ plan: 'growth', cycle: 'monthly' });
    const orderId = co.body.data.orderId;
    const failed = JSON.stringify({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_f1', order_id: orderId, amount: 117900, error_description: 'bank declined' } } } });
    await request(app).post('/api/payments/razorpay-webhook').set('Content-Type', 'application/json').set('X-Razorpay-Signature', sign(failed, 'whsec_test')).send(failed);
    expect((await SubscriptionPayment.findOne({ razorpayOrderId: orderId })).status).toBe('created');
    const ok = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_f2', order_id: orderId, amount: 117900 } } } });
    await request(app).post('/api/payments/razorpay-webhook').set('Content-Type', 'application/json').set('X-Razorpay-Signature', sign(ok, 'whsec_test')).send(ok);
    const p = await SubscriptionPayment.findOne({ razorpayOrderId: orderId });
    expect(p.status).toBe('paid');
    expect(p.appliedAt).toBeTruthy();
    expect((await Subscriber.findById(t.subscriber._id)).planKey).toBe('growth');
  });

  test('upgrade that ends before the old paid-until still switches the plan', async () => {
    const t = await createTenant({ subscriber: { state: 'Puducherry', planKey: 'starter', billingCycle: 'yearly', planStartedAt: new Date(), paidUntil: new Date(Date.now() + 300 * 86400000) } });
    const co = await request(app).post('/api/admin/subscription/checkout').set(auth(t)).send({ plan: 'growth', cycle: 'monthly' });
    expect(co.status).toBe(201);
    const p = await billing.activate({ orderId: co.body.data.orderId, paymentId: 'pay_up1' });
    expect(p.status).toBe('paid');
    const sub = await Subscriber.findById(t.subscriber._id);
    expect(sub.planKey).toBe('growth');
    expect(sub.billingCycle).toBe('monthly');
    expect(sub.paidUntil.getTime()).toBe(p.periodEnd.getTime());
  });
});
