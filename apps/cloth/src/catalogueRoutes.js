'use strict';
// Public catalogue page: GET /:token, no sign-in. The secret token is the key; the owner can switch it off. Mounted at /api/cloth-catalogue.
const { runWithTenant, runUnscoped } = require('../../../packages/core-server/src');
const P3 = require('./phase3Rules'); const PK = require('./pickup');
function createCatalogueRouter({ express, M, limit = PK.limiter() }) {
  const router = express.Router();
  router.get('/:token', async (req, res) => {
    const send = (code, v) => { res.set('Cache-Control', 'no-store'); res.set('X-Robots-Tag', 'noindex'); res.status(code); if (req.query.format === 'json') return res.json(v ? { success: true, data: v } : { success: false, message: 'This link is not valid.' }); res.set('Content-Type', 'text/html; charset=utf-8'); return res.send(v ? P3.catalogueHtml(v) : '<!doctype html><meta charset="utf-8"><title>Not found</title><p>This link is not valid.</p>'); };
    try {
      if (!limit(String(req.ip || 'x'))) return res.status(429).json({ success: false, message: 'Too many tries. Wait a minute.' });
      if (!P3.tokenOk(req.params.token)) return send(404, null);
      const s = await runUnscoped('public catalogue link: find one shop by its secret token', () => M.Settings.findOne({ catalogueToken: req.params.token }).lean());
      if (!s) return send(404, null);
      return await runWithTenant(String(s.tenantId), async () => {
        const t = await M.Tenant.findOne({ _id: s.tenantId }).lean(); const vs = await M.Variant.find({ tenantId: s.tenantId, isActive: true, isPublic: true }).limit(2000).lean();
        return send(200, P3.catalogueView(t && t.shopName, vs, { showPrice: !!s.catalogueShowPrice }));
      });
    } catch (e) { console.error('Catalogue route failed:', e.message); return res.status(500).json({ success: false, message: 'Server error' }); }
  });
  return router;
}
module.exports = { createCatalogueRouter };
