'use strict';
// Hire routes, Phase 2. Written, not yet tested by a person. Every query filters by tenantId (the agency).
// 1 accounts (expenses, profit and loss, cash book, CA file), 2 forecasts (estimates), 3 downloads, 4 recruiter logins,
// 5 account close request, 6 interviews, 7 message drafts (suggest only: nothing is sent).
const HA = require('./hireAccounts'); const FC = require('./forecast'); const RP = require('./rolesPolicy'); const IV = require('./interviews'); const MD = require('./messageDrafts'); const CR = require('./closeRequest'); const DR = require('./dataRights');
const { hashPassword } = require('./authRoutes');

module.exports = ({ router, M, wrap, fail, str, adminOnly, audit, toPlain }) => {
  // Screens ask for no dates: default to the last 30 days (IST).
  const ist = (ms) => new Date(Date.now() + 5.5 * 36e5 - ms).toISOString().slice(0, 10);
  const range = (req) => ({ from: str(req.query.from, 10) || ist(30 * 864e5), to: str(req.query.to, 10) || ist(0) });
  const feesOf = (tid) => M.Fee.find({ tenantId: tid }).limit(5001).lean(); const expensesOf = (tid) => M.Expense.find({ tenantId: tid }).limit(5001).lean();

  // ---- 1. accounts ----
  router.post('/expenses', adminOnly, wrap(async (req, res, tid) => {
    const v = HA.validateExpense(req.body); if (v.error) return fail(res, 400, v.error);
    const d = await M.Expense.create({ tenantId: tid, ...v.value }); res.status(201).json({ success: true, data: toPlain(d) });
  }));
  router.get('/expenses', adminOnly, wrap(async (req, res, tid) => res.json({ success: true, data: (await M.Expense.find({ tenantId: tid }).sort({ date: -1 }).limit(300).lean()).map((x) => ({ id: String(x._id), date: x.date, amount: x.amount, category: x.category, mode: x.mode, note: x.note || '', currency: x.currency })) })));
  router.get('/accounts/pnl', adminOnly, wrap(async (req, res, tid) => { const { from, to } = range(req); const r = HA.profitAndLoss({ fees: await feesOf(tid), expenses: await expensesOf(tid), from, to }); if (r.error) return fail(res, 400, r.error); res.json({ success: true, data: r }); }));
  router.get('/accounts/cashbook', adminOnly, wrap(async (req, res, tid) => { const { from, to } = range(req); const op = req.query.opening === undefined ? 0 : Number(req.query.opening); const r = HA.cashBook({ fees: await feesOf(tid), expenses: await expensesOf(tid), from, to, opening: op }); if (r.error) return fail(res, 400, r.error); res.json({ success: true, data: r }); }));
  const sendCsv = (res, name, csv) => { res.set('Content-Type', 'text/csv; charset=utf-8'); res.set('Content-Disposition', `attachment; filename="${name}"`); res.set('Cache-Control', 'no-store'); res.send(csv); };
  router.get('/accounts/ca.csv', adminOnly, wrap(async (req, res, tid) => { const { from, to } = range(req); const r = HA.caCsv({ fees: await feesOf(tid), expenses: await expensesOf(tid), from, to }); if (r.error) return fail(res, 400, r.error); await audit(tid, req, 'accounts.ca_csv'); sendCsv(res, 'hire-ca.csv', r.csv); }));

  // ---- 2. forecasts: estimates, labelled ----
  router.get('/forecast/time-to-fill', wrap(async (req, res, tid) => {
    const [jobs, entries] = await Promise.all([M.Job.find({ tenantId: tid }).lean(), M.Entry.find({ tenantId: tid, stage: 'joined' }).limit(2000).lean()]);
    res.json({ success: true, data: FC.timeToFill({ jobs: jobs.map((j) => ({ ...j, id: String(j._id) })), entries }) });
  }));
  router.get('/forecast/fees', wrap(async (req, res, tid) => {
    const [jobs, entries, clients] = await Promise.all([M.Job.find({ tenantId: tid }).lean(), M.Entry.find({ tenantId: tid, stage: { $in: Object.keys(FC.STAGE_CHANCE) } }).limit(2000).lean(), M.Client.find({ tenantId: tid }).lean()]);
    res.json({ success: true, data: FC.feeForecast({ jobs: jobs.map((j) => ({ ...j, id: String(j._id) })), entries, clients: clients.map((c) => ({ ...c, id: String(c._id) })) }) });
  }));

  // ---- 3. downloads: one list at a time, owner only, audited; cells that start with = + - @ are made safe ----
  const LISTS = {
    fees: { head: ['issuedAt', 'dueDate', 'paidAt', 'fee', 'gst', 'total', 'currency'], get: (tid) => M.Fee.find({ tenantId: tid }).limit(5000).lean() },
    clients: { head: ['name', 'contactName', 'feeType', 'feeValue', 'guaranteeDays'], get: (tid) => M.Client.find({ tenantId: tid }).limit(5000).lean() },
    jobs: { head: ['title', 'location', 'openings', 'status', 'minExperience', 'maxExperience', 'maxCtc'], get: (tid) => M.Job.find({ tenantId: tid }).limit(5000).lean() },
    expenses: { head: ['date', 'amount', 'category', 'mode', 'note', 'currency'], get: (tid) => M.Expense.find({ tenantId: tid }).limit(5000).lean() },
    candidates: { head: DR.EXPORT_FIELDS.filter((k) => k !== 'skills'), get: (tid) => M.Candidate.find({ tenantId: tid, anonymisedAt: { $exists: false } }).limit(5000).lean() },
  };
  router.get('/export/:file', adminOnly, wrap(async (req, res, tid) => {
    const m = /^([a-z]+)\.csv$/.exec(String(req.params.file)); const L = m && Object.prototype.hasOwnProperty.call(LISTS, m[1]) ? LISTS[m[1]] : null; if (!L) return fail(res, 404, 'Unknown download.');
    const rows = (await L.get(tid)).map((r) => Object.fromEntries(L.head.map((k) => [k, r[k] instanceof Date ? r[k].toISOString().slice(0, 10) : r[k]])));
    await audit(tid, req, 'export.' + m[1]); sendCsv(res, 'hire-' + m[1] + '.csv', HA.toCsv(L.head, rows));
  }));

  // ---- 4. recruiter logins: the owner makes them and switches them off. A recruiter works candidates, jobs and pipeline only (rolesPolicy.js) ----
  router.get('/team', adminOnly, wrap(async (req, res, tid) => res.json({ success: true, data: (await M.User.find({ tenantId: tid }).limit(100).lean()).map((u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role, active: u.isActive !== false })) })));
  router.post('/team', adminOnly, wrap(async (req, res, tid) => {
    const v = RP.validTeamMember(req.body); if (v.error) return fail(res, 400, v.error);
    if ((await M.User.find({ tenantId: tid, role: 'recruiter', isActive: { $ne: false } }).limit(51)).length > 50) return fail(res, 400, 'That is the most recruiters one agency can have.');
    const u = await M.User.create({ tenantId: tid, name: v.value.name, email: v.value.email, role: 'recruiter', passwordHash: await hashPassword(v.value.password) });
    await audit(tid, req, 'team.added', u._id); res.status(201).json({ success: true, data: { id: String(u._id), name: u.name, email: u.email, role: 'recruiter' } });
  }));
  router.post('/team/:id/off', adminOnly, wrap(async (req, res, tid) => {
    const u = await M.User.findOneAndUpdate({ _id: req.params.id, tenantId: tid, role: 'recruiter' }, { $set: { isActive: false } }, { new: true }); if (!u) return fail(res, 404, 'Recruiter not found.');
    await audit(tid, req, 'team.off', u._id); res.json({ success: true, message: 'That recruiter can no longer sign in.' });
  }));

  // ---- 5. the agency asks to close its account: a waiting period, then the server owner deletes. Cancel any time before. ----
  router.get('/account/close-request', adminOnly, wrap(async (req, res, tid) => { const r = await M.CloseRequest.findOne({ tenantId: tid, status: 'requested' }).lean(); res.json({ success: true, data: r ? { status: r.status, requestedAt: r.requestedAt, deleteAfter: r.deleteAfter, canCancel: CR.canCancel(r) } : null, waitDays: CR.WAIT_DAYS }); }));
  router.post('/account/close-request', adminOnly, wrap(async (req, res, tid) => {
    if (!req.body || req.body.confirm !== true) return fail(res, 400, 'Confirm that you want to close the account.');
    if (await M.CloseRequest.findOne({ tenantId: tid, status: 'requested' }).lean()) return fail(res, 409, 'A close request is already waiting.');
    const p = CR.plan({ reason: req.body.reason });
    await M.CloseRequest.findOneAndUpdate({ tenantId: tid }, { $set: { requestedAt: p.requestedAt, deleteAfter: p.deleteAfter, waitDays: p.waitDays, reason: p.reason, status: 'requested', by: req.user.id } }, { upsert: true, new: true });
    await audit(tid, req, 'account.close_requested'); res.status(201).json({ success: true, data: { deleteAfter: p.deleteAfter }, message: p.note });
  }));
  router.post('/account/close-request/cancel', adminOnly, wrap(async (req, res, tid) => {
    const r = await M.CloseRequest.findOneAndUpdate({ tenantId: tid, status: 'requested', deleteAfter: { $gt: new Date() } }, { $set: { status: 'cancelled' } }, { new: true }); if (!r) return fail(res, 404, 'No waiting close request.');
    await audit(tid, req, 'account.close_cancelled'); res.json({ success: true, message: 'Close request cancelled. Your account stays.' });
  }));

  // ---- 6. interviews ----
  const book = async (req, res, tid, e) => {
    if (!e) return fail(res, 404, 'Entry not found');
    if (!IV.stageOk(e.stage)) return fail(res, 400, 'Interviews can be set only for candidates who are submitted or at interview stage.');
    const v = IV.validInterview(req.body); if (v.error) return fail(res, 400, v.error);
    const mine = await M.Interview.find({ tenantId: tid, candidateId: e.candidateId, status: 'scheduled' }).lean(); if (IV.clash(mine, v.value.at, v.value.minutes)) return fail(res, 409, 'This candidate already has an interview at that time.');
    const d = await M.Interview.create({ tenantId: tid, entryId: e._id, candidateId: e.candidateId, ...v.value, status: 'scheduled', by: req.user.id });
    res.status(201).json({ success: true, data: { id: String(d._id), at: d.at, minutes: d.minutes, mode: d.mode } });
  };
  router.post('/entries/:id/interviews', wrap(async (req, res, tid) => book(req, res, tid, await M.Entry.findOne({ _id: req.params.id, tenantId: tid }).lean())));
  // From the panel form: the person types the candidate's name as it shows in Candidates (and the job title if they are on more than one job).
  router.post('/interviews', wrap(async (req, res, tid) => {
    const name = str(req.body && req.body.candidate, 120); if (!name) return fail(res, 400, 'Type the candidate name as it shows in Candidates.');
    const c = await M.Candidate.find({ tenantId: tid, name }).limit(3).lean(); if (c.length === 0) return fail(res, 404, 'No candidate with that name.'); if (c.length > 1) return fail(res, 400, 'More than one candidate has that name. Book it from the pipeline instead.');
    let es = await M.Entry.find({ tenantId: tid, candidateId: c[0]._id, stage: { $in: IV.OK_STAGES } }).limit(10).lean();
    const jt = str(req.body && req.body.job, 120); if (jt) { const jobs = await M.Job.find({ tenantId: tid, title: jt }).limit(10).lean(); const ids = new Set(jobs.map((j) => String(j._id))); es = es.filter((e) => ids.has(String(e.jobId))); }
    if (es.length === 0) return fail(res, 400, 'That candidate is not submitted or at interview stage for any job.'); if (es.length > 1) return fail(res, 400, 'That candidate is on more than one job. Add the job title.');
    return book(req, res, tid, es[0]);
  }));
  router.get('/interviews', wrap(async (req, res, tid) => {
    const from = new Date(Date.now() - 864e5); const rows = await M.Interview.find({ tenantId: tid, status: 'scheduled', at: { $gte: from } }).sort({ at: 1 }).limit(200).lean();
    const cs = await M.Candidate.find({ tenantId: tid, _id: { $in: rows.map((r) => r.candidateId) } }).select('name').lean(); const n = {}; cs.forEach((c) => { n[String(c._id)] = c.name; });
    res.json({ success: true, data: rows.map((r) => ({ id: String(r._id), at: r.at, atText: IV.istText(r.at), minutes: r.minutes, mode: r.mode, place: r.place || '', candidate: n[String(r.candidateId)] || '-', note: r.note || '' })) });
  }));
  const setStatus = (status) => wrap(async (req, res, tid) => {
    const d = await M.Interview.findOneAndUpdate({ _id: req.params.id, tenantId: tid, status: 'scheduled' }, { $set: { status } }, { new: true }); if (!d) return fail(res, 404, 'No scheduled interview found.'); res.json({ success: true, data: { id: String(d._id), status } });
  });
  router.post('/interviews/:id/cancel', setStatus('cancelled')); router.post('/interviews/:id/done', setStatus('done'));

  // ---- 7. drafts: suggest only. Nothing is sent by the system. ----
  router.get('/interviews/:id/draft', wrap(async (req, res, tid) => {
    const i = await M.Interview.findOne({ _id: req.params.id, tenantId: tid }).lean(); if (!i) return fail(res, 404, 'Interview not found');
    const [c, e, t] = await Promise.all([M.Candidate.findOne({ _id: i.candidateId, tenantId: tid }).lean(), M.Entry.findOne({ _id: i.entryId, tenantId: tid }).lean(), M.Tenant.findById(tid).lean()]);
    const job = e ? await M.Job.findOne({ _id: e.jobId, tenantId: tid }).lean() : null;
    res.json({ success: true, data: MD.interviewReminder({ candidate: c, job, interview: i, agency: t && t.agencyName }) });
  }));
  router.get('/fees/:id/draft', wrap(async (req, res, tid) => {
    const f = await M.Fee.findOne({ _id: req.params.id, tenantId: tid }).lean(); if (!f) return fail(res, 404, 'Fee not found');
    const e = await M.Entry.findOne({ _id: f.entryId, tenantId: tid }).lean(); const j = e ? await M.Job.findOne({ _id: e.jobId, tenantId: tid }).lean() : null; const c = j && j.clientId ? await M.Client.findOne({ _id: j.clientId, tenantId: tid }).lean() : null; const t = await M.Tenant.findById(tid).lean();
    res.json({ success: true, data: MD.feeReminder({ client: c, fee: f, agency: t && t.agencyName }) });
  }));
};
