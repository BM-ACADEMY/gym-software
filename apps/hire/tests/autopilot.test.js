const H = require('../src'); const A = H.autopilot;
const now = new Date('2026-11-10T12:00:00Z');
const consentOk = { source: 'candidate_form', at: '2026-10-01T00:00:00Z', withdrawnAt: null };
const data = {
  candidates: { c1: { id: 'c1', name: 'Divya', consent: consentOk, lastActivityAt: '2026-11-01T00:00:00Z' }, c2: { id: 'c2', name: 'Anil', lastActivityAt: '2026-11-01T00:00:00Z' } },
  entries: [
    { id: 'e1', candidateId: 'c1', jobId: 'j1', stage: 'submitted', stageAt: '2026-11-06T00:00:00Z' },
    { id: 'e2', candidateId: 'c2', jobId: 'j1', stage: 'screened', stageAt: '2026-11-06T00:00:00Z' },
    { id: 'e3', candidateId: 'c1', jobId: 'j1', stage: 'offer', stageAt: '2026-11-07T00:00:00Z', otherOffers: true },
  ],
  interviews: [{ entryId: 'e1', at: '2026-11-11T06:00:00Z' }, { entryId: 'e2', at: '2026-11-20T06:00:00Z' }],
  jobs: [{ id: 'j1', title: 'Java', status: 'open', lastSubmissionAt: '2026-11-01T00:00:00Z' }],
  fees: [{ id: 'f1', total: 59000, dueDate: '2026-11-05', issuedAt: '2026-11-01', paidAt: null }, { id: 'f2', total: 1000, dueDate: '2026-11-05', paidAt: '2026-11-08', issuedAt: '2026-11-01' }],
};
const kinds = (items) => items.map((i) => i.job + ':' + i.ref);

describe('autopilot watch', () => {
  test('finds the right things', () => {
    const k = kinds(A.watch(data, now));
    expect(k).toContain('candidate_nudge:e1'); expect(k).toContain('candidate_nudge:e2');
    expect(k).toContain('interview_reminder:e1'); expect(k.includes('interview_reminder:e2')).toBe(false);
    expect(k).toContain('offer_watch:e3'); expect(k).toContain('stale_job:j1'); expect(k).toContain('fee_reminder:f1');
    expect(k.includes('fee_reminder:f2')).toBe(false);
  });
  test('pause switches everything off; a job set off disappears', () => {
    expect(A.watch(data, now, { ...A.DEFAULT_SETTINGS, paused: true })).toHaveLength(0);
    const k = kinds(A.watch(data, now, { ...A.DEFAULT_SETTINGS, jobs: { stale_job: 'off' } }));
    expect(k.includes('stale_job:j1')).toBe(false);
  });
  test('default level is suggest', () => { expect(A.watch(data, now)[0].level).toBe('suggest'); });
  test('retention items appear for candidates without consent', () => {
    expect(A.watch(data, now).some((i) => i.job === 'retention' && i.ref === 'c2')).toBe(true);
  });
});

describe('quiet hours and sends', () => {
  test('quiet hours wrap past midnight', () => {
    expect(A.inQuietHours(22)).toBe(true); expect(A.inQuietHours(3)).toBe(true); expect(A.inQuietHours(8)).toBe(false); expect(A.inQuietHours(14)).toBe(false);
  });
  const on = { ...A.DEFAULT_SETTINGS, jobs: { candidate_nudge: 'auto_send', fee_reminder: 'auto_send' }, dailySendLimit: 2 };
  test('suggest level never sends', () => {
    const p = A.planSends(A.watch(data, now), { hourLocal: 11 });
    expect(p.send).toHaveLength(0); expect(p.hold[0].why).toBe('needs_approval');
  });
  test('auto_send respects consent, quiet hours and the daily limit', () => {
    const items = A.watch(data, now, on).filter((i) => ['candidate_nudge', 'fee_reminder'].includes(i.job));
    const p = A.planSends(items, { hourLocal: 11, sentToday: 0 }, on);
    expect(p.hold.some((h) => h.ref === 'e2' && h.why === 'no_consent')).toBe(true);
    expect(p.send.some((x) => x.ref === 'e2')).toBe(false);
    expect(p.send.length <= 2).toBe(true);
    expect(A.planSends(items, { hourLocal: 22 }, on).send).toHaveLength(0);
    expect(A.planSends(items, { hourLocal: 11, sentToday: 2 }, on).send).toHaveLength(0);
  });
});

describe('weekly report', () => {
  test('counts moves and fees', () => {
    const d = { ...data, entries: [{ id: 'e1', jobId: 'j1', history: [{ to: 'submitted', at: '2026-11-04T00:00:00Z' }, { to: 'interview', at: '2026-11-05T00:00:00Z' }, { to: 'offer', at: '2026-11-01T00:00:00Z' }] }] };
    const r = A.weeklyReport(d, '2026-11-03', '2026-11-10');
    expect(r.submitted).toBe(1); expect(r.interviews).toBe(1); expect(r.offers).toBe(0);
    expect(r.feesInvoiced).toBe(0); expect(r.feesPaid).toBe(1000); expect(r.feesOverdue).toBe(59000); expect(r.currency).toBe('INR');
    expect(r.slowJobs).toEqual([]);
  });
});
