// Pure billing rules for GymDesk's own subscription (no database, no network).
// Money is whole rupees. GST rate/treatment must be confirmed with your CA.
const { PLANS, GST_RATE } = require('../config/plans');

const DAY = 24 * 60 * 60 * 1000;
const CYCLES = { monthly: { months: 1, days: 30 }, yearly: { months: 12, days: 365 } };
const RANK = { solo: 0, starter: 1, growth: 2, pro: 3 };
const MAX_CREDIT_SHARE = 0.9; // an upgrade never becomes (nearly) free

const listPrice = (plan, cycle) => {
  if (!PLANS[plan] || !CYCLES[cycle]) throw new Error('Unknown plan or cycle');
  return PLANS[plan][cycle];
};

// gstMode 'cgst_sgst' (seller and buyer in the same state) splits GST in two
// halves; 'igst' charges it as one line. Total is identical either way.
const quote = ({ plan, cycle, creditRupees = 0, gstMode = 'cgst_sgst' }) => {
  const base = listPrice(plan, cycle);
  const credit = Math.max(0, Math.min(Math.floor(creditRupees), Math.floor(base * MAX_CREDIT_SHARE)));
  const taxable = base - credit;
  const gst = Math.round((taxable * GST_RATE) / 100);
  let cgst = 0, sgst = 0, igst = 0;
  if (gstMode === 'igst') igst = gst;
  else { cgst = Math.round(gst / 2); sgst = gst - cgst; }
  return { base, credit, taxable, gst, cgst, sgst, igst, total: taxable + gst, gstMode, gstRate: GST_RATE, currency: 'INR' };
};

// Credit for the unused part of the current paid period (list price, daily rate).
const prorationCredit = ({ plan, cycle, paidUntil, now = new Date() }) => {
  if (!paidUntil || !PLANS[plan] || !CYCLES[cycle]) return 0;
  const left = Math.ceil((new Date(paidUntil).getTime() - now.getTime()) / DAY);
  if (left <= 0) return 0;
  return Math.floor((listPrice(plan, cycle) * left) / CYCLES[cycle].days);
};

// Calendar months, clamped (31 Jan + 1 month = 28/29 Feb).
const addPeriod = (from, cycle) => {
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + CYCLES[cycle].months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
};

// Indian financial year label, e.g. 2026-27 (April to March), in IST.
const fyOf = (date) => {
  const ist = new Date(new Date(date).getTime() + 5.5 * 60 * 60 * 1000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
};

const invoiceNumber = (prefix, fy, seq) => `${prefix}/${fy}/${String(seq).padStart(4, '0')}`;

// How a purchase starts given the gym's current computed status.
//   extend: same plan while active, new period begins when the paid one ends
//   now:    upgrade (with credit), or nothing paid yet
// Returns { startMode, creditRupees } or { blocked, code }.
const purchaseRule = ({ status, currentPlan, currentCycle, paidUntil, newPlan, now = new Date() }) => {
  if (status.status === 'suspended') return { blocked: 'This gym is suspended. Please contact support.', code: 'suspended' };
  const paidAndLive = status.status === 'active' && paidUntil && new Date(paidUntil) > now && currentPlan;
  if (!paidAndLive) return { startMode: 'now', creditRupees: 0 };
  if (newPlan === currentPlan) return { startMode: 'extend', creditRupees: 0 };
  if (RANK[newPlan] < RANK[currentPlan]) {
    return { blocked: 'To move to a smaller plan, choose it after your current period ends.', code: 'downgrade_later' };
  }
  return { startMode: 'now', creditRupees: prorationCredit({ plan: currentPlan, cycle: currentCycle || 'monthly', paidUntil, now }) };
};

// GST place of supply: same state as the seller means CGST + SGST, any other
// state means IGST. Puducherry has its own SGST, so it behaves like a state.
const normState = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
const gstModeFor = (buyerState, sellerState) => (normState(buyerState) && normState(buyerState) === normState(sellerState) ? 'cgst_sgst' : 'igst');

module.exports = { normState, gstModeFor, DAY, CYCLES, RANK, listPrice, quote, prorationCredit, addPeriod, fyOf, invoiceNumber, purchaseRule };
