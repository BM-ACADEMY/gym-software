'use strict';
// Hire autopilot: pure rules that decide WHAT needs attention. No sending, no AI, no database here.
// A runner (later) turns the result into tasks, drafts and reports, after the guardrails in docs/products/AUTOPILOT.md.
const { offerDropFlags } = require('./offerDrop');
const { retentionStatus, canMessage } = require('./consent');
const DAY = 864e5;
const ago = (d, now) => (now - new Date(d).getTime()) / DAY;

// Owner settings. Level per job: 'off' | 'suggest' | 'auto_internal' | 'auto_send'. Default is suggest.
const DEFAULT_SETTINGS = { paused: false, quietFrom: 21, quietTo: 8, dailySendLimit: 30, jobs: {} };
const levelOf = (s, job) => (s.paused ? 'off' : (s.jobs && s.jobs[job]) || 'suggest');

function inQuietHours(hourLocal, s = DEFAULT_SETTINGS) {
  const { quietFrom: a, quietTo: b } = s;
  return a > b ? hourLocal >= a || hourLocal < b : hourLocal >= a && hourLocal < b;
}

// data: { entries:[{id,candidateId,jobId,stage,stageAt,lastContactAt,...}], candidates:{id:cand}, jobs:[{id,title,lastSubmissionAt,status}], interviews:[{entryId,at}], fees:[{id,total,dueDate,paidAt}] }
function watch(data, now = new Date(), s = DEFAULT_SETTINGS) {
  const t = new Date(now).getTime(); const items = [];
  const add = (job, kind, ref, text, extra) => { const level = levelOf(s, job); if (level !== 'off') items.push({ job, kind, ref, text, level, ...extra }); };

  for (const e of data.entries || []) {
    const cand = (data.candidates || {})[e.candidateId] || {};
    if (['screened', 'submitted', 'interview'].includes(e.stage) && ago(e.lastContactAt || e.stageAt, t) >= 2)
      add('candidate_nudge', 'entry', e.id, `No contact with ${cand.name || 'candidate'} for 2+ days`, { needsConsent: true, canSend: canMessage(cand, now).ok });
    for (const f of offerDropFlags({ ...e, noticeDays: cand.noticeDays, expectedCtc: cand.expectedCtc }, now))
      add('offer_watch', 'entry', e.id, f.text, { code: f.code });
  }
  for (const i of data.interviews || []) {
    const hrs = (new Date(i.at).getTime() - t) / 36e5;
    if (hrs > 0 && hrs <= 24) add('interview_reminder', 'entry', i.entryId, 'Interview within 24 hours', { at: i.at });
  }
  for (const j of data.jobs || []) {
    if (j.status === 'open' && ago(j.lastSubmissionAt || j.createdAt, t) >= 3)
      add('stale_job', 'job', j.id, `No candidate sent for "${j.title}" in 3+ days`);
  }
  for (const f of data.fees || []) {
    if (!f.paidAt && new Date(f.dueDate).getTime() < t) add('fee_reminder', 'fee', f.id, 'Placement fee past due', { total: f.total, currency: 'INR', needsConsent: false });
  }
  for (const c of Object.values(data.candidates || {})) {
    const st = retentionStatus(c, now);
    if (st !== 'ok') add('retention', 'candidate', c.id, `Candidate data: ${st.replace(/_/g, ' ')}`, { code: st });
  }
  return items;
}

// Splits what may be sent to customers now from what must wait or be approved. Enforces quiet hours and the daily limit.
function planSends(items, { hourLocal, sentToday = 0 }, s = DEFAULT_SETTINGS) {
  const send = [], hold = []; let room = Math.max(0, s.dailySendLimit - sentToday);
  for (const it of items) {
    if (it.level !== 'auto_send') { hold.push({ ...it, why: it.level === 'suggest' ? 'needs_approval' : 'internal_only' }); continue; }
    if (it.needsConsent && !it.canSend) { hold.push({ ...it, why: 'no_consent' }); continue; }
    if (inQuietHours(hourLocal, s)) { hold.push({ ...it, why: 'quiet_hours' }); continue; }
    if (room <= 0) { hold.push({ ...it, why: 'daily_limit' }); continue; }
    room--; send.push(it);
  }
  return { send, hold };
}

// Weekly agency report numbers. Whole rupees with a currency code.
function weeklyReport(data, from, to) {
  const inRange = (d) => d && new Date(d) >= new Date(from) && new Date(d) < new Date(to);
  const moves = (data.entries || []).flatMap((e) => (e.history || []).filter((h) => inRange(h.at)).map((h) => ({ ...h, jobId: e.jobId })));
  const count = (stage) => moves.filter((h) => h.to === stage).length;
  const fees = data.fees || [];
  return {
    from, to, currency: 'INR',
    submitted: count('submitted'), interviews: count('interview'), offers: count('offer'), joined: count('joined'), dropped: count('dropped'),
    feesInvoiced: fees.filter((f) => inRange(f.issuedAt)).reduce((a, f) => a + f.total, 0),
    feesPaid: fees.filter((f) => inRange(f.paidAt)).reduce((a, f) => a + f.total, 0),
    feesOverdue: fees.filter((f) => !f.paidAt && new Date(f.dueDate) < new Date(to)).reduce((a, f) => a + f.total, 0),
    slowJobs: (data.jobs || []).filter((j) => j.status === 'open' && !moves.some((h) => h.jobId === j.id && h.to === 'submitted')).map((j) => j.id),
  };
}

module.exports = { DEFAULT_SETTINGS, levelOf, inQuietHours, watch, planSends, weeklyReport };
