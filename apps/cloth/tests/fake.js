// Tiny in-memory stand-ins for Mongoose models and express, for plain-node route tests. Not a database: only what the routes use.
let n = 0; const oid = () => (++n).toString(16).padStart(24, '0');
const eq = (a, b) => String(a) === String(b);
const match = (doc, q) => Object.entries(q).every(([k, v]) => {
  const x = doc[k]; if (k === 'isActive' && x === undefined) return v === true; // schema default
  if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v) && Object.keys(v).some((o) => o[0] === '$')) {
    return Object.entries(v).every(([op, y]) => (op === '$gte' ? x >= y : op === '$lte' ? x <= y : op === '$lt' ? x < y : op === '$in' ? y.some((z) => eq(z, x)) : op === '$ne' ? !eq(x, y) : op === '$exists' ? (x !== undefined) === y : true));
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
    findOne: (f = {}) => one(rows.find((d) => match(d, f))),
    create: async (v) => { const d = { _id: oid(), ...v }; rows.push(d); return wrapDoc({ ...d }); },
    findOneAndUpdate: async (f, u, o = {}) => { let d = rows.find((x) => match(x, f)); if (!d) { if (!o.upsert) return null; d = { _id: oid(), ...Object.fromEntries(Object.entries(f).filter(([, v]) => typeof v !== 'object')) }; rows.push(d); } Object.assign(d, u.$set || {}); return { ...d }; },
    updateOne: async (f, u, o = {}) => { let d = rows.find((x) => match(x, f)); if (!d && o.upsert) { d = { _id: oid(), ...f }; rows.push(d); } if (d) Object.assign(d, u.$set || {}); },
  };
}
const mkRouter = () => { const r = {}; return { r, router: { use() {}, get: (p, h) => (r['GET ' + p] = h), post: (p, h) => (r['POST ' + p] = h), put: (p, h) => (r['PUT ' + p] = h) } }; };
const call = async (h, req = {}) => { const o = { h: {} }; await h({ user: { id: 'u1', tenantId: 'a' }, params: {}, query: {}, body: {}, method: 'GET', ...req }, { set(k, v) { o.h[k] = v; }, status(c) { o.c = c; return this; }, json(b) { o.b = b; o.c = o.c || 200; }, send(b) { o.text = b; o.c = o.c || 200; } }); return o; };
module.exports = { model, mkRouter, call, oid };
