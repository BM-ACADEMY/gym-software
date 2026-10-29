// Pure tests for the provider layer: no network, no database.
const p = require('../services/aiProvider');

describe('aiProvider', () => {
  const keep = { ...process.env };
  afterEach(() => { process.env = { ...keep }; });

  test('is off without a key, on with a key, off for another provider', () => {
    delete process.env.OPENAI_API_KEY; delete process.env.AI_PROVIDER;
    expect(p.isEnabled()).toBe(false);
    process.env.OPENAI_API_KEY = 'k';
    expect(p.isEnabled()).toBe(true);
    process.env.AI_PROVIDER = 'other';
    expect(p.isEnabled()).toBe(false);
  });

  test('model names come from the environment, with defaults', () => {
    delete process.env.AI_MODEL; delete process.env.AI_PLAN_MODEL;
    expect(p.smallModel()).toBe(p.DEFAULT_SMALL);
    expect(p.standardModel()).toBe(p.DEFAULT_STANDARD);
    process.env.AI_MODEL = 'm1'; process.env.AI_PLAN_MODEL = 'm2';
    expect(p.smallModel()).toBe('m1'); expect(p.standardModel()).toBe('m2');
  });

  test('request body holds the system text, the user text and the output cap', () => {
    delete process.env.AI_REASONING_EFFORT;
    const b = p.buildBody({ model: 'm', system: 'S', user: 'U', maxTokens: 123 });
    expect(b.messages).toEqual([{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }]);
    expect(b.max_completion_tokens).toBe(123);
    expect(b.reasoning_effort).toBeUndefined();
    process.env.AI_REASONING_EFFORT = 'minimal';
    expect(p.buildBody({ model: 'm', user: 'U', maxTokens: 5 }).reasoning_effort).toBe('minimal');
    expect(p.buildBody({ model: 'm', user: 'U', maxTokens: 5 }).messages).toHaveLength(1);
  });

  test('reply parsing: text and token counts; refusal, empty and cut-off are errors', () => {
    const ok = p.parseResponse({ model: 'm', choices: [{ message: { content: ' hi ' }, finish_reason: 'stop' }], usage: { prompt_tokens: 7, completion_tokens: 3 } });
    expect(ok).toEqual({ text: 'hi', usage: { inTokens: 7, outTokens: 3 }, model: 'm' });
    expect(() => p.parseResponse({})).toThrow(/no choices/);
    expect(() => p.parseResponse({ choices: [{ message: { refusal: 'no' } }] })).toThrow(/declined/);
    expect(() => p.parseResponse({ choices: [{ message: { content: '' }, finish_reason: 'length' }] })).toThrow(/cut off/);
    expect(() => p.parseResponse({ choices: [{ message: { content: '' }, finish_reason: 'stop' }] })).toThrow(/empty/);
  });

  test('complete() refuses to run when AI is not configured', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(p.complete({ user: 'x' })).rejects.toThrow(/not configured/);
  });

  test('complete() sends one request, retries once on 429, never leaks the body in errors', async () => {
    process.env.OPENAI_API_KEY = 'k'; delete process.env.AI_PROVIDER;
    const calls = [];
    global.fetch = jest.fn(async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body), auth: opts.headers.Authorization });
      if (calls.length === 1) return { ok: false, status: 429, json: async () => ({ error: 'secret echo' }) };
      return { ok: true, status: 200, json: async () => ({ model: 'm', choices: [{ message: { content: 'done' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) };
    });
    const r = await p.complete({ user: 'q', model: 'm' });
    expect(r.text).toBe('done');
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toMatch(/\/chat\/completions$/);
    expect(calls[0].auth).toBe('Bearer k');
    global.fetch = jest.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: 'secret echo' }) }));
    await expect(p.complete({ user: 'q' })).rejects.toThrow(/HTTP 400$/);
  });

  test('OpenRouter: needs its own key and both model names; no model guessed; zero-retention asked by default', () => {
    for (const k of ['OPENAI_API_KEY', 'AI_MODEL', 'AI_PLAN_MODEL', 'OPENROUTER_API_KEY', 'AI_OPENROUTER_ZDR', 'OPENROUTER_BASE_URL']) delete process.env[k];
    process.env.AI_PROVIDER = 'openrouter';
    expect(p.isEnabled()).toBe(false);
    process.env.OPENROUTER_API_KEY = 'k'; expect(p.isEnabled()).toBe(false); // no model names yet
    process.env.AI_MODEL = 'vendor/small'; expect(p.isEnabled()).toBe(false);
    process.env.AI_PLAN_MODEL = 'vendor/standard'; expect(p.isEnabled()).toBe(true);
    process.env.OPENAI_API_KEY = 'other'; delete process.env.OPENROUTER_API_KEY; expect(p.isEnabled()).toBe(false); // an OpenAI key does not turn OpenRouter on
    process.env.OPENROUTER_API_KEY = 'k';
    expect(p.buildBody({ model: 'm', user: 'U', maxTokens: 5 }).provider).toEqual({ zdr: true });
    process.env.AI_OPENROUTER_ZDR = 'off'; expect(p.buildBody({ model: 'm', user: 'U', maxTokens: 5 }).provider).toBeUndefined();
  });

  test('OpenAI mode is unchanged: no provider block in the body', () => {
    process.env.AI_PROVIDER = 'openai'; delete process.env.AI_OPENROUTER_ZDR;
    expect(p.buildBody({ model: 'm', user: 'U', maxTokens: 5 }).provider).toBeUndefined();
  });
});
