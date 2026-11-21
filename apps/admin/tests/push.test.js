const P = require('../src/push');
const M = require('../src/marketing');
const { createPushRouter } = require('../src/pushRoutes');
const noon = new Date('2026-11-04T06:30:00Z'); // 12:00 IST
const night = new Date('2026-11-04T17:00:00Z'); // 22:30 IST
const item = (n, o = {}) => ({ id: 'id' + n, title: 'Decision number ' + n, status: 'suggested', priority: 'decision_today', channel: 'other', ...o });
const sub = (n) => ({ endpoint: 'https://push.example.com/send/' + 'x'.repeat(20) + n, keys: { p256dh: 'p'.repeat(30), auth: 'a'.repeat(12) } });
describe('subscription check', () => {
  test('good one passes; bad address, http, missing keys fail', () => {
    expect(P.validateSubscription(sub(1)).endpoint).toMatch(/^https:/);
    for (const bad of [null, {}, { ...sub(1), endpoint: 'http://x.example.com/aaaaaaaa' }, { endpoint: sub(1).endpoint }, { ...sub(1), keys: { p256dh: 'short', auth: 'a'.repeat(12) } }]) expect(() => P.validateSubscription(bad)).toThrow();
  });
});
describe('push run', () => {
  const mk = () => { const calls = []; const marked = []; const dropped = []; return { calls, marked, dropped, send: async (s, p) => { calls.push([s.endpoint, p]); }, markPushed: async (id) => marked.push(id), dropSub: async (e) => dropped.push(e) }; };
  test('sends at most 3 a day, only decisions, and marks them', async () => {
    const h = mk(); const items = [1, 2, 3, 4, 5].map((n) => item(n)).concat([item(9, { priority: 'this_week' })]);
    const r = await P.runPush({ items, subs: [sub(1)], send: h.send, markPushed: h.markPushed, dropSub: h.dropSub, now: noon });
    expect(r.sent).toBe(3); expect(h.marked.length).toBe(3); expect(h.calls.length).toBe(3);
  });
  test('earlier sends today count against the limit; the next day starts fresh', async () => {
    const h = mk(); const items = [item(1, { pushedAt: noon }), item(2, { pushedAt: noon }), item(3), item(4)];
    expect((await P.runPush({ items, subs: [sub(1)], send: h.send, markPushed: h.markPushed, now: noon })).sent).toBe(1);
    const h2 = mk(); expect((await P.runPush({ items: [item(1, { pushedAt: noon }), item(2)], subs: [sub(1)], send: h2.send, markPushed: h2.markPushed, now: new Date(noon.getTime() + 86400000) })).sent).toBe(1);
  });
  test('quiet hours send nothing', async () => {
    const h = mk(); const r = await P.runPush({ items: [item(1)], subs: [sub(1)], send: h.send, markPushed: h.markPushed, now: night });
    expect(r.sent).toBe(0); expect(r.reason).toBe('quiet_hours'); expect(h.calls.length).toBe(0);
  });
  test('no phones registered: nothing marked as sent', async () => {
    const h = mk(); const r = await P.runPush({ items: [item(1)], subs: [], send: h.send, markPushed: h.markPushed, now: noon });
    expect(r.reason).toBe('no_devices'); expect(h.marked.length).toBe(0);
  });
  test('gone phones (410) are dropped; if none reached, item stays unsent', async () => {
    const h = mk(); const send = async () => { throw Object.assign(new Error('gone'), { statusCode: 410 }); };
    const r = await P.runPush({ items: [item(1)], subs: [sub(1)], send, markPushed: h.markPushed, dropSub: h.dropSub, now: noon });
    expect(h.dropped.length).toBe(1); expect(r.sent).toBe(0); expect(h.marked.length).toBe(0);
    const send2 = async (s) => { if (s.endpoint.endsWith('1')) throw Object.assign(new Error('x'), { statusCode: 500 }); };
    const r2 = await P.runPush({ items: [item(2)], subs: [sub(1), sub(2)], send: send2, markPushed: h.markPushed, dropSub: h.dropSub, now: noon });
    expect(r2.sent).toBe(1); expect(r2.failed).toBe(1);
  });
  test('message holds only the title, trimmed; snoozed items are not sent', async () => {
    const h = mk(); await P.runPush({ items: [item(1, { title: 'T'.repeat(300), phone: '9876543210', email: 'a@b.com' }), item(2, { status: 'snoozed', snoozeUntil: new Date(noon.getTime() + 86400000) })], subs: [sub(1)], send: h.send, markPushed: h.markPushed, now: noon });
    expect(h.calls.length).toBe(1); const body = JSON.parse(h.calls[0][1]); expect(body.body.length).toBe(120); expect(JSON.stringify(body)).not.toMatch(/9876543210|a@b\.com/);
  });
});
describe('push routes', () => {
  function setup(withSend = true) {
    const routes = {}; const router = { use: (...m) => { routes.USE = m; }, get: (p, h) => (routes['GET ' + p] = h), post: (p, h) => (routes['POST ' + p] = h) };
    const subs = []; const items = [item(1)]; const sent = []; const audits = [];
    const store = { subs: async () => subs.slice(), addSub: async (s) => { subs.push(s); }, removeSub: async (e) => { const i = subs.findIndex((x) => x.endpoint === e); if (i >= 0) subs.splice(i, 1); } };
    const marketingStore = { list: async () => items, update: async (id, p) => Object.assign(items.find((i) => i.id === id), p) };
    const r = createPushRouter({ express: { Router: () => router }, protect: 'P', authorize: (...a) => 'AUTH:' + a.join(), store, marketingStore, send: withSend ? async (s, p) => { sent.push(p); } : null, publicKey: withSend ? 'PUBKEY' : null, audit: (a) => audits.push(a), now: () => noon });
    const call = async (key, body = {}) => { const out = {}; const res = { status(c) { out.c = c; return this; }, json(b) { out.b = b; } }; await routes[key]({ user: { id: 'u1' }, body }, res); out.c = out.c || 200; return out; };
    return { routes, call, subs, items, sent, audits };
  }
  test('owner-only guard; key; subscribe validates; run sends once and not twice', async () => {
    const s = setup(); expect(s.routes.USE).toEqual(['P', 'AUTH:root_admin']);
    expect((await s.call('GET /key')).b.data.publicKey).toBe('PUBKEY');
    expect((await s.call('POST /subscribe', { subscription: { endpoint: 'http://bad' } })).c).toBe(400);
    expect((await s.call('POST /subscribe', { subscription: sub(1) })).c).toBe(201);
    expect((await s.call('POST /run')).b.data.sent).toBe(1); expect((await s.call('POST /run')).b.data.sent).toBe(0); expect(s.sent.length).toBe(1);
    expect((await s.call('POST /unsubscribe', { endpoint: sub(1).endpoint })).c).toBe(200); expect(s.subs.length).toBe(0);
    expect(s.audits.map((a) => a.action)).toEqual(['push.subscribe', 'push.run', 'push.run', 'push.unsubscribe']);
  });
  test('not set up on the server: key and run say so', async () => {
    const s = setup(false); expect((await s.call('GET /key')).c).toBe(404); expect((await s.call('POST /run')).c).toBe(404);
  });
});
