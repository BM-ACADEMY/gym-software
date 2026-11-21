const { call } = require('./fake'); const { setupMore, ownerOf, staffOf } = require('./helpers'); const PN = require('../src/panel');
describe('Phase 2 (1): accounts screens, staff discounts list, activity log', () => {
  test('month range: valid month gives first and last day, bad input gives null', () => {
    expect(PN.monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(PN.monthRange('2028-02').to).toBe('2028-02-29'); expect(PN.monthRange('2026-13')).toBe(null); expect(PN.monthRange('x')).toBe(null);
  });
  test('accounts month: numbers add up, voided bills never count, lists are arrays, other business sees nothing', async () => {
    const s = await setupMore(); const M = s.M; const d = '2026-11-05';
    await M.Bill.create({ tenantId: s.A.id, number: 'B1', date: d, taxable: 1000, discount: 100, gst: 0, commissions: { x: 300 }, lines: [{ rate: 0, taxable: 1000, gst: 0 }], status: 'paid' });
    await M.Bill.create({ tenantId: s.A.id, number: 'B2', date: d, taxable: 500, discount: 0, gst: 0, commissions: { x: 150 }, lines: [], status: 'void' });
    await M.Expense.create({ tenantId: s.A.id, date: d, category: 'rent', amount: 200, paid: true });
    await M.Expense.create({ tenantId: s.A.id, date: '2026-12-01', category: 'rent', amount: 999, paid: true });
    const r = await call(s.more, 'GET', '/accounts/month', { ...ownerOf(s.A.id), query: { month: '2026-11' } });
    expect(r.code).toBe(200); expect(r.body.data.income).toBe(1000); expect(r.body.data.commission).toBe(300); expect(r.body.data.expenseTotal).toBe(200); expect(r.body.data.profit).toBe(500);
    expect(Array.isArray(r.body.data.categories)).toBe(true); expect(r.body.data.categories[0].category).toBe('rent'); expect(r.body.data.textRows.length).toBe(1);
    expect((await call(s.more, 'GET', '/accounts/month', { ...ownerOf(s.Bt.id), query: { month: '2026-11' } })).body.data.income).toBe(0);
    expect((await call(s.more, 'GET', '/accounts/month', { ...ownerOf(s.A.id), query: { month: 'nope' } })).code).toBe(400);
  });
  test('staff discounts list shows only staff discounts of this business; staff login cannot read it or the activity log', async () => {
    const s = await setupMore(); const M = s.M; const t = require('../src/booking').istParts().date;
    await M.Bill.create({ tenantId: s.A.id, number: 'B1', date: t, discount: 40, discountBy: 'staff', discountPercent: 8, discountReason: 'regular', status: 'paid' });
    await M.Bill.create({ tenantId: s.A.id, number: 'B2', date: t, discount: 90, discountBy: 'owner', discountPercent: 18, discountReason: 'friend', status: 'paid' });
    await M.Bill.create({ tenantId: s.Bt.id, number: 'B1', date: t, discount: 10, discountBy: 'staff', discountPercent: 2, discountReason: 'x', status: 'paid' });
    const r = await call(s.more, 'GET', '/discounts/staff', ownerOf(s.A.id)); expect(r.body.data.length).toBe(1); expect(r.body.data[0].discount).toBe(40);
    expect((await call(s.more, 'GET', '/discounts/staff', staffOf(s.A.id, s.A.staffId))).code).toBe(403);
    expect((await call(s.more, 'GET', '/audit', staffOf(s.A.id, s.A.staffId))).code).toBe(403);
    await M.Audit.create({ tenantId: s.A.id, by: 'u', action: 'expense.add', ref: '1' }); await M.Audit.create({ tenantId: s.Bt.id, by: 'u', action: 'secret', ref: '2' });
    const a = await call(s.more, 'GET', '/audit', ownerOf(s.A.id)); expect(a.body.data.length).toBe(1); expect(a.body.data[0].action).toBe('expense.add');
  });
  test('expenses list with no dates gives the last 60 days (panel list screen)', async () => {
    const s = await setupMore(); const t = require('../src/booking').istParts().date;
    await s.M.Expense.create({ tenantId: s.A.id, date: t, category: 'other', amount: 50, paid: true });
    expect((await call(s.router, 'GET', '/expenses', ownerOf(s.A.id))).body.data.length).toBe(1);
  });
});
