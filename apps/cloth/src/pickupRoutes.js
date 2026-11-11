'use strict';
// Public pickup page for one alteration job: GET /:token, no sign-in. The secret token is the key. Mounted at /api/cloth-pickup.
const { runWithTenant, runUnscoped } = require('../../../packages/core-server/src');
const PK = require('./pickup');
function createPickupRouter({ express, M, limit = PK.limiter() }) {
  const router = express.Router();
  router.get('/:token', async (req, res) => {
    const send = (code, v) => { res.set('Cache-Control', 'no-store'); res.set('X-Robots-Tag', 'noindex'); res.status(code); if (req.query.format === 'json') return res.json(v ? { success: true, data: v } : { success: false, message: 'This link is not valid.' }); res.set('Content-Type', 'text/html; charset=utf-8'); return res.send(PK.html(v)); };
    try {
      if (!limit(String(req.ip || 'x'))) return res.status(429).json({ success: false, message: 'Too many tries. Wait a minute.' });
      if (!PK.tokenOk(req.params.token)) return send(404, null);
      const job = await runUnscoped('public pickup link: find one job by its secret token', () => M.Alteration.findOne({ pickupToken: req.params.token }).lean());
      if (!job) return send(404, null);
      return await runWithTenant(String(job.tenantId), async () => { const t = await M.Tenant.findOne({ _id: job.tenantId }).lean(); return send(200, PK.view(job, t && t.shopName)); });
    } catch (e) { console.error('Pickup route failed:', e.message); return res.status(500).json({ success: false, message: 'Server error' }); }
  });
  return router;
}
module.exports = { createPickupRouter };
