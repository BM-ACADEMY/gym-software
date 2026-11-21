'use strict';
// Announcements (SA-09): a short notice written by the owner, shown inside chosen products until it ends.
// In-app only for now (email needs the mail host, M-17). The text is public to anyone who opens a product: never put personal data in it.
const PRODUCTS = ['fit', 'groom', 'mart', 'dine', 'cloth', 'wash', 'hire'];
const clean = (b, now = new Date()) => {
  b = b || {}; const title = String(b.title || '').trim().slice(0, 80); const body = String(b.body || '').trim().slice(0, 400);
  if (!title) return { error: 'Add a title' }; if (!body) return { error: 'Add the message' };
  if (/https?:\/\/|<|>/i.test(title + body)) return { error: 'No links or tags in a notice' };
  let products = Array.isArray(b.products) ? b.products.map(String).filter((p) => PRODUCTS.includes(p)) : [];
  if (b.products === 'all' || products.length === 0) products = PRODUCTS.slice();
  const ends = new Date(b.endsAt); const max = new Date(now.getTime() + 30 * 864e5);
  if (isNaN(ends) || ends <= now) return { error: 'Pick an end date in the future' };
  return { value: { title, body, products: [...new Set(products)], endsAt: ends > max ? max : ends } };
};
const isLive = (a, product, now = new Date()) => a.products.includes(product) && new Date(a.endsAt) > now && !a.removedAt;

function makeAnnouncementStore(mongoose) {
  const Row = mongoose.models.AdminAnnouncement || mongoose.model('AdminAnnouncement', new mongoose.Schema({ title: String, body: String, products: [String], endsAt: { type: Date, index: true }, createdBy: String, removedAt: Date }, { timestamps: true }));
  return {
    add: async (v, by) => { const d = await Row.create({ ...v, createdBy: String(by || '').slice(0, 80) }); return { ...d.toObject(), id: String(d._id) }; },
    list: async () => (await Row.find({ removedAt: { $exists: false } }).sort({ createdAt: -1 }).limit(100).lean()).map((d) => ({ ...d, id: String(d._id) })),
    remove: async (id) => !!(await Row.findOneAndUpdate({ _id: String(id).slice(0, 40), removedAt: { $exists: false } }, { removedAt: new Date() })),
    live: async (product, now = new Date()) => (await Row.find({ products: product, endsAt: { $gt: now }, removedAt: { $exists: false } }).sort({ createdAt: -1 }).limit(5).lean()).map((d) => ({ id: String(d._id), title: d.title, body: d.body, endsAt: d.endsAt })),
  };
}

function createAnnouncementsRouter({ express, protect, authorize, store, audit = () => {}, now = () => new Date() }) {
  const router = express.Router(); const actor = (req) => (req.user && (req.user.id || req.user.email)) || 'unknown';
  const fail = (res, e) => { console.error('announcements failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); };
  router.use(protect, authorize('root_admin'));
  router.get('/', async (req, res) => { try { res.set('Cache-Control', 'no-store'); res.json({ success: true, data: await store.list() }); } catch (e) { fail(res, e); } });
  router.post('/', async (req, res) => {
    try { const c = clean(req.body, now()); if (c.error) return res.status(400).json({ success: false, message: c.error });
      const d = await store.add(c.value, actor(req)); audit({ who: actor(req), action: 'announcement.add', ref: d.id, count: c.value.products.length }); res.status(201).json({ success: true, data: d }); } catch (e) { fail(res, e); }
  });
  router.delete('/:id', async (req, res) => {
    try { const ok = await store.remove(req.params.id); if (!ok) return res.status(404).json({ success: false, message: 'Not found' }); audit({ who: actor(req), action: 'announcement.remove', ref: String(req.params.id).slice(0, 40) }); res.json({ success: true }); } catch (e) { fail(res, e); }
  });
  return router;
}
// Read side for the products: no sign-in, no personal data, only live notices for one product.
function createPublicAnnouncementsRouter({ express, store, now = () => new Date() }) {
  const router = express.Router();
  router.get('/', async (req, res) => {
    const product = String(req.query.product || '');
    if (!PRODUCTS.includes(product)) return res.status(400).json({ success: false, message: 'Unknown product' });
    try { res.set('Cache-Control', 'public, max-age=300'); res.json({ success: true, data: await store.live(product, now()) }); } catch (e) { console.error('announcements read failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
  });
  return router;
}
module.exports = { PRODUCTS, clean, isLive, makeAnnouncementStore, createAnnouncementsRouter, createPublicAnnouncementsRouter };
