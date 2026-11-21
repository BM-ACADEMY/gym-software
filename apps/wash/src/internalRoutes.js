'use strict';
// Server-to-server only, for the all-products Super Admin. Counts only: no customer, vehicle or phone data leaves Wash here.
// Protected by INTERNAL_API_KEY in the x-internal-key header (24+ characters); the route answers 401 for everyone when the key is unset.
//   GET /admin-summary   contract version 1, same shape as the gym and Hire
const crypto = require('crypto');
const { runUnscoped } = require('../../../packages/core-server/src');
const DAY = 86400000;
const keyOk = (given, key) => { const g = String(given || ''); return Boolean(key) && key.length >= 24 && g.length === key.length && crypto.timingSafeEqual(Buffer.from(g), Buffer.from(key)); };

// Pure. tenants: [{ businessName, createdAt, trialEndsAt, paidUntil, planKey, billingCycle }], billing from core-billing.
function shapeSummary({ tenants, billing, active7dTenantIds = null, now = new Date() }) {
  const rows = tenants.map((t) => ({ t, s: billing.computeStatus(t, now) }));
  const count = (st) => rows.filter((r) => r.s.status === st).length;
  const ending = (kind, st, days) => rows.filter((r) => r.s.status === st && r.s.daysLeft != null && r.s.daysLeft <= days).slice(0, 20).map((r) => ({ name: r.t.businessName, kind, daysLeft: r.s.daysLeft }));
  const paying = rows.filter((r) => (r.s.status === 'active' || r.s.status === 'grace') && r.t.paidUntil && r.t.planKey);
  return { schema: 1, product: 'wash', at: now.toISOString(), currency: 'INR',
    businesses: { total: rows.length, trial: count('trial'), paying: paying.length, grace: count('grace'), expired: count('expired'), suspended: count('suspended'), signups7d: tenants.filter((t) => t.createdAt && now - new Date(t.createdAt) <= 7 * DAY).length, active7d: Array.isArray(active7dTenantIds) ? new Set(active7dTenantIds.map(String)).size : null },
    mrr: paying.reduce((a, r) => a + billing.mrrOf(r.t), 0), collectedThisMonth: 0, // Wash payments through Razorpay are not wired yet
    endingSoon: ending('trial', 'trial', 3), renewalsDue: ending('renewal', 'active', 7),
    ai: { callsToday: 0, costTodayInr: 0, budgetInr: 0, stopped: false }, whatsappSentToday: 0, openTickets: 0 };
}
function createInternalRouter({ express, mongoose, models, billing, key }) {
  const makeModels = require('./models'); const M = models || makeModels(mongoose); const router = express.Router();
  router.use((req, res, next) => (keyOk(req.headers['x-internal-key'], key) ? next() : res.status(401).json({ success: false, message: 'Unauthorized' })));
  router.get('/admin-summary', async (req, res) => {
    try {
      const now = new Date(); const since = new Date(now.getTime() - 7 * DAY);
      const [tenants, active] = await Promise.all([M.Tenant.find({}).limit(5000).lean(), runUnscoped('Super Admin summary: which wash businesses had a sign-in in 7 days, ids only, counted', () => M.User.distinct('tenantId', { lastLoginAt: { $gte: since } }))]);
      res.set('Cache-Control', 'no-store');
      res.json({ success: true, data: shapeSummary({ tenants, billing, active7dTenantIds: active, now }) });
    } catch (e) { console.error('wash admin-summary failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
  });
  return router;
}
module.exports = { createInternalRouter, shapeSummary, keyOk };
