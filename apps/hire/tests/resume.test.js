const R = require('../src/resumeService'); const { checkCap } = require('../src/plans');
const text = 'Ravi Kumar, Java developer, 5 years at Zoho Chennai. Skills Java SQL AWS. Phone 98765 43210. '.repeat(2);
const reply = (o) => ({ text: 'Here: ' + JSON.stringify(o), usage: { inTokens: 900, outTokens: 150 }, model: 'm' });
function mk({ used = 0, enabled = true, stopped = false, existing = [], out } = {}) {
  const log = { usage: [], created: [], updated: [], sent: [] };
  return { log, deps: {
    ai: { isEnabled: () => enabled, complete: async (a) => { log.sent.push(a.user); return reply(out || { name: 'Ravi Kumar', phone: '98765 43210', skills: ['Java', 'SQL'], experienceYears: 5 }); } },
    budget: { isStopped: async () => stopped },
    usage: { countThisMonth: async () => used, record: async (t, r) => { log.usage.push([t, r.kind]); } },
    candidates: { list: async () => existing, create: async (t, c) => { log.created.push(c); return { id: 'new1' }; }, update: async (t, id, c) => { log.updated.push(id); } },
  } };
}
const code = async (p) => { try { await p; } catch (e) { return e.code; } return 'none'; };

describe('parseResume', () => {
  test('creates an unreviewed candidate, records usage, notes consent', async () => {
    const { deps, log } = mk(); const r = await R.parseResume({ tenantId: 't1', plan: 'starter', text, consentSource: 'candidate_form' }, deps);
    expect(r.action).toBe('created'); expect(r.needsReview).toBe(true); expect(log.created[0].reviewed).toBe(false);
    expect(log.created[0].phone).toBe('+919876543210'); expect(log.created[0].consent.purposeAi).toBe(true); expect(log.usage).toEqual([['t1', 'parse']]); expect(r.remaining).toBe(149);
  });
  test('duplicate by phone merges instead of creating', async () => {
    const { deps, log } = mk({ existing: [{ id: 'old', name: 'Ravi', phone: '9876543210', skills: ['go'] }] });
    const r = await R.parseResume({ tenantId: 't1', plan: 'starter', text }, deps);
    expect(r.action).toBe('merged'); expect(log.created).toHaveLength(0); expect(log.updated).toEqual(['old']);
  });
  test('cap reached stops before any AI call', async () => {
    const { deps, log } = mk({ used: 150 });
    expect(await code(R.parseResume({ tenantId: 't1', plan: 'starter', text }, deps))).toBe('CAP_REACHED'); expect(log.sent).toHaveLength(0);
  });
  test('AI off or platform budget stopped: no call, clear code', async () => {
    expect(await code(R.parseResume({ tenantId: 't1', plan: 'starter', text }, mk({ enabled: false }).deps))).toBe('AI_OFF');
    expect(await code(R.parseResume({ tenantId: 't1', plan: 'starter', text }, mk({ stopped: true }).deps))).toBe('AI_OFF');
  });
  test('empty text and missing tenant refused', async () => {
    expect(await code(R.parseResume({ tenantId: 't1', plan: 'starter', text: ' ' }, mk().deps))).toBe('RESUME_EMPTY');
    expect(await code(R.parseResume({ plan: 'starter', text }, mk().deps))).toBe('TENANT_REQUIRED');
  });
  test('long text is cut before sending', async () => {
    const { deps, log } = mk(); await R.parseResume({ tenantId: 't1', plan: 'starter', text: 'x'.repeat(50000) }, deps);
    expect(log.sent[0].length).toBe(R.MAX_CHARS);
  });
  test('unusable reply still counts as used and throws', async () => {
    const { deps, log } = mk(); deps.ai.complete = async () => ({ text: 'sorry', usage: { inTokens: 1, outTokens: 1 }, model: 'm' });
    expect(await code(R.parseResume({ tenantId: 't1', plan: 'starter', text }, deps))).toBe('PARSE_NO_JSON');
  });
  test('model output with a bad phone and junk keys is cleaned', async () => {
    const { deps, log } = mk({ out: { name: 'A', phone: '123', admin: true } });
    const r = await R.parseResume({ tenantId: 't1', plan: 'starter', text }, deps);
    expect(r.missing).toEqual(['phone']); expect(log.created[0].admin).toBe(undefined);
  });
});
describe('plan caps', () => {
  test('cap math', () => { expect(checkCap('growth', 'parse', 599).ok).toBe(true); expect(checkCap('growth', 'parse', 600).ok).toBe(false); expect(checkCap('pro', 'rank', 0).cap).toBe(1500); });
});
