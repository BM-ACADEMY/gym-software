'use strict';
// Waitlist (MKT-01): people who ask, on a public pilot page, to hear when a product opens. Text only, consent tick required.
// Public side: one POST, rate limited, never returns or lists anyone's data. Owner side: list, mark contacted (owner and DM team),
// CSV export and delete on request (owner only). Every action is audited without personal details.
// Written, not yet tested by a person.
const PRODUCTS = ['fit', 'groom', 'mart', 'dine', 'cloth', 'wash', 'hire', 'not_sure'];
const SOURCES = ['site', 'instagram', 'whatsapp', 'referral', 'field_agent', 'google', 'other'];
const STATUS = ['new', 'contacted'];
const NO_MARKUP = /https?:\/\/|www\.|<|>|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/i;
const text = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

// Returns { value } or { error }. Phone: 10 digits starting 6 to 9 (optional +91 or 0). Email: simple shape check. One of the two is needed.
function clean(b) {
  b = b || {};
  if (b.consent !== true) return { error: 'Please tick the box so we may contact you.' };
  const name = text(b.name, 80);
  if (name.length < 2) return { error: 'Please enter your name.' };
  let phone = String(b.phone || '').replace(/[\s()-]/g, '');
  phone = phone.replace(/^\+?91/, '').replace(/^0/, '');
  const email = text(b.email, 120).toLowerCase();
  const hasPhone = phone !== '';
  if (hasPhone && !/^[6-9]\d{9}$/.test(phone)) return { error: 'Enter a 10-digit mobile number.' };
  if (email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email)) return { error: 'Enter a valid email address.' };
  if (!hasPhone && !email) return { error: 'Please give a mobile number or an email.' };
  const product = PRODUCTS.includes(b.product) ? b.product : 'not_sure';
  const businessType = text(b.businessType, 60), city = text(b.city, 60);
  const source = SOURCES.includes(b.source) ? b.source : 'site';
  if (NO_MARKUP.test([name, email, businessType, city].join(' '))) return { error: 'Please remove links and symbols from the form.' };
  return { value: { name, phone: hasPhone ? phone : '', email, product, businessType, city, source } };
}
// One person asking twice for the same product is one row. The key is never shown to anyone.
const dedupeKey = (v) => (v.phone ? 'p:' + v.phone : 'e:' + v.email) + '|' + v.product;

// CSV cells that start with = + - @ tab or CR would run as formulas in a spreadsheet: a leading apostrophe makes them plain text.
const cell = (v) => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"'; };
const COLS = [['name', 'Name'], ['phone', 'Phone'], ['email', 'Email'], ['product', 'Product'], ['businessType', 'Business'], ['city', 'City'], ['source', 'Source'], ['status', 'Status'], ['createdAt', 'Joined']];
const toCsv = (rows) => [COLS.map((c) => cell(c[1])).join(','), ...rows.map((r) => COLS.map(([k]) => cell(k === 'createdAt' && r[k] ? new Date(r[k]).toISOString().slice(0, 10) : r[k])).join(','))].join('\r\n') + '\r\n';

// Counts per window and key. Public form: a few tries per person per hour and a cap for the whole site.
function makeLimiter({ max = 5, windowMs = 3600000, now = () => Date.now() } = {}) {
  const hits = new Map();
  return { allow(key) { const t = now(); const arr = (hits.get(key) || []).filter((x) => t - x < windowMs); if (arr.length >= max) { hits.set(key, arr); return false; } arr.push(t); hits.set(key, arr); if (hits.size > 5000) hits.clear(); return true; } };
}

function makeWaitlistStore(mongoose) {
  const Row = mongoose.models.AdminWaitlist || mongoose.model('AdminWaitlist', new mongoose.Schema({
    name: String, phone: String, email: String, product: String, businessType: String, city: String, source: String,
    consentAt: Date, status: { type: String, enum: STATUS, default: 'new' }, contactedAt: Date, contactedBy: String, hits: { type: Number, default: 1 },
    dedupeKey: { type: String, unique: true, index: true },
  }, { timestamps: true }));
  const view = (d) => ({ id: String(d._id), name: d.name, phone: d.phone, email: d.email, product: d.product, businessType: d.businessType, city: d.city, source: d.source, status: d.status, createdAt: d.createdAt, contactedAt: d.contactedAt });
  return {
    // Returns { created }. A repeat updates the counter only; nothing about the earlier row is returned.
    add: async (v, now = new Date()) => {
      const key = dedupeKey(v);
      const r = await Row.updateOne({ dedupeKey: key }, { $inc: { hits: 1 }, $setOnInsert: { ...v, consentAt: now, status: 'new', dedupeKey: key } }, { upsert: true });
      return { created: !!(r.upsertedCount || r.upsertedId) };
    },
    list: async () => (await Row.find({}).sort({ createdAt: -1 }).limit(2000).lean()).map(view),
    markContacted: async (id, by) => !!(await Row.findOneAndUpdate({ _id: String(id).slice(0, 40) }, { status: 'contacted', contactedAt: new Date(), contactedBy: String(by || '').slice(0, 80) })),
    remove: async (id) => !!(await Row.findOneAndDelete({ _id: String(id).slice(0, 40) })),
    count: async () => Row.countDocuments({}),
  };
}

