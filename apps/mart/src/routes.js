'use strict';
// Mart's own routes. Mount after the session middleware:
//   app.use('/api/mart', createMartRouter({ express, mongoose, protect, authorize, tenantOf, guardWrite }));
// Billing, items, stock, returns, CSV import and loyalty are core-pos, mounted at /api/mart/pos by createApp (same sign-in).
// Every query filters by tenantId (and runs inside the shop's tenant context set by the session middleware).
const makeModels = require('./models');
const makePos = require('../../../packages/core-pos/src/models');
const { makeDiscountHook } = require('../../../packages/core-pos/src/discountHook');
const R = require('./reorder'); const Sh = require('./shelf'); const U = require('./udhaar'); const L = require('./leaks'); const S = require('./summary');
const DP = require('./discountPolicy'); const bill = require('../../../packages/core-pos/src/bill');
const A = require('./accounts'); const I = require('./insights');
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

// D-30 (POS-01): staff may give discounts; the owner sets the rule in Settings and always sees them. The shared bill route
// calls these hooks, so the rule lives in packages/core-pos/src/discountHook.js. The bill itself now carries discountBy and
// discountPercent; MartBillDiscount stays as the owner's per-day report record (reports read it) and is written after the bill is saved.
function discountHooks({ mongoose, now = () => new Date() }) {
  const M = makeModels(mongoose);
  return makeDiscountHook({
    getRule: async (tid) => { const st = await M.Settings.findOne({ tenantId: tid }).lean(); return st && st.discountRule; },
    onDiscount: async ({ req, tid, doc, calc }) => {
      const role = doc.discountBy; const reason = doc.discountReason || '';
      await M.BillDiscount.create({ tenantId: tid, billId: doc._id, day: istDay(now()), by: req.user.id, role, amount: calc.discount, percent: doc.discountPercent, reason });
      await M.ActivityLog.create({ tenantId: tid, job: 'discount', ref: String(doc._id), level: role, action: 'discount', text: `${role === 'owner' ? 'Owner' : 'Staff'} gave ${doc.discountPercent}% off (${calc.discount} rupees) on bill ${doc.number}. Reason: ${reason}` });
    },
  });
}

