const D = require('../src');
const { bill } = require('../../../packages/core-pos/src/pure');
const fails = (fn, code) => { let e; try { fn(); } catch (x) { e = x; } return !!e && (!code || e.code === code); };

describe('accounts', () => {
  test('cash book running balance; day close short, over, ok', () => {
    const c = D.cashBook({ opening: 1000, entries: [{ type: 'in', amount: 500 }, { type: 'out', amount: 200, category: 'Gas' }] });
    expect(c.closing).toBe(1300); expect(c.rows[1].balance).toBe(1300); expect(c.in).toBe(500); expect(c.out).toBe(200);
    expect(fails(() => D.cashBook({ entries: [{ type: 'in', amount: 1.5 }] }), 'ACCOUNTS_INVALID')).toBe(true);
    expect(D.dayClose({ opening: 1000, cashSales: 4000, cashIn: 0, cashOut: 500, counted: 4400 }).status).toBe('short');
    expect(D.dayClose({ opening: 1000, cashSales: 4000, cashOut: 500, counted: 4500 }).status).toBe('ok');
    const over = D.dayClose({ opening: 0, cashSales: 100, counted: 150 }); expect(over.status).toBe('over'); expect(over.words).toMatch(/Rs 50 more/);
  });
  test('expenses by category with share', () => {
    const e = D.byCategory([{ category: 'Gas', amount: 300 }, { category: 'Rent', amount: 700 }, { category: 'Gas', amount: 100 }, { amount: 100 }]);
    expect(e.total).toBe(1200); expect(e.rows[0].category).toBe('Rent'); expect(e.rows[1].amount).toBe(400); expect(e.rows[1].sharePercent).toBe(33.3); expect(e.rows[2].category).toBe('Other');
  });
  test('supplier dues: payments clear the oldest purchase first, ageing buckets, advance kept', () => {
    const d = D.supplierDues([{ supplier: 'A', date: '2026-08-01', amount: 1000 }, { supplier: 'A', date: '2026-10-20', amount: 500 }, { supplier: 'B', date: '2026-11-01', amount: 300 }], [{ supplier: 'A', date: '2026-09-01', amount: 1200 }, { supplier: 'C', date: '2026-11-01', amount: 50 }], '2026-11-12');
    const a = d.find((x) => x.supplier === 'A'); expect(a.due).toBe(300); expect(a.age.d0_30).toBe(300); expect(a.oldest).toBe('2026-10-20');
    expect(d.find((x) => x.supplier === 'B').age.d0_30).toBe(300); expect(d.find((x) => x.supplier === 'C').advance).toBe(50);
    expect(d[0].supplier).toBe('A');
  });
  test('profit and loss in plain words, loss case, bad input', () => {
    const p = D.profitAndLoss({ salesBeforeGst: 100000, costOfFood: 32000, staffCost: 25000, expenses: [{ category: 'Rent', amount: 20000 }, { category: 'Gas', amount: 5000 }] });
    expect(p.grossProfit).toBe(68000); expect(p.netProfit).toBe(18000); expect(p.netPercent).toBe(18); expect(p.words).toMatch(/left with Rs 18000/);
    expect(D.profitAndLoss({ salesBeforeGst: 1000, costOfFood: 600, staffCost: 600 }).words).toMatch(/Rs 200 in loss/);
    expect(fails(() => D.profitAndLoss({ salesBeforeGst: -1, costOfFood: 0 }), 'ACCOUNTS_INVALID')).toBe(true);
  });
  test('GST summary adds the bills by rate and says it is not a return; CA csv guards formulas and quotes', () => {
    const b1 = bill.compute({ lines: [{ name: 'A', unitPrice: 200, qty: 1, gstRate: 5 }, { name: 'B', unitPrice: 100, qty: 1, gstRate: 12 }], taxMode: 'gst_exclusive' });
    const b2 = bill.compute({ lines: [{ name: 'A', unitPrice: 100, qty: 1, gstRate: 5 }], taxMode: 'gst_exclusive' });
    const g = D.gstSummary([b1, b2]);
    expect(g.byRate.length).toBe(2); expect(g.byRate[0]).toEqual({ rate: 5, taxable: 300, gst: 15 }); expect(g.taxable).toBe(400); expect(g.totalGst).toBe(27); expect(g.note).toMatch(/not a GST return/);
    const csv = D.caExport([{ date: '2026-11-12', number: '=1+1', taxable: 100, cgst: 3, sgst: 3, igst: 0, total: 106 }, { date: '2026-11-12', number: 'A,"B"', taxable: 1, cgst: 0, sgst: 0, igst: 0, total: 1 }]);
    expect(csv.split('\r\n')[1]).toMatch(/^2026-11-12,'=1\+1,100/); expect(csv).toMatch(/"A,""B"""/);
    expect(D.toCsv(['n'], [[-5]])).toBe('n\r\n-5\r\n');
  });
});

const bills = [
  { date: '2026-11-02', hour: 13, staffId: 's1', number: '1', total: 500, lines: [{ name: 'Biryani', qty: 2, total: 400 }, { name: 'Tea', qty: 1, total: 100 }] },
  { date: '2026-11-03', hour: 13, staffId: 's2', number: '2', total: 300, lines: [{ name: 'Biryani', qty: 1, total: 300 }] },
  { date: '2026-11-09', hour: 20, staffId: 's1', number: '3', total: 200, lines: [{ name: 'Tea', qty: 2, total: 200 }] },
  { date: '2026-12-01', hour: 20, staffId: 's1', number: '4', total: 100, lines: [{ name: 'Tea', qty: 1, total: 100 }] },
];
describe('sales reports', () => {
  test('by day, week (Monday start), month, staff, hour, item', () => {
    expect(D.byDay(bills).length).toBe(4); expect(D.mondayOf('2026-11-12')).toBe('2026-11-09'); expect(D.mondayOf('2026-11-08')).toBe('2026-11-02');
    expect(D.byWeek(bills).map((w) => w.sales)).toEqual([800, 200, 100]);
    expect(D.byMonth(bills)).toEqual([{ month: '2026-11', bills: 3, sales: 1000 }, { month: '2026-12', bills: 1, sales: 100 }]);
    expect(D.byStaff(bills)[0]).toEqual({ staffId: 's1', bills: 3, sales: 800 });
    expect(D.byHour(bills).map((h) => h.hour)).toEqual([13, 20]);
    expect(D.byItem(bills)[0]).toEqual({ name: 'Biryani', qty: 3, sales: 700 });
  });
});

describe('predictions are labelled estimates with a reason', () => {
  test('sales range needs 3 months, then a range around the average with the data shown', () => {
    expect(D.salesRange([100, 200]).range).toBe(null);
    const r = D.salesRange([90000, 100000, 110000, 100000]); expect(r.range.mid).toBe(103333); expect(r.range.low < r.range.mid && r.range.mid < r.range.high).toBe(true); expect(r.basedOn).toEqual([100000, 110000, 100000]); expect(r.label).toMatch(/not a promise/); expect(r.reason).toMatch(/last 3 months/);
    expect(D.salesRange([0, 0, 0]).range.low).toBe(0);
  });
  test('busy weekdays need 14 days; busy hours need 6 hours', () => {
    expect(D.busyDays([{ date: '2026-11-01', sales: 1 }]).days).toBe(null);
    const days = []; for (let i = 0; i < 14; i++) { const d = new Date(Date.UTC(2026, 10, 1 + i)); days.push({ date: d.toISOString().slice(0, 10), sales: d.getUTCDay() === 6 ? 9000 : 3000 }); }
    const b = D.busyDays(days); expect(b.busiest).toBe(6); expect(b.reason).toMatch(/14 days/);
    expect(D.busyHours([{ hour: 12, sales: 1 }]).busiest).toBe(null);
    const h = D.busyHours([10, 11, 12, 13, 14, 15].map((x, i) => ({ hour: x, sales: (i + 1) * 100 }))); expect(h.busiest).toEqual([13, 14, 15]); expect(h.slowest).toEqual([10, 11, 12]);
  });
  test('stock run-out in N days, lapse risk uses the customer own rhythm, cash needed', () => {
    const s = D.stockRunOut([{ id: 'a', name: 'Rice', qty: 10 }, { id: 'b', name: 'Oil', qty: 100 }, { id: 'c', name: 'Salt', qty: 1 }], { a: 5, b: 5 });
    expect(s.length).toBe(1); expect(s[0].daysLeft).toBe(2); expect(s[0].reason).toMatch(/may run out/); expect(s[0].label).toMatch(/Estimate/);
    const l = D.lapseRisk([{ id: 1, name: 'Ravi', visits: ['2026-08-01', '2026-08-11', '2026-08-21'] }, { id: 2, name: 'Sita', visits: ['2026-10-01', '2026-11-01'] }, { id: 3, name: 'Dev', visits: ['2026-08-01', '2026-08-11', '2026-08-21'], doNotContact: true }, { id: 4, name: 'Meena', visits: ['2026-10-20', '2026-10-30', '2026-11-09'] }], '2026-11-12');
    expect(l.map((x) => x.id)).toEqual([1]); expect(l[0].usualGapDays).toBe(10); expect(l[0].reason).toMatch(/every 10 days/);
    const c = D.cashNeeded([{ supplier: 'A', due: 500, dueDate: '2026-11-15' }, { supplier: 'B', due: 900, dueDate: '2026-12-30' }, { supplier: 'C', due: 5 }], '2026-11-12'); expect(c.total).toBe(500);
  });
});

describe('marketing suggestions', () => {
  test('win-back: skips do-not-contact, ready message with template name and a reason', () => {
    const w = D.winBackList([{ id: 1, name: 'Ravi Kumar', lastVisit: '2026-09-01' }, { id: 2, name: 'X', lastVisit: '2026-09-01', doNotContact: true }, { id: 3, name: 'Y', lastVisit: '2026-11-10' }], '2026-11-12', 'Cafe Aroma');
    expect(w.length).toBe(1); expect(w[0].template).toBe('dine_winback'); expect(w[0].message).toMatch(/^Hi Ravi, /); expect(w[0].reason).toMatch(/72 days/);
  });
  test('festivals come from the owner list within the window; slow-hour offer leaves liquor out; review link must be https', () => {
    const f = D.upcomingFestivals([{ name: 'Pongal', date: '2027-01-14' }, { name: 'Diwali', date: '2026-11-20', offerIdea: 'Sweet box' }, { name: 'Old', date: '2026-11-01' }], '2026-11-12');
    expect(f.length).toBe(1); expect(f[0].idea).toBe('Sweet box'); expect(f[0].daysAway).toBe(8);
    const o = D.slowHourOffer([{ hour: 15, sales: 900, reason: 'slow' }], [{ name: 'Beer', kind: 'liquor' }, { name: 'Coffee', kind: 'drink' }], 'Cafe');
    expect(o.suggestion).toMatch(/Coffee/); expect(o.suggestion.indexOf('Beer')).toBe(-1); expect(D.slowHourOffer([], [], 'x')).toBe(null);
    expect(fails(() => D.reviewRequest({ id: 1 }, 'Cafe', 'http://x.y'), 'MARKETING_INVALID')).toBe(true);
    expect(D.reviewRequest({ id: 1 }, 'Cafe', 'https://g.page/r/x').template).toBe('dine_review');
    expect(D.blockedForPub('Happy hour on whisky')).toBe(true); expect(D.blockedForPub('Coffee offer')).toBe(false);
  });
});

describe('staff', () => {
  test('roles: owner everything, cashier cannot void or see reports, kitchen only sees KOT', () => {
    expect(D.can('owner', 'anything')).toBe(true); expect(D.can('cashier', 'bill')).toBe(true); expect(D.can('cashier', 'void')).toBe(false); expect(D.can('cashier', 'reports')).toBe(false);
    expect(D.can('kitchen', 'orders')).toBe(false); expect(D.can('kitchen', 'kot_view')).toBe(true); expect(D.can('nobody', 'bill')).toBe(false);
  });
  test('hours worked from punches; missing punches are reported', () => {
    const h = D.hoursWorked([{ at: '2026-11-12T09:00:00Z', kind: 'in' }, { at: '2026-11-12T17:30:00Z', kind: 'out' }, { at: '2026-11-13T09:00:00Z', kind: 'in' }]);
    expect(h.minutes).toBe(510); expect(h.hours).toBe(8.5); expect(h.problems.length).toBe(1); expect(h.problems[0]).toMatch(/No clock-out/);
    expect(D.hoursWorked([{ at: '2026-11-12T09:00:00Z', kind: 'out' }]).problems.length).toBe(1);
  });
});
