// Express routers for Hire. A product mounts them like this:
//   app.use('/api/hire', createHireRouter({ express, mongoose, protect, authorize, tenantOf, planOf, ai, budget }));
//   app.use('/api/hire-share', createSharePublicRouter({ express, mongoose }));   // no sign-in: the secret link is the key
// Every query filters by tenantId. protect/authorize/ai/budget are injected so this package imports no product code.
const crypto = require('crypto');
const { runWithTenant, runUnscoped } = require('../../../packages/core-server/src');
const makeModels = require('./models');
const C = require('./candidate');
const { validateParsed } = require('./parse');
const { rankCandidates } = require('./rank');
const { addReasons } = require('./reasonService');
const pipeline = require('./pipeline');
const marketingIdeas = require('./marketingIdeas');
const { placementFee, dueDate } = require('./fees');
const { checkCap } = require('./plans');
const { parseResume } = require('./resumeService');
const autopilot = require('./autopilot');
const consent = require('./consent');
const extract = require('./extract');
const consentForm = require('./consentForm');

const str = (v, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const monthStart = () => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)); };
const KNOWN = ['PARSE_NO_JSON', 'PARSE_BAD_JSON', 'RESUME_EMPTY', 'CAP_REACHED', 'AI_OFF', 'TENANT_REQUIRED', 'PIPELINE_STAGE', 'PIPELINE_TRANSITION', 'PIPELINE_REASON', 'FEE_INVALID', 'CONSENT_SOURCE', 'PLAN_UNKNOWN', 'FILE_EMPTY', 'FILE_TOO_BIG', 'FILE_TYPE', 'FILE_UNREADABLE', 'FILE_NO_TEXT'];

function toPlain(d) { const o = d && d.toObject ? d.toObject() : d; return o ? { ...o, id: String(o._id) } : o; }

