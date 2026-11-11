const fs = require('fs'); const path = require('path');
const makeModels = require('../src/models'); const S = require('../src/session');
function fakeMongoose() {
  const registered = {}; const idx = {};
  class Schema { constructor(def) { this.def = def; this.plugins = []; this.idx = []; } index(f, o) { this.idx.push([f, o]); } plugin(fn, opts) { this.plugins.push({ fn, opts }); } }
  Schema.Types = { ObjectId: 'oid', Mixed: 'mixed' };
  return { Schema, models: registered, Types: { ObjectId: function ObjectId(v) { this.v = v; } }, model: (name, schema) => { registered[name] = { schema }; return registered[name]; } };
}
describe('Salon tenant guard wiring', () => {
  test('every model but SalonTenant carries the guard and a required tenantId', () => {
    const m = fakeMongoose(); makeModels(m);
    const names = Object.keys(m.models); expect(names).toContain('SalonTenant');
    for (const n of names) {
      const sc = m.models[n].schema;
      if (n === 'SalonTenant') expect(sc.plugins).toHaveLength(0);
      else { expect(sc.plugins).toHaveLength(1); expect(sc.plugins[0].opts.field).toBe('tenantId'); expect(sc.def.tenantId.required).toBe(true); }
    }
  });
  test('double slot booking is blocked by a unique index on active visits only', () => {
    const m = fakeMongoose(); makeModels(m);
    const ix = m.models.SalonAppointment.schema.idx.find((i) => i[0].staffId === 1 && i[0].start === 1);
    expect(ix[1].unique).toBe(true); expect(ix[1].partialFilterExpression.active).toBe(true); expect(ix[0].tenantId).toBe(1);
  });
  test('phone is unique per business, not across businesses', () => {
    const m = fakeMongoose(); makeModels(m);
    const ix = m.models.SalonCustomer.schema.idx.find((i) => i[0].phone === 1);
    expect(ix[0].tenantId).toBe(1); expect(ix[1].unique).toBe(true);
  });
  test('building twice does not add the guard twice', () => { const m = fakeMongoose(); makeModels(m); makeModels(m); expect(m.models.SalonService.schema.plugins).toHaveLength(1); });
  test('no raw driver calls in Salon source; every runUnscoped has a written reason', () => {
    const dir = path.join(__dirname, '..', 'src');
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      expect(/\.collection\.|bulkWrite|\.db\.collection/.test(src)).toBe(false);
      for (const mm of src.matchAll(/runUnscoped\(\s*(['"`])([^'"`]*)\1/g)) expect(mm[2].length).toBeGreaterThan(14);
    }
  });
});
describe('Salon session', () => {
  const K = 'k'.repeat(40);
  test('sign, verify, tamper, expiry; cookie flags and name', () => {
    const t = S.sign({ uid: 'u', tid: 't' }, K, 1000); expect(S.verify(t, K, 2000).tid).toBe('t');
    expect(S.verify(t.slice(0, -2) + 'xx', K, 2000)).toBeNull(); expect(S.verify(t, K, 1000 + S.TTL_MS + 1)).toBeNull();
    expect(S.cookieHeader('a.b')).toMatch(/HttpOnly; Secure; SameSite=Strict/); expect(S.readCookie('x=1; afra_groom=a.b')).toBe('a.b');
  });
});
describe('Salon plans', () => {
  const P = require('../src/plans');
  test('draft ladder 149/299/499, unlimited staff, caps work', () => {
    expect(Object.values(P.PLANS).map((p) => p.price)).toEqual([149, 299, 499]);
    for (const p of Object.values(P.PLANS)) { expect(p.staffLimit).toBe(null); expect(p.currency).toBe('INR'); }
    expect(P.checkCap('starter', 'ai', 30).ok).toBe(false); expect(P.checkCap('starter', 'ai', 29).left).toBe(1);
    expect(P.billingPlans().pro.yearly).toBe(4990);
  });
});
