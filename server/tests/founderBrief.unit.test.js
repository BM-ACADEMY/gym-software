const M = require('module');
const orig = M._load;
M._load = function (r, ...a) {
  if (/models\//.test(r)) return {};
  if (/subscriptionOverview|aiBudget|utils\/email/.test(r)) return {};
  return orig.call(this, r, ...a);
};
const { risks, compose } = require('../services/founderBrief');
M._load = orig;

const base = () => ({
  totalGyms: 5, counts: { trial: 2, active: 3 }, mrr: 4000, payingGyms: 3, newSignups7d: 2,
  collectedMonthTaxable: 3000, collectedMonthPayments: 3, newGyms24h: ['FitZone'], failedPayments24h: 0, openTickets: 0,
  lapsedGyms: 0, trialsEndingSoon: 0, budget: { dailyInr: 500, spentTodayInr: 10, stopped: false }, aiCostMonthInr: 100,
});

describe('founder brief (pure)', () => {
  test('quiet day has no risks', () => { expect(risks(base())).toEqual([]); });
  test('flags failed payments, lapsed gyms and a stopped AI budget', () => {
    const s = { ...base(), failedPayments24h: 2, lapsedGyms: 1, budget: { dailyInr: 500, spentTodayInr: 500, stopped: true } };
    const r = risks(s);
    expect(r.length).toBe(3);
    expect(r.join(' ')).toMatch(/failed subscription payment/);
    expect(r.join(' ')).toMatch(/AI is switched off/);
  });
  test('AI cost above 10% of MRR is flagged', () => {
    expect(risks({ ...base(), aiCostMonthInr: 900 }).join(' ')).toMatch(/more than 10%/);
  });
  test('email has the key numbers and no personal data fields', () => {
    const s = { ...base(), risks: risks(base()) };
    const m = compose(s, new Date('2026-10-29T03:00:00Z'));
    expect(m.subject).toMatch(/Rs 4,000 MRR/);
    expect(m.text).toMatch(/Nothing urgent/);
    expect(m.text).toMatch(/New in the last 24 hours: 1 \(FitZone\)/);
    expect(m.text).not.toMatch(/@/);
  });
});
