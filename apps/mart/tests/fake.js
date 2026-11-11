// Tiny in-memory stand-ins for Mongoose models and express, for plain-node route tests. Not a database: only what the routes use.
let n = 0; const oid = () => (++n).toString(16).padStart(24, '0');
const eq = (a, b) => String(a) === String(b);
const match = (doc, q) => Object.entries(q).every(([k, v]) => {
  if (k === '$expr') { const [[op, [a, b]]] = Object.entries(v); const g = (x) => (typeof x === 'string' && x[0] === '$' ? doc[x.slice(1)] : x); return op === '$gt' ? g(a) > g(b) : false; }
  const x = doc[k];
  if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v) && Object.keys(v).some((o) => o[0] === '$')) {
    return Object.entries(v).every(([op, y]) => (op === '$gte' ? x >= y : op === '$lte' ? x <= y : op === '$lt' ? x < y : op === '$gt' ? x > y : op === '$in' ? y.some((z) => eq(z, x)) : op === '$ne' ? !eq(x, y) : op === '$exists' ? (y ? x !== undefined : x === undefined) : true));
  }
  return eq(x, v);
});
const apply = (d, u) => {
  Object.assign(d, u.$set || {});
  for (const [k, v] of Object.entries(u.$inc || {})) d[k] = (d[k] || 0) + v;
  for (const [k, v] of Object.entries(u.$push || {})) { d[k] = [...(d[k] || []), { _id: oid(), ...v }]; }
  for (const [k, v] of Object.entries(u.$pull || {})) d[k] = (d[k] || []).filter((e) => !Object.entries(v).every(([kk, vv]) => eq(e[kk], vv)));
};
function model() {
  const rows = [];
  const wrapDoc = (d) => d && Object.assign(d, { toObject() { return { ...d }; } });
  const q = (list) => { const o = { _l: list, sort(s) { const [[k, dir]] = Object.entries(s || {}); o._l = [...o._l].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (dir < 0 ? -1 : 1)); return o; }, limit(k) { o._l = o._l.slice(0, k); return o; }, select() { return o; }, lean() { return o; }, then(res, rej) { return Promise.resolve(o._l.map((d) => ({ ...d }))).then(res, rej); } }; return o; };
  const one = (d) => ({ lean() { return this; }, sort() { return this; }, select() { return this; }, then(res, rej) { return Promise.resolve(d ? { ...d } : null).then(res, rej); } });
  return {
    rows,
    find: (f = {}) => q(rows.filter((d) => match(d, f))),
    findOne: (f = {}) => one(rows.find((d) => match(d, f))),
    create: async (v) => { const d = { _id: oid(), createdAt: new Date(), ...v }; rows.push(d); return wrapDoc({ ...d }); },
    updateOne: async (f, u, o = {}) => { let d = rows.find((x) => match(x, f)); if (!d && o.upsert) { d = { _id: oid(), ...Object.fromEntries(Object.entries(f).filter(([k, v]) => typeof v !== 'object' || v === null)) }; rows.push(d); } if (d) apply(d, u); },
    findOneAndUpdate: async (f, u, o = {}) => { let d = rows.find((x) => match(x, f)); if (!d && o.upsert) { d = { _id: oid(), ...f }; rows.push(d); } if (d) apply(d, u); return d || null; },
  };
}
const mkRouter = () => { const r = {}; const h = (m) => (p, ...f) => { r[m + ' ' + p] = f[f.length - 1]; }; return { r, router: { use() {}, get: h('GET'), post: h('POST'), put: h('PUT'), delete: h('DELETE') } }; };
const call = async (h, req = {}) => { const o = { h: {}, c: 200 }; await h({ user: { id: 'u1', tenantId: 'a', role: 'admin' }, params: {}, query: {}, body: {}, method: 'GET', ...req }, { set(k, v) { o.h[k] = v; }, status(c) { o.c = c; return this; }, json(b) { o.b = b; }, send(b) { o.text = b; } }); return o; };
module.exports = { model, mkRouter, call, oid };
