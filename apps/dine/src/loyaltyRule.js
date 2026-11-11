'use strict';
// The owner's loyalty settings, kept inside safe limits. Off until the owner turns it on. Pure.
const L = require('../../../packages/core-pos/src/loyalty');
const inInt = (v, lo, hi, d) => (Number.isInteger(v) && v >= lo && v <= hi ? v : d);
function normalize(r) {
  const x = r && typeof r === 'object' ? r : {};
  return { enabled: x.enabled === true, earnPer100: inInt(x.earnPer100, 0, 100, L.DEFAULTS.earnPer100), pointValueRupees: inInt(x.pointValueRupees, 1, 100, L.DEFAULTS.pointValueRupees),
    maxRedeemShare: Number.isFinite(x.maxRedeemShare) && x.maxRedeemShare >= 0 && x.maxRedeemShare <= 1 ? x.maxRedeemShare : L.DEFAULTS.maxRedeemShare, minRedeem: inInt(x.minRedeem, 1, 10000, L.DEFAULTS.minRedeem) };
}
// Points to give for a bill: on what the customer actually paid (not what is still owed).
const pointsForBill = (rule, { total, due }) => { const r = normalize(rule); return r.enabled ? L.earn(Math.max(0, Math.round(Number(total) || 0) - Math.round(Number(due) || 0)), r) : 0; };
module.exports = { normalize, pointsForBill };
