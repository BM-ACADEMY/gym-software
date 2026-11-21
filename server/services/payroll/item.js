'use strict';
// One staff member's payslip snapshot for a run. Pure (no database).
const { computePayslip } = require('./engine');

const bad = (message) => Object.assign(new Error(message), { status: 400 });

const MAX_ADJ = 10;
// Bonus, overtime, PT commission (add) or fines (deduct).
const cleanAdj = (list = []) => {
  if (!Array.isArray(list)) throw bad('Adjustments must be a list.');
  if (list.length > MAX_ADJ) throw bad(`At most ${MAX_ADJ} adjustments per payslip.`);
  return list.map((a) => ({
    label: String((a && a.label) || '').trim().slice(0, 60) || 'Adjustment',
    kind: a && a.kind === 'deduct' ? 'deduct' : 'add',
    amount: Math.floor(Number(a && a.amount)),
  })).map((a) => {
    if (!(a.amount > 0)) throw bad('Each adjustment needs an amount above zero.');
    return a;
  });
};

const itemFor = (staff, lopDays, advanceDue, adjustments = []) => {
  const adj = cleanAdj(adjustments);
  const p = computePayslip({ gross: staff.baseSalary, lopDays, advanceDue, config: {} });
  const add = adj.filter((a) => a.kind === 'add').reduce((t, a) => t + a.amount, 0);
  const ded = adj.filter((a) => a.kind === 'deduct').reduce((t, a) => t + a.amount, 0);
  if (p.net + add - ded < 0) throw bad('Deductions are more than the pay for this person.');
  Object.assign(p, { adjustments: adj, adjAdd: add, adjDeduct: ded, totalDeductions: p.totalDeductions + ded, net: p.net + add - ded, employerCost: p.employerCost + add });
  return { staffId: staff._id, name: staff.name, roleTitle: staff.roleTitle || staff.template || '', lopDays, advanceDue, adjustments: adj, payslip: p };
};

const totals = (items) => items.reduce(
  (t, i) => ({ gross: t.gross + i.payslip.earnedGross + (i.payslip.adjAdd || 0), net: t.net + i.payslip.net }),
  { gross: 0, net: 0 }
);

module.exports = { itemFor, cleanAdj, totals, MAX_ADJ, bad };
