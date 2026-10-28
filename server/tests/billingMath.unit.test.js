const M = require('../services/billingMath');
const { computeStatus } = require('../services/subscription');

const now = new Date('2026-12-01T00:00:00Z');
const ahead = (d) => new Date(now.getTime() + d * M.DAY);

describe('quote and GST', () => {
  test('growth monthly: 999 + 18% = 1179, split 90/90', () => {
    expect(M.quote({ plan: 'growth', cycle: 'monthly' })).toEqual({
      base: 999, credit: 0, taxable: 999, gst: 180, cgst: 90, sgst: 90, igst: 0, total: 1179, gstMode: 'cgst_sgst', gstRate: 18, currency: 'INR',
    });
  });
  test('igst puts all GST on one line, same total', () => {
    const q = M.quote({ plan: 'growth', cycle: 'monthly', gstMode: 'igst' });
    expect(q.igst).toBe(180);
    expect(q.cgst + q.sgst).toBe(0);
    expect(q.total).toBe(1179);
  });
  test('odd GST splits without losing a rupee', () => {
    const q = M.quote({ plan: 'starter', cycle: 'yearly' });
    expect(q.cgst + q.sgst).toBe(q.gst);
    expect(q.total).toBe(q.taxable + q.gst);
  });
  test('credit is capped at 90% of the price', () => {
    expect(M.quote({ plan: 'starter', cycle: 'monthly', creditRupees: 5000 }).credit).toBe(539);
  });
  test('unknown plan throws', () => {
    let threw = false;
    try { M.quote({ plan: 'gold', cycle: 'monthly' }); } catch (e) { threw = true; }
    expect(threw).toBe(true);
  });
});

describe('periods and invoice numbers', () => {
  test('31 Jan + 1 month clamps to 28 Feb', () => {
    expect(M.addPeriod(new Date('2027-01-31T00:00:00Z'), 'monthly').toISOString().slice(0, 10)).toBe('2027-02-28');
  });
  test('yearly adds a calendar year', () => {
    expect(M.addPeriod(new Date('2026-12-01T00:00:00Z'), 'yearly').toISOString().slice(0, 10)).toBe('2027-12-01');
  });
  test('financial year switches on 1 April IST', () => {
    expect(M.fyOf(new Date('2027-03-31T10:00:00Z'))).toBe('2026-27');
    expect(M.fyOf(new Date('2027-03-31T19:00:00Z'))).toBe('2027-28'); // 00:30 IST on 1 April
    expect(M.fyOf(new Date('2026-12-01T00:00:00Z'))).toBe('2026-27');
  });
  test('invoice number format', () => {
    expect(M.invoiceNumber('AV', '2026-27', 7)).toBe('AV/2026-27/0007');
  });
});

describe('purchase rules', () => {
  const live = { status: 'active' };
  test('trial gym starts now with no credit', () => {
    expect(M.purchaseRule({ status: { status: 'trial' }, newPlan: 'growth', now })).toEqual({ startMode: 'now', creditRupees: 0 });
  });
  test('renewing the same plan extends from the end date', () => {
    expect(M.purchaseRule({ status: live, currentPlan: 'growth', currentCycle: 'monthly', paidUntil: ahead(10), newPlan: 'growth', now }).startMode).toBe('extend');
  });
  test('upgrade starts now with credit for unused days', () => {
    const r = M.purchaseRule({ status: live, currentPlan: 'starter', currentCycle: 'monthly', paidUntil: ahead(15), newPlan: 'pro', now });
    expect(r.startMode).toBe('now');
    expect(r.creditRupees).toBe(Math.floor((599 * 15) / 30));
  });
  test('downgrade while paid is blocked until the period ends', () => {
    expect(M.purchaseRule({ status: live, currentPlan: 'pro', currentCycle: 'monthly', paidUntil: ahead(15), newPlan: 'starter', now }).code).toBe('downgrade_later');
  });
  test('suspended gym cannot buy', () => {
    expect(M.purchaseRule({ status: { status: 'suspended' }, newPlan: 'growth', now }).code).toBe('suspended');
  });
  test('expired gym can buy any plan, starting now', () => {
    expect(M.purchaseRule({ status: { status: 'expired' }, currentPlan: 'pro', paidUntil: ahead(-10), newPlan: 'starter', now }).startMode).toBe('now');
  });
});