function createHireRouter({ express, mongoose, protect, authorize, tenantOf, planOf, ai, budget, guardWrite, roles = ['admin', 'subadmin'] }) {
  const router = express.Router();
  const M = makeModels(mongoose);
  router.use(protect, authorize(...roles));
  // Expired or suspended accounts can read but not change anything (guardWrite comes from @afra/core-billing).
  if (guardWrite) router.use((req, res, next) => {
    const g = guardWrite(req);
    return g.ok ? next() : res.status(g.httpStatus || 402).json({ success: false, message: g.message, code: 'read_only' });
  });
  const fail = (res, code, message) => res.status(code).json({ success: false, message });
  const wrap = (fn) => async (req, res) => {
    try { await fn(req, res, tenantOf(req)); } catch (err) {
      if (err.code === 'CAP_REACHED') return fail(res, 429, 'Monthly limit reached for your plan.');
      if (err.code === 'AI_OFF') return fail(res, 503, 'AI is off right now. Fill the candidate in by hand.');
      if (KNOWN.includes(err.code)) return fail(res, 400, err.message);
      if (err.code === 11000) return fail(res, 409, 'That value is already used.');
      if (err.name === 'ValidationError' || err.name === 'CastError') return fail(res, 400, 'Check the values you entered.');
      console.error('Hire route failed:', err.message);
      return fail(res, 500, 'Server error');
    }
  };
  const countUsed = (tid, kind) => M.UsageLog.countDocuments({ tenantId: tid, kind, createdAt: { $gte: monthStart() } });

  // ---- candidates ----
  router.get('/candidates', wrap(async (req, res, tid) => {
    const q = { tenantId: tid }; const s = str(req.query.q, 40);
    if (s) { const re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); q.$or = [{ name: re }, { skills: re }, { location: re }]; }
    const rows = await M.Candidate.find(q).sort({ createdAt: -1 }).limit(100);
    // Phones are masked in lists. Full phone only on the single-candidate view.
    res.json({ success: true, data: rows.map((c) => ({ ...toPlain(c), phone: c.phone ? c.phone.slice(0, 3) + '*****' + c.phone.slice(-2) : null })) });
  }));
  router.post('/candidates', wrap(async (req, res, tid) => {
    const b = req.body || {}; const { candidate } = validateParsed(b);
    if (!candidate.name) return fail(res, 400, 'Name is needed.');
    const existing = await M.Candidate.find({ tenantId: tid, $or: [{ phone: candidate.phone || '__none' }, { email: candidate.email || '__none' }] });
    const dup = C.findDuplicate(candidate, existing.map(toPlain));
    if (dup) return res.status(409).json({ success: false, message: 'This candidate already exists.', data: { id: dup.match.id, by: dup.by } });
    const doc = await M.Candidate.create({ ...candidate, tenantId: tid, source: 'manual', reviewed: true, consent: b.consentSource ? consent.consentRecord({ source: b.consentSource, purposeAi: !!b.purposeAi }) : undefined });
    res.status(201).json({ success: true, data: toPlain(doc) });
  }));
  const parseDeps = (req) => ({
      ai, budget,
      usage: { countThisMonth: (t, k) => countUsed(t, k), record: (t, r) => M.UsageLog.create({ tenantId: t, kind: r.kind, model: r.model, inTokens: r.usage.inTokens, outTokens: r.usage.outTokens }) },
      candidates: {
        list: async (t) => (await M.Candidate.find({ tenantId: t })).map(toPlain),
        create: async (t, c) => toPlain(await M.Candidate.create({ ...c, tenantId: t })),
        update: async (t, id, c) => { const { id: _i, _id, tenantId, ...rest } = c; await M.Candidate.updateOne({ _id: id, tenantId: t }, { $set: rest }); },
      },
    });
  // Upload a resume as base64 JSON (fileBase64). The server must allow a JSON body of about 6 MB on this path.
  router.post('/candidates/parse-file', wrap(async (req, res, tid) => {
    let out;
    try { out = await extract.extractText(extract.fromBase64(req.body && req.body.fileBase64)); }
    catch (e) { if (e.code === 'READER_MISSING') return fail(res, 503, e.message); throw e; }
    const r = await parseResume({ tenantId: tid, plan: planOf(req), text: out.text, consentSource: req.body.consentSource }, parseDeps(req));
    res.status(r.action === 'created' ? 201 : 200).json({ success: true, data: r });
  }));
  router.post('/candidates/parse', wrap(async (req, res, tid) => {
    const plan = planOf(req);
    const deps = {
      ai, budget,
      usage: { countThisMonth: (t, k) => countUsed(t, k), record: (t, r) => M.UsageLog.create({ tenantId: t, kind: r.kind, model: r.model, inTokens: r.usage.inTokens, outTokens: r.usage.outTokens }) },
      candidates: {
        list: async (t) => (await M.Candidate.find({ tenantId: t })).map(toPlain),
        create: async (t, c) => toPlain(await M.Candidate.create({ ...c, tenantId: t })),
        update: async (t, id, c) => { const { id: _i, _id, tenantId, ...rest } = c; await M.Candidate.updateOne({ _id: id, tenantId: t }, { $set: rest }); },
      },
    };
    const out = await parseResume({ tenantId: tid, plan, text: req.body && req.body.text, consentSource: req.body && req.body.consentSource }, deps);
    res.status(out.action === 'created' ? 201 : 200).json({ success: true, data: out });
  }));
  router.get('/candidates/:id', wrap(async (req, res, tid) => {
    const c = await M.Candidate.findOne({ _id: req.params.id, tenantId: tid });
    if (!c) return fail(res, 404, 'Candidate not found');
    res.json({ success: true, data: toPlain(c) });
  }));
  router.patch('/candidates/:id', wrap(async (req, res, tid) => {
    const { candidate } = validateParsed({ ...(await M.Candidate.findOne({ _id: req.params.id, tenantId: tid }) || {}).toObject?.(), ...req.body });
    const set = { ...candidate, reviewed: true };
    if (req.body && typeof req.body.doNotContact === 'boolean') set.doNotContact = req.body.doNotContact;
    const c = await M.Candidate.findOneAndUpdate({ _id: req.params.id, tenantId: tid }, { $set: set }, { new: true });
    if (!c) return fail(res, 404, 'Candidate not found');
    res.json({ success: true, data: toPlain(c) });
  }));
  // One-time link the agency sends to the candidate (by hand; nothing is sent from here). Only the hash is stored; the link is shown once.
  router.post('/candidates/:id/consent-link', wrap(async (req, res, tid) => {
    const token = consentForm.newToken(); const expires = new Date(Date.now() + consentForm.LINK_DAYS * 864e5);
    const c = await M.Candidate.findOneAndUpdate({ _id: req.params.id, tenantId: tid }, { $set: { consentLinkHash: consentForm.hash(token), consentLinkExpires: expires, consentLinkUsedAt: null } }, { new: true });
    if (!c) return fail(res, 404, 'Candidate not found');
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, message: `Send this link to the candidate yourself (works once, ${consentForm.LINK_DAYS} days): https://${req.get('host')}/consent/${token}`, data: { path: `/consent/${token}`, expiresAt: expires } });
  }));
  router.post('/candidates/:id/withdraw-consent', wrap(async (req, res, tid) => {
    const c = await M.Candidate.findOneAndUpdate({ _id: req.params.id, tenantId: tid, consent: { $ne: null } }, { $set: { 'consent.withdrawnAt': new Date(), doNotContact: true } }, { new: true });
    if (!c) return fail(res, 404, 'Candidate or consent not found');
    res.json({ success: true, data: toPlain(c) });
  }));
  router.delete('/candidates/:id', wrap(async (req, res, tid) => {
    const c = await M.Candidate.findOneAndDelete({ _id: req.params.id, tenantId: tid });
    if (!c) return fail(res, 404, 'Candidate not found');
    await M.Entry.deleteMany({ tenantId: tid, candidateId: c._id });
    res.json({ success: true });
  }));

  // ---- clients and jobs ----
  router.get('/clients', wrap(async (req, res, tid) => res.json({ success: true, data: (await M.Client.find({ tenantId: tid }).sort({ name: 1 })).map((c) => ({ ...toPlain(c), shareToken: undefined, hasShareLink: !!c.shareToken })) })));
  router.post('/clients', wrap(async (req, res, tid) => {
    const b = req.body || {};
    const c = await M.Client.create({ tenantId: tid, name: str(b.name), contactName: str(b.contactName), feeType: b.feeType === 'flat' ? 'flat' : 'percent', feeValue: Number(b.feeValue) || 0, guaranteeDays: Number(b.guaranteeDays) || 30 });
    res.status(201).json({ success: true, data: toPlain(c) });
  }));
  router.patch('/clients/:id', wrap(async (req, res, tid) => {
    const b = req.body || {}; const set = {};
    if (b.name !== undefined) { set.name = str(b.name); if (!set.name) return fail(res, 400, 'Name is needed.'); }
    if (b.contactName !== undefined) set.contactName = str(b.contactName);
    if (b.feeType !== undefined) set.feeType = b.feeType === 'flat' ? 'flat' : 'percent';
    if (b.feeValue !== undefined) set.feeValue = Number(b.feeValue) || 0;
    if (b.guaranteeDays !== undefined) set.guaranteeDays = Number(b.guaranteeDays) || 30;
    const c = await M.Client.findOneAndUpdate({ _id: req.params.id, tenantId: tid }, { $set: set }, { new: true });
    if (!c) return fail(res, 404, 'Client not found');
    res.json({ success: true, data: { ...toPlain(c), shareToken: undefined, hasShareLink: !!c.shareToken } });
  }));
  router.post('/clients/:id/share-link', wrap(async (req, res, tid) => {
    const token = crypto.randomBytes(24).toString('hex'); // 192 bits: cannot be guessed; a new call replaces the old link
    const c = await M.Client.findOneAndUpdate({ _id: req.params.id, tenantId: tid }, { $set: { shareToken: token } }, { new: true });
    if (!c) return fail(res, 404, 'Client not found');
    res.json({ success: true, data: { token } });
  }));
  router.delete('/clients/:id/share-link', wrap(async (req, res, tid) => {
    const c = await M.Client.findOneAndUpdate({ _id: req.params.id, tenantId: tid }, { $unset: { shareToken: 1 } });
    if (!c) return fail(res, 404, 'Client not found');
    res.json({ success: true });
  }));
  router.get('/jobs', wrap(async (req, res, tid) => res.json({ success: true, data: (await M.Job.find({ tenantId: tid }).sort({ createdAt: -1 })).map(toPlain) })));
  router.post('/jobs', wrap(async (req, res, tid) => {
    const b = req.body || {};
    if (b.clientId && !(await M.Client.exists({ _id: b.clientId, tenantId: tid }))) return fail(res, 400, 'Client not found');
    const arr = (v) => (Array.isArray(v) ? v.map((x) => str(x, 40).toLowerCase()).filter(Boolean).slice(0, 30) : []);
    const j = await M.Job.create({ tenantId: tid, clientId: b.clientId || undefined, title: str(b.title), location: str(b.location, 80), openings: Number(b.openings) || 1, mustSkills: arr(b.mustSkills), niceSkills: arr(b.niceSkills), minExperience: num(b.minExperience), maxExperience: num(b.maxExperience), maxCtc: num(b.maxCtc), maxNoticeDays: num(b.maxNoticeDays) });
    res.status(201).json({ success: true, data: toPlain(j) });
  }));
  router.patch('/jobs/:id', wrap(async (req, res, tid) => {
    const b = req.body || {}; const set = {};
    const arr = (v) => (Array.isArray(v) ? v.map((x) => str(x, 40).toLowerCase()).filter(Boolean).slice(0, 30) : []);
    if (b.title !== undefined) { set.title = str(b.title); if (!set.title) return fail(res, 400, 'Job title is needed.'); }
    if (b.location !== undefined) set.location = str(b.location, 80);
    if (b.openings !== undefined) set.openings = Number(b.openings) || 1;
    if (b.mustSkills !== undefined) set.mustSkills = arr(b.mustSkills);
    if (b.niceSkills !== undefined) set.niceSkills = arr(b.niceSkills);
    for (const k of ['minExperience', 'maxExperience', 'maxCtc', 'maxNoticeDays']) if (b[k] !== undefined) set[k] = num(b[k]);
    if (['open', 'on_hold', 'filled', 'closed'].includes(b.status)) set.status = b.status;
    const j = await M.Job.findOneAndUpdate({ _id: req.params.id, tenantId: tid }, { $set: set }, { new: true });
    if (!j) return fail(res, 404, 'Job not found');
    res.json({ success: true, data: toPlain(j) });
  }));
  router.post('/jobs/:id/rank', wrap(async (req, res, tid) => {
    const job = await M.Job.findOne({ _id: req.params.id, tenantId: tid });
    if (!job) return fail(res, 404, 'Job not found');
    const cap = checkCap(planOf(req), 'rank', await countUsed(tid, 'rank'));
    if (!cap.ok) return fail(res, 429, 'Monthly ranking limit reached for your plan.');
    const cands = await M.Candidate.find({ tenantId: tid, reviewed: true, doNotContact: { $ne: true } }).limit(500);
    const ranked = rankCandidates(toPlain(job), cands.map((c) => ({ ...toPlain(c), id: String(c._id) }))).slice(0, 20);
    const withReasons = await addReasons(toPlain(job), ranked, { ai, budget });
    await M.UsageLog.create({ tenantId: tid, kind: 'rank', model: withReasons.model || 'rules', inTokens: withReasons.usage && withReasons.usage.inTokens, outTokens: withReasons.usage && withReasons.usage.outTokens });
    res.json({ success: true, data: withReasons.items, remaining: cap.left - 1 });
  }));

  // ---- pipeline ----
  router.post('/entries', wrap(async (req, res, tid) => {
    const { jobId, candidateId } = req.body || {};
    const [job, cand] = await Promise.all([M.Job.exists({ _id: jobId, tenantId: tid }), M.Candidate.exists({ _id: candidateId, tenantId: tid })]);
    if (!job || !cand) return fail(res, 404, 'Job or candidate not found');
    const e = await M.Entry.create({ tenantId: tid, jobId, candidateId, stage: 'sourced', stageAt: new Date(), history: [] });
    res.status(201).json({ success: true, data: toPlain(e) });
  }));
  router.get('/jobs/:id/entries', wrap(async (req, res, tid) => res.json({ success: true, data: (await M.Entry.find({ tenantId: tid, jobId: req.params.id })).map(toPlain) })));
  router.post('/entries/:id/move', wrap(async (req, res, tid) => {
    const e = await M.Entry.findOne({ _id: req.params.id, tenantId: tid });
    if (!e) return fail(res, 404, 'Entry not found');
    const next = pipeline.move(toPlain(e), String(req.body.to || ''), { by: String(req.user && req.user.id || ''), reason: str(req.body.reason, 200) });
    e.stage = next.stage; e.stageAt = next.stageAt; e.history = next.history;
    if (typeof req.body.otherOffers === 'boolean') e.otherOffers = req.body.otherOffers;
    if (Number.isInteger(req.body.offeredCtc)) e.offeredCtc = req.body.offeredCtc;
    await e.save();
    if (next.stage === 'submitted') await M.Job.updateOne({ _id: e.jobId, tenantId: tid }, { $set: { lastSubmissionAt: new Date() } });
    res.json({ success: true, data: toPlain(e) });
  }));
  router.patch('/entries/:id/note', wrap(async (req, res, tid) => {
    const e = await M.Entry.findOneAndUpdate({ _id: req.params.id, tenantId: tid }, { $set: { note: str(req.body.note, 500) } }, { new: true });
    if (!e) return fail(res, 404, 'Entry not found');
    res.json({ success: true, data: toPlain(e) });
  }));

  router.get('/entries', wrap(async (req, res, tid) => {
    const q = { tenantId: tid }; if (req.query.jobId) q.jobId = String(req.query.jobId);
    const entries = await M.Entry.find(q).sort({ stageAt: -1 }).limit(300).lean();
    const [cands, jobs] = await Promise.all([M.Candidate.find({ tenantId: tid, _id: { $in: entries.map((e) => e.candidateId) } }).select('name').lean(), M.Job.find({ tenantId: tid, _id: { $in: entries.map((e) => e.jobId) } }).select('title').lean()]);
    const cn = {}; cands.forEach((c) => { cn[String(c._id)] = c.name; }); const jt = {}; jobs.forEach((j) => { jt[String(j._id)] = j.title; });
    res.json({ success: true, data: entries.map((e) => ({ id: String(e._id), candidate: cn[String(e.candidateId)] || '-', job: jt[String(e.jobId)] || '-', stage: e.stage, stageAt: e.stageAt, score: e.score, clientDecision: e.clientDecision || null, note: e.note || '' })) });
  }));

  // ---- fees: only after the candidate has joined ----
  router.post('/entries/:id/fee', wrap(async (req, res, tid) => {
    const e = await M.Entry.findOne({ _id: req.params.id, tenantId: tid });
    if (!e) return fail(res, 404, 'Entry not found');
    if (e.stage !== 'joined') return fail(res, 400, 'A fee can be raised only after the candidate has joined.');
    if (await M.Fee.exists({ tenantId: tid, entryId: e._id })) return fail(res, 409, 'A fee was already raised for this placement.');
    const job = await M.Job.findOne({ _id: e.jobId, tenantId: tid });
    const client = job && job.clientId ? await M.Client.findOne({ _id: job.clientId, tenantId: tid }) : null;
    const cand = await M.Candidate.findOne({ _id: e.candidateId, tenantId: tid });
    if (!client || !cand) return fail(res, 400, 'The job needs a client, and the candidate must exist.');
    const annualCtc = Number.isInteger(req.body.annualCtc) ? req.body.annualCtc : e.offeredCtc;
    const f = placementFee({ annualCtc, feeType: client.feeType, feeValue: client.feeValue, gstMode: req.body.gstMode === 'igst' ? 'igst' : 'cgst_sgst' });
    const joined = (e.history || []).filter((h) => h.to === 'joined').pop();
    const fee = await M.Fee.create({ tenantId: tid, entryId: e._id, fee: f.fee, gst: f.gst, total: f.total, currency: 'INR', issuedAt: new Date(), dueDate: new Date(dueDate(joined ? joined.at : new Date(), client.guaranteeDays)) });
    res.status(201).json({ success: true, data: { ...toPlain(fee), cgst: f.cgst, sgst: f.sgst, igst: f.igst } });
  }));
  router.get('/fees', wrap(async (req, res, tid) => {
    const fees = await M.Fee.find({ tenantId: tid }).sort({ issuedAt: -1 }).limit(200).lean();
    const now = Date.now();
    res.json({ success: true, data: fees.map((f) => ({ id: String(f._id), fee: f.fee, gst: f.gst, total: f.total, currency: f.currency, issuedAt: f.issuedAt, dueDate: f.dueDate, paidAt: f.paidAt || null, status: f.paidAt ? 'paid' : new Date(f.dueDate).getTime() < now ? 'overdue' : 'due' })) });
  }));
  router.post('/fees/:id/paid', wrap(async (req, res, tid) => {
    const f = await M.Fee.findOneAndUpdate({ _id: req.params.id, tenantId: tid }, { $set: { paidAt: new Date() } }, { new: true });
    if (!f) return fail(res, 404, 'Fee not found');
    res.json({ success: true, data: toPlain(f) });
  }));

  // ---- autopilot and report (read only here; sending is a later job runner) ----
  const settingsOf = async (tid) => ({ ...autopilot.DEFAULT_SETTINGS, ...((await M.AutopilotSettings.findOne({ tenantId: tid }).lean()) || {}) });
  router.get('/autopilot/today', wrap(async (req, res, tid) => {
    const [entries, cands, jobs, fees, s] = await Promise.all([M.Entry.find({ tenantId: tid }).lean(), M.Candidate.find({ tenantId: tid }).lean(), M.Job.find({ tenantId: tid }).lean(), M.Fee.find({ tenantId: tid }).lean(), settingsOf(tid)]);
    const candidates = {}; cands.forEach((c) => { candidates[String(c._id)] = { ...c, id: String(c._id) }; });
    const items = autopilot.watch({ entries: entries.map((e) => ({ ...e, id: String(e._id), candidateId: String(e.candidateId) })), candidates, jobs: jobs.map((j) => ({ ...j, id: String(j._id) })), fees: fees.map((f) => ({ ...f, id: String(f._id) })) }, new Date(), s);
    res.json({ success: true, data: items });
  }));
  router.get('/autopilot/settings', wrap(async (req, res, tid) => {
    const s = await settingsOf(tid); delete s._id; delete s.tenantId; delete s.__v; delete s.createdAt; delete s.updatedAt;
    res.json({ success: true, data: s });
  }));
  router.put('/autopilot/settings', wrap(async (req, res, tid) => {
    const LV = ['off', 'suggest', 'auto_internal', 'auto_send']; const b = req.body || {}; const jobs = {};
    for (const [k, v] of Object.entries(b.jobs || {})) if (LV.includes(v)) jobs[String(k).slice(0, 40)] = v;
    const set = { jobs, paused: !!b.paused };
    for (const k of ['quietFrom', 'quietTo']) if (Number.isInteger(b[k]) && b[k] >= 0 && b[k] <= 23) set[k] = b[k];
    if (Number.isInteger(b.dailySendLimit) && b.dailySendLimit >= 0 && b.dailySendLimit <= 500) set.dailySendLimit = b.dailySendLimit;
    const doc = await M.AutopilotSettings.findOneAndUpdate({ tenantId: tid }, { $set: set }, { new: true, upsert: true });
    await M.ActivityLog.create({ tenantId: tid, job: 'settings', level: 'owner', action: 'changed', text: `Autopilot settings changed by ${String(req.user && req.user.id || 'user')}` });
    res.json({ success: true, data: toPlain(doc) });
  }));
  router.get('/marketing-ideas', wrap(async (req, res, tid) => {
    const [jobs, entries, clients] = await Promise.all([M.Job.find({ tenantId: tid }).lean(), M.Entry.find({ tenantId: tid }).select('jobId stage').lean(), M.Client.find({ tenantId: tid }).select('name').lean()]);
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: { ideas: marketingIdeas.buildIdeas({ jobs: jobs.map((j) => ({ ...j, id: String(j._id) })), entries, clients: clients.map((c) => ({ ...c, id: String(c._id) })) }) } });
  }));
  router.get('/reports/weekly', wrap(async (req, res, tid) => {
    const to = new Date(); const from = new Date(to.getTime() - 7 * 864e5);
    const [entries, jobs, fees] = await Promise.all([M.Entry.find({ tenantId: tid }).lean(), M.Job.find({ tenantId: tid }).lean(), M.Fee.find({ tenantId: tid }).lean()]);
    res.json({ success: true, data: autopilot.weeklyReport({ entries: entries.map((e) => ({ ...e, jobId: String(e.jobId) })), jobs: jobs.map((j) => ({ ...j, id: String(j._id) })), fees }, from, to) });
  }));
  return router;
}
function num(v) { return v === '' || v === null || v === undefined ? undefined : Number(v); }

