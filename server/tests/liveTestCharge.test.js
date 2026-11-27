// RM-11: the one-time Rs 1 test price for one internal gym, used to prove the live Razorpay keys.
// Runs the same webhook path a real live payment and refund take (dummy gateway, signed webhooks).
const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createRootAdmin } = require('./helpers/factories');
const Subscriber = require('../models/Subscriber');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const SystemSettings = require('../models/SystemSettings');
const testCharge = require('../services/testCharge');

const auth = (t) => ({ Authorization: `Bearer ${t.adminToken}` });
const root = (r) => ({ Authorization: `Bearer ${r.token}` });
const sign = (raw) => crypto.createHmac('sha256', 'whsec_test').update(raw).digest('hex');
const hook = (raw) => request(app).post('/api/payments/razorpay-webhook').set('Content-Type', 'application/json').set('X-Razorpay-Signature', sign(raw)).send(raw);
const gym = () => createTenant({ subscriber: { state: 'Tamil Nadu', trialEndsAt: new Date(Date.now() + 86400000) } });

describe('RM-11 one-time Rs 1 test price', () => {
  let ra;
  beforeAll(async () => {
    await db.connect();
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
    ra = await createRootAdmin();
  });
  afterEach(async () => { await testCharge.clear(); });
  afterAll(async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    await db.clearDatabase();
    await db.closeDatabase();
  });

  test('pure helpers: active only for the named gym before it expires; Rs 1 total with no GST', () => {
    const now = new Date('2026-11-27T10:00:00Z');
    const c = { subscriberId: 'abc', expiresAt: '2026-11-27T10:30:00Z' };
    expect(testCharge.isActiveFor(c, 'abc', now)).toBe(true);
    expect(testCharge.isActiveFor(c, 'other', now)).toBe(false);
    expect(testCharge.isActiveFor(c, 'abc', new Date('2026-11-27T10:31:00Z'))).toBe(false);
    expect(testCharge.isActiveFor(null, 'abc', now)).toBe(false);
    const q = testCharge.quote('igst');
    expect(q).toMatchObject({ taxable: 1, gst: 0, igst: 0, total: 1, currency: 'INR', testCharge: true });
  });

  test('only Root Admin can turn it on; a gym owner cannot', async () => {
    const t = await gym();
    expect((await request(app).put('/api/root-admin/settings/test-charge').set(auth(t)).send({ subscriberId: String(t.subscriber._id) })).status).toBe(403);
    expect((await request(app).get('/api/root-admin/settings/test-charge')).status).toBe(401);
  });

  test('refused for a bad id or a gym with no state', async () => {
    expect((await request(app).put('/api/root-admin/settings/test-charge').set(root(ra)).send({ subscriberId: 'x' })).status).toBe(400);
    const noState = await createTenant();
    const r = await request(app).put('/api/root-admin/settings/test-charge').set(root(ra)).send({ subscriberId: String(noState.subscriber._id) });
    expect(r.status).toBe(400); expect(r.body.message).toMatch(/state/);
  });

  test('test gym pays Rs 1 for Solo monthly; another gym and other plans keep normal prices; used up after payment', async () => {
    const t = await gym();
    const other = await gym();
    const on = await request(app).put('/api/root-admin/settings/test-charge').set(root(ra)).send({ subscriberId: String(t.subscriber._id) });
    expect(on.status).toBe(200);
    expect((await request(app).get('/api/root-admin/settings/test-charge').set(root(ra))).body.data.subscriberId).toBe(String(t.subscriber._id));

    // The gym sees the banner data; the other gym does not.
    expect((await request(app).get('/api/admin/subscription').set(auth(t))).body.data.testCharge).toMatchObject({ amount: 1, plan: 'solo', cycle: 'monthly' });
    expect((await request(app).get('/api/admin/subscription').set(auth(other))).body.data.testCharge).toBeNull();

    // Other gym, same plan: full price. Test gym, other plan or cycle: full price.
    expect((await request(app).post('/api/admin/subscription/quote').set(auth(other)).send({ plan: 'solo', cycle: 'monthly' })).body.data.quote.total).toBe(294);
    expect((await request(app).post('/api/admin/subscription/quote').set(auth(t)).send({ plan: 'solo', cycle: 'yearly' })).body.data.quote.total).toBe(2938);
    expect((await request(app).post('/api/admin/subscription/quote').set(auth(t)).send({ plan: 'growth', cycle: 'monthly' })).body.data.quote.total).toBe(1179);

    const co = await request(app).post('/api/admin/subscription/checkout').set(auth(t)).send({ plan: 'solo', cycle: 'monthly' });
    expect(co.status).toBe(201); expect(co.body.data.amount).toBe(1);

    const cap = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_rs1', order_id: co.body.data.orderId, amount: 100 } } } });
    expect((await hook(cap)).status).toBe(200);
    const p = await SubscriptionPayment.findOne({ razorpayOrderId: co.body.data.orderId });
    expect(p).toMatchObject({ status: 'paid', total: 1, gst: 0, testCharge: true });
    expect(p.invoiceNo).toMatch(/^AV\//);
    expect((await Subscriber.findById(t.subscriber._id)).planKey).toBe('solo');

    // Used up: a second order is full price.
    expect(await SystemSettings.getSetting(testCharge.KEY, 'missing')).toBeNull();
    expect((await request(app).post('/api/admin/subscription/quote').set(auth(t)).send({ plan: 'solo', cycle: 'monthly' })).body.data.quote.total).toBe(294);

    // Full Rs 1 refund: the row stays in "Your payments", marked refunded, and its invoice PDF still opens.
    const rf = JSON.stringify({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_rs1', payment_id: 'pay_rs1', amount: 100 } } } });
    expect((await hook(rf)).status).toBe(200);
    const list = await request(app).get('/api/admin/subscription/payments').set(auth(t));
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ status: 'refunded', refundedAmount: 1 });
    const pdf = await request(app).get(`/api/admin/subscription/payments/${p._id}/invoice`).set(auth(t));
    expect(pdf.status).toBe(200);
    // Another gym cannot open it.
    expect((await request(app).get(`/api/admin/subscription/payments/${p._id}/invoice`).set(auth(other))).status).toBe(404);
  });

  test('an expired or cancelled test price is not used', async () => {
    const t = await gym();
    await SystemSettings.setSetting(testCharge.KEY, { subscriberId: String(t.subscriber._id), amount: 1, expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect((await request(app).post('/api/admin/subscription/quote').set(auth(t)).send({ plan: 'solo', cycle: 'monthly' })).body.data.quote.total).toBe(294);
    expect((await request(app).get('/api/root-admin/settings/test-charge').set(root(ra))).body.data).toBeNull();

    await request(app).put('/api/root-admin/settings/test-charge').set(root(ra)).send({ subscriberId: String(t.subscriber._id) });
    expect((await request(app).delete('/api/root-admin/settings/test-charge').set(root(ra))).status).toBe(200);
    expect((await request(app).post('/api/admin/subscription/quote').set(auth(t)).send({ plan: 'solo', cycle: 'monthly' })).body.data.quote.total).toBe(294);
  });
});
