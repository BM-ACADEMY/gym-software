'use strict';
// Attendance, leave, shifts and the monthly payslip. Pure: whole rupees, INR. We do NOT work out PF, ESI or income tax:
// the payslip says so and the owner's CA handles statutory deductions (Decision: no filing, same as GST).
const int = (n) => Math.round(Number(n) || 0);
const STATUS = ['present', 'half', 'absent', 'paid_leave', 'unpaid_leave'];
const LEAVE_KINDS = ['paid', 'unpaid'];
const monthDays = (month) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
const weekdayOf = (day) => new Date(day + 'T00:00:00Z').getUTCDay();
const validMonth = (m) => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

// rows: [{ staffId, day, status }] -> { staffId: { present, half, absent, paid_leave, unpaid_leave } } for one month.
function monthSummary(rows, month) {
  const out = {};
  for (const r of rows || []) {
    if (!r || !STATUS.includes(r.status) || !String(r.day).startsWith(month + '-')) continue;
    const e = out[r.staffId] || (out[r.staffId] = { present: 0, half: 0, absent: 0, paid_leave: 0, unpaid_leave: 0 }); e[r.status] += 1;
  }
  return out;
}
// Days the business is open in the month (the days staff are expected to work), from its closed weekdays.
const workingDays = (month, closedWeekdays = [0]) => { let n = 0; for (let d = 1; d <= monthDays(month); d += 1) if (!closedWeekdays.includes(weekdayOf(`${month}-${String(d).padStart(2, '0')}`))) n += 1; return n; };

// Pay for the month. Paid days = present + half a day for each half + paid leave, out of the working days; capped at the working days.
// Days nobody marked count as NOT worked, so the owner sees them (unmarked) and can fix the sheet before paying.
function payslip({ month, baseSalary, closedWeekdays = [0], summary, commission = 0, advances = 0, otherDeductions = 0 }) {
  if (!validMonth(month)) return { error: 'Pick a month like 2026-11.' };
  const base = int(baseSalary); if (base < 0) return { error: 'Salary cannot be negative.' };
  const s = { present: 0, half: 0, absent: 0, paid_leave: 0, unpaid_leave: 0, ...(summary || {}) };
  const wd = workingDays(month, closedWeekdays); const marked = s.present + s.half + s.absent + s.paid_leave + s.unpaid_leave;
  const paidDays = Math.min(wd, s.present + s.half * 0.5 + s.paid_leave);
  const salaryPay = wd > 0 ? int((base * paidDays) / wd) : 0;
  const gross = salaryPay + int(commission); const deductions = int(advances) + int(otherDeductions);
  const net = Math.max(0, gross - deductions); const carryForward = Math.max(0, deductions - gross);
  return { month, currency: 'INR', baseSalary: base, workingDays: wd, paidDays, unmarkedDays: Math.max(0, wd - marked), attendance: s, salaryPay, commission: int(commission), advances: int(advances), otherDeductions: int(otherDeductions), gross, net, carryForward,
    text: `Salary Rs ${salaryPay} for ${paidDays} of ${wd} days, plus Rs ${int(commission)} commission, less Rs ${deductions} advances and deductions: pay Rs ${net}.${carryForward ? ` Rs ${carryForward} is carried to next month.` : ''}`, note: 'PF, ESI and income tax are not worked out here. Ask your CA.' };
}
// Dates from..to (inclusive) that are not a closed weekday, for filling an approved leave. At most 31 days.
function leaveDays(from, to, closedWeekdays = [0]) {
  const out = []; let d = from; let n = 0;
  while (d <= to && n < 31) { if (!closedWeekdays.includes(weekdayOf(d))) out.push(d); d = new Date(new Date(d + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10); n += 1; }
  return out;
}
function validShifts(list) {
  if (!Array.isArray(list) || list.length > 14) return { error: 'Send up to 14 shift rows.' };
  const out = [];
  for (const s of list) { if (!s || !Number.isInteger(s.weekday) || s.weekday < 0 || s.weekday > 6 || !Number.isInteger(s.start) || !Number.isInteger(s.end) || s.start < 0 || s.end > 1440 || s.start >= s.end) return { error: 'Each shift needs a weekday (0 to 6) and a start before the end, in minutes from midnight.' }; out.push({ weekday: s.weekday, start: s.start, end: s.end }); }
  return { value: out };
}
module.exports = { STATUS, LEAVE_KINDS, monthDays, workingDays, monthSummary, payslip, leaveDays, validShifts, validMonth };