// Public client page: read only, no sign-in. Shows no phone, email or pay figures. The 192-bit link is the key.
function createSharePublicRouter({ express, mongoose }) {
  const router = express.Router();
  const M = makeModels(mongoose);
  const clientOf = async (token) => (typeof token === 'string' && /^[0-9a-f]{48}$/.test(token) ? runUnscoped('public share link: find the client by its secret token', () => M.Client.findOne({ shareToken: token })) : null);
  router.get('/:token', async (req, res) => {
    try {
      const client = await clientOf(req.params.token);
      if (!client) return res.status(404).json({ success: false, message: 'This link is not valid.' });
      return await runWithTenant(String(client.tenantId), async () => {
      const jobs = await M.Job.find({ tenantId: client.tenantId, clientId: client._id }).lean();
      const entries = await M.Entry.find({ tenantId: client.tenantId, jobId: { $in: jobs.map((j) => j._id) }, stage: { $in: ['submitted', 'interview', 'offer', 'joined'] } }).lean();
      const cands = await M.Candidate.find({ tenantId: client.tenantId, _id: { $in: entries.map((e) => e.candidateId) } }).lean();
      const byId = {}; cands.forEach((c) => { byId[String(c._id)] = c; });
      res.json({ success: true, data: { client: client.name, jobs: jobs.map((j) => ({ id: String(j._id), title: j.title, candidates: entries.filter((e) => String(e.jobId) === String(j._id)).map((e) => { const c = byId[String(e.candidateId)] || {}; return { entryId: String(e._id), name: c.name, skills: c.skills, experienceYears: c.experienceYears, currentTitle: c.currentTitle, location: c.location, note: e.note, stage: e.stage, decision: e.clientDecision || null }; }) })) } });
      });
    } catch (err) { console.error('Share route failed:', err.message); res.status(500).json({ success: false, message: 'Server error' }); }
  });
  router.post('/:token/entries/:entryId/decision', async (req, res) => {
    try {
      const client = await clientOf(req.params.token);
      if (!client) return res.status(404).json({ success: false, message: 'This link is not valid.' });
      const d = req.body && req.body.decision;
      if (!['interested', 'rejected'].includes(d)) return res.status(400).json({ success: false, message: 'Choose interested or rejected.' });
      return await runWithTenant(String(client.tenantId), async () => {
      const jobIds = (await M.Job.find({ tenantId: client.tenantId, clientId: client._id }).select('_id').lean()).map((j) => j._id);
      const e = await M.Entry.findOneAndUpdate({ _id: req.params.entryId, tenantId: client.tenantId, jobId: { $in: jobIds }, stage: { $in: ['submitted', 'interview', 'offer'] } }, { $set: { clientDecision: d } }, { new: true });
      if (!e) return res.status(404).json({ success: false, message: 'Candidate not found.' });
      res.json({ success: true });
      });
    } catch (err) { res.status(400).json({ success: false, message: 'Check the link.' }); }
  });
  return router;
}
module.exports = { createHireRouter, createSharePublicRouter };
