'use strict';
// Public routes for the booking link. NO sign-in: the secret token is the key. Mounted at /api/wash-book.
//   GET  /:token          the plain HTML page
//   POST /:token/request  a customer asks for a slot (a request, not a confirmation)
// Rate limited per link and per caller, capped number of waiting requests, same answer for a wrong or switched-off link.
const crypto = require('crypto');
const { runWithTenant } = require('../../../packages/core-server/src');
const makeModels = require('./models');
const B = require('./booking');
const dayIST = (d) => new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
const MAX_WAITING = 200;

function createPublicBookingRouter({ express, mongoose, models, isOpen = () => true, now = () => new Date(), limiter = B.makeLimiter(5), pageLimiter = B.makeLimiter(60) }) {
  const router = express.Router(); const M = models || makeModels(mongoose);
  const gone = (res) => res.status(404).json({ success: false, message: 'This link is not valid.' });
  const tenantOf = async (token) => (typeof token === 'string' && B.TOKEN.test(token) ? M.Tenant.findOne({ bookingToken: token }) : null);
  router.get('/:token', async (req, res) => {
    try {
      if (!pageLimiter('p:' + (req.ip || ''))) return res.status(429).send('Too many requests');
      const t = await tenantOf(req.params.token); if (!t || !isOpen(t)) return res.status(404).type('text/plain').send('This link is not valid.');
      const nonce = crypto.randomBytes(16).toString('hex'); const h = B.securityHeaders(nonce); for (const k of Object.keys(h)) res.set(k, h[k]);
      res.type('html').send(B.renderPage({ businessName: t.businessName, token: req.params.token, today: dayIST(now()), nonce }));
    } catch (e) { console.error('Wash booking page failed:', e.message); res.status(500).type('text/plain').send('Server error'); }
  });
  router.post('/:token/request', async (req, res) => {
    try {
      const t = await tenantOf(req.params.token); if (!t || !isOpen(t)) return gone(res);
      if (!limiter('t:' + req.params.token) || !limiter('i:' + (req.ip || ''))) return res.status(429).json({ success: false, message: 'Too many requests. Please call the business.' });
      const c = B.checkRequest(req.body, dayIST(now())); if (c.error) return res.status(400).json({ success: false, message: c.error });
      const tid = String(t._id);
      return await runWithTenant(tid, async () => {
        if ((await M.Booking.countDocuments({ tenantId: tid, status: 'new' })) >= MAX_WAITING) return res.status(429).json({ success: false, message: 'The business has many requests waiting. Please call them.' });
        try { await M.Booking.create({ tenantId: tid, ...c.value, status: 'new', consentAt: now() }); }
        catch (err) { if (err.code === 11000) return res.json({ success: true, message: 'We already have your request for that time. The business will call you.' }); throw err; }
        return res.status(201).json({ success: true, message: 'Request sent. The business will call you to confirm.' });
      });
    } catch (e) { console.error('Wash booking request failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
  });
  return router;
}
module.exports = { createPublicBookingRouter };
