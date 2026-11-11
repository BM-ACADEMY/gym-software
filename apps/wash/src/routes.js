'use strict';
// Express router for Wash. Mount: app.use('/api/wash', createWashRouter({ express, mongoose, protect, authorize, tenantOf, planOf, guardWrite }));
// EVERY query filters by tenantId. protect/authorize/guardWrite are injected so this file imports no product code.
// `models` can be passed in by tests (an in-memory stand-in); in production they come from makeModels(mongoose).
const makeModels = require('./models');
const V = require('./vehicles'); const J = require('./jobs'); const P = require('./pass'); const C = require('./cashclose'); const { checkCap } = require('./plans');
const { summarize } = require('./summary');
const DP = require('./discountPolicy'); const L = require('./leaks');
const A = require('./accounts'); const R = require('./reports'); const PR = require('./predict'); const MK = require('./marketing'); const AT = require('./attendance'); const { dayTotals } = require('./incentive');

const str = (v, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isInt = (n) => Number.isInteger(n);
const dayOf = (d) => new Date(new Date(d).getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
const METHODS = ['cash', 'upi', 'card'];
const plain = (d) => { const o = d && d.toObject ? d.toObject() : d; return o ? { ...o, id: String(o._id) } : o; };
const okRule = (r) => r && (r.type === 'flat' || r.type === 'percent') && Number.isFinite(r.value) && r.value >= 0 && (r.type !== 'percent' || r.value <= 100);

function createWashRouter({ express, mongoose, models, protect, authorize, tenantOf, planOf, guardWrite, now = () => new Date(), roles = ['admin', 'subadmin'] }) {
  const router = express.Router(); const M = models || makeModels(mongoose);
  router.use(protect, authorize(...roles));
  if (guardWrite) router.use((req, res, next) => { const g = guardWrite(req); return g.ok ? next() : res.status(g.httpStatus || 402).json({ success: false, message: g.message, code: 'read_only' }); });
  const fail = (res, code, message) => res.status(code).json({ success: false, message });
  const wrap = (fn) => async (req, res) => {
    try { await fn(req, res, String(tenantOf(req))); } catch (err) {
      if (String(err.code || '').startsWith('JOB_') || String(err.code || '').startsWith('PASS_')) return fail(res, err.code === 'PASS_INVALID' || err.code === 'JOB_ATTENDANT' ? 400 : 409, err.message);
      if (err.code === 11000) return fail(res, 409, 'That value is already used.');
      if (err.name === 'ValidationError' || err.name === 'CastError') return fail(res, 400, 'Check the values you entered.');
      console.error('Wash route failed:', err.message); return fail(res, 500, 'Server error');
    }
  };
  const idOk = (v) => /^[0-9a-fA-F]{24}$/.test(String(v)) || /^[0-9a-zA-Z_-]{6,40}$/.test(String(v));
  const priceList = async (tid) => plain(await M.PriceList.findOne({ tenantId: tid })) || { prices: {}, addons: {}, incentive: {} };

  // ---- price list and incentive rules ----
  router.get('/price-list', wrap(async (req, res, tid) => { const p = await priceList(tid); res.json({ success: true, data: { prices: p.prices || {}, addons: p.addons || {}, incentive: p.incentive || {}, currency: 'INR' } }); }));
  router.put('/price-list', wrap(async (req, res, tid) => {
    const b = req.body || {}; const set = {};
    if (b.prices !== undefined) {
      const k = Object.keys(b.prices || {});
      if (k.some((x) => !V.CLASSES.includes(x) || !isInt(b.prices[x]) || b.prices[x] < 0 || b.prices[x] > 100000)) return fail(res, 400, 'Prices are whole rupees for bike, hatchback, sedan, suv or other');
      set.prices = b.prices;
    }
    if (b.addons !== undefined) {
      const k = Object.keys(b.addons || {});
      if (k.length > 30 || k.some((x) => !/^[a-z0-9_]{1,20}$/.test(x) || !isInt(b.addons[x]) || b.addons[x] < 0 || b.addons[x] > 100000)) return fail(res, 400, 'Add-ons need a short lowercase name and a whole-rupee price');
      set.addons = b.addons;
    }
    if (b.incentive !== undefined) {
      const i = b.incentive || {}; const byClass = i.byClass || {};
      if ((i.default !== undefined && !okRule(i.default)) || Object.keys(byClass).some((c) => !V.CLASSES.includes(c) || !okRule(byClass[c]))) return fail(res, 400, 'Incentive is a flat rupee amount or a percent from 0 to 100');
      set.incentive = { default: i.default, byClass };
    }
    if (!Object.keys(set).length) return fail(res, 400, 'Nothing to change');
    const d = await M.PriceList.findOneAndUpdate({ tenantId: tid }, { $set: set, $setOnInsert: { tenantId: tid } }, { upsert: true, new: true });
    res.json({ success: true, data: plain(d) });
  }));

  // ---- vehicles (plate is the key) ----
  router.get('/vehicles', wrap(async (req, res, tid) => {
    const q = { tenantId: tid }; const s = V.normalizePlate(req.query.q); if (s) q.plate = new RegExp('^' + s);
    res.json({ success: true, data: (await M.Vehicle.find(q).sort({ plate: 1 }).limit(50)).map(plain) });
  }));
  router.post('/vehicles', wrap(async (req, res, tid) => {
    const b = req.body || {}; const plate = V.normalizePlate(b.plate);
    if (!V.validPlate(plate)) return fail(res, 400, 'That number plate does not look right');
    if (!V.CLASSES.includes(b.klass)) return fail(res, 400, 'Choose a vehicle class');
    const phone = str(b.ownerPhone, 15).replace(/\D/g, '');
    if (phone && !/^[6-9]\d{9}$/.test(phone)) return fail(res, 400, 'Enter a 10-digit mobile number');
    const set = { klass: b.klass, ownerName: str(b.ownerName), ownerPhone: phone || undefined };
    if (b.intervalDays !== undefined) { if (!isInt(b.intervalDays) || b.intervalDays < 3 || b.intervalDays > 180) return fail(res, 400, 'Wash gap is 3 to 180 days'); set.intervalDays = b.intervalDays; }
    if (typeof b.doNotContact === 'boolean') set.doNotContact = b.doNotContact;
    const d = await M.Vehicle.findOneAndUpdate({ tenantId: tid, plate }, { $set: set, $setOnInsert: { tenantId: tid, plate } }, { upsert: true, new: true });
    res.status(201).json({ success: true, data: plain(d) });
  }));

  // ---- attendants ----
  router.get('/attendants', wrap(async (req, res, tid) => res.json({ success: true, data: (await M.Attendant.find({ tenantId: tid, isActive: true }).sort({ name: 1 })).map(plain) })));
  router.post('/attendants', wrap(async (req, res, tid) => {
    const name = str(req.body && req.body.name, 80); if (name.length < 2) return fail(res, 400, 'Enter the attendant name');
    res.status(201).json({ success: true, data: plain(await M.Attendant.create({ tenantId: tid, name, isActive: true })) });
  }));

  // ---- passes ----
  router.post('/passes', wrap(async (req, res, tid) => {
    const b = req.body || {}; const plate = V.normalizePlate(b.plate);
    if (!V.validPlate(plate)) return fail(res, 400, 'That number plate does not look right');
    const today = dayOf(now());
    const active = await M.Pass.countDocuments({ tenantId: tid, endsOn: { $gte: today } });
    const cap = checkCap(planOf ? planOf(req) || 'starter' : 'starter', 'pass', active);
    if (!cap.ok) return fail(res, 429, 'Your plan allows ' + cap.cap + ' active passes. Upgrade to add more.');
    const startsOn = typeof b.startsOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.startsOn) ? b.startsOn : today;
    const p = P.newPass({ plate, washes: b.washes, startsOn, validDays: isInt(b.validDays) && b.validDays >= 7 && b.validDays <= 365 ? b.validDays : 30, price: b.price });
    res.status(201).json({ success: true, data: plain(await M.Pass.create({ tenantId: tid, ...p })) });
  }));
  router.get('/passes', wrap(async (req, res, tid) => {
    const q = { tenantId: tid }; const s = V.normalizePlate(req.query.plate); if (s) q.plate = s;
    const today = dayOf(now());
    res.json({ success: true, data: (await M.Pass.find(q).sort({ endsOn: -1 }).limit(100)).map((d) => ({ ...plain(d), status: P.status(plain(d), today) })) });
  }));

  // ---- jobs ----
  router.post('/jobs', wrap(async (req, res, tid) => {
    const b = req.body || {}; const plate = V.normalizePlate(b.plate);
    if (!V.validPlate(plate)) return fail(res, 400, 'That number plate does not look right');
    const veh = await M.Vehicle.findOne({ tenantId: tid, plate });
    const klass = b.klass || (veh && veh.klass);
    const pl = await priceList(tid);
    const q = V.quote(pl.prices, pl.addons, klass, Array.isArray(b.addons) ? b.addons.slice(0, 10) : []);
    if (q.error) return fail(res, 400, q.error);
    const today = dayOf(now());
    const passes = await M.Pass.find({ tenantId: tid, plate, endsOn: { $gte: today } }).sort({ endsOn: 1 });
    const pass = passes.map(plain).find((p) => P.status(p, today).usable);
    const t = now(); const count = await M.Job.countDocuments({ tenantId: tid, day: today });
    const base = J.newJob({ plate, klass, services: q.lines, now: t });
    // D-30: staff may give a discount inside the owner's rule; a reason is always required; the owner is told.
    const passCovered = pass ? q.lines[0].amount : 0; let discount = 0; let reason = '';
    if (b.discount !== undefined && b.discount !== null) {
      const d = b.discount || {}; reason = str(b.discountReason, 120);
      if (reason.length < 3) return fail(res, 400, 'Write the reason for the discount');
      if (!['amount', 'percent'].includes(d.type) || !Number.isFinite(d.value) || d.value < 0) return fail(res, 400, 'Discount is a rupee amount or a percent');
      discount = d.type === 'percent' ? Math.round((q.total * Math.min(d.value, 100)) / 100) : Math.round(d.value);
      if (discount > q.total - passCovered) return fail(res, 400, 'Discount cannot be more than what the customer pays');
    }
    const role = req.user && req.user.role === 'admin' ? 'admin' : 'staff';
    const rule = ((await priceList(tid)).discountRule);
    const chk = DP.check({ role, discount, subtotal: q.total, rule });
    if (!chk.ok) return fail(res, 403, chk.message);
    const job = await M.Job.create({ tenantId: tid, number: count + 1, plate, klass, lines: q.lines, subtotal: q.total, total: q.total - discount, discount, discountReason: discount ? reason : undefined, discountPercent: discount ? chk.percent : undefined, discountBy: discount ? (role === 'admin' ? 'owner' : 'staff') : undefined, currency: 'INR', state: base.state, passId: pass ? pass.id : undefined, passCovered, day: today });
    if (discount) await M.Audit.create({ tenantId: tid, action: 'job.discount', text: `#${job.number} ${chk.percent}% by ${role === 'admin' ? 'owner' : 'staff'}: ${reason}`, by: req.user && req.user.id });
    res.status(201).json({ success: true, data: plain(job), passFound: !!pass });
  }));
  router.get('/jobs', wrap(async (req, res, tid) => {
    const q = { tenantId: tid };
    if (req.query.day) q.day = str(req.query.day, 10); else q.state = { $in: ['waiting', 'washing', 'ready'] };
    res.json({ success: true, data: (await M.Job.find(q).sort({ createdAt: 1 }).limit(200)).map(plain) });
  }));
  router.post('/jobs/:id/move', wrap(async (req, res, tid) => {
    if (!idOk(req.params.id)) return fail(res, 400, 'Unknown job');
    const doc = await M.Job.findOne({ _id: req.params.id, tenantId: tid }); if (!doc) return fail(res, 404, 'Job not found');
    const job = plain(doc); const b = req.body || {}; const t = now();
    let attendantId = job.attendantId;
    if (b.attendantId) {
      if (!idOk(b.attendantId)) return fail(res, 400, 'Unknown attendant');
      const a = await M.Attendant.findOne({ _id: b.attendantId, tenantId: tid, isActive: true }); if (!a) return fail(res, 400, 'Unknown attendant');
      attendantId = String(a._id);
    }
    if (String(b.to) === 'washing' && !attendantId) { const all = await M.Attendant.find({ tenantId: tid, isActive: true }).limit(2); if (all.length === 1) attendantId = String(all[0]._id); } // one attendant: no need to choose
    // SET-03: cancelling a job after washing has begun needs a reason (the owner is told about every such cancel).
    const started = !!job.startedAt || job.state === 'washing';
    const cancelReason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 120) : '';
    if (String(b.to) === 'cancelled' && started && cancelReason.length < 3) return fail(res, 400, 'Say why this job is being cancelled after washing began.');
    const next = J.move(job, String(b.to), t, attendantId);
    const set = { state: next.state, attendantId: next.attendantId };
    if (next.state === 'cancelled' && started) set.cancelReason = cancelReason;
    for (const k of ['startedAt', 'readyAt', 'deliveredAt', 'cancelledAt']) if (next[k]) set[k] = next[k];
    if (next.state === 'delivered') {
      const owe = job.total - (job.passId ? job.passCovered || 0 : 0);
      const pays = Array.isArray(b.payments) ? b.payments : (METHODS.includes(b.payAllWith) && owe > 0 ? [{ method: b.payAllWith, amount: owe }] : []); // payAllWith: one tap, full amount by one method
      if (pays.some((p) => !p || !METHODS.includes(p.method) || !isInt(p.amount) || p.amount <= 0)) return fail(res, 400, 'Each payment needs cash, upi or card and a whole-rupee amount');
      const sum = pays.reduce((s, p) => s + p.amount, 0);
      if (sum !== owe) return fail(res, 400, 'Payments must add up to Rs ' + owe);
      if (job.passId) {
        const pd = await M.Pass.findOne({ _id: job.passId, tenantId: tid }); if (!pd) return fail(res, 409, 'The monthly pass was not found');
        const used = P.useWash(plain(pd), job.day);
        await M.Pass.updateOne({ _id: job.passId, tenantId: tid }, { $set: { used: used.used } });
      }
      set.payments = pays.map((p) => ({ method: p.method, amount: p.amount }));
      await M.Vehicle.updateOne({ tenantId: tid, plate: job.plate }, { $set: { lastWash: dayOf(t) } });
    }
    await M.Job.updateOne({ _id: req.params.id, tenantId: tid }, { $set: set });
    if (set.cancelReason) await M.Audit.create({ tenantId: tid, action: 'job.cancel', text: `job ${job.number} cancelled after washing began: ${set.cancelReason}`, by: req.user && req.user.id });
    res.json({ success: true, data: { ...job, ...set } });
  }));

  // ---- day-end cash closing ----
  router.post('/cash-closing', wrap(async (req, res, tid) => {
    const b = req.body || {}; const day = typeof b.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.day) ? b.day : dayOf(now());
    if (await M.CashClosing.findOne({ tenantId: tid, day })) return fail(res, 409, 'This day is already closed');
    const float = b.openingFloat === undefined ? 0 : b.openingFloat; if (!isInt(float) || float < 0) return fail(res, 400, 'Opening cash is whole rupees');
    const jobs = (await M.Job.find({ tenantId: tid, day, state: 'delivered' })).map(plain);
    const bills = jobs.flatMap((j) => (j.payments || []).map((p) => ({ method: p.method, amount: p.amount })));
    const r = C.closing({ bills, openingFloat: float, declared: b.declared });
    if (r.error) return fail(res, 400, r.error);
    const d = await M.CashClosing.create({ tenantId: tid, day, expected: r.expected, declared: r.declared, diff: r.diff, flag: r.flag, openingFloat: float, upiTotal: r.upiTotal, cardTotal: r.cardTotal, by: req.user && req.user.id });
    res.status(201).json({ success: true, data: plain(d) });
  }));
  router.get('/cash-closing', wrap(async (req, res, tid) => res.json({ success: true, data: (await M.CashClosing.find({ tenantId: tid }).sort({ day: -1 }).limit(31)).map(plain) })));

  // ---- settings (owner only): who may give a discount ----
  const ownerOnly = (req, res, next) => (req.user && req.user.role === 'admin' ? next() : res.status(403).json({ success: false, message: 'Only the owner can change settings.' }));
  router.get('/settings', ownerOnly, wrap(async (req, res, tid) => res.json({ success: true, data: { discountRule: DP.normalize((await priceList(tid)).discountRule) } })));
  router.put('/settings', ownerOnly, wrap(async (req, res, tid) => {
    const b = req.body || {}; if (!b.discountRule || typeof b.discountRule !== 'object') return fail(res, 400, 'Nothing to change');
    const rule = DP.normalize(b.discountRule);
    await M.PriceList.findOneAndUpdate({ tenantId: tid }, { $set: { discountRule: rule }, $setOnInsert: { tenantId: tid } }, { upsert: true, new: true });
    await M.Audit.create({ tenantId: tid, action: 'settings.discountRule', text: `staff ${rule.staff}${rule.staff === 'limit' ? ' up to ' + rule.maxPercent + '%' : ''}`, by: req.user && req.user.id });
    res.json({ success: true, data: { discountRule: rule } });
  }));
  router.get('/leaks', ownerOnly, wrap(async (req, res, tid) => {
    const from = new Date(now().getTime() - 30 * 86400000); const f = dayOf(from);
    const jobs = (await M.Job.find({ tenantId: tid, day: { $gte: f } }).limit(5000)).map(plain);
    res.json({ success: true, data: { staffDiscounts: L.staffDiscounts(jobs), voids: L.voids(jobs), list: L.leakList({ jobs }) } });
  }));
  router.get('/audit', ownerOnly, wrap(async (req, res, tid) => res.json({ success: true, data: (await M.Audit.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(100)).map(plain) })));

  // ---- owner summary and suggestions (nothing is sent from here) ----
  const build = async (tid) => {
    const t = now(); const today = dayOf(t); const pl = await priceList(tid);
    const [jobs, vehicles, passes, closings] = await Promise.all([
      M.Job.find({ tenantId: tid, day: today }).limit(500), M.Vehicle.find({ tenantId: tid }).limit(3000),
      M.Pass.find({ tenantId: tid, endsOn: { $gte: today } }).limit(1000), M.CashClosing.find({ tenantId: tid }).sort({ day: -1 }).limit(1),
    ]);
    return summarize({ today, nowIso: t.toISOString(), jobs: jobs.map(plain), vehicles: vehicles.map(plain), passes: passes.map(plain), closing: closings[0] ? plain(closings[0]) : null, rules: pl.incentive });
  };
  router.get('/summary', wrap(async (req, res, tid) => { res.set('Cache-Control', 'no-store'); res.json({ success: true, data: await build(tid) }); }));
  router.get('/suggestions', wrap(async (req, res, tid) => { res.set('Cache-Control', 'no-store'); const s = await build(tid); res.json({ success: true, data: { actions: s.actions, autoSend: false } }); }));
  // ---- accounts: expenses, cash book, dues, profit and loss, CA export ----
  const DAYRE = /^\d{4}-\d{2}-\d{2}$/;
  const range = (q) => {
    const to = DAYRE.test(q.to || '') ? q.to : dayOf(now()); const from = DAYRE.test(q.from || '') ? q.from : to.slice(0, 8) + '01';
    if (Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z') > 366 * 86400000 || from > to) return null;
    return { from, to };
  };
  router.post('/expenses', wrap(async (req, res, tid) => {
    const b = req.body || {}; const c = A.checkExpense(b); if (c.error) return fail(res, 400, c.error);
    const day = DAYRE.test(b.day || '') ? b.day : dayOf(now());
    const d = await M.Expense.create({ tenantId: tid, day, category: b.category, amount: b.amount, paid: b.paid !== false, cash: b.cash !== false, supplier: str(b.supplier, 80), note: str(b.note, 120), by: req.user && req.user.id });
    res.status(201).json({ success: true, data: plain(d) });
  }));
  router.get('/expenses', wrap(async (req, res, tid) => { const r = range(req.query); if (!r) return fail(res, 400, 'Choose a date range of up to one year'); res.json({ success: true, data: (await M.Expense.find({ tenantId: tid, day: { $gte: r.from, $lte: r.to } }).sort({ day: -1 }).limit(500)).map(plain) }); }));
  router.get('/accounts/cash-book', wrap(async (req, res, tid) => {
    const day = DAYRE.test(req.query.day || '') ? req.query.day : dayOf(now()); const float = Number.isInteger(Number(req.query.float)) ? Math.max(0, Number(req.query.float)) : 0;
    const [jobs, ex] = await Promise.all([M.Job.find({ tenantId: tid, day, state: 'delivered' }).limit(500), M.Expense.find({ tenantId: tid, day }).limit(500)]);
    res.json({ success: true, data: A.cashBook({ openingFloat: float, jobs: jobs.map(plain), expenses: ex.map(plain) }) });
  }));
  router.get('/accounts/dues', wrap(async (req, res, tid) => res.json({ success: true, data: A.supplierDues((await M.Expense.find({ tenantId: tid, paid: false }).limit(1000)).map(plain)) })));
  // Profit and loss for a range. Revenue is what was billed on delivered jobs minus refunds given in the same range.
  const pnlFor = async (tid, r) => {
    const [jobs, ex, pl, refunds] = await Promise.all([M.Job.find({ tenantId: tid, day: { $gte: r.from, $lte: r.to }, state: 'delivered' }).limit(5000), M.Expense.find({ tenantId: tid, day: { $gte: r.from, $lte: r.to } }).limit(5000), priceList(tid), M.Refund.find({ tenantId: tid, day: { $gte: r.from, $lte: r.to } }).limit(5000)]);
    const js = jobs.map(plain); const inc = Object.values(dayTotals(js, pl.incentive)).reduce((s, x) => s + x.incentive, 0);
    const refunded = refunds.map(plain).reduce((s, x) => s + (x.amount || 0), 0);
    return { ...A.profitLoss({ revenue: js.reduce((s, j) => s + (j.total || 0), 0) - refunded, expenses: ex.map(plain), incentive: inc }), refunded, from: r.from, to: r.to };
  };
  router.get('/accounts/pnl', wrap(async (req, res, tid) => {
    const r = range(req.query); if (!r) return fail(res, 400, 'Choose a date range of up to one year');
    res.json({ success: true, data: await pnlFor(tid, r) });
  }));
  router.get('/accounts/export.csv', wrap(async (req, res, tid) => {
    const r = range(req.query); if (!r) return fail(res, 400, 'Choose a date range of up to one year');
    const [jobs, ex] = await Promise.all([M.Job.find({ tenantId: tid, day: { $gte: r.from, $lte: r.to } }).limit(10000), M.Expense.find({ tenantId: tid, day: { $gte: r.from, $lte: r.to } }).limit(10000)]);
    res.set('Content-Type', 'text/csv; charset=utf-8'); res.set('Content-Disposition', `attachment; filename="wash-accounts-${r.from}-to-${r.to}.csv"`);
    res.send(A.caCsv({ jobs: jobs.map(plain), expenses: ex.map(plain) }));
  }));

  // ---- sales reports ----
  router.get('/reports/sales', wrap(async (req, res, tid) => {
    const r = range(req.query); if (!r) return fail(res, 400, 'Choose a date range of up to one year');
    const out = R.salesBy((await M.Job.find({ tenantId: tid, day: { $gte: r.from, $lte: r.to }, state: 'delivered' }).limit(10000)).map(plain), String(req.query.by || 'day'));
    if (out.error) return fail(res, 400, out.error); res.json({ success: true, data: { ...out, from: r.from, to: r.to } });
  }));

  // ---- predictions (labelled estimates) and marketing suggestions ----
  const monthTotals = async (tid) => {
    const t = now(); const start = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 6, 1)).toISOString().slice(0, 10); const thisMonth = dayOf(t).slice(0, 7);
    const jobs = (await M.Job.find({ tenantId: tid, day: { $gte: start }, state: 'delivered' }).limit(20000)).map(plain); const m = {};
    for (const j of jobs) { const k = (j.day || '').slice(0, 7); if (k && k < thisMonth) m[k] = (m[k] || 0) + (j.total || 0); }
    return Object.keys(m).sort().map((k) => m[k]);
  };
  router.get('/predictions', wrap(async (req, res, tid) => {
    const today = dayOf(now());
    const [months, jobs, vehicles, passes] = await Promise.all([monthTotals(tid), M.Job.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(500), M.Vehicle.find({ tenantId: tid }).limit(3000), M.Pass.find({ tenantId: tid, endsOn: { $gte: today } }).limit(1000)]);
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: { nextMonth: PR.nextMonthRange(months), busyHours: PR.busyHours(jobs.map(plain), R.hourIST), renewals: PR.renewalsExpected(passes.map(plain), today, P.status), lapseRisk: PR.lapseRisk(vehicles.map(plain), today).slice(0, 20) } });
  }));
  router.put('/festivals', wrap(async (req, res, tid) => {
    const list = Array.isArray(req.body && req.body.festivals) ? req.body.festivals : null;
    if (!list || list.length > 20 || list.some((f) => !f || str(f.name, 40).length < 2 || !DAYRE.test(f.date || ''))) return fail(res, 400, 'Each festival needs a name and a date');
    await M.PriceList.findOneAndUpdate({ tenantId: tid }, { $set: { festivals: list.map((f) => ({ name: str(f.name, 40), date: f.date })) }, $setOnInsert: { tenantId: tid } }, { upsert: true, new: true });
    res.json({ success: true });
  }));
  router.get('/marketing', wrap(async (req, res, tid) => {
    const today = dayOf(now()); const pl = await priceList(tid);
    const [jobs, vehicles] = await Promise.all([M.Job.find({ tenantId: tid, day: today, state: 'delivered' }).limit(200), M.Vehicle.find({ tenantId: tid }).limit(3000)]);
    const phone = {}; for (const v of vehicles.map(plain)) phone[v.plate] = v;
    const ready = jobs.map(plain).map((j) => ({ ...j, ownerPhone: phone[j.plate] && phone[j.plate].ownerPhone, doNotContact: phone[j.plate] && phone[j.plate].doNotContact }));
    const hist = (await M.Job.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(500)).map(plain);
    res.json({ success: true, data: { sends: 'none: suggestions only', reviewRequests: MK.reviewRequests(ready), offPeak: MK.offPeakOffer(PR.busyHours(hist, R.hourIST), (pl.prices || {}).sedan), festivals: MK.festivalPrompts(pl.festivals, today) } });
  }));

  // ---- attendance ----
  router.post('/attendance', wrap(async (req, res, tid) => {
    const b = req.body || {}; if (!AT.STATUS.includes(b.status) || !DAYRE.test(b.day || '') || !idOk(b.attendantId)) return fail(res, 400, 'Choose the attendant, the day and present, absent or leave');
    const a = await M.Attendant.findOne({ _id: b.attendantId, tenantId: tid }); if (!a) return fail(res, 400, 'Unknown attendant');
    await M.Attendance.findOneAndUpdate({ tenantId: tid, attendantId: String(a._id), day: b.day }, { $set: { status: b.status }, $setOnInsert: { tenantId: tid, attendantId: String(a._id), day: b.day } }, { upsert: true, new: true });
    res.json({ success: true });
  }));
  router.get('/attendance', wrap(async (req, res, tid) => {
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : dayOf(now()).slice(0, 7);
    const rows = (await M.Attendance.find({ tenantId: tid, day: { $gte: month + '-01', $lte: month + '-31' } }).limit(2000)).map(plain);
    res.json({ success: true, data: { month, summary: AT.monthSummary(rows, month) } });
  }));
  require('./routesMore')({ router, M, wrap, fail, plain, str, isInt, dayOf, idOk, ownerOnly, now, priceList, range, pnlFor, DAYRE, METHODS });
  return router;
}
module.exports = { createWashRouter, dayOf };
