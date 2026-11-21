// PAY-2 refund recording without a database: the model calls are replaced by an in-memory row.
const { recordRefund: rec } = require('../services/refundRecord');
const SP = {};
const recordRefund = (r) => rec(SP, r);

let row;
const setup = () => {
  row = { _id: 'p1', razorpayPaymentId: 'pay_1', total: 1179, status: 'paid', refundedAmount: 0, refundIds: [] };
  SP.findOne = async (q) => (q.razorpayPaymentId === row.razorpayPaymentId ? row : null);
  SP.updateOne = async (f, u) => { if (f.refundIds && f.refundIds.$ne && row.refundIds.includes(f.refundIds.$ne)) return { modifiedCount: 0 }; Object.assign(row, u.$set); row.refundIds = [...row.refundIds, ...(u.$push ? [u.$push.refundIds] : [])]; return { modifiedCount: 1 }; };
};
describe('refund recording (PAY-2)', () => {
  test('partial refund keeps the payment paid and flags it for review', async () => {
    setup();
    const r = await recordRefund({ id: 'r1', payment_id: 'pay_1', amount: 50000 });
    expect(r.handled).toBe(true); expect(row.status).toBe('paid'); expect(row.refundedAmount).toBe(500); expect(row.refundNeedsReview).toBe(true);
  });
  test('the same refund twice is counted once; the rest makes it refunded', async () => {
    setup();
    await recordRefund({ id: 'r1', payment_id: 'pay_1', amount: 50000 });
    const dup = await recordRefund({ id: 'r1', payment_id: 'pay_1', amount: 50000 }); expect(dup.duplicate).toBe(true); expect(row.refundedAmount).toBe(500);
    await recordRefund({ id: 'r2', payment_id: 'pay_1', amount: 67900 });
    expect(row.status).toBe('refunded'); expect(row.refundedAmount).toBe(1179);
  });
  test('refund above the total is capped; unknown payment or broken data is ignored', async () => {
    setup();
    await recordRefund({ id: 'r1', payment_id: 'pay_1', amount: 999999 }); expect(row.refundedAmount).toBe(1179); expect(row.status).toBe('refunded');
    expect((await recordRefund({ id: 'r9', payment_id: 'pay_none', amount: 100 })).ignored).toBe(true);
    expect((await recordRefund({ payment_id: 'pay_1' })).ignored).toBe(true);
    expect((await recordRefund(undefined)).ignored).toBe(true);
  });
});
