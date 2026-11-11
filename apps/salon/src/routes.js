'use strict';
// Express routers for Salon (Groom). Mount:
//   app.use('/api/salon', createSalonRouter({ express, mongoose, protect, authorize, tenantOf, guardWrite }));
//   app.use('/api/salon-book', createPublicRouter({ express, mongoose }));   // no sign-in: the secret link is the key
// Every query filters by tenantId; the tenant guard also throws if one does not. Nothing here sends a message (suggest only).
const crypto = require('crypto');
const { runWithTenant, runUnscoped } = require('../../../packages/core-server/src');
const makeModels = require('./models');
const B = require('./booking');
const { buildBill } = require('./billing');
const DP = require('./discountPolicy');
const LR = require('./loyaltyRule');
const SO = require('./stockOps');
const BP = require('./bookingPage');
const { dailySummary } = require('./summary');
const { lapsed, dueForRebook } = require('./winback');
const { startingServices, presetKeys } = require('./presets');
const { hashPassword } = require('./authRoutes');
const A = require('./accounts');
const { salesReport, monthlyTotals } = require('./reports');
const P = require('./predict');
const L = require('./leaks');
const Mk = require('./marketing');

const str = (v, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const plain = (d) => { const o = d && d.toObject ? d.toObject() : d; return o ? { ...o, id: String(o._id) } : o; };
const KNOWN = ['BOOKING_DATE', 'BOOKING_PAST', 'BOOKING_FAR', 'BOOKING_CLOSED', 'BOOKING_TIME', 'BOOKING_TAKEN', 'BOOKING_HOURS', 'SALON_BILL', 'BILL_INVALID', 'FIELD'];
const field = (m) => Object.assign(new Error(m), { code: 'FIELD' });
const isId = (v) => typeof v === 'string' && /^[0-9a-f]{24}$/i.test(v);

function makeFail() { return (res, code, message, extra) => res.status(code).json({ success: false, message, ...extra }); }
function makeWrap(fail, tenantOf) {
  return (fn) => async (req, res) => {
    try { await fn(req, res, tenantOf(req)); } catch (err) {
      if (err.code === 'BOOKING_TAKEN') return fail(res, 409, err.message);
      if (KNOWN.includes(err.code)) return fail(res, 400, err.message);
      if (err.code === 11000) return fail(res, 409, 'That value is already used.');
      if (err.name === 'ValidationError' || err.name === 'CastError') return fail(res, 400, 'Check the values you entered.');
      console.error('Salon route failed:', err.message); return fail(res, 500, 'Server error');
    }
  };
}

// ---- booking service shared by the owner screen and the public link ----
function makeBooker(M) {
  const activeOf = (tid, staffId, date) => M.Appointment.find({ tenantId: tid, staffId, date, active: true }).lean();
  const asBooked = (rows) => rows.map((a) => ({ start: a.start, end: a.start + a.mins }));
  return {
    slots: async (tid, tenant, { date, staffId, serviceKey }) => {
      const s = await M.Service.findOne({ tenantId: tid, key: serviceKey, isActive: true }); if (!s) throw field('Choose a service.');
      const st = await M.Staff.findOne({ tenantId: tid, _id: staffId, isActive: true }); if (!st) throw field('Choose a staff member.');
      return { mins: s.mins, slots: B.slotsFor({ tenant, date, mins: s.mins, booked: asBooked(await activeOf(tid, st._id, date)) }) };
    },
    book: async (tid, tenant, { date, start, staffId, serviceKey, name, phone, consent, source }) => {
      const s = await M.Service.findOne({ tenantId: tid, key: serviceKey, isActive: true }); if (!s) throw field('Choose a service.');
      const st = await M.Staff.findOne({ tenantId: tid, _id: staffId, isActive: true }); if (!st) throw field('Choose a staff member.');
      if (st.serviceKeys && st.serviceKeys.length && !st.serviceKeys.includes(s.key)) throw field('That staff member does not do this service.');
      const ph = B.cleanPhone(phone); if (!B.validPhone(ph)) throw field('Enter a 10-digit mobile number.');
      if (str(name, 120).length < 2) throw field('Enter the name.');
      if (source === 'public' && consent !== true) throw field('Tick the box to agree to the business storing your details.');
      const booked = asBooked(await activeOf(tid, st._id, date));
      B.checkStart({ tenant, date, start, mins: s.mins, booked, publicBooking: source === 'public' });
      let c = await M.Customer.findOne({ tenantId: tid, phone: ph });
      if (!c) { try { c = await M.Customer.create({ tenantId: tid, name: str(name, 120), phone: ph, consent: consent === true ? { at: new Date(), source } : undefined }); } catch (e) { if (e.code === 11000) c = await M.Customer.findOne({ tenantId: tid, phone: ph }); else throw e; } }
      if (consent === true && c && !(c.consent && c.consent.at)) await M.Customer.updateOne({ _id: c._id, tenantId: tid }, { $set: { consent: { at: new Date(), source } } });
      const status = source === 'public' && tenant.bookingMode === 'approve' ? 'pending' : 'booked';
      const a = await M.Appointment.create({ tenantId: tid, staffId: st._id, customerId: c._id, serviceKey: s.key, serviceName: s.name, date, start, mins: s.mins, status, active: true, source });
      return { appointment: a, customer: c };
    },
  };
}

function createSalonRouter({ express, mongoose, protect, authorize, tenantOf, guardWrite, roles = ['admin', 'staff', 'doctor'] }) {
  const router = express.Router(); const M = makeModels(mongoose); const booker = makeBooker(M);
  router.use(protect, authorize(...roles));
  if (guardWrite) router.use((req, res, next) => { const g = guardWrite(req); return g.ok ? next() : res.status(g.httpStatus || 402).json({ success: false, message: g.message, code: 'read_only' }); });
  const fail = makeFail(); const wrap = makeWrap(fail, tenantOf);
  const adminOnly = (req, res, next) => (req.user && req.user.role === 'admin' ? next() : fail(res, 403, 'Only the owner can do this.'));
  const tenantDoc = (tid) => M.Tenant.findById(tid).lean();
  const today = () => B.istParts().date;
  const maskIfStaff = (req, c) => (req.user.role !== 'admin' ? { ...c, phone: B.maskPhone(c.phone) } : c);

  // ---- services ----
  router.get('/services', wrap(async (req, res, tid) => res.json({ success: true, data: (await M.Service.find({ tenantId: tid }).sort({ name: 1 }).limit(200)).map(plain) })));
  router.post('/services', adminOnly, wrap(async (req, res, tid) => {
    const b = req.body || {}; const name = str(b.name, 80); if (!name) throw field('Enter the service name.');
    const key = str(b.key, 40) || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    const d = await M.Service.create({ tenantId: tid, key, name, mins: Number(b.mins), price: Math.round(Number(b.price) || 0), gstRate: Number(b.gstRate) || 0, cycleDays: Number.isInteger(b.cycleDays) ? b.cycleDays : undefined, hsn: str(b.hsn, 12) || undefined });
    res.status(201).json({ success: true, data: plain(d) });
  }));
  router.patch('/services/:id', adminOnly, wrap(async (req, res, tid) => {
    if (!isId(req.params.id)) return fail(res, 404, 'Not found');
    const b = req.body || {}; const set = {};
    if ('name' in b) set.name = str(b.name, 80); if ('mins' in b) set.mins = Number(b.mins); if ('price' in b) set.price = Math.round(Number(b.price) || 0);
    if ('gstRate' in b) set.gstRate = Number(b.gstRate) || 0; if ('cycleDays' in b) set.cycleDays = Number.isInteger(b.cycleDays) ? b.cycleDays : null; if ('isActive' in b) set.isActive = b.isActive === true;
    const d = await M.Service.findOneAndUpdate({ _id: req.params.id, tenantId: tid }, { $set: set }, { new: true, runValidators: true });
    if (!d) return fail(res, 404, 'Not found'); res.json({ success: true, data: plain(d) });
  }));
  // Load a preset's starting services (only keys the business does not have yet). Prices stay 0 for the owner to type.
  router.post('/services/preset', adminOnly, wrap(async (req, res, tid) => {
    const key = str((req.body || {}).preset, 20); if (!presetKeys().includes(key)) throw field('Unknown preset.');
    const have = new Set((await M.Service.find({ tenantId: tid }).select('key').lean()).map((s) => s.key));
    const add = startingServices(key).filter((s) => !have.has(s.key));
    if (add.length) await M.Service.insertMany(add.map((s) => ({ ...s, tenantId: tid })));
    res.json({ success: true, added: add.length });
  }));

  // ---- staff (unlimited; a login is optional and has the 'staff' role) ----
  router.get('/staff', wrap(async (req, res, tid) => res.json({ success: true, data: (await M.Staff.find({ tenantId: tid }).sort({ name: 1 }).limit(200)).map(plain) })));
  router.post('/staff', adminOnly, wrap(async (req, res, tid) => {
    const b = req.body || {}; const name = str(b.name, 80); if (!name) throw field('Enter the name.');
    const email = str(b.email, 120).toLowerCase(); const password = typeof b.password === 'string' ? b.password : '';
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || password.length < 10)) throw field('For a login, give a valid email and a password of 10 or more characters.');
    const st = await M.Staff.create({ tenantId: tid, name, phone: B.cleanPhone(b.phone) || undefined, serviceKeys: Array.isArray(b.serviceKeys) ? b.serviceKeys.map((k) => str(k, 40)).slice(0, 100) : [] });
    if (email) await M.User.create({ tenantId: tid, name, email, role: 'staff', staffId: st._id, passwordHash: await hashPassword(password) });
    res.status(201).json({ success: true, data: plain(st) });
  }));
  router.patch('/staff/:id', adminOnly, wrap(async (req, res, tid) => {
    if (!isId(req.params.id)) return fail(res, 404, 'Not found');
    const b = req.body || {}; const set = {};
    if ('name' in b) set.name = str(b.name, 80); if ('isActive' in b) set.isActive = b.isActive === true; if (Array.isArray(b.serviceKeys)) set.serviceKeys = b.serviceKeys.map((k) => str(k, 40)).slice(0, 100);
    const d = await M.Staff.findOneAndUpdate({ _id: req.params.id, tenantId: tid }, { $set: set }, { new: true });
    if (!d) return fail(res, 404, 'Not found');
    if ('isActive' in b && b.isActive !== true) await M.User.updateMany({ tenantId: tid, staffId: d._id }, { $set: { isActive: false } });
    res.json({ success: true, data: plain(d) });
  }));

  // ---- customers (phone is the key; staff see masked phones in lists) ----
  router.get('/customers', wrap(async (req, res, tid) => {
    const q = { tenantId: tid }; const s = str(req.query.q, 40);
    if (s) { const re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); q.$or = [{ name: re }, { phone: re }]; }
    res.json({ success: true, data: (await M.Customer.find(q).sort({ createdAt: -1 }).limit(100).lean()).map((c) => maskIfStaff(req, { ...c, id: String(c._id) })) });
  }));
  router.post('/customers', wrap(async (req, res, tid) => {
    const b = req.body || {}; const phone = B.cleanPhone(b.phone);
    if (!B.validPhone(phone)) throw field('Enter a 10-digit mobile number.'); if (str(b.name, 120).length < 2) throw field('Enter the name.');
    const d = await M.Customer.create({ tenantId: tid, name: str(b.name, 120), phone, note: str(b.note, 300) || undefined, birthday: B.validDate(b.birthday) ? b.birthday : undefined, anniversary: B.validDate(b.anniversary) ? b.anniversary : undefined, consent: b.consentGiven === true ? { at: new Date(), source: 'owner' } : undefined });
    res.status(201).json({ success: true, data: plain(d) });
  }));
  router.get('/customers/:id', wrap(async (req, res, tid) => {
    if (!isId(req.params.id)) return fail(res, 404, 'Not found');
    const c = await M.Customer.findOne({ _id: req.params.id, tenantId: tid }).lean(); if (!c) return fail(res, 404, 'Not found');
    const visits = await M.Appointment.find({ tenantId: tid, customerId: c._id }).sort({ date: -1 }).limit(30).lean();
    res.json({ success: true, data: { ...c, id: String(c._id), visits: visits.map((v) => ({ ...v, id: String(v._id) })) } });
  }));
  router.patch('/customers/:id', wrap(async (req, res, tid) => {
    if (!isId(req.params.id)) return fail(res, 404, 'Not found');
    const b = req.body || {}; const set = {};
    if ('note' in b) set.note = str(b.note, 300); if ('name' in b) set.name = str(b.name, 120); if ('doNotContact' in b) set.doNotContact = b.doNotContact === true;
    if ('birthday' in b) set.birthday = B.validDate(b.birthday) ? b.birthday : null; if ('anniversary' in b) set.anniversary = B.validDate(b.anniversary) ? b.anniversary : null;
    const d = await M.Customer.findOneAndUpdate({ _id: req.params.id, tenantId: tid }, { $set: set }, { new: true }); if (!d) return fail(res, 404, 'Not found'); res.json({ success: true, data: plain(d) });
  }));

  // ---- slots and appointments ----
  router.get('/slots', wrap(async (req, res, tid) => {
    const t = await tenantDoc(tid); const q = req.query || {};
    res.json({ success: true, data: await booker.slots(tid, t, { date: str(q.date, 10), staffId: str(q.staffId, 24), serviceKey: str(q.serviceKey, 40) }) });
  }));
  router.get('/appointments', wrap(async (req, res, tid) => {
    const date = str(req.query.date, 10) || today(); if (!B.validDate(date)) throw field('Pick a valid date.');
    const q = { tenantId: tid, date }; if (req.user.role !== 'admin' && req.user.staffId) q.staffId = req.user.staffId;
    const rows = await M.Appointment.find(q).sort({ start: 1 }).limit(300).lean();
    const cs = await M.Customer.find({ tenantId: tid, _id: { $in: rows.map((r) => r.customerId) } }).lean(); const byId = {}; cs.forEach((c) => { byId[String(c._id)] = c; });
    res.json({ success: true, data: rows.map((r) => ({ ...r, id: String(r._id), customer: byId[String(r.customerId)] ? { name: byId[String(r.customerId)].name, phone: req.user.role !== 'admin' ? B.maskPhone(byId[String(r.customerId)].phone) : byId[String(r.customerId)].phone } : null })) });
  }));
  router.post('/appointments', wrap(async (req, res, tid) => {
    const t = await tenantDoc(tid); const b = req.body || {};
    const r = await booker.book(tid, t, { date: str(b.date, 10), start: b.start, staffId: str(b.staffId, 24), serviceKey: str(b.serviceKey, 40), name: b.name, phone: b.phone, consent: b.consentGiven === true, source: 'owner' });
    if (t.preset === 'clinic' && BP.AREAS.includes(b.bodyArea)) { await M.Appointment.updateOne({ _id: r.appointment._id, tenantId: tid }, { $set: { bodyArea: b.bodyArea } }); r.appointment.bodyArea = b.bodyArea; }
    res.status(201).json({ success: true, data: plain(r.appointment) });
  }));
  const own = async (req, tid) => { if (!isId(req.params.id)) return null; const q = { _id: req.params.id, tenantId: tid }; if (req.user.role !== 'admin' && req.user.staffId) q.staffId = req.user.staffId; return M.Appointment.findOne(q); };
  router.post('/appointments/:id/cancel', wrap(async (req, res, tid) => {
    const a = await own(req, tid); if (!a) return fail(res, 404, 'Not found');
    if (!['booked', 'pending'].includes(a.status)) return fail(res, 409, 'This visit can no longer be cancelled.');
    await M.Appointment.updateOne({ _id: a._id, tenantId: tid }, { $set: { status: 'cancelled', active: false } }); res.json({ success: true });
  }));
  router.post('/appointments/:id/accept', adminOnly, wrap(async (req, res, tid) => {
    const r = await M.Appointment.findOneAndUpdate({ _id: isId(req.params.id) ? req.params.id : null, tenantId: tid, status: 'pending' }, { $set: { status: 'booked' } }, { new: true });
    if (!r) return fail(res, 404, 'No waiting request found.'); res.json({ success: true });
  }));
  router.post('/appointments/:id/reschedule', wrap(async (req, res, tid) => {
    const a = await own(req, tid); if (!a) return fail(res, 404, 'Not found');
    if (!['booked', 'pending'].includes(a.status)) return fail(res, 409, 'This visit can no longer be moved.');
    const t = await tenantDoc(tid); const b = req.body || {}; const date = str(b.date, 10); const staffId = isId(b.staffId) ? b.staffId : String(a.staffId);
    const others = (await M.Appointment.find({ tenantId: tid, staffId, date, active: true, _id: { $ne: a._id } }).lean()).map((x) => ({ start: x.start, end: x.start + x.mins }));
    B.checkStart({ tenant: t, date, start: b.start, mins: a.mins, booked: others, publicBooking: false });
    await M.Appointment.updateOne({ _id: a._id, tenantId: tid }, { $set: { date, start: b.start, staffId } });
    res.json({ success: true });
  }));
  const finish = (status) => wrap(async (req, res, tid) => {
    const a = await own(req, tid); if (!a) return fail(res, 404, 'Not found');
    if (a.status !== 'booked') return fail(res, 409, 'Only a confirmed visit can be marked.');
    await M.Appointment.updateOne({ _id: a._id, tenantId: tid }, { $set: { status, active: false } });
    if (status === 'done') await M.Customer.updateOne({ _id: a.customerId, tenantId: tid }, { $set: { lastVisit: a.date, lastServiceKey: a.serviceKey } });
    res.json({ success: true });
  });
  router.post('/appointments/:id/done', finish('done'));
  router.post('/appointments/:id/noshow', finish('noshow'));

  // ---- walk-in queue ----
  router.get('/queue', wrap(async (req, res, tid) => res.json({ success: true, data: (await M.Queue.find({ tenantId: tid, date: today(), status: { $in: ['waiting', 'serving'] } }).sort({ createdAt: 1 }).limit(100).lean()).map((q) => ({ ...q, id: String(q._id), phone: req.user.role !== 'admin' ? B.maskPhone(q.phone) : q.phone })) })));
  router.post('/queue', wrap(async (req, res, tid) => {
    const b = req.body || {}; if (str(b.name, 120).length < 2) throw field('Enter the name.');
    const phone = b.phone ? B.cleanPhone(b.phone) : undefined; if (phone && !B.validPhone(phone)) throw field('That phone number does not look right.');
    const d = await M.Queue.create({ tenantId: tid, name: str(b.name, 120), phone, serviceKey: str(b.serviceKey, 40) || undefined, staffId: isId(b.staffId) ? b.staffId : undefined, date: today() });
    res.status(201).json({ success: true, data: plain(d) });
  }));
  router.post('/queue/:id/status', wrap(async (req, res, tid) => {
    const st = (req.body || {}).status; if (!['serving', 'done', 'left'].includes(st)) throw field('Unknown status.');
    const d = await M.Queue.findOneAndUpdate({ _id: isId(req.params.id) ? req.params.id : null, tenantId: tid }, { $set: { status: st } }, { new: true }); if (!d) return fail(res, 404, 'Not found'); res.json({ success: true });
  }));

  // ---- bills ----
  router.post('/bills', wrap(async (req, res, tid) => {
    const b = req.body || {}; const t = await tenantDoc(tid);
    const clientId = str(b.clientId, 60) || undefined;
    if (clientId) { const ex = await M.Bill.findOne({ tenantId: tid, clientId }); if (ex) return res.json({ success: true, data: plain(ex), duplicate: true }); }
    const svcs = {}; (await M.Service.find({ tenantId: tid, isActive: true }).lean()).forEach((s) => { svcs[s.key] = s; });
    const staffIds = new Set((await M.Staff.find({ tenantId: tid }).select('_id').lean()).map((s) => String(s._id)));
    for (const l of Array.isArray(b.lines) ? b.lines : []) if (l.staffId && !staffIds.has(String(l.staffId))) throw field('A staff member on the bill was not found.');
    const productIds = (Array.isArray(b.lines) ? b.lines : []).map((l) => l && l.productId).filter(isId); const products = {};
    if (productIds.length) (await M.Product.find({ tenantId: tid, _id: { $in: productIds }, isActive: true }).lean()).forEach((p) => { products[String(p._id)] = p; });
    const calc = buildBill({ input: b, services: svcs, tenant: t, rules: t.commissionRules, role: req.user.role === 'admin' ? 'admin' : 'staff', products });
    let customerId; if (isId(b.customerId)) { const c = await M.Customer.findOne({ _id: b.customerId, tenantId: tid }); if (!c) return fail(res, 404, 'Customer not found'); customerId = c._id; }
    const seq = await M.Counter.findOneAndUpdate({ tenantId: tid, key: 'bill' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
    const doc = await M.Bill.create({ tenantId: tid, number: 'B' + String(seq.seq).padStart(5, '0'), customerId, appointmentId: isId(b.appointmentId) ? b.appointmentId : undefined, clientId, date: today(), ...calc });
    if (isId(b.appointmentId)) await M.Appointment.updateOne({ _id: b.appointmentId, tenantId: tid, status: { $in: ['booked', 'done'] } }, { $set: { billId: doc._id } });
    // Stock: what the services and retail lines used up. A failure here never loses the bill.
    try { await SO.consumeForBill(M, tid, { lines: calc.lines, number: doc.number, date: doc.date }, svcs, req.user.id); } catch (e) { console.error('stock use failed:', e.message); }
    // Loyalty (owner turns it on in Settings): points on what was paid. A failure here never loses the bill.
    if (customerId) { const pts = LR.pointsForBill(t.loyaltyRule, { total: calc.total, due: calc.due }); if (pts > 0) { try { await M.LoyaltyEntry.create({ tenantId: tid, customerId, points: pts, reason: 'earn', billId: doc._id }); await M.Customer.findOneAndUpdate({ _id: customerId, tenantId: tid }, { $inc: { loyaltyBalance: pts } }); } catch (e) { console.error('loyalty earn failed:', e.message); } } }
    if (calc.discount) await audit(tid, req, 'bill.discount', `${doc.number} ${calc.discountPercent}% by ${calc.discountBy}`);
    res.status(201).json({ success: true, data: plain(doc) });
  }));
  router.get('/bills', adminOnly, wrap(async (req, res, tid) => res.json({ success: true, data: (await M.Bill.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 50, 200))).map(plain) })));
  router.get('/bills/:id', adminOnly, wrap(async (req, res, tid) => {
    const d = isId(req.params.id) ? await M.Bill.findOne({ _id: req.params.id, tenantId: tid }) : null; if (!d) return fail(res, 404, 'Bill not found'); res.json({ success: true, data: plain(d) });
  }));
  // Commission payable per staff member for a date range (owner only).
  router.get('/commission', adminOnly, wrap(async (req, res, tid) => {
    const from = str(req.query.from, 10); const to = str(req.query.to, 10); if (!B.validDate(from) || !B.validDate(to)) throw field('Pick from and to dates.');
    const bills = await M.Bill.find({ tenantId: tid, date: { $gte: from, $lte: to } }).select('commissions status').lean(); const out = {};
    for (const b of bills.filter((x) => x.status !== 'void')) for (const [k, v] of Object.entries(b.commissions || {})) out[k] = (out[k] || 0) + v;
    res.json({ success: true, data: { totals: out, currency: 'INR' } });
  }));

  // ---- owner summary and suggestions (suggest only; no message is sent from here) ----
  const gather = async (tid) => {
    const t = B.istParts().date; const y = B.addDays(t, -1);
    const [appointments, bills, customers, services] = await Promise.all([
      M.Appointment.find({ tenantId: tid, date: { $in: [t, y] } }).lean(), M.Bill.find({ tenantId: tid, date: { $in: [t, y] } }).select('date received').lean(),
      M.Customer.find({ tenantId: tid, lastVisit: { $type: 'string' } }).limit(2000).lean(), M.Service.find({ tenantId: tid, isActive: true }).lean(),
    ]);
    const pendingAll = await M.Appointment.find({ tenantId: tid, status: 'pending' }).select('date status').lean();
    const mmdd = t.slice(5); const bday = (await M.Customer.find({ tenantId: tid, doNotContact: { $ne: true }, birthday: { $type: 'string' } }).limit(2000).lean()).filter((c) => c.birthday.slice(5) === mmdd && c.consent && c.consent.at);
    const forWinback = customers.filter((c) => c.consent && c.consent.at).map((c) => ({ id: String(c._id), name: c.name, lastVisit: c.lastVisit, lastServiceKey: c.lastServiceKey, doNotContact: c.doNotContact }));
    return { today: t, yesterday: y, appointments: [...appointments, ...pendingAll.filter((p) => !appointments.some((a) => String(a._id) === String(p._id)))], bills, customers: forWinback, services, upcomingBirthdays: bday.map((c) => ({ id: String(c._id), name: c.name })) };
  };
  router.get('/summary/today', adminOnly, wrap(async (req, res, tid) => { res.set('Cache-Control', 'no-store'); res.json({ success: true, data: dailySummary(await gather(tid)) }); }));
  router.get('/lists/winback', adminOnly, wrap(async (req, res, tid) => {
    const g = await gather(tid); const cycles = {}; g.services.forEach((s) => { if (Number.isInteger(s.cycleDays)) cycles[s.key] = s.cycleDays; });
    res.json({ success: true, data: { lapsed: lapsed(g.customers, g.today, 60), dueForRebook: dueForRebook(g.customers, g.today, cycles), note: 'Only customers who agreed to be contacted are listed. Nothing is sent from here.' } });
  }));

  // ---- accounts: expenses, dues, day close, P&L, GST, CA export (owner only; we do not file GST) ----
  const refundsIn = (tid, from, to) => M.Return.find({ tenantId: tid, date: { $gte: from, $lte: to } }).limit(5000).lean();
  const audit = (tid, req, action, ref) => M.Audit.create({ tenantId: tid, by: req.user.id, action, ref }).catch(() => {});
  const range = (req) => { const from = str(req.query.from, 10); const to = str(req.query.to, 10); if (!B.validDate(from) || !B.validDate(to) || from > to || B.daysBetween(from, to) > 366) throw field('Pick from and to dates (up to one year).'); return { from, to }; };
  // The panel's list screen sends no dates: default to the last 60 days (D-28: nothing to type to see the list).
  const rangeOr = (req, days) => (req.query.from || req.query.to ? range(req) : { from: B.addDays(today(), -days), to: today() });
  router.get('/expenses', adminOnly, wrap(async (req, res, tid) => { const { from, to } = rangeOr(req, 60); res.json({ success: true, data: (await M.Expense.find({ tenantId: tid, date: { $gte: from, $lte: to } }).sort({ date: -1 }).limit(500)).map(plain) }); }));
  router.post('/expenses', adminOnly, wrap(async (req, res, tid) => {
    const b = req.body || {}; const amount = Math.round(Number(b.amount)); if (!Number.isInteger(amount) || amount < 1 || amount > 10000000) throw field('Enter the amount in whole rupees.');
    const date = B.validDate(b.date) ? b.date : today(); const paid = b.paid !== false;
    if (!paid && !B.validDate(b.dueDate)) throw field('For an unpaid expense, give the due date.');
    const d = await M.Expense.create({ tenantId: tid, date, category: A.CATEGORIES.includes(b.category) ? b.category : 'other', amount, paidTo: str(b.paidTo, 120) || undefined, method: ['cash', 'upi', 'card', 'bank'].includes(b.method) ? b.method : 'cash', paid, dueDate: paid ? undefined : b.dueDate, note: str(b.note, 200) || undefined });
    await audit(tid, req, 'expense.add', String(d._id)); res.status(201).json({ success: true, data: plain(d) });
  }));
  router.post('/expenses/:id/paid', adminOnly, wrap(async (req, res, tid) => {
    const d = await M.Expense.findOneAndUpdate({ _id: isId(req.params.id) ? req.params.id : null, tenantId: tid, paid: false }, { $set: { paid: true, date: today() } }, { new: true }); if (!d) return fail(res, 404, 'No unpaid expense found.');
    await audit(tid, req, 'expense.paid', String(d._id)); res.json({ success: true });
  }));
  router.get('/dues', adminOnly, wrap(async (req, res, tid) => {
    const bills = await M.Bill.find({ tenantId: tid, due: { $gt: 0 } }).sort({ date: -1 }).limit(500).lean(); const exp = await M.Expense.find({ tenantId: tid, paid: false }).limit(500).lean();
    res.json({ success: true, data: { customerDues: A.customerDues(bills), supplierDues: A.supplierDues(exp), cashNeededNext14Days: P.cashNeeded(A.supplierDues(exp), today()), currency: 'INR' } });
  }));
  router.get('/day-close', adminOnly, wrap(async (req, res, tid) => {
    const date = str(req.query.date, 10) || today(); if (!B.validDate(date)) throw field('Pick a valid date.');
    const prev = await M.DayClose.findOne({ tenantId: tid, date: { $lt: date } }).sort({ date: -1 }).lean(); const bills = await M.Bill.find({ tenantId: tid, date }).lean(); const exp = await M.Expense.find({ tenantId: tid, date }).lean();
    const saved = await M.DayClose.findOne({ tenantId: tid, date }).lean();
    res.json({ success: true, data: { saved: saved || null, suggestedOpening: prev ? prev.counted : 0, preview: A.dayClose({ openingCash: saved ? saved.openingCash : prev ? prev.counted : 0, bills, expenses: exp, countedCash: saved ? saved.counted : 0, refunds: await refundsIn(tid, date, date) }) } });
  }));
  router.post('/day-close', adminOnly, wrap(async (req, res, tid) => {
    const b = req.body || {}; const date = B.validDate(b.date) ? b.date : today(); const counted = Math.round(Number(b.countedCash)); const opening = Math.round(Number(b.openingCash));
    if (!Number.isInteger(counted) || counted < 0 || !Number.isInteger(opening) || opening < 0) throw field('Enter the opening and counted cash in whole rupees.');
    const bills = await M.Bill.find({ tenantId: tid, date }).lean(); const exp = await M.Expense.find({ tenantId: tid, date }).lean();
    const c = A.dayClose({ openingCash: opening, bills, expenses: exp, countedCash: counted, refunds: await refundsIn(tid, date, date) });
    const d = await M.DayClose.findOneAndUpdate({ tenantId: tid, date }, { $set: { openingCash: c.openingCash, cashSales: c.cashSales, cashExpenses: c.cashExpenses, expected: c.expected, counted: c.counted, difference: c.difference, note: str(b.note, 200) || undefined } }, { new: true, upsert: true });
    await audit(tid, req, c.difference ? 'dayclose.difference' : 'dayclose.ok', date); res.json({ success: true, data: { ...plain(d), text: c.text } });
  }));
  router.get('/accounts/pnl', adminOnly, wrap(async (req, res, tid) => {
    const { from, to } = range(req); const bills = await M.Bill.find({ tenantId: tid, date: { $gte: from, $lte: to } }).lean(); const exp = await M.Expense.find({ tenantId: tid, date: { $gte: from, $lte: to } }).lean();
    const commissionTotal = bills.filter((b) => b.status !== 'void').reduce((t, b) => t + Object.values(b.commissions || {}).reduce((x, y) => x + y, 0), 0);
    res.json({ success: true, data: A.profitAndLoss({ bills, expenses: exp, commissionTotal, refunds: await refundsIn(tid, from, to) }) });
  }));
  router.get('/accounts/gst', adminOnly, wrap(async (req, res, tid) => { const { from, to } = range(req); res.json({ success: true, data: A.gstSummary(await M.Bill.find({ tenantId: tid, date: { $gte: from, $lte: to } }).lean(), await refundsIn(tid, from, to)) }); }));
  router.get('/accounts/export.csv', adminOnly, wrap(async (req, res, tid) => {
    const { from, to } = range(req); const bills = await M.Bill.find({ tenantId: tid, date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean(); const exp = await M.Expense.find({ tenantId: tid, date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean();
    await audit(tid, req, 'export.ca', from + '..' + to);
    res.set('Content-Type', 'text/csv; charset=utf-8'); res.set('Content-Disposition', 'attachment; filename="groom-accounts.csv"'); res.set('X-Content-Type-Options', 'nosniff'); res.send(A.caCsv({ bills, expenses: exp, refunds: await refundsIn(tid, from, to) }));
  }));

  // ---- sales reports, estimates, leak checks, marketing ideas (owner only; all suggest or estimate) ----
  router.get('/reports/sales', adminOnly, wrap(async (req, res, tid) => { const { from, to } = range(req); res.json({ success: true, data: salesReport(await M.Bill.find({ tenantId: tid, date: { $gte: from, $lte: to } }).lean()) }); }));
  router.get('/predictions', adminOnly, wrap(async (req, res, tid) => {
    const t = today(); const since = B.addDays(t, -400);
    const bills = await M.Bill.find({ tenantId: tid, date: { $gte: since } }).select('date taxable').lean(); const monthly = monthlyTotals(bills); delete monthly[t.slice(0, 7)];
    const visits = await M.Appointment.find({ tenantId: tid, status: 'done', date: { $gte: B.addDays(t, -120) } }).select('date start').limit(5000).lean();
    const past = await M.Appointment.find({ tenantId: tid, status: 'done', date: { $gte: B.addDays(t, -365) } }).select('customerId date').limit(20000).lean(); const history = {};
    past.forEach((a) => { const k = String(a.customerId); (history[k] = history[k] || []).push(a.date); });
    const cs = await M.Customer.find({ tenantId: tid, _id: { $in: Object.keys(history).filter(isId) } }).select('name doNotContact consent').lean(); const names = {}, dnc = {}; const ok = {};
    cs.forEach((c) => { names[String(c._id)] = c.name; dnc[String(c._id)] = c.doNotContact === true || !(c.consent && c.consent.at); ok[String(c._id)] = true; });
    const exp = await M.Expense.find({ tenantId: tid, paid: false }).lean();
    res.json({ success: true, data: { note: 'These are estimates from your own data, not promises. Each one says what it used.', nextMonthSales: P.nextMonthRange(monthly), busyTimes: P.busyTimes(visits), likelyToLapse: P.lapseRisk({ history, today: t, names, doNotContact: dnc }), cashForDues: P.cashNeeded(A.supplierDues(exp), t) } });
  }));
  router.get('/alerts', adminOnly, wrap(async (req, res, tid) => {
    const t = today(); const from = B.addDays(t, -30);
    const bills = await M.Bill.find({ tenantId: tid, date: { $gte: from } }).select('number date discount discountReason subtotal discountBy discountPercent status total voidReason').lean(); const returns = await refundsIn(tid, from, t); const prods = await M.Product.find({ tenantId: tid, isActive: true }).limit(500).lean(); const closes = await M.DayClose.find({ tenantId: tid, date: { $gte: from } }).select('date difference').lean();
    res.json({ success: true, data: { items: L.leakList({ bills, closes, returns, stock: { counts: await M.StockCount.find({ tenantId: tid, date: { $gte: from } }).limit(200).lean(), negative: prods.filter((p) => p.stock < 0), low: prods.filter((p) => p.stock >= 0 && p.reorderLevel > 0 && p.stock <= p.reorderLevel) } }), note: 'These are things to look at, not accusations.' } });
  }));
  router.get('/marketing/ideas', adminOnly, wrap(async (req, res, tid) => {
    const t = await tenantDoc(tid); const y = B.addDays(today(), -1);
    const done = await M.Appointment.find({ tenantId: tid, date: y, status: 'done' }).select('customerId reviewAsked').lean(); const cs = await M.Customer.find({ tenantId: tid, _id: { $in: done.map((d) => d.customerId) } }).select('consent doNotContact').lean(); const cm = {}; cs.forEach((c) => { cm[String(c._id)] = c; });
    const visits = done.map((d) => ({ customerId: String(d.customerId), status: 'done', consent: !!(cm[String(d.customerId)] && cm[String(d.customerId)].consent && cm[String(d.customerId)].consent.at), doNotContact: !!(cm[String(d.customerId)] && cm[String(d.customerId)].doNotContact), reviewAsked: d.reviewAsked }));
    res.json({ success: true, data: { suggestOnly: true, ideas: [...Mk.festivalIdeas(t.festivals, today()), ...Mk.reviewRequests(visits).slice(0, 20)], bookingLink: 'Share your booking link or its QR on WhatsApp status and at the counter.' } });
  }));

  // ---- settings and booking link (owner only) ----
  router.get('/settings', adminOnly, wrap(async (req, res, tid) => { const t = await tenantDoc(tid); res.json({ success: true, data: { ...t, id: String(t._id) } }); }));
  router.put('/settings', adminOnly, wrap(async (req, res, tid) => {
    const b = req.body || {}; const set = {};
    if (['instant', 'approve'].includes(b.bookingMode)) set.bookingMode = b.bookingMode;
    if (Array.isArray(b.windows) && b.windows.length <= 4 && b.windows.every((w) => Array.isArray(w) && w.length === 2 && Number.isInteger(w[0]) && Number.isInteger(w[1]) && w[0] >= 0 && w[1] <= 1440 && w[0] < w[1])) set.windows = b.windows;
    if (Array.isArray(b.closedWeekdays) && b.closedWeekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) set.closedWeekdays = b.closedWeekdays;
    if (['gst_inclusive', 'gst_exclusive', 'none'].includes(b.taxMode)) set.taxMode = b.taxMode;
    if (Number.isInteger(b.slotStep) && b.slotStep >= 5 && b.slotStep <= 120) set.slotStep = b.slotStep;
    if (Number.isInteger(b.bufferMins) && b.bufferMins >= 0 && b.bufferMins <= 60) set.bufferMins = b.bufferMins;
    if (Array.isArray(b.festivals) && b.festivals.length <= 30 && b.festivals.every((f) => f && str(f.name, 60) && B.validDate(f.date))) set.festivals = b.festivals.map((f) => ({ name: str(f.name, 60), date: f.date, offer: str(f.offer, 200) }));
    if (b.loyaltyRule && typeof b.loyaltyRule === 'object') set.loyaltyRule = LR.normalize(b.loyaltyRule);
    if (b.discountRule && typeof b.discountRule === 'object') set.discountRule = DP.normalize(b.discountRule);
    if ('gstin' in b) set.gstin = str(b.gstin, 15); if ('address' in b) set.address = str(b.address, 200);
    if (b.commissionRules && typeof b.commissionRules === 'object' && !Array.isArray(b.commissionRules)) set.commissionRules = JSON.parse(JSON.stringify(b.commissionRules)); // plain data only; bad rules are ignored by commission.js
    if (!Object.keys(set).length) throw field('Nothing to change.');
    await M.Tenant.updateOne({ _id: tid }, { $set: set }); res.json({ success: true });
  }));
  router.post('/settings/booking-link/rotate', adminOnly, wrap(async (req, res, tid) => {
    const token = crypto.randomBytes(24).toString('hex'); await M.Tenant.updateOne({ _id: tid }, { $set: { bookingToken: token } }); res.json({ success: true, data: { token } });
  }));
  return router;
}

// ---- public booking link: the secret token is the only key; consent tick required; rate limited ----
function createPublicRouter({ express, mongoose, limiter = makeLimiter() }) {
  const router = express.Router(); const M = makeModels(mongoose); const booker = makeBooker(M); const fail = makeFail();
  const tenantOfToken = async (token) => (typeof token === 'string' && /^[0-9a-f]{48}$/.test(token) ? runUnscoped('public booking link: find the business by its secret token', () => M.Tenant.findOne({ bookingToken: token, isActive: { $ne: false } }).lean()) : null);
  const guard = (fn) => async (req, res) => {
    try {
      const t = await tenantOfToken(req.params.token); if (!t) return fail(res, 404, 'This link is not valid.');
      if (!limiter.allow(String(t._id) + '|' + (req.ip || ''))) return fail(res, 429, 'Too many tries. Please wait a few minutes.');
      return await runWithTenant(String(t._id), () => fn(req, res, t, String(t._id)));
    } catch (err) {
      if (err.code === 'BOOKING_TAKEN') return fail(res, 409, err.message);
      if (KNOWN.includes(err.code)) return fail(res, 400, err.message);
      console.error('Salon public route failed:', err.message); return fail(res, 500, 'Server error');
    }
  };
  router.get('/:token/page', async (req, res) => {
    try {
      const t = await tenantOfToken(req.params.token); if (!t) return fail(res, 404, 'This link is not valid.');
      res.set({ 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' });
      res.send(BP.page(t.businessName, { clinic: t.preset === 'clinic' }));
    } catch (err) { console.error('Salon booking page failed:', err.message); fail(res, 500, 'Server error'); }
  });
  router.get('/:token', guard(async (req, res, t, tid) => {
    const [services, staff] = await Promise.all([M.Service.find({ tenantId: tid, isActive: true }).lean(), M.Staff.find({ tenantId: tid, isActive: true }).lean()]);
    res.json({ success: true, data: { businessName: t.businessName, preset: t.preset, mode: t.bookingMode, services: services.map((s) => ({ key: s.key, name: s.name, mins: s.mins, price: s.price, currency: s.currency })), staff: staff.map((s) => ({ id: String(s._id), name: s.name, serviceKeys: s.serviceKeys })) } });
  }));
  router.get('/:token/slots', guard(async (req, res, t, tid) => { const q = req.query || {}; res.json({ success: true, data: await booker.slots(tid, t, { date: str(q.date, 10), staffId: isId(q.staffId) ? q.staffId : '', serviceKey: str(q.serviceKey, 40) }) }); }));
  router.post('/:token/book', guard(async (req, res, t, tid) => {
    const b = req.body || {};
    const r = await booker.book(tid, t, { date: str(b.date, 10), start: b.start, staffId: isId(b.staffId) ? b.staffId : '', serviceKey: str(b.serviceKey, 40), name: b.name, phone: b.phone, consent: b.consent, source: 'public' });
    if (t.preset === 'clinic' && BP.AREAS.includes(b.bodyArea)) await M.Appointment.updateOne({ _id: r.appointment._id, tenantId: tid }, { $set: { bodyArea: b.bodyArea } });
    // The customer sees only their own booking details; a manage code lets them cancel (the id is not guessable: 24 hex).
    res.status(201).json({ success: true, data: { id: String(r.appointment._id), status: r.appointment.status, date: r.appointment.date, start: r.appointment.start, serviceName: r.appointment.serviceName, businessName: t.businessName } });
  }));
  router.post('/:token/appointments/:id/cancel', guard(async (req, res, t, tid) => {
    const ph = B.cleanPhone((req.body || {}).phone); const a = isId(req.params.id) ? await M.Appointment.findOne({ _id: req.params.id, tenantId: tid, active: true }) : null;
    const c = a ? await M.Customer.findOne({ _id: a.customerId, tenantId: tid }) : null;
    if (!a || !c || c.phone !== ph) return fail(res, 404, 'Booking not found.');
    await M.Appointment.updateOne({ _id: a._id, tenantId: tid }, { $set: { status: 'cancelled', active: false } }); res.json({ success: true });
  }));
  return router;
}
// Small in-memory limiter: at most `max` public calls per key per window. One server process (Assumption for the first launch).
function makeLimiter({ max = 40, windowMs = 10 * 60000, now = () => Date.now() } = {}) {
  const hits = new Map();
  return { allow(key) { const t = now(); const arr = (hits.get(key) || []).filter((x) => t - x < windowMs); if (arr.length >= max) { hits.set(key, arr); return false; } arr.push(t); hits.set(key, arr); if (hits.size > 5000) hits.clear(); return true; } };
}
module.exports = { createSalonRouter, createPublicRouter, makeLimiter, makeBooker, makeFail, makeWrap, field, str, plain, isId };
