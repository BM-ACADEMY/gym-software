// Pure logic: no database, no network.
const { searchArticles, ruleInsights, parseInsightJson, capFor, insightPrompt, ASSISTANT_SYSTEM } = require('../services/aiAssist');
const { HELP_ARTICLES } = require('../config/helpArticles');

describe('Ask GymDesk article search', () => {
  test('finds the import article for an import question', () => {
    const r = searchArticles('how do I import my old members from excel');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].id).toBe('import');
  });
  test('finds invoice and WhatsApp answers', () => {
    expect(searchArticles('where is my GST invoice')[0].id).toBe('gst');
    expect(searchArticles('which whatsapp messages go out')[0].id).toBe('whatsapp');
  });
  test('returns nothing for gibberish or empty', () => {
    expect(searchArticles('zzzz qqqq')).toHaveLength(0);
    expect(searchArticles('')).toHaveLength(0);
  });
  test('assistant system prompt carries the articles and the safety rules', () => {
    const p = ASSISTANT_SYSTEM(HELP_ARTICLES.slice(0, 2));
    expect(p).toMatch(/ONLY from the help articles/);
    expect(p).toMatch(/Never invent/);
    expect(p.includes(HELP_ARTICLES[0].q)).toBe(true);
  });
});

describe('insights', () => {
  const stats = { activeMembers: 120, expiring7: 9, lapsed7: 3, newMembers7: 5, checkinsThisWeek: 300, checkinsLastWeek: 400, duesTotal: 18500, duesCount: 7, collected7: 42000 };
  test('rules produce a summary and at most 3 actions using real numbers', () => {
    const r = ruleInsights(stats);
    expect(r.summary).toMatch(/120 active members/);
    expect(r.summary).toMatch(/42,000/);
    expect(r.actions.length).toBeLessThanOrEqual(3);
    expect(r.actions[0]).toMatch(/9 memberships/);
  });
  test('quiet week gives a calm action, not an empty list', () => {
    const r = ruleInsights({ ...stats, expiring7: 0, lapsed7: 0, duesTotal: 0, duesCount: 0, checkinsThisWeek: 400 });
    expect(r.actions).toHaveLength(1);
  });
  test('prompt contains only numbers, no personal fields', () => {
    const p = insightPrompt(stats);
    expect(p).toMatch(/no personal data/);
    expect(p).not.toMatch(/phone|name|email/i);
  });
  test('parses model JSON, tolerates fences, rejects junk', () => {
    expect(parseInsightJson('```json\n{"summary":"Good week","actions":["Call 9 members","Chase dues"]}\n```').actions).toHaveLength(2);
    expect(parseInsightJson('not json')).toBeNull();
    expect(parseInsightJson('{"summary":"","actions":["x"]}')).toBeNull();
    expect(parseInsightJson('{"summary":"ok","actions":[]}')).toBeNull();
    expect(parseInsightJson('{"summary":"ok","actions":["a","b","c","d"]}').actions).toHaveLength(3);
  });
});

describe('monthly AI cap by plan', () => {
  const now = new Date('2026-12-01T00:00:00Z');
  const paid = (planKey) => ({ planKey, paidUntil: new Date(now.getTime() + 20 * 86400000) });
  test('each plan has a cap and bigger plans get more', () => {
    const caps = ['solo', 'starter', 'growth', 'pro'].map((k) => capFor(paid(k), now));
    expect(caps).toEqual([15, 60, 200, 600]);
  });
  test('legacy gyms on the old plan system get the default cap', () => {
    expect(capFor({ platformPlanId: 'x' }, now)).toBe(200);
  });
});
