'use strict';
// Owner only. GET /list (one row per business) and GET /counts. Read-only, no phone or email, audited, never cached.
const { view, counts } = require('./health');
function createHealthRouter({ express, protect, authorize, getAccounts, audit = () => {}, now = () => new Date() }) {
  const router = express.Router();
  router.use(protect, authorize('root_admin'));
  const actor = (req) => (req.user && (req.user.id || req.user.email)) || 'unknown';
  const handle = (name, fn) => async (req, res) => {
    try { const { accounts, failed } = await getAccounts(); res.set('Cache-Control', 'no-store'); audit({ who: actor(req), action: 'health.' + name }); res.json(fn(view(accounts, { now: now(), product: req.query.product || null }), failed)); }
    catch (e) { console.error('health ' + name + ' failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
  };
  router.get('/list', handle('list', (rows, failed) => ({ success: true, data: rows, productsUnavailable: failed })));
  router.get('/counts', handle('counts', (rows, failed) => ({ success: true, data: counts(rows), productsUnavailable: failed })));
  return router;
}
module.exports = { createHealthRouter };
