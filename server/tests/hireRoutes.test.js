// Database test for Hire (apps/hire). Auth is faked with a header; the AI is a scripted fake. Not yet run by a person.
const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');
const db = require('./helpers/db');
const { createHireRouter, createSharePublicRouter } = require('../../apps/hire');
const { runWithTenant } = require('../../packages/core-server/src');
const makeModels = require('../../apps/hire/src/models');

const A = new mongoose.Types.ObjectId().toString();
const B = new mongoose.Types.ObjectId().toString();
const protect = (req, res, next) => { const t = req.headers['x-tenant']; if (!t) return res.status(401).json({ success: false }); req.user = { id: new mongoose.Types.ObjectId().toString(), subscriberId: t, role: 'admin' }; runWithTenant(t, () => next()); }; // like the real sessionMiddleware: the tenant guard (C-04) needs a context
const authorize = () => (req, res, next) => next();
const resumeText = 'Ravi Kumar, Java developer with five years at Zoho Chennai. Skills Java SQL AWS. Phone 98765 43210. '.repeat(2);
let aiOn = true; let aiCalls = 0;
const ai = { isEnabled: () => aiOn, complete: async () => { aiCalls += 1; return { text: JSON.stringify({ name: 'Ravi Kumar', phone: '98765 43210', email: 'ravi@example.com', skills: ['Java', 'SQL'], experienceYears: 5, expectedCtc: 900000 }), usage: { inTokens: 800, outTokens: 120 }, model: 'fake' }; } };
const budget = { isStopped: async () => false };

