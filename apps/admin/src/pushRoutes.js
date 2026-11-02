'use strict';
// Owner only. GET /key, POST /subscribe, POST /unsubscribe, POST /run ("send now"; the same quiet hours and daily limit apply).
// store: { subs(), addSub(sub, who), removeSub(endpoint) }; marketing store: list(), update(id, patch).
const { validateSubscription, runPush } = require('./push');
function createPushRouter({ express, protect, authorize, store, marketingStore, send, publicKey, audit = () => {}, now = () => new Date() }) {
  const router = express.Router();
  router.use(protect, authorize('root_admin'));
  const actor = (req) => (req.user && (req.user.id || req.user.email)) || 'unknown';
  const fail = (res, c, m) => res.status(c).json({ success: false, message: m });
  const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { if (e.code === 'PUSH_SUB') return fail(res, 400, e.message); console.error('push route failed:', e.message); fail(res, 500, 'Server error'); } };
  router.get('/key', (req, res) => (publicKey ? res.json({ success: true, data: { publicKey } }) : fail(res, 404, 'Phone alerts are not set up on the server yet.')));
  router.post('/subscribe', wrap(async (req, res) => { const sub = validateSubscription(req.body && req.body.subscription); await store.addSub(sub, actor(req)); audit({ who: actor(req), action: 'push.subscribe' }); res.status(201).json({ success: true }); }));
  router.post('/unsubscribe', wrap(async (req, res) => { const ep = req.body && req.body.endpoint; if (typeof ep !== 'string' || ep.length > 500) return fail(res, 400, 'Missing address.'); await store.removeSub(ep); audit({ who: actor(req), action: 'push.unsubscribe' }); res.json({ success: true }); }));
  const run = async () => runPush({ items: await marketingStore.list(), subs: await store.subs(), send, now: now(), dropSub: (e) => store.removeSub(e), markPushed: (id, when) => marketingStore.update(id, { pushedAt: when }) });
  router.post('/run', wrap(async (req, res) => { if (!send) return fail(res, 404, 'Phone alerts are not set up on the server yet.'); const r = await run(); audit({ who: actor(req), action: 'push.run', sent: r.sent, reason: r.reason }); res.json({ success: true, data: r }); }));
  router.run = run;
  return router;
}

function makePushStore(mongoose) {
  const { Schema } = mongoose;
  const Sub = mongoose.models.AdminPushSub || mongoose.model('AdminPushSub', new Schema({ endpoint: { type: String, unique: true }, keys: { p256dh: String, auth: String }, who: String }, { timestamps: true }));
  return {
    subs: async () => (await Sub.find({}).limit(50)).map((d) => ({ endpoint: d.endpoint, keys: { p256dh: d.keys.p256dh, auth: d.keys.auth } })),
    addSub: async (s, who) => { await Sub.updateOne({ endpoint: s.endpoint }, { $set: { keys: s.keys, who } }, { upsert: true }); },
    removeSub: async (endpoint) => { await Sub.deleteOne({ endpoint }); },
  };
}
module.exports = { createPushRouter, makePushStore };
