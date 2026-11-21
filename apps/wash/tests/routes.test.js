const { createWashRouter } = require('../src/routes');
const { makeFakeModels } = require('./fakeModels');

function harness(extra = {}) {
  const h = {}; const mids = [];
  const router = { use: (...m) => mids.push(...m), get: (p, f) => (h['GET ' + p] = f), post: (p, f) => (h['POST ' + p] = f), put: (p, f) => (h['PUT ' + p] = f) };
  const M = makeFakeModels(); let clock = new Date('2026-11-12T08:00:00Z');
  createWashRouter({ express: { Router: () => router }, models: M, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, planOf: () => 'growth', now: () => clock, ...extra });
  const call = async (key, tenant, { body = {}, query = {}, params = {} } = {}) => {
    const o = { headers: {} }; const req = { user: { id: 'u', tenantId: tenant }, body, query, params };
    await h[key](req, { set: (k, v) => { o.headers[k] = v; }, send: (b) => { o.text = b; }, status(c) { o.c = c; return this; }, json(b) { o.b = b; if (!o.c) o.c = 200; } });
    return o;
  };
  return { call, M, mids, setClock: (d) => { clock = new Date(d); } };
}
const T1 = 'aaaaaaaaaaaaaaaaaaaaaaa1', T2 = 'aaaaaaaaaaaaaaaaaaaaaaa2';
const PRICES = { prices: { sedan: 400, bike: 100, suv: 600 }, addons: { wax: 150 }, incentive: { default: { type: 'percent', value: 10 } } };
async function ready(H, tenant = T1) { await H.call('PUT /price-list', tenant, { body: PRICES }); }

