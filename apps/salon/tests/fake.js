// A tiny in-memory stand-in for mongoose, enough to run the Salon route handlers without a database.
// It keeps unique indexes (with partialFilterExpression) so the "two people tap the same slot" case behaves like MongoDB.
// It is NOT MongoDB: the real DB tests (Dev A) are still needed.
let n = 0; const newId = () => (++n).toString(16).padStart(24, '0');
const matchVal = (v, c) => {
  if (c && typeof c === 'object' && !(c instanceof RegExp) && !Array.isArray(c) && !(c._isId)) {
    return Object.entries(c).every(([op, x]) => ({ $in: () => x.map(String).includes(String(v)), $ne: () => String(v) !== String(x), $gte: () => v >= x, $lte: () => v <= x, $lt: () => v < x, $gt: () => v > x, $type: () => typeof v === 'string' })[op]());
  }
  if (c instanceof RegExp) return c.test(String(v));
  return String(v) === String(c);
};
const matches = (doc, q) => Object.entries(q || {}).every(([k, c]) => (k === '$or' ? c.some((s) => matches(doc, s)) : matchVal(doc[k], c)));
function fakeMongoose() {
  const stores = {}; const models = {};
  class Schema { constructor(def) { this.def = def; this.idx = []; } index(f, o) { this.idx.push([f, o || {}]); } plugin() {} }
  Schema.Types = { ObjectId: 'oid', Mixed: 'mixed' };
  const mk = (name, schema) => {
    const rows = stores[name] = stores[name] || [];
    const chain = (list) => { let l = list; const c = { sort(s) { const [k, d] = Object.entries(s)[0]; l = [...l].sort((a, b) => (a[k] > b[k] ? d : a[k] < b[k] ? -d : 0)); return c; }, limit(x) { l = l.slice(0, x); return c; }, select() { return c; }, lean() { return c; }, then(res, rej) { return Promise.resolve(l.map((x) => wrap(x))).then(res, rej); } }; return c; };
    const wrap = (d) => (d ? Object.assign(d, { toObject: () => ({ ...d }) }) : d);
    const unique = (doc, skip) => { for (const [f, o] of schema.idx) { if (!o.unique) continue; const pf = o.partialFilterExpression; if (pf && !matches(doc, pf)) continue; const keys = Object.keys(f); if (keys.some((k) => doc[k] === undefined)) continue; if (rows.some((r) => r !== skip && keys.every((k) => String(r[k]) === String(doc[k])) && (!pf || matches(r, pf)))) { const e = new Error('dup'); e.code = 11000; throw e; } } };
    const M = {
      find: (q) => chain(rows.filter((r) => matches(r, q))),
      findOne: (q) => { const l = rows.filter((r) => matches(r, q)); const p = Promise.resolve(wrap(l[0] || null)); p.sort = (s) => { const [k, d] = Object.entries(s)[0]; const x = [...l].sort((a, b) => (a[k] > b[k] ? d : -d))[0]; return Promise.resolve(wrap(x || null)); }; p.lean = () => p; p.select = () => p; return p; },
      findById: (id) => { const p = Promise.resolve(wrap(rows.find((r) => String(r._id) === String(id)) || null)); p.lean = () => p; return p; },
      create: async (d) => { const doc = { _id: newId(), createdAt: new Date(), ...d }; for (const [k, v] of Object.entries(schema.def)) if (doc[k] === undefined && v && typeof v === 'object' && 'default' in v) doc[k] = typeof v.default === 'function' ? v.default() : v.default; unique(doc); rows.push(doc); return wrap(doc); },
      insertMany: async (a) => { for (const d of a) await M.create(d); },
      updateOne: async (q, u) => { const r = rows.find((x) => matches(x, q)); if (r) { Object.assign(r, u.$set || {}); unique(r, r); } return { matchedCount: r ? 1 : 0 }; },
      updateMany: async (q, u) => { rows.filter((x) => matches(x, q)).forEach((r) => Object.assign(r, u.$set || {})); },
      findOneAndUpdate: async (q, u, o = {}) => { let r = rows.find((x) => matches(x, q)); if (!r && o.upsert) { r = { _id: newId(), createdAt: new Date() }; for (const [k, v] of Object.entries(q)) if (typeof v !== 'object') r[k] = v; rows.push(r); } if (!r) return null; if (u.$inc) for (const [k, v] of Object.entries(u.$inc)) r[k] = (r[k] || 0) + v; Object.assign(r, u.$set || {}); return wrap(r); },
      deleteMany: async (q) => { for (let i = rows.length - 1; i >= 0; i -= 1) if (matches(rows[i], q)) rows.splice(i, 1); },
      countDocuments: async (q) => rows.filter((r) => matches(r, q)).length,
    };
    return M;
  };
  const mongoose = { Schema, models, Types: { ObjectId: function (v) { this.v = v; } }, model: (name, schema) => { models[name] = mk(name, schema); return models[name]; } };
  return { mongoose, stores };
}
function fakeRouter() { const routes = []; const add = (method) => (path, ...h) => routes.push({ method, path, h }); return { routes, use() {}, get: add('GET'), post: add('POST'), put: add('PUT'), patch: add('PATCH'), delete: add('DELETE') }; }
// Runs the handler chain of one route, like Express would. Returns { code, body, headers }.
async function call(router, method, path, req = {}) {
  const r = router.routes.find((x) => x.method === method && x.path === path); if (!r) throw new Error('no route ' + method + ' ' + path);
  const out = { code: 200, headers: {} }; const res = { set: (k, v) => { out.headers[k] = v; return res; }, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; return res; }, send: (b) => { out.body = b; return res; } };
  const full = { params: {}, query: {}, body: {}, ip: '1.1.1.1', ...req };
  for (const h of r.h) { let nexted = false; await h(full, res, () => { nexted = true; }); if (!nexted) break; }
  return out;
}
module.exports = { fakeMongoose, fakeRouter, call, newId };
