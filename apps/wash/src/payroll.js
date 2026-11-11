'use strict';
// Shifts, leave balance and payslip for wash attendants. Whole rupees, INR. Pure. (No core payroll package exists in this
// repo, so the rules live here; they are simple and the owner can read the words on every payslip.)
// Rules (Assumption, owner can change the numbers): pay per day = monthly salary / days in the month; absent days and leave days
// beyond the paid-leave allowance are not paid; a day with no mark is counted as worked (the payslip says so). Incentive is added.
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const isInt = (n) => Number.isInteger(n);
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const daysInMonth = (month) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

function checkShift(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s.day || '')) return { error: 'Choose the day' };
  if (!HHMM.test(s.from || '') || !HHMM.test(s.to || '')) return { error: 'Shift times look like 09:00 and 18:00' };
  if (toMin(s.to) <= toMin(s.from)) return { error: 'The shift must end after it starts' };
  if (toMin(s.to) - toMin(s.from) > 16 * 60) return { error: 'A shift is at most 16 hours' };
  return { value: { day: s.day, from: s.from, to: s.to, hours: Math.round(((toMin(s.to) - toMin(s.from)) / 60) * 10) / 10 } };
}
function checkPay(b) {
  const out = {};
  if (b && b.monthlySalary !== undefined) { if (!isInt(b.monthlySalary) || b.monthlySalary < 0 || b.monthlySalary > 1000000) return { error: 'Monthly salary is whole rupees' }; out.monthlySalary = b.monthlySalary; }
  if (b && b.paidLeavePerMonth !== undefined) { if (!isInt(b.paidLeavePerMonth) || b.paidLeavePerMonth < 0 || b.paidLeavePerMonth > 10) return { error: 'Paid leave is 0 to 10 days a month' }; out.paidLeavePerMonth = b.paidLeavePerMonth; }
  return Object.keys(out).length ? { value: out } : { error: 'Nothing to change' };
}
// att: { present, absent, leave } counts for the month. Returns what is left of paid leave and how much leave is unpaid.
function leaveBalance({ paidLeavePerMonth = 1, leave = 0 }) {
  const paid = Math.min(leave, paidLeavePerMonth);
  return { allowance: paidLeavePerMonth, paidLeaveUsed: paid, paidLeaveLeft: paidLeavePerMonth - paid, unpaidLeave: Math.max(0, leave - paidLeavePerMonth) };
}
function payslip({ month, name, monthlySalary, paidLeavePerMonth = 1, att = {}, incentive = 0, jobs = 0 }) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) return { error: 'Choose a month like 2026-11' };
  if (!isInt(monthlySalary) || monthlySalary < 0) return { error: 'Set the monthly salary first' };
  const dim = daysInMonth(month); const a = { present: 0, absent: 0, leave: 0, ...att };
  const lb = leaveBalance({ paidLeavePerMonth, leave: a.leave });
  const unpaidDays = Math.min(dim, a.absent + lb.unpaidLeave);
  const marked = a.present + a.absent + a.leave; const unmarked = Math.max(0, dim - marked);
  const base = Math.round((monthlySalary * (dim - unpaidDays)) / dim);
  const inc = isInt(incentive) && incentive > 0 ? incentive : 0;
  const gross = base + inc;
  const words = `${name || 'Attendant'}: salary Rs ${monthlySalary} for ${dim} days; ${unpaidDays} unpaid day${unpaidDays === 1 ? '' : 's'} (${a.absent} absent, ${lb.unpaidLeave} leave beyond the ${lb.allowance} paid); base Rs ${base}; incentive Rs ${inc} for ${jobs} job${jobs === 1 ? '' : 's'}; total Rs ${gross}.${unmarked ? ` ${unmarked} day${unmarked === 1 ? ' was' : 's were'} not marked and counted as worked.` : ''}`;
  return { month, name, daysInMonth: dim, monthlySalary, present: a.present, absent: a.absent, leave: a.leave, unpaidDays, unmarkedDays: unmarked, ...lb, base, incentive: inc, jobs, gross, words, currency: 'INR' };
}
module.exports = { checkShift, checkPay, leaveBalance, payslip, daysInMonth };
