'use strict';
// Owner only. GET /list (all accounts), GET /renewals (only those needing action), GET /counts. Read-only; no phone or email.
const { view, counts } = require('./accountsView');
function createAccountsRouter({ express, protect, authorize, getAccounts, audit = () => {}, now = () => new Date() }) {
  const router = express.Router();
  router.use(protect, authorize('root_admin'));
  const actor = (req) => (req.user && (req.user.id || req.user.email)) || 'unknown';
  const handle = (name, fn) => async (req, res) => {
    try { const { accounts, failed } = await getAccounts(); res.set('Cache-Control', 'no-store'); audit({ who: actor(req), action: 'accounts.' + name, product: req.query.product ? String(req.query.product).slice(0, 20) : null }); res.json(fn(accounts, failed, req)); }
    catch (e) { console.error('accounts ' + name + ' failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
  };
  const pack = (v, failed) => ({ success: true, data: v.rows, total: v.total, truncated: v.truncated, productsUnavailable: failed });
  const q = (req) => ({ now: now(), product: req.query.product || null });
  router.get('/list', handle('list', (acc, failed, req) => pack(view(acc, q(req)), failed)));
  router.get('/renewals', handle('renewals', (acc, failed, req) => pack(view(acc, { ...q(req), only: 'renewals' }), failed)));
  router.get('/counts', handle('counts', (acc, failed) => ({ success: true, data: counts(acc, { now: now() }), productsUnavailable: failed })));
  return router;
}
module.exports = { createAccountsRouter };
