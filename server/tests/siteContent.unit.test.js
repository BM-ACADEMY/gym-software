// D-28: site wording rules and store (no database; plain-node checks).
const sc = require('../services/siteContent');
const { makeStore } = require('../services/siteContentStore');
const mem = () => { let saved = null; return { getSetting: async () => saved, setSetting: async (k, v) => { saved = JSON.parse(JSON.stringify(v)); }, peek: () => saved }; };

describe('site content rules', () => {
  test('the standard wording passes its own rules (every section)', () => {
    for (const s of sc.SECTIONS) expect(sc.validateSection(s, sc.DEFAULTS[s]).error).toBe(undefined);
  });
  test('links, tags, email, scripts and unknown braces are refused', () => {
    const base = { ...sc.DEFAULTS.pricing };
    for (const bad of ['see http://x.in', 'visit www.x.in', '<b>hi</b>', 'mail me a@b.in', 'javascript:alert(1)', 'use {name} here']) {
      expect(sc.validateSection('pricing', { ...base, headline: bad }).error).toMatch(/headline/);
    }
    expect(sc.validateSection('pricing', { ...base, headline: 'Start free for {trialDays} days' }).error).toBe(undefined);
  });
  test('unknown keys, missing keys, empty and too long text are refused', () => {
    const base = { ...sc.DEFAULTS.pricing };
    expect(sc.validateSection('pricing', { ...base, price: 'x' }).error).toMatch(/Cannot change/);
    expect(sc.validateSection('pricing', { headline: 'x' }).error).toMatch(/missing/);
    expect(sc.validateSection('pricing', { ...base, headline: '   ' }).error).toMatch(/empty/);
    expect(sc.validateSection('pricing', { ...base, headline: 'a'.repeat(121) }).error).toMatch(/120/);
    expect(sc.validateSection('nope', {}).error).toMatch(/Unknown/);
    expect(sc.validateSection('whatsapp_templates', {}).error).toMatch(/Unknown/);
  });
  test('promises we cannot keep are refused, honest wording about renewal is allowed', () => {
    const f = (a) => sc.validateSection('faq', [{ q: 'Q', a }]).error;
    expect(f('We offer unlimited AI for all')).toMatch(/Unlimited AI/);
    expect(f('We are the No 1 gym software')).toMatch(/number one/);
    expect(f('AI predicts who will quit')).toMatch(/prediction/);
    expect(f('We guarantee more members')).toMatch(/guarantee/);
    expect(f('Our AI chatbot replies to members')).toMatch(/fixed approved/);
    expect(f('Your plan auto-renews every month')).toMatch(/do not renew/);
    expect(f('It does not auto-renew. You pay in advance.')).toBe(undefined);
  });
  test('lists: needs items, ids made and kept unique, order is kept, extra fields refused', () => {
    expect(sc.validateSection('faq', []).error).toMatch(/Between/);
    const r = sc.validateSection('faq', [{ q: 'B', a: 'two' }, { id: 'c1', q: 'A', a: 'one' }, { q: 'C', a: 'three' }]).value;
    expect(r.map((x) => x.q)).toEqual(['B', 'A', 'C']);
    expect(new Set(r.map((x) => x.id)).size).toBe(3);
    expect(sc.validateSection('faq', [{ id: 'x', q: 'A', a: 'a' }, { id: 'x', q: 'B', a: 'b' }]).error).toMatch(/share one id/);
    expect(sc.validateSection('faq', [{ q: 'A', a: 'a', html: '1' }]).error).toMatch(/cannot have/);
    expect(sc.validateSection('faq', [{ id: 'Bad Id', q: 'A', a: 'a' }]).error).toMatch(/id not valid/);
    expect(sc.validateSection('help', [{ q: 'A', a: 'just text' }]).error).toMatch(/paragraphs/);
    expect(sc.validateSection('help', [{ q: 'A', a: ['p1', 'p2'] }]).value[0].a.length).toBe(2);
  });
  test('merge ignores a saved section that no longer validates; public view fills the trial length and shows nothing else', () => {
    const m = sc.merge({ pricing: { headline: '<b>x</b>', subline: 'y' }, faq: [{ q: 'Mine', a: 'Answer for {trialDays} days' }] });
    expect(m.pricing.headline).toBe(sc.DEFAULTS.pricing.headline);
    const p = sc.forPublic(m, { trialDays: 7 });
    expect(p.faq[0].a).toBe('Answer for 7 days');
    expect(p.pricing.headline).toBe('Simple pricing. Start free for 7 days.');
    expect(JSON.stringify(p)).not.toMatch(/\{trialDays\}/);
    expect(Object.keys(p)).toEqual(['pricing', 'landing', 'faq', 'help']);
  });
});

describe('site content store', () => {
  test('save needs a reason, keeps history, load restores it, reset goes back to standard', async () => {
    const db = mem(); const st = makeStore({ SystemSettings: db });
    const val = { ...sc.DEFAULTS.pricing, subline: 'Pay in advance. No auto-renewal.' };
    expect((await st.save('pricing', val, 'o', 'no')).error).toMatch(/reason/);
    expect((await st.save('pricing', { ...val, subline: '<a>' }, 'o', 'fix wording')).error).toMatch(/subline/);
    expect(db.peek()).toBe(null);
    expect((await st.save('pricing', val, 'owner@x.in', 'clearer pricing line')).ok).toBe(true);
    expect(st.live().pricing.subline).toBe('Pay in advance. No auto-renewal.');
    expect(st.view().changed).toEqual(['pricing']);
    expect(db.peek().history[0].reason).toBe('clearer pricing line');
    expect(db.peek().history[0].before.subline).toBe(sc.DEFAULTS.pricing.subline);
    const st2 = makeStore({ SystemSettings: db }); await st2.load();
    expect(st2.live().pricing.subline).toBe('Pay in advance. No auto-renewal.');
    expect((await st2.reset('pricing', 'o', 'back to standard')).ok).toBe(true);
    expect(st2.live().pricing.subline).toBe(sc.DEFAULTS.pricing.subline);
    expect(st2.view().history.length).toBe(2);
    expect((await st2.reset('bogus', 'o', 'reason here')).error).toMatch(/Unknown/);
  });
  test('a failing database leaves the standard wording in force', async () => {
    const st = makeStore({ SystemSettings: { getSetting: async () => { throw new Error('db down'); }, setSetting: async () => {} } });
    expect(await st.load()).toBe(false);
    expect(st.live().faq.length).toBe(sc.DEFAULTS.faq.length);
  });
  test('history keeps at most 100 entries', async () => {
    const db = mem(); const st = makeStore({ SystemSettings: db });
    for (let i = 0; i < 105; i++) await st.save('pricing', { ...sc.DEFAULTS.pricing, subline: 'line ' + i }, 'o', 'many changes');
    expect(db.peek().history.length).toBe(100);
  });
});
