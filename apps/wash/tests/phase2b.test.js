const PH = require('../src/photos'); const MONEY = require('../src/money'); const A = require('../src/accounts');
const { createWashRouter } = require('../src/routes'); const { makeFakeModels } = require('./fakeModels');
function harness() {
  const h = {}; const router = { use: () => {}, get: (p, ...f) => (h['GET ' + p] = f), post: (p, ...f) => (h['POST ' + p] = f), put: (p, ...f) => (h['PUT ' + p] = f) };
  const M = makeFakeModels(); let clock = new Date('2026-11-12T08:00:00Z');
  createWashRouter({ express: { Router: () => router }, models: M, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, planOf: () => 'growth', now: () => clock });
  const call = async (key, tenant, { body = {}, query = {}, params = {}, role = 'admin' } = {}) => {
    const o = { headers: {} }; const req = { user: { id: 'u', tenantId: tenant, role }, body, query, params };
    const res = { set: () => {}, send: (b) => { o.text = b; }, status(c) { o.c = c; return this; }, json(b) { o.b = b; if (!o.c) o.c = 200; } };
    const chain = h[key]; for (let i = 0; i < chain.length; i++) { let went = false; await chain[i](req, res, () => { went = true; }); if (!went) break; }
    return o;
  };
  return { call, M };
}
const T1 = 'aaaaaaaaaaaaaaaaaaaaaaa1', T2 = 'aaaaaaaaaaaaaaaaaaaaaaa2';
describe('photos (rules)', () => {
  test('a reference only: size over 300 KB, bad type, path tricks and data URLs are refused', () => {
    const ok = { kind: 'before', ref: 'wash/t1/2026-11/abc123.jpg', bytes: 250000, mime: 'image/jpeg' };
    expect(PH.checkPhoto(ok).value.ref).toBe(ok.ref);
    expect(PH.checkPhoto({ ...ok, bytes: 400000 }).error).toMatch(/300 KB/);
    expect(PH.checkPhoto({ ...ok, mime: 'image/gif' }).error).toMatch(/JPEG/);
    expect(PH.checkPhoto({ ...ok, ref: '../etc/passwd' }).error).toMatch(/not valid/);
    expect(PH.checkPhoto({ ...ok, ref: '/abs/path.jpg' }).error).toMatch(/not valid/);
    expect(PH.checkPhoto({ ...ok, ref: 'data:image/png;base64,AAAA' }).error).toMatch(/not valid/);
    expect(PH.checkPhoto({ ...ok, ref: 'https://x.com/a.jpg' }).error).toMatch(/not valid/);
    expect(PH.checkPhoto({ ...ok, kind: 'during' }).error).toMatch(/before or after/);
    expect(PH.checkPhoto({ ...ok, bytes: 1.5 }).error).toMatch(/size/);
  });
});
describe('dues and refunds (rules)', () => {
  test('delivery: paid in full, pay later needs the flag and a phone, overpay refused', () => {
    expect(MONEY.dueAfterDelivery({ owe: 400, pays: [{ amount: 400 }], payLater: false, hasPhone: false }).due).toBe(0);
    expect(MONEY.dueAfterDelivery({ owe: 400, pays: [{ amount: 100 }], payLater: false, hasPhone: true }).error).toMatch(/add up to Rs 400/);
    expect(MONEY.dueAfterDelivery({ owe: 400, pays: [{ amount: 100 }], payLater: true, hasPhone: true }).due).toBe(300);
    expect(MONEY.dueAfterDelivery({ owe: 400, pays: [], payLater: true, hasPhone: false }).error).toMatch(/phone/);
    expect(MONEY.dueAfterDelivery({ owe: 400, pays: [{ amount: 500 }], payLater: true, hasPhone: true }).error).toMatch(/more than/);
    expect(MONEY.dueAfterDelivery({ owe: 0, pays: [], payLater: false, hasPhone: false }).due).toBe(0);
  });
  test('collection cannot exceed the due; refund cannot exceed what was paid, needs a reason and a delivered job', () => {
    expect(MONEY.checkCollection({ due: 300, pays: [{ method: 'cash', amount: 100 }] })).toEqual({ collected: 100, left: 200 });
    expect(MONEY.checkCollection({ due: 300, pays: [{ method: 'cash', amount: 301 }] }).error).toMatch(/more than/);
    expect(MONEY.checkCollection({ due: 0, pays: [{ method: 'cash', amount: 1 }] }).error).toMatch(/Nothing is due/);
    expect(MONEY.checkCollection({ due: 300, pays: [{ method: 'gold', amount: 1 }] }).error).toMatch(/cash, upi or card/);
    const job = { state: 'delivered', payments: [{ method: 'cash', amount: 400 }], refunded: 100 };
    expect(MONEY.checkRefund({ job, amount: 300, method: 'cash', reason: 'bad wash' }).value.amount).toBe(300);
    expect(MONEY.checkRefund({ job, amount: 301, method: 'cash', reason: 'bad wash' }).error).toMatch(/at most Rs 300/);
    expect(MONEY.checkRefund({ job, amount: 50, method: 'cash', reason: 'no' }).error).toMatch(/reason/);
    expect(MONEY.checkRefund({ job: { ...job, state: 'ready' }, amount: 50, method: 'cash', reason: 'bad wash' }).error).toMatch(/delivered/);
  });
  test('cash book shows collected dues in and cash refunds out; CA file lists them, refunds as negatives', () => {
    const b = A.cashBook({ openingFloat: 100, collections: [{ plate: 'TN1', method: 'cash', amount: 200 }, { plate: 'TN2', method: 'upi', amount: 50 }], refunds: [{ plate: 'TN3', method: 'cash', amount: 80, reason: 'redo' }] });
    expect(b.closing).toBe(220);
    const csv = A.caCsv({ jobs: [], expenses: [], collections: [{ day: '2026-11-12', plate: 'TN1', method: 'cash', amount: 200 }], refunds: [{ day: '2026-11-12', plate: 'TN3', method: 'cash', amount: 80, reason: '=cmd' }] });
    expect(csv).toMatch(/refund,2026-11-12,TN3,'=cmd,cash,-80/); expect(csv).toMatch(/sale,2026-11-12,TN1,due collected,cash,200/);
  });
});
describe('photo, due, refund routes', () => {
  async function delivered(H, extra = {}) { return H.M.Job.create({ tenantId: T1, number: 1, plate: 'TN09AB1234', day: '2026-11-12', state: 'delivered', total: 400, payments: [{ method: 'cash', amount: 400 }], ...extra }); }
  test('photos: saved against own job only, capped per kind, bad ones refused', async () => {
    const H = harness(); const j = await delivered(H); const id = String(j._id);
    const ok = { kind: 'before', ref: 'wash/a/1.jpg', bytes: 100000, mime: 'image/jpeg' };
    expect((await H.call('POST /jobs/:id/photos', T1, { params: { id }, body: ok })).c).toBe(201);
    expect((await H.call('POST /jobs/:id/photos', T2, { params: { id }, body: ok })).c).toBe(404);
    expect((await H.call('POST /jobs/:id/photos', T1, { params: { id }, body: { ...ok, bytes: 999999 } })).c).toBe(400);
    for (let i = 0; i < 5; i++) await H.call('POST /jobs/:id/photos', T1, { params: { id }, body: { ...ok, ref: 'wash/a/p' + i + '.jpg' } });
    expect((await H.call('POST /jobs/:id/photos', T1, { params: { id }, body: { ...ok, ref: 'wash/a/last.jpg' } })).c).toBe(409);
    expect((await H.call('GET /jobs/:id/photos', T1, { params: { id } })).b.data.length).toBe(6);
    expect((await H.call('GET /jobs/:id/photos', T2, { params: { id } })).c).toBe(404);
  });
  test('pay later at delivery, then collect: due shrinks, cash book picks it up, another business cannot touch it', async () => {
    const H = harness(); await H.M.Vehicle.create({ tenantId: T1, plate: 'TN09AB1234', klass: 'sedan', ownerPhone: '9876543210', ownerName: 'Ravi' });
    const j = await H.M.Job.create({ tenantId: T1, number: 1, plate: 'TN09AB1234', day: '2026-11-12', state: 'ready', total: 400, subtotal: 400, discount: 0, lines: [{ amount: 400 }] });
    const id = String(j._id);
    const del = await H.call('POST /jobs/:id/move', T1, { params: { id }, body: { to: 'delivered', payments: [{ method: 'cash', amount: 100 }], payLater: true, dueNote: 'pays Friday' } });
    expect(del.c).toBe(200);
    const list = await H.call('GET /dues/customers', T1); expect(list.b.data.total).toBe(300); expect(list.b.data.rows[0].ownerPhone).toBe('9876543210');
    expect((await H.call('GET /dues/customers', T2)).b.data.total).toBe(0);
    expect((await H.call('POST /jobs/:id/collect', T2, { params: { id }, body: { payments: [{ method: 'cash', amount: 10 }] } })).c).toBe(404);
    expect((await H.call('POST /jobs/:id/collect', T1, { params: { id }, body: { payments: [{ method: 'cash', amount: 301 }] } })).c).toBe(400);
    expect((await H.call('POST /jobs/:id/collect', T1, { params: { id }, body: { payments: [{ method: 'cash', amount: 200 }] } })).b.data.due).toBe(100);
    const book = await H.call('GET /accounts/cash-book', T1, { query: { day: '2026-11-12' } });
    expect(book.b.data.closing).toBe(300);
  });
  test('refund: owner only, reason needed, limited to what was paid, counted in P&L and the cash book', async () => {
    const H = harness(); const j = await delivered(H); const id = String(j._id);
    const ok = { amount: 150, method: 'cash', reason: 'water spots left' };
    expect(H.call).toBeTruthy();
    expect((await H.call('POST /jobs/:id/refund', T2, { params: { id }, body: ok })).c).toBe(404);
    expect((await H.call('POST /jobs/:id/refund', T1, { params: { id }, body: { ...ok, reason: '' } })).c).toBe(400);
    expect((await H.call('POST /jobs/:id/refund', T1, { params: { id }, body: { ...ok, amount: 500 } })).c).toBe(400);
    expect((await H.call('POST /jobs/:id/refund', T1, { params: { id }, body: ok })).c).toBe(201);
    expect((await H.call('POST /jobs/:id/refund', T1, { params: { id }, body: { ...ok, amount: 251 } })).c).toBe(400);
    const pnl = await H.call('GET /accounts/pnl', T1, { query: { from: '2026-11-01', to: '2026-11-30' } }); expect(pnl.b.data.revenue).toBe(250);
    const book = await H.call('GET /accounts/cash-book', T1, { query: { day: '2026-11-12' } }); expect(book.b.data.closing).toBe(250);
    const close = await H.call('POST /cash-closing', T1, { body: { day: '2026-11-12', declared: 250 } }); expect(close.b.data.diff).toBe(0);
    expect((await H.call('GET /refunds', T1)).b.data.length).toBe(1); expect((await H.call('GET /refunds', T2)).b.data.length).toBe(0);
  });
});
