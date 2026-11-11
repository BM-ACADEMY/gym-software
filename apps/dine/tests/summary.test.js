const D = require('../src');
const base = { date: '2026-11-12', bills: [{ total: 500, subtotal: 500, discount: 0 }, { total: 300, subtotal: 300, discount: 0 }], venue: 'Cafe Aroma', menu: [{ name: 'Coffee', kind: 'drink' }] };
describe('IST helpers', () => {
  test('IST date and hour; order to bill; cash taken nets out change', () => {
    expect(D.istParts('2026-11-12T20:00:00Z')).toEqual({ date: '2026-11-13', hour: 1, day: 5, minutes: 90 });
    const o = { number: 'D-1', status: 'paid', paidAt: '2026-11-12T08:00:00Z', grandTotal: 105, currency: 'INR', totals: { taxable: 100, cgst: 3, sgst: 2, igst: 0, lines: [{ name: 'A', qty: 1, total: 105, taxable: 100, gst: 5, rate: 5 }] }, payments: [{ method: 'cash', amount: 200 }, { method: 'upi', amount: 0 }], settle: { change: 95 } };
    const b = D.orderToBill(o); expect(b.date).toBe('2026-11-12'); expect(b.hour).toBe(13); expect(b.total).toBe(105); expect(b.lines[0].name).toBe('A');
    expect(D.cashTaken([o, { ...o, status: 'billed' }], '2026-11-12')).toBe(105);
  });
});
describe('daily summary', () => {
  test('quiet day: headline only, no actions', () => {
    const s = D.dailySummary(base); expect(s.headline.sales).toBe(800); expect(s.headline.averageBill).toBe(400); expect(s.actions).toEqual([]); expect(s.mode).toBe('suggest');
  });
  test('at most three actions, problems first, each with a reason', () => {
    const s = D.dailySummary({ ...base, leak: { voidsAfterSend: 4, reopens: 0 }, close: { expected: 5000, counted: 4700 }, foodCost: { percent: 41 }, stock: [{ id: 'a', name: 'Rice', qty: 5 }], dailyUse: { a: 5 }, byHour: [{ hour: 12, sales: 5000 }, { hour: 13, sales: 6000 }, { hour: 15, sales: 500 }], customers: [{ id: 1, name: 'Ravi', lastVisit: '2026-08-01' }] });
    expect(s.actions.length).toBe(3); expect(s.actions[0].kind).toBe('check'); expect(s.actions[1].kind).toBe('check');
    for (const a of s.actions) expect(a.reason.length > 10).toBe(true);
    expect(s.flags.map((f) => f.code)).toEqual(['voids', 'cash_short']);
  });
  test('food cost, stock and marketing actions appear when nothing is wrong; pub mode never suggests a WhatsApp offer', () => {
    const o = { ...base, foodCost: { percent: 41 }, stock: [{ id: 'a', name: 'Rice', qty: 5 }], dailyUse: { a: 5 }, byHour: [{ hour: 12, sales: 5000 }, { hour: 13, sales: 6000 }, { hour: 15, sales: 500 }], customers: [{ id: 1, name: 'Ravi', lastVisit: '2026-08-01' }] };
    expect(D.dailySummary(o).actions.map((a) => a.kind)).toEqual(['cost', 'stock', 'marketing']);
    expect(D.dailySummary({ ...o, pubMode: true }).actions.filter((a) => a.template === 'dine_slow_hour').length).toBe(0);
    expect(D.dailySummary({ ...o, foodCost: { percent: 20 } }).actions[0].kind).toBe('stock');
  });
});
