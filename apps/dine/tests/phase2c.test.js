const C = require('../src/credit'); const { build, TID, OID } = require('./p2fake');
const billed = { _id: OID, number: 'D-1', status: 'billed', lines: [{ id: 'l1', itemKey: 'tea', name: 'Tea', qty: 2, unitPrice: 100, status: 'served' }], events: [{ what: 'open' }], grandTotal: 210, createdAt: '2026-11-12T08:00:00Z' };
const PARAMS = { id: OID };
describe('pay-later and returns (Dine Phase 2)', () => {
  test('new credit: needs phone, name, whole rupees and stays under the limit', () => {
    expect(() => C.checkNewCredit({ amount: 100, phone: '123', name: 'Ravi', existing: [] })).toThrow();
    expect(() => C.checkNewCredit({ amount: 100, phone: '9876543210', name: 'R', existing: [] })).toThrow();
    expect(() => C.checkNewCredit({ amount: 1.5, phone: '9876543210', name: 'Ravi', existing: [] })).toThrow();
    expect(() => C.checkNewCredit({ amount: 4000, phone: '9876543210', name: 'Ravi', existing: [{ amount: 1500, paid: 0 }] })).toThrow();
    expect(C.checkNewCredit({ amount: 3500, phone: '9876543210', name: 'Ravi', existing: [{ amount: 1500, paid: 0 }] })).toBe(undefined);
  });
  test('payment clears the oldest credit first; over-payment refused; dues list oldest first with age', () => {
    const cr = [{ id: 'b', amount: 300, paid: 0, date: '2026-11-10', phone: '9876543210', name: 'R' }, { id: 'a', amount: 200, paid: 50, date: '2026-11-01', phone: '9876543210', name: 'R' }, { id: 'c', amount: 99, paid: 0, date: '2026-11-11', phone: '9000000001', name: 'S' }];
    expect(C.allocate(cr.slice(0, 2), 200)).toEqual([{ id: 'a', apply: 150 }, { id: 'b', apply: 50 }]);
    expect(() => C.allocate(cr.slice(0, 2), 451)).toThrow();
    const d = C.dues(cr, '2026-11-12'); expect(d[0].phone).toBe('9876543210'); expect(d[0].owing).toBe(450); expect(d[0].days).toBe(11); expect(d[1].owing).toBe(99);
  });
  test('pay route: credit needs the credit permission, a customer and the limit; good credit saves a ledger row and an audit line', async () => {
    const over = { 'Order.findOne': billed, 'Order.findOneAndUpdate': { ...billed, status: 'paid' } };
    const noPhone = build({ over }); expect((await noPhone.run('post', '/orders/:id/pay', { params: PARAMS, body: { payments: [{ method: 'credit', amount: 210 }] } })).status).toBe(400);
    const captain = { id: 'u', tenantId: TID, role: 'subadmin', staffRole: 'captain' };
    expect((await build({ over }).run('post', '/orders/:id/pay', { params: PARAMS, user: captain, body: { payments: [{ method: 'credit', amount: 210 }], customerPhone: '9876543210', customerName: 'Ravi' } })).status).toBe(403);
    const lim = build({ over: { ...over, 'Credit.find': [{ _id: 'x', amount: 4900, paid: 0, phone: '9876543210', date: '2026-11-01' }] } });
    expect((await lim.run('post', '/orders/:id/pay', { params: PARAMS, body: { payments: [{ method: 'credit', amount: 210 }], customerPhone: '9876543210', customerName: 'Ravi' } })).status).toBe(400);
    const ok = build({ over }); const o = await ok.run('post', '/orders/:id/pay', { params: PARAMS, body: { payments: [{ method: 'credit', amount: 210 }], customerPhone: '9876543210', customerName: 'Ravi' } });
    expect(o.status).toBe(200); expect(o.b.credit).toBe(210);
    const made = ok.calls.find((c) => c.model === 'Credit' && c.meth === 'create'); expect(made.args[0].amount).toBe(210); expect(String(made.args[0].tenantId)).toBe(TID);
    expect(ok.calls.some((c) => c.model === 'Activity' && c.args[0].action === 'order.credit')).toBe(true);
  });
  test('credit payment: FIFO, cash goes in the cash book, money above what is owed is refused', async () => {
    const rows = [{ _id: 'a1', amount: 200, paid: 0, date: '2026-11-01', phone: '9876543210', name: 'R' }, { _id: 'b1', amount: 300, paid: 0, date: '2026-11-05', phone: '9876543210', name: 'R' }];
    const t = build({ over: { 'Credit.find': rows } });
    expect((await t.run('post', '/credit/payments', { body: { phone: '9876543210', amount: 999, method: 'cash' } })).status).toBe(400);
    const r = await t.run('post', '/credit/payments', { body: { phone: '9876543210', amount: 250, method: 'cash' } });
    expect(r.status).toBe(200); expect(r.b.data.applied).toBe(2);
    const ups = t.calls.filter((c) => c.model === 'Credit' && c.meth === 'updateOne'); expect(ups.length).toBe(2); expect(ups[0].args[1].$set.settled).toBe(true); expect(ups[1].args[1].$set).toBe(undefined);
    const cash = t.calls.find((c) => c.model === 'CashEntry'); expect(cash.args[0].amount).toBe(250); expect(cash.args[0].note.indexOf('9876543210')).toBe(-1);
    expect((await t.run('post', '/credit/payments', { body: { phone: '9876543210', amount: 10, method: 'bitcoin' } })).status).toBe(400);
  });
  test('returns: manager or owner only, reason needed, partial returns add up, credit reduced, cash refund booked, stale order refused', async () => {
    const paid = { _id: OID, number: 'D-9', status: 'paid', returnedAmount: 0, returnedQty: [], credit: 0, customerPhone: '9876543210', pointsEarned: 10, payments: [{ method: 'cash', amount: 300 }], totals: { total: 210, lines: [{ name: 'Tea', qty: 2, total: 210, itemKey: 'tea' }] }, events: [] };
    const t = build({ over: { 'Order.findOne': paid, 'Order.findOneAndUpdate': { ...paid, returnedAmount: 105 } } });
    const cashier = { id: 'u', tenantId: TID, role: 'subadmin', staffRole: 'cashier' };
    expect((await t.run('post', '/orders/:id/returns', { params: PARAMS, user: cashier, body: { reason: 'cold', items: [{ lineIndex: 0, qty: 1 }] } })).status).toBe(403);
    expect((await t.run('post', '/orders/:id/returns', { params: PARAMS, body: { reason: 'x', items: [{ lineIndex: 0, qty: 1 }] } })).status).toBe(400);
    expect((await t.run('post', '/orders/:id/returns', { params: PARAMS, body: { reason: 'tea was cold', items: [{ lineIndex: 0, qty: 3 }] } })).status).toBe(400);
    const r = await t.run('post', '/orders/:id/returns', { params: PARAMS, body: { reason: 'tea was cold', items: [{ lineIndex: 0, qty: 1 }] } });
    expect(r.status).toBe(200); expect(r.b.data.refund).toBe(105); expect(r.b.data.cashBack).toBe(105);
    expect(t.calls.some((c) => c.model === 'CashEntry' && c.args[0].type === 'out' && c.args[0].amount === 105)).toBe(true);
    expect(t.calls.some((c) => c.model === 'Loyalty' && c.args[0].reason === 'return' && c.args[0].points === -5)).toBe(true);
    expect(t.calls.some((c) => c.model === 'Activity' && c.args[0].action === 'order.return')).toBe(true);
    const stale = build({ over: { 'Order.findOne': paid, 'Order.findOneAndUpdate': null } });
    expect((await stale.run('post', '/orders/:id/returns', { params: PARAMS, body: { reason: 'tea was cold', items: [{ lineIndex: 0, qty: 1 }] } })).status).toBe(409);
    const open = build({ over: { 'Order.findOne': { ...paid, status: 'billed' } } });
    expect((await open.run('post', '/orders/:id/returns', { params: PARAMS, body: { reason: 'tea was cold', items: [{ lineIndex: 0, qty: 1 }] } })).status).toBe(400);
  });
});
