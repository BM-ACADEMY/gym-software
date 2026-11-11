const { summarize } = require('../src/summary');
const base = { today: '2026-11-12', nowIso: '2026-11-12T16:00:00Z', open: 540, close: 1260 };
describe('owner daily summary', () => {
  test('facts add up: revenue by payment method, pass washes counted separately, ranking', () => {
    const jobs = [
      { state: 'delivered', total: 400, klass: 'sedan', attendantId: 'a', payments: [{ method: 'cash', amount: 400 }] },
      { state: 'delivered', total: 300, klass: 'sedan', attendantId: 'a', payments: [{ method: 'upi', amount: 300 }] },
      { state: 'delivered', total: 200, klass: 'bike', attendantId: 'b', passId: 'p1', payments: [] },
      { state: 'washing', total: 500, klass: 'suv' },
    ];
    const s = summarize({ ...base, jobs, bayJobs: [[{ start: 540, end: 1260 }]] });
    expect(s.facts.revenue).toBe(900); expect(s.facts.jobsDelivered).toBe(3); expect(s.facts.jobsOpen).toBe(1);
    expect(s.facts.pay).toEqual({ cash: 400, upi: 300, card: 0, pass: 200 });
    expect(s.facts.idleMinutes).toBe(0); expect(s.facts.ranking[0].id).toBe('a'); expect(s.autoSend).toBe(false);
  });
  test('at most three actions, each with a reason; money problems come first', () => {
    const vehicles = [{ plate: 'A1', ownerName: 'x', lastWash: '2026-08-01' }, { plate: 'B2', ownerName: 'y', lastWash: '2026-10-01' }];
    const jobs = [{ state: 'ready', plate: 'Z9', total: 300, readyAt: '2026-11-12T10:00:00Z' }, { state: 'delivered', plate: 'U1', total: 400, payments: [{ method: 'cash', amount: 100 }] }];
    const s = summarize({ ...base, jobs, vehicles, closing: { flag: true, diff: -150 }, passes: [{ plate: 'A1', washes: 4, used: 3, startsOn: '2026-11-01', endsOn: '2026-11-30', price: 999 }] });
    expect(s.actions.length).toBe(3);
    expect(s.actions.every((a) => a.reason && a.text)).toBe(true);
    expect(s.actions.map((a) => a.key).sort()).toEqual(['cash', 'pickup', 'unpaid']);
    const un = s.actions.find((a) => a.key === 'unpaid'); expect(un.rupees).toBe(300);
    expect(s.actions.find((a) => a.key === 'cash').reason).toMatch(/Rs 150 short/);
  });
  test('quiet day: only soft actions; empty day gives an idle-hours offer', () => {
    const s = summarize({ ...base, jobs: [], vehicles: [{ plate: 'A1', ownerName: 'x', lastWash: '2026-08-01' }], bayCount: 2 });
    expect(s.facts.idleMinutes).toBe(1440);
    expect(s.actions.map((a) => a.key)).toEqual(['due', 'lapsed', 'idle']);
    expect(summarize({ ...base }).actions.map((a) => a.key)).toEqual(['idle']);
  });
});
