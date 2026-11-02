'use strict';
// Owner only. GET /list?action=&who=&from=&to= and GET /export.csv. Reading the trail is itself recorded (action audit.view / audit.export).
const { toCsv } = require('./auditStore');
function createAuditRouter({ express, protect, authorize, store, audit = () => {}, now = () => new Date() }) {
  const router = express.Router();
  router.use(protect, authorize('root_admin'));
  const actor = (req) => (req.user && (req.user.id || req.user.email)) || 'unknown';
  const q = (req) => ({ action: req.query.action, who: req.query.who, from: req.query.from, to: req.query.to });
  router.get('/list', async (req, res) => {
    try { const rows = await store.list({ ...q(req), limit: 200 }); audit({ who: actor(req), action: 'audit.view', count: rows.length }); res.set('Cache-Control', 'no-store'); res.json({ success: true, data: rows }); }
    catch (e) { console.error('audit list failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
  });
  router.get('/export.csv', async (req, res) => {
    try {
      const rows = await store.list({ ...q(req), limit: 1000 }); audit({ who: actor(req), action: 'audit.export', rows: rows.length });
      res.set({ 'Cache-Control': 'no-store', 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="super-admin-audit-${now().toISOString().slice(0, 10)}.csv"` }); res.send(toCsv(rows));
    } catch (e) { console.error('audit export failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
  });
  return router;
}
module.exports = { createAuditRouter };
