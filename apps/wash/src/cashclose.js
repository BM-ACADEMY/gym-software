'use strict';
// Day-end cash closing: cash the till should hold (cash-paid bills minus cash refunds plus opening float) vs cash declared.
// The leakage check. Whole rupees. A difference above the limit is flagged for the owner, never auto-accused.
function closing({ bills = [], refunds = [], openingFloat = 0, declared, limit = 50 }) {
  if (!Number.isInteger(declared) || declared < 0) return { error: 'Count the cash and enter whole rupees' };
  const cashIn = bills.filter((b) => b.method === 'cash').reduce((s, b) => s + (b.amount || 0), 0);
  const cashOut = refunds.filter((r) => r.method === 'cash').reduce((s, r) => s + (r.amount || 0), 0);
  const expected = openingFloat + cashIn - cashOut;
  const diff = declared - expected;
  return { expected, declared, diff, flag: Math.abs(diff) > limit, currency: 'INR', upiTotal: bills.filter((b) => b.method === 'upi').reduce((s, b) => s + (b.amount || 0), 0), cardTotal: bills.filter((b) => b.method === 'card').reduce((s, b) => s + (b.amount || 0), 0) };
}
module.exports = { closing };
