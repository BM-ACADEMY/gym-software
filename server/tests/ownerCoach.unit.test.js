const R = require('../services/ownerCoachRules');
const stats = (o = {}) => ({ activeMembers: 80, expiring7: 12, lapsed7: 5, newMembers7: 3, checkinsThisWeek: 100, checkinsLastWeek: 110, duesTotal: 8000, duesCount: 4, collected7: 20000, ...o });
describe('weekly owner coach rules', () => {
  test('week starts on the IST Monday', () => {
    expect(R.weekKey(new Date('2026-11-02T04:00:00Z'))).toBe('2026-11-02'); // Monday morning IST
    expect(R.weekKey(new Date('2026-11-08T18:00:00Z'))).toBe('2026-11-02'); // Sunday 23:30 IST is still the old week
    expect(R.weekKey(new Date('2026-11-08T18:31:00Z'))).toBe('2026-11-09'); // Monday 00:01 IST starts the new one
    expect(R.weekKey(new Date('2026-11-04T10:00:00Z'))).toBe('2026-11-02');
    expect(R.weekStart('2026-11-02').toISOString()).toBe('2026-11-01T18:30:00.000Z');
  });
  test('monthly fee is the median per-30-day price; unusable plans ignored; none gives null', () => {
    expect(R.monthlyFee([{ price: 1000, durationDays: 30 }, { price: 2700, durationDays: 90 }, { price: 9000, durationDays: 365 }])).toBe(900); // 740, 900, 1000 -> median 900
    expect(R.monthlyFee([{ price: 0, durationDays: 30 }, { price: 500, durationDays: 1 }])).toBe(null);
    expect(R.monthlyFee([])).toBe(null); expect(R.monthlyFee(null)).toBe(null);
  });
  test('at most 3 actions, biggest rupees first, whole rupees with a currency code', () => {
    const a = R.buildActions(stats({ checkinsThisWeek: 50 }), 1000);
    expect(a.length).toBe(3); expect(a.map((x) => x.kind)).toEqual(['renew', 'dues', 'lapsed']); // 12000, 8000, 5000
    expect(a[0].rupees).toBe(12000); expect(a.every((x) => x.currency === 'INR' && Number.isInteger(x.rupees))).toBe(true);
    expect(a[0].text).toMatch(/Up to Rs 12,000 a month is at stake/);
  });
  test('without a usable plan the actions still work but show no invented rupees', () => {
    const a = R.buildActions(stats({ duesTotal: 0, duesCount: 0 }), null);
    expect(a.map((x) => x.kind)).toEqual(['renew', 'lapsed']); expect(a.every((x) => x.rupees === null)).toBe(true); expect(a[0].text).not.toMatch(/Rs/);
  });
  test('quiet week gives one friendly note; an attendance drop is listed without rupees', () => {
    const q = R.buildActions(stats({ expiring7: 0, lapsed7: 0, duesTotal: 0, duesCount: 0 }), 1000); expect(q.length).toBe(1); expect(q[0].kind).toBe('info');
    const d = R.buildActions(stats({ expiring7: 0, lapsed7: 0, duesTotal: 0, duesCount: 0, checkinsThisWeek: 50 }), 1000); expect(d[0].kind).toBe('absent'); expect(d[0].rupees).toBe(null);
  });
  test('progress: done when at least half contacted, started with one, open with none; info stays info', () => {
    const acts = R.buildActions(stats(), 1000);
    const p = R.progress(acts, { renew: 6, dues: 1 });
    expect(p.find((x) => x.kind === 'renew').status).toBe('done'); expect(p.find((x) => x.kind === 'dues').status).toBe('started'); expect(p.find((x) => x.kind === 'lapsed').status).toBe('open');
    expect(R.progress(R.buildActions(stats({ expiring7: 0, lapsed7: 0, duesTotal: 0, duesCount: 0 }), 1000), {})[0].status).toBe('info');
    expect(R.progress(acts, {}).every((x) => x.status === 'open')).toBe(true);
  });
  test('no names or phones anywhere in the output', () => {
    expect(JSON.stringify(R.buildActions(stats(), 1000))).not.toMatch(/\d{10}|phone|name/i);
  });
});
