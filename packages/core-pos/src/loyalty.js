// Loyalty points (owner request: one loyalty model for every business). Whole numbers only.
const bad = (m) => { const e = new Error(m); e.code = 'LOYALTY_INVALID'; throw e; };
const DEFAULTS = { earnPer100: 5, pointValueRupees: 1, maxRedeemShare: 0.5, minRedeem: 50 };

const rules = (r = {}) => ({ ...DEFAULTS, ...r });

// Points for what the customer actually paid (not for points or gift cards used to pay).
const earn = (amountPaidRupees, r) => {
  const { earnPer100 } = rules(r);
  const a = Math.floor(Number(amountPaidRupees) || 0);
  return a <= 0 ? 0 : Math.floor((a * earnPer100) / 100);
};

// How many points may be used on this bill, and what they are worth in rupees.
const redeem = ({ requestedPoints, balance, billTotal }, r) => {
  const { pointValueRupees, maxRedeemShare, minRedeem } = rules(r);
  const want = Math.floor(Number(requestedPoints) || 0);
  if (want < 0) bad('Points cannot be negative.');
  if (want === 0) return { points: 0, rupees: 0 };
  if (want < minRedeem) bad(`Use at least ${minRedeem} points at a time.`);
  if (want > balance) bad('Not enough points.');
  const cap = Math.floor((billTotal * maxRedeemShare) / pointValueRupees);
  const points = Math.min(want, cap);
  return { points, rupees: points * pointValueRupees };
};

// Ledger rows are the truth; the balance is always the sum. Prevents a stored balance drifting.
const balanceOf = (ledger) => ledger.reduce((a, e) => a + (Number(e.points) || 0), 0);

// A return gives back the points earned on that bill and restores points used.
const reverseForReturn = ({ earned, redeemed, share = 1 }) => ({
  points: -Math.floor(earned * share) + Math.floor(redeemed * share),
});

module.exports = { DEFAULTS, earn, redeem, balanceOf, reverseForReturn };
