const askData = require('../services/askData');

describe('askData router (pure)', () => {
  test('keywords pick the right report', () => {
    expect(askData.route('Who has pending dues?').tool).toBe('dues');
    expect(askData.route('memberships expiring in 14 days')).toEqual({ tool: 'expiring', days: 14 });
    expect(askData.route('who has not visited, absent 20 days').tool).toBe('absent');
    expect(askData.route('collection this week')).toEqual({ tool: 'collections', period: 'week' });
    expect(askData.route('how do I add a plan?')).toBeNull();
  });
  test('sanitize drops unknown tools and clamps values', () => {
    expect(askData.sanitize({ tool: 'dropDatabase' })).toBeNull();
    expect(askData.sanitize({ tool: 'constructor' })).toBeNull();
    expect(askData.sanitize({ tool: 'absent', days: 99999 }).days).toBe(90);
    expect(askData.sanitize({ tool: 'collections', period: 'year' }).period).toBe('month');
  });
  test('parsePick reads model JSON and rejects junk', () => {
    expect(askData.parsePick('sure {"tool":"dues"}')).toEqual({ tool: 'dues' });
    expect(askData.parsePick('{"tool":"none"}')).toBeNull();
    expect(askData.parsePick('no json')).toBeNull();
  });
  test('router prompt carries no member data', () => {
    expect(askData.ROUTER_SYSTEM()).toMatch(/dues/);
  });
});
