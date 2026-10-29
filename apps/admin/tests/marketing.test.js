const M = require('../src/marketing');
const now = new Date('2026-11-02T04:30:00Z'); // 10:00 IST
const iso = (n) => new Date(now.getTime() + n * 86400000).toISOString();
describe('marketing items', () => {
  test('validation', () => {
    expect(M.validateItem({ title: 'Post a Hire video', reason: 'new product' }).owner).toBe('dm_team');
    for (const [bad, code] of [[{ title: 'x', reason: 'r' }, 'ITEM_TITLE'], [{ title: 'Long enough', reason: '' }, 'ITEM_REASON'], [{ title: 'Long enough', reason: 'r', channel: 'tiktok' }, 'ITEM_CHANNEL'], [{ title: 'Long enough', reason: 'r', due: 'nope' }, 'ITEM_DUE']]) {
      let c; try { M.validateItem(bad); } catch (e) { c = e.code; } expect(c).toBe(code);
    }
  });
  test('status moves, snooze and wake', () => {
    const it = M.validateItem({ title: 'Post a Hire video', reason: 'r' });
    expect(() => M.move(it, 'done')).toThrow(); const a = M.move(it, 'approved', { now, by: 'k' }); expect(M.move(a, 'done').status).toBe('done');
    const s = M.move(it, 'snoozed', { now, snoozeDays: 2 }); expect(M.wake([s], now)[0].status).toBe('snoozed'); expect(M.wake([s], new Date(now.getTime() + 3 * 86400000))[0].status).toBe('suggested');
    expect(() => M.move(M.move(a, 'done'), 'approved')).toThrow();
  });
});
describe('suggestions', () => {
  const facts = { products: [{ product: 'hire', state: 'live', businesses: { total: 5, paying: 1, trial: 4, grace: 0, expired: 2 }, endingSoon: [{ kind: 'trial', daysLeft: 2 }, { kind: 'trial', daysLeft: 9 }], signups7d: 0, targetDate: iso(10) }], totals: { aiCostTodayInr: 90, aiBudgetInr: 100 } };
  const cal = [{ id: 'diwali', name: 'Diwali', date: iso(4) }, { id: 'far', name: 'Far event', date: iso(60) }];
  test('rules fire and carry reasons; far events ignored', () => {
    const s = M.suggest(facts, cal, now); const keys = s.map((x) => x.key.split(':')[0]);
    ['trial_ending', 'winback', 'no_signups', 'launch', 'event', 'ai_budget'].forEach((k) => expect(keys.includes(k)).toBe(true));
    expect(s.filter((x) => x.key.startsWith('event')).length).toBe(1); expect(s.every((x) => x.reason.length > 0 && x.status === 'suggested')).toBe(true);
    expect(s.find((x) => x.key.startsWith('trial_ending')).title).toMatch(/1 hire trial ending within 3 days/);
  });
  test('rerun adds nothing new; nothing happens with no facts', () => {
    const s = M.suggest(facts, cal, now); expect(M.newOnly(s, s.map((x) => x.key)).length).toBe(0); expect(M.newOnly(s, []).length).toBe(s.length);
    expect(M.suggest({ products: [] }, [], now).length).toBe(0); expect(M.suggest(null, null, now).length).toBe(0);
  });
  test('suggestions hold no personal data fields', () => { expect(Object.keys(M.suggest(facts, cal, now)[0]).join()).not.toMatch(/phone|email|name/); });
});
describe('today brief and push', () => {
  const items = M.suggest({ products: [{ product: 'hire', state: 'live', businesses: { expired: 1 }, endingSoon: [{ kind: 'trial', daysLeft: 1 }], signups7d: 0 }], totals: { aiCostTodayInr: 90, aiBudgetInr: 100 } }, [{ id: 'a', name: 'A', date: iso(1) }, { id: 'b', name: 'B', date: iso(3) }], now);
  test('brief is at most 5, most urgent first', () => { const b = M.todayBrief(items, now); expect(b.length).toBe(5); expect(b[0].priority).toBe('decision_today'); expect(M.todayBrief(items, now, 2).length).toBe(2); });
  test('push: only decisions today, not in quiet hours, max 3 a day', () => {
    expect(M.pushPlan(items, { now }).send.length).toBe(3); expect(M.pushPlan(items, { now, sentToday: 3 }).reason).toBe('daily_limit');
    const night = new Date('2026-11-02T17:00:00Z'); // 22:30 IST
    expect(M.pushPlan(items, { now: night }).reason).toBe('quiet_hours'); expect(M.pushPlan(items, { now: night }).send.length).toBe(0);
    expect(M.pushPlan(items, { now }).send.every((i) => i.priority === 'decision_today')).toBe(true);
  });
});
