const { createGuard, memoryStore, cacheKey, ipKey, FALLBACK_TEXT } = require('../src');
const now = () => new Date('2026-11-02T04:30:00Z');
const parts = (answer) => ({ assessmentId: 'a1', questionId: 'q1', answer });
describe('AI guard for public sites', () => {
  test('signed-out visitors get no AI', async () => { const g = createGuard({ store: memoryStore(), now }); const d = await g.check({ ip: '1.2.3.4' }); expect(d.allow).toBe(false); expect(d.reason).toBe('not_signed_in'); });
  test('per-user daily limit of 3, then a friendly message; next day resets', async () => {
    const store = memoryStore(); let t = now(); const g = createGuard({ store, now: () => t });
    for (let i = 0; i < 3; i++) { const d = await g.check({ userId: 'u1', ip: '1.1.1.1', cacheParts: parts('answer ' + i) }); expect(d.allow).toBe(true); await g.record(d, { value: 'fb' + i }); }
    const no = await g.check({ userId: 'u1', ip: '1.1.1.1', cacheParts: parts('new answer') }); expect(no.allow).toBe(false); expect(no.reason).toBe('user_limit'); expect(no.message).toBe(FALLBACK_TEXT.user_limit);
    t = new Date(t.getTime() + 86400000); expect((await g.check({ userId: 'u1', ip: '1.1.1.1', cacheParts: parts('new answer') })).allow).toBe(true);
  });
  test('per-IP limit across different users; raw IP never stored', async () => {
    const store = memoryStore(); const g = createGuard({ store, now, limits: { perIpPerDay: 2 } });
    for (const u of ['a', 'b']) { const d = await g.check({ userId: u, ip: '9.9.9.9' }); expect(d.allow).toBe(true); await g.record(d); }
    expect((await g.check({ userId: 'c', ip: '9.9.9.9' })).reason).toBe('ip_limit');
    expect([...store.counts.keys()].some((k) => k.includes('9.9.9.9'))).toBe(false); expect(ipKey('9.9.9.9').length).toBe(24);
  });
  test('same answer is served from cache: free, and does not use up the limit', async () => {
    const store = memoryStore(); const g = createGuard({ store, now, limits: { perUserPerDay: 1 } });
    const d = await g.check({ userId: 'u1', ip: 'x', cacheParts: parts('Photosynthesis makes food.') }); await g.record(d, { value: 'Good answer.' });
    const hit = await g.check({ userId: 'u2', ip: 'y', cacheParts: parts('  photosynthesis MAKES food ') }); expect(hit.cached).toBe(true); expect(hit.value).toBe('Good answer.');
    expect(cacheKey({ ...parts('a'), version: 'v1' }) === cacheKey({ ...parts('a'), version: 'v2' })).toBe(false);
  });
  test('money stop: no AI once the day budget is reached, even for a fresh user', async () => {
    const store = memoryStore({ budgetInr: 10, costInr: 10 }); const g = createGuard({ store, now });
    const d = await g.check({ userId: 'u1', ip: 'x' }); expect(d.allow).toBe(false); expect(d.reason).toBe('budget'); expect(d.message).toMatch(/score is saved/);
  });
  test('a cached answer is still served when the budget is stopped', async () => {
    const store = memoryStore({ budgetInr: 10, costInr: 10 }); const g = createGuard({ store, now });
    await store.cacheSet(cacheKey(parts('hello')), 'cached feedback'); const d = await g.check({ userId: 'u1', ip: 'x', cacheParts: parts('hello') }); expect(d.cached).toBe(true);
  });
});
