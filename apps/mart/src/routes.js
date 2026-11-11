'use strict';
// Mart's own routes. Mount after the session middleware:
//   app.use('/api/mart', createMartRouter({ express, mongoose, protect, authorize, tenantOf, guardWrite }));
// Billing, items, stock, returns, CSV import and loyalty are core-pos, mounted at /api/mart/pos by createApp (same sign-in).
// Every query filters by tenantId (and runs inside the shop's tenant context set by the session middleware).
const makeModels = require('./models');
const makePos = require('../../../packages/core-pos/src/models');
const R = require('./reorder'); const Sh = require('./shelf'); const U = require('./udhaar'); const L = require('./leaks'); const S = require('./summary');
const shape = require('./shape'); const { istDay, addDays, valid } = require('./dates');

const toOid = (v) => (typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v) ? v : null);
const clampInt = (v, lo, hi, d) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : d; };
const DEFAULTS = { overdueGraceDays: 15, festivalUplift: 1, discountAlertPct: 20, deadStockDays: 45, defaultCreditLimit: null };

// Pay-later check BEFORE the shared bill route saves anything. Needs the customer, the credit part of the payments and the limit.
function creditGuard({ mongoose, tenantOf }) {
  const M = makeModels(mongoose); const P = makePos(mongoose);
  return async (req, res, next) => {
    try {
      if (req.method !== 'POST' || req.path !== '/bills') return next();
      const b = req.body || {}; const add = (Array.isArray(b.payments) ? b.payments : []).filter((p) => p && p.method === 'credit').reduce((a, p) => a + Math.round(Number(p.amount) || 0), 0);
      if (!add) return next();
      const tid = tenantOf(req); const cid = toOid(String(b.customerId || ''));
      if (!cid) return next(); // the shared route answers "Pay-later needs a customer"
      const c = await P.PosCustomer.findOne({ _id: cid, tenantId: tid }).lean(); if (!c) return next();
      const st = await M.Settings.findOne({ tenantId: tid }).lean();
      const r = U.canGiveCredit({ balance: c.creditDue || 0, add, limit: st && st.defaultCreditLimit != null ? st.defaultCreditLimit : null });
      return r.ok ? next() : res.status(409).json({ success: false, message: r.reason, code: 'credit_limit' });
    } catch (e) { console.error('credit guard failed:', e.message); return res.status(500).json({ success: false, message: 'Server error' }); }
  };
}

