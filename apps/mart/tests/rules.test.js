const M = require('../src');
const today = '2026-11-12';
const day = (n) => M.addDays(today, n);
describe('reorder', () => {
  const items = [
    { id: 'rice', name: 'Rice 1kg', trackStock: true, qty: 10, cost: 50 },
    { id: 'salt', name: 'Salt', trackStock: true, qty: 100, cost: 15 },
    { id: 'soap', name: 'Soap', trackStock: true, qty: 2, reorderLevel: 5, cost: 30 },
    { id: 'svc', name: 'Service', trackStock: false, qty: 0 },
  ];
  const sales = [{ itemId: 'rice', qty: 28, date: day(-1) }, { itemId: 'rice', qty: 28, date: day(-5) }, { itemId: 'rice', qty: 99, date: day(-20) }, { itemId: 'salt', qty: 14, date: day(-2) }];
  test('rice sells 4 a day, 10 left, needs 36 for 9 days, orders 26, shown first; sales older than the window ignored', () => {
    const r = M.suggestReorder({ items, sales, today });
    expect(r[0].itemId).toBe('rice'); expect(r[0].orderQty).toBe(26); expect(r[0].daysLeft).toBe(2.5); expect(r[0].rupees).toBe(1300);
    expect(r[0].reason).toMatch(/4 a day/);
  });
  test('well-stocked item not listed; below-level item listed with its own reason; untracked ignored', () => {
    const r = M.suggestReorder({ items, sales, today });
    expect(r.map((x) => x.itemId)).toEqual(['rice', 'soap']);
    expect(r[1].orderQty).toBe(8); expect(r[1].reason).toMatch(/reorder level/);
  });
  test('festival uplift raises the order; bad uplift falls back to 1; bad date gives nothing', () => {
    expect(M.suggestReorder({ items, sales, today, uplift: 2 })[0].orderQty).toBe(62);
    expect(M.suggestReorder({ items, sales, today, uplift: -3 })[0].orderQty).toBe(26);
    expect(M.suggestReorder({ items, sales, today: 'x' })).toEqual([]);
  });
});
describe('expiry and dead stock', () => {
  const iso = (n) => new Date(Date.parse(day(n) + 'T06:00:00Z')).toISOString();
  const items = [
    { id: 'a', name: 'Milk', qty: 10, cost: 20, expiresAt: iso(3) }, { id: 'b', name: 'Biscuit', qty: 5, price: 10, expiresAt: iso(20) },
    { id: 'c', name: 'Old curd', qty: 2, cost: 30, expiresAt: iso(-2) }, { id: 'd', name: 'Far', qty: 5, cost: 10, expiresAt: iso(90) }, { id: 'e', name: 'Empty', qty: 0, expiresAt: iso(1) },
  ];
  test('sorted by days left; discount steps; expired gets none; far and empty left out', () => {
    const r = M.expiryList(items, today);
    expect(r.map((x) => x.itemId)).toEqual(['c', 'a', 'b']);
    expect(r[0].expired).toBe(true); expect(r[0].suggestedDiscountPct).toBe(0);
    expect(r[1].suggestedDiscountPct).toBe(30); expect(r[1].rupees).toBe(200);
    expect(r[2].suggestedDiscountPct).toBe(10); expect(r[2].rupees).toBe(50);
  });
  test('dead stock: nothing sold in 45 days, biggest cash first', () => {
    const its = [{ id: 'x', name: 'X', trackStock: true, qty: 10, cost: 100 }, { id: 'y', name: 'Y', trackStock: true, qty: 4, cost: 10 }, { id: 'z', name: 'Z', trackStock: true, qty: 9, cost: 10 }];
    const r = M.deadStock(its, [{ itemId: 'y', qty: 1, date: day(-50) }, { itemId: 'z', qty: 1, date: day(-3) }], today);
    expect(r.map((x) => x.itemId)).toEqual(['x', 'y']); expect(r[0].rupees).toBe(1000);
  });
});
describe('udhaar', () => {
  const e = [
    { customerId: 'c1', type: 'credit', amount: 500, date: day(-40) }, { customerId: 'c1', type: 'credit', amount: 300, date: day(-10) }, { customerId: 'c1', type: 'payment', amount: 600, date: day(-5) },
    { customerId: 'c2', type: 'credit', amount: 1000, date: day(-20) },
    { customerId: 'c3', type: 'credit', amount: 200, date: day(-2) },
    { customerId: 'c4', type: 'credit', amount: 100, date: day(-30) }, { customerId: 'c4', type: 'payment', amount: 150, date: day(-1) },
  ];
  test('balances never go below zero; overpayment shows as advance', () => {
    const b = M.balances(e);
    expect(b.c1.due).toBe(200); expect(b.c2.due).toBe(1000); expect(b.c4.due).toBe(0); expect(b.c4.advance).toBe(50);
  });
  test('payments clear the oldest credit first, so c1 is only 200 and from the newer credit (10 days, not overdue at 15)', () => {
    const o = M.overdue(e, today, 15);
    expect(o.map((x) => x.customerId)).toEqual(['c2']);
    expect(o[0].daysOld).toBe(20);
    expect(M.overdue(e, today, 5).map((x) => x.customerId)).toEqual(['c2', 'c1']);
    expect(M.overdue(e, today, 5)[1].due).toBe(200);
  });
  test('credit limit', () => {
    expect(M.canGiveCredit({ balance: 800, add: 200, limit: 1000 }).ok).toBe(true);
    expect(M.canGiveCredit({ balance: 800, add: 201, limit: 1000 }).ok).toBe(false);
    expect(M.canGiveCredit({ balance: 800, add: 5000 }).ok).toBe(true);
    expect(M.canGiveCredit({ balance: 0, add: 0, limit: 10 }).ok).toBe(false);
  });
  test('bad entries are refused', () => {
    let code = ''; try { M.balances([{ customerId: 'a', type: 'credit', amount: 10.5, date: today }]); } catch (x) { code = x.code; }
    expect(code).toBe('UDHAAR_INVALID');
    code = ''; try { M.overdue([{ customerId: 'a', type: 'gift', amount: 10, date: today }], today); } catch (x) { code = x.code; }
    expect(code).toBe('UDHAAR_INVALID');
  });
});
describe('leak checks', () => {
  test('heavy discounts: share and a rupee floor', () => {
    const b = [{ id: 1, number: 'B1', subtotal: 1000, discount: 300, by: 's1' }, { id: 2, number: 'B2', subtotal: 1000, discount: 100 }, { id: 3, number: 'B3', subtotal: 100, discount: 50 }, { id: 4, number: 'B4', subtotal: 2000, discount: 500 }];
    const r = M.heavyDiscounts(b);
    expect(r.map((x) => x.number)).toEqual(['B4', 'B1']); expect(r[1].pct).toBe(30);
  });
  test('returned-in-full bills grouped by staff, only from 3', () => {
    const b = [1, 2, 3].map((i) => ({ status: 'returned', by: 's1', total: 100 * i })).concat([{ status: 'returned', by: 's2', total: 50 }, { status: 'paid', by: 's1', total: 99 }]);
    const r = M.returnsByStaff(b);
    expect(r.length).toBe(1); expect(r[0].by).toBe('s1'); expect(r[0].count).toBe(3); expect(r[0].rupees).toBe(600);
  });
  test('stock mismatch: short and extra, small ones dropped, biggest first', () => {
    const r = M.stockMismatch([{ itemId: 1, name: 'A', system: 10, counted: 7, cost: 100 }, { itemId: 2, name: 'B', system: 5, counted: 6, cost: 100 }, { itemId: 3, name: 'C', system: 5, counted: 4, cost: 10 }, { itemId: 4, name: 'D', system: 5, counted: 5, cost: 999 }]);
    expect(r.map((x) => x.itemId)).toEqual([1, 2]); expect(r[0].kind).toBe('short'); expect(r[0].rupees).toBe(300); expect(r[1].kind).toBe('extra');
  });
  test('cash mismatch', () => {
    expect(M.cashMismatch({ expected: 5000, counted: 4900 })).toEqual({ diff: -100, rupees: 100, currency: 'INR', ok: false, kind: 'short' });
    expect(M.cashMismatch({ expected: 5000, counted: 5000 }).ok).toBe(true);
  });
});
describe('daily summary', () => {
  const bills = [
    { total: 500, discount: 0, credit: 0, change: 20, payments: [{ method: 'cash', amount: 520 }] },
    { total: 300, discount: 10, credit: 0, change: 0, payments: [{ method: 'upi', amount: 300 }] },
    { total: 200, discount: 0, credit: 200, change: 0, payments: [{ method: 'credit', amount: 200 }] },
    { total: 999, status: 'returned', payments: [{ method: 'cash', amount: 999 }] },
  ];
  test('sales: cash net of change, credit not counted as received, returned bills left out', () => {
    expect(M.salesOf(bills)).toEqual({ total: 1000, count: 3, cash: 500, upi: 300, card: 0, other: 0, credit: 200, discount: 10, currency: 'INR' });
  });
  test('three actions: ranked by rupees at stake, each with a reason, never more than three', () => {
    const s = M.dailySummary({
      bills, lowStock: [1, 2],
      overdue: [{ customerId: 'c', due: 2000, daysOld: 30 }],
      expiring: [{ name: 'Milk', daysLeft: 3, expired: false, rupees: 800 }, { name: 'Curd', expired: true, rupees: 100 }],
      reorder: [{ name: 'Rice', daysLeft: 1, rupees: 1300, reason: 'Sells 4 a day.' }],
      discounts: [{ rupees: 300, reason: 'Bill B1: 300 off.' }], dead: [{ rupees: 400 }],
    });
    expect(s.actions.length).toBe(3);
    expect(s.actions.map((a) => a.key)).toEqual(['udhaar', 'reorder', 'expiry']);
    expect(s.actions.every((a) => a.reason && a.currency === 'INR')).toBe(true);
    expect(s.udhaarOverdueTotal).toBe(2000); expect(s.lowStockCount).toBe(2);
  });
  test('quiet day gives no invented actions', () => { expect(M.dailySummary({ bills: [] }).actions).toEqual([]); });
});
