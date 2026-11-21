'use strict';
// Gym health score for Super Admin (SA-01). Pure rules: no database, no network, no AI.
// Input = account facts from the product (counts only: members, check-ins in 14 days, owner's last sign-in, plan status).
// Output = a 0 to 100 score, a level, plain reasons, and a suggested nudge for the support or sales person.
// It does not message anyone. A person decides; contact goes only through the consent-checked sales list.
const DAY = 86400000;
const LEVELS = { healthy: 75, watch: 45 }; // >= 75 healthy, >= 45 watch, below that at risk

function score(a, now = new Date()) {
  const s = a.status || {}; const u = a.usage || { members: 0, checkins14: 0 };
  if (s.status === 'expired' || s.status === 'suspended') return { level: 'lost', score: 0, reasons: [s.status === 'expired' ? 'Plan has expired' : 'Account is suspended'], nudge: null };
  const age = a.createdAt ? Math.floor((now - new Date(a.createdAt)) / DAY) : null;
  if (age !== null && age < 3) return { level: 'new', score: null, reasons: ['Signed up less than 3 days ago, too early to judge'], nudge: null };
  let pts = 100; const reasons = []; let nudge = null;
  const idle = a.lastActiveAt ? Math.floor((now - new Date(a.lastActiveAt)) / DAY) : null;
  if (idle === null) { pts -= 25; reasons.push('Owner has not signed in since sign-up'); nudge = 'Help the owner log in and add the first members.'; }
  else if (idle > 14) { pts -= 30; reasons.push(`Owner has not signed in for ${idle} days`); nudge = 'Check in with the owner: is something blocking them?'; }
  else if (idle > 7) { pts -= 12; reasons.push(`Owner has not signed in for ${idle} days`); }
  if (u.members === 0) { pts -= 40; reasons.push('No members added yet'); nudge = nudge || 'Offer to import their member list (Excel) for them.'; }
  else if (u.members < 10) { pts -= 10; reasons.push(`Only ${u.members} members added`); }
  if (u.members >= 10 && u.checkins14 === 0) { pts -= 25; reasons.push('No check-ins recorded in the last 14 days'); nudge = nudge || 'Show the owner the QR check-in poster or staff attendance screen.'; }
  if (s.status === 'grace') { pts -= 20; reasons.push('Plan is in the grace period'); nudge = nudge || 'Remind the owner to renew before the account turns read-only.'; }
  if (s.status === 'trial' && s.daysLeft != null && s.daysLeft <= 3 && (u.members < 10 || u.checkins14 === 0)) { pts -= 15; reasons.push(`Trial ends in ${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} and the gym is not set up yet`); nudge = nudge || 'Offer a quick call to finish set-up before the trial ends.'; }
  pts = Math.max(0, Math.min(100, pts));
  const level = pts >= LEVELS.healthy ? 'healthy' : pts >= LEVELS.watch ? 'watch' : 'at_risk';
  return { level, score: pts, reasons, nudge: level === 'healthy' ? null : nudge };
}

const ORDER = { at_risk: 0, watch: 1, new: 2, healthy: 3, lost: 4 };
// One row per account. No phone or email: contact goes through the sales list only.
function view(accounts, { now = new Date(), product = null } = {}) {
  let rows = (accounts || []).map((a, n) => { const h = score(a, now); return { id: `${a.product}:${n}`, product: a.product, business: String(a.businessName || '').slice(0, 120), plan: (a.status || {}).status, daysLeft: (a.status || {}).daysLeft == null ? null : a.status.daysLeft, members: (a.usage || {}).members || 0, checkins14: (a.usage || {}).checkins14 || 0, health: h.score, level: h.level, why: h.reasons.join('; '), nudge: h.nudge || '' }; });
  if (product) rows = rows.filter((r) => r.product === String(product).toLowerCase());
  rows.sort((x, y) => ORDER[x.level] - ORDER[y.level] || (x.health == null ? 101 : x.health) - (y.health == null ? 101 : y.health));
  return rows.slice(0, 1000);
}
const counts = (rows) => rows.reduce((o, r) => { o[r.level] = (o[r.level] || 0) + 1; return o; }, {});
module.exports = { score, view, counts, LEVELS };
