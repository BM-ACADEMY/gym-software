// Real-database test (Dev A or CI, needs MONGODB_URI). Fake Razorpay keys and a fake order call: no money moves, no network.
const crypto = require('crypto');
const URI = process.env.MONGODB_URI;
const d = URI ? describe : describe.skip;
d('checkout against MongoDB', () => {
  const mongoose = URI ? require('mongoose') : null;
  const { makeBilling } = require('../src');
  const { makeGateway, makeCheckout } = require('../src/checkout');
  const { runWithTenant } = require('../../core-server/src');
  const plans = { starter: { key: 'starter', name: 'Starter', monthly: 149, yearly: 1490 }, growth: { key: 'growth', name: 'Growth', monthly: 299, yearly: 2990 } };
  const config = { plans, gstRate: 18, graceDays: 3, trialDays: 14, trialPlanKey: 'growth', ranks: { starter: 0, growth: 1 } };
  const billing = makeBilling(config); let checkout; let Tenant; let n = 0; const SECRET = 'fake_secret_for_tests'; const WH = 'fake_webhook_secret';
  const http = async () => ({ ok: true, json: async () => ({ id: `order_T${++n}` }) });
  beforeAll(async () => {
    await mongoose.connect(URI); await mongoose.connection.db.dropDatabase();
    await mongoose.connection.db.collection('systemsettings').insertOne({ key: 'payment_gateway', value: { provider: 'razorpay', keyId: 'rzp_test_fake', keySecret: SECRET, webhookSecret: WH } });
    Tenant = mongoose.model('CkTenant', new mongoose.Schema({ shopName: String, state: String, trialEndsAt: Date, paidUntil: Date, planKey: String, billingCycle: String, planStartedAt: Date, isActive: { type: Boolean, default: true } }));
    checkout = makeCheckout({ mongoose, billing, config, gateway: makeGateway({ mongoose, http, env: {} }), product: { key: 'ck', name: 'Check', invoicePrefix: 'CK' }, Tenant, nameOf: (t) => t.shopName, env: {} });
  });
  afterAll(async () => { await mongoose.disconnect(); });
  const mk = (name) => Tenant.create({ shopName: name, state: 'Puducherry', trialEndsAt: new Date(Date.now() + 5 * 864e5) });
  const sign = (o, p) => crypto.createHmac('sha256', SECRET).update(`${o}|${p}`).digest('hex');
  const hook = (body) => { const raw = Buffer.from(JSON.stringify(body)); return checkout.handleWebhook(raw, crypto.createHmac('sha256', WH).update(raw).digest('hex')); };

  test('pay, confirm twice and webhook: one invoice, one plan change', async () => {
    const t = await mk('A'); const id = String(t._id);
    const o = await runWithTenant(id, () => checkout.startCheckout(id, 'growth', 'monthly'));
    expect(o.amount).toBe(353); // 299 + 18%
    await runWithTenant(id, () => checkout.confirmCheckout(id, { orderId: o.orderId, paymentId: 'pay_A', signature: sign(o.orderId, 'pay_A') }));
    await runWithTenant(id, () => checkout.confirmCheckout(id, { orderId: o.orderId, paymentId: 'pay_A', signature: sign(o.orderId, 'pay_A') }));
    await hook({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_A', order_id: o.orderId, amount: 35300 } } } });
    const pays = await runWithTenant(id, () => checkout.list(id)); expect(pays.length).toBe(1); expect(pays[0].status).toBe('paid'); expect(pays[0].invoiceNo).toMatch(/^CK\/\d{4}-\d{2}\/0001$/);
    const after = await Tenant.findById(id); expect(after.planKey).toBe('growth'); expect(after.paidUntil.getTime()).toBeGreaterThan(Date.now());
  });
  test('wrong signature is refused and nothing changes', async () => {
    const t = await mk('B'); const id = String(t._id); const o = await runWithTenant(id, () => checkout.startCheckout(id, 'starter', 'monthly'));
    await expect(runWithTenant(id, () => checkout.confirmCheckout(id, { orderId: o.orderId, paymentId: 'pay_B', signature: 'bad' }))).rejects.toThrow('Invalid payment signature');
    expect((await Tenant.findById(id)).planKey).toBe(undefined);
  });
  test('webhook with a different amount marks failed and gives no plan', async () => {
    const t = await mk('C'); const id = String(t._id); const o = await runWithTenant(id, () => checkout.startCheckout(id, 'starter', 'monthly'));
    await hook({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_C', order_id: o.orderId, amount: 100 } } } });
    expect((await runWithTenant(id, () => checkout.list(id)))[0].status).toBe('failed'); expect((await Tenant.findById(id)).planKey).toBe(undefined);
  });
  test('another business cannot confirm or list my order; a bad webhook signature is refused', async () => {
    const a = await mk('D'); const b = await mk('E'); const ia = String(a._id); const ib = String(b._id);
    const o = await runWithTenant(ia, () => checkout.startCheckout(ia, 'starter', 'monthly'));
    await expect(runWithTenant(ib, () => checkout.confirmCheckout(ib, { orderId: o.orderId, paymentId: 'p', signature: sign(o.orderId, 'p') }))).rejects.toThrow('Order not found');
    expect((await runWithTenant(ib, () => checkout.list(ib))).length).toBe(0);
    await expect(checkout.handleWebhook(Buffer.from('{}'), 'nope')).rejects.toThrow('Invalid webhook signature');
  });
  test('a refund webhook counts once and does not end the plan by itself', async () => {
    const t = await mk('F'); const id = String(t._id); const o = await runWithTenant(id, () => checkout.startCheckout(id, 'starter', 'monthly'));
    await runWithTenant(id, () => checkout.confirmCheckout(id, { orderId: o.orderId, paymentId: 'pay_F', signature: sign(o.orderId, 'pay_F') }));
    const ev = { event: 'refund.processed', payload: { refund: { entity: { id: 'rf_F', payment_id: 'pay_F', amount: 17600 } } } };
    await hook(ev); await hook(ev);
    const p = (await runWithTenant(id, () => checkout.list(id)))[0]; expect(p.refundedAmount).toBe(176); expect(p.status).toBe('refunded'); expect((await Tenant.findById(id)).planKey).toBe('starter');
  });
});