describe('router set-up', () => {
  test('sign-in and role check come first; guardWrite blocks changes on an ended plan but not reads', async () => {
    const H = harness(); expect(H.mids.slice(0, 2)).toEqual(['P', 'A']);
    const H2 = harness({ guardWrite: (req) => ({ ok: false, httpStatus: 402, message: 'read only' }) });
    const guard = H2.mids[2]; let out; guard({ method: 'POST' }, { status: (c) => ({ json: (b) => { out = { c, b }; } }) }, () => { out = 'next'; });
    expect(out.c).toBe(402); expect(out.b.code).toBe('read_only');
  });
});
describe('price list', () => {
  test('save and read; bad values refused; other business sees nothing', async () => {
    const H = harness();
    expect((await H.call('PUT /price-list', T1, { body: { prices: { sedan: 40.5 } } })).c).toBe(400);
    expect((await H.call('PUT /price-list', T1, { body: { prices: { tank: 5 } } })).c).toBe(400);
    expect((await H.call('PUT /price-list', T1, { body: { addons: { 'Bad Name': 5 } } })).c).toBe(400);
    expect((await H.call('PUT /price-list', T1, { body: { incentive: { default: { type: 'percent', value: 500 } } } })).c).toBe(400);
    expect((await H.call('PUT /price-list', T1, { body: {} })).c).toBe(400);
    expect((await H.call('PUT /price-list', T1, { body: PRICES })).c).toBe(200);
    expect((await H.call('GET /price-list', T1)).b.data.prices.sedan).toBe(400);
    expect(Object.keys((await H.call('GET /price-list', T2)).b.data.prices).length).toBe(0);
  });
});
describe('vehicles and attendants', () => {
  test('plate is normalised and saved once per business; invalid plate, class and phone refused; list is per business', async () => {
    const H = harness();
    expect((await H.call('POST /vehicles', T1, { body: { plate: 'hello', klass: 'sedan' } })).c).toBe(400);
    expect((await H.call('POST /vehicles', T1, { body: { plate: 'TN09AB1234', klass: 'tank' } })).c).toBe(400);
    expect((await H.call('POST /vehicles', T1, { body: { plate: 'TN09AB1234', klass: 'sedan', ownerPhone: '12345' } })).c).toBe(400);
    expect((await H.call('POST /vehicles', T1, { body: { plate: 'TN09AB1234', klass: 'sedan', intervalDays: 1 } })).c).toBe(400);
    const a = await H.call('POST /vehicles', T1, { body: { plate: 'tn 09 ab 1234', klass: 'sedan', ownerName: 'Ravi', ownerPhone: '9876543210' } });
    expect(a.c).toBe(201); expect(a.b.data.plate).toBe('TN09AB1234');
    await H.call('POST /vehicles', T1, { body: { plate: 'TN09AB1234', klass: 'suv' } });
    expect(H.M.Vehicle.rows.length).toBe(1); expect(H.M.Vehicle.rows[0].klass).toBe('suv');
    expect((await H.call('GET /vehicles', T1, { query: { q: 'tn09' } })).b.data.length).toBe(1);
    expect((await H.call('GET /vehicles', T2)).b.data.length).toBe(0);
  });
  test('attendants: name needed; list is per business', async () => {
    const H = harness();
    expect((await H.call('POST /attendants', T1, { body: { name: 'x' } })).c).toBe(400);
    expect((await H.call('POST /attendants', T1, { body: { name: 'Murugan' } })).c).toBe(201);
    expect((await H.call('GET /attendants', T1)).b.data.length).toBe(1); expect((await H.call('GET /attendants', T2)).b.data.length).toBe(0);
  });
});
describe('jobs and the pass', () => {
  test('job takes class from the vehicle, prices with add-ons, refuses unpriced class; board is per business', async () => {
    const H = harness(); await ready(H);
    await H.call('POST /vehicles', T1, { body: { plate: 'TN09AB1234', klass: 'sedan' } });
    const j = await H.call('POST /jobs', T1, { body: { plate: 'TN09AB1234', addons: ['wax'] } });
    expect(j.c).toBe(201); expect(j.b.data.total).toBe(550); expect(j.b.data.state).toBe('waiting'); expect(j.b.data.number).toBe(1);
    expect((await H.call('POST /jobs', T1, { body: { plate: 'TN09AB1234', klass: 'hatchback' } })).c).toBe(400);
    expect((await H.call('POST /jobs', T1, { body: { plate: 'TN09AB1234', addons: ['gold'] } })).c).toBe(400);
    expect((await H.call('POST /jobs', T1, { body: { plate: 'nope' } })).c).toBe(400);
    expect((await H.call('GET /jobs', T1)).b.data.length).toBe(1); expect((await H.call('GET /jobs', T2)).b.data.length).toBe(0);
  });
  test('passes: sell, list with status, plan limit, bad input; a usable pass is found when the job is made', async () => {
    const H = harness(); await ready(H);
    expect((await H.call('POST /passes', T1, { body: { plate: 'TN09AB1234', washes: 0, price: 500 } })).c).toBe(400);
    const p = await H.call('POST /passes', T1, { body: { plate: 'TN09AB1234', washes: 4, price: 999 } });
    expect(p.c).toBe(201); expect(p.b.data.endsOn).toBe('2026-12-11');
    expect((await H.call('GET /passes', T1, { query: { plate: 'TN09AB1234' } })).b.data[0].status.left).toBe(4);
    expect((await H.call('GET /passes', T2)).b.data.length).toBe(0);
    const j = await H.call('POST /jobs', T1, { body: { plate: 'TN09AB1234', klass: 'sedan' } });
    expect(j.b.passFound).toBe(true); expect(j.b.data.passCovered).toBe(400);
    const capH = harness({ planOf: () => 'starter' }); for (let i = 0; i < 20; i++) capH.M.Pass.rows.push({ _id: 'p' + i, tenantId: T1, plate: 'X', endsOn: '2027-01-01' });
    expect((await capH.call('POST /passes', T1, { body: { plate: 'TN09AB1234', washes: 4, price: 999 } })).c).toBe(429);
    expect((await capH.call('POST /passes', T2, { body: { plate: 'TN09AB1234', washes: 4, price: 999 } })).c).toBe(201);
  });
  test('move: full path with payments, vehicle last wash, wrong jumps, wrong totals; another business cannot touch it', async () => {
    const H = harness(); await ready(H);
    const att = (await H.call('POST /attendants', T1, { body: { name: 'Murugan' } })).b.data.id;
    const id = (await H.call('POST /jobs', T1, { body: { plate: 'TN09AB1234', klass: 'sedan' } })).b.data.id;
    expect((await H.call('POST /jobs/:id/move', T2, { params: { id }, body: { to: 'washing' } })).c).toBe(404);
    expect((await H.call('POST /jobs/:id/move', T1, { params: { id }, body: { to: 'ready' } })).c).toBe(409);
    expect((await H.call('POST /jobs/:id/move', T1, { params: { id }, body: { to: 'washing', attendantId: 'zzzzzzzzzzzzzzzzzzzzzzzz' } })).c).toBe(400);
    expect((await H.call('POST /jobs/:id/move', T1, { params: { id }, body: { to: 'washing' } })).c).toBe(200); // one attendant: default
    expect(H.M.Job.rows[0].attendantId).toBe(att);
    expect((await H.call('POST /jobs/:id/move', T1, { params: { id }, body: { to: 'ready' } })).c).toBe(200);
    expect((await H.call('POST /jobs/:id/move', T1, { params: { id }, body: { to: 'delivered', payments: [{ method: 'cash', amount: 300 }] } })).c).toBe(400);
    expect((await H.call('POST /jobs/:id/move', T1, { params: { id }, body: { to: 'delivered', payments: [{ method: 'gold', amount: 400 }] } })).c).toBe(400);
    expect((await H.call('POST /jobs/:id/move', T1, { params: { id }, body: { to: 'delivered' } })).c).toBe(400);
    expect((await H.call('POST /jobs/:id/move', T1, { params: { id }, body: { to: 'delivered', payments: [{ method: 'cash', amount: 100 }, { method: 'upi', amount: 300 }] } })).c).toBe(200);
    expect(H.M.Vehicle.rows.length).toBe(0); // vehicle only updated if it exists
    expect((await H.call('POST /jobs/:id/move', T1, { params: { id }, body: { to: 'delivered', payAllWith: 'cash' } })).c).toBe(409); // already delivered
    expect((await H.call('POST /jobs/:id/move', T1, { params: { id: 'bad id!' }, body: { to: 'washing' } })).c).toBe(400);
  });
  test('delivery with a pass: only the add-ons are paid, the pass loses one wash, an empty pass blocks delivery', async () => {
    const H = harness(); await ready(H);
    await H.call('POST /attendants', T1, { body: { name: 'Murugan' } });
    await H.call('POST /vehicles', T1, { body: { plate: 'TN09AB1234', klass: 'sedan' } });
    await H.call('POST /passes', T1, { body: { plate: 'TN09AB1234', washes: 1, price: 999 } });
    const id = (await H.call('POST /jobs', T1, { body: { plate: 'TN09AB1234', addons: ['wax'] } })).b.data.id;
    await H.call('POST /jobs/:id/move', T1, { params: { id }, body: { to: 'washing' } }); await H.call('POST /jobs/:id/move', T1, { params: { id }, body: { to: 'ready' } });
    expect((await H.call('POST /jobs/:id/move', T1, { params: { id }, body: { to: 'delivered', payAllWith: 'upi' } })).c).toBe(200);
    expect(H.M.Job.rows[0].payments).toEqual([{ method: 'upi', amount: 150 }]);
    expect(H.M.Pass.rows[0].used).toBe(1); expect(H.M.Vehicle.rows[0].lastWash).toBe('2026-11-12');
    const id2 = (await H.call('POST /jobs', T1, { body: { plate: 'TN09AB1234', klass: 'sedan' } })).b; expect(id2.passFound).toBe(false);
  });
});
describe('cash closing', () => {
  test('expected from delivered payments; flag on a gap; one close per day; per business', async () => {
    const H = harness(); await ready(H);
    H.M.Job.rows.push({ _id: 'j1', tenantId: T1, day: '2026-11-12', state: 'delivered', payments: [{ method: 'cash', amount: 400 }, { method: 'upi', amount: 100 }] }, { _id: 'j2', tenantId: T2, day: '2026-11-12', state: 'delivered', payments: [{ method: 'cash', amount: 9999 }] });
    expect((await H.call('POST /cash-closing', T1, { body: { declared: -5 } })).c).toBe(400);
    expect((await H.call('POST /cash-closing', T1, { body: { declared: 400, openingFloat: -1 } })).c).toBe(400);
    const r = await H.call('POST /cash-closing', T1, { body: { declared: 300, openingFloat: 100 } });
    expect(r.c).toBe(201); expect(r.b.data.expected).toBe(500); expect(r.b.data.diff).toBe(-200); expect(r.b.data.flag).toBe(true); expect(r.b.data.upiTotal).toBe(100);
    expect((await H.call('POST /cash-closing', T1, { body: { declared: 500 } })).c).toBe(409);
    expect((await H.call('GET /cash-closing', T1)).b.data.length).toBe(1); expect((await H.call('GET /cash-closing', T2)).b.data.length).toBe(0);
  });
});
describe('summary and suggestions', () => {
  test('summary shows only this business; suggestions carry reasons and never send', async () => {
    const H = harness(); await ready(H);
    H.M.Job.rows.push({ _id: 'j1', tenantId: T1, day: '2026-11-12', state: 'delivered', total: 400, klass: 'sedan', attendantId: 'a', payments: [{ method: 'cash', amount: 400 }] }, { _id: 'j2', tenantId: T2, day: '2026-11-12', state: 'delivered', total: 9000, klass: 'sedan', payments: [] });
    H.M.Vehicle.rows.push({ _id: 'v1', tenantId: T1, plate: 'A1', ownerName: 'x', lastWash: '2026-08-01' });
    const s = await H.call('GET /summary', T1); expect(s.b.data.facts.revenue).toBe(400); expect(s.b.data.autoSend).toBe(false); expect(s.headers['Cache-Control']).toBe('no-store');
    const g = await H.call('GET /suggestions', T1); expect(g.b.data.actions.length > 0).toBe(true); expect(g.b.data.actions.every((a) => !!a.reason)).toBe(true); expect(g.b.data.autoSend).toBe(false);
    expect((await H.call('GET /summary', T2)).b.data.facts.revenue).toBe(9000);
  });
});
describe('accounts', () => {
  test('expenses: category and amount checked; list, dues and cash book per business', async () => {
    const H = harness();
    expect((await H.call('POST /expenses', T1, { body: { category: 'x', amount: 5 } })).c).toBe(400);
    expect((await H.call('POST /expenses', T1, { body: { category: 'water', amount: 5.5 } })).c).toBe(400);
    expect((await H.call('POST /expenses', T1, { body: { category: 'water', amount: 100, note: 'tanker' } })).c).toBe(201);
    expect((await H.call('POST /expenses', T1, { body: { category: 'chemicals', amount: 700, paid: false, supplier: 'Shine Co' } })).c).toBe(201);
    expect((await H.call('POST /expenses', T2, { body: { category: 'rent', amount: 9000 } })).c).toBe(201);
    expect((await H.call('GET /expenses', T1)).b.data.length).toBe(2);
    expect((await H.call('GET /expenses', T1, { query: { from: '2026-12-01', to: '2026-11-01' } })).c).toBe(400);
    const d = await H.call('GET /accounts/dues', T1); expect(d.b.data).toEqual([{ supplier: 'Shine Co', due: 700, oldest: '2026-11-12' }]);
    H.M.Job.rows.push({ _id: 'j1', tenantId: T1, day: '2026-11-12', state: 'delivered', payments: [{ method: 'cash', amount: 400 }], plate: 'A' });
    const cb = await H.call('GET /accounts/cash-book', T1, { query: { float: '200' } }); expect(cb.b.data.closing).toBe(500);
  });
  test('profit and loss uses revenue, expenses and incentive; csv export is a download; range limited to a year', async () => {
    const H = harness(); await ready(H);
    H.M.Job.rows.push({ _id: 'j1', tenantId: T1, day: '2026-11-12', state: 'delivered', total: 1000, klass: 'sedan', attendantId: 'a', number: 1, plate: 'A', payments: [{ method: 'cash', amount: 1000 }] }, { _id: 'j2', tenantId: T2, day: '2026-11-12', state: 'delivered', total: 5000, klass: 'sedan', attendantId: 'z', number: 1, plate: 'Z', payments: [] });
    await H.call('POST /expenses', T1, { body: { category: 'rent', amount: 300 } });
    const p = await H.call('GET /accounts/pnl', T1); expect(p.b.data.revenue).toBe(1000); expect(p.b.data.incentive).toBe(100); expect(p.b.data.profit).toBe(600); expect(p.b.data.words).toMatch(/kept Rs 600/);
    const c = await H.call('GET /accounts/export.csv', T1); expect(c.headers['Content-Type']).toMatch(/text\/csv/); expect(c.headers['Content-Disposition']).toMatch(/attachment/); expect(c.text).toMatch(/sale,2026-11-12,#1,A,cash,1000/); expect(c.text.indexOf('Z')).toBe(-1);
    expect((await H.call('GET /accounts/pnl', T1, { query: { from: '2020-01-01', to: '2026-11-12' } })).c).toBe(400);
  });
});
describe('reports, estimates, marketing, attendance', () => {
  test('sales by class and bad key; per business', async () => {
    const H = harness();
    H.M.Job.rows.push({ _id: 'j1', tenantId: T1, day: '2026-11-12', state: 'delivered', total: 400, klass: 'sedan' }, { _id: 'j2', tenantId: T2, day: '2026-11-12', state: 'delivered', total: 700, klass: 'suv' });
    const r = await H.call('GET /reports/sales', T1, { query: { by: 'class' } }); expect(r.b.data.total).toBe(400);
    expect((await H.call('GET /reports/sales', T1, { query: { by: 'moon' } })).c).toBe(400);
  });
  test('predictions are labelled and explain themselves; not enough data gives no number', async () => {
    const H = harness();
    const p = await H.call('GET /predictions', T1); expect(p.b.data.nextMonth.enough).toBe(false); expect(p.b.data.nextMonth.label).toBe('Estimate, not a promise'); expect(p.b.data.busyHours.enough).toBe(false);
    for (const m of ['2026-08', '2026-09', '2026-10']) H.M.Job.rows.push({ _id: 'm' + m, tenantId: T1, day: m + '-15', state: 'delivered', total: 3000, createdAt: new Date() });
    const q = await H.call('GET /predictions', T1); expect(q.b.data.nextMonth.expected).toBe(3000); expect(q.b.data.nextMonth.reason).toMatch(/last 3 months/);
  });
  test('marketing only suggests; festival dates are saved per business and validated', async () => {
    const H = harness(); await ready(H);
    expect((await H.call('PUT /festivals', T1, { body: { festivals: [{ name: 'D', date: 'x' }] } })).c).toBe(400);
    expect((await H.call('PUT /festivals', T1, { body: { festivals: [{ name: 'Diwali', date: '2026-11-20' }] } })).c).toBe(200);
    H.M.Job.rows.push({ _id: 'j1', tenantId: T1, day: '2026-11-12', state: 'delivered', plate: 'A1', total: 400 });
    H.M.Vehicle.rows.push({ _id: 'v1', tenantId: T1, plate: 'A1', ownerPhone: '9876543210' });
    const m = await H.call('GET /marketing', T1);
    expect(m.b.data.sends).toMatch(/suggestions only/); expect(m.b.data.reviewRequests.length).toBe(1); expect(m.b.data.reviewRequests[0].approved).toBe(false); expect(m.b.data.festivals.length).toBe(1);
    expect((await H.call('GET /marketing', T2)).b.data.reviewRequests.length).toBe(0);
  });
  test('attendance: present, absent or leave per attendant per day; unknown attendant refused; month summary', async () => {
    const H = harness(); const a = (await H.call('POST /attendants', T1, { body: { name: 'Murugan' } })).b.data.id;
    expect((await H.call('POST /attendance', T1, { body: { attendantId: a, day: '2026-11-01', status: 'sick' } })).c).toBe(400);
    expect((await H.call('POST /attendance', T2, { body: { attendantId: a, day: '2026-11-01', status: 'present' } })).c).toBe(400);
    expect((await H.call('POST /attendance', T1, { body: { attendantId: a, day: '2026-11-01', status: 'present' } })).c).toBe(200);
    await H.call('POST /attendance', T1, { body: { attendantId: a, day: '2026-11-01', status: 'leave' } });
    await H.call('POST /attendance', T1, { body: { attendantId: a, day: '2026-11-02', status: 'present' } });
    const s = await H.call('GET /attendance', T1, { query: { month: '2026-11' } }); expect(s.b.data.summary[a]).toEqual({ present: 1, absent: 0, leave: 1 });
    expect(Object.keys((await H.call('GET /attendance', T2)).b.data.summary).length).toBe(0);
  });
});
