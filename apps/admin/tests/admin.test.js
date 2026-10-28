const A = require('../src');
const gym = (o = {}) => ({ schema: 1, product: 'gym', at: 'x', businesses: { total: 12, trial: 5, paying: 7, grace: 0, expired: 0, suspended: 0, signups7d: 2 }, mrr: 6993, collectedThisMonth: 8000, endingSoon: [{ name: 'Pulse Gym', kind: 'trial', daysLeft: 1, phone: '9876543210' }], renewalsDue: [], ai: { callsToday: 38, costTodayInr: 41.5, budgetInr: 500, stopped: false }, whatsappSentToday: 310, openTickets: 2, evil: '<script>', ...o });
const now = new Date('2026-10-30T10:00:00Z'); const fresh = '2026-10-30T09:59:00Z';
describe('aggregate', () => {
  test('combines two products and drops unknown fields', () => {
    const hire = { ...gym(), product: 'hire', businesses: { total: 4, trial: 3, paying: 1 }, mrr: 1999, openTickets: 1, endingSoon: [] };
    const out = A.combine([{ product: 'gym', ok: true, summary: gym(), fetchedAt: fresh }, { product: 'hire', ok: true, summary: hire, fetchedAt: fresh }], now);
    expect(out.totals.businesses).toBe(16); expect(out.totals.mrr).toBe(8992); expect(out.totals.openTickets).toBe(3); expect(out.totals.aiBudgetInr).toBe(1000);
    const s = JSON.stringify(out); expect(s).not.toMatch(/9876543210|<script>|evil/);
    expect(out.attention.some((a) => /Pulse Gym/.test(a.text))).toBe(true);
  });
  test('one bad or unreachable product does not break the rest', () => {
    const out = A.combine([{ product: 'gym', ok: true, summary: gym(), fetchedAt: fresh }, { product: 'hire', ok: false, error: 'timed out' }, { product: 'mart', ok: true, summary: { schema: 2 }, fetchedAt: fresh }], now);
    expect(out.totals.businesses).toBe(12); expect(out.products.map((p) => p.state)).toEqual(['ok', 'unreachable', 'bad_reply']);
    expect(out.attention.filter((a) => a.level === 'error')).toHaveLength(2);
  });
  test('a summary claiming to be another product is refused; old data is stale; stopped AI is an alert', () => {
    expect(() => A.cleanSummary(gym(), 'hire')).toThrow();
    const out = A.combine([{ product: 'gym', ok: true, summary: gym({ ai: { callsToday: 1, costTodayInr: 500, budgetInr: 500, stopped: true } }), fetchedAt: '2026-10-30T08:00:00Z' }], now);
    expect(out.products[0].state).toBe('stale'); expect(out.attention.some((a) => /switched off/.test(a.text))).toBe(true);
  });
  test('numbers are clamped', () => { expect(A.cleanSummary(gym({ mrr: -5, openTickets: 'abc' }), 'gym').mrr).toBe(0); });
});
describe('collect', () => {
  test('config needs https and a long key; names are checked', () => {
    const c = A.readConfig({ ADMIN_PRODUCTS: 'gym, hire,BAD NAME', ADMIN_URL_GYM: 'https://fit.afraventures.in', ADMIN_KEY_GYM: 'k'.repeat(32), ADMIN_URL_HIRE: 'http://evil.example', ADMIN_KEY_HIRE: 'short' });
    expect(c).toHaveLength(2); expect(c[0].url).toBe('https://fit.afraventures.in'); expect(c[1].url).toBeNull(); expect(c[1].key).toBeNull();
  });
  test('sends the key in a header, never fails loudly, never leaks it', async () => {
    let seen; const ok = await A.collectOne({ product: 'gym', url: 'https://fit.afraventures.in', key: 'k'.repeat(32) }, { fetchImpl: async (u, o) => { seen = [u, o.headers]; return { ok: true, json: async () => ({ data: gym() }) }; }, now: () => now });
    expect(seen[0]).toBe('https://fit.afraventures.in/api/internal/admin-summary'); expect(seen[1]['x-internal-key']).toBe('k'.repeat(32)); expect(ok.ok).toBe(true);
    const bad = await A.collectOne({ product: 'gym', url: 'https://fit.afraventures.in', key: 'k'.repeat(32) }, { fetchImpl: async () => { throw new Error('connect to https://fit.afraventures.in with key kkkk failed'); } });
    expect(bad.ok).toBe(false); expect(JSON.stringify(bad)).not.toMatch(/kkkk|afraventures/);
    expect((await A.collectOne({ product: 'x', url: null, key: null })).error).toBe('not configured');
    expect((await A.collectOne({ product: 'gym', url: 'https://a.b', key: 'k'.repeat(32) }, { fetchImpl: async () => ({ ok: false, status: 401 }) })).error).toBe('HTTP 401');
  });
});
