'use strict';
// config: { plans: { key: { key, name, monthly, yearly, limits:{...}, ... } }, gstRate, graceDays, trialDays, trialPlanKey, ranks:{key:number} }
// Money is whole rupees excluding GST. Status is always computed from dates, never stored.
const DAY = 24 * 60 * 60 * 1000;
const CYCLES = { monthly: { months: 1, days: 30 }, yearly: { months: 12, days: 365 } };
const MAX_CREDIT_SHARE = 0.9;

function makeBilling(config) {
  const { plans, gstRate, graceDays, trialDays, trialPlanKey, ranks } = config;
  const getPlan = (k) => (k && plans[k]) || null;

  const computeStatus = (sub, now = new Date()) => {
    if (!sub) return { status: 'expired', readOnly: true };
    const t = now.getTime();
    if (sub.isActive === false) return { status: 'suspended', readOnly: true, planKey: sub.planKey || null };
    const paidUntil = sub.paidUntil ? new Date(sub.paidUntil).getTime() : null;
    const trialEnds = sub.trialEndsAt ? new Date(sub.trialEndsAt).getTime() : null;
    if (paidUntil) {
      if (paidUntil > t) return { status: 'active', readOnly: false, planKey: sub.planKey, endsAt: new Date(paidUntil), daysLeft: Math.ceil((paidUntil - t) / DAY) };
      const graceEnds = paidUntil + graceDays * DAY;
      if (t < graceEnds) return { status: 'grace', readOnly: false, planKey: sub.planKey, endsAt: new Date(graceEnds), daysLeft: Math.ceil((graceEnds - t) / DAY) };
      return { status: 'expired', readOnly: true, planKey: sub.planKey, endsAt: new Date(paidUntil) };
    }
    if (sub.planStartedAt) return { status: 'active', readOnly: false, planKey: sub.planKey || null, legacy: true };
    if (trialEnds) {
      if (trialEnds > t) return { status: 'trial', readOnly: false, planKey: trialPlanKey, endsAt: new Date(trialEnds), daysLeft: Math.ceil((trialEnds - t) / DAY) };
      return { status: 'expired', readOnly: true, planKey: trialPlanKey, endsAt: new Date(trialEnds), trialExpired: true };
    }
    return { status: 'active', readOnly: false, planKey: sub.planKey || null, legacy: true };
  };
  const effectivePlan = (sub, now) => { const s = computeStatus(sub, now); return s.planKey ? getPlan(s.planKey) : null; };
  const trialDates = (now = new Date()) => ({ trialEndsAt: new Date(now.getTime() + trialDays * DAY) });

  const listPrice = (plan, cycle) => { if (!plans[plan] || !CYCLES[cycle]) throw new Error('Unknown plan or cycle'); return plans[plan][cycle]; };
  const quote = ({ plan, cycle, creditRupees = 0, gstMode = 'cgst_sgst', discountPercent = 0 }) => {
    const base = listPrice(plan, cycle);
    const credit = Math.max(0, Math.min(Math.floor(creditRupees), Math.floor(base * MAX_CREDIT_SHARE)));
    const pct = Math.max(0, Math.min(Number(discountPercent) || 0, 100));
    const discount = Math.min(Math.floor((base * pct) / 100), base - credit);
    const taxable = base - credit - discount;
    const gst = Math.round((taxable * gstRate) / 100);
    let cgst = 0, sgst = 0, igst = 0;
    if (gstMode === 'igst') igst = gst; else { cgst = Math.round(gst / 2); sgst = gst - cgst; }
    return { base, credit, discount, taxable, gst, cgst, sgst, igst, total: taxable + gst, gstMode, gstRate, currency: 'INR' };
  };
  const prorationCredit = ({ plan, cycle, paidUntil, now = new Date() }) => {
    if (!paidUntil || !plans[plan] || !CYCLES[cycle]) return 0;
    const left = Math.ceil((new Date(paidUntil).getTime() - now.getTime()) / DAY);
    return left <= 0 ? 0 : Math.floor((listPrice(plan, cycle) * left) / CYCLES[cycle].days);
  };
  const purchaseRule = ({ status, currentPlan, currentCycle, paidUntil, newPlan, now = new Date() }) => {
    if (status.status === 'suspended') return { blocked: 'This account is suspended. Please contact support.', code: 'suspended' };
    const paidAndLive = status.status === 'active' && paidUntil && new Date(paidUntil) > now && currentPlan;
    if (!paidAndLive) return { startMode: 'now', creditRupees: 0 };
    if (newPlan === currentPlan) return { startMode: 'extend', creditRupees: 0 };
    if (ranks[newPlan] < ranks[currentPlan]) return { blocked: 'To move to a smaller plan, choose it after your current period ends.', code: 'downgrade_later' };
    return { startMode: 'now', creditRupees: prorationCredit({ plan: currentPlan, cycle: currentCycle || 'monthly', paidUntil, now }) };
  };
  const mrrOf = (sub) => { const p = getPlan(sub.planKey); return !p ? 0 : sub.billingCycle === 'yearly' ? Math.round(p.yearly / 12) : p.monthly; };

  // limits: { candidates: 1000 } on a plan; null means unlimited. Returns { ok, limit, used }.
  const checkLimit = (planKey, name, used) => {
    const p = getPlan(planKey); if (!p) return { ok: false, limit: 0, used };
    const limit = p.limits ? p.limits[name] : undefined;
    return limit == null ? { ok: true, limit: null, used } : { ok: used < limit, limit, used };
  };
  // For route guards: writes are blocked once read-only (expired or suspended); reading and paying stay open.
  const guardWrite = (sub, method, now = new Date()) => {
    const s = computeStatus(sub, now);
    if (!s.readOnly || ['GET', 'HEAD', 'OPTIONS'].includes(String(method).toUpperCase())) return { ok: true, status: s };
    return { ok: false, status: s, httpStatus: 402, message: s.status === 'suspended' ? 'This account is suspended. Please contact support.' : 'Your plan has ended, so this account is read-only. Renew to make changes.' };
  };
  return { computeStatus, effectivePlan, trialDates, listPrice, quote, prorationCredit, purchaseRule, mrrOf, checkLimit, guardWrite, getPlan, CYCLES, DAY };
}

// Shared, product-neutral helpers.
const addPeriod = (from, cycle) => {
  const d = new Date(from); const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + CYCLES[cycle].months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(day, last)); return d;
};
const fyOf = (date) => { const ist = new Date(new Date(date).getTime() + 5.5 * 3600000); const y = ist.getUTCFullYear(); const s = ist.getUTCMonth() >= 3 ? y : y - 1; return `${s}-${String((s + 1) % 100).padStart(2, '0')}`; };
const invoiceNumber = (prefix, fy, seq) => `${prefix}/${fy}/${String(seq).padStart(4, '0')}`;
const normState = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
const gstModeFor = (buyerState, sellerState) => (normState(buyerState) && normState(buyerState) === normState(sellerState) ? 'cgst_sgst' : 'igst');

module.exports = { makeBilling, addPeriod, fyOf, invoiceNumber, gstModeFor, normState, CYCLES, DAY };
