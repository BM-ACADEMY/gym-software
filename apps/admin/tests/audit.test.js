const A = require('../src/auditStore');
const { createAuditRouter } = require('../src/auditRoutes');
const now = new Date('2026-11-20T06:00:00Z');
describe('audit trail', () => {
  test('keeps only who, what and numbers; drops names, phones, emails and message text; trims long values', () => {
    const c = A.clean({ who: 'u1', action: 'marketing.add', ref: 'abc', phone: '9876543210', email: 'a@b.com', message: 'Hello Asha', password: 'x', count: 3, reason: 'r'.repeat(200) }, now);
    expect(Object.keys(c).sort().join()).toBe('action,at,count,reason,ref,who'); expect(c.reason.length).toBe(80); expect(JSON.stringify(c)).not.toMatch(/9876543210|a@b\.com|Asha|password/);
    expect(A.clean({ who: 'u' }, now)).toBe(null); expect(A.clean(null, now)).toBe(null);
  });
  test('CSV neutralises formulas and quotes commas', () => {
    const csv = A.toCsv([{ at: now, who: '=HYPERLINK("x")', action: 'a,b', ref: '+1' }]);
    expect(csv.split('\n')[0]).toBe('at,who,action,ref,count,rows,sent,updated,reason,product'); expect(csv).toMatch(/'=HYPERLINK/); expect(csv).toMatch(/"a,b"/); expect(csv).toMatch(/'\+1/);
  });
  test('routes: owner-only guard, no cache, reading and exporting are themselves recorded, CSV download headers', async () => {
    const routes = {}; const router = { use: (...m) => { routes.USE = m; }, get: (p, h) => (routes[p] = h) }; const audits = [];
    const store = { list: async (o) => { audits.push(['list', o]); return [{ at: now, who: 'u1', action: 'marketing.add', id: 'x1' }]; } };
    createAuditRouter({ express: { Router: () => router }, protect: 'P', authorize: (...r) => 'AUTH:' + r.join(), store, audit: (a) => audits.push(a), now: () => now });
    expect(routes.USE).toEqual(['P', 'AUTH:root_admin']);
    const call = async (p, query = {}) => { const out = { h: {} }; const res = { set(k, v) { if (typeof k === 'object') Object.assign(out.h, k); else out.h[k] = v; }, status(c) { out.c = c; return this; }, json(b) { out.b = b; }, send(t) { out.t = t; } }; await routes[p]({ user: { id: 'u9' }, query }, res); return out; };
    const l = await call('/list', { action: 'marketing' }); expect(l.b.data.length).toBe(1); expect(l.h['Cache-Control']).toBe('no-store');
    const e = await call('/export.csv'); expect(e.h['Content-Type']).toMatch(/text\/csv/); expect(e.h['Content-Disposition']).toMatch(/super-admin-audit-2026-11-20\.csv/); expect(e.t).toMatch(/marketing\.add/);
    expect(audits.filter((a) => a.action === 'audit.view' || a.action === 'audit.export').length).toBe(2);
  });
});
