// Shared fake for Phase 2 route tests: spy models (no database). Every call is recorded so tests can check the tenant filter.
const { createDineRouter } = require('../src/routes');
const TID = 'a'.repeat(24); const OTHER = 'b'.repeat(24); const OID = 'c'.repeat(24); const UID = 'd'.repeat(24);
const NOW = new Date('2026-11-12T08:00:00Z');
const NAMES = ['Tenant', 'User', 'MenuItem', 'Order', 'Counter', 'Ingredient', 'Recipe', 'Waste', 'CashEntry', 'DayClose', 'Purchase', 'SupplierPayment', 'Customer', 'Punch', 'Activity', 'Credit', 'Loyalty', 'Shift', 'Leave', 'StaffPay'];
function fakeRouter() { const r = { list: [] }; const mk = (m) => (p, h) => r.list.push({ m, p, h }); return { r, router: { use() {}, get: mk('get'), post: mk('post'), put: mk('put'), delete: mk('delete') } }; }
function Q(v) { const q = { sort: () => q, limit: () => q, select: () => q, lean: () => q, then: (a, b) => Promise.resolve(v).then(a, b) }; return q; }
function mkModels(over = {}) {
  const calls = []; const M = {};
  for (const n of NAMES) {
    M[n] = {};
    for (const meth of ['find', 'findOne', 'findById', 'findOneAndUpdate', 'updateOne', 'updateMany', 'countDocuments', 'create', 'deleteMany']) {
      M[n][meth] = (...args) => { calls.push({ model: n, meth, args }); const k = n + '.' + meth; const v = k in over ? (typeof over[k] === 'function' ? over[k](...args) : over[k]) : (meth === 'find' ? [] : meth === 'countDocuments' ? 0 : meth === 'findById' && n === 'Tenant' ? { _id: TID, venueName: 'Cafe', settings: {} } : null); return meth === 'find' ? Q(v) : Promise.resolve(v); };
    }
  }
  return { M, calls };
}
function build({ over, role = 'owner' } = {}) {
  const { r, router } = fakeRouter(); const { M, calls } = mkModels(over);
  createDineRouter({ express: { Router: () => router }, models: M, protect: 'P', tenantOf: (req) => req.user.tenantId, now: () => NOW });
  const run = async (m, p, { body, params, query, user } = {}) => {
    const route = r.list.find((x) => x.m === m && x.p === p); if (!route) throw new Error('no route ' + m + ' ' + p);
    const out = { h: {} }; const res = { set(k, v) { out.h[k] = v; return this; }, status(c) { out.c = c; return this; }, json(b) { out.b = b; return this; }, send(b) { out.text = b; return this; } };
    await route.h({ user: user || { id: UID, tenantId: TID, role: 'admin', staffRole: role }, body: body || {}, params: params || {}, query: query || {} }, res); out.status = out.c || 200; return out;
  };
  return { r, run, calls, M };
}
module.exports = { build, mkModels, TID, OTHER, OID, UID, NOW, NAMES };
