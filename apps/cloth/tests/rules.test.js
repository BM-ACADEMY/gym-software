const { variants: V, gst: G, alterations: A, stockAdvice: SA, followups: F, summary: SM, plans: P } = require('../src');
describe('variants', () => {
  test('grid: sizes x colours, duplicates collapse, keys are stable, bad input refused', () => {
    const r = V.buildGrid({ style: 'SH-101', sizes: ['S', 'M', 'M'], colours: ['Blue', 'Red'], mrp: 799, cost: 400 });
    expect(r.rows.length).toBe(4); expect(r.rows[0].key).toBe('SH-101/S/BLUE'); expect(r.rows[0].currency).toBe('INR'); expect(r.rows[0].qty).toBe(0);
    expect(V.buildGrid({ style: '', sizes: ['S'], colours: ['R'], mrp: 1 }).error).toMatch(/style/);
    expect(V.buildGrid({ style: 'a', sizes: [], colours: ['R'], mrp: 1 }).error).toMatch(/size/);
    expect(V.buildGrid({ style: 'a', sizes: ['S'], colours: ['R'], mrp: 9.5 }).error).toMatch(/MRP/);
    const many = Array.from({ length: 21 }, (_, i) => 'c' + i); expect(V.buildGrid({ style: 'a', sizes: many.slice(0, 10), colours: many, mrp: 5 }).error).toMatch(/200/);
  });
  test('size gaps: sold but zero, only when other sizes still hold stock', () => {
    const vs = [{ style: 'SH-1', size: 'M', colour: 'B', qty: 0 }, { style: 'SH-1', size: 'L', colour: 'B', qty: 6 }, { style: 'SH-2', size: 'M', colour: 'B', qty: 0 }];
    const g = V.sizeGaps(vs, { 'SH-1/M': 5, 'SH-2/M': 4 });
    expect(g).toEqual([{ style: 'SH-1', size: 'M', sold: 5, stockElsewhere: 6 }]);
    expect(V.totalQty(vs)).toBe(6); expect(V.stockValueAtCost([{ qty: 3, cost: 100 }, { qty: -2, cost: 50 }])).toBe(300);
  });
});
describe('gst bands', () => {
  test('default bands from the source, flagged for the CA; edge at 2500; bad bands refused', () => {
    expect(G.DEFAULT_BANDS.needsCaConfirmation).toBe(true);
    expect(G.rateFor(2500)).toBe(5); expect(G.rateFor(2501)).toBe(18); expect(G.rateFor(0)).toBe(5); expect(G.rateFor(10.5)).toBe(null); expect(G.rateFor(-1)).toBe(null);
    expect(G.rateFor(1500, { bands: [{ upTo: 1000, rate: 5 }, { upTo: null, rate: 12 }] })).toBe(12);
    expect(G.rateFor(100, { bands: [{ upTo: 1000, rate: 7 }, { upTo: null, rate: 12 }] })).toBe(null);
    expect(G.validBands([{ upTo: 1000, rate: 5 }])).toBe(false);
    expect(G.validBands([{ upTo: null, rate: 5 }, { upTo: 10, rate: 5 }])).toBe(false);
  });
});
describe('alterations', () => {
  test('validate and status flow', () => {
    expect(A.validate({ what: 'Shorten sleeves', readyOn: '2026-11-15', charge: 150, advance: 50 }, '2026-11-12').value.currency).toBe('INR');
    expect(A.validate({ what: 'x', readyOn: '2026-11-15', charge: 1 }, '2026-11-12').error).toMatch(/what/);
    expect(A.validate({ what: 'Hem', readyOn: '2026-11-01', charge: 1 }, '2026-11-12').error).toMatch(/past/);
    expect(A.validate({ what: 'Hem', readyOn: '2026-11-15', charge: 100, advance: 150 }, '2026-11-12').error).toMatch(/advance/);
    expect(A.canMove('received', 'ready')).toBe(true); expect(A.canMove('delivered', 'ready')).toBe(false); expect(A.canMove('ready', 'in_progress')).toBe(false);
  });
  test('lists: overdue, due today, uncollected with balance', () => {
    const jobs = [{ id: 1, what: 'a', status: 'received', readyOn: '2026-11-09' }, { id: 2, what: 'b', status: 'in_progress', readyOn: '2026-11-12' }, { id: 3, what: 'c', status: 'ready', readyOn: '2026-11-01', readyAt: '2026-11-02', charge: 300, advance: 100 }, { id: 4, what: 'd', status: 'delivered', readyOn: '2026-10-01' }];
    const l = A.lists(jobs, '2026-11-12');
    expect(l.overdue).toEqual([{ id: 1, what: 'a', lateDays: 3 }]); expect(l.dueToday).toEqual([{ id: 2, what: 'b' }]);
    expect(l.notCollected).toEqual([{ id: 3, what: 'c', waitingDays: 10, balance: 200 }]);
  });
});
describe('stock advice', () => {
  const today = '2026-11-12';
  test('slow and dead stock; new arrivals and sold-out styles skipped; biggest money first', () => {
    const st = [{ style: 'A', qty: 10, cost: 300, lastSoldOn: '2026-07-01', addedOn: '2026-03-01' }, { style: 'B', qty: 5, cost: 200, lastSoldOn: '2026-09-01', addedOn: '2026-03-01' }, { style: 'C', qty: 9, cost: 100, lastSoldOn: null, addedOn: '2026-11-01' }, { style: 'D', qty: 0, cost: 100, lastSoldOn: '2026-01-01', addedOn: '2026-01-01' }, { style: 'E', qty: 4, cost: 100, lastSoldOn: '2026-10-30', addedOn: '2026-03-01' }];
    const r = SA.slowMovers(st, today);
    expect(r.map((x) => x.style + x.level)).toEqual(['Adead', 'Bslow']); expect(r[0].tiedUp).toBe(3000);
  });
  test('markdown idea never goes below cost and gives its reason', () => {
    const m = SA.markdownIdea({ level: 'dead', daysSinceSale: 150, tiedUp: 3000 }, { price: 500, cost: 400 });
    expect(m.percent).toBe(30); expect(m.newPrice).toBe(400); expect(m.atCostFloor).toBe(true); expect(m.reason).toMatch(/150 days/);
    expect(SA.markdownIdea({ level: 'slow', daysSinceSale: 70, tiedUp: 1 }, { price: 1000, cost: 100 }).newPrice).toBe(900);
  });
  test('festival forecast: last year window plus growth; null with no data', () => {
    const rows = [{ date: '2025-10-18', qty: 40 }, { date: '2025-10-20', qty: 60 }, { date: '2025-12-01', qty: 99 }];
    const f = SA.festivalForecast(rows, { from: '2025-10-15', to: '2025-10-25', growthPct: 10 });
    expect(f.lastYearUnits).toBe(100); expect(f.forecastUnits).toBe(110); expect(f.reason).toMatch(/100 pieces/);
    expect(SA.festivalForecast([], { from: 'a', to: 'b' })).toBe(null);
  });
});
describe('follow-ups', () => {
  test('lapsed, credit overdue, occasions (incl. year wrap); do-not-contact skipped', () => {
    const cs = [{ id: 1, name: 'A', lastVisit: '2026-07-01', creditDue: 500, creditSince: '2026-09-01' }, { id: 2, name: 'B', lastVisit: '2026-11-01', occasionOn: '11-15' }, { id: 3, name: 'C', lastVisit: '2026-01-01', doNotContact: true }, { id: 4, name: 'D', occasionOn: '01-02' }];
    const l = F.lists(cs, '2026-11-12'); expect(l.lapsed.map((x) => x.id)).toEqual([1]); expect(l.creditOverdue[0].due).toBe(500);
    expect(l.occasions).toEqual([{ id: 2, name: 'B', inDays: 3 }]);
    expect(F.lists([{ id: 5, name: 'E', occasionOn: '01-02' }], '2026-12-29').occasions[0].inDays).toBe(4);
  });
});
describe('daily summary', () => {
  test('three actions at most, most urgent first, each with a reason, mode is suggest', () => {
    const s = SM.build({ today: '2026-11-12', salesYesterday: 12500, billsYesterday: 9,
      alterations: { overdue: [{ id: 1, what: 'Hem', lateDays: 3 }], dueToday: [], notCollected: [{ id: 3 }] },
      followups: { lapsed: [{ daysAway: 100 }], creditOverdue: [{ due: 800 }, { due: 200 }], occasions: [{}] }, slow: [{ tiedUp: 3000 }], gaps: [{ size: 'M', style: 'SH-1', sold: 5, stockElsewhere: 6 }], supplierDue: 5000 });
    expect(s.actions.length).toBe(3); expect(s.actions.map((a) => a.key)).toEqual(['alt_overdue', 'credit', 'slow']);
    expect(s.actions.every((a) => a.reason.length > 5)).toBe(true); expect(s.mode).toBe('suggest'); expect(s.headline).toMatch(/12,500/);
    expect(SM.build({ today: 'x' }).actions).toEqual([]);
  });
});
describe('plans (draft)', () => {
  test('ladder ascending, INR, caps checked', () => {
    expect(P.PLANS.starter.price < P.PLANS.growth.price && P.PLANS.growth.price < P.PLANS.pro.price).toBe(true);
    expect(P.withinCap('starter', 'variantsMax', 499).ok).toBe(true); expect(P.withinCap('starter', 'variantsMax', 500).ok).toBe(false); expect(P.withinCap('x', 'variantsMax', 0).ok).toBe(false);
    expect(P.billingPlans().growth.yearly).toBe(2990);
  });
});