// Public router. Mount at /api/waitlist. Origins that may post from a browser come from WAITLIST_ORIGINS (comma list) in the server settings.
function createPublicWaitlistRouter({ express, store, limiter = makeLimiter(), siteLimiter = makeLimiter({ max: 300 }), origins = [], now = () => new Date() }) {
  const router = express.Router();
  const cors = (req, res) => { const o = req.headers && req.headers.origin; if (o && origins.includes(o)) { res.set('Access-Control-Allow-Origin', o); res.set('Vary', 'Origin'); res.set('Access-Control-Allow-Methods', 'POST, OPTIONS'); res.set('Access-Control-Allow-Headers', 'Content-Type'); } };
  router.options('/', (req, res) => { cors(req, res); res.status(204).end(); });
  router.post('/', async (req, res) => {
    cors(req, res); res.set('Cache-Control', 'no-store');
    const ok = { success: true, message: 'Thank you. We will contact you when your product opens.' };
    try {
      if (!siteLimiter.allow('site') || !limiter.allow(String(req.ip || ''))) return res.status(429).json({ success: false, message: 'Too many tries. Please wait a while.' });
      const body = req.body || {};
      if (text(body.website, 100) !== '') return res.json(ok); // hidden field a person never fills: a bot did. Pretend success, store nothing.
      const c = clean(body);
      if (c.error) return res.status(400).json({ success: false, message: c.error });
      await store.add(c.value, now());
      res.json(ok); // same answer whether new or repeat: the page never reveals who is already on the list
    } catch (e) { console.error('waitlist add failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
  });
  return router;
}

// Owner side. Mount at /api/admin/waitlist. List and Contacted: owner and DM team. Export and delete: owner only.
function createWaitlistRouter({ express, protect, authorize, store, audit = () => {}, now = () => new Date() }) {
  const router = express.Router(); const actor = (req) => (req.user && (req.user.id || req.user.email)) || 'unknown';
  const fail = (res, e) => { console.error('waitlist failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); };
  const okId = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/.test(id);
  router.use(protect);
  router.get('/', authorize('root_admin', 'marketing'), async (req, res) => { try { res.set('Cache-Control', 'no-store'); res.json({ success: true, data: await store.list() }); } catch (e) { fail(res, e); } });
  router.get('/export.csv', authorize('root_admin'), async (req, res) => {
    try { const rows = await store.list(); audit({ who: actor(req), action: 'waitlist.export', count: rows.length });
      res.set('Content-Type', 'text/csv; charset=utf-8'); res.set('Content-Disposition', 'attachment; filename="waitlist.csv"'); res.set('Cache-Control', 'no-store'); res.send('﻿' + toCsv(rows)); } catch (e) { fail(res, e); }
  });
  router.post('/:id/contacted', authorize('root_admin', 'marketing'), async (req, res) => {
    try { if (!okId(req.params.id)) return res.status(400).json({ success: false, message: 'Not a valid id' });
      if (!(await store.markContacted(req.params.id, actor(req)))) return res.status(404).json({ success: false, message: 'Not found' });
      audit({ who: actor(req), action: 'waitlist.contacted', ref: req.params.id }); res.json({ success: true }); } catch (e) { fail(res, e); }
  });
  router.delete('/:id', authorize('root_admin'), async (req, res) => {
    try { if (!okId(req.params.id)) return res.status(400).json({ success: false, message: 'Not a valid id' });
      if (!(await store.remove(req.params.id))) return res.status(404).json({ success: false, message: 'Not found' });
      audit({ who: actor(req), action: 'waitlist.delete', ref: req.params.id }); res.json({ success: true }); } catch (e) { fail(res, e); }
  });
  return router;
}
module.exports = { PRODUCTS, SOURCES, clean, dedupeKey, toCsv, cell, makeLimiter, makeWaitlistStore, createPublicWaitlistRouter, createWaitlistRouter };
