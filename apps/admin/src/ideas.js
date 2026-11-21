'use strict';
// IDEA-01: an internal board for ideas and suggestions, so nothing is lost and version 2 / 3 can be planned later.
// Owner and marketing can add ideas. Only the owner changes status or version, so the board stays the owner's plan.
// Text only: no personal data, no links. Every add and change is audited (who, what; not the text).
const STATUS = ['new', 'planned', 'doing', 'done', 'dropped'];
const VERSION = ['v1', 'v2', 'v3', 'later'];
const AREA = ['fit', 'groom', 'mart', 'dine', 'cloth', 'wash', 'hire', 'admin', 'marketing', 'all'];
const IMPACT = ['low', 'medium', 'high'];
const ID = /^[0-9a-zA-Z_-]{6,40}$/;

const clean = (b) => {
  b = b || {};
  const title = String(b.title || '').trim().slice(0, 100); const detail = String(b.detail || '').trim().slice(0, 600);
  if (!title) return { error: 'Add a short title' };
  if (/https?:\/\/|<|>/i.test(title + detail)) return { error: 'No links or tags in an idea' };
  const pick = (v, list, d) => (list.includes(v) ? v : d);
  return { value: { title, detail, area: pick(b.area, AREA, 'all'), impact: pick(b.impact, IMPACT, 'medium'), version: pick(b.version, VERSION, 'later'), status: 'new' } };
};
// action name -> field changes (owner only)
const ACTIONS = { v2: { version: 'v2', status: 'planned' }, v3: { version: 'v3', status: 'planned' }, later: { version: 'later' }, doing: { status: 'doing' }, done: { status: 'done' }, drop: { status: 'dropped' }, reopen: { status: 'new' } };
const order = (a, b) => (STATUS.indexOf(a.status) - STATUS.indexOf(b.status)) || (IMPACT.indexOf(b.impact) - IMPACT.indexOf(a.impact)) || (new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

// Ideas written by Claude on 12 Nov 2026 as a starting list. Seeding twice adds nothing (seedKey).
const SEED = [
  { k: 's01', title: 'Store app for Android (Google Play)', detail: 'Wrap the web app; plan in docs/STORE_APP_PLAN.md. Starts after the launch gate and the D-U-N-S number.', area: 'all', impact: 'medium', version: 'v2' },
  { k: 's02', title: 'Member mobile app features: workout log, body measurements, progress photos', detail: 'Gives members a reason to open the app daily, which helps renewals.', area: 'fit', impact: 'high', version: 'v2' },
  { k: 's03', title: 'Per-gym plan overrides and extended trials', detail: 'Plan settings are done for all gyms; this adds a change for one gym with a reason and an end date.', area: 'admin', impact: 'medium', version: 'v2' },
  { k: 's04', title: 'Support snapshot per gym (counts and settings only, no member data)', detail: 'Lets support help without seeing members. Design in docs/SUPER_ADMIN_SUPPORT_TOOLS.md.', area: 'admin', impact: 'medium', version: 'v2' },
  { k: 's05', title: 'Register photo import with AI (AI-03)', detail: 'Owner photographs the paper register; the app lists members for checking. Needs the real AI key test and a cost check.', area: 'fit', impact: 'high', version: 'v2' },
  { k: 's06', title: 'Referral program for gym owners', detail: 'A gym that brings another gym gets a month free. The promo and referral code screen already exists.', area: 'marketing', impact: 'high', version: 'v2' },
  { k: 's07', title: 'Email announcements and an in-app notice bell', detail: 'Announcements exist; showing them inside the products and by email needs the mail host (M-17).', area: 'all', impact: 'medium', version: 'v2' },
  { k: 's08', title: 'Multi-branch dashboard for gym chains', detail: 'One owner sees all branches. Pro plan feature.', area: 'fit', impact: 'medium', version: 'v3' },
  { k: 's09', title: 'Hire: prepaid WhatsApp outreach packs', detail: 'Decision D-24: outreach is prepaid only. Needs Hire payments first.', area: 'hire', impact: 'high', version: 'v2' },
  { k: 's10', title: 'Customer support inbox in Super Admin', detail: 'One place for support questions, with an AI first answer that a person approves. Needs lawyer wording first.', area: 'admin', impact: 'medium', version: 'v3' },
  { k: 's11', title: 'Data export and delete for a business (their right to their data)', detail: 'Self-service export of a gym or agency data. Needs the lawyer wording.', area: 'all', impact: 'medium', version: 'v3' },
  { k: 's12', title: 'Credit note screen for refunds', detail: 'Refunds are recorded since 12 Nov; the credit note and a refund screen wait for the CA wording (M-04).', area: 'admin', impact: 'medium', version: 'v2' },
  { k: 's13', title: 'Landing and FAQ wording editable by the owner', detail: 'Part of the "change it without a deploy" decision (D-28).', area: 'marketing', impact: 'high', version: 'v2' },
];

function makeIdeaStore(mongoose) {
  const Row = mongoose.models.AdminIdea || mongoose.model('AdminIdea', new mongoose.Schema({ title: String, detail: String, area: String, impact: String, version: String, status: String, by: String, seedKey: { type: String, index: true, sparse: true } }, { timestamps: true }));
  const out = (d) => ({ ...d, id: String(d._id) });
  return {
    list: async () => (await Row.find({}).limit(500).lean()).map(out).sort(order),
    add: async (v, by, seedKey) => out((await Row.create({ ...v, by: String(by || '').slice(0, 60), ...(seedKey ? { seedKey } : {}) })).toObject()),
    seeded: async (k) => !!(await Row.exists({ seedKey: k })),
    update: async (id, patch) => !!(await Row.findOneAndUpdate({ _id: id }, { $set: patch })),
  };
}

function createIdeasRouter({ express, protect, authorize, store, audit = () => {} }) {
  const router = express.Router(); const actor = (req) => (req.user && (req.user.id || req.user.email)) || 'unknown';
  const isOwner = (req) => req.user && req.user.role === 'root_admin';
  const fail = (res, c, m) => res.status(c).json({ success: false, message: m });
  const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { console.error('ideas route failed:', e.message); fail(res, 500, 'Server error'); } };
  router.use(protect, authorize('root_admin', 'marketing'));
  router.get('/', wrap(async (req, res) => { res.set('Cache-Control', 'no-store'); res.json({ success: true, data: await store.list() }); }));
  router.post('/', wrap(async (req, res) => {
    const c = clean(req.body); if (c.error) return fail(res, 400, c.error);
    // Only the owner may place an idea straight into a version.
    if (!isOwner(req)) { c.value.version = 'later'; }
    const d = await store.add(c.value, actor(req)); audit({ who: actor(req), action: 'idea.add', ref: d.id }); res.status(201).json({ success: true, data: d });
  }));
  router.post('/seed', wrap(async (req, res) => {
    if (!isOwner(req)) return fail(res, 403, 'Only the owner can load the starting list');
    let added = 0; for (const s of SEED) { if (await store.seeded(s.k)) continue; const { k, ...rest } = s; await store.add({ ...rest, status: 'new' }, 'Claude', k); added += 1; }
    audit({ who: actor(req), action: 'idea.seed', count: added }); res.json({ success: true, message: added ? `Added ${added} starting ideas.` : 'The starting list is already loaded.' });
  }));
  router.post('/:id/:action', wrap(async (req, res) => {
    if (!isOwner(req)) return fail(res, 403, 'Only the owner can change an idea');
    const patch = ACTIONS[req.params.action]; if (!patch || !ID.test(req.params.id)) return fail(res, 400, 'Unknown action');
    const ok = await store.update(req.params.id, patch); if (!ok) return fail(res, 404, 'Not found');
    audit({ who: actor(req), action: `idea.${req.params.action}`, ref: req.params.id }); res.json({ success: true });
  }));
  return router;
}
module.exports = { STATUS, VERSION, AREA, IMPACT, SEED, clean, order, makeIdeaStore, createIdeasRouter };
