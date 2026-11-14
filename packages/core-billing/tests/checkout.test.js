// Pure tests for the shared checkout (no database): signatures, raw body capture, refund counting, renewal wording, router rules.
const crypto = require('crypto');
const { makeGateway, rawBodyCapture, recordRefund, renewalSuggestion, createCheckoutRouter, createWebhookRouter } = require('../src/checkout');
const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
const gw = makeGateway({ mongoose: { models: {}, model: () => ({}), Schema: function () {} }, env: {} });

describe('where the gateway keys come from', () => {
  const withDoc = (doc, env) => makeGateway({ mongoose: { models: { SystemSettings: { findOne: () => ({ lean: async () => doc }) } } }, env });
  test('nothing saved and no env keys: not configured', async () => { expect(await withDoc(null, {}).isConfigured()).toBe(false); });
  test('env keys are used when the product database has none', async () => {
    const g = withDoc(null, { RAZORPAY_KEY_ID: 'rzp_test_abc', RAZORPAY_KEY_SECRET: 'sec' });
    expect(await g.isConfigured()).toBe(true); expect(await g.getConfig()).toEqual({ provider: 'razorpay', keyId: 'rzp_test_abc', keySecret: 'sec' });
  });
  test('keys saved in the product database win over env keys', async () => {
    const g = withDoc({ value: { provider: 'razorpay', keyId: 'rzp_test_saved', keySecret: 's2' } }, { RAZORPAY_KEY_ID: 'rzp_test_abc', RAZORPAY_KEY_SECRET: 'sec' });
    expect((await g.getConfig()).keyId).toBe('rzp_test_saved');
  });
  test('half a key (id without secret) is not configured', async () => { expect(await withDoc(null, { RAZORPAY_KEY_ID: 'rzp_test_abc' }).isConfigured()).toBe(false); });
  test('the webhook secret still comes from env first', async () => { expect(await withDoc(null, { RAZORPAY_WEBHOOK_SECRET: 'wh' }).webhookSecret()).toBe('wh'); });
});

describe('signatures', () => {
  test('checkout signature: right secret passes, wrong secret and missing parts fail', () => {
    const sig = hmac('test_secret_x', 'order_1|pay_1');
    expect(gw.verifyCheckout({ orderId: 'order_1', paymentId: 'pay_1', signature: sig, keySecret: 'test_secret_x' })).toBe(true);
    expect(gw.verifyCheckout({ orderId: 'order_1', paymentId: 'pay_1', signature: sig, keySecret: 'other' })).toBe(false);
    expect(gw.verifyCheckout({ orderId: 'order_2', paymentId: 'pay_1', signature: sig, keySecret: 'test_secret_x' })).toBe(false);
    expect(gw.verifyCheckout({ orderId: 'order_1', paymentId: '', signature: sig, keySecret: 'test_secret_x' })).toBe(false);
    expect(gw.verifyCheckout({ orderId: 'order_1', paymentId: 'pay_1', signature: 'short', keySecret: 'test_secret_x' })).toBe(false);
  });
  test('webhook signature is over the raw bytes; no secret means refuse', () => {
    const raw = Buffer.from('{"event":"payment.captured"}');
    expect(gw.verifyWebhook(raw, hmac('whsec', raw), 'whsec')).toBe(true);
    expect(gw.verifyWebhook(Buffer.from('{"event":"payment.captured" }'), hmac('whsec', raw), 'whsec')).toBe(false);
    expect(gw.verifyWebhook(raw, hmac('whsec', raw), '')).toBe(false);
    expect(gw.verifyWebhook(raw, '', 'whsec')).toBe(false);
    expect(gw.verifyWebhook(undefined, 'x', 'whsec')).toBe(false);
  });
});

describe('raw body capture', () => {
  test('keeps bytes only for the webhook path', () => {
    const a = { originalUrl: '/api/salon/billing/webhook' }; rawBodyCapture(a, {}, Buffer.from('abc')); expect(a.rawBody.toString()).toBe('abc');
    const b = { originalUrl: '/api/salon/billing/order' }; rawBodyCapture(b, {}, Buffer.from('abc')); expect(b.rawBody).toBe(undefined);
  });
});

