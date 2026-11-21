const K = require('../services/churnRules');
const now = new Date('2026-11-10T06:00:00Z'); const d = (n) => new Date(now.getTime() + n * 86400000);
describe('churn risk', () => {
  test('lapsed or unknown expiry members are not scored here', () => {
    expect(K.risk({ expiresAt: d(-1), absentDays: 40 }, now)).toBe(null); expect(K.risk({}, now)).toBe(null);
  });
  test('a regular who stopped coming is high risk with reasons', () => {
    const r = K.risk({ expiresAt: d(10), createdAt: d(-200), absentDays: 16, att14: 0, attPrior: 8 }, now);
    expect(r.level).toBe('high'); expect(r.reasons.join(' ')).toMatch(/No visits in the last two weeks/); expect(r.reasons.join(' ')).toMatch(/16 days/); expect(r.score <= 100).toBe(true);
  });
  test('one weak signal alone is not enough; a healthy member gives null', () => {
    expect(K.risk({ expiresAt: d(10), createdAt: d(-200), absentDays: 2, att14: 6, attPrior: 6 }, now)).toBe(null);
    expect(K.risk({ expiresAt: d(5), createdAt: d(-200), att14: 6, attPrior: 6 }, now)).toBe(null); // ends soon, still visiting: 15 only
  });
  test('new member with no routine and dues is flagged medium or high', () => {
    const r = K.risk({ expiresAt: d(20), createdAt: d(-20), att14: 1, attPrior: 0, balance: 500, overdueDays: 6 }, now);
    expect(r && ['medium', 'high'].includes(r.level)).toBe(true); expect(r.reasons.join(' ')).toMatch(/New member/); expect(r.reasons.join(' ')).toMatch(/Rs 500/);
  });
  test('reasons carry no names or phones', () => { expect(JSON.stringify(K.risk({ expiresAt: d(10), createdAt: d(-200), absentDays: 16, att14: 0, attPrior: 8 }, now))).not.toMatch(/\d{10}/); });
});
describe('win-back sequence', () => {
  test('steps come due on days 1, 5 and 14 and stop after 30', () => {
    expect(K.winBackDue(0)).toBe(null); expect(K.winBackDue(1)).toEqual({ step: 1, days: 1 }); expect(K.winBackDue(4)).toEqual({ step: 1, days: 4 });
    expect(K.winBackDue(5)).toEqual({ step: 2, days: 5 }); expect(K.winBackDue(14)).toEqual({ step: 3, days: 14 }); expect(K.winBackDue(31)).toBe(null); expect(K.winBackDue(NaN)).toBe(null);
  });
  test('a step already done is not shown again, and a missed older step is skipped not stacked', () => {
    expect(K.winBackDue(6, [1])).toEqual({ step: 2, days: 6 }); expect(K.winBackDue(6, [1, 2])).toBe(null);
    expect(K.winBackDue(20, [])).toEqual({ step: 3, days: 20 }); expect(K.winBackDue(20, [3])).toBe(null);
  });
  test('English has three different messages; Tamil and Hindi reuse the reviewed lapsed wording', () => {
    expect(new Set([1, 2, 3].map((s) => K.winBackTemplate(s, 'en', 'x'))).size).toBe(3);
    expect(K.winBackTemplate(2, 'ta', 'TA-LAPSED')).toBe('TA-LAPSED');
    for (const s of [1, 2, 3]) expect(/https?:\/\//.test(K.WINBACK_TEXT[s])).toBe(false);
  });
});
