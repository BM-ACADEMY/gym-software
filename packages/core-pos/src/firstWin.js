'use strict';
// "First win in five minutes" and the set-up checklist, shared by Salon, Mart, Dine, Cloth and Wash (PRODUCT_PRINCIPLES sections 3 and 5).
// The first screen shows ONE truthful number from the owner's own records. If they have none yet it shows a number that is
// clearly labelled "Sample", never presented as theirs. Sample data can be loaded and removed in one tap; sample records are
// listed by id in the setup record, so removal deletes exactly those and nothing else. Written, not yet tested by a person.
//
// The product supplies a `config`:
//   product            'salon' | 'mart' | 'dine' | 'cloth' | 'wash'
//   steps              [{ key, manual? }]  in order; a manual step is ticked by the owner, the others are worked out from records
//   auto(tid)          -> { [stepKey]: boolean } for the non-manual steps
//   metric(tid, ids)   -> { haveReal, count, rupees }  from the owner's OWN records (ids = sample record ids to leave out)
//   sampleDefaults     { count, rupees }  shown when there are no records of their own
//   hasRealActivity(tid, ids) -> boolean   (refuses sample data when the owner already has real records)
//   loadSample(tid, ids) / removeSample(tid, ids)   create and delete sample records (ids is filled as records are made)
//   audit(tid, req, action)  optional
const S = require('./firstWinStrings');

const DAY = 864e5;
const istToday = (now = new Date()) => new Date(new Date(now).getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);

// ---------- pure ----------
function buildSetup({ steps, autoDone = {}, marks = {}, lang = 'en' }) {
  const l = S.norm(lang);
  const rows = steps.map((st) => {
    const done = st.manual ? marks[st.key] === true : autoDone[st.key] === true;
    return { id: st.key, key: st.key, label: S.t('steps.' + st.key, null, l), done, status: done ? S.t('done', null, l) : S.t('todo', null, l), manual: !!st.manual, mark: st.manual && !done ? 'yes' : 'no' };
  });
  const doneCount = rows.filter((r) => r.done).length;
  const percent = rows.length ? Math.round((doneCount * 100) / rows.length) : 0;
  const nextRow = rows.find((r) => !r.done) || null; // ONE next action: the first step not done
  return { steps: rows, doneCount, total: rows.length, percent, next: nextRow ? { key: nextRow.key, label: nextRow.label } : null, complete: !nextRow };
}

function buildFirstWin({ product, metric, sampleDefaults, sampleOn = false, lang = 'en' }) {
  const l = S.norm(lang); const k = 'headline.' + product;
  const real = !!(metric && metric.haveReal);
  const count = real ? metric.count : sampleDefaults.count;
  const rupees = real ? (Number.isInteger(metric.rupees) && metric.rupees > 0 ? metric.rupees : null) : sampleDefaults.rupees;
  const vars = { count, rupees: rupees == null ? '' : S.inr(rupees) };
  let headline; let money = '';
  if (!real) { headline = S.t(k + '.sample', vars, l); }
  else if (count === 0) { headline = S.t(k + '.zero', vars, l); }
  else { headline = S.t(k + '.real', vars, l); if (rupees) money = S.t(k + '.money', vars, l); }
  return { mode: real ? 'real' : 'sample', headline, money, label: real ? '' : S.t('sampleLabel', null, l), count, rupees: real && count === 0 ? null : rupees, currency: 'INR', sampleOn: !!sampleOn, note: sampleOn ? S.t('sampleOnNote', null, l) : '' };
}

// What the stats screen reads: attention lines (the number, the money, the sample label, the ONE next step), cards and a steps table.
function screenData({ firstWin, setup, lang = 'en' }) {
  const l = S.norm(lang); const attention = [];
  attention.push({ level: 'watch', text: firstWin.headline });
  if (firstWin.money) attention.push({ level: 'watch', text: firstWin.money });
  if (firstWin.label) attention.push({ level: 'watch', text: firstWin.label });
  if (firstWin.note) attention.push({ level: 'watch', text: firstWin.note });
  attention.push({ level: 'watch', text: setup.next ? S.t('next', null, l) + ': ' + setup.next.label : S.t('allDone', null, l) });
  return { ...firstWin, attention, percent: setup.percent, doneCount: setup.doneCount, total: setup.total, next: setup.next, steps: setup.steps };
}

// ---------- the setup record (one per business) ----------
function makeSetupModel(mongoose) {
  if (mongoose.models.PosSetup) return mongoose.models.PosSetup;
  const { Schema } = mongoose;
  const s = new Schema({ tenantId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true }, marks: { type: Schema.Types.Mixed, default: {} }, sample: { on: { type: Boolean, default: false }, ids: { type: Schema.Types.Mixed, default: {} }, at: Date } }, { timestamps: true });
  return mongoose.model('PosSetup', s);
}