describe('Hire routes', () => {
  let app;
  beforeAll(async () => {
    await db.connect();
    app = express(); app.use(express.json());
    app.use('/hire', createHireRouter({ express, mongoose, protect, authorize, tenantOf: (r) => new mongoose.Types.ObjectId(r.user.subscriberId), planOf: () => 'starter', ai, budget }));
    app.use('/share', createSharePublicRouter({ express, mongoose }));
  });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });
  const as = (t) => ({ 'x-tenant': t });
  const post = (t, url, body) => request(app).post(url).set(as(t)).send(body);

  test('tenant guard (C-04): a query outside any tenant context fails closed', async () => {
    const M = makeModels(mongoose);
    await expect(M.Candidate.find({})).rejects.toThrow(/outside any tenant context/);
    await expect(M.Entry.aggregate([{ $group: { _id: null } }])).rejects.toThrow(/outside any tenant context/);
    await expect(runWithTenant(A, () => M.Candidate.updateOne({}, { $set: { tenantId: B } }))).rejects.toThrow(/may not change/);
    await expect(runWithTenant(A, () => M.Candidate.find({ tenantId: B }))).rejects.toThrow(/different tenant/);
  });

  test('needs sign-in', async () => { expect((await request(app).get('/hire/candidates')).status).toBe(401); });

  test('manual candidate: phone normalised, duplicate refused, list masks phone', async () => {
    const r = await post(A, '/hire/candidates', { name: 'Asha', phone: '98000 11111', email: 'asha@example.com', skills: ['Excel'] });
    expect(r.status).toBe(201); expect(r.body.data.phone).toBe('+919800011111');
    expect((await post(A, '/hire/candidates', { name: 'Asha K', phone: '+91 9800011111' })).status).toBe(409);
    const list = (await request(app).get('/hire/candidates').set(as(A))).body.data;
    expect(list[0].phone).toMatch(/\*/); expect(list[0].phone).not.toMatch(/9800011111/);
  });

  test('agencies cannot see or change each other\'s data', async () => {
    const c = (await post(A, '/hire/candidates', { name: 'Zed', phone: '97000 22222' })).body.data;
    expect((await request(app).get(`/hire/candidates/${c.id}`).set(as(B))).status).toBe(404);
    expect((await request(app).patch(`/hire/candidates/${c.id}`).set(as(B)).send({ name: 'Hacked' })).status).toBe(404);
    expect((await request(app).delete(`/hire/candidates/${c.id}`).set(as(B))).status).toBe(404);
    expect((await request(app).get('/hire/candidates').set(as(B))).body.data).toHaveLength(0);
    const job = (await post(A, '/hire/jobs', { title: 'Clerk' })).body.data;
    expect((await post(B, '/hire/entries', { jobId: job.id, candidateId: c.id })).status).toBe(404);
    expect((await post(B, `/hire/jobs/${job.id}/rank`, {})).status).toBe(404);
  });

  test('resume parse creates an unreviewed record; the same resume again merges; usage is counted', async () => {
    const r1 = await post(A, '/hire/candidates/parse', { text: resumeText, consentSource: 'candidate_form' });
    expect(r1.status).toBe(201); expect(r1.body.data.needsReview).toBe(true);
    const r2 = await post(A, '/hire/candidates/parse', { text: resumeText });
    expect(r2.status).toBe(200); expect(r2.body.data.action).toBe('merged');
    expect(aiCalls).toBe(2);
    const c = (await request(app).get(`/hire/candidates/${r1.body.data.id}`).set(as(A))).body.data;
    expect(c.reviewed).toBe(false); expect(c.consent.purposeAi).toBe(true);
    const fixed = await request(app).patch(`/hire/candidates/${r1.body.data.id}`).set(as(A)).send({ currentTitle: 'Senior Dev' });
    expect(fixed.body.data.reviewed).toBe(true);
  });

  test('AI off gives a clear 503 and makes no call', async () => {
    aiOn = false; const before = aiCalls;
    const r = await post(B, '/hire/candidates/parse', { text: resumeText });
    aiOn = true;
    expect(r.status).toBe(503); expect(aiCalls).toBe(before);
  });

  test('pipeline: legal move works, jumping stages is refused, drop needs a reason', async () => {
    const cand = (await post(A, '/hire/candidates', { name: 'Mani', phone: '96000 33333' })).body.data;
    const job = (await post(A, '/hire/jobs', { title: 'Dev', mustSkills: ['java'] })).body.data;
    const e = (await post(A, '/hire/entries', { jobId: job.id, candidateId: cand.id })).body.data;
    expect((await post(A, `/hire/entries/${e.id}/move`, { to: 'offer' })).status).toBe(400);
    expect((await post(A, `/hire/entries/${e.id}/move`, { to: 'screened' })).body.data.stage).toBe('screened');
    expect((await post(A, `/hire/entries/${e.id}/move`, { to: 'dropped' })).status).toBe(400);
    expect((await post(A, `/hire/entries/${e.id}/move`, { to: 'dropped', reason: 'not interested' })).body.data.stage).toBe('dropped');
  });

  test('fee only after joining; computed from client terms; not raised twice', async () => {
    const client = (await post(A, '/hire/clients', { name: 'Nila Software', feeType: 'percent', feeValue: 8.33 })).body.data;
    const cand = (await post(A, '/hire/candidates', { name: 'Sneha', phone: '95000 44444' })).body.data;
    const job = (await post(A, '/hire/jobs', { title: 'QA', clientId: client.id })).body.data;
    const e = (await post(A, '/hire/entries', { jobId: job.id, candidateId: cand.id })).body.data;
    expect((await post(A, `/hire/entries/${e.id}/fee`, { annualCtc: 600000 })).status).toBe(400);
    for (const to of ['screened', 'submitted', 'interview', 'offer', 'joined']) await post(A, `/hire/entries/${e.id}/move`, { to });
    const f = await post(A, `/hire/entries/${e.id}/fee`, { annualCtc: 600000 });
    expect(f.status).toBe(201); expect(f.body.data.fee).toBe(49980); expect(f.body.data.gst).toBe(8996); expect(f.body.data.total).toBe(58976);
    expect((await post(A, `/hire/entries/${e.id}/fee`, { annualCtc: 600000 })).status).toBe(409);
    expect((await post(B, `/hire/fees/${f.body.data.id}/paid`, {})).status).toBe(404);
    expect((await post(A, `/hire/fees/${f.body.data.id}/paid`, {})).body.data.paidAt).toBeTruthy();
  });

  test('client share link: public, no contact details, own candidates only, can be switched off', async () => {
    const client = (await post(A, '/hire/clients', { name: 'Kovai Textiles' })).body.data;
    const other = (await post(A, '/hire/clients', { name: 'Other Client' })).body.data;
    const cand = (await post(A, '/hire/candidates', { name: 'Divya', phone: '94000 55555', email: 'divya@example.com', skills: ['Java'], currentCtc: 700000 })).body.data;
    const job = (await post(A, '/hire/jobs', { title: 'Dev', clientId: client.id })).body.data;
    const otherJob = (await post(A, '/hire/jobs', { title: 'Hidden', clientId: other.id })).body.data;
    const e = (await post(A, '/hire/entries', { jobId: job.id, candidateId: cand.id })).body.data;
    const e2 = (await post(A, '/hire/entries', { jobId: otherJob.id, candidateId: cand.id })).body.data;
    for (const id of [e.id, e2.id]) for (const to of ['screened', 'submitted']) await post(A, `/hire/entries/${id}/move`, { to });
    const token = (await post(A, `/hire/clients/${client.id}/share-link`, {})).body.data.token;
    expect(token).toMatch(/^[0-9a-f]{48}$/);
    const page = await request(app).get(`/share/${token}`);
    const body = JSON.stringify(page.body);
    expect(page.status).toBe(200); expect(body).toMatch(/Divya/); expect(body).not.toMatch(/94000|divya@example|700000|Hidden/);
    expect((await request(app).get(`/share/${'0'.repeat(48)}`)).status).toBe(404);
    expect((await request(app).get('/share/not-a-token')).status).toBe(404);
    expect((await request(app).post(`/share/${token}/entries/${e2.id}/decision`).send({ decision: 'interested' })).status).toBe(404); // another client's candidate
    expect((await request(app).post(`/share/${token}/entries/${e.id}/decision`).send({ decision: 'maybe' })).status).toBe(400);
    expect((await request(app).post(`/share/${token}/entries/${e.id}/decision`).send({ decision: 'interested' })).status).toBe(200);
    expect((await request(app).delete(`/hire/clients/${client.id}/share-link`).set(as(B))).status).toBe(404);
    await request(app).delete(`/hire/clients/${client.id}/share-link`).set(as(A));
    expect((await request(app).get(`/share/${token}`)).status).toBe(404);
  });

  test('panel list and edit routes are tenant-scoped (fees, entries, jobs, clients, settings)', async () => {
    const job = (await post(A, '/hire/jobs', { title: 'Panel job' })).body.data;
    const cl = (await post(A, '/hire/clients', { name: 'Panel client' })).body.data;
    expect((await request(app).patch(`/hire/jobs/${job.id}`).set(as(B)).send({ title: 'x' })).status).toBe(404);
    expect((await request(app).patch(`/hire/clients/${cl.id}`).set(as(B)).send({ name: 'x' })).status).toBe(404);
    expect((await request(app).patch(`/hire/jobs/${job.id}`).set(as(A)).send({ status: 'closed', title: 'Renamed' })).body.data.status).toBe('closed');
    expect((await request(app).patch(`/hire/clients/${cl.id}`).set(as(A)).send({ name: '' })).status).toBe(400);
    const cand = (await post(A, '/hire/candidates', { name: 'Panel P', phone: '93000 66666' })).body.data;
    await post(A, '/hire/entries', { jobId: job.id, candidateId: cand.id });
    expect((await request(app).get('/hire/entries').set(as(A))).body.data.some((e) => e.candidate === 'Panel P')).toBe(true);
    expect((await request(app).get('/hire/entries').set(as(B))).body.data).toHaveLength(0);
    expect((await request(app).get('/hire/fees').set(as(B))).body.data).toHaveLength(0);
    const set = await request(app).get('/hire/autopilot/settings').set(as(B));
    expect(set.status).toBe(200); expect(set.body.data.paused).toBe(false); expect(set.body.data.tenantId).toBe(undefined);
  });

  test('ranking uses the plan limit and counts each run', async () => {
    const job = (await post(A, '/hire/jobs', { title: 'Ranked', mustSkills: ['java'] })).body.data;
    const r = await post(A, `/hire/jobs/${job.id}/rank`, {});
    expect(r.status).toBe(200); expect(r.body.remaining).toBeGreaterThan(0);
  });

  test('autopilot settings validate input and today list returns items', async () => {
    const s = await request(app).put('/hire/autopilot/settings').set(as(A)).send({ jobs: { candidate_nudge: 'auto_send', bad: 'root' }, dailySendLimit: 20, quietFrom: 99 });
    expect(s.status).toBe(200); expect(s.body.data.jobs.candidate_nudge).toBe('auto_send'); expect(s.body.data.jobs.bad).toBe(undefined);
    expect((await request(app).get('/hire/autopilot/today').set(as(A))).status).toBe(200);
    expect((await request(app).get('/hire/reports/weekly').set(as(A))).body.data.currency).toBe('INR');
  });
});
