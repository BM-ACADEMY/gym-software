// A tiny in-memory stand-in for the Mongoose models, only for tests (no database here). Supports the calls routes.js makes:
// find / findOne / create / countDocuments / updateOne / findOneAndUpdate (upsert) with equality, $in, $gte, $lte and RegExp filters.
let seq = 1;
const oid = () => (seq++).toString(16).padStart(24, '0');
const match = (doc, q) => Object.keys(q).every((k) => {
  const want = q[k]; const have = doc[k];
  if (want instanceof RegExp) return want.test(String(have));
  if (want && typeof want === 'object') {
    if ('$in' in want && !want.$in.map(String).includes(String(have))) return false;
    if ('$gte' in want && !(have >= want.$gte)) return false;
    if ('$lte' in want && !(have <= want.$lte)) return false;
    return true;
  }
  return String(have) === String(want);
});
function model() {
  const rows = [];
  const wrapDoc = (d) => ({ ...d, toObject: () => { const { toObject, ...r } = d; return { ...r }; } });
  const chain = (list) => { const c = { sort(spec) { const [k, dir] = Object.entries(spec)[0]; list.sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * dir); return c; }, limit(n) { list = list.slice(0, n); return c; }, then: (ok, bad) => Promise.resolve(list.map(wrapDoc)).then(ok, bad) }; return c; };
  return {
    rows,
    find: (q) => chain(rows.filter((r) => match(r, q))),
    findOne: async (q) => { const r = rows.find((x) => match(x, q)); return r ? wrapDoc(r) : null; },
    create: async (v) => { const d = { _id: oid(), createdAt: new Date(), ...v }; rows.push(d); return wrapDoc(d); },
    countDocuments: async (q) => rows.filter((r) => match(r, q)).length,
    updateOne: async (q, u) => { const r = rows.find((x) => match(x, q)); if (r) Object.assign(r, u.$set || {}); return { matchedCount: r ? 1 : 0 }; },
    findOneAndUpdate: async (q, u, o = {}) => { let r = rows.find((x) => match(x, q)); if (!r && o.upsert) { r = { _id: oid(), createdAt: new Date(), ...(u.$setOnInsert || {}) }; rows.push(r); } if (r) Object.assign(r, u.$set || {}); return r ? wrapDoc(r) : null; },
  };
}
const makeFakeModels = () => ({ PriceList: model(), Vehicle: model(), Attendant: model(), Job: model(), Pass: model(), CashClosing: model(), Expense: model(), Attendance: model(), UsageLog: model() });
module.exports = { makeFakeModels };