describe('refund counting', () => {
  const mk = (p) => ({ findOne: async () => p, updateOne: async (q, u) => { if (q.refundIds && p.refundIds.includes('rf_dup')) return { modifiedCount: 0 }; Object.assign(p, u.$set); (u.$push && p.refundIds.push(u.$push.refundIds)); return { modifiedCount: 1 }; } });
  test('partial then full refund; same refund id twice counts once', async () => {
    const p = { total: 1000, refundedAmount: 0, refundIds: [], status: 'paid' };
    const P = mk(p);
    const r1 = await recordRefund(P, { id: 'rf_1', payment_id: 'pay_1', amount: 40000 }); expect(r1.handled).toBe(true); expect(p.refundedAmount).toBe(400); expect(p.status).toBe('paid');
    const d = await recordRefund(P, { id: 'rf_1', payment_id: 'pay_1', amount: 40000 }); expect(d.duplicate).toBe(true); expect(p.refundedAmount).toBe(400);
    await recordRefund(P, { id: 'rf_2', payment_id: 'pay_1', amount: 60000 }); expect(p.status).toBe('refunded'); expect(p.refundedAmount).toBe(1000); expect(p.refundNeedsReview).toBe(true);
  });
  test('junk refund bodies are ignored', async () => {
    const P = mk({ total: 10, refundedAmount: 0, refundIds: [] });
    expect((await recordRefund(P, null)).ignored).toBe(true); expect((await recordRefund(P, { id: 'a', payment_id: 'b', amount: -5 })).ignored).toBe(true);
  });
});

describe('renewal wording (suggest only)', () => {
  test('quiet when far from the end, firm when over', () => {
    expect(renewalSuggestion({ status: 'active', daysLeft: 30 })).toBe(null);
    expect(renewalSuggestion({ status: 'active', daysLeft: 3 }).level).toBe('soon');
    expect(renewalSuggestion({ status: 'trial', daysLeft: 1 }).text).toContain('1 day.');
    expect(renewalSuggestion({ status: 'grace', daysLeft: 2 }).level).toBe('urgent');
    expect(renewalSuggestion({ status: 'expired' }).text).toContain('read-only');
    expect(renewalSuggestion(null)).toBe(null);
  });
});

// A tiny router stand-in: routes are recorded so a test can run a handler chain.
const fakeExpress = () => ({ Router: () => { const routes = []; const add = (m) => (p, ...h) => routes.push({ m, p, h }); return { routes, use() {}, get: add('GET'), post: add('POST'), put: add('PUT') }; } });
const run = async (router, m, p, req) => { const r = router.routes.find((x) => x.m === m && x.p === p); const out = { code: 200 }; const res = { status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; return res; } }; for (const h of r.h) { let n = false; await h(req, res, () => { n = true; }); if (!n) break; } return out; };

describe('routes', () => {
  const seen = []; const checkout = { startCheckout: async (t, p, c) => { seen.push(['order', t, p, c]); return { orderId: 'o' }; }, list: async (t) => { seen.push(['list', t]); return []; }, confirmCheckout: async () => { throw Object.assign(new Error('Invalid payment signature'), { status: 401 }); }, forInvoice: async () => null, plansView: async () => ({}), handleWebhook: async (raw, sig) => { seen.push(['hook', Boolean(raw), sig]); if (!sig) throw Object.assign(new Error('Invalid webhook signature'), { status: 401 }); return { handled: true }; } };
  const authorize = (...roles) => (req, res, next) => (roles.includes(req.user.role) ? next() : res.status(403).json({ success: false }));
  const router = createCheckoutRouter({ express: fakeExpress(), protect: (q, s, n) => n(), authorize, checkout, product: { key: 'salon', name: 'Groom' }, billing: { getPlan: () => null }, Tenant: {} });
  test('the business id always comes from the signed-in user, never from the body', async () => {
    await run(router, 'POST', '/order', { user: { tenantId: 'T1', role: 'admin' }, body: { plan: 'growth', cycle: 'monthly', tenantId: 'T2' } });
    expect(seen[0].join()).toBe('order,T1,growth,monthly');
    await run(router, 'GET', '/payments', { user: { tenantId: 'T1', role: 'admin' } }); expect(seen[1].join()).toBe('list,T1');
  });
  test('only the owner can pay or see invoices', async () => {
    expect((await run(router, 'POST', '/order', { user: { tenantId: 'T1', role: 'subadmin' }, body: {} })).code).toBe(403);
    expect((await run(router, 'GET', '/payments', { user: { tenantId: 'T1', role: 'subadmin' } })).code).toBe(403);
  });
  test('a bad payment signature gives 401, a bad invoice id gives 400', async () => {
    expect((await run(router, 'POST', '/confirm', { user: { tenantId: 'T1', role: 'admin' }, body: { orderId: 'o' } })).code).toBe(401);
    expect((await run(router, 'GET', '/invoice/:id', { user: { tenantId: 'T1', role: 'admin' }, params: { id: 'nope' } })).code).toBe(400);
  });
  test('webhook without a signature is refused with 401', async () => {
    const hook = createWebhookRouter({ express: fakeExpress(), checkout, product: { key: 'salon' } });
    expect((await run(hook, 'POST', '/', { rawBody: Buffer.from('{}'), headers: {} })).code).toBe(401);
    expect((await run(hook, 'POST', '/', { rawBody: Buffer.from('{}'), headers: { 'x-razorpay-signature': 'abc' } })).code).toBe(200);
  });
});
