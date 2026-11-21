'use strict';
// Sign-up to payment to renewal for Salon, Mart, Dine, Cloth and Wash (the gym keeps its own copy in server/services).
// Same rules as the gym: Razorpay keys are read at run time from the settings the Super Admin saved (never from env or git);
// prices are whole rupees before GST; the browser confirmation and the webhook both call activate(), which is safe to run twice.
// Written 13 Nov, not yet tested by a person. Needs one real Razorpay test payment (Claude in Chrome or Dev A).
const crypto = require('crypto');
const { tenantPlugin, runUnscoped } = require('../../core-server/src');
const { addPeriod, fyOf, invoiceNumber, gstModeFor } = require('./index');

const fail = (status, message, code) => Object.assign(new Error(message), { status, code });
const DAY = 24 * 3600 * 1000;

// express.json({ verify }) hook: keeps the raw bytes of a webhook call, because the signature is over the raw body.
const rawBodyCapture = (req, res, buf) => { if (buf && buf.length && String(req.originalUrl || req.url || '').includes('/billing/webhook')) req.rawBody = Buffer.from(buf); };

// ---- gateway: keys come from this product's own settings (collection systemsettings, key payment_gateway) or, if none, from the server env file
function makeGateway({ mongoose, http, env = process.env }) {
  const Settings = () => mongoose.models.SystemSettings || mongoose.model('SystemSettings', new mongoose.Schema({ key: String, value: mongoose.Schema.Types.Mixed }, { strict: false, collection: 'systemsettings' }));
  // Keys saved by the Super Admin in this product's own database win. Each product has its own database (deploy/MONGO.md), so the gym's Root Admin
  // cannot reach it: the other products take RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET from their server env file instead (set with deploy/tools/set-razorpay-keys.sh).
  const fromEnv = () => (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET ? { provider: 'razorpay', keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET } : null);
  const getConfig = async () => { const d = await Settings().findOne({ key: 'payment_gateway' }).lean(); const saved = (d && d.value) || {}; return (saved.provider === 'razorpay' && saved.keyId && saved.keySecret) ? saved : (fromEnv() || saved); };
  const isConfigured = async () => { const c = await getConfig(); return c.provider === 'razorpay' && Boolean(c.keyId && c.keySecret); };
  const webhookSecret = async () => env.RAZORPAY_WEBHOOK_SECRET || (await getConfig()).webhookSecret || '';
  const createOrder = async ({ amount, receipt, notes }) => {
    const c = await getConfig();
    if (!(c.provider === 'razorpay' && c.keyId && c.keySecret)) throw fail(503, 'Online payment is not set up yet. Please contact support.', 'billing_not_configured');
    const send = http || globalThis.fetch;
    const res = await send('https://api.razorpay.com/v1/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(`${c.keyId}:${c.keySecret}`).toString('base64') }, body: JSON.stringify({ amount: Math.round(amount * 100), currency: 'INR', receipt, notes }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.id) throw fail(502, 'The payment service did not respond. Please try again in a minute.', 'payment_gateway');
    return { orderId: data.id, keyId: c.keyId };
  };
  const verifyCheckout = ({ orderId, paymentId, signature, keySecret }) => {
    if (!orderId || !paymentId || !signature || !keySecret) return false;
    const want = Buffer.from(crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex')); const got = Buffer.from(String(signature));
    return want.length === got.length && crypto.timingSafeEqual(want, got);
  };
  const verifyWebhook = (raw, signature, secret) => {
    if (!secret || !signature || !raw) return false;
    const want = Buffer.from(crypto.createHmac('sha256', secret).update(raw).digest('hex')); const got = Buffer.from(String(signature));
    return want.length === got.length && crypto.timingSafeEqual(want, got);
  };
  return { getConfig, isConfigured, webhookSecret, createOrder, verifyCheckout, verifyWebhook };
}

// ---- models (one payments collection for all products, scoped by tenantId like every other tenant record)
function makePaymentModels(mongoose) {
  const { Schema } = mongoose;
  if (mongoose.models.ProductPayment) return { Payment: mongoose.models.ProductPayment, Counter: mongoose.models.ProductInvoiceCounter };
  const castId = (v) => new mongoose.Types.ObjectId(String(v));
  const s = new Schema({
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true }, productKey: { type: String, required: true },
    planKey: { type: String, required: true }, cycle: { type: String, enum: ['monthly', 'yearly'], required: true }, startMode: { type: String, enum: ['now', 'extend'], default: 'now' },
    status: { type: String, enum: ['created', 'paid', 'failed', 'refunded'], default: 'created' },
    refundedAmount: { type: Number, default: 0 }, refundIds: { type: [String], default: [] }, refundedAt: Date, refundNeedsReview: { type: Boolean, default: false },
    base: Number, credit: { type: Number, default: 0 }, discount: { type: Number, default: 0 }, taxable: Number, gst: Number, cgst: { type: Number, default: 0 }, sgst: { type: Number, default: 0 }, igst: { type: Number, default: 0 },
    total: { type: Number, required: true }, gstMode: String, gstRate: Number, currency: { type: String, default: 'INR' },
    razorpayOrderId: { type: String, unique: true, sparse: true }, razorpayPaymentId: String, invoiceNo: { type: String, unique: true, sparse: true },
    appliedAt: Date, paidAt: Date, periodStart: Date, periodEnd: Date, note: String, buyerName: String, buyerGstin: String, buyerState: String,
  }, { timestamps: true });
  s.plugin(tenantPlugin, { field: 'tenantId', castId });
  const Payment = mongoose.model('ProductPayment', s);
  const Counter = mongoose.model('ProductInvoiceCounter', new Schema({ _id: String, seq: { type: Number, default: 0 } }));
  return { Payment, Counter };
}

// ---- a refund Razorpay has finished: counted once per refund id; a full refund marks the payment refunded; the plan is NOT ended automatically (a person decides)
async function recordRefund(Payments, refund) {
  if (!refund || !refund.id || !refund.payment_id || !Number.isFinite(refund.amount) || refund.amount <= 0) return { ignored: true };
  const rupees = Math.round(refund.amount / 100);
  const p = await Payments.findOne({ razorpayPaymentId: refund.payment_id });
  if (!p) return { ignored: true, reason: 'payment not found' };
  if (p.refundIds.includes(refund.id)) return { handled: true, duplicate: true, status: p.status };
  const total = Math.min(p.total, p.refundedAmount + rupees); const full = total >= p.total - 1;
  const r = await Payments.updateOne({ _id: p._id, refundIds: { $ne: refund.id } }, { $set: { refundedAmount: total, refundedAt: new Date(), refundNeedsReview: true, ...(full ? { status: 'refunded' } : {}) }, $push: { refundIds: refund.id } });
  return { handled: r.modifiedCount === 1, status: full ? 'refunded' : p.status, refundedAmount: total };
}

// Suggest only: the owner reads this on the Plan and payment screen. Nothing is sent.
function renewalSuggestion(status) {
  if (!status) return null;
  const n = status.daysLeft;
  if (status.status === 'trial') return n <= 5 ? { level: 'soon', text: `Your free trial ends in ${n} day${n === 1 ? '' : 's'}. Pick a plan to keep adding records.` } : null;
  if (status.status === 'active') return n <= 7 ? { level: 'soon', text: `Your plan ends in ${n} day${n === 1 ? '' : 's'}. Renew now so nothing stops.` } : null;
  if (status.status === 'grace') return { level: 'urgent', text: `Your plan has ended. You have ${n} more day${n === 1 ? '' : 's'} before the account becomes read-only.` };
  if (status.status === 'expired') return { level: 'urgent', text: 'Your plan has ended, so the account is read-only. Your data is safe. Renew to make changes again.' };
  if (status.status === 'suspended') return { level: 'urgent', text: 'This account is suspended. Please contact support.' };
  return null;
}

// ---- the service: product = { key, name, invoicePrefix }, Tenant = the product's business model (not tenant-scoped)
function makeCheckout({ mongoose, billing, config, gateway, product, Tenant, nameOf, gstinOf, env = process.env, now = () => new Date() }) {
  const gstRate = config.gstRate;
  const { Payment, Counter } = makePaymentModels(mongoose);
  const sellerState = () => env.SELLER_STATE || 'Puducherry';

  const buildQuote = async (tenantId, planKey, cycle, at = now()) => {
    const plan = billing.getPlan(planKey);
    if (!plan || !billing.CYCLES[cycle]) throw fail(400, 'Choose a plan and monthly or yearly billing', 'bad_plan');
    const t = await Tenant.findById(tenantId); if (!t) throw fail(404, 'Business not found');
    const status = billing.computeStatus(t, at);
    const rule = billing.purchaseRule({ status, currentPlan: t.planKey, currentCycle: t.billingCycle, paidUntil: t.paidUntil, newPlan: planKey, now: at });
    if (rule.blocked) throw fail(400, rule.blocked, rule.code);
    if (!t.state) throw fail(400, 'Please select your state first. It decides how GST is shown on your invoice.', 'state_required');
    const quote = billing.quote({ plan: planKey, cycle, creditRupees: rule.creditRupees, gstMode: gstModeFor(t.state, sellerState()) });
    return { tenant: t, rule, quote, plan };
  };

  const plansView = async (tenant) => {
    const status = billing.computeStatus(tenant, now()); const mode = tenant.state ? gstModeFor(tenant.state, sellerState()) : 'cgst_sgst';
    const price = (plan, cycle) => { const q = billing.quote({ plan, cycle, gstMode: mode }); return { base: q.base, gst: q.gst, total: q.total, currency: 'INR' }; };
    const plans = Object.values(config.plans || {});
    return {
      status: { status: status.status, planKey: status.planKey || null, daysLeft: status.daysLeft == null ? null : status.daysLeft, endsAt: status.endsAt || null, readOnly: status.readOnly },
      gstRate, currency: 'INR', pricesExcludeGst: true, stateRequired: !tenant.state, paymentReady: await gateway.isConfigured(),
      plans: plans.map((p) => ({ key: p.key, name: p.name, monthly: price(p.key, 'monthly'), yearly: price(p.key, 'yearly') })),
      suggestion: renewalSuggestion(status),
    };
  };

  const startCheckout = async (tenantId, planKey, cycle) => {
    if (!(await gateway.isConfigured())) throw fail(503, 'Online payment is not set up yet. Please contact support.', 'billing_not_configured');
    const { tenant, rule, quote } = await buildQuote(tenantId, planKey, cycle);
    if (quote.total < 1) throw fail(400, 'This amount is too small to charge.');
    const order = await gateway.createOrder({ amount: quote.total, receipt: `${product.key}_${Date.now().toString(36)}`, notes: { product: product.key, tenantId: String(tenantId), plan: planKey, cycle } });
    await Payment.create({ tenantId, productKey: product.key, planKey, cycle, startMode: rule.startMode, status: 'created', base: quote.base, credit: quote.credit, discount: quote.discount, taxable: quote.taxable, gst: quote.gst, cgst: quote.cgst, sgst: quote.sgst, igst: quote.igst, total: quote.total, gstMode: quote.gstMode, gstRate: quote.gstRate, razorpayOrderId: order.orderId, buyerName: nameOf(tenant), buyerGstin: gstinOf ? gstinOf(tenant) : undefined, buyerState: tenant.state });
    return { orderId: order.orderId, amount: quote.total, currency: 'INR', keyId: order.keyId, quote };
  };

  const nextInvoiceNo = async (at) => { const fy = fyOf(at); const c = await Counter.findOneAndUpdate({ _id: `invoice-${product.invoicePrefix}-${fy}` }, { $inc: { seq: 1 } }, { upsert: true, new: true }); return invoiceNumber(product.invoicePrefix, fy, c.seq); };
  const applyToTenant = async (p) => {
    if (p.appliedAt) return;
    await Tenant.updateOne({ _id: p.tenantId }, { $set: { planKey: p.planKey, billingCycle: p.cycle, paidUntil: p.periodEnd } });
    await Tenant.updateOne({ _id: p.tenantId, planStartedAt: { $exists: false } }, { $set: { planStartedAt: p.paidAt } });
    await Payment.updateOne({ _id: p._id, appliedAt: { $exists: false } }, { $set: { appliedAt: new Date() } });
  };
  // Browser confirmation and webhook both land here; whichever comes first does the work. paidAmountRupees (webhook only) must match what we asked for.
  const activate = async ({ orderId, paymentId, paidAmountRupees }, at = now()) => {
    const p0 = await Payment.findOne({ razorpayOrderId: orderId }); if (!p0) return null;
    if (paidAmountRupees !== undefined && paidAmountRupees !== p0.total) { await Payment.updateOne({ _id: p0._id, status: 'created' }, { $set: { status: 'failed', note: `amount_mismatch:${paidAmountRupees}` } }); return Payment.findById(p0._id); }
    const t = await Tenant.findById(p0.tenantId).select('paidUntil'); const start = p0.startMode === 'extend' && t && t.paidUntil && new Date(t.paidUntil) > at ? new Date(t.paidUntil) : at;
    const claimed = await Payment.findOneAndUpdate({ _id: p0._id, status: 'created' }, { $set: { status: 'paid', razorpayPaymentId: paymentId, paidAt: at, periodStart: start, periodEnd: addPeriod(start, p0.cycle) } }, { new: true });
    let p = claimed || (await Payment.findById(p0._id));
    if (p.status === 'paid') {
      const stale = !claimed && !p.invoiceNo && p.paidAt && at - p.paidAt > 60000;
      if ((claimed || stale) && !p.invoiceNo) p = (await Payment.findOneAndUpdate({ _id: p._id, invoiceNo: { $exists: false } }, { $set: { invoiceNo: await nextInvoiceNo(at) } }, { new: true })) || (await Payment.findById(p._id));
      await applyToTenant(p);
    }
    return p;
  };
  const confirmCheckout = async (tenantId, { orderId, paymentId, signature }) => {
    const p = await Payment.findOne({ tenantId, razorpayOrderId: orderId }); if (!p) throw fail(404, 'Order not found');
    const c = await gateway.getConfig(); if (c.provider !== 'razorpay' || !c.keySecret) throw fail(503, 'Online payment is not set up yet. Please contact support.', 'billing_not_configured');
    if (!gateway.verifyCheckout({ orderId, paymentId, signature, keySecret: c.keySecret })) throw fail(401, 'Invalid payment signature');
    return activate({ orderId, paymentId });
  };
  // Webhook: runs outside any one business, so it names the reason. Another product's events (one Razorpay account serves all) find no order here and are ignored.
  const handleWebhook = (raw, signature) => runUnscoped('payment webhook finds the payment by Razorpay order id, across businesses', async () => {
    if (!gateway.verifyWebhook(raw, signature, await gateway.webhookSecret())) throw fail(401, 'Invalid webhook signature');
    let event; try { event = JSON.parse(Buffer.from(raw).toString('utf8')); } catch (e) { throw fail(400, 'Bad webhook body'); }
    if (event.event === 'refund.processed') return recordRefund(Payment, event && event.payload && event.payload.refund && event.payload.refund.entity);
    const pay = event && event.payload && event.payload.payment && event.payload.payment.entity; if (!pay) return { ignored: true };
    if (event.event === 'payment.captured' || event.event === 'order.paid') { const r = await activate({ orderId: pay.order_id, paymentId: pay.id, paidAmountRupees: pay.amount / 100 }); return { handled: Boolean(r), status: r && r.status }; }
    if (event.event === 'payment.failed') { await Payment.updateOne({ razorpayOrderId: pay.order_id, status: 'created' }, { $set: { note: pay.error_description || 'payment_failed' } }); return { handled: true, status: 'created' }; }
    return { ignored: true };
  });
  const list = (tenantId) => Payment.find({ tenantId }).sort({ createdAt: -1 }).limit(100).select('planKey cycle status total currency base gst invoiceNo paidAt periodStart periodEnd refundedAmount createdAt').lean();
  const forInvoice = (tenantId, id) => Payment.findOne({ _id: id, tenantId, status: { $in: ['paid', 'refunded'] } }).lean();
  return { buildQuote, plansView, startCheckout, activate, confirmCheckout, handleWebhook, list, forInvoice, Payment };
}

// ---- tax invoice PDF (seller details from docs/COMPANY_FACTS.md; the CA must confirm the SAC code and the words "TAX INVOICE")
const sellerDetails = (env = process.env) => ({
  name: env.INVOICE_SELLER_NAME || 'Afra Ventures Private Limited', gstin: env.INVOICE_SELLER_GSTIN || '34ABGCA7083D1ZS', pan: env.INVOICE_SELLER_PAN || 'ABGCA7083D', cin: env.INVOICE_SELLER_CIN || 'U62011PY2026PTC009819',
  address: env.INVOICE_SELLER_ADDRESS || '78, Lenin Street, Kosapalayam, Puducherry - 605013, India', stateLine: env.INVOICE_SELLER_STATE_LINE || 'Puducherry (State code 34)', sac: env.INVOICE_SAC || '998431',
});
function streamInvoice(res, p, { productName, planName, env = process.env }) {
  const PDFDocument = require('pdfkit'); // installed with the products; loaded only when an invoice is asked for
  const s = sellerDetails(env); const rs = (n) => `Rs ${Number(n || 0).toLocaleString('en-IN')}`; const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-');
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${String(p.invoiceNo || p._id).replace(/[^\w-]/g, '_')}.pdf"`);
  doc.pipe(res);
  doc.fontSize(18).font('Helvetica-Bold').text('TAX INVOICE'); // wording to confirm with the CA (M-04)
  doc.moveDown(0.5).fontSize(11).text(s.name); doc.font('Helvetica').fontSize(10).fillColor('#444').text(s.address).text(`GSTIN: ${s.gstin}   PAN: ${s.pan}`).text(`CIN: ${s.cin}`).text(`State: ${s.stateLine}`).moveDown();
  doc.fillColor('#000').font('Helvetica-Bold').text(`Invoice no: ${p.invoiceNo || '-'}`); doc.font('Helvetica').text(`Date: ${fmt(p.paidAt)}`).text(`Payment ID: ${p.razorpayPaymentId || '-'}`).moveDown();
  doc.font('Helvetica-Bold').text('Billed to'); doc.font('Helvetica').text(p.buyerName || 'Business'); if (p.buyerGstin) doc.text(`GSTIN: ${p.buyerGstin}`); if (p.buyerState) doc.text(`Place of supply: ${p.buyerState}`); doc.moveDown();
  doc.font('Helvetica-Bold').text('Description'); doc.font('Helvetica').text(`${productName} ${planName || p.planKey} plan, ${p.cycle}. Service period ${fmt(p.periodStart)} to ${fmt(p.periodEnd)}. SAC ${s.sac}.`).moveDown();
  const line = (l, v, bold) => { doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(l, 50, doc.y, { continued: true, width: 300 }); doc.text(v, { align: 'right' }); };
  line('Plan price', rs(p.base)); if (p.credit) line('Credit for unused days', `- ${rs(p.credit)}`); line('Taxable value', rs(p.taxable));
  if (p.igst) line(`IGST @ ${p.gstRate}%`, rs(p.igst)); else { line(`CGST @ ${p.gstRate / 2}%`, rs(p.cgst)); line(`SGST @ ${p.gstRate / 2}%`, rs(p.sgst)); }
  doc.moveDown(0.5); line('Total paid', rs(p.total), true); doc.moveDown(2).fontSize(8).fillColor('#666').text('This is a computer generated invoice.'); doc.end();
}

// ---- routes. Mount the billing router at /api/<product>/billing BEFORE the product's own router (so it stays open when the plan is read-only: paying must always work).
function createCheckoutRouter({ express, protect, authorize, checkout, product, billing, Tenant, env = process.env }) {
  const r = express.Router(); const owner = authorize('admin');
  const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { if (e && e.status) return res.status(e.status).json({ success: false, message: e.message, code: e.code }); console.error(`${product.key} billing error`, e && e.message); res.status(500).json({ success: false, message: 'Server error' }); } };
  r.use(protect);
  r.get('/plans', wrap(async (req, res) => res.json({ success: true, data: await checkout.plansView(await Tenant.findById(req.user.tenantId)) })));
  r.put('/state', owner, wrap(async (req, res) => { const v = String((req.body && req.body.state) || '').trim(); if (v.length < 2 || v.length > 60) return res.status(400).json({ success: false, message: 'Choose your state.' }); await Tenant.updateOne({ _id: req.user.tenantId }, { $set: { state: v } }); res.json({ success: true }); }));
  r.post('/order', owner, wrap(async (req, res) => { const b = req.body || {}; res.json({ success: true, data: await checkout.startCheckout(req.user.tenantId, String(b.plan || ''), String(b.cycle || '')) }); }));
  r.post('/confirm', owner, wrap(async (req, res) => { const b = req.body || {}; const p = await checkout.confirmCheckout(req.user.tenantId, { orderId: String(b.orderId || ''), paymentId: String(b.paymentId || ''), signature: String(b.signature || '') }); res.json({ success: true, data: { status: p && p.status, invoiceNo: p && p.invoiceNo, periodEnd: p && p.periodEnd } }); }));
  r.get('/payments', owner, wrap(async (req, res) => res.json({ success: true, data: await checkout.list(req.user.tenantId) })));
  r.get('/invoice/:id', owner, wrap(async (req, res) => { if (!/^[a-f0-9]{24}$/i.test(String(req.params.id))) return res.status(400).json({ success: false, message: 'Bad id' }); const p = await checkout.forInvoice(req.user.tenantId, req.params.id); if (!p) return res.status(404).json({ success: false, message: 'Invoice not found' }); streamInvoice(res, p, { productName: product.name, planName: (billing.getPlan(p.planKey) || {}).name, env }); }));
  return r;
}
// Public: Razorpay calls this. The signature over the raw body is the only key. Duplicates are harmless.
function createWebhookRouter({ express, checkout, product }) {
  const r = express.Router();
  r.post('/', async (req, res) => {
    try { const out = await checkout.handleWebhook(req.rawBody, req.headers['x-razorpay-signature']); res.json({ success: true, ...out }); }
    catch (e) { if (e && e.status) return res.status(e.status).json({ success: false, message: e.message }); console.error(`${product.key} webhook error`, e && e.message); res.status(500).json({ success: false }); }
  });
  return r;
}

// One line in a product's app.js: mountBilling({ app, express, mongoose, M, protect, authorize, billing, config, env, product, nameOf })
// Adds POST /api/<key>/billing/webhook (public, signed) and the owner routes under /api/<key>/billing. Put it BEFORE the product's own router at /api/<key>.
function mountBilling({ app, express, mongoose, M, protect, authorize, billing, config, env = process.env, product, nameOf, gstinOf, http }) {
  const gateway = makeGateway({ mongoose, http, env });
  const checkout = makeCheckout({ mongoose, billing, config, gateway, product, Tenant: M.Tenant, nameOf, gstinOf, env });
  app.use(`/api/${product.key}/billing/webhook`, createWebhookRouter({ express, checkout, product }));
  app.use(`/api/${product.key}/billing`, createCheckoutRouter({ express, protect, authorize, checkout, product, billing, Tenant: M.Tenant, env }));
  return checkout;
}

module.exports = { mountBilling, rawBodyCapture, makeGateway, makePaymentModels, makeCheckout, recordRefund, renewalSuggestion, createCheckoutRouter, createWebhookRouter, streamInvoice, sellerDetails };
