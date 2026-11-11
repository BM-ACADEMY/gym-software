'use strict';
// Attendant attendance for a month: present, absent, leave. Pure. Payslip maths stays in core payroll (Phase 2 hook).
const STATUS = ['present', 'absent', 'leave'];
function monthSummary(rows, month) {
  const out = {};
  for (const r of rows || []) {
    if (!r || !STATUS.includes(r.status) || !String(r.day).startsWith(month)) continue;
    const e = out[r.attendantId] || (out[r.attendantId] = { present: 0, absent: 0, leave: 0 }); e[r.status] += 1;
  }
  return out;
}
module.exports = { STATUS, monthSummary };
