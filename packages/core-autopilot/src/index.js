'use strict';
// Shared autopilot core (see docs/products/AUTOPILOT.md). No database, no network, no AI, no sending here.
// A product supplies "watch" results (what needs attention). This package decides what is ALLOWED to happen to each one,
// runs scheduled jobs safely, and produces activity-log entries. Sending itself stays in the product, behind its own consent checks.
//
// Levels per job: 'off' | 'suggest' (default) | 'auto_internal' (staff or owner only, no customer contacted) | 'auto_send' (customer; only approved templates).
const DAY = 864e5;
const LEVELS = ['off', 'suggest', 'auto_internal', 'auto_send'];
const DEFAULT_SETTINGS = { paused: false, quietFrom: 21, quietTo: 8, dailySendLimit: 30, jobs: {} };
const FAILURES_TO_PAUSE = 3;

const levelOf = (s, job) => { const st = { ...DEFAULT_SETTINGS, ...(s || {}) }; if (st.paused) return 'off'; const l = st.jobs && st.jobs[job]; return LEVELS.includes(l) ? l : 'suggest'; };
const istHour = (now) => new Date(new Date(now).getTime() + 5.5 * 3600000).getUTCHours();
function inQuietHours(now, s = DEFAULT_SETTINGS) { const { quietFrom: a, quietTo: b } = { ...DEFAULT_SETTINGS, ...(s || {}) }; const h = istHour(now); return a > b ? h >= a || h < b : h >= a && h < b; }
const istDay = (d) => new Date(new Date(d).getTime() + 5.5 * 3600000).toISOString().slice(0, 10);

// An account that is expired or suspended is read-only (packages/core-billing guardWrite): autopilot does nothing for it.
const readOnly = (account) => !!account && (account.status === 'expired' || account.status === 'suspended');

// item: { job, ref, level?, needsConsent?, canSend?, templateApproved?, text? }  (level, if given, is ignored: the owner's setting rules)
// ctx: { settings, account:{status}, now, sentToday }
// Returns { action: 'suggest'|'internal'|'send'|'defer'|'skip', why }. 'send' means "the product may now send this approved template".
function decide(item, ctx) {
  const now = ctx.now || new Date(); const s = { ...DEFAULT_SETTINGS, ...(ctx.settings || {}) };
  if (readOnly(ctx.account)) return { action: 'skip', why: 'account_read_only' };
  const level = levelOf(s, item.job);
  if (level === 'off') return { action: 'skip', why: s.paused ? 'autopilot_paused' : 'job_off' };
  if (level === 'suggest') return { action: 'suggest', why: 'owner_confirms' };
  if (level === 'auto_internal') {
    if (item.audience === 'customer') return { action: 'suggest', why: 'customer_needs_auto_send_level' };
    return inQuietHours(now, s) ? { action: 'defer', why: 'quiet_hours' } : { action: 'internal', why: 'staff_or_owner_only' };
  }
  // auto_send: every guard must pass, otherwise the owner gets a suggestion instead (never a silent send)
  if (item.templateApproved !== true) return { action: 'suggest', why: 'template_not_approved' };
  if (item.needsConsent !== false && item.canSend !== true) return { action: 'suggest', why: 'no_consent' };
  if (inQuietHours(now, s)) return { action: 'defer', why: 'quiet_hours' };
  if ((ctx.sentToday || 0) >= s.dailySendLimit) return { action: 'defer', why: 'daily_limit' };
  return { action: 'send', why: 'all_guards_passed' };
}

// Decide for a whole watch list. sends are counted so the daily limit holds inside one run.
function planRun(items, ctx) {
  let sent = ctx.sentToday || 0; const out = [];
  for (const item of items || []) {
    const d = decide(item, { ...ctx, sentToday: sent });
    if (d.action === 'send') sent += 1;
    out.push({ ...d, job: item.job, ref: item.ref || null, text: item.text || '' });
  }
  return out;
}

// ---- job state: three strikes pause a job and tell the owner ----
// state: { failures, paused, pausedBecause, lastRunAt, lastOkAt }
function afterRun(state, ok, now = new Date()) {
  const st = { failures: 0, paused: false, ...(state || {}) };
  if (ok) return { ...st, failures: 0, lastRunAt: now, lastOkAt: now };
  const failures = (st.failures || 0) + 1;
  return { ...st, failures, lastRunAt: now, paused: st.paused || failures >= FAILURES_TO_PAUSE, pausedBecause: failures >= FAILURES_TO_PAUSE ? 'failed_3_times' : st.pausedBecause };
}
const isDue = (job, state, now = new Date()) => !(state && state.paused) && (!state || !state.lastRunAt || new Date(now) - new Date(state.lastRunAt) >= (job.everyMinutes || 60) * 60000);

// jobs: [{ name, everyMinutes, run(ctx) -> any }]. io: { loadState(name), saveState(name, state), log(entry), notifyOwner(msg) }.
// One failing job never stops the others. The error text is kept short and never holds job data.
async function runDue(jobs, io, { now = new Date() } = {}) {
  const results = [];
  for (const job of jobs) {
    const state = await io.loadState(job.name);
    if (!isDue(job, state, now)) { results.push({ job: job.name, ran: false, why: state && state.paused ? 'paused' : 'not_due' }); continue; }
    let ok = true, error = null;
    try { await job.run({ now }); } catch (e) { ok = false; error = String((e && e.message) || 'failed').slice(0, 120); }
    const next = afterRun(state, ok, now); await io.saveState(job.name, next);
    await io.log({ at: now, job: job.name, action: ok ? 'ran' : 'failed', why: error });
    if (next.paused && !(state && state.paused)) await io.notifyOwner(`Autopilot paused "${job.name}" after ${FAILURES_TO_PAUSE} failures. Check it, then switch it back on.`);
    results.push({ job: job.name, ran: true, ok });
  }
  return results;
}
const logEntry = (decision, now = new Date()) => ({ at: now, job: decision.job, action: decision.action, ref: decision.ref, why: decision.why }); // no names, phones or message text
module.exports = { LEVELS, DEFAULT_SETTINGS, FAILURES_TO_PAUSE, levelOf, inQuietHours, istDay, readOnly, decide, planRun, afterRun, isDue, runDue, logEntry };
