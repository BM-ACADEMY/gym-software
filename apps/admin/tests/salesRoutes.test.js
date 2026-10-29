const { createSalesRouter } = require('../src/salesRoutes'); const { collectAccounts, cleanAccount } = require('../src/collect');
const acct = (o) => ({ businessName: 'Iron', ownerName: 'Ravi', ownerPhone: '9876543210', ownerEmail: 'r@x.com', contactConsent: true, createdAt: '2026-10-01', lastActiveAt: null, status: { status: 'trial', daysLeft: 2, endsAt: '2026-11-12' }, ...o });
describe('collectAccounts', () => {
  const cfg = [{ product: 'gym', url: 'https://fit.example.com', key: 'k'.repeat(30) }, { product: 'hire', url: null, key: null }];
  test('keeps only agreed fields, drops junk, names failed products only', async () => {
    const fetchImpl = async (url, o) => { expect(o.headers['x-internal-key'].length).toBe(30); return { ok: true, json: async () => ({ data: [acct({ salary: 99999, members: ['x'] }), { status: { status: 'weird' } }, null] }) }; };
    const r = await collectAccounts(cfg, { fetchImpl }); expect(r.accounts.length).toBe(1); expect(r.failed.join()).toBe('hire');
    expect(Object.keys(r.accounts[0]).join()).toBe('product,businessName,ownerName,ownerPhone,ownerEmail,contactConsent,createdAt,lastActiveAt,status'); expect('salary' in r.accounts[0]).toBe(false);
  });
  test('errors do not leak the url or key; consent must be exactly true', async () => {
    const r = await collectAccounts([cfg[0]], { fetchImpl: async () => { throw new Error('boom https://fit.example.com ' + 'k'.repeat(30)); } });
    expect(JSON.stringify(r).includes('example')).toBe(false); expect(r.failed.join()).toBe('gym');
    expect(cleanAccount(acct({ contactConsent: 'true' }), 'gym').contactConsent).toBe(false);
  });
});
describe('sales routes', () => {
  function setup(accounts) {
    const routes = {}; const router = { use() {}, get: (p, h) => (routes[p] = h) }; const audits = [];
    createSalesRouter({ express: { Router: () => router }, protect: 1, authorize: () => 2, getAccounts: async () => ({ accounts, failed: ['hire'] }), audit: (a) => audits.push(a), now: () => new Date('2026-11-10T06:00:00Z') });
    const call = async (p) => { const out = { headers: {} }; const res = { set(h, v) { Object.assign(out.headers, typeof h === 'string' ? { [h]: v } : h); }, json(b) { out.body = b; }, send(b) { out.text = b; }, status(c) { out.c = c; return this; } }; await routes[p]({ user: { email: 'k@x.com' } }, res); return out; };
    return { call, audits };
  }
  const list = [acct({ status: { status: 'trial', daysLeft: 2, endsAt: null }, product: 'gym' })];
  test('summary has numbers only', async () => { const o = (await setup(list).call('/summary')); expect(o.body.data.total).toBe(1); expect(JSON.stringify(o.body).includes('9876')).toBe(false); expect(o.body.data.productsUnavailable.join()).toBe('hire'); expect(o.headers['Cache-Control']).toBe('no-store'); });
  test('csv is no-store, attachment, audited with a row count, not the numbers', async () => {
    const s = setup(list); const o = await s.call('/list.csv');
    expect(o.text.split('\n')[0]).toBe('phone,name,email,source,campaign'); expect(o.text).toMatch(/\+919876543210/); expect(o.headers['Content-Type']).toMatch(/text\/csv/); expect(o.headers['Content-Disposition']).toMatch(/2026-11-10/);
    expect(s.audits[0].rows).toBe(1); expect(JSON.stringify(s.audits).includes('9876')).toBe(false);
  });
});
