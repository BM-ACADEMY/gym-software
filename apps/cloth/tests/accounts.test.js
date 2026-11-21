const Ac = require('../src/accounts'); const Pr = require('../src/predict'); const Lk = require('../src/leaks'); const St = require('../src/staffRules');
describe('accounts', () => {
  test('expense validation and category fallback', () => {
    expect(Ac.validateExpense({ date: '2026-11-10', amount: 500, category: 'rent' }).value.category).toBe('rent');
    expect(Ac.validateExpense({ date: '2026-11-10', amount: 500, category: 'weird', mode: 'x' }).value.category).toBe('other');
    expect(Ac.validateExpense({ date: '2026-11-10', amount: 0 }).error).toMatch(/Amount/);
    expect(Ac.validateExpense({ date: 'bad', amount: 5 }).error).toMatch(/date/);
    expect(Ac.validateExpense({ date: '2026-11-10', amount: 5.5 }).error).toMatch(/whole/);
  });
  test('day close: matched, short, excess, bad input', () => {
    expect(Ac.dayClose({ opening: 1000, cashIn: 5000, cashOut: 800, counted: 5200 }).status).toBe('matched');
    const s = Ac.dayClose({ opening: 1000, cashIn: 5000, cashOut: 800, counted: 5100 }); expect(s.difference).toBe(-100); expect(s.status).toBe('short'); expect(s.text).toMatch(/Rs 100 short/);
    expect(Ac.dayClose({ opening: 0, cashIn: 100, cashOut: 0, counted: 130 }).status).toBe('excess');
    expect(Ac.dayClose({ opening: 0, cashIn: 1.5, cashOut: 0, counted: 0 }).error).toMatch(/whole/);
  });
  test('profit and loss in plain words, loss case too; category totals', () => {
    const e = [{ category: 'rent', amount: 8000 }, { category: 'rent', amount: 100 }, { category: 'tea_food', amount: 400 }];
    expect(Ac.byCategory(e)).toEqual({ rent: 8100, tea_food: 400 });
    const p = Ac.profitAndLoss({ sales: 50000, cogs: 30000, expenses: e }); expect(p.grossProfit).toBe(20000); expect(p.netProfit).toBe(11500); expect(p.text).toMatch(/earned Rs 11500/);
    expect(Ac.profitAndLoss({ sales: 1000, cogs: 900, expenses: e }).text).toMatch(/lost Rs 8400/);
  });
  test('supplier dues ageing, paid bills skipped', () => {
    const r = Ac.supplierDues([{ id: 1, supplier: 'A', amount: 1000, paid: 0, dueOn: '2026-11-20' }, { id: 2, supplier: 'B', amount: 2000, paid: 500, dueOn: '2026-11-02' }, { id: 3, supplier: 'C', amount: 900, paid: 0, dueOn: '2026-09-01' }, { id: 4, supplier: 'D', amount: 100, paid: 100, dueOn: '2026-01-01' }], '2026-11-12');
    expect(r.total).toBe(3400); expect(r.notDue).toBe(1000); expect(r.late1to30).toBe(1500); expect(r.late31plus).toBe(900); expect(r.rows[0].supplier).toBe('C');
  });
  test('GST summary by rate; CSV is safe from formulas and quotes', () => {
    const g = Ac.gstSummary([{ taxable: 1000, gstRate: 5 }, { taxable: 2000, gstRate: 5 }, { taxable: 1000, gstRate: 18 }, { taxable: 1.5, gstRate: 5 }]);
    expect(g.rows).toEqual([{ rate: 5, taxable: 3000, tax: 150 }, { rate: 18, taxable: 1000, tax: 180 }]); expect(g.tax).toBe(330);
    const c = Ac.toCsv(['a', 'b'], [{ a: '=HYPERLINK("x")', b: 'hi, "you"' }]);
    expect(c).toBe("a,b\n'=HYPERLINK(\"\"x\"\")\",\"hi, \"\"you\"\"\"".replace("'=HYPERLINK(\"\"x\"\")\"", "\"'=HYPERLINK(\"\"x\"\")\""));
  });
});
describe('predictions are labelled estimates with a reason', () => {
  test('next month range needs 3 months; uses last 6', () => {
    expect(Pr.nextMonthRange([{ total: 1 }, { total: 2 }])).toBe(null);
    const r = Pr.nextMonthRange([{ total: 100000 }, { total: 120000 }, { total: 110000 }]); expect(r.likely).toBe(110000); expect(r.low < r.likely && r.likely < r.high).toBe(true); expect(r.estimate).toBe(true); expect(r.reason).toMatch(/3 months/);
  });
  test('weekday pattern needs 28 days', () => {
    expect(Pr.weekdayPattern([{ date: '2026-11-01', total: 5 }])).toBe(null);
    const d = []; for (let i = 0; i < 28; i++) { const dt = new Date(Date.UTC(2026, 9, 1 + i)); d.push({ date: dt.toISOString().slice(0, 10), total: dt.getUTCDay() === 6 ? 9000 : 3000 }); }
    const p = Pr.weekdayPattern(d); expect(p.busiest.day).toBe('Saturday'); expect(p.busiest.avg).toBe(9000); expect(p.slowest.avg).toBe(3000);
  });
  test('run-out: only items that sell and will last under 14 days', () => {
    const r = Pr.runOut([{ key: 'a', qty: 10 }, { key: 'b', qty: 100 }, { key: 'c', qty: 5 }], { a: 30, b: 30 });
    expect(r.length).toBe(1); expect(r[0].key).toBe('a'); expect(r[0].daysLeft).toBe(10);
  });
  test('lapse risk: own gap x 1.5; needs 3 visits; do-not-contact skipped', () => {
    const cs = [{ id: 1, name: 'A', visits: ['2026-06-01', '2026-07-01', '2026-08-01'] }, { id: 2, name: 'B', visits: ['2026-10-01', '2026-11-01', '2026-11-08'] }, { id: 3, name: 'C', visits: ['2026-01-01'] }, { id: 4, name: 'D', visits: ['2026-06-01', '2026-07-01', '2026-08-01'], doNotContact: true }];
    const r = Pr.lapseRisk(cs, '2026-11-12'); expect(r.map((x) => x.id)).toEqual([1]); expect(r[0].usualGapDays).toBe(31); expect(r[0].reason).toMatch(/every 31 days/);
  });
  test('cash needed', () => { const c = Pr.cashNeeded([{ owe: 1000, dueIn: 3 }, { owe: 500, dueIn: 20 }], 4000); expect(c.total).toBe(5000); expect(c.estimate).toBe(true); });
});
describe('leak checks and staff', () => {
  test('heavy discounts', () => {
    const r = Lk.heavyDiscounts([{ id: 1, number: 'CL1', total: 750, discount: 250, by: 's' }, { id: 2, total: 950, discount: 50 }, { id: 3, total: 100, discount: 0 }]);
    expect(r.length).toBe(1); expect(r[0].discountPct).toBe(25);
  });
  test('voids by staff need volume and twice the shop rate', () => {
    const b = []; for (let i = 0; i < 6; i++) b.push({ by: 'x', status: i < 3 ? 'returned' : 'paid' }); for (let i = 0; i < 20; i++) b.push({ by: 'y', status: 'paid' }); for (let i = 0; i < 2; i++) b.push({ by: 'z', status: 'returned' });
    const r = Lk.voidsByStaff(b); expect(r.length).toBe(1); expect(r[0].by).toBe('x');
  });
  test('cash differences need 3 short days', () => {
    expect(Lk.cashDifferences([{ difference: -10 }, { difference: -20 }])).toEqual([]);
    expect(Lk.cashDifferences([{ difference: -10 }, { difference: -20 }, { difference: -30 }, { difference: 5 }])[0].total).toBe(-60);
  });
  test('month pay: absent, half day, paid leave, bad input', () => {
    const marks = [{ date: '2026-11-02', status: 'absent' }, { date: '2026-11-03', status: 'half' }, { date: '2026-11-04', status: 'leave' }];
    expect(St.monthPay({ salary: 30000, marks, daysInMonth: 30 }).pay).toBe(27500);
    expect(St.monthPay({ salary: 30000, marks, daysInMonth: 30, paidLeave: 1 }).pay).toBe(28500);
    expect(St.monthPay({ salary: 30000, marks: [], daysInMonth: 30 }).pay).toBe(30000);
    expect(St.monthPay({ salary: 3.5, marks: [], daysInMonth: 30 }).error).toMatch(/whole/);
  });
});
