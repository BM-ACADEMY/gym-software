'use strict';
// Server-to-server only, for the all-products Super Admin. Protected by INTERNAL_API_KEY in the x-internal-key header; off when the key is unset.
//   GET /admin-summary   counts and rupee totals (contract version 1, same as the gym)
//   Counts only. No shop customer data and no owner contact details leave Cloth through this route (the sales-list route is Phase 2).
//   Cloth has no AI feature yet, so AI counts are zero (no usage model to read).
const crypto = require('crypto');
const { runUnscoped } = require('../../../packages/core-server/src');
const DAY = 86400000;

const keyOk = (given, key) => { const g = String(given || ''); return Boolean(key) && key.length >= 24 && g.length === key.length && crypto.timingSafeEqual(Buffer.from(g), Buffer.from(key)); };

// Pure: tenants [{id, shopName, createdAt, trialEndsAt, paidUntil, planKey, billingCycle, planStartedAt, isActive}], owners by tenantId, billing from core-billing.
function shapeSummary({ tenants, billing, active7dTenantIds = null, aiCallsToday, aiCostTodayInr, budgetInr, now = new Date() }) {
  const rows = tenants.map((t) => ({ t, s: billing.computeStatus(t, now) }));
  const count = (st) => rows.filter((r) => r.s.status === st).length;
  const ending = (kind, st, days) => rows.filter((r) => r.s.status === st && r.s.daysLeft != null && r.s.daysLeft <= days).slice(0, 20).map((r) => ({ name: r.t.shopName, kind, daysLeft: r.s.daysLeft }));
  const paying = rows.filter((r) => (r.s.status === 'active' || r.s.status === 'grace') && r.t.paidUntil && r.t.planKey);
  return { schema: 1, product: 'cloth', at: now.toISOString(), currency: 'INR',
    businesses: { total: rows.length, trial: count('trial'), paying: paying.length, grace: count('grace'), expired: count('expired'), suspended: count('suspended'), signups7d: tenants.filter((t) => t.createdAt && now - new Date(t.createdAt) <= 7 * DAY).length, active7d: Array.isArray(active7dTenantIds) ? new Set(active7dTenantIds.map(String)).size : null },
    mrr: paying.reduce((a, r) => a + billing.mrrOf(r.t), 0), collectedThisMonth: 0, // Cloth plan payments are recorded by core-billing, not read here yet (Assumption)
    endingSoon: ending('trial', 'trial', 3), renewalsDue: ending('renewal', 'active', 7),
    ai: { callsToday: aiCallsToday, costTodayInr: aiCostTodayInr, budgetInr, stopped: aiCostTodayInr >= budgetInr }, whatsappSentToday: 0, openTickets: 0 };
}
function createInternalRouter({ express, mongoose, billing, key, dailyBudgetInr = 300, prices = { in: 40, out: 160 } }) {
  const makeModels = require('./models'); const M = makeModels(mongoose); const router = express.Router();
  router.use((req, res, next) => (keyOk(req.headers['x-internal-key'], key) ? next() : res.status(401).json({ success: false, message: 'Unauthorized' })));
  router.get('/admin-summary', async (req, res) => {
    try {
      const now = new Date();
      const since = new Date(now.getTime() - 7 * DAY);
      const [tenants, active] = await Promise.all([M.Tenant.find({}).limit(5000).lean(), runUnscoped('Super Admin summary: which shops had a sign-in in 7 days, ids only, counted', () => M.User.distinct('tenantId', { lastLoginAt: { $gte: since } }))]);
      const u = { n: 0, i: 0, o: 0 }; // no AI in Cloth yet
      res.json({ success: true, data: shapeSummary({ tenants, billing, active7dTenantIds: active, aiCallsToday: u.n, aiCostTodayInr: Math.round(((u.i || 0) * prices.in + (u.o || 0) * prices.out) / 1e4) / 100, budgetInr: dailyBudgetInr, now }) });
    } catch (e) { console.error('cloth admin-summary failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
  });
  return router;
}
module.exports = { createInternalRouter, shapeSummary, keyOk };
