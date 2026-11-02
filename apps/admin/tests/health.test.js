const H = require('../src/health');
const { createHealthRouter } = require('../src/healthRoutes');
const now = new Date('2026-11-20T06:00:00Z'); const d = (n) => new Date(now.getTime() + n * 86400000);
const A = (o = {}) => ({ product: 'fit', businessName: 'Iron House', ownerName: 'Ravi', ownerPhone: '9876543210', ownerEmail: 'r@x.com', createdAt: d(-40), lastActiveAt: d(-1), status: { status: 'active', daysLeft: 100 }, usage: { members: 80, checkins14: 300 }, ...o });
describe('gym health score', () => {
  test('a busy gym is healthy with no nudge', () => { const r = H.score(A(), now); expect(r.level).toBe('healthy'); expect(r.score).toBe(100); expect(r.nudge).toBe(null); });
  test('expired and suspended are "lost" and not scored; very new gyms are "new" with no score', () => {
    expect(H.score(A({ status: { status: 'expired' } }), now).level).toBe('lost'); expect(H.score(A({ status: { status: 'suspended' } }), now).reasons[0]).toMatch(/suspended/);
    const n = H.score(A({ createdAt: d(-1), usage: { members: 0, checkins14: 0 } }), now); expect(n.level).toBe('new'); expect(n.score).toBe(null);
  });
  test('no members and an owner who never signed in is at risk, with a practical nudge', () => {
    const r = H.score(A({ lastActiveAt: null, usage: { members: 0, checkins14: 0 }, status: { status: 'trial', daysLeft: 2 } }), now);
    expect(r.level).toBe('at_risk'); expect(r.reasons.join(' ')).toMatch(/No members added/); expect(r.reasons.join(' ')).toMatch(/Trial ends in 2 days/); expect(r.nudge.length > 10).toBe(true);
  });
  test('members but no check-ins, and a long-silent owner, goes to watch or at risk', () => {
    const r = H.score(A({ lastActiveAt: d(-20), usage: { members: 30, checkins14: 0 } }), now);
    expect(['watch', 'at_risk'].includes(r.level)).toBe(true); expect(r.reasons.join(' ')).toMatch(/No check-ins/); expect(r.reasons.join(' ')).toMatch(/20 days/);
  });
  test('grace period lowers the score; one small problem stays healthy', () => {
    expect(H.score(A({ status: { status: 'grace', daysLeft: 0 } }), now).reasons.join(' ')).toMatch(/grace/);
    expect(H.score(A({ lastActiveAt: d(-9) }), now).level).toBe('healthy');
  });
  test('list is worst first, has no phone or email, and filters by product', () => {
    const rows = H.view([A({ businessName: 'Good' }), A({ businessName: 'Bad', lastActiveAt: null, usage: { members: 0, checkins14: 0 } }), A({ product: 'hire', businessName: 'Agency' })], { now });
    expect(rows[0].business).toBe('Bad'); expect(JSON.stringify(rows)).not.toMatch(/9876543210|r@x\.com|phone|email/i);
    expect(H.view([A(), A({ product: 'hire' })], { now, product: 'HIRE' }).length).toBe(1);
    expect(H.counts(rows).healthy).toBe(2);
  });
});
describe('health routes', () => {
  function setup() {
    const routes = {}; const router = { use: (...m) => { routes.USE = m; }, get: (p, h) => (routes[p] = h) }; const audits = [];
    createHealthRouter({ express: { Router: () => router }, protect: 'P', authorize: (...r) => 'AUTH:' + r.join(), getAccounts: async () => ({ accounts: [A(), A({ lastActiveAt: null, usage: { members: 0, checkins14: 0 } })], failed: ['mart'] }), audit: (a) => audits.push(a), now: () => now });
    const call = async (p, query = {}) => { const out = { h: {} }; const res = { set(k, v) { out.h[k] = v; }, status(c) { out.c = c; return this; }, json(b) { out.b = b; } }; await routes[p]({ user: { id: 'u' }, query }, res); return out; };
    return { routes, call, audits };
  }
  test('owner only, no cache, audited, array data, failed products named', async () => {
    const s = setup(); expect(s.routes.USE).toEqual(['P', 'AUTH:root_admin']);
    const r = await s.call('/list'); expect(Array.isArray(r.b.data)).toBe(true); expect(r.b.data.length).toBe(2); expect(r.h['Cache-Control']).toBe('no-store'); expect(r.b.productsUnavailable).toEqual(['mart']); expect(s.audits[0].action).toBe('health.list');
    expect((await s.call('/counts')).b.data.at_risk).toBe(1);
  });
});
