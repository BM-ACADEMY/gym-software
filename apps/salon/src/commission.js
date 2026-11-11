'use strict';
// Staff commission, whole rupees. The most specific rule wins: staff + service, then staff, then service, then the default.
// rule: { type: 'percent', value: 40 } or { type: 'flat', value: 50 }. A line: { staffId, serviceKey, amount } (amount after discount).
const ok = (r) => r && (r.type === 'percent' || r.type === 'flat') && Number.isFinite(r.value) && r.value >= 0 && (r.type !== 'percent' || r.value <= 100);
function pickRule(rules, staffId, serviceKey) {
  const r = rules || {};
  const order = [r.byStaffService && r.byStaffService[staffId + ':' + serviceKey], r.byStaff && r.byStaff[staffId], r.byService && r.byService[serviceKey], r.default];
  return order.find(ok) || null;
}
const commissionFor = (line, rules) => {
  if (!line || !Number.isInteger(line.amount) || line.amount < 0) return 0;
  const rule = pickRule(rules, line.staffId, line.serviceKey);
  if (!rule) return 0;
  const c = rule.type === 'percent' ? Math.round((line.amount * rule.value) / 100) : Math.round(rule.value);
  return Math.min(c, line.amount); // never more than the line itself
};
// Totals per staff member for a list of bill lines.
function totalsByStaff(lines, rules) {
  const out = {};
  for (const l of lines || []) { if (!l || !l.staffId) continue; out[l.staffId] = (out[l.staffId] || 0) + commissionFor(l, rules); }
  return out;
}
module.exports = { pickRule, commissionFor, totalsByStaff };
