'use strict';
// CLO-07 staff: shifts, leave balance, commission on sales, payslip. Pure. Whole rupees (INR). Written, not yet tested by a person.
// Commission is a suggestion of what is payable; the owner pays it. Basis is the line amount before GST (taxable) after discounts.
const { monthPay, STATUS } = require('./staffRules');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isInt = Number.isInteger;

// shift: { start, end } minutes from midnight, days: [0..6] (0 = Sunday)
function validShift(s) {
  if (!s || !isInt(s.start) || !isInt(s.end) || s.start < 0 || s.end > 1440 || s.start >= s.end) return { error: 'Shift: start and end in minutes from midnight, start before end.' };
  const days = Array.isArray(s.days) ? [...new Set(s.days)] : [];
  if (!days.length || days.length > 7 || !days.every((d) => isInt(d) && d >= 0 && d <= 6)) return { error: 'Shift: choose the days (0 = Sunday to 6 = Saturday).' };
  return { value: { start: s.start, end: s.end, days: days.sort() } };
}
// Paid leave a person has left this year: allowance minus days of status 'leave' already marked in earlier months of the year.
// marksYear: [{date,status}] for the whole year. month: 'YYYY-MM'. Returns used before the month, left, and paid days for this month.
function leaveFor({ allowance = 12, marksYear, month }) {
  const leave = (marksYear || []).filter((m) => m && m.status === 'leave' && typeof m.date === 'string' && m.date.slice(0, 4) === month.slice(0, 4));
  const before = leave.filter((m) => m.date.slice(0, 7) < month).length; const thisMonth = leave.filter((m) => m.date.slice(0, 7) === month).length;
  const left = Math.max(0, allowance - before); const paid = Math.min(left, thisMonth);
  return { allowance, usedBefore: before, leftBefore: left, leaveThisMonth: thisMonth, paidThisMonth: paid, unpaidThisMonth: thisMonth - paid, leftAfter: left - paid };
}
// Rules: { default, byStaff: {id: rule} }; rule { type: 'percent'|'flat', value }. flat = rupees per bill line. Most specific wins.
const okRule = (r) => r && (r.type === 'percent' || r.type === 'flat') && Number.isFinite(r.value) && r.value >= 0 && (r.type !== 'percent' || r.value <= 100);
const ruleFor = (rules, staffId) => [rules && rules.byStaff && rules.byStaff[staffId], rules && rules.default].find(okRule) || null;
function commissionOf(lines, staffId, rules) {
  const rule = ruleFor(rules, staffId); if (!rule) return { amount: 0, lines: 0, base: 0 };
  let amount = 0, n = 0, base = 0;
  for (const l of lines || []) {
    if (!l || String(l.staffId) !== String(staffId)) continue;
    const b = Math.round(Number(l.taxable != null ? l.taxable : l.net) || 0); if (b <= 0) continue;
    base += b; n++; amount += Math.min(b, rule.type === 'percent' ? Math.round((b * rule.value) / 100) : Math.round(rule.value));
  }
  return { amount, lines: n, base, rule };
}
// Lines of paid (not returned) bills for the month. bills: [{status, lines}] as billsBetween returns them.
const monthLines = (bills) => (bills || []).filter((b) => b.status !== 'returned').flatMap((b) => b.lines || []);
// One payslip, all numbers computed here so the page and the JSON agree.
function payslip({ shop, staff, month, marks, marksYear, daysInMonth, allowance = 12, bills, rules }) {
  const lv = leaveFor({ allowance, marksYear: marksYear || marks, month });
  const pay = monthPay({ salary: staff.salary, marks, daysInMonth, paidLeave: lv.paidThisMonth });
  if (pay.error) return { error: pay.error };
  const com = commissionOf(monthLines(bills), String(staff.id || staff._id), rules);
  return { shop, name: staff.name, month, currency: 'INR', salary: staff.salary, daysLost: pay.daysLost, salaryPay: pay.pay, commission: com.amount, commissionLines: com.lines, total: pay.pay + com.amount, leave: lv,
    note: 'Commission is what the rules say is payable. Check it before paying.' };
}
function payslipHtml(p) {
  const row = (a, b) => `<tr><td>${esc(a)}</td><td style="text-align:right">${esc(b)}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Payslip ${esc(p.name)} ${esc(p.month)}</title><style>body{font:14px sans-serif;max-width:520px;margin:20px auto}table{width:100%;border-collapse:collapse}td{padding:6px;border-bottom:1px solid #ddd}h1{font-size:18px}</style></head><body><h1>${esc(p.shop || 'Payslip')}</h1><p>${esc(p.name)} · ${esc(p.month)}</p><table>${row('Monthly salary', 'Rs ' + p.salary)}${row('Days not paid', p.daysLost)}${row('Salary payable', 'Rs ' + p.salaryPay)}${row('Commission', 'Rs ' + p.commission)}${row('Total payable', 'Rs ' + p.total)}${row('Paid leave left after this month', p.leave.leftAfter + ' days')}</table><p style="color:#666;font-size:12px">${esc(p.note)}</p></body></html>`;
}
module.exports = { STATUS, validShift, leaveFor, okRule, ruleFor, commissionOf, monthLines, payslip, payslipHtml };
