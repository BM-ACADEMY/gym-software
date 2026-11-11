'use strict';
// Builds one salon bill: server-side prices, GST or plain, split payments, commission per staff. Whole rupees, currency INR.
// Maths comes from packages/core-pos (bill.compute and bill.settle); commission from commission.js. No database here.
const { bill } = require('../../../packages/core-pos/src');
const { commissionFor } = require('./commission');
const err = (message) => Object.assign(new Error(message), { code: 'SALON_BILL' });

// input: { lines:[{serviceKey?|name,unitPrice?,qty?,staffId,discount?}], billDiscount?, discountReason?, payments, taxMode?, gstMode? }
// services: this business's active services by key (the only source of service prices). rules: tenant.commissionRules.
function buildBill({ input, services, tenant, rules }) {
  const raw = Array.isArray(input.lines) ? input.lines.slice(0, 50) : [];
  if (!raw.length) throw err('Add at least one service or item to the bill.');
  const lines = raw.map((l) => {
    if (l.serviceKey) {
      const s = services[l.serviceKey]; if (!s) throw err('A service on the bill was not found.');
      if (!l.staffId) throw err(`Choose who did "${s.name}" so commission is counted.`);
      return { name: s.name, kind: 'service', serviceKey: s.key, unitPrice: s.price, qty: Number(l.qty) || 1, gstRate: s.gstRate || 0, discount: l.discount, staffId: String(l.staffId) };
    }
    return { name: String(l.name || '').slice(0, 80) || 'Item', kind: 'item', unitPrice: l.unitPrice, qty: Number(l.qty) || 1, gstRate: l.gstRate || 0, discount: l.discount, staffId: l.staffId ? String(l.staffId) : null };
  });
  const taxMode = input.taxMode || tenant.taxMode || 'none';
  const gstMode = input.gstMode || 'cgst_sgst';
  const hasDiscount = !!input.billDiscount || lines.some((l) => l.discount);
  const reason = String(input.discountReason || '').trim().slice(0, 120);
  if (hasDiscount && reason.length < 3) throw err('A discount needs a reason (leak check).');
  const calc = bill.compute({ lines, billDiscount: input.billDiscount, taxMode, gstMode });
  const pay = bill.settle(calc.total, Array.isArray(input.payments) ? input.payments : []);
  // Commission is on the amount before GST (taxable), per line, by the most specific rule.
  const commissions = {}; const outLines = calc.lines.map((cl, i) => {
    const src = lines[i]; const c = src.staffId ? commissionFor({ staffId: src.staffId, serviceKey: src.serviceKey || '_item', amount: cl.taxable }, rules) : 0;
    if (src.staffId && c) commissions[src.staffId] = (commissions[src.staffId] || 0) + c;
    return { ...cl, serviceKey: src.serviceKey || null, commission: c };
  });
  // Keep the payments as typed (whole rupees) so the cash book can add up cash taken and the day close can be checked later.
  const payments = (Array.isArray(input.payments) ? input.payments : []).map((p) => ({ method: p.method, amount: Math.round(Number(p.amount) || 0) }));
  return { ...calc, lines: outLines, payments, ...pay, commissions, discountReason: hasDiscount ? reason : '', currency: 'INR' };
}
module.exports = { buildBill };
