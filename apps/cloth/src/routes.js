'use strict';
// Cloth routes. Mount: app.use('/api/cloth', createClothRouter({ express, M, protect, authorize, tenantOf, ... })).
// Every query filters by tenantId (the shop). Writes go through guardWrite (read-only once the plan has lapsed).
// Bills, customers and loyalty are in packages/core-pos (mounted separately at /api/pos).
const V = require('./variants'); const G = require('./gst'); const A = require('./alterations'); const SA = require('./stockAdvice');
const DP = require('./discountPolicy'); const F = require('./followups'); const Lk = require('./leaks'); const SM = require('./summary'); const P = require('./plans');
const stock = require('../../../packages/core-pos/src/stock'); const PR = require('./payrollRules'); const P3 = require('./phase3Rules');

const todayIST = (now) => new Date(now.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
const addDays = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const str = (v, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const ID = /^[0-9a-fA-F]{24}$/;

function createClothRouter({ express, M, protect, authorize, tenantOf, planOf = () => 'growth', guardWrite = () => null, salesOfDay = async () => ({ total: 0, bills: 0 }), billsBetween = async () => [], now = () => new Date(), roles = ['admin', 'subadmin'] }) {
  const router = express.Router();
  router.use(protect, authorize(...roles));
  const fail = (res, code, message) => res.status(code).json({ success: false, message });
  const wrap = (fn, { write = false } = {}) => async (req, res) => {
    try {
      if (write) { const g = guardWrite(req); if (g) return fail(res, g.status || 402, g.message || 'Your plan has ended. Renew to make changes.'); }
      const bad = ['id', 'vid'].find((k) => req.params[k] !== undefined && !ID.test(req.params[k])); if (bad) return fail(res, 400, 'Bad id.');
      await fn(req, res, tenantOf(req));
    } catch (err) {
      if (err.code === 'STOCK_INVALID') return fail(res, 400, err.message);
      if (err.code === 11000) return fail(res, 409, 'That value is already used.');
      if (err.name === 'ValidationError' || err.name === 'CastError') return fail(res, 400, 'Check the values you entered.');
      console.error('Cloth route failed:', err.message); return fail(res, 500, 'Server error');
    }
  };
  const settingsOf = async (tid) => { const s = await M.Settings.findOne({ tenantId: tid }).lean(); return { gstBands: s && s.gstBands && G.validBands(s.gstBands.bands) ? s.gstBands : G.DEFAULT_BANDS, growthPct: (s && s.growthPct) || 0, discountRule: DP.normalize(s && s.discountRule), supplierDue: (s && s.supplierDue) || 0, commissionRules: (s && s.commissionRules) || null, leaveAllowance: s && Number.isInteger(s.leaveAllowance) ? s.leaveAllowance : 12, gstMode: P3.gstModeOf(s), gstModeNote: P3.gstModeNote(P3.gstModeOf(s)), upiId: (s && s.upiId) || '', catalogueShowPrice: !!(s && s.catalogueShowPrice), catalogueOn: !!(s && s.catalogueToken) }; };

  // ---- settings (owner edits without a deploy) ----
  router.get('/settings', wrap(async (req, res, tid) => res.json({ success: true, data: await settingsOf(tid) })));
  router.put('/settings', wrap(async (req, res, tid) => {
    const b = req.body || {}; const patch = {};
    if ('gstBands' in b) { if (!G.validBands(b.gstBands && b.gstBands.bands)) return fail(res, 400, 'GST bands are not valid. Use rates 0, 5, 12, 18 or 28 and end with "no upper limit".'); patch.gstBands = { bands: b.gstBands.bands, source: 'set by the shop owner', needsCaConfirmation: true }; }
    if ('discountRule' in b) { if (req.user.role !== 'admin') return fail(res, 403, 'Only the owner can change the discount rule.'); if (!b.discountRule || typeof b.discountRule !== 'object') return fail(res, 400, 'Discount rule is not valid.'); patch.discountRule = DP.normalize(b.discountRule); }
    if ('growthPct' in b) { if (!Number.isInteger(b.growthPct) || b.growthPct < -50 || b.growthPct > 200) return fail(res, 400, 'Growth must be a whole percent from -50 to 200.'); patch.growthPct = b.growthPct; }
    if ('commissionRules' in b) { if (req.user.role !== 'admin') return fail(res, 403, 'Only the owner can change commission rules.'); const cr = b.commissionRules; const ok = cr === null || (cr && typeof cr === 'object' && !Array.isArray(cr) && (cr.default === undefined || PR.okRule(cr.default)) && (cr.byStaff === undefined || (cr.byStaff && typeof cr.byStaff === 'object' && Object.values(cr.byStaff).every(PR.okRule)))); if (!ok) return fail(res, 400, 'Commission rule: percent 0 to 100, or flat rupees.'); patch.commissionRules = cr === null ? null : { default: cr.default, byStaff: cr.byStaff }; }
    if ('leaveAllowance' in b) { if (!Number.isInteger(b.leaveAllowance) || b.leaveAllowance < 0 || b.leaveAllowance > 60) return fail(res, 400, 'Paid leave a year: a whole number from 0 to 60.'); patch.leaveAllowance = b.leaveAllowance; }
    if ('gstMode' in b) { if (req.user.role !== 'admin') return fail(res, 403, 'Only the owner can change the GST setting.'); if (!P3.GST_MODES.includes(b.gstMode)) return fail(res, 400, 'GST mode must be none, inclusive or exclusive.'); patch.gstMode = b.gstMode; }
    if ('upiId' in b) { if (req.user.role !== 'admin') return fail(res, 403, 'Only the owner can change the UPI id.'); if (b.upiId !== '' && !P3.UPI_ID.test(String(b.upiId))) return fail(res, 400, 'UPI id looks like shop@bank.'); patch.upiId = b.upiId; }
    if ('catalogueShowPrice' in b) { if (req.user.role !== 'admin') return fail(res, 403, 'Only the owner can change this.'); if (typeof b.catalogueShowPrice !== 'boolean') return fail(res, 400, 'Show price must be on or off.'); patch.catalogueShowPrice = b.catalogueShowPrice; }
    if ('supplierDue' in b) { if (!Number.isInteger(b.supplierDue) || b.supplierDue < 0) return fail(res, 400, 'Supplier dues must be whole rupees.'); patch.supplierDue = b.supplierDue; }
    if (!Object.keys(patch).length) return fail(res, 400, 'Nothing to change.');
    await M.Settings.updateOne({ tenantId: tid }, { $set: patch }, { upsert: true });
    res.json({ success: true, data: await settingsOf(tid) });
  }, { write: true }));

  // ---- variants ----
  router.get('/variants', wrap(async (req, res, tid) => {
    const q = { tenantId: tid, isActive: true }; const st = str(req.query.style, 40); if (st) q.style = st;
    res.json({ success: true, data: await M.Variant.find(q).sort({ style: 1, size: 1 }).limit(500).lean() });
  }));
  router.post('/variants/grid', wrap(async (req, res, tid) => {
    const g = V.buildGrid({ style: req.body.style, sizes: req.body.sizes, colours: req.body.colours, mrp: req.body.mrp, cost: req.body.cost });
    if (g.error) return fail(res, 400, g.error);
    const cap = P.withinCap(planOf(req), 'variantsMax', (await M.Variant.find({ tenantId: tid, isActive: true }).lean()).length + g.rows.length - 1);
    if (!cap.ok) return fail(res, 402, `Your plan allows ${cap.cap} variants. Upgrade to add more.`);
    const { gstBands } = await settingsOf(tid); const rate = G.rateFor(req.body.mrp, gstBands); const today = todayIST(now());
    const category = str(req.body.category, 40) || undefined;
    const existing = new Set((await M.Variant.find({ tenantId: tid, key: { $in: g.rows.map((r) => r.key) } }).lean()).map((v) => v.key));
    const made = []; const skipped = [];
    for (const r of g.rows) { if (existing.has(r.key)) { skipped.push(r.key); continue; } made.push(await M.Variant.create({ ...r, tenantId: tid, gstRate: rate == null ? 5 : rate, category, addedOn: today })); }
    res.status(201).json({ success: true, data: { added: made.length, skipped, gstRate: rate, gstNeedsCaCheck: true } });
  }, { write: true }));
  router.post('/variants/:id/stock', wrap(async (req, res, tid) => {
    const v = await M.Variant.findOne({ _id: req.params.id, tenantId: tid, isActive: true });
    if (!v) return fail(res, 404, 'Variant not found');
    const move = { type: str(req.body.type, 20), qty: Number(req.body.qty) };
    const next = stock.apply(v.qty, move);
    const set = { qty: next }; const today = todayIST(now()); if (move.type === 'sale') set.lastSoldOn = today;
    const u = await M.Variant.findOneAndUpdate({ _id: v._id, tenantId: tid, qty: v.qty }, { $set: set }, { returnDocument: 'after' });
    if (!u) return fail(res, 409, 'Stock changed while you were saving. Try again.');
    await M.StockMove.create({ tenantId: tid, variantId: v._id, ...move, date: today, reason: str(req.body.reason, 200), by: req.user.id });
    res.json({ success: true, data: u });
  }, { write: true }));

  // ---- alteration jobs ----
  router.get('/alterations', wrap(async (req, res, tid) => {
    const q = { tenantId: tid }; if (A.STATUSES.includes(req.query.status)) q.status = req.query.status;
    res.json({ success: true, data: await M.Alteration.find(q).sort({ readyOn: 1 }).limit(200).lean() });
  }));
  router.post('/alterations', wrap(async (req, res, tid) => {
    const v = A.validate(req.body, todayIST(now())); if (v.error) return fail(res, 400, v.error);
    const d = await M.Alteration.create({ tenantId: tid, status: 'received', ...v.value, customerName: str(req.body.customerName), customerPhone: str(req.body.customerPhone, 15) || undefined, customerId: ID.test(String(req.body.customerId || '')) ? req.body.customerId : undefined });
    res.status(201).json({ success: true, data: d });
  }, { write: true }));
  router.post('/alterations/:id/status', wrap(async (req, res, tid) => {
    const j = await M.Alteration.findOne({ _id: req.params.id, tenantId: tid }); if (!j) return fail(res, 404, 'Job not found');
    const to = str(req.body.status, 20); if (!A.canMove(j.status, to)) return fail(res, 400, `A job that is ${j.status} cannot become ${to}.`);
    const set = { status: to }; if (to === 'ready') set.readyAt = todayIST(now());
    const u = await M.Alteration.findOneAndUpdate({ _id: j._id, tenantId: tid, status: j.status }, { $set: set }, { returnDocument: 'after' });
    if (!u) return fail(res, 409, 'The job changed. Reload and try again.');
    res.json({ success: true, data: u, notify: to === 'ready' ? 'Suggest: send "your item is ready" (needs an approved template).' : undefined });
  }, { write: true }));

  // ---- customer extras (occasion, credit since, do-not-contact, remembered sizes) ----
  router.put('/customers/:id/info', wrap(async (req, res, tid) => {
    const b = req.body || {}; const set = {};
    if ('occasionOn' in b) { if (b.occasionOn !== null && !/^\d{2}-\d{2}$/.test(b.occasionOn)) return fail(res, 400, 'Occasion must look like 11-15 (month-day).'); set.occasionOn = b.occasionOn || undefined; }
    if ('doNotContact' in b) set.doNotContact = b.doNotContact === true;
    if ('sizes' in b) set.sizes = str(b.sizes, 120);
    if ('creditSince' in b) { if (b.creditSince !== null && !A.isDate(b.creditSince)) return fail(res, 400, 'Date must look like 2026-11-15.'); set.creditSince = b.creditSince || undefined; }
    if ('lastVisit' in b) { if (!A.isDate(b.lastVisit)) return fail(res, 400, 'Date must look like 2026-11-15.'); set.lastVisit = b.lastVisit; }
    if (!Object.keys(set).length) return fail(res, 400, 'Nothing to change.');
    const d = await M.CustomerInfo.findOneAndUpdate({ tenantId: tid, customerId: req.params.id }, { $set: set }, { upsert: true, returnDocument: 'after' });
    res.json({ success: true, data: d });
  }, { write: true }));

  // ---- reports (suggestions only) ----
  const gather = async (tid, today) => {
    const vs = await M.Variant.find({ tenantId: tid, isActive: true }).lean();
    const byStyle = {}; for (const v of vs) { const s = byStyle[v.style] = byStyle[v.style] || { style: v.style, qty: 0, cost: 0, price: v.mrp, lastSoldOn: null, addedOn: v.addedOn || today }; s.qty += v.qty; s.cost = Math.max(s.cost, v.cost || 0); if (v.lastSoldOn && (!s.lastSoldOn || v.lastSoldOn > s.lastSoldOn)) s.lastSoldOn = v.lastSoldOn; if (v.addedOn && v.addedOn < s.addedOn) s.addedOn = v.addedOn; }
    const slow = SA.slowMovers(Object.values(byStyle), today).map((s) => ({ ...s, idea: SA.markdownIdea(s, { price: byStyle[s.style].price, cost: byStyle[s.style].cost }) }));
    const moves = await M.StockMove.find({ tenantId: tid, type: 'sale', date: { $gte: addDays(today, -30), $lte: today } }).lean();
    const idToV = Object.fromEntries(vs.map((v) => [String(v._id), v])); const sold = {};
    for (const m of moves) { const v = idToV[String(m.variantId)]; if (v) { const k = V.slug(v.style) + '/' + V.slug(v.size); sold[k] = (sold[k] || 0) + m.qty; } }
    return { vs, slow, gaps: V.sizeGaps(vs, sold) };
  };
  const customerRows = async (tid) => {
    const infos = await M.CustomerInfo.find({ tenantId: tid }).lean();
    const pos = M.PosCustomer ? await M.PosCustomer.find({ tenantId: tid, isActive: true }).lean() : [];
    const posBy = Object.fromEntries(pos.map((c) => [String(c._id), c]));
    return infos.map((i) => { const c = posBy[String(i.customerId)] || {}; return { id: String(i.customerId), name: c.name || 'Customer', lastVisit: i.lastVisit, creditDue: c.creditDue || 0, creditSince: i.creditSince, occasionOn: i.occasionOn, doNotContact: i.doNotContact }; });
  };
  router.get('/reports/slow-stock', wrap(async (req, res, tid) => res.json({ success: true, data: (await gather(tid, todayIST(now()))).slow })));
  router.get('/reports/size-gaps', wrap(async (req, res, tid) => res.json({ success: true, data: (await gather(tid, todayIST(now()))).gaps })));
  router.get('/reports/festival', wrap(async (req, res, tid) => {
    const from = str(req.query.from, 10), to = str(req.query.to, 10); if (!A.isDate(from) || !A.isDate(to) || to < from) return fail(res, 400, 'Give from and to dates like 2025-10-15.');
    const rows = (await M.StockMove.find({ tenantId: tid, type: 'sale', date: { $gte: from, $lte: to } }).lean()).map((m) => ({ date: m.date, qty: m.qty }));
    const s = await settingsOf(tid);
    const f = SA.festivalForecast(rows, { from, to, growthPct: s.growthPct });
    res.json({ success: true, data: f, message: f ? undefined : "No sales found for that window. Import last year's sales to get a forecast." });
  }));
  router.get('/reports/followups', wrap(async (req, res, tid) => res.json({ success: true, data: F.lists(await customerRows(tid), todayIST(now())) })));
  router.get('/summary', wrap(async (req, res, tid) => {
    const today = todayIST(now()); const g = await gather(tid, today); const s = await settingsOf(tid);
    const y = await salesOfDay(tid, addDays(today, -1)); const jobs = await M.Alteration.find({ tenantId: tid, status: { $in: ['received', 'in_progress', 'ready'] } }).lean();
    res.json({ success: true, data: SM.build({ today, salesYesterday: y.total, billsYesterday: y.bills, alterations: A.lists(jobs.map((j) => ({ ...j, id: String(j._id) })), today), followups: F.lists(await customerRows(tid), today), staffDiscounts: Lk.staffDiscounts(await M.BillDiscount.find({ tenantId: tid, date: { $gte: addDays(today, -1) } }).lean()), slow: g.slow, gaps: g.gaps, supplierDue: s.supplierDue }) });
  }));
  require('./routesMore')({ router, M, wrap, fail, str, todayIST, addDays, settingsOf, gather, customerRows, billsBetween, now });
  require('./routesPhase2')({ router, M, wrap, fail, str, todayIST, addDays, settingsOf, billsBetween, now });
  require('./routesPhase3')({ router, M, wrap, fail, str, todayIST, settingsOf, now });
  return router;
}
module.exports = { createClothRouter, todayIST };
