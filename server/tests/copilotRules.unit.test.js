// Pure tests for the Renewal Copilot rules: no database, no network.
const C = require('../services/copilotRules');

const now = new Date('2026-10-28T10:00:00Z');
const d = (n) => new Date(now.getTime() + n * C.DAY);

describe('copilotRules.assess', () => {
  test('a membership ending in 2 days with falling visits is a strong renew case with two reasons', () => {
    const a = C.assess({ expiresAt: d(2), att14: 1, attPrior: 6, balance: 0, overdueDays: 0 }, now);
    expect(a.kind).toBe('renew');
    expect(a.score).toBeGreaterThanOrEqual(80);
    expect(a.reasons).toHaveLength(2);
  });
  test('recently ended membership is lapsed and earlier is stronger than later', () => {
    const early = C.assess({ expiresAt: d(-2) }, now);
    const late = C.assess({ expiresAt: d(-20) }, now);
    expect(early.kind).toBe('lapsed');
    expect(early.score).toBeGreaterThan(late.score);
    expect(C.assess({ expiresAt: d(-40) }, now)).toBeNull();
  });
  test('overdue dues beat nothing; no dues and no other reason gives null', () => {
    const a = C.assess({ expiresAt: d(60), balance: 500, overdueDays: 10 }, now);
    expect(a.kind).toBe('dues');
    expect(a.params.amount).toBe(500);
    expect(C.assess({ expiresAt: d(60), balance: 0, absentDays: 5 }, now)).toBeNull();
  });
  test('absent 10+ days is listed; extra reasons raise the score', () => {
    expect(C.assess({ expiresAt: d(60), absentDays: 20 }, now).kind).toBe('absent');
    const many = C.assess({ expiresAt: d(3), balance: 900, overdueDays: 12, absentDays: 15 }, now);
    const one = C.assess({ expiresAt: d(3) }, now);
    expect(many.score).toBeGreaterThan(one.score);
  });
});

describe('copilotRules messages and links', () => {
  test('every language has all four messages with name and gym placeholders', () => {
    for (const l of ['en', 'ta', 'hi']) for (const k of C.KINDS) {
      const t = C.template(l, k);
      expect(t).toContain('{name}');
      expect(t).toContain('{gym}');
    }
  });
  test('fill replaces placeholders and leaves unknown braces alone', () => {
    expect(C.fill('Hi {name} at {gym} {x}', { name: 'Ravi', gym: 'FitZone' })).toBe('Hi Ravi at FitZone {x}');
  });
  test('wa.me number: Indian 10-digit gets 91, bad numbers give null', () => {
    expect(C.waNumber('98765 43210')).toBe('919876543210');
    expect(C.waNumber('09876543210')).toBe('919876543210');
    expect(C.waNumber('123')).toBeNull();
    expect(C.waNumber('+1 415 555 0123', 'US')).toBe('14155550123');
    expect(C.waLink('919876543210', 'a b')).toBe('https://wa.me/919876543210?text=a%20b');
    expect(C.waLink(null, 'x')).toBeNull();
  });
  test('an AI rewrite is accepted only when placeholders are identical and there is no link', () => {
    const o = C.template('en', 'renew');
    expect(C.polishValid(o, 'Hello {name}! Your {gym} plan ends in {days} days. Renew today and keep going strong.')).toBe(true);
    expect(C.polishValid(o, 'Hello {name}! Your plan ends in {days} days. Renew today and keep going strong.')).toBe(false);
    expect(C.polishValid(o, 'Hello {name}! {gym} ends in {days} days. See https://x.com for more details please.')).toBe(false);
    expect(C.polishValid(o, 'short')).toBe(false);
  });
});
