const M = require('../src');
const S = require('../src/shape');
describe('cash book and day close', () => {
  test('expected = opening + cash sales + udhaar cash in - expenses - supplier cash out', () => {
    expect(M.expectedCash({ opening: 1000, cashSales: 5000, udhaarCashIn: 300, expensesCash: 400, supplierCashOut: 1200 }).expected).toBe(4700);
    let code = ''; try { M.expectedCash({ opening: 10.5 }); } catch (e) { code = e.code; } expect(code).toBe('ACCOUNTS_INVALID');
  });
  test('day close says short, extra or match with a plain note', () => {
    expect(M.dayClose({ expected: 4700, counted: 4600 }).kind).toBe('short');
    expect(M.dayClose({ expected: 4700, counted: 4600 }).note).toMatch(/100 rupees short/);
    expect(M.dayClose({ expected: 4700, counted: 4700 }).ok).toBe(true);
  });
});
describe('expenses and suppliers', () => {
  test('by category, unknown category becomes other, bad rows skipped', () => {
    const r = M.expensesByCategory([{ category: 'rent', amount: 8000 }, { category: 'tea_food', amount: 200 }, { category: 'xyz', amount: 300 }, { category: 'rent', amount: -5 }, { category: 'rent', amount: 1.5 }]);
    expect(r.total).toBe(8500); expect(r.byCategory[0]).toEqual({ category: 'rent', amount: 8000 }); expect(r.byCategory.find((x) => x.category === 'other').amount).toBe(300);
  });
  const p = [{ id: 1, supplierId: 's1', day: '2026-10-01', amount: 1000, paid: 400 }, { id: 2, supplierId: 's1', day: '2026-10-20', amount: 500, paid: 0 }, { id: 3, supplierId: 's2', day: '2026-11-01', amount: 300, paid: 300 }, { id: 4, supplierId: 's3', day: '2026-11-05', amount: 2000, paid: 0 }];
  test('dues per supplier, biggest first, with the age of the oldest', () => {
    const d = M.supplierDues(p, '2026-11-12');
    expect(d.map((x) => x.supplierId)).toEqual(['s3', 's1']); expect(d[1].due).toBe(1100); expect(d[1].daysOld).toBe(42);
  });
  test('a payment clears the oldest purchase first and cannot exceed what is owed', () => {
    const a = M.allocatePayment(p.filter((x) => x.supplierId === 's1'), 700);
    expect(a).toEqual([{ id: 1, paid: 1000 }, { id: 2, paid: 100 }]);
    let msg = ''; try { M.allocatePayment(p.filter((x) => x.supplierId === 's1'), 2000); } catch (e) { msg = e.message; } expect(msg).toMatch(/owed 1100/);
    msg = ''; try { M.allocatePayment(p, 0); } catch (e) { msg = e.code; } expect(msg).toBe('ACCOUNTS_INVALID');
  });
});
describe('profit and loss', () => {
  const bills = [{ taxable: 1000, gst: 50, total: 1050, status: 'paid', lines: [{ itemId: 'a', qty: 10 }] }, { taxable: 500, gst: 25, total: 525, status: 'paid', lines: [{ itemId: 'b', qty: 5 }] }, { taxable: 999, gst: 0, status: 'returned', lines: [] }];
  test('sales without GST, cost of goods, expenses, net; all costs known means not an estimate', () => {
    const r = M.profitAndLoss({ bills, expenses: [{ category: 'rent', amount: 300 }], costOf: { a: 60, b: 80 } });
    expect(r.sales).toBe(1500); expect(r.gst).toBe(75); expect(r.costOfGoods).toBe(1000); expect(r.grossProfit).toBe(500); expect(r.netProfit).toBe(200); expect(r.estimate).toBe(false);
    expect(r.plain).toMatch(/200 rupees/);
  });
  test('missing cost price makes it an estimate and names the item', () => {
    const r = M.profitAndLoss({ bills, expenses: [], costOf: { a: 60 } });
    expect(r.estimate).toBe(true); expect(r.itemsWithoutCost).toEqual(['b']); expect(r.plain).toMatch(/estimate/);
  });
});
describe('CA file', () => {
  test('one row per bill and expense, quoted, formula-looking text defused', () => {
    const csv = M.caCsv({ bills: [{ number: 'BILL/1', taxable: 100, cgst: 2, sgst: 3, igst: 0, total: 105, status: 'paid', createdAt: '2026-11-10T06:00:00Z' }], expenses: [{ day: '2026-11-10', category: 'rent', amount: 500, note: '=HYPERLINK("x")' }], dayOf: (b) => M.istDay(b.createdAt) });
    const lines = csv.trim().split('\n');
    expect(lines.length).toBe(3); expect(lines[1]).toBe('Sale,2026-11-10,BILL/1,100,2,3,0,105,paid,INR');
    expect(lines[2]).toMatch(/"'=HYPERLINK\(""x""\)"/);
  });
});
describe('sales reports', () => {
  const bills = [
    { createdAt: '2026-11-10T04:00:00Z', total: 100, by: 's1', lines: [{ name: 'Rice', total: 60 }, { name: 'Dal', total: 40 }] },
    { createdAt: '2026-11-10T04:20:00Z', total: 200, by: 's2', lines: [{ name: 'Rice', total: 200 }] },
    { createdAt: '2026-11-11T13:00:00Z', total: 50, by: 's1', lines: [] }, { createdAt: '2026-11-11T13:00:00Z', total: 999, status: 'returned' },
  ];
  test('by day (IST), by hour (IST), by staff, by item; returned bills left out; bad dimension refused', () => {
    expect(M.salesBy(bills, 'day').map((x) => [x.key, x.total])).toEqual([['2026-11-10', 300], ['2026-11-11', 50]]);
    expect(M.salesBy(bills, 'hour').map((x) => x.key)).toEqual(['09', '18']);
    expect(M.salesBy(bills, 'staff').map((x) => [x.key, x.total])).toEqual([['s2', 200], ['s1', 150]]);
    expect(M.salesBy(bills, 'item').map((x) => [x.key, x.total])).toEqual([['Rice', 260], ['Dal', 40]]);
    let code = ''; try { M.salesBy(bills, 'moon'); } catch (e) { code = e.code; } expect(code).toBe('REPORT_DIM');
  });
});
describe('predictions (estimates)', () => {
  test('next month range needs three months, uses the last three, always labelled an estimate', () => {
    expect(M.nextMonthRange([100, 200]).ok).toBe(false);
    const r = M.nextMonthRange([50, 100000, 120000, 90000]);
    expect(r.low).toBe(90000); expect(r.high).toBe(120000); expect(r.likely).toBe(103333); expect(r.estimate).toBe(true); expect(r.note).toMatch(/not a promise/);
  });
  test('busy and slow hours and days, only with enough bills', () => {
    expect(M.busySlow([{ createdAt: '2026-11-10T04:00:00Z' }]).ok).toBe(false);
    const bills = []; for (let i = 0; i < 40; i++) bills.push({ createdAt: '2026-11-10T04:00:00Z' }); for (let i = 0; i < 20; i++) bills.push({ createdAt: '2026-11-11T13:00:00Z' });
    const r = M.busySlow(bills);
    expect(r.ok).toBe(true); expect(r.busyHours[0].key).toBe('09:00'); expect(r.busyHours[0].sharePct).toBe(67); expect(r.busyDays[0].key).toBe('Tuesday'); expect(r.estimate).toBe(true);
  });
  test('lapse risk: needs 3 visits, more than 1.5 times the usual gap, skips do-not-contact', () => {
    const c = [
      { customerId: 'a', name: 'A', dates: ['2026-08-01', '2026-08-15', '2026-08-29'] },
      { customerId: 'b', name: 'B', dates: ['2026-10-20', '2026-11-03', '2026-11-10'] },
      { customerId: 'c', name: 'C', dates: ['2026-08-01', '2026-08-15', '2026-08-29'], doNotContact: true },
      { customerId: 'd', name: 'D', dates: ['2026-08-01', '2026-08-15'] },
    ];
    const r = M.lapseRisk(c, '2026-11-12');
    expect(r.map((x) => x.customerId)).toEqual(['a']); expect(r[0].usualGapDays).toBe(14); expect(r[0].daysSince).toBe(75); expect(r[0].estimate).toBe(true);
  });
  test('cash needed', () => { expect(M.cashNeededForDues({ supplierDue: 3000, expectedExpenses: 500 }).rupees).toBe(3500); });
});
describe('marketing suggestions', () => {
  test('festival ideas only for dates the owner entered and inside the window', () => {
    const r = M.festivalIdeas([{ name: 'Pongal', date: '2027-01-14' }, { name: 'Diwali', date: '2026-11-20' }, { name: 'Past', date: '2026-11-01' }, { name: 'Soon', date: '2026-11-15' }], '2026-11-12');
    expect(r.map((x) => x.name)).toEqual(['Soon', 'Diwali']); expect(r[1].inDays).toBe(8);
  });
  test('review requests: bought in the last two days, not do-not-contact', () => {
    const r = M.reviewRequests([{ customerId: 1, name: 'A', lastBillDay: '2026-11-11' }, { customerId: 2, name: 'B', lastBillDay: '2026-11-01' }, { customerId: 3, name: 'C', lastBillDay: '2026-11-12', doNotContact: true }], '2026-11-12');
    expect(r.map((x) => x.customerId)).toEqual([1]);
  });
});
describe('shape: stored records to rule inputs', () => {
  test('ledger adds an opening-balance entry and a returns entry so it ends at the stored balance', () => {
    const customers = [{ _id: 'c1', creditDue: 700, createdAt: '2026-09-01T00:00:00Z' }, { _id: 'c2', creditDue: 0, createdAt: '2026-09-01T00:00:00Z' }];
    const bills = [{ customerId: 'c1', credit: 200, createdAt: '2026-10-01T06:00:00Z', status: 'credit' }, { customerId: 'c2', credit: 300, createdAt: '2026-10-02T06:00:00Z', status: 'credit' }];
    const payments = [{ customerId: 'c1', amount: 100, day: '2026-10-10' }];
    const e = S.ledger({ bills, payments, customers });
    const b = M.balances(e);
    expect(b.c1.due).toBe(700); expect(b.c2.due).toBe(0);
    expect(e.some((x) => x.customerId === 'c1' && x.type === 'credit' && x.amount === 600 && x.date === '2026-09-01')).toBe(true);
    expect(e.some((x) => x.customerId === 'c2' && x.type === 'payment' && x.amount === 300)).toBe(true);
  });
  test('salesOf flattens item lines by shop day and skips returned bills', () => {
    const r = S.salesOf([{ createdAt: '2026-11-10T20:00:00Z', lines: [{ itemId: 'a', qty: 2 }, { name: 'loose', qty: 1 }] }, { createdAt: '2026-11-10T06:00:00Z', status: 'returned', lines: [{ itemId: 'a', qty: 9 }] }]);
    expect(r).toEqual([{ itemId: 'a', qty: 2, date: '2026-11-11' }]);
  });
});
