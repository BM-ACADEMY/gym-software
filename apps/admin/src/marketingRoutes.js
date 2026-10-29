'use strict';
// Marketing to-do routes. Mount: app.use('/api/admin/marketing', createMarketingRouter({ express, protect, authorize, store, getFacts, audit }))
// Roles: root_admin does everything; marketing (DM team) can read, mark done and add drafts, but not approve, skip or refresh.
// store: { list(), get(id), insert(item), update(id, patch), keys(), calendar(), setCalendar(events) }
const M = require('./marketing');
const ACTIONS = { approve: 'approved', skip: 'skipped', snooze: 'snoozed', done: 'done', reopen: 'suggested' };
const DM_ACTIONS = new Set(['done']);
const ID = /^[0-9a-zA-Z_-]{6,40}$/;

function createMarketingRouter({ express, protect, authorize, store, getFacts, audit = () => {}, now = () => new Date() }) {
  const router = express.Router();
  router.use(protect, authorize('root_admin', 'marketing'));
  const fail = (res, c, m) => res.status(c).json({ success: false, message: m });
  const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) {
    if (e.code && /^ITEM_/.test(e.code)) return fail(res, 400, e.message);
    console.error('marketing route failed:', e.message); return fail(res, 500, 'Server error'); } };
  const actor = (req) => (req.user && (req.user.id || req.user.email)) || 'unknown';
  const isOwner = (req) => req.user && req.user.role === 'root_admin';
  const woken = async () => M.wake(await store.list(), now());

  router.get('/today', wrap(async (req, res) => res.json({ success: true, data: M.todayBrief(await woken(), now()) })));
  router.get('/items', wrap(async (req, res) => {
    const st = String(req.query.status || ''); const all = await woken();
    res.json({ success: true, data: st ? all.filter((i) => i.status === st) : all });
  }));
  router.post('/items', wrap(async (req, res) => {
    const item = M.validateItem({ ...(req.body || {}), source: 'manual' });
    if (!isOwner(req)) item.owner = 'dm_team';
    const saved = await store.insert({ ...item, createdAt: now(), createdBy: actor(req) });
    audit({ who: actor(req), action: 'marketing.add', ref: saved.id }); res.status(201).json({ success: true, data: saved });
  }));
  router.post('/items/:id/:action', wrap(async (req, res) => {
    const to = ACTIONS[req.params.action]; if (!to || !ID.test(req.params.id)) return fail(res, 400, 'Unknown action.');
    if (!isOwner(req) && !DM_ACTIONS.has(req.params.action)) return fail(res, 403, 'Only the owner can do this.');
    const item = await store.get(req.params.id); if (!item) return fail(res, 404, 'Not found.');
    const next = M.move(item, to, { now: now(), by: actor(req), snoozeDays: Number(req.body && req.body.days) || 3 });
    await store.update(item.id, { status: next.status, changedAt: next.changedAt, changedBy: next.changedBy, snoozeUntil: next.snoozeUntil });
    audit({ who: actor(req), action: 'marketing.' + req.params.action, ref: item.id }); res.json({ success: true, data: { ...item, ...next } });
  }));
  // Owner presses "Find new suggestions": rules run on counts only; reruns add nothing twice.
  router.post('/refresh', wrap(async (req, res) => {
    if (!isOwner(req)) return fail(res, 403, 'Only the owner can do this.');
    const sug = M.newOnly(M.suggest(await getFacts(), await store.calendar(), now()), await store.keys());
    const added = []; for (const s of sug) added.push(await store.insert({ ...s, createdAt: now(), createdBy: 'rules' }));
    audit({ who: actor(req), action: 'marketing.refresh', count: added.length }); res.json({ success: true, added: added.length });
  }));
  router.get('/calendar', wrap(async (req, res) => res.json({ success: true, data: await store.calendar() })));
  // Add or remove one event (what the screen uses). The owner only.
  router.post('/calendar', wrap(async (req, res) => {
    if (!isOwner(req)) return fail(res, 403, 'Only the owner can do this.');
    const b = req.body || {}; const name = String(b.name || '').trim().slice(0, 80); const date = new Date(b.date);
    if (name.length < 2 || isNaN(date)) return fail(res, 400, 'Give the event a name and a date.');
    const list = await store.calendar(); if (list.length >= 200) return fail(res, 400, 'Too many events. Remove old ones first.');
    const ev = { id: 'ev' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, date, products: [] };
    await store.setCalendar([...list, ev]); audit({ who: actor(req), action: 'marketing.calendar_add', ref: ev.id }); res.status(201).json({ success: true, data: ev });
  }));
  router.delete('/calendar/:id', wrap(async (req, res) => {
    if (!isOwner(req)) return fail(res, 403, 'Only the owner can do this.');
    const list = await store.calendar(); const next = list.filter((e) => e.id !== req.params.id);
    if (next.length === list.length) return fail(res, 404, 'Not found.');
    await store.setCalendar(next); audit({ who: actor(req), action: 'marketing.calendar_remove', ref: req.params.id }); res.json({ success: true });
  }));
  router.put('/calendar', wrap(async (req, res) => {
    if (!isOwner(req)) return fail(res, 403, 'Only the owner can do this.');
    const ev = (req.body && req.body.events); if (!Array.isArray(ev) || ev.length > 200) return fail(res, 400, 'Send a list of events.');
    const clean = ev.map((e) => ({ id: String(e.id || '').slice(0, 40), name: String(e.name || '').trim().slice(0, 80), date: new Date(e.date), products: Array.isArray(e.products) ? e.products.map(String).slice(0, 7) : [] }));
    if (clean.some((e) => !e.id || !e.name || isNaN(e.date))) return fail(res, 400, 'Each event needs an id, a name and a date.');
    await store.setCalendar(clean); audit({ who: actor(req), action: 'marketing.calendar', count: clean.length }); res.json({ success: true, data: clean });
  }));
  return router;
}

// Mongoose store for the admin app's own data (not product tenant data).
function makeMongoStore(mongoose) {
  const { Schema } = mongoose;
  const Item = mongoose.models.AdminMarketingItem || mongoose.model('AdminMarketingItem', new Schema({ key: { type: String, index: true }, title: String, reason: String, product: String, channel: String, priority: String, due: Date, owner: String, source: String, status: String, snoozeUntil: Date, changedAt: Date, changedBy: String, pushedAt: Date, createdBy: String }, { timestamps: true }));
  const Cal = mongoose.models.AdminMarketingCalendar || mongoose.model('AdminMarketingCalendar', new Schema({ _id: String, events: [Schema.Types.Mixed] }));
  const plain = (d) => d && { ...d.toObject(), id: String(d._id) };
  return {
    list: async () => (await Item.find({}).sort({ createdAt: -1 }).limit(500)).map(plain),
    get: async (id) => plain(await Item.findById(id)),
    insert: async (i) => plain(await Item.create(i)),
    update: async (id, patch) => { await Item.updateOne({ _id: id }, { $set: patch }); },
    keys: async () => (await Item.find({ key: { $ne: null } }).select('key')).map((d) => d.key),
    calendar: async () => ((await Cal.findById('main')) || { events: [] }).events,
    setCalendar: async (events) => { await Cal.updateOne({ _id: 'main' }, { $set: { events } }, { upsert: true }); },
  };
}
module.exports = { createMarketingRouter, makeMongoStore, ACTIONS };
