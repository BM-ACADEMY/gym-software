'use strict';
// Earning and deduction lines for a payslip (kept in one place so PDF and screen agree).
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (m) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

function slipRows(item) {
  const p = item.payslip;
  const adj = p.adjustments || [];
  const earn = [['Basic salary', p.gross], ...adj.filter((a) => a.kind === 'add').map((a) => [a.label, a.amount])];
  const ded = [];
  if (p.lop) ded.push([`Loss of pay (${item.lopDays} days)`, p.lop]);
  if (p.advanceApplied) ded.push(['Advance recovered', p.advanceApplied]);
  for (const a of adj) if (a.kind === 'deduct') ded.push([a.label, a.amount]);
  return { earn, ded };
}

module.exports = { slipRows, monthName };
