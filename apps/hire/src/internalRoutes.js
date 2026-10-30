'use strict';
// Server-to-server only, for the all-products Super Admin. Protected by INTERNAL_API_KEY in the x-internal-key header; off when the key is unset.
//   GET /admin-summary   counts and rupee totals (contract version 1, same as the gym)
//   GET /admin-accounts  agency owner contact + plan status for the sales list (CRM-03). Contains phone/email: no-store, never logged.
const crypto = require('crypto');
const { runUnscoped } = require('../../../packages/core-server/src');
const DAY = 86400000;

const keyOk = (given, key) => { const g = String(given || ''); return Boolean(key) && key.length >= 24 && g.length === key.length && crypto.timingSafeEqual(Buffer.from(g), Buffer.from(key)); };

// Pure: tenants [{id, agencyName, createdAt, trialEndsAt, paidUntil, planKey, billingCycle, planStartedAt, isActive}], owners by tenantId, billing from core-billing.
function shapeSummary({ tenants, billing, aiCallsToday, aiCostTodayInr, budgetInr, now = new Date() }) {
  const rows = tenants.map((t) => ({ t, s: billing.computeStatus(t, now) }));
  const count = (st) => rows.filter((r) => r.s.status === st).length;
  const ending = (kind, st, days) => rows.filter((r) => r.s.status === st && r.s.daysLeft != null && r.s.daysLeft <= days).slice(0, 20).map((r) => ({ name: r.t.agencyName, kind, daysLeft: r.s.daysLeft }));
  const paying = rows.filter((r) => (r.s.status === 'active' || r.s.status === 'grace') && r.t.paidUntil && r.t.planKey);
  return { schema: 1, product: 'hire', at: now.toISOString(), currency: 'INR',
    businesses: { total: rows.length, trial: count('trial'), paying: paying.length, grace: count('grace'), expired: count('expired'), suspended: count('suspended'), signups7d: tenants.filter((t) => t.createdAt && now - new Date(t.createdAt) <= 7 * DAY).length },
    mrr: paying.reduce((a, r) => a + billing.mrrOf(r.t), 0), collectedThisMonth: 0, // Hire payments are not built yet
    endingSoon: ending('trial', 'trial', 3), renewalsDue: ending('renewal', 'active', 7),
    ai: { callsToday: aiCallsToday, costTodayInr: aiCostTodayInr, budgetInr, stopped: aiCostTodayInr >= budgetInr }, whatsappSentToday: 0, openTickets: 0 };
}
function shapeAccount({ tenant, owner, billing, now = new Date() }) {
  const st = billing.computeStatus(tenant, now);
  return { product: 'hire', businessName: tenant.agencyName, ownerName: owner ? owner.name : '', ownerPhone: owner ? owner.phone || '' : '', ownerEmail: owner ? owner.email || '' : '',
    contactConsent: Boolean(owner && owner.salesContactOk === true), createdAt: tenant.createdAt || null, lastActiveAt: owner ? owner.lastLoginAt || null : null,
    status: { status: st.status, daysLeft: st.daysLeft == null ? null : st.daysLeft, endsAt: st.endsAt || null } };
}

function createInternalRouter({ express, mongoose, billing, key, dailyBudgetInr = 300, prices = { in: 40, out: 160 } }) {
  const makeModels = require('./models'); const M = makeModels(mongoose); const router = express.Router();
  router.use((req, res, next) => (keyOk(req.headers['x-internal-key'], key) ? next() : res.status(401).json({ success: false, message: 'Unauthorized' })));
  router.get('/admin-summary', async (req, res) => {
    try {
      const now = new Date(); const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const [tenants, usage] = await Promise.all([M.Tenant.find({}).limit(5000).lean(), runUnscoped('Super Admin summary: AI use of all agencies, counts only', () => M.UsageLog.aggregate([{ $match: { createdAt: { $gte: start } } }, { $group: { _id: null, n: { $sum: 1 }, i: { $sum: '$inTokens' }, o: { $sum: '$outTokens' } } }]))]);
      const u = usage[0] || { n: 0, i: 0, o: 0 };
      res.json({ success: true, data: shapeSummary({ tenants, billing, aiCallsToday: u.n, aiCostTodayInr: Math.round(((u.i || 0) * prices.in + (u.o || 0) * prices.out) / 1e4) / 100, budgetInr: dailyBudgetInr, now }) });
    } catch (e) { console.error('hire admin-summary failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
  });
  router.get('/admin-accounts', async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store'); const now = new Date();
      const [tenants, owners] = await Promise.all([M.Tenant.find({}).limit(5000).lean(), runUnscoped('Super Admin sales list: first owner of every agency (key-protected, audited by the admin app)', () => M.User.find({ role: 'admin' }).sort({ createdAt: 1 }).select('tenantId name email lastLoginAt').lean())]);
      const first = new Map(); for (const o of owners) { const k = String(o.tenantId); if (!first.has(k)) first.set(k, o); }
      res.json({ success: true, data: tenants.map((t) => shapeAccount({ tenant: t, owner: first.get(String(t._id)), billing, now })) });
    } catch (e) { console.error('hire admin-accounts failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
  });
  return router;
}
module.exports = { createInternalRouter, shapeSummary, shapeAccount, keyOk };
