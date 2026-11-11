'use strict';
// Shifts, leave and the monthly payslip for Dine staff (Phase 2 item 6). Pure: whole rupees, INR, no clock, no database.
// Hours come from the punches (staff.js hoursWorked). We do NOT work out PF, ESI or income tax: the payslip says so and the owner's CA does that.
const bad = (m) => { const e = new Error(m); e.code = 'PEOPLE_INVALID'; throw e; };
const int = (n) => Math.round(Number(n) || 0);
const DATE = /^\d{4}-\d{2}-\d{2}$/; const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/; const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
const monthDays = (m) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate();

// A shift of one person on one day. A shift that ends before it starts runs past midnight (a bar closing late); at most 16 hours.
function checkShift(s) {
  if (!s || !DATE.test(s.date || '')) bad('Give the shift date.');
  if (!HHMM.test(s.from || '') || !HHMM.test(s.to || '')) bad('Give start and end times like 18:00.');
  const len = (mins(s.to) - mins(s.from) + 1440) % 1440; if (len === 0 || len > 960) bad('A shift must be more than 0 and at most 16 hours.');
  return { date: s.date, from: s.from, to: s.to, hours: Math.round((len / 60) * 10) / 10 };
}
// Two shifts of one person overlap on the same date. existing: [{ from, to }].
function overlaps(existing, s) {
  const a = mins(s.from); const b = a + ((mins(s.to) - a + 1440) % 1440);
  return (existing || []).some((e) => { const c = mins(e.from); const d = c + ((mins(e.to) - c + 1440) % 1440); return a < d && c < b; });
}
function checkLeave({ from, to, reason }) {
  if (!DATE.test(from || '') || !DATE.test(to || '')) bad('Give the first and last day of leave.');
  if (to < from) bad('The last day cannot be before the first day.');
  const n = daysBetween(from, to) + 1; if (n > 31) bad('Leave can be at most 31 days at a time.');
  return { from, to, days: n, reason: String(reason || '').trim().slice(0, 200) };
}
// Approved leave days that fall inside the month, split by paid or unpaid. leaves: [{ from, to, status, paid }].
function leaveInMonth(leaves, month) {
  const start = month + '-01'; const end = month + '-' + String(monthDays(month)).padStart(2, '0'); let paid = 0; let unpaid = 0;
  for (const l of leaves || []) { if (l.status !== 'approved') continue; const a = l.from > start ? l.from : start; const b = l.to < end ? l.to : end; if (b < a) continue; const n = daysBetween(a, b) + 1; if (l.paid) paid += n; else unpaid += n; }
  return { paid, unpaid };
}
// pay: { ratePerHour, monthly }. hours: from punches. Hourly pay wins when a rate is set; otherwise the monthly salary less unpaid leave days.
function payslip({ month, pay, hours, leave, advances = 0, otherDeductions = 0 }) {
  if (!MONTH.test(month || '')) bad('Pick a month like 2026-11.');
  const rate = int(pay && pay.ratePerHour); const monthly = int(pay && pay.monthly);
  if (rate < 0 || monthly < 0) bad('Pay cannot be negative.'); if (!rate && !monthly) bad('Set this person\'s hourly rate or monthly pay first.');
  const days = monthDays(month); const unpaid = (leave && leave.unpaid) || 0;
  const gross = rate ? int(rate * (Number(hours) || 0)) : Math.max(0, monthly - int((monthly * unpaid) / days));
  const ded = int(advances) + int(otherDeductions); const net = Math.max(0, gross - ded); const carry = Math.max(0, ded - gross);
  return { month, currency: 'INR', basis: rate ? 'hourly' : 'monthly', hours: Number(hours) || 0, ratePerHour: rate, monthly, unpaidLeaveDays: unpaid, paidLeaveDays: (leave && leave.paid) || 0, gross, advances: int(advances), otherDeductions: int(otherDeductions), net, carryForward: carry,
    note: 'PF, ESI and income tax are not worked out here. Your CA handles those.' };
}
module.exports = { checkShift, overlaps, checkLeave, leaveInMonth, payslip, monthDays };
