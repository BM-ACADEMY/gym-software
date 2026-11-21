const DP = require('../src/discountPolicy'); const { buildBill } = require('../src/billing'); const L = require('../src/leaks');
const services = { haircut: { key: 'haircut', name: 'Haircut', price: 500, gstRate: 0 } };
const mk = (role, tenant, discount) => () => buildBill({ input: { lines: [{ serviceKey: 'haircut', staffId: 's1' }], billDiscount: discount, discountReason: 'regular customer', payments: [{ method: 'cash', amount: 500 }] }, services, tenant, rules: {}, role });
describe('staff discount rule (D-30)', () => {
  test('default: staff up to 10 percent, owner never limited', () => {
    expect(DP.normalize(undefined)).toEqual({ staff: 'limit', maxPercent: 10 });
    expect(DP.check({ role: 'staff', discount: 50, subtotal: 500, rule: undefined }).ok).toBe(true);
    expect(DP.check({ role: 'staff', discount: 51, subtotal: 500, rule: undefined }).ok).toBe(false);
    expect(DP.check({ role: 'admin', discount: 400, subtotal: 500, rule: { staff: 'owner_only' } }).ok).toBe(true);
  });
  test('owner_only refuses any staff discount; any allows all; a bad rule falls back to the default', () => {
    expect(DP.check({ role: 'staff', discount: 1, subtotal: 500, rule: { staff: 'owner_only' } }).ok).toBe(false);
    expect(DP.check({ role: 'staff', discount: 450, subtotal: 500, rule: { staff: 'any' } }).ok).toBe(true);
    expect(DP.normalize({ staff: 'weird', maxPercent: 500 })).toEqual({ staff: 'limit', maxPercent: 10 });
    expect(DP.check({ role: 'staff', discount: 0, subtotal: 500, rule: { staff: 'owner_only' } }).ok).toBe(true);
  });
  test('bill: staff over the limit is refused, within it is saved with who gave it and the percent', () => {
    expect(mk('staff', {}, { type: 'amount', value: 100 })).toThrow();
    const r = mk('staff', { discountRule: { staff: 'limit', maxPercent: 25 } }, { type: 'amount', value: 100 })();
    expect(r.discountBy).toBe('staff'); expect(r.discountPercent).toBe(20);
    const o = mk('admin', {}, { type: 'amount', value: 300 })(); expect(o.discountBy).toBe('owner');
    expect(mk('staff', {}, undefined)().discountBy).toBe(undefined);
  });
  test('owner sees staff discounts, grouped per day; owner discounts are not in that list', () => {
    const bills = [{ date: '2026-11-12', discount: 40, discountBy: 'staff', subtotal: 500 }, { date: '2026-11-12', discount: 30, discountBy: 'staff', subtotal: 500 }, { date: '2026-11-12', discount: 90, discountBy: 'owner', subtotal: 500 }];
    expect(L.staffDiscounts(bills)).toEqual([{ date: '2026-11-12', count: 2, total: 70, currency: 'INR' }]);
    expect(L.leakList({ bills, closes: [] })[0].text).toMatch(/staff gave 2 discounts worth Rs 70/);
  });
});
