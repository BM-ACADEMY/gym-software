'use strict';
// Public, no sign-in: the QR menu page and the two page shells. Mounted at /dine-public (see app.js).
//   GET /menu/:token       the guest menu (token = the venue's secret menu link; rotate it in settings to kill old QR codes)
//   GET /app/tables        shell page; data comes from the signed-in API, so it shows nothing to a person who is not signed in
//   GET /app/kitchen       shell page for the kitchen / bar screen
// A wrong token and a missing venue look the same (404). A small per-address limit stops people guessing tokens.
const { runWithTenant } = require('../../../packages/core-server/src');
const P = require('./publicPages');

function createPublicRouter({ express, models, now = () => Date.now(), perMinute = 60 }) {
  const router = express.Router(); const hits = new Map();
  const limited = (ip) => { const t = now(); const w = (hits.get(ip) || []).filter((x) => t - x < 60000); w.push(t); hits.set(ip, w); if (hits.size > 5000) hits.clear(); return w.length > perMinute; };
  const html = (res, code, body) => { res.set('Content-Type', 'text/html; charset=utf-8'); res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff'); res.set('Referrer-Policy', 'no-referrer'); return res.status(code).send(body); };
  router.get('/menu/:token', async (req, res) => {
    try {
      if (limited(req.ip || 'x')) return html(res, 429, '<p>Please try again in a minute.</p>');
      const token = req.params.token; if (!P.tokenOk(token)) return html(res, 404, '<p>Not found.</p>');
      const t = await models.Tenant.findOne({ 'settings.venue.menuToken': token, isActive: { $ne: false } });
      if (!t) return html(res, 404, '<p>Not found.</p>');
      const v = (t.settings && t.settings.venue) || {};
      const items = await runWithTenant(String(t._id), () => models.MenuItem.find({ tenantId: t._id, isActive: true }).sort({ category: 1, name: 1 }).limit(400));
      return html(res, 200, P.menuPage({ name: t.venueName, address: v.address, fssai: v.fssai, waNumber: v.waNumber }, (items || []).map((i) => (i.toObject ? i.toObject() : i))));
    } catch (e) { console.error('Dine public menu failed:', e.message); return html(res, 500, '<p>Something went wrong.</p>'); }
  });
  router.get('/app/tables', (req, res) => html(res, 200, P.shellPage('tables')));
  router.get('/app/kitchen', (req, res) => html(res, 200, P.shellPage('kitchen')));
  return router;
}
module.exports = { createPublicRouter };
