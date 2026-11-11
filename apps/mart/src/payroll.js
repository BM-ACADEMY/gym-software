'use strict';
// Staff attendance, leave and payslips for a shop (area 3). Whole rupees, currency INR. Pure: no database, no clock.
// A month's pay = monthly salary x payable days / days in the month, minus advances. A day nobody marked is NOT paid and is
// listed, so the owner marks it (a draft slip says so). We do not file anything and do not pay anyone: the owner pays.
const STATUS = ['present', 'half', 'absent', 'paid_leave', 'unpaid_leave', 'weekly_off'];
const WEIGHT = { present: 1, half: 0.5, paid_leave: 1, weekly_off: 1, absent: 0, unpaid_leave: 0 };
const int = (n) => Math.round(Number(n) || 0);
const validMonth = (m) => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const daysIn = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).getUTCDate(); };
const dayOf = (m, d) => `${m}-${String(d).padStart(2, '0')}`;

// marks: [{ day:'YYYY-MM-DD', status }] for ONE staff member. advances: [{ day, amount }]. joinedOn optional 'YYYY-MM-DD'.
function payslip({ name, monthlySalary, month, marks, advances = [], joinedOn }) {
  if (!validMonth(month)) throw Object.assign(new Error('Month must look like 2026-11.'), { code: 'PAYROLL_INVALID' });
  const salary = int(monthlySalary); if (salary < 0) throw Object.assign(new Error('Salary cannot be negative.'), { code: 'PAYROLL_INVALID' });
  const n = daysIn(month); const by = {}; for (const m of marks || []) if (m && STATUS.includes(m.status)) by[m.day] = m.status;
  let payable = 0; const unmarked = []; const count = { present: 0, half: 0, absent: 0, paid_leave: 0, unpaid_leave: 0, weekly_off: 0 };
  for (let d = 1; d <= n; d++) {
    const day = dayOf(month, d); if (joinedOn && day < joinedOn) continue; // not yet joined: not counted at all
    const s = by[day]; if (!s) { unmarked.push(day); continue; }
    payable += WEIGHT[s]; count[s] += 1;
  }
  const gross = int((salary * payable) / n);
  const adv = (advances || []).filter((a) => a && String(a.day).startsWith(month)).reduce((a, x) => a + int(x.amount), 0);
  const net = Math.max(0, gross - adv); const carry = Math.max(0, adv - gross);
  return { name, month, monthlySalary: salary, daysInMonth: n, payableDays: payable, counts: count, unmarkedDays: unmarked, draft: unmarked.length > 0, gross, advances: adv, net, advanceCarryForward: carry, currency: 'INR',
    note: unmarked.length ? `${unmarked.length} day(s) are not marked, so they are not paid yet. Mark them and check again.` : 'All days are marked.' };
}
// Plain-text slip the owner can show or print. No bank details, no ids.
const slipText = (p) => [`Payslip ${p.month}`, `Name: ${p.name}`, `Monthly salary: Rs ${p.monthlySalary}`, `Payable days: ${p.payableDays} of ${p.daysInMonth}`, `Pay for the days: Rs ${p.gross}`, `Advances taken: Rs ${p.advances}`, `To pay: Rs ${p.net}`, ...(p.advanceCarryForward ? [`Advance still to recover next month: Rs ${p.advanceCarryForward}`] : []), ...(p.draft ? ['DRAFT: some days are not marked.'] : [])].join('\n');
module.exports = { STATUS, WEIGHT, validMonth, daysIn, payslip, slipText };
