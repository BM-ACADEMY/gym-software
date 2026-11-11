'use strict';
// Express router for Wash. Mount: app.use('/api/wash', createWashRouter({ express, mongoose, protect, authorize, tenantOf, planOf, guardWrite }));
// EVERY query filters by tenantId. protect/authorize/guardWrite are injected so this file imports no product code.
// `models` can be passed in by tests (an in-memory stand-in); in production they come from makeModels(mongoose).
const makeModels = require('./models');
const V = require('./vehicles'); const J = require('./jobs'); const P = require('./pass'); const C = require('./cashclose'); const { checkCap } = require('./plans');
const { summarize } = require('./summary');

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
    res.status(201).json({ success: true, data: plain(await M.Attendant.create({ tenantId: tid, name })) });
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
    const job = await M.Job.create({ tenantId: tid, number: count + 1, plate, klass, lines: q.lines, total: q.total, currency: 'INR', state: base.state, passId: pass ? pass.id : undefined, passCovered: pass ? q.lines[0].amount : 0, day: today });
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
    const next = J.move(job, String(b.to), t, attendantId);
    const set = { state: next.state, attendantId: next.attendantId };
    for (const k of ['startedAt', 'readyAt', 'deliveredAt', 'cancelledAt']) if (next[k]) set[k] = next[k];
    if (next.state === 'delivered') {
      const owe = job.total - (job.passId ? job.passCovered || 0 : 0);
      const pays = Array.isArray(b.payments) ? b.payments : [];
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
  return router;
}
module.exports = { createWashRouter, dayOf };
