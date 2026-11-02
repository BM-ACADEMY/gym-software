const { view, counts, MAX_ROWS } = require('../src/accountsView');
const { createAccountsRouter } = require('../src/accountsRoutes');
const now = new Date('2026-11-04T04:30:00Z');
const A = (o) => ({ product: 'fit', businessName: 'Iron House', ownerName: 'Ravi', ownerPhone: '9876543210', ownerEmail: 'r@example.com', contactConsent: true, createdAt: '2026-01-01', lastActiveAt: '2026-11-03', status: { status: 'active', daysLeft: 200, endsAt: '2027-05-20' }, ...o });
const accounts = [A({}), A({ businessName: 'Soon Gym', status: { status: 'active', daysLeft: 5 } }), A({ businessName: 'Gone Gym', status: { status: 'expired', daysLeft: -3 }, contactConsent: false }), A({ product: 'hire', businessName: 'Trial Agency', status: { status: 'trial', daysLeft: 2 } })];
describe('account pages', () => {
  test('renewals list keeps only accounts needing action, most urgent first; all-accounts keeps everyone', () => {
    const r = view(accounts, { now, only: 'renewals' });
    expect(r.rows.map((x) => x.business)).toEqual(['Gone Gym', 'Soon Gym', 'Trial Agency'].sort((a, b) => ['Gone Gym', 'Soon Gym', 'Trial Agency'].indexOf(a) - ['Gone Gym', 'Soon Gym', 'Trial Agency'].indexOf(b)));
    expect(r.rows[0].stage).toBe('Expired or in grace');
    expect(view(accounts, { now }).total).toBe(4);
    expect(view(accounts, { now, product: 'HIRE' }).rows.length).toBe(1);
  });
  test('no phone or email ever appears in the rows', () => {
    const txt = JSON.stringify(view(accounts, { now }));
    expect(/9876543210|r@example|phone|email/i.test(txt)).toBe(false);
    expect(view(accounts, { now }).rows.find((x) => x.business === 'Gone Gym').canContact).toBe('no');
  });
  test('row cap and empty input', () => {
    const many = Array.from({ length: MAX_ROWS + 5 }, () => A({}));
    const r = view(many, { now }); expect(r.rows.length).toBe(MAX_ROWS); expect(r.truncated).toBe(true);
    expect(view(null, { now }).rows).toEqual([]);
  });
  test('counts are numbers only', () => {
    const c = counts(accounts, { now }); expect(c.total).toBe(4); expect(c.canContact).toBe(3); expect(c.byStatus.active).toBe(2);
  });
});
describe('account routes', () => {
  function setup() {
    const routes = {}; const router = { use: (...m) => { routes.USE = m; }, get: (p, h) => (routes['GET ' + p] = h) }; const audits = [];
    createAccountsRouter({ express: { Router: () => router }, protect: 'P', authorize: (...r) => 'AUTH:' + r.join(), getAccounts: async () => ({ accounts, failed: ['mart'] }), audit: (a) => audits.push(a), now: () => now });
    const call = async (key, query = {}) => { const out = { h: {} }; const res = { set(k, v) { out.h[k] = v; }, status(c) { out.c = c; return this; }, json(b) { out.b = b; } }; await routes[key]({ user: { id: 'u1' }, query }, res); return out; };
    return { routes, call, audits };
  }
  test('owner-only guard, data is an array, no caching, audited, failed products named', async () => {
    const s = setup(); expect(s.routes.USE).toEqual(['P', 'AUTH:root_admin']);
    const r = await s.call('GET /renewals'); expect(Array.isArray(r.b.data)).toBe(true); expect(r.b.data.length).toBe(3); expect(r.h['Cache-Control']).toBe('no-store');
    expect(r.b.productsUnavailable).toEqual(['mart']); expect(s.audits[0].action).toBe('accounts.renewals');
    expect((await s.call('GET /list', { product: 'fit' })).b.data.length).toBe(3);
    expect((await s.call('GET /counts')).b.data.total).toBe(4);
  });
});