function createMartRouter({ express, mongoose, protect, authorize, tenantOf, guardWrite, roles = ['admin', 'subadmin'], now = () => new Date() }) {
  const router = express.Router(); const M = makeModels(mongoose); const P = makePos(mongoose);
  router.use(protect, authorize(...roles));
  if (guardWrite) router.use((req, res, next) => { const g = guardWrite(req); return g.ok ? next() : res.status(g.httpStatus || 402).json({ success: false, message: g.message, code: 'read_only' }); });
  const fail = (res, code, message) => res.status(code).json({ success: false, message });
  const wrap = (fn) => async (req, res) => { try { await fn(req, res, tenantOf(req)); } catch (err) { if (err.code === 'UDHAAR_INVALID') return fail(res, 400, err.message); if (err.name === 'ValidationError' || err.name === 'CastError') return fail(res, 400, 'Check the values you entered.'); console.error('Mart route failed:', err.message); return fail(res, 500, 'Server error'); } };
  const settingsOf = async (tid) => ({ ...DEFAULTS, ...(((await M.Settings.findOne({ tenantId: tid }).lean()) || {})) });
  const load = async (tid, sinceDays) => {
    const since = new Date(now().getTime() - sinceDays * 86400000);
    const [items, bills] = await Promise.all([P.PosItem.find({ tenantId: tid, isActive: true }).limit(5000).lean(), P.PosBill.find({ tenantId: tid, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(5000).lean()]);
    return { items, bills };
  };
  const udhaarEntries = async (tid) => {
    const [bills, payments, customers] = await Promise.all([P.PosBill.find({ tenantId: tid, credit: { $gt: 0 } }).limit(20000).lean(), M.Payment.find({ tenantId: tid }).limit(20000).lean(), P.PosCustomer.find({ tenantId: tid, isActive: true }).limit(20000).lean()]);
    return { entries: shape.ledger({ bills, payments, customers }), customers };
  };
  const today = () => istDay(now());

  // ---- settings the owner can change any time ----
  router.get('/settings', wrap(async (req, res, tid) => res.json({ success: true, data: await settingsOf(tid) })));
  router.put('/settings', wrap(async (req, res, tid) => {
    const b = req.body || {}; const set = {};
    if ('overdueGraceDays' in b) { const v = clampInt(b.overdueGraceDays, 1, 365); if (v === undefined || v === null) return fail(res, 400, 'Grace days must be 1 to 365.'); set.overdueGraceDays = v; }
    if ('deadStockDays' in b) { const v = clampInt(b.deadStockDays, 7, 365, null); if (v === null) return fail(res, 400, 'Dead stock days must be 7 to 365.'); set.deadStockDays = v; }
    if ('discountAlertPct' in b) { const v = clampInt(b.discountAlertPct, 5, 100, null); if (v === null) return fail(res, 400, 'Discount alert must be 5 to 100 percent.'); set.discountAlertPct = v; }
    if ('festivalUplift' in b) { const v = Number(b.festivalUplift); if (!(v >= 1 && v <= 5)) return fail(res, 400, 'Festival uplift must be 1 to 5.'); set.festivalUplift = v; }
    if ('defaultCreditLimit' in b) { if (b.defaultCreditLimit === null || b.defaultCreditLimit === '') set.defaultCreditLimit = null; else { const v = clampInt(b.defaultCreditLimit, 0, 10000000, null); if (v === null) return fail(res, 400, 'Credit limit must be whole rupees.'); set.defaultCreditLimit = v; } }
    if (!Object.keys(set).length) return fail(res, 400, 'Nothing to change.');
    await M.Settings.updateOne({ tenantId: tid }, { $set: set, $setOnInsert: { tenantId: tid } }, { upsert: true });
    res.json({ success: true, data: await settingsOf(tid) });
  }));

  // ---- udhaar ----
  router.get('/udhaar', wrap(async (req, res, tid) => {
    const st = await settingsOf(tid); const { entries, customers } = await udhaarEntries(tid);
    const names = Object.fromEntries(customers.map((c) => [String(c._id), { name: c.name, phone: c.phone || null }]));
    const bal = U.balances(entries); const list = Object.entries(bal).filter(([, v]) => v.due > 0).map(([cid, v]) => ({ customerId: cid, ...names[cid], due: v.due, currency: 'INR' })).sort((a, b) => b.due - a.due);
    const od = U.overdue(entries, today(), st.overdueGraceDays).map((o) => ({ ...o, ...names[o.customerId] }));
    res.json({ success: true, data: { owing: list, overdue: od, totalDue: list.reduce((a, x) => a + x.due, 0), currency: 'INR' } });
  }));
  router.post('/udhaar/payments', wrap(async (req, res, tid) => {
    const b = req.body || {}; const cid = toOid(String(b.customerId || '')); const amount = Number(b.amount);
    if (!cid) return fail(res, 400, 'Choose a customer.');
    if (!Number.isInteger(amount) || amount <= 0) return fail(res, 400, 'Enter the amount in whole rupees.');
    const c = await P.PosCustomer.findOne({ _id: cid, tenantId: tid });
    if (!c) return fail(res, 404, 'Customer not found');
    if (amount > (c.creditDue || 0)) return fail(res, 400, `This customer owes ${c.creditDue || 0} rupees. A payment cannot be more than that.`);
    // take the balance down first, only if it still covers the amount (two taps at once cannot over-pay)
    const upd = await P.PosCustomer.findOneAndUpdate({ _id: cid, tenantId: tid, creditDue: { $gte: amount } }, { $inc: { creditDue: -amount } }, { returnDocument: 'after' });
    if (!upd) return fail(res, 409, 'The balance changed. Check it and try again.');
    const method = ['cash', 'upi', 'card'].includes(b.method) ? b.method : 'cash';
    const doc = await M.Payment.create({ tenantId: tid, customerId: cid, amount, method, day: today(), note: typeof b.note === 'string' ? b.note.trim().slice(0, 200) : undefined, by: req.user.id });
    res.status(201).json({ success: true, data: { payment: doc, balance: upd.creditDue } });
  }));

  // ---- suggestions: every row carries its reason ----
  router.get('/reports/reorder', wrap(async (req, res, tid) => {
    const st = await settingsOf(tid); const { items, bills } = await load(tid, 14);
    res.json({ success: true, data: R.suggestReorder({ items: shape.itemsOf(items), sales: shape.salesOf(bills), today: today(), uplift: st.festivalUplift }) });
  }));
  router.get('/reports/expiry', wrap(async (req, res, tid) => { const { items } = await load(tid, 1); res.json({ success: true, data: Sh.expiryList(shape.itemsOf(items), today(), clampInt(req.query.days, 1, 365, 30)) }); }));
  router.get('/reports/dead-stock', wrap(async (req, res, tid) => {
    const st = await settingsOf(tid); const { items, bills } = await load(tid, st.deadStockDays);
    res.json({ success: true, data: Sh.deadStock(shape.itemsOf(items), shape.salesOf(bills), today(), st.deadStockDays) });
  }));
  router.get('/reports/leaks', wrap(async (req, res, tid) => {
    const st = await settingsOf(tid); const { bills } = await load(tid, clampInt(req.query.days, 1, 31, 7)); const b = shape.billsOf(bills);
    res.json({ success: true, data: { heavyDiscounts: L.heavyDiscounts(b, { pct: st.discountAlertPct }), returnsByStaff: L.returnsByStaff(b) } });
  }));
  // The owner types what is on the shelf; nothing is changed, only compared with the system count.
  router.post('/reports/stock-check', wrap(async (req, res, tid) => {
    const rows = Array.isArray((req.body || {}).counts) ? req.body.counts.slice(0, 500) : [];
    const ids = rows.map((r) => toOid(String((r && r.itemId) || ''))).filter(Boolean);
    const items = await P.PosItem.find({ tenantId: tid, _id: { $in: ids }, trackStock: true }).lean(); const by = Object.fromEntries(items.map((i) => [String(i._id), i]));
    const counts = rows.filter((r) => r && by[r.itemId] && Number.isFinite(Number(r.counted)) && Number(r.counted) >= 0).map((r) => ({ itemId: r.itemId, name: by[r.itemId].name, system: by[r.itemId].qty, counted: Number(r.counted), cost: by[r.itemId].cost || by[r.itemId].price || 0 }));
    res.json({ success: true, data: L.stockMismatch(counts) });
  }));

  // ---- the owner's morning summary: yesterday's numbers and three things to do ----
  router.get('/summary', wrap(async (req, res, tid) => {
    const st = await settingsOf(tid); const t = today(); const day = valid(req.query.day) ? req.query.day : addDays(t, -1);
    const { items, bills } = await load(tid, Math.max(14, st.deadStockDays)); const its = shape.itemsOf(items);
    const dayBills = bills.filter((b) => istDay(b.createdAt) === day);
    const { entries } = await udhaarEntries(tid);
    const weekBills = shape.billsOf(bills.filter((b) => istDay(b.createdAt) >= addDays(t, -7)));
    const out = S.dailySummary({
      bills: shape.billsOf(dayBills), lowStock: its.filter((i) => i.trackStock && i.reorderLevel != null && i.qty <= i.reorderLevel),
      overdue: U.overdue(entries, t, st.overdueGraceDays), expiring: Sh.expiryList(its, t, 30),
      reorder: R.suggestReorder({ items: its, sales: shape.salesOf(bills), today: t, uplift: st.festivalUplift }),
      discounts: L.heavyDiscounts(weekBills, { pct: st.discountAlertPct }), dead: Sh.deadStock(its, shape.salesOf(bills), t, st.deadStockDays),
    });
    res.json({ success: true, data: { day, ...out, note: 'Suggestions only. Nothing is ordered or sent for you.' } });
  }));
  return router;
}
module.exports = { createMartRouter, creditGuard, DEFAULTS };
