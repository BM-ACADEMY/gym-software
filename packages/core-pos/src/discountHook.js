'use strict';
// D-30 for any product that mounts the shared bill route: staff discounts follow the owner's rule, a reason is required,
// and the bill keeps who gave the discount and the percent. Use: createPosRouter({ ..., ...makeDiscountHook({ getRule }) }).
// getRule(tid) returns the owner's saved rule (or undefined for the default). onDiscount (optional) runs after the bill is saved,
// for a product's own audit line. The owner (role 'admin') is never limited; every other role counts as staff.
const DP = require('./discountPolicy');
const coded = (code, message) => Object.assign(new Error(message), { code });

function makeDiscountHook({ getRule, onDiscount }) {
  return {
    beforeBill: async ({ req, tid, body, calc }) => {
      if (!calc || !calc.discount) return { fields: {} };
      const reason = typeof (body && body.discountReason) === 'string' ? body.discountReason.trim().slice(0, 120) : '';
      if (reason.length < 3) throw coded('BILL_INVALID', 'A discount needs a reason.');
      const role = req.user && req.user.role === 'admin' ? 'admin' : 'staff';
      const rule = typeof getRule === 'function' ? await getRule(tid) : undefined;
      const dc = DP.check({ role, discount: calc.discount, subtotal: calc.subtotal, rule });
      if (!dc.ok) throw coded('BILL_FORBIDDEN', dc.message);
      return { fields: { discountBy: role === 'admin' ? 'owner' : 'staff', discountPercent: dc.percent, discountReason: reason } };
    },
    afterBill: async (ctx) => { if (onDiscount && ctx.doc && ctx.doc.discountBy) await onDiscount(ctx); },
  };
}
module.exports = { makeDiscountHook };
