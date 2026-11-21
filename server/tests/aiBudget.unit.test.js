const aiBudget = require('../services/aiBudget');

describe('aiBudget cost (pure)', () => {
  test('nano call with 1000 in and 150 out tokens is a few paise', () => {
    const c = aiBudget.costInr('gpt-5.4-nano', 1000, 150);
    expect(c).toBeGreaterThan(0.02);
    expect(c).toBeLessThan(0.1);
  });
  test('mini costs more than nano for the same tokens', () => {
    expect(aiBudget.costInr('gpt-5.4-mini', 1000, 150)).toBeGreaterThan(aiBudget.costInr('gpt-5.4-nano', 1000, 150));
  });
  test('unknown model is priced on the safe (high) side', () => {
    expect(aiBudget.costInr('some-new-model', 1000, 150)).toBeGreaterThanOrEqual(aiBudget.costInr('gpt-5.4-mini', 1000, 150));
  });
  test('zero tokens cost nothing', () => {
    expect(aiBudget.costInr('gpt-5.4-nano', 0, 0)).toBe(0);
  });
});
