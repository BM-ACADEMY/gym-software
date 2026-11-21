const { call } = require('./fake'); const { setupMore, ownerOf, staffOf, B } = require('./helpers'); const RT = require('../src/returns'); const A = require('../src/accounts'); const L = require('../src/leaks');
describe('Phase 2 (5): voids and refunds', () => {
  test('pure: void and refund rules need a reason; refund cannot exceed what was paid; split follows the bill', () => {
    const bill = { number: 'B1', total: 590, taxable: 500, due: 90, refunded: 0, status: 'partial' };
    expect(RT.paidOf(bill)).toBe(500); expect(RT.checkVoid({ bill, reason: 'x' }).error).toMatch(/reason/); expect(RT.checkVoid({ bill, reason: 'wrong bill' }).value.reason).toBe('wrong bill');
    expect(RT.checkVoid({ bill: { ...bill, refunded: 10 }, reason: 'wrong bill' }).error).toMatch(/refund/); expect(RT.checkVoid({ bill: { ...bill, status: 'void' }, reason: 'wrong bill' }).error).toMatch(/already/);
    expect(RT.checkRefund({ bill, amount: 600, method: 'cash', reason: 'unhappy' }).error).toMatch(/At most Rs 500/); expect(RT.checkRefund({ bill, amount: 100, method: 'gold', reason: 'unhappy' }).error).toMatch(/cash, UPI/);
    const ok = RT.checkRefund({ bill: { ...bill, due: 0 }, amount: 118, method: 'cash', reason: 'unhappy' }).value; expect(ok.taxable).toBe(100); expect(ok.gst).toBe(18);
  });
  test('pure: a void never counts as a sale; refunds reduce income, GST and cash expected; CA file shows the refund', () => {
    const bills = [{ number: 'B1', date: 'd', taxable: 1000, gst: 180, total: 1180, discount: 0, status: 'paid', payments: [{ method: 'cash', amount: 1180 }], change: 0, lines: [{ rate: 18, taxable: 1000, gst: 180 }] }, { number: 'B2', date: 'd', taxable: 500, gst: 0, total: 500, status: 'void', payments: [{ method: 'cash', amount: 500 }], lines: [] }];
    const refunds = [{ amount: 118, taxable: 100, gst: 18, method: 'cash', date: 'd', number: 'R1' }];
    expect(A.profitAndLoss({ bills, expenses: [], commissionTotal: 0, refunds }).income).toBe(900); expect(A.dayClose({ openingCash: 0, bills, expenses: [], countedCash: 0, refunds }).expected).toBe(1062);
    expect(A.gstSummary(bills, refunds).netGst).toBe(162); expect(A.caCsv({ bills, expenses: [], refunds })).toMatch(/Refund,d,R1,refund,-100,-18,-118,INR/); expect(A.customerDues([{ ...bills[1], due: 50 }]).length).toBe(0);
    expect(L.leakList({ bills, closes: [], returns: [{ number: 'R1', date: 'd', amount: 118, method: 'cash', reason: 'unhappy' }] }).map((x) => x.kind)).toEqual(['void', 'refund']);
  });
  test('route: owner voids with a reason; staff cannot; other business cannot; void is audited, drops sales, undoes loyalty points; cannot repeat', async () => {
    const s = await setupMore(); const M = s.M; const t = B.istParts().date;
    await call(s.router, 'PUT', '/settings', { ...ownerOf(s.A.id), body: { loyaltyRule: { enabled: true, earnPer100: 10 } } });
    const c = await M.Customer.create({ tenantId: s.A.id, name: 'Ravi', phone: '9840012210' });
    const mk = await call(s.router, 'POST', '/bills', { ...ownerOf(s.A.id), body: { customerId: String(c._id), lines: [{ serviceKey: 'haircut', staffId: s.A.staffId }], payments: [{ method: 'cash', amount: 500 }] } }); const id = mk.body.data.id;
    expect((await M.Customer.findOne({ _id: c._id })).loyaltyBalance).toBe(50);
    const go = (who, body) => call(s.more, 'POST', '/bills/:id/void', { ...who, params: { id }, body });
    expect((await go(staffOf(s.A.id, s.A.staffId), { reason: 'oops' })).code).toBe(403); expect((await go(ownerOf(s.Bt.id), { reason: 'oops' })).code).toBe(404); expect((await go(ownerOf(s.A.id), {})).code).toBe(400);
    expect((await go(ownerOf(s.A.id), { reason: 'wrong customer' })).code).toBe(200); expect((await go(ownerOf(s.A.id), { reason: 'again' })).code).toBe(400);
    expect((await M.Customer.findOne({ _id: c._id })).loyaltyBalance).toBe(0); expect((await M.Audit.find({ tenantId: s.A.id })).some((a) => a.action === 'bill.void')).toBe(true);
    const month = await call(s.more, 'GET', '/accounts/month', { ...ownerOf(s.A.id), query: { month: t.slice(0, 7) } }); expect(month.body.data.income).toBe(0);
    const alerts = await call(s.router, 'GET', '/alerts', ownerOf(s.A.id)); expect(alerts.body.data.items.some((x) => x.kind === 'void')).toBe(true);
  });
  test('route: refund is guarded (two at once cannot give back more than paid), lowers P&L and cash expected, staff refused, other business refused', async () => {
    const s = await setupMore(); const M = s.M; const t = B.istParts().date;
    const mk = await call(s.router, 'POST', '/bills', { ...ownerOf(s.A.id), body: { lines: [{ serviceKey: 'haircut', staffId: s.A.staffId }], payments: [{ method: 'cash', amount: 500 }] } }); const id = mk.body.data.id;
    const go = (who, body) => call(s.more, 'POST', '/bills/:id/return', { ...who, params: { id }, body });
    expect((await go(staffOf(s.A.id, s.A.staffId), { amount: 100, method: 'cash', reason: 'unhappy' })).code).toBe(403); expect((await go(ownerOf(s.Bt.id), { amount: 100, method: 'cash', reason: 'unhappy' })).code).toBe(404);
    expect((await go(ownerOf(s.A.id), { amount: 100, method: 'cash' })).code).toBe(400); expect((await go(ownerOf(s.A.id), { amount: 600, method: 'cash', reason: 'too much' })).code).toBe(400);
    const [x, y] = await Promise.all([go(ownerOf(s.A.id), { amount: 300, method: 'cash', reason: 'unhappy' }), go(ownerOf(s.A.id), { amount: 300, method: 'cash', reason: 'unhappy' })]);
    const cs = [x.code, y.code].sort(); expect(cs[0]).toBe(201); expect(cs[1] === 400 || cs[1] === 409).toBe(true); expect((await M.Bill.findOne({ _id: id })).refunded).toBe(300);
    expect((await call(s.more, 'POST', '/bills/:id/void', { ...ownerOf(s.A.id), params: { id }, body: { reason: 'void after refund' } })).code).toBe(400);
    const pnl = await call(s.router, 'GET', '/accounts/pnl', { ...ownerOf(s.A.id), query: { from: t, to: t } }); expect(pnl.body.data.income).toBe(200); expect(pnl.body.data.refundsTotal).toBe(300);
    const dc = await call(s.router, 'POST', '/day-close', { ...ownerOf(s.A.id), body: { date: t, openingCash: 0, countedCash: 200 } }); expect(dc.body.data.expected).toBe(200); expect(dc.body.data.text).toBe('Cash matches.');
    expect((await call(s.more, 'GET', '/returns', ownerOf(s.Bt.id))).body.data.length).toBe(0); expect((await call(s.more, 'GET', '/returns', ownerOf(s.A.id))).body.data.length).toBe(1);
  });
});
