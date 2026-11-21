const P = require('../src/products'); const A = require('../src/aggregate');
const sum = (product, over = {}) => ({ schema: 1, product, at: 'x', businesses: { total: 4, trial: 1, paying: 2, grace: 0, expired: 1, suspended: 0, signups7d: 1, active7d: 3 }, mrr: 100, collectedThisMonth: 0, endingSoon: [], renewalsDue: [], ai: { callsToday: 0, costTodayInr: 0, budgetInr: 300, stopped: false }, whatsappSentToday: 0, openTickets: 0, ...over });
const now = new Date('2026-11-12T00:00:00Z'); const fresh = '2026-11-12T00:00:00Z';
describe('Super Admin: seven products', () => {
  test('list is the gym plus six products, labelled, in the owner order', () => {
    expect(P.productKeys()).toEqual(['gym', 'salon', 'mart', 'dine', 'cloth', 'wash', 'hire']);
    expect(P.labelOf('salon')).toMatch(/Groom/); expect(P.labelOf('zzz')).toBe('zzz');
  });
  test('config: configured products keep their address and key; the rest are listed with none (not connected)', () => {
    const env = { ADMIN_PRODUCTS: 'hire,gym', ADMIN_URL_GYM: 'https://fit.afraventures.in', ADMIN_KEY_GYM: 'k'.repeat(30), ADMIN_URL_HIRE: 'https://hire.afraventures.in', ADMIN_KEY_HIRE: 'h'.repeat(30) };
    const c = P.readAllConfig(env);
    expect(c.map((x) => x.product)).toEqual(['gym', 'salon', 'mart', 'dine', 'cloth', 'wash', 'hire']);
    expect(c[0].url).toBe('https://fit.afraventures.in'); expect(c[1].url).toBe(null); expect(c[1].key).toBe(null); expect(c[6].key.length).toBe(30);
    expect(P.readAllConfig({}).every((x) => x.url === null)).toBe(true);
  });
  test('a product that is not set up shows as not connected and does not raise an alert; a product that is down does', () => {
    const out = A.combine([{ product: 'gym', ok: true, summary: sum('gym'), fetchedAt: fresh }, { product: 'salon', ok: false, error: 'not configured' }, { product: 'mart', ok: false, error: 'timed out' }], now);
    expect(out.products[1].state).toBe('not_connected');
    expect(out.products[2].state).toBe('unreachable');
    expect(out.attention.map((a) => a.product)).toEqual(['mart']);
  });
  test('active in 7 days: counted when a product sends it, left out (null) when it does not, totals ignore nulls', () => {
    const noActive = sum('hire'); delete noActive.businesses.active7d;
    const out = A.combine([{ product: 'gym', ok: true, summary: sum('gym'), fetchedAt: fresh }, { product: 'hire', ok: true, summary: noActive, fetchedAt: fresh }], now);
    expect(out.products[0].businesses.active7d).toBe(3); expect(out.products[1].businesses.active7d).toBe(null);
    expect(out.totals.active7d).toBe(3); expect(out.totals.businesses).toBe(8);
  });
  test('only counts and business names cross: unknown fields and customer data are dropped', () => {
    const out = A.combine([{ product: 'salon', ok: true, summary: sum('salon', { customers: [{ name: 'Ravi', phone: '9' }], businesses: { total: 1, active7d: 1, phones: ['9'] } }), fetchedAt: fresh }], now);
    expect(/Ravi|phones|customers/.test(JSON.stringify(out))).toBe(false);
  });
});
