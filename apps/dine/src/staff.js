'use strict';
// Staff basics (area 2 and 3). Roles decide what each person may do; hours come from punches. Payslips use the core payroll later (Phase 2).
const ROLES = {
  owner: ['*'],
  manager: ['menu', 'orders', 'bill', 'void', 'discount', 'reports', 'stock', 'staff', 'cash', 'customers'],
  cashier: ['orders', 'bill', 'discount', 'cash', 'customers'],
  captain: ['orders', 'customers'],
  kitchen: ['kot_view'],
  bartender: ['orders', 'kot_view'],
};
// D-30: the owner is never limited on discounts; everyone else is a 'staff' for the discount rule.
const discountRole = (staffRole) => (staffRole === 'owner' ? 'admin' : 'staff');
const can = (role, action) => { const r = ROLES[role]; return !!r && (r.includes('*') || r.includes(action)); };
// punches: [{ at: ISO, kind:'in'|'out' }] for one person. Returns minutes worked; an 'in' with no 'out' is reported, not guessed.
function hoursWorked(punches) {
  const p = [...punches].sort((a, b) => a.at.localeCompare(b.at)); let open = null; let mins = 0; const problems = [];
  for (const x of p) {
    if (x.kind === 'in') { if (open) problems.push('Two clock-ins in a row at ' + x.at); open = x.at; }
    else if (x.kind === 'out') { if (!open) { problems.push('Clock-out without clock-in at ' + x.at); continue; } mins += Math.round((Date.parse(x.at) - Date.parse(open)) / 60000); open = null; }
  }
  if (open) problems.push('No clock-out after ' + open);
  return { minutes: mins, hours: Math.round((mins / 60) * 10) / 10, problems };
}
module.exports = { ROLES, can, discountRole, hoursWorked };
