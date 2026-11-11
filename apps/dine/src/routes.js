'use strict';
// Dine routes. Mount: app.use('/api/dine', createDineRouter({ express, mongoose, protect, tenantOf, planOf, guardWrite })).
// Every handler runs inside the venue's tenant context (set by the session middleware) AND filters by tenantId by hand.
// Every route names the permission it needs (staff.js); a role without it gets 403. `protect`, `guardWrite` are injected.
const crypto = require('crypto');
const D = require('./index');
const { bill } = require('../../../packages/core-pos/src/pure');
const makeModels = require('./models');
const { checkLimit } = require('./plans');

const str = (v, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const OID = /^[a-f0-9]{24}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KNOWN = ['MENU_INVALID', 'ORDER_INVALID', 'SPLIT_INVALID', 'GST_INVALID', 'COST_INVALID', 'PUB_INVALID', 'ACCOUNTS_INVALID', 'MARKETING_INVALID', 'BILL_INVALID', 'PLAN_UNKNOWN'];
const plain = (d) => { const o = d && d.toObject ? d.toObject() : d; return o ? { ...o, id: String(o._id) } : o; };
const addDays = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const startOf = (date) => new Date(Date.parse(date + 'T00:00:00Z') - 5.5 * 3600000); // start of that IST day, as a UTC instant

function createDineRouter({ express, mongoose, models, protect, tenantOf, planOf, guardWrite, now = () => new Date() }) {
  const router = express.Router();
  const M = models || makeModels(mongoose);
  router.use(protect);
  if (guardWrite) router.use((req, res, next) => { const g = guardWrite(req); return g.ok ? next() : res.status(g.httpStatus || 402).json({ success: false, message: g.message, code: 'read_only' }); });
  const fail = (res, code, message) => res.status(code).json({ success: false, message });
  // def(method, path, permission, handler): permission check, error mapping, tenant id.
  const def = (method, path, perm, fn) => router[method](path, async (req, res) => {
    try {
      if (!D.can(req.user && req.user.staffRole, perm)) return fail(res, 403, 'Not allowed for your role.');
      await fn(req, res, tenantOf(req));
    } catch (err) {
      if (KNOWN.includes(err.code)) return fail(res, 400, err.message);
      if (err.code === 11000) return fail(res, 409, 'That value is already used.');
      if (err.name === 'ValidationError' || err.name === 'CastError') return fail(res, 400, 'Check the values you entered.');
      console.error('Dine route failed:', err.message); return fail(res, 500, 'Server error');
    }
  });
  const settingsOf = async (tid) => { const t = await M.Tenant.findById(tid); const s = (t && t.settings) || {}; return { gstProfile: s.gstProfile || 'none', serviceChargePct: s.serviceChargePct || 0, pubMode: !!s.pubMode, festivals: s.festivals || [], happyRules: s.happyRules || [], reviewLink: s.reviewLink || '', venueName: (t && t.venueName) || 'us' }; };
  const log = (tid, req, action, ref) => M.Activity.create({ tenantId: tid, by: req.user.id, action, ref: ref ? String(ref).slice(0, 60) : undefined });
  const loadOrder = async (tid, id) => { if (!OID.test(String(id))) return null; return plain(await M.Order.findOne({ _id: id, tenantId: tid })); };
  // Optimistic save: only succeeds if nobody else changed the order since we read it (events grows by one on every change).
  const saveOrder = async (tid, before, after, extra) => {
    const r = await M.Order.findOneAndUpdate({ _id: before.id, tenantId: tid, events: { $size: before.events.length } }, { $set: { status: after.status, lines: after.lines, events: after.events, ...(extra || {}) } }, { new: true });
    if (!r) { const e = new Error('Someone else just changed this order. Reload and try again.'); e.code = 'ORDER_INVALID'; throw e; }
    return plain(r);
  };
  const priceOrder = (o, settings) => {
    const live = D.live(o); const inp = D.toBillInput(live.map((l) => ({ ...l, itemId: l.itemKey })), settings.gstProfile);
    const c = bill.compute({ lines: inp.lines, taxMode: inp.taxMode });
    const sc = D.serviceCharge(c.taxable, settings.serviceChargePct);
    return { computed: c, serviceCharge: sc, grandTotal: c.total + sc, totals: { subtotal: c.subtotal, discount: c.discount, taxable: c.taxable, gst: c.gst, cgst: c.cgst, sgst: c.sgst, igst: c.igst, total: c.total, lines: c.lines.map((l) => ({ name: l.name, qty: l.qty, total: l.total, taxable: l.taxable, gst: l.gst, rate: l.rate, itemKey: l.itemId || null })) } };
  };
  const paidBills = async (tid, from, to) => (await M.Order.find({ tenantId: tid, status: 'paid', paidAt: { $gte: startOf(from), $lt: startOf(addDays(to, 1)) } }).limit(5000)).map((d) => D.orderToBill(plain(d)));
  const range = (req) => { const to = DATE.test(req.query.to || '') ? req.query.to : D.istParts(now()).date; const from = DATE.test(req.query.from || '') ? req.query.from : addDays(to, -29); return { from, to }; };

  // ---- settings ----
  def('get', '/settings', 'orders', async (req, res, tid) => res.json({ success: true, data: await settingsOf(tid) }));
  def('put', '/settings', 'staff', async (req, res, tid) => {
    const b = req.body || {}; const set = {};
    if (b.gstProfile !== undefined) { D.profileFor(b.gstProfile); set['settings.gstProfile'] = b.gstProfile; }
    if (b.serviceChargePct !== undefined) { const n = Number(b.serviceChargePct); if (!(n >= 0 && n <= 20)) return fail(res, 400, 'Service charge must be 0 to 20 percent.'); set['settings.serviceChargePct'] = n; }
    if (b.pubMode !== undefined) { if (b.pubMode === true && !(await planAllows(req, 'pubMode'))) return fail(res, 403, 'Pub mode is not in your plan.'); set['settings.pubMode'] = b.pubMode === true; }
    if (b.reviewLink !== undefined) { const l = str(b.reviewLink, 300); if (l && !/^https:\/\//.test(l)) return fail(res, 400, 'Review link must start with https://'); set['settings.reviewLink'] = l; }
    if (Array.isArray(b.festivals)) set['settings.festivals'] = b.festivals.slice(0, 40).filter((f) => f && DATE.test(f.date || '') && str(f.name)).map((f) => ({ name: str(f.name, 60), date: f.date, offerIdea: str(f.offerIdea, 160) }));
    if (Array.isArray(b.happyRules)) {
      const rules = b.happyRules.slice(0, 10).map((r) => ({ label: str(r.label, 40) || 'Offer', days: (Array.isArray(r.days) ? r.days : []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6), from: str(r.from, 5), to: str(r.to, 5), type: r.type, value: r.value, appliesTo: Array.isArray(r.appliesTo) ? r.appliesTo.slice(0, 50).map((k) => str(k, 40)) : undefined }));
      for (const r of rules) { if (!['percent_off', 'amount_off'].includes(r.type) || !Number.isInteger(r.value) || r.value < 0 || (r.type === 'percent_off' && r.value > 100) || !r.days.length) return fail(res, 400, 'Each time offer needs days, times, a type and a whole-number value.'); D.ruleActive(r, { day: 0, minutes: 0 }); }
      if (rules.length && !(await settingsOf(tid)).pubMode) return fail(res, 403, 'Time offers are part of pub mode.');
      set['settings.happyRules'] = rules;
    }
    if (!Object.keys(set).length) return fail(res, 400, 'Nothing to change.');
    await M.Tenant.updateOne({ _id: tid }, { $set: set }); await log(tid, req, 'settings.change'); res.json({ success: true, data: await settingsOf(tid) });
  });
  const planAllows = async (req, field) => { try { const p = planOf && planOf(req); return !!(p && require('./plans').PLANS[p] && require('./plans').PLANS[p][field]); } catch (e) { return false; } };

  // ---- menu ----
  def('get', '/menu', 'orders', async (req, res, tid) => res.json({ success: true, data: (await M.MenuItem.find({ tenantId: tid, isActive: true }).sort({ category: 1, name: 1 }).limit(1000)).map(plain) }));
  const menuBody = (b) => ({ key: str(b.key, 40), name: str(b.name), category: str(b.category, 60), price: b.price, gstRate: b.gstRate === undefined ? 5 : b.gstRate, kind: b.kind || 'food', station: b.station, variants: b.variants || [], groups: b.groups || [] });
  def('post', '/menu', 'menu', async (req, res, tid) => {
    const m = menuBody(req.body || {}); D.checkItem(m);
    if (m.kind === 'liquor' && !(await settingsOf(tid)).pubMode) return fail(res, 403, 'Turn on pub mode in settings to add drinks with alcohol.');
    res.status(201).json({ success: true, data: plain(await M.MenuItem.create({ tenantId: tid, ...m, station: m.station || (m.kind === 'liquor' ? 'bar' : 'kitchen') })) });
  });
  def('put', '/menu/:key', 'menu', async (req, res, tid) => {
    const m = menuBody({ ...(req.body || {}), key: req.params.key }); D.checkItem(m);
    const r = await M.MenuItem.findOneAndUpdate({ tenantId: tid, key: m.key }, { $set: { name: m.name, category: m.category, price: m.price, gstRate: m.gstRate, kind: m.kind, station: m.station, variants: m.variants, groups: m.groups } }, { new: true });
    if (!r) return fail(res, 404, 'Item not found'); res.json({ success: true, data: plain(r) });
  });
  def('delete', '/menu/:key', 'menu', async (req, res, tid) => { const r = await M.MenuItem.findOneAndUpdate({ tenantId: tid, key: str(req.params.key, 40) }, { $set: { isActive: false } }); if (!r) return fail(res, 404, 'Item not found'); res.json({ success: true }); });

  // ---- orders ----
  def('post', '/orders', 'orders', async (req, res, tid) => {
    const type = req.body && req.body.type; const table = str(req.body && req.body.table, 20) || null;
    if (type === 'bar' && !(await settingsOf(tid)).pubMode) return fail(res, 403, 'Turn on pub mode in settings to use bar tabs.');
    if (table && planOf) { const open = await M.Order.countDocuments({ tenantId: tid, status: { $in: ['open', 'sent', 'served', 'billed'] } }); const lim = checkLimit(planOf(req), 'tables', open); if (!lim.ok) return fail(res, 429, 'Your plan allows ' + lim.cap + ' open orders at a time.'); }
    const t = now(); const p = D.istParts(t);
    const o = D.newOrder({ id: 'x', type: type || 'dine_in', table, by: req.user.id }, t.toISOString());
    const c = await M.Counter.findOneAndUpdate({ tenantId: tid, key: 'order-' + p.date.slice(0, 4) }, { $inc: { seq: 1 } }, { new: true, upsert: true });
    const doc = await M.Order.create({ tenantId: tid, number: 'D-' + p.date.slice(2, 4) + '-' + String(c.seq).padStart(5, '0'), type: o.type, table: o.table, status: 'open', lines: [], events: o.events, staffId: req.user.id, openedDate: p.date, openedHour: p.hour });
    res.status(201).json({ success: true, data: plain(doc) });
  });
  def('get', '/orders', 'orders', async (req, res, tid) => {
    const status = ['open', 'sent', 'served', 'billed', 'paid'].includes(req.query.status) ? req.query.status : null;
    const q = { tenantId: tid, ...(status ? { status } : { status: { $in: ['open', 'sent', 'served', 'billed'] } }) };
    res.json({ success: true, data: (await M.Order.find(q).sort({ createdAt: -1 }).limit(200)).map(plain) });
  });
  def('get', '/orders/:id', 'orders', async (req, res, tid) => { const o = await loadOrder(tid, req.params.id); if (!o) return fail(res, 404, 'Order not found'); res.json({ success: true, data: o }); });
  def('post', '/orders/:id/lines', 'orders', async (req, res, tid) => {
    const o = await loadOrder(tid, req.params.id); if (!o) return fail(res, 404, 'Order not found');
    const b = req.body || {}; const item = plain(await M.MenuItem.findOne({ tenantId: tid, key: str(b.itemKey, 40), isActive: true })); if (!item) return fail(res, 404, 'Menu item not found');
    const settings = await settingsOf(tid); if (item.kind === 'liquor' && !settings.pubMode) return fail(res, 403, 'Pub mode is off.');
    let unit = item.price; let rule = null;
    const priced = D.priceLine({ ...item, key: item.key }, { variantKey: b.variantKey, optionKeys: b.optionKeys, qty: b.qty });
    if (item.kind === 'liquor' && Array.isArray(settings.happyRules) && settings.happyRules.length) { const p = D.istParts(now()); const r = D.priceNow({ key: item.key, price: unit }, settings.happyRules, p); if (r.rule) { priced.unitPrice = Math.max(0, priced.unitPrice - (unit - r.price)); rule = r.rule; } }
    const t = now().toISOString();
    const next = D.addLine(o, { id: crypto.randomBytes(4).toString('hex'), itemKey: item.key, name: priced.name, qty: priced.qty, unitPrice: priced.unitPrice, gstRate: priced.gstRate, kind: priced.kind, station: priced.station, note: priced.note, ...(rule ? { priceRule: rule } : {}) }, t, req.user.id);
    res.status(201).json({ success: true, data: await saveOrder(tid, o, next) });
  });
  def('post', '/orders/:id/kot', 'orders', async (req, res, tid) => {
    const o = await loadOrder(tid, req.params.id); if (!o) return fail(res, 404, 'Order not found');
    const k = D.sendKot(o, now().toISOString(), req.user.id); const saved = await saveOrder(tid, o, k.order);
    res.json({ success: true, data: saved, tickets: k.tickets, table: o.table, number: o.number });
  });
  def('get', '/kitchen', 'kot_view', async (req, res, tid) => {
    const station = req.query.station === 'bar' ? 'bar' : 'kitchen';
    const rows = await M.Order.find({ tenantId: tid, status: { $in: ['sent'] } }).sort({ createdAt: 1 }).limit(100);
    res.json({ success: true, data: rows.map(plain).map((o) => ({ id: o.id, number: o.number, table: o.table, lines: o.lines.filter((l) => l.status === 'sent' && (l.station || 'kitchen') === station).map((l) => ({ id: l.id, name: l.name, qty: l.qty, note: l.note })) })).filter((o) => o.lines.length) });
  });
  def('post', '/orders/:id/lines/:lineId/void', 'void', async (req, res, tid) => {
    const o = await loadOrder(tid, req.params.id); if (!o) return fail(res, 404, 'Order not found');
    const next = D.voidLine(o, str(req.params.lineId, 20), { reason: str(req.body && req.body.reason, 200), by: req.user.id }, now().toISOString());
    const saved = await saveOrder(tid, o, next); await log(tid, req, 'order.void', o.number); res.json({ success: true, data: saved });
  });
  def('post', '/orders/:id/served', 'orders', async (req, res, tid) => {
    const o = await loadOrder(tid, req.params.id); if (!o) return fail(res, 404, 'Order not found');
    res.json({ success: true, data: await saveOrder(tid, o, D.markServed(o, (req.body && req.body.lineIds) || [], now().toISOString(), req.user.id)) });
  });
  def('post', '/orders/:id/bill', 'bill', async (req, res, tid) => {
    const o = await loadOrder(tid, req.params.id); if (!o) return fail(res, 404, 'Order not found');
    const settings = await settingsOf(tid); const billed = D.requestBill(o, now().toISOString(), req.user.id); const pr = priceOrder(billed, settings);
    const saved = await saveOrder(tid, o, billed, { totals: pr.totals, serviceCharge: pr.serviceCharge, grandTotal: pr.grandTotal });
    res.json({ success: true, data: saved, gstProfile: D.profileFor(settings.gstProfile), note: settings.gstProfile === 'none' ? null : 'GST profile is not yet confirmed by your CA.' });
  });
  def('post', '/orders/:id/reopen', 'bill', async (req, res, tid) => {
    const o = await loadOrder(tid, req.params.id); if (!o) return fail(res, 404, 'Order not found');
    const next = D.reopen(o, { reason: str(req.body && req.body.reason, 200), by: req.user.id }, now().toISOString());
    const saved = await saveOrder(tid, o, next, { totals: null, grandTotal: null, serviceCharge: 0 }); await log(tid, req, 'order.reopen', o.number); res.json({ success: true, data: saved });
  });
  def('post', '/orders/:id/split', 'bill', async (req, res, tid) => {
    const o = await loadOrder(tid, req.params.id); if (!o) return fail(res, 404, 'Order not found');
    if (o.status !== 'billed' && o.status !== 'paid') return fail(res, 400, 'Bill the order first.');
    const settings = await settingsOf(tid); const pr = priceOrder(o, settings); const b = req.body || {}; const guests = Number(b.guests);
    const parts = b.mode === 'items' ? D.splitByItems(pr.computed, b.assign, guests, pr.serviceCharge) : D.splitEqual(pr.grandTotal, guests);
    res.json({ success: true, data: { mode: b.mode === 'items' ? 'items' : 'equal', parts, total: pr.grandTotal, currency: 'INR' } });
  });
  def('post', '/orders/:id/pay', 'bill', async (req, res, tid) => {
    const o = await loadOrder(tid, req.params.id); if (!o) return fail(res, 404, 'Order not found');
    if (o.status !== 'billed') return fail(res, 400, 'Bill the order before taking payment.');
    const payments = (Array.isArray(req.body && req.body.payments) ? req.body.payments : []).map((p) => ({ method: str(p.method, 12), amount: Number(p.amount) }));
    if (payments.some((p) => p.method === 'credit')) return fail(res, 400, 'Pay-later is not available in Dine yet.');
    const s = bill.settle(o.grandTotal, payments); if (s.status !== 'paid') return fail(res, 400, 'Payment is short by Rs ' + s.due + '.');
    const t = now(); const events = [...o.events, { at: t.toISOString(), by: req.user.id, what: 'paid' }];
    const r = await M.Order.findOneAndUpdate({ _id: o.id, tenantId: tid, status: 'billed' }, { $set: { status: 'paid', payments, settle: { received: s.received, change: s.change }, paidAt: t, events } }, { new: true });
    if (!r) return fail(res, 409, 'This order was already paid.');
    // Stock: take the recipes' ingredients off. Dishes without a recipe are left alone.
    const sold = D.live(o).filter((l) => l.itemKey).map((l) => ({ dishKey: l.itemKey, qty: l.qty }));
    const recipes = Object.fromEntries((await M.Recipe.find({ tenantId: tid, dishKey: { $in: [...new Set(sold.map((x) => x.dishKey))] } })).map((x) => [x.dishKey, { portion: x.portion, parts: x.parts }]));
    const used = D.deductions(sold, recipes).used;
    for (const id of Object.keys(used)) if (OID.test(id)) await M.Ingredient.updateOne({ _id: id, tenantId: tid }, { $inc: { qty: -used[id] } });
    const phone = str(req.body && req.body.customerPhone, 15);
    if (/^\d{10}$/.test(phone)) await M.Customer.findOneAndUpdate({ tenantId: tid, phone }, { $set: { name: str(req.body.customerName) || 'Guest' }, $addToSet: { visits: D.istParts(t).date } }, { upsert: true });
    res.json({ success: true, data: plain(r), change: s.change });
  });

  // ---- recipes, ingredients, wastage ----
  def('get', '/ingredients', 'stock', async (req, res, tid) => res.json({ success: true, data: (await M.Ingredient.find({ tenantId: tid }).sort({ name: 1 }).limit(1000)).map(plain) }));
  def('post', '/ingredients', 'stock', async (req, res, tid) => {
    const b = req.body || {}; const cost = Number(b.costPerUnit);
    if (!str(b.name) || !(cost >= 0)) return fail(res, 400, 'Give the ingredient a name and a cost per unit.');
    res.status(201).json({ success: true, data: plain(await M.Ingredient.create({ tenantId: tid, name: str(b.name, 80), unit: str(b.unit, 10), costPerUnit: cost, qty: Number(b.qty) || 0, reorderLevel: b.reorderLevel === undefined ? undefined : Number(b.reorderLevel) })) });
  });
  def('get', '/recipes', 'stock', async (req, res, tid) => res.json({ success: true, data: (await M.Recipe.find({ tenantId: tid }).limit(1000)).map(plain) }));
  def('put', '/recipes/:dishKey', 'stock', async (req, res, tid) => {
    const parts = (Array.isArray(req.body && req.body.parts) ? req.body.parts : []).map((p) => ({ ingredientId: str(p.ingredientId, 24), qty: Number(p.qty) }));
    if (!parts.length || parts.some((p) => !OID.test(p.ingredientId) || !(p.qty > 0))) return fail(res, 400, 'Each part needs an ingredient and a quantity above zero.');
    const found = await M.Ingredient.find({ tenantId: tid, _id: { $in: parts.map((p) => p.ingredientId) } }); if (found.length !== new Set(parts.map((p) => p.ingredientId)).size) return fail(res, 400, 'An ingredient is not on your list.');
    const portion = Number(req.body.portion) || 1;
    res.json({ success: true, data: plain(await M.Recipe.findOneAndUpdate({ tenantId: tid, dishKey: str(req.params.dishKey, 40) }, { $set: { portion, parts } }, { new: true, upsert: true })) });
  });
  def('post', '/waste', 'stock', async (req, res, tid) => {
    const b = req.body || {}; const qty = Number(b.qty);
    if (!OID.test(String(b.ingredientId)) || !(qty > 0) || str(b.reason, 60).length < 2) return fail(res, 400, 'Give the ingredient, the quantity and a reason.');
    const ing = await M.Ingredient.findOne({ _id: b.ingredientId, tenantId: tid }); if (!ing) return fail(res, 404, 'Ingredient not found');
    await M.Ingredient.updateOne({ _id: ing._id, tenantId: tid }, { $inc: { qty: -qty } });
    res.status(201).json({ success: true, data: plain(await M.Waste.create({ tenantId: tid, ingredientId: ing._id, qty, reason: str(b.reason, 60), by: req.user.id, date: D.istParts(now()).date })) });
  });

  // ---- cash, day close, purchases, supplier dues ----
  def('post', '/cash', 'cash', async (req, res, tid) => {
    const b = req.body || {}; D.cashBook({ entries: [{ type: b.type, amount: b.amount }] });
    res.status(201).json({ success: true, data: plain(await M.CashEntry.create({ tenantId: tid, date: DATE.test(b.date || '') ? b.date : D.istParts(now()).date, type: b.type, amount: b.amount, category: str(b.category, 40), note: str(b.note, 200), by: req.user.id })) });
  });
  def('get', '/cash', 'cash', async (req, res, tid) => {
    const { from, to } = range(req); const rows = await M.CashEntry.find({ tenantId: tid, date: { $gte: from, $lte: to } }).sort({ date: 1 }).limit(2000);
    res.json({ success: true, data: { ...D.cashBook({ opening: 0, entries: rows.map(plain) }), expenses: D.byCategory(rows.filter((r) => r.type === 'out')) } });
  });
  def('get', '/cash/entries', 'cash', async (req, res, tid) => {
    const { from, to } = range(req); const rows = await M.CashEntry.find({ tenantId: tid, date: { $gte: from, $lte: to } }).sort({ date: -1 }).limit(500);
    res.json({ success: true, data: rows.map(plain) });
  });
  def('post', '/day-close', 'cash', async (req, res, tid) => {
    const b = req.body || {}; const date = DATE.test(b.date || '') ? b.date : D.istParts(now()).date;
    const orders = (await M.Order.find({ tenantId: tid, status: 'paid', paidAt: { $gte: startOf(date), $lt: startOf(addDays(date, 1)) } }).limit(5000)).map(plain);
    const entries = (await M.CashEntry.find({ tenantId: tid, date }).limit(2000)).map(plain);
    const cashIn = entries.filter((e) => e.type === 'in').reduce((a, e) => a + e.amount, 0); const cashOut = entries.filter((e) => e.type === 'out').reduce((a, e) => a + e.amount, 0);
    const c = D.dayClose({ opening: b.opening, cashSales: D.cashTaken(orders, date), cashIn, cashOut, counted: b.counted });
    const row = await M.DayClose.findOneAndUpdate({ tenantId: tid, date }, { $set: { opening: b.opening, cashSales: c.expected - b.opening - cashIn + cashOut, cashIn, cashOut, counted: c.counted, expected: c.expected, difference: c.difference, status: c.status, by: req.user.id } }, { new: true, upsert: true });
    res.json({ success: true, data: { ...c, id: String(row._id), date } });
  });
  def('post', '/purchases', 'stock', async (req, res, tid) => {
    const b = req.body || {}; if (!str(b.supplier) || !Number.isInteger(b.amount) || b.amount < 0 || !DATE.test(b.date || '')) return fail(res, 400, 'Give the supplier, a date and a whole-rupee amount.');
    res.status(201).json({ success: true, data: plain(await M.Purchase.create({ tenantId: tid, supplier: str(b.supplier, 80), date: b.date, amount: b.amount, dueDate: DATE.test(b.dueDate || '') ? b.dueDate : undefined, note: str(b.note, 200) })) });
  });
  def('post', '/supplier-payments', 'cash', async (req, res, tid) => {
    const b = req.body || {}; if (!str(b.supplier) || !Number.isInteger(b.amount) || b.amount < 1 || !DATE.test(b.date || '')) return fail(res, 400, 'Give the supplier, a date and a whole-rupee amount.');
    res.status(201).json({ success: true, data: plain(await M.SupplierPayment.create({ tenantId: tid, supplier: str(b.supplier, 80), date: b.date, amount: b.amount })) });
  });
  def('get', '/supplier-dues', 'cash', async (req, res, tid) => {
    const today = D.istParts(now()).date; const pu = (await M.Purchase.find({ tenantId: tid }).limit(5000)).map(plain); const pa = (await M.SupplierPayment.find({ tenantId: tid }).limit(5000)).map(plain);
    res.json({ success: true, data: D.supplierDues(pu, pa, today) });
  });

  // ---- reports and accounts ----
  def('get', '/reports/sales', 'reports', async (req, res, tid) => {
    const { from, to } = range(req); const bills = await paidBills(tid, from, to); const by = { day: D.byDay, week: D.byWeek, month: D.byMonth, staff: D.byStaff, hour: D.byHour, item: D.byItem }[req.query.by] || D.byDay;
    res.json({ success: true, data: by(bills), from, to, currency: 'INR' });
  });
  def('get', '/reports/profit-loss', 'reports', async (req, res, tid) => {
    const { from, to } = range(req); const bills = await paidBills(tid, from, to);
    const recipes = Object.fromEntries((await M.Recipe.find({ tenantId: tid }).limit(1000)).map((r) => [r.dishKey, { portion: r.portion, parts: r.parts }]));
    const ingredients = Object.fromEntries((await M.Ingredient.find({ tenantId: tid }).limit(1000)).map((i) => [String(i._id), { name: i.name, costPerUnit: i.costPerUnit }]));
    const sold = D.byItemKeys(bills); const fc = D.foodCostPercent(sold, recipes, ingredients);
    const exp = (await M.CashEntry.find({ tenantId: tid, type: 'out', date: { $gte: from, $lte: to } }).limit(5000)).map(plain);
    const staffCost = Math.max(0, parseInt(req.query.staffCost, 10) || 0);
    res.json({ success: true, data: { ...D.profitAndLoss({ salesBeforeGst: bills.reduce((a, b) => a + b.taxable, 0), costOfFood: Math.round(fc.cost), staffCost, expenses: exp }), foodCost: fc, from, to, note: 'Food cost is an estimate from your recipes. Staff cost is what you enter until payroll is connected.' } });
  });
  def('get', '/reports/gst', 'reports', async (req, res, tid) => { const { from, to } = range(req); res.json({ success: true, data: D.gstSummary(await paidBills(tid, from, to)), from, to }); });
  def('get', '/export/ca.csv', 'reports', async (req, res, tid) => {
    const { from, to } = range(req); await log(tid, req, 'export.ca', from + '..' + to);
    res.set('Content-Type', 'text/csv; charset=utf-8').set('Content-Disposition', 'attachment; filename="sales-' + from + '-to-' + to + '.csv"').send(D.caExport(await paidBills(tid, from, to)));
  });

  // ---- customers, marketing, staff ----
  def('get', '/customers/win-back', 'customers', async (req, res, tid) => {
    const s = await settingsOf(tid); const today = D.istParts(now()).date;
    const cs = (await M.Customer.find({ tenantId: tid }).limit(5000)).map((c) => ({ id: String(c._id), name: c.name, doNotContact: c.doNotContact, lastVisit: [...(c.visits || [])].sort().pop() }));
    res.json({ success: true, data: D.winBackList(cs, today, s.venueName), mode: 'suggest' });
  });
  def('get', '/marketing/festivals', 'customers', async (req, res, tid) => res.json({ success: true, data: D.upcomingFestivals((await settingsOf(tid)).festivals, D.istParts(now()).date), mode: 'suggest' }));
  def('post', '/punch', 'orders', async (req, res, tid) => {
    const kind = req.body && req.body.kind; if (!['in', 'out'].includes(kind)) return fail(res, 400, 'Kind must be in or out.');
    res.status(201).json({ success: true, data: plain(await M.Punch.create({ tenantId: tid, userId: req.user.id, kind, at: now().toISOString() })) });
  });
  def('get', '/staff/hours', 'staff', async (req, res, tid) => {
    const { from, to } = range(req); const rows = (await M.Punch.find({ tenantId: tid, at: { $gte: startOf(from).toISOString(), $lt: startOf(addDays(to, 1)).toISOString() } }).limit(5000)).map(plain);
    const by = {}; for (const r of rows) (by[String(r.userId)] = by[String(r.userId)] || []).push({ at: r.at, kind: r.kind });
    res.json({ success: true, data: Object.entries(by).map(([userId, p]) => ({ userId, ...D.hoursWorked(p) })), from, to });
  });

  // ---- predictions and daily summary ----
  const gather = async (tid, days) => {
    const to = D.istParts(now()).date; const from = addDays(to, -(days - 1)); const bills = await paidBills(tid, from, to); return { to, from, bills };
  };
  def('get', '/predictions', 'reports', async (req, res, tid) => {
    const { bills, to } = await gather(tid, 120);
    const months = D.byMonth(bills).map((m) => m.sales); const complete = months.slice(0, -1); // the running month is not complete
    const daily = D.byDay(bills).map((d) => ({ date: d.date, sales: d.sales }));
    const cs = (await M.Customer.find({ tenantId: tid }).limit(5000)).map((c) => ({ id: String(c._id), name: c.name, visits: c.visits || [], doNotContact: c.doNotContact }));
    const ing = (await M.Ingredient.find({ tenantId: tid }).limit(1000)).map((i) => ({ id: String(i._id), name: i.name, qty: i.qty }));
    res.json({ success: true, data: { salesNextMonth: D.salesRange(complete), busyDays: D.busyDays(daily), busyHours: D.busyHours(D.byHour(bills)), likelyToLapse: D.lapseRisk(cs, to).slice(0, 10), stockRunOut: D.stockRunOut(ing, await avgUse(tid, bills), 3) } });
  });
  // Average daily use of each ingredient over the days that had sales (recipes x quantities sold).
  const avgUse = async (tid, bills) => {
    const recipes = Object.fromEntries((await M.Recipe.find({ tenantId: tid }).limit(1000)).map((r) => [r.dishKey, { portion: r.portion, parts: r.parts }]));
    const days = new Set(bills.map((b) => b.date)).size || 1; const used = D.deductions(D.byItemKeys(bills).map((s) => ({ dishKey: s.dishKey, qty: s.qty })), recipes).used;
    return Object.fromEntries(Object.entries(used).map(([k, v]) => [k, v / days]));
  };
  def('get', '/summary/daily', 'reports', async (req, res, tid) => {
    const date = DATE.test(req.query.date || '') ? req.query.date : D.istParts(now()).date; const s = await settingsOf(tid);
    const orders = (await M.Order.find({ tenantId: tid, createdAt: { $gte: startOf(date), $lt: startOf(addDays(date, 1)) } }).limit(5000)).map(plain);
    const bills = orders.filter((o) => o.status === 'paid').map(D.orderToBill);
    const leak = orders.reduce((a, o) => { const c = D.counts(o); return { voidsAfterSend: a.voidsAfterSend + c.voidsAfterSend, reopens: a.reopens + c.reopens }; }, { voidsAfterSend: 0, reopens: 0 });
    const closeRow = await M.DayClose.findOne({ tenantId: tid, date });
    const recipes = Object.fromEntries((await M.Recipe.find({ tenantId: tid }).limit(1000)).map((r) => [r.dishKey, { portion: r.portion, parts: r.parts }]));
    const ingDocs = await M.Ingredient.find({ tenantId: tid }).limit(1000); const ingredients = Object.fromEntries(ingDocs.map((i) => [String(i._id), { name: i.name, costPerUnit: i.costPerUnit }]));
    const fc = D.foodCostPercent(D.byItemKeys(bills).map((x) => ({ dishKey: x.dishKey, qty: x.qty, revenue: x.revenue })), recipes, ingredients);
    const hist = await paidBills(tid, addDays(date, -13), date);
    const cs = (await M.Customer.find({ tenantId: tid }).limit(5000)).map((c) => ({ id: String(c._id), name: c.name, doNotContact: c.doNotContact, lastVisit: [...(c.visits || [])].sort().pop() }));
    const menu = (await M.MenuItem.find({ tenantId: tid, isActive: true }).limit(300)).map(plain);
    const summary = D.dailySummary({ date, bills, leak, close: closeRow ? { expected: closeRow.expected, counted: closeRow.counted } : null, foodCost: fc, byHour: D.byHour(hist).map((h) => ({ hour: h.hour, sales: Math.round(h.sales / 14) })), stock: ingDocs.map((i) => ({ id: String(i._id), name: i.name, qty: i.qty })), dailyUse: await avgUse(tid, hist), customers: cs, menu, venue: s.venueName, pubMode: s.pubMode });
    res.json({ success: true, data: summary });
  });
  return router;
}
module.exports = { createDineRouter };
