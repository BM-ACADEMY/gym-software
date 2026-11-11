'use strict';
// Staff basics: attendance counts and a simple month salary. Shifts, leave and payslips are Phase 2 (core payroll).
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const STATUS = ['present', 'half', 'absent', 'leave'];
// marks: [{date,status}] for one month; salary monthly whole rupees; daysInMonth number. Absent and leave without pay reduce pay; half = half day.
function monthPay({ salary, marks, daysInMonth, paidLeave = 0 }) {
  if (!Number.isInteger(salary) || salary < 0 || !Number.isInteger(daysInMonth)) return { error: 'Salary must be whole rupees.' };
  const m = (marks || []).filter((x) => isDate(x.date) && STATUS.includes(x.status));
  const absent = m.filter((x) => x.status === 'absent').length + m.filter((x) => x.status === 'leave').length - paidLeave;
  const half = m.filter((x) => x.status === 'half').length;
  const lost = Math.max(0, absent) + half * 0.5;
  const pay = Math.max(0, Math.round(salary - (salary / daysInMonth) * lost));
  return { salary, daysLost: lost, pay, currency: 'INR' };
}
module.exports = { STATUS, monthPay, isDate };
