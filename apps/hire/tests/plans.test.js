const { PLANS, checkCap } = require('../src/plans');
describe('Hire plans after the 2 Nov decisions', () => {
  test('no plan includes outreach (prepaid packs only); sending is refused at the cap', () => {
    for (const k of Object.keys(PLANS)) { expect(PLANS[k].outreachPerMonth).toBe(0); expect(checkCap(k, 'outreach', 0).ok).toBe(false); }
  });
  test('Pro reads 1,000 resumes a month; other caps unchanged', () => {
    expect(PLANS.pro.parsesPerMonth).toBe(1000); expect(PLANS.starter.parsesPerMonth).toBe(150); expect(PLANS.growth.parsesPerMonth).toBe(600);
    expect(checkCap('pro', 'parse', 999).ok).toBe(true); expect(checkCap('pro', 'parse', 1000).ok).toBe(false);
  });
});
