const A = require('../src');
const noon = new Date('2026-11-10T06:30:00Z'); // 12:00 IST
const night = new Date('2026-11-10T17:00:00Z'); // 22:30 IST
const send = (o = {}) => ({ job: 'candidate_nudge', ref: 'e1', needsConsent: true, canSend: true, templateApproved: true, audience: 'customer', ...o });
const on = (job, level, extra = {}) => ({ settings: { jobs: { [job]: level }, ...extra }, account: { status: 'active' }, now: noon });
describe('levels and guards', () => {
  test('default is suggest; paused or off skips', () => {
    expect(A.decide(send(), { now: noon }).action).toBe('suggest');
    expect(A.decide(send(), on('candidate_nudge', 'off'))).toEqual({ action: 'skip', why: 'job_off' });
    expect(A.decide(send(), { ...on('candidate_nudge', 'auto_send'), settings: { paused: true, jobs: { candidate_nudge: 'auto_send' } } })).toEqual({ action: 'skip', why: 'autopilot_paused' });
    expect(A.decide(send(), on('candidate_nudge', 'bogus')).action).toBe('suggest');
  });
  test('expired or suspended accounts get nothing, even on auto_send', () => {
    for (const status of ['expired', 'suspended']) expect(A.decide(send(), { ...on('candidate_nudge', 'auto_send'), account: { status } })).toEqual({ action: 'skip', why: 'account_read_only' });
    expect(A.decide(send(), { ...on('candidate_nudge', 'auto_send'), account: { status: 'grace' } }).action).toBe('send');
  });
  test('auto_send needs an approved template and consent; otherwise it falls back to a suggestion, never a silent send', () => {
    const ctx = on('candidate_nudge', 'auto_send');
    expect(A.decide(send(), ctx)).toEqual({ action: 'send', why: 'all_guards_passed' });
    expect(A.decide(send({ templateApproved: false }), ctx)).toEqual({ action: 'suggest', why: 'template_not_approved' });
    expect(A.decide(send({ templateApproved: undefined }), ctx).action).toBe('suggest');
    expect(A.decide(send({ canSend: false }), ctx)).toEqual({ action: 'suggest', why: 'no_consent' });
    expect(A.decide(send({ canSend: undefined }), ctx).why).toBe('no_consent');
    expect(A.decide(send({ needsConsent: false, canSend: undefined }), ctx).action).toBe('send'); // e.g. a fee reminder to a client
  });
  test('quiet hours and the daily limit defer', () => {
    expect(A.decide(send(), { ...on('candidate_nudge', 'auto_send'), now: night })).toEqual({ action: 'defer', why: 'quiet_hours' });
    expect(A.decide(send(), { ...on('candidate_nudge', 'auto_send'), sentToday: 30 })).toEqual({ action: 'defer', why: 'daily_limit' });
    expect(A.decide(send(), { ...on('candidate_nudge', 'auto_send', { dailySendLimit: 2 }), sentToday: 1 }).action).toBe('send');
  });
  test('auto_internal never contacts a customer', () => {
    expect(A.decide({ job: 'interview_reminder', audience: 'staff' }, on('interview_reminder', 'auto_internal'))).toEqual({ action: 'internal', why: 'staff_or_owner_only' });
    expect(A.decide({ job: 'x', audience: 'customer' }, on('x', 'auto_internal'))).toEqual({ action: 'suggest', why: 'customer_needs_auto_send_level' });
    expect(A.decide({ job: 'x', audience: 'staff' }, { ...on('x', 'auto_internal'), now: night }).action).toBe('defer');
  });
  test('one run holds the daily limit across items', () => {
    const items = [1, 2, 3, 4].map((n) => send({ ref: 'e' + n }));
    const r = A.planRun(items, { ...on('candidate_nudge', 'auto_send', { dailySendLimit: 3 }), sentToday: 1 });
    expect(r.map((x) => x.action)).toEqual(['send', 'send', 'defer', 'defer']);
  });
  test('log entries carry no names, phones or text', () => {
    const e = A.logEntry({ job: 'j', action: 'send', ref: 'e1', why: 'ok', text: 'Hello Asha 9876543210' }, noon);
    expect(Object.keys(e).sort().join()).toBe('action,at,job,ref,why'); expect(JSON.stringify(e)).not.toMatch(/Asha|9876543210/);
  });
});
describe('runner', () => {
  const mkIo = () => { const states = {}, logs = [], notes = []; return { states, logs, notes, loadState: async (n) => states[n] || null, saveState: async (n, s) => { states[n] = s; }, log: async (e) => logs.push(e), notifyOwner: async (m) => notes.push(m) }; };
  test('runs due jobs once per interval; a failing job does not stop the others', async () => {
    const io = mkIo(); const ran = [];
    const jobs = [{ name: 'a', everyMinutes: 30, run: async () => { throw new Error('boom ' + 'x'.repeat(300)); } }, { name: 'b', everyMinutes: 30, run: async () => { ran.push('b'); } }];
    const r1 = await A.runDue(jobs, io, { now: noon }); expect(r1.map((x) => x.ok)).toEqual([false, true]); expect(ran).toEqual(['b']);
    expect(io.logs[0].why.length <= 120).toBe(true);
    const r2 = await A.runDue(jobs, io, { now: new Date(noon.getTime() + 10 * 60000) }); expect(r2.every((x) => !x.ran)).toBe(true);
    const r3 = await A.runDue(jobs, io, { now: new Date(noon.getTime() + 31 * 60000) }); expect(r3.every((x) => x.ran)).toBe(true);
  });
  test('three failures in a row pause the job and tell the owner once; success resets the count', async () => {
    const io = mkIo(); const job = { name: 'a', everyMinutes: 1, run: async () => { throw new Error('x'); } };
    for (let i = 0; i < 4; i++) await A.runDue([job], io, { now: new Date(noon.getTime() + i * 5 * 60000) });
    expect(io.states.a.paused).toBe(true); expect(io.states.a.pausedBecause).toBe('failed_3_times'); expect(io.notes.length).toBe(1);
    expect(A.afterRun({ failures: 2 }, true, noon).failures).toBe(0);
    expect(A.isDue({ everyMinutes: 1 }, { paused: true }, noon)).toBe(false);
  });
});