// ---------- routes (owner only; mount on the product's own /api/<product>) ----------
// Each route carries its own middleware, so this router never touches requests meant for the product's other routers.
function createFirstWinRouter({ express, mongoose, protect, tenantOf, guardWrite, config, ownerRole = 'admin', models }) {
  const router = express.Router(); const Setup = (models && models.Setup) || makeSetupModel(mongoose);
  const fail = (res, code, message) => res.status(code).json({ success: false, message });
  const ownerOnly = (req, res, next) => (req.user && req.user.role === ownerRole ? next() : fail(res, 403, 'Only the owner can do this.'));
  const writeOk = (req, res, next) => { if (!guardWrite) return next(); const g = guardWrite(req); return g.ok ? next() : res.status(g.httpStatus || 402).json({ success: false, message: g.message, code: 'read_only' }); };
  const lang = (req) => S.norm(req.query && req.query.lang);
  const run = (fn) => async (req, res) => { try { await fn(req, res, tenantOf(req)); } catch (err) { console.error(config.product + ' first-win route failed:', err.message); fail(res, 500, 'Server error'); } };
  const manualKeys = config.steps.filter((x) => x.manual).map((x) => x.key);
  const stateOf = async (tid) => { const d = await Setup.findOne({ tenantId: tid }).lean(); return { marks: (d && d.marks) || {}, sampleOn: !!(d && d.sample && d.sample.on), ids: (d && d.sample && d.sample.ids) || {} }; };
  const compute = async (tid, l) => {
    const st = await stateOf(tid);
    const [autoDone, metric] = await Promise.all([config.auto(tid, st.ids), config.metric(tid, st.ids)]);
    const setup = buildSetup({ steps: config.steps, autoDone, marks: st.marks, lang: l });
    const firstWin = buildFirstWin({ product: config.product, metric, sampleDefaults: config.sampleDefaults, sampleOn: st.sampleOn, lang: l });
    return { st, setup, firstWin };
  };

  router.get('/first-win', protect, ownerOnly, run(async (req, res, tid) => { const l = lang(req); const { setup, firstWin } = await compute(tid, l); res.set('Cache-Control', 'no-store'); res.json({ success: true, data: screenData({ firstWin, setup, lang: l }) }); }));
  router.get('/setup', protect, ownerOnly, run(async (req, res, tid) => { const { setup } = await compute(tid, lang(req)); res.set('Cache-Control', 'no-store'); res.json({ success: true, data: setup }); }));
  router.get('/setup/steps', protect, ownerOnly, run(async (req, res, tid) => { const { setup } = await compute(tid, lang(req)); res.set('Cache-Control', 'no-store'); res.json({ success: true, data: setup.steps }); }));

  router.post('/setup/steps/:key/done', protect, ownerOnly, writeOk, run(async (req, res, tid) => {
    const key = String(req.params.key || '');
    if (!manualKeys.includes(key)) return fail(res, 400, 'That step is ticked automatically when you do it.');
    await Setup.findOneAndUpdate({ tenantId: tid }, { $set: { ['marks.' + key]: true } }, { upsert: true });
    res.json({ success: true });
  }));

  router.post('/setup/sample', protect, ownerOnly, writeOk, run(async (req, res, tid) => {
    const l = lang(req); const st = await stateOf(tid);
    if (st.sampleOn) return fail(res, 409, S.t('sampleAlready', null, l));
    if (await config.hasRealActivity(tid, st.ids)) return fail(res, 400, S.t('sampleHasRealData', null, l));
    const ids = {};
    try { await config.loadSample(tid, ids); } catch (err) { await Promise.resolve(config.removeSample(tid, ids)).catch(() => {}); throw err; } // never leave half a sample behind
    await Setup.findOneAndUpdate({ tenantId: tid }, { $set: { 'sample.on': true, 'sample.ids': ids, 'sample.at': new Date() } }, { upsert: true });
    if (config.audit) await Promise.resolve(config.audit(tid, req, 'setup.sample_load')).catch(() => {});
    res.json({ success: true, message: S.t('sampleLoaded', null, l) });
  }));

  router.post('/setup/sample/remove', protect, ownerOnly, writeOk, run(async (req, res, tid) => {
    const l = lang(req); const st = await stateOf(tid);
    if (st.sampleOn) { await config.removeSample(tid, st.ids); await Setup.findOneAndUpdate({ tenantId: tid }, { $set: { 'sample.on': false, 'sample.ids': {} } }); }
    if (st.sampleOn && config.audit) await Promise.resolve(config.audit(tid, req, 'setup.sample_remove')).catch(() => {});
    res.json({ success: true, message: S.t('sampleRemoved', null, l) });
  }));
  return router;
}

module.exports = { buildSetup, buildFirstWin, screenData, makeSetupModel, createFirstWinRouter, istToday, daysBetween, addDays };
