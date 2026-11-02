const R = require('../services/marketingIdeasRules');
const st = (o = {}) => ({ activeMembers: 80, expiring7: 2, newMembers7: 5, checkinsThisWeek: 100, checkinsLastWeek: 100, ...o });
const wed = new Date('2026-11-04T06:00:00Z'), sat = new Date('2026-11-07T06:00:00Z');
describe('marketing ideas', () => {
  test('quiet week gives nothing invented', () => { expect(R.buildIdeas(st(), 1000, wed)).toEqual([]); expect(R.buildIdeas(null, null, wed)).toEqual([]); });
  test('few new members -> trial offer; drop in check-ins -> challenge; at most 3, all suggest-level', () => {
    const a = R.buildIdeas(st({ newMembers7: 0, checkinsThisWeek: 50, expiring7: 9 }), 1000, sat);
    expect(a.length).toBe(3); expect(a.map((x) => x.kind)).toEqual(['trial_offer', 'attendance_challenge', 'early_renewal']);
    expect(a.every((x) => x.level === 'suggest' && x.currency === 'INR')).toBe(true);
  });
  test('no plan fee means no rupee figure in the draft', () => { expect(R.buildIdeas(st({ expiring7: 6 }), null, wed)[0].draft).not.toMatch(/Rs/); });
  test('weekend adds the success-story post', () => { expect(R.buildIdeas(st(), 1000, sat).map((x) => x.kind)).toEqual(['weekend_post']); });
  test('Tamil and Hindi drafts when asked; unknown language falls back to English', () => {
    const o = st({ newMembers7: 0 });
    expect(R.buildIdeas(o, 1000, wed, 'ta')[0].draft).toMatch(/[\u0B80-\u0BFF]/); expect(R.buildIdeas(o, 1000, wed, 'hi')[0].draft).toMatch(/[\u0900-\u097F]/);
    expect(R.buildIdeas(o, 1000, wed, 'fr')[0].draft).toMatch(/FREE trial/);
  });
});
