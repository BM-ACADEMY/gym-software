// Tiny in-memory stand-ins for Mongoose models and express, for plain-node route tests. Not a database: only what the routes use.
let n = 0; const oid = () => (++n).toString(16).padStart(24, '0');
const eq = (a, b) => String(a) === String(b);
const match = (doc, q) => Object.entries(q).every(([k, v]) => {
  const x = doc[k]; if (k === 'isActive' && x === undefined) return v === true; // schema default
  if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v) && Object.keys(v).some((o) => o[0] === '$')) {
    return Object.entries(v).every(([op, y]) => (op === '$gte' ? x >= y : op === '$lte' ? x <= y : op === '$lt' ? x < y : op === '$gt' ? x > y : op === '$in' ? y.some((z) => eq(z, x)) : op === '$ne' ? !eq(x, y) : op === '$exists' ? (x !== undefined) === y : true));
  }
  return eq(x, v);
});
function model() {
  const rows = [];
  const wrapDoc = (d) => d && Object.assign(d, { toObject() { return { ...d }; } });
  const q = (list) => { const o = { _l: list, sort() { return o; }, limit(k) { o._l = o._l.slice(0, k); return o; }, select() { return o; }, lean() { return o; }, then(res, rej) { return Promise.resolve(o._l.map((d) => ({ ...d }))).then(res, rej); } }; return o; };
  const one = (d) => ({ lean() { return this; }, then(res, rej) { return Promise.resolve(d ? { ...d, save: async () => {} } : null).then(res, rej); } });
  return {
    rows,
    find: (f = {}) => q(rows.filter((d) => match(d, f))),
    findById: (id) => one(rows.find((d) => eq(d._id, id))),
    findOne: (f = {}) => one(rows.find((d) => match(d, f))),
    create: async (v) => { const d = { _id: oid(), ...v }; rows.push(d); return wrapDoc({ ...d }); },
    findOneAndUpdate: async (f, u, o = {}) => { let d = rows.find((x) => match(x, f)); if (!d) { if (!o.upsert) return null; d = { _id: oid(), ...Object.fromEntries(Object.entries(f).filter(([, v]) => typeof v !== 'object')) }; rows.push(d); } Object.assign(d, u.$set || {}); for (const [k, v] of Object.entries(u.$inc || {})) d[k] = (d[k] || 0) + v; return { ...d }; },
    updateOne: async (f, u, o = {}) => { let d = rows.find((x) => match(x, f)); if (!d && o.upsert) { d = { _id: oid(), ...f }; rows.push(d); } if (d) { Object.assign(d, u.$set || {}); Object.keys(u.$unset || {}).forEach((k) => delete d[k]); } },
    updateMany: async (f, u) => { rows.filter((x) => match(x, f)).forEach((d) => { Object.assign(d, u.$set || {}); Object.keys(u.$unset || {}).forEach((k) => delete d[k]); }); },
  };
}
const mkRouter = () => { const r = {}; const mw = []; return { r, mw, router: { use: (...h) => { mw.push(...h.filter((x) => typeof x === 'function')); }, get: (p, ...h) => (r['GET ' + p] = h), post: (p, ...h) => (r['POST ' + p] = h), put: (p, ...h) => (r['PUT ' + p] = h), patch() {}, delete: (p, ...h) => (r['DELETE ' + p] = h) } }; };
// Runs the router-level middleware, then the route's own handlers in order, like express would.
const run = async (mw, hs, req = {}) => { const o = { h: {} }; const rq = { user: { id: 'u1', tenantId: 'a', role: 'admin' }, params: {}, query: {}, body: {}, method: 'GET', path: '/', ...req }; const rs = { statusCode: 200, set(k, v) { o.h[k] = v; }, status(c) { o.c = c; this.statusCode = c; return this; }, json(b) { o.b = b; o.c = o.c || 200; }, send(b) { o.text = b; o.c = o.c || 200; } }; const chain = [...mw, ...hs]; let i = 0; const next = async () => { const f = chain[i++]; if (f) await f(rq, rs, next); }; await next(); return o; };
const call = async (h, req = {}) => { const o = { h: {} }; await h({ user: { id: 'u1', tenantId: 'a' }, params: {}, query: {}, body: {}, method: 'GET', ...req }, { statusCode: 200, set(k, v) { o.h[k] = v; }, status(c) { o.c = c; this.statusCode = c; return this; }, json(b) { o.b = b; o.c = o.c || 200; }, send(b) { o.text = b; o.c = o.c || 200; } }); return o; };
module.exports = { model, mkRouter, call, run, oid };
