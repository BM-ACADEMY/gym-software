const W = require('../src');
describe('accounts', () => {
  test('expense check; cash book adds up; unpaid and non-cash expenses behave', () => {
    expect(W.checkExpense({ category: 'water', amount: 500 }).ok).toBe(true);
    expect(W.checkExpense({ category: 'x', amount: 5 }).error).toMatch(/category/);
    expect(W.checkExpense({ category: 'water', amount: 5.5 }).error).toMatch(/whole rupees/);
    const b = W.cashBook({ openingFloat: 200, jobs: [{ plate: 'A', payments: [{ method: 'cash', amount: 400 }, { method: 'upi', amount: 50 }] }], expenses: [{ category: 'water', amount: 100, note: 'tanker' }, { category: 'rent', amount: 999, paid: false }, { category: 'other', amount: 70, cash: false }] });
    expect(b.totalIn).toBe(600); expect(b.totalOut).toBe(100); expect(b.closing).toBe(500); expect(b.rows[2].what).toBe('water: tanker');
  });
  test('supplier dues grouped, oldest first', () => {
    const d = W.supplierDues([{ supplier: 'Shine Co', amount: 300, paid: false, day: '2026-11-05' }, { supplier: 'Shine Co', amount: 200, paid: false, day: '2026-11-01' }, { supplier: 'Aqua', amount: 90, paid: false, day: '2026-10-20' }, { supplier: 'Paid Co', amount: 5, paid: true, day: '2026-10-01' }]);
    expect(d.map((x) => x.supplier + ':' + x.due)).toEqual(['Aqua:90', 'Shine Co:500']); expect(d[1].oldest).toBe('2026-11-01');
  });
  test('profit and loss in plain words, loss case too', () => {
    const p = W.profitLoss({ revenue: 10000, expenses: [{ category: 'water', amount: 1000 }, { category: 'rent', amount: 3000 }], incentive: 500 });
    expect(p.profit).toBe(5500); expect(p.byCategory.rent).toBe(3000); expect(p.words).toMatch(/kept Rs 5500/);
    expect(W.profitLoss({ revenue: 100, expenses: [{ category: 'rent', amount: 300 }] }).words).toMatch(/lost Rs 200/);
  });
  test('CA csv: sales and expenses listed; formula characters are defused; quotes escaped', () => {
    const csv = W.caCsv({ jobs: [{ state: 'delivered', day: '2026-11-12', number: 3, plate: '=CMD()', payments: [{ method: 'cash', amount: 400 }], passCovered: 0 }, { state: 'cancelled', day: '2026-11-12', number: 4, plate: 'X', payments: [] }, { state: 'delivered', day: '2026-11-12', number: 5, plate: 'TN09AB1234', passCovered: 300, payments: [{ method: 'upi', amount: 50 }] }], expenses: [{ day: '2026-11-11', category: 'other', note: 'say "hi", ok', amount: 20 }] });
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('type,date,reference,description,method,amount_inr');
    expect(lines.length).toBe(5); expect(lines[1]).toBe("sale,2026-11-12,#3,'=CMD(),cash,400");
    expect(csv).toMatch(/monthly pass/); expect(lines[4]).toBe('expense,2026-11-11,,"other: say ""hi"", ok",paid,20');
  });
});
describe('reports', () => {
  const jobs = [{ state: 'delivered', day: '2026-11-11', klass: 'sedan', attendantId: 'a', total: 400, deliveredAt: '2026-11-11T05:00:00Z' }, { state: 'delivered', day: '2026-11-12', klass: 'suv', attendantId: 'b', total: 800, deliveredAt: '2026-11-12T10:00:00Z' }, { state: 'delivered', day: '2026-11-12', klass: 'sedan', attendantId: 'a', total: 400, deliveredAt: '2026-11-12T05:10:00Z' }, { state: 'waiting', day: '2026-11-12', klass: 'bike', total: 100 }];
  test('by day, class, attendant and hour (IST); open jobs not counted; bad key is an error', () => {
    expect(W.salesBy(jobs, 'day').rows.map((r) => r.key + ':' + r.revenue)).toEqual(['2026-11-11:400', '2026-11-12:1200']);
    expect(W.salesBy(jobs, 'class').rows.map((r) => r.key + ':' + r.jobs + ':' + r.revenue).sort()).toEqual(['sedan:2:800', 'suv:1:800']);
    expect(W.salesBy(jobs, 'attendant').rows.length).toBe(2); expect(W.salesBy(jobs, 'attendant').total).toBe(1600);
    expect(W.salesBy(jobs, 'hour').rows.map((r) => r.key)).toEqual(['10', '15']);
    expect(W.salesBy(jobs, 'moon').error).toMatch(/Choose/);
  });
});
describe('predictions are labelled estimates with reasons', () => {
  test('next month range needs 3 months, uses last 6', () => {
    expect(W.nextMonthRange([100, 200]).enough).toBe(false);
    const r = W.nextMonthRange([50, 100, 200, 300, 400, 500, 600]);
    expect(r.basedOn).toEqual([100, 200, 300, 400, 500, 600]); expect(r.low).toBe(100); expect(r.high).toBe(600); expect(r.expected).toBe(350);
    expect(r.label).toBe('Estimate, not a promise'); expect(r.reason).toMatch(/last 6 months/);
  });
  test('busy hours needs 20 jobs; renewals and lapse risk give reasons', () => {
    const mk = (h, n) => Array.from({ length: n }, () => ({ createdAt: h }));
    const jobs = [...mk(9, 10), ...mk(11, 6), ...mk(15, 2), ...mk(17, 3)];
    const b = W.busyHours(jobs, (h) => h);
    expect(b.enough).toBe(true); expect(b.busiest[0].hour).toBe(9); expect(b.slowest[0].hour).toBe(15);
    expect(W.busyHours(mk(9, 5), (h) => h).enough).toBe(false);
    const r = W.renewalsExpected([{ plate: 'A', washes: 4, used: 0, startsOn: '2026-11-01', endsOn: '2026-11-20', price: 1000 }, { plate: 'B', washes: 4, used: 0, startsOn: '2026-11-01', endsOn: '2027-02-01', price: 500 }], '2026-11-12', require('../src/pass').status);
    expect(r.count).toBe(1); expect(r.ifHalfRenew).toBe(500); expect(r.reason).toMatch(/guess/);
    const l = W.lapseRisk([{ plate: 'A', ownerName: 'x', lastWash: '2026-10-01' }, { plate: 'B', lastWash: '2026-11-05' }, { plate: 'C', lastWash: '2026-08-01' }, { plate: 'D', lastWash: '2026-10-01', doNotContact: true }], '2026-11-12');
    expect(l.map((x) => x.plate)).toEqual(['A']); expect(l[0].reason).toMatch(/every 14 days/);
  });
});
describe('marketing suggestions send nothing', () => {
  test('review requests are unapproved template names; off-peak offer cites its data; festival prompt only inside 10 days', () => {
    const r = W.reviewRequests([{ state: 'delivered', plate: 'A', ownerPhone: '9876543210' }, { state: 'delivered', plate: 'B' }, { state: 'delivered', plate: 'C', ownerPhone: '9876543211', doNotContact: true }]);
    expect(r.length).toBe(1); expect(r[0].approved).toBe(false); expect(r[0].template).toBe('wash_review_request');
    const o = W.offPeakOffer({ enough: true, slowest: [{ hour: 15, jobs: 2 }], basedOn: 30 }, 400);
    expect(o.reason).toMatch(/only 2 jobs in 30/); expect(o.example).toMatch(/Rs 340/); expect(W.offPeakOffer({ enough: false }, 400)).toBe(null);
    const f = W.festivalPrompts([{ name: 'Diwali', date: '2026-11-20' }, { name: 'Pongal', date: '2027-01-14' }, { name: 'Bad', date: 'x' }], '2026-11-12');
    expect(f.length).toBe(1); expect(f[0].reason).toMatch(/in 8 days/);
  });
});
describe('attendance', () => {
  test('month summary counts by attendant and ignores other months and bad rows', () => {
    const s = W.monthSummary([{ attendantId: 'a', day: '2026-11-01', status: 'present' }, { attendantId: 'a', day: '2026-11-02', status: 'leave' }, { attendantId: 'a', day: '2026-10-31', status: 'present' }, { attendantId: 'b', day: '2026-11-03', status: 'absent' }, { attendantId: 'b', day: '2026-11-04', status: 'sick' }], '2026-11');
    expect(s).toEqual({ a: { present: 1, absent: 0, leave: 1 }, b: { present: 0, absent: 1, leave: 0 } });
  });
});
