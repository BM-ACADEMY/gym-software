const { addReasons, ruleReason, parseReasons, clean } = require('../src/reasonService');
const { rankCandidates } = require('../src/rank');
const job = { title: 'Accountant', mustSkills: ['tally', 'gst'], niceSkills: [], minExperience: 2, maxExperience: 6, maxCtc: 500000, location: 'Chennai' };
const ranked = rankCandidates(job, [{ id: 'a', skills: ['Tally', 'GST'], experienceYears: 3, expectedCtc: 400000, location: 'Chennai', noticeDays: 15 }, { id: 'b', skills: ['tally'], experienceYears: 9, expectedCtc: 900000, location: 'Madurai' }]);
const on = { isEnabled: () => true }; const open = { isStopped: async () => false };
describe('rank reasons', () => {
  test('AI off: rule sentences, nothing sent', async () => {
    let called = false; const r = await addReasons(job, ranked, { ai: { isEnabled: () => false, complete: async () => { called = true; } }, budget: open });
    expect(called).toBe(false); expect(r.items[0].reasonBy).toBe('rules'); expect(r.items[1].reason).toMatch(/missing: gst/); expect(r.usage).toBeNull();
  });
  test('budget stopped: rules, no AI call', async () => {
    let called = false; const r = await addReasons(job, ranked, { ai: { ...on, complete: async () => { called = true; } }, budget: { isStopped: async () => true } });
    expect(called).toBe(false); expect(r.items[0].reasonBy).toBe('rules');
  });
  test('AI reasons used, score and order untouched, no personal data sent', async () => {
    let sent; const ai = { ...on, complete: async ({ user }) => { sent = user; return { text: '{"reasons":["Has every required skill and fits pay and place.","Has one of two required skills; pay is too high."]}', usage: { inTokens: 100, outTokens: 40 }, model: 'm' }; } };
    const r = await addReasons(job, ranked, { ai, budget: open });
    expect(r.items.map((x) => x.candidateId).join()).toBe(ranked.map((x) => x.candidateId).join()); expect(r.items[0].score).toBe(ranked[0].score); expect(r.items[0].reasonBy).toBe('ai'); expect(r.usage.inTokens).toBe(100);
    expect(sent.includes('"a"')).toBe(false); expect(sent).toMatch(/Accountant/); expect(sent.includes('Chennai')).toBe(false);
  });
  test('bad AI output or error falls back to rules', async () => {
    for (const complete of [async () => ({ text: 'sorry', usage: {}, model: 'm' }), async () => ({ text: '{"reasons":["only one"]}', usage: {}, model: 'm' }), async () => { throw new Error('down'); }]) {
      const r = await addReasons(job, ranked, { ai: { ...on, complete }, budget: open }); expect(r.items[0].reasonBy).toBe('rules');
    }
  });
  test('contact details and links are stripped from AI text', () => {
    expect(clean('Call +91 98765 43210 or mail a@b.com see https://x.io good fit')).toBe('Call or mail see good fit');
    expect(parseReasons('{"reasons":["ok"]}', 1)).toBeNull();
  });
});