function createMartRouter({ express, mongoose, protect, authorize, tenantOf, guardWrite, roles = ['admin', 'subadmin'], now = () => new Date() }) {
  const router = express.Router(); const M = makeModels(mongoose); const P = makePos(mongoose);
  router.use(protect, authorize(...roles));
  if (guardWrite) router.use((req, res, next) => { const g = guardWrite(req); return g.ok ? next() : res.status(g.httpStatus || 402).json({ success: false, message: g.message, code: 'read_only' }); });
  const fail = (res, code, message) => res.status(code).json({ success: false, message });
  const wrap = (fn) => async (req, res) => { try { await fn(req, res, tenantOf(req)); } catch (err) { if (err.code === 'UDHAAR_INVALID') return fail(res, 400, err.message); if (err.name === 'ValidationError' || err.name === 'CastError') return fail(res, 400, 'Check the values you entered.'); console.error('Mart route failed:', err.message); return fail(res, 500, 'Server error'); } };
  const settingsOf = async (tid) => { const d = { ...DEFAULTS, ...(((await M.Settings.findOne({ tenantId: tid }).lean()) || {})) }; d.discountRule = DP.normalize(d.discountRule); return d; };
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
    if ('discountRule' in b) {
      if (!req.user || req.user.role !== 'admin') return fail(res, 403, 'Only the owner can change the discount rule.');
      const r = b.discountRule || {}; if (!['any', 'limit', 'owner_only'].includes(r.staff)) return fail(res, 400, 'Choose who may give a discount: anyone, up to a limit, or owner only.');
      const mp = r.staff === 'limit' ? r.maxPercent : DP.DEFAULT_RULE.maxPercent; if (!Number.isInteger(mp) || mp < 0 || mp > 100) return fail(res, 400, 'The limit must be a whole percent from 0 to 100.');
      set.discountRule = { staff: r.staff, maxPercent: mp };
    }
    if ('festivals' in b) { if (!Array.isArray(b.festivals) || b.festivals.length > 30) return fail(res, 400, 'Add up to 30 festival dates.'); const f = b.festivals.map((x) => ({ name: typeof (x || {}).name === 'string' ? x.name.trim().slice(0, 60) : '', date: x && x.date })); if (f.some((x) => x.name.length < 2 || !valid(x.date))) return fail(res, 400, 'Each festival needs a name and a date.'); set.festivals = f; }
    if (!Object.keys(set).length) return fail(res, 400, 'Nothing to change.');
    await M.Settings.updateOne({ tenantId: tid }, { $set: set }, { upsert: true });
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
    const sd = await M.BillDiscount.find({ tenantId: tid, day: { $gte: addDays(today(), -30) } }).limit(5000).lean();
    res.json({ success: true, data: { heavyDiscounts: L.heavyDiscounts(b, { pct: st.discountAlertPct }), returnsByStaff: L.returnsByStaff(b), staffDiscounts: L.staffDiscounts(sd) } });
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
    const sdRows = await M.BillDiscount.find({ tenantId: tid, day: { $gte: addDays(t, -7) } }).limit(5000).lean();
    const out = S.dailySummary({
      staffDiscounts: L.staffDiscounts(sdRows),
      bills: shape.billsOf(dayBills), lowStock: its.filter((i) => i.trackStock && i.reorderLevel != null && i.qty <= i.reorderLevel),
      overdue: U.overdue(entries, t, st.overdueGraceDays), expiring: Sh.expiryList(its, t, 30),
      reorder: R.suggestReorder({ items: its, sales: shape.salesOf(bills), today: t, uplift: st.festivalUplift }),
      discounts: L.heavyDiscounts(weekBills, { pct: st.discountAlertPct }), dead: Sh.deadStock(its, shape.salesOf(bills), t, st.deadStockDays),
    });
    res.json({ success: true, data: { day, ...out, note: 'Suggestions only. Nothing is ordered or sent for you.' } });
  }));

  // ---- accounts: expenses, suppliers, day close, profit and loss, CA file ----
  const dayParam = (v, d) => (valid(v) ? v : d);
  router.get('/expenses', wrap(async (req, res, tid) => {
    const to = dayParam(req.query.to, today()); const from = dayParam(req.query.from, addDays(to, -30));
    const rows = await M.Expense.find({ tenantId: tid, day: { $gte: from, $lte: to } }).sort({ day: -1 }).limit(1000).lean();
    res.json({ success: true, data: rows });
  }));
  router.get('/reports/expenses', wrap(async (req, res, tid) => {
    const to = dayParam(req.query.to, today()); const from = dayParam(req.query.from, addDays(to, -30));
    res.json({ success: true, data: { from, to, ...A.expensesByCategory(await M.Expense.find({ tenantId: tid, day: { $gte: from, $lte: to } }).limit(5000).lean()) } });
  }));
  router.post('/expenses', wrap(async (req, res, tid) => {
    const b = req.body || {}; const amount = Number(b.amount);
    if (!A.EXPENSE_CATEGORIES.includes(b.category)) return fail(res, 400, 'Choose a category.');
    if (!Number.isInteger(amount) || amount <= 0) return fail(res, 400, 'Enter the amount in whole rupees.');
    const d = await M.Expense.create({ tenantId: tid, day: dayParam(b.day, today()), category: b.category, amount, method: ['cash', 'upi', 'card'].includes(b.method) ? b.method : 'cash', note: typeof b.note === 'string' ? b.note.trim().slice(0, 200) : undefined, by: req.user.id });
    res.status(201).json({ success: true, data: d });
  }));
  router.get('/suppliers', wrap(async (req, res, tid) => {
    const [sup, pur] = await Promise.all([M.Supplier.find({ tenantId: tid, isActive: true }).sort({ name: 1 }).limit(500).lean(), M.Purchase.find({ tenantId: tid, $expr: { $gt: ['$amount', '$paid'] } }).limit(5000).lean()]);
    const dues = Object.fromEntries(A.supplierDues(pur.map((p) => ({ ...p, supplierId: String(p.supplierId) })), today()).map((d) => [d.supplierId, d]));
    res.json({ success: true, data: sup.map((s) => ({ ...s, due: (dues[String(s._id)] || {}).due || 0, oldestDay: (dues[String(s._id)] || {}).oldestDay || null })) });
  }));
  router.post('/suppliers', wrap(async (req, res, tid) => {
    const name = typeof (req.body || {}).name === 'string' ? req.body.name.trim().slice(0, 120) : ''; if (name.length < 2) return fail(res, 400, 'Enter the supplier name.');
    res.status(201).json({ success: true, data: await M.Supplier.create({ tenantId: tid, name, phone: typeof req.body.phone === 'string' ? req.body.phone.replace(/[^\d+]/g, '').slice(0, 15) : undefined }) });
  }));
  router.post('/suppliers/:id/purchases', wrap(async (req, res, tid) => {
    const sid = toOid(req.params.id); const b = req.body || {}; const amount = Number(b.amount); const paid = Number(b.paid || 0);
    if (!sid || !(await M.Supplier.findOne({ _id: sid, tenantId: tid }))) return fail(res, 404, 'Supplier not found');
    if (!Number.isInteger(amount) || amount <= 0) return fail(res, 400, 'Enter the bill amount in whole rupees.');
    if (!Number.isInteger(paid) || paid < 0 || paid > amount) return fail(res, 400, 'Paid now must be from 0 to the bill amount.');
    const cash = b.method === 'cash' || b.method === undefined ? paid : 0;
    res.status(201).json({ success: true, data: await M.Purchase.create({ tenantId: tid, supplierId: sid, day: dayParam(b.day, today()), amount, paid, paidCash: cash, note: typeof b.note === 'string' ? b.note.trim().slice(0, 200) : undefined, by: req.user.id }) });
  }));
  router.post('/suppliers/:id/pay', wrap(async (req, res, tid) => {
    const sid = toOid(req.params.id); const amount = Number((req.body || {}).amount);
    if (!sid || !(await M.Supplier.findOne({ _id: sid, tenantId: tid }))) return fail(res, 404, 'Supplier not found');
    const open = await M.Purchase.find({ tenantId: tid, supplierId: sid, $expr: { $gt: ['$amount', '$paid'] } }).lean();
    let plan; try { plan = A.allocatePayment(open.map((p) => ({ id: String(p._id), day: p.day, amount: p.amount, paid: p.paid })), amount); } catch (e) { if (e.code === 'ACCOUNTS_INVALID') return fail(res, 400, e.message); throw e; }
    const cashPay = (req.body || {}).method === 'upi' || (req.body || {}).method === 'card' ? false : true; let left = amount;
    for (const u of plan) { const prev = open.find((p) => String(p._id) === u.id); const add = u.paid - prev.paid; left -= add; await M.Purchase.updateOne({ _id: u.id, tenantId: tid, paid: prev.paid }, { $set: { paid: u.paid }, ...(cashPay ? { $inc: { paidCash: add } } : {}) }); }
    res.json({ success: true, data: { paid: amount - left } });
  }));
  // Day close: counted cash against what the books say should be there. Saves one row per day.
  const cashFor = async (tid, day, opening) => {
    const from = new Date(Date.parse(day + 'T00:00:00Z') - 5.5 * 3600000); const to = new Date(from.getTime() + 86400000);
    const [bills, pays, exps, purs] = await Promise.all([P.PosBill.find({ tenantId: tid, createdAt: { $gte: from, $lt: to } }).lean(), M.Payment.find({ tenantId: tid, day, method: 'cash' }).lean(), M.Expense.find({ tenantId: tid, day, method: 'cash' }).lean(), M.Purchase.find({ tenantId: tid, day, paidCash: { $gt: 0 } }).lean()]);
    return A.expectedCash({ opening, cashSales: Math.max(0, shape.billsOf(bills).length ? S.salesOf(shape.billsOf(bills)).cash : 0), udhaarCashIn: pays.reduce((a, x) => a + x.amount, 0), expensesCash: exps.reduce((a, x) => a + x.amount, 0), supplierCashOut: purs.reduce((a, x) => a + x.paidCash, 0) });
  };
  router.get('/day-close', wrap(async (req, res, tid) => {
    const day = dayParam(req.query.day, today()); const prev = await M.DayClose.findOne({ tenantId: tid, day: { $lt: day } }).sort({ day: -1 }).lean();
    const opening = Number.isInteger(Number(req.query.opening)) && req.query.opening !== undefined ? Math.max(0, Number(req.query.opening)) : (prev ? prev.counted : 0);
    res.json({ success: true, data: { day, openingCash: opening, ...(await cashFor(tid, day, opening)), saved: await M.DayClose.findOne({ tenantId: tid, day }).lean() } });
  }));
  router.post('/day-close', wrap(async (req, res, tid) => {
    const b = req.body || {}; const day = dayParam(b.day, today()); const counted = Number(b.counted); const opening = Number.isInteger(Number(b.openingCash)) ? Math.max(0, Number(b.openingCash)) : 0;
    if (!Number.isInteger(counted) || counted < 0) return fail(res, 400, 'Enter the counted cash in whole rupees.');
    const { expected } = await cashFor(tid, day, opening); const r = A.dayClose({ expected, counted });
    await M.DayClose.updateOne({ tenantId: tid, day }, { $set: { openingCash: opening, expected, counted, diff: r.diff, by: req.user.id } }, { upsert: true });
    res.json({ success: true, data: { day, ...r } });
  }));
  const periodBills = async (tid, from, to) => P.PosBill.find({ tenantId: tid, createdAt: { $gte: new Date(Date.parse(from + 'T00:00:00Z') - 5.5 * 3600000), $lt: new Date(Date.parse(to + 'T00:00:00Z') + 86400000 - 5.5 * 3600000) } }).limit(20000).lean();
  router.get('/reports/profit-loss', wrap(async (req, res, tid) => {
    const to = dayParam(req.query.to, today()); const from = dayParam(req.query.from, addDays(to, -30));
    const [bills, exps, items] = await Promise.all([periodBills(tid, from, to), M.Expense.find({ tenantId: tid, day: { $gte: from, $lte: to } }).lean(), P.PosItem.find({ tenantId: tid }).select('cost').lean()]);
    const costOf = {}; for (const i of items) if (i.cost !== undefined && i.cost !== null) costOf[String(i._id)] = i.cost;
    res.json({ success: true, data: { from, to, ...A.profitAndLoss({ bills: bills.map((b) => ({ ...b, lines: (b.lines || []).map((l) => ({ itemId: l.itemId ? String(l.itemId) : null, qty: l.qty })) })), expenses: exps, costOf }) } });
  }));
  // CSV for the CA. Read-only; we do not file anything.
  router.get('/reports/ca-export', wrap(async (req, res, tid) => {
    const to = dayParam(req.query.to, today()); const from = dayParam(req.query.from, addDays(to, -30));
    const [bills, exps] = await Promise.all([periodBills(tid, from, to), M.Expense.find({ tenantId: tid, day: { $gte: from, $lte: to } }).lean()]);
    res.set('Content-Type', 'text/csv; charset=utf-8'); res.set('Content-Disposition', `attachment; filename="mart-${from}-to-${to}.csv"`); res.set('Cache-Control', 'no-store');
    res.send(A.caCsv({ bills, expenses: exps, dayOf: (b) => istDay(b.createdAt) }));
  }));

  // ---- sales reports and predictions (estimates, labelled) ----
  router.get('/reports/sales', wrap(async (req, res, tid) => {
    const to = dayParam(req.query.to, today()); const from = dayParam(req.query.from, addDays(to, -7)); const dim = String(req.query.by || 'day');
    if (!['day', 'hour', 'staff', 'item'].includes(dim)) return fail(res, 400, 'Report by day, hour, staff or item.');
    const bills = await periodBills(tid, from, to);
    res.json({ success: true, data: { from, to, by: dim, rows: I.salesBy(bills.map((b) => ({ ...b, by: b.by ? String(b.by) : null })), dim) } });
  }));
  router.get('/reports/forecast', wrap(async (req, res, tid) => {
    const st = await settingsOf(tid); const t = today(); const monthTotals = [];
    const first = (n) => { const d = new Date(Date.parse(t.slice(0, 7) + '-01T00:00:00Z')); d.setUTCMonth(d.getUTCMonth() - n); return d.toISOString().slice(0, 10); };
    const bills = await periodBills(tid, first(3), addDays(first(0), -1));
    for (let n = 3; n >= 1; n -= 1) { const a = first(n); const z = first(n - 1); monthTotals.push(I.salesBy(bills.filter((b) => { const d = istDay(b.createdAt); return d >= a && d < z; }), 'day').reduce((s, x) => s + x.total, 0)); }
    const recent = await P.PosBill.find({ tenantId: tid, createdAt: { $gte: new Date(now().getTime() - 60 * 86400000) } }).limit(5000).lean();
    const { items, bills: two } = await load(tid, 14); const its = shape.itemsOf(items);
    const { entries } = await udhaarEntries(tid); const pur = await M.Purchase.find({ tenantId: tid, $expr: { $gt: ['$amount', '$paid'] } }).limit(5000).lean();
    const supplierDue = A.supplierDues(pur.map((p) => ({ ...p, supplierId: String(p.supplierId) })), t).reduce((a, x) => a + x.due, 0);
    const exp30 = await M.Expense.find({ tenantId: tid, day: { $gte: addDays(t, -30) } }).lean();
    res.json({ success: true, data: {
      label: 'Estimates from your own past data. Not promises.',
      nextMonth: I.nextMonthRange(monthTotals), busySlow: I.busySlow(recent),
      runOutSoon: R.suggestReorder({ items: its, sales: shape.salesOf(two), today: t, uplift: st.festivalUplift }).filter((r) => r.daysLeft !== null && r.daysLeft <= 7),
      udhaarOverdue: U.overdue(entries, t, st.overdueGraceDays).length, cashNeeded: I.cashNeededForDues({ supplierDue, expectedExpenses: A.expensesByCategory(exp30).total }),
    } });
  }));
  router.get('/marketing', wrap(async (req, res, tid) => {
    const st = await settingsOf(tid); const t = today();
    const bills = await P.PosBill.find({ tenantId: tid, customerId: { $exists: true, $ne: null }, createdAt: { $gte: new Date(now().getTime() - 365 * 86400000) } }).select('customerId createdAt').limit(20000).lean();
    const cust = await P.PosCustomer.find({ tenantId: tid, isActive: true }).select('name').limit(20000).lean(); const nm = Object.fromEntries(cust.map((c) => [String(c._id), c.name]));
    const g = {}; for (const b of bills) (g[String(b.customerId)] = g[String(b.customerId)] || []).push(istDay(b.createdAt));
    const list = Object.entries(g).map(([id, dates]) => ({ customerId: id, name: nm[id] || 'Customer', dates, lastBillDay: [...dates].sort().pop() }));
    res.json({ success: true, data: { note: 'Suggestions only. Nothing is sent for you, and WhatsApp messages need approved templates.', winBack: I.lapseRisk(list, t), festivals: I.festivalIdeas((st.festivals || []), t), reviewRequests: I.reviewRequests(list, t) } });
  }));
  return router;
}
module.exports = { createMartRouter, creditGuard, discountHooks, DEFAULTS };
