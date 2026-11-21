'use strict';
// Super Admin account pages and renewal lists (CRM-02). Read-only, pure rules: no database, no network.
// Input = account facts from the products (same shape as the sales list). Output has NO phone and NO email:
// contacts leave only through the audited sales file. Lead and follow-up work stays in the Afra AI OS Lead Hub.
const { stageOf, STAGES } = require('./salesList');
const DAY = 86400000;
const LABEL = { expired: 'Expired or in grace', 'renewal-1d': 'Renews in 1 day', 'trial-1d': 'Trial ends in 1 day', 'renewal-7d': 'Renews in 7 days', 'trial-3d': 'Trial ends in 3 days', 'new-signup': 'New sign-up', 'renewal-30d': 'Renews in 30 days', 'idle-14d': 'Not used for 14 days' };
const MAX_ROWS = 1000;

function view(accounts, { now = new Date(), only = null, product = null } = {}) {
  let rows = (accounts || []).map((a, n) => {
    const s = a.status || {}; const stage = stageOf(a, now);
    return { id: `${a.product}:${n}`, product: a.product, business: String(a.businessName || a.ownerName || '').slice(0, 120), owner: String(a.ownerName || '').slice(0, 80), status: s.status, daysLeft: Number.isFinite(s.daysLeft) ? s.daysLeft : null, endsAt: s.endsAt || null, joined: a.createdAt || null,
      lastActive: a.lastActiveAt || null, stage: stage ? LABEL[stage] : 'No action needed', _s: stage ? STAGES.indexOf(stage) : 99, canContact: a.contactConsent === true ? 'yes' : 'no' };
  });
  if (product) rows = rows.filter((r) => r.product === String(product).toLowerCase());
  if (only === 'renewals') rows = rows.filter((r) => r._s !== 99);
  rows.sort((x, y) => x._s - y._s || (x.daysLeft == null ? 1e9 : x.daysLeft) - (y.daysLeft == null ? 1e9 : y.daysLeft));
  const total = rows.length;
  return { rows: rows.slice(0, MAX_ROWS).map(({ _s, ...r }) => r), total, truncated: total > MAX_ROWS };
}
// Numbers only: safe to read out or paste.
function counts(accounts, { now = new Date() } = {}) {
  const out = { total: 0, byStatus: {}, byStage: {}, canContact: 0 };
  for (const a of accounts || []) { out.total += 1; const st = a.status && a.status.status; out.byStatus[st] = (out.byStatus[st] || 0) + 1; const g = stageOf(a, now); if (g) out.byStage[g] = (out.byStage[g] || 0) + 1; if (a.contactConsent === true) out.canContact += 1; }
  return out;
}
module.exports = { view, counts, LABEL, MAX_ROWS };
