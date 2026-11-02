const W = require('../src/aiWording');
const { createMarketingRouter } = require('../src/marketingRoutes');
const rule = (n, o = {}) => ({ id: 'r' + n, source: 'rule', status: 'suggested', title: `2 hire trials ending within 3 days: send the contact list to the sales team (${n})`, reason: '2 businesses on a hire trial have 3 days or less left (count from the product, no names here).', ...o });
const reply = (items) => ({ text: JSON.stringify({ items }), usage: { inTokens: 300, outTokens: 100 }, model: 'm' });
const good = (id, o = {}) => ({ id, title: 'Send the sales team the list of 2 hire trials ending in 3 days', note: 'Do this before noon so the team can call the same day.', ...o });
function deps(items, r, { enabled = true, stopped = false } = {}) {
  const store = { list: async () => items, update: async (id, p) => Object.assign(items.find((i) => i.id === id), p) }; const used = [];
  return { store, used, ai: { isEnabled: () => enabled, complete: async (a) => { used.push(a); if (r instanceof Error) throw r; return r; } }, budget: { isStopped: async () => stopped, add: async (u) => used.push(['budget', u]) } };
}
describe('AI wording', () => {
  test('good wording is saved next to the plain wording; status and priority untouched', async () => {
    const items = [rule(1, { priority: 'decision_today' })]; const d = deps(items, reply([good('r1')]));
    const r = await W.addWording(d); expect(r.updated).toBe(1);
    expect(items[0].aiTitle).toMatch(/hire trials/); expect(items[0].title).toMatch(/send the contact list/); expect(items[0].status).toBe('suggested'); expect(items[0].priority).toBe('decision_today');
    expect(d.used.some((u) => u[0] === 'budget')).toBe(true);
  });
  test('invented numbers, promises, links and short text are thrown away', () => {
    const sent = [{ id: 'a', title: 'x 2 trials', reason: 'y 3 days' }];
    const t = (o) => Object.keys(W.parseWording(JSON.stringify({ items: [{ id: 'a', ...o }] }), sent)).length;
    expect(t({ title: 'Call the 2 trials with 3 days left', note: 'Offer a 50 percent discount to them' })).toBe(0);
    expect(t({ title: 'Call the 2 trials with 3 days left', note: 'This works automatically for you' })).toBe(0);
    expect(t({ title: 'short', note: 'A decent practical tip is here.' })).toBe(0);
    expect(t({ title: 'Call the 2 trials with 3 days left', note: 'Visit https://x.example.com now ok' })).toBe(1); // link is stripped, rest kept
    expect(W.parseWording('not json', sent)).toEqual({}); expect(W.parseWording('{"items":"no"}', sent)).toEqual({});
  });
  test('AI off, over budget, failing or junk: nothing changes', async () => {
    for (const [d, why] of [[deps([rule(1)], reply([]), { enabled: false }), 'ai_off'], [deps([rule(1)], reply([]), { stopped: true }), 'budget'], [deps([rule(1)], new Error('x')), 'ai_failed'], [deps([rule(1)], { text: 'junk', usage: {} }), 'unusable_reply'], [deps([], reply([])), 'nothing_to_do']]) {
      const r = await W.addWording(d); expect(r.updated).toBe(0); expect(r.reason).toBe(why);
    }
  });
  test('only rule items in "suggested" are sent; manual, done and already-worded ones are not; at most 8; no personal fields', async () => {
    const items = [rule(1), rule(2, { source: 'manual' }), rule(3, { status: 'done' }), rule(4, { aiTitle: 'already there ok' }), ...[5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((n) => rule(n, { phone: '9876543210' }))];
    const d = deps(items, reply([])); await W.addWording(d);
    const sent = JSON.parse(d.used[0].user); expect(sent.length).toBe(8); expect(sent.some((x) => ['r2', 'r3', 'r4'].includes(x.id))).toBe(false); expect(Object.keys(sent[0]).sort().join()).toBe('id,reason,title'); expect(d.used[0].user).not.toMatch(/9876543210/);
  });
});
describe('AI wording route', () => {
  function setup(withAi) {
    const routes = {}; const router = { use() {}, get: (p, h) => (routes['GET ' + p] = h), post: (p, h) => (routes['POST ' + p] = h), delete() {}, put() {} };
    const items = [rule(1)]; const store = { list: async () => items, get: async () => null, insert: async () => ({}), update: async (id, p) => Object.assign(items.find((i) => i.id === id), p), keys: async () => [], calendar: async () => [], setCalendar: async () => {} };
    createMarketingRouter({ express: { Router: () => router }, protect: 1, authorize: () => 2, store, getFacts: async () => ({ products: [] }), ai: withAi ? { isEnabled: () => true, complete: async () => reply([good('r1')]) } : null, aiBudget: withAi ? { isStopped: async () => false, add: async () => {} } : null });
    return async (role) => { const out = { c: 200 }; const res = { status(c) { out.c = c; return this; }, json(b) { out.b = b; } }; await routes['POST /ai-wording']({ user: { id: 'u', role }, body: {} }, res); return out; };
  }
  test('owner only; closed when AI is not set up', async () => {
    expect((await setup(true)('marketing')).c).toBe(403); expect((await setup(false)('root_admin')).c).toBe(404);
    const r = await setup(true)('root_admin'); expect(r.c).toBe(200); expect(r.b.data.updated).toBe(1);
  });
});
