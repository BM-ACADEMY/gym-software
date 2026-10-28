// The one place that talks to an AI provider (decision D-15: OpenAI for all products).
// Every feature calls complete(); nothing else imports a provider SDK. To change the
// provider or model later, change this file or the environment, not the features.
// Uses Node's built-in fetch, so there is no new npm package to install.
//
// Environment (names only, see .env.example):
//   OPENAI_API_KEY      secret, set on the host only
//   AI_PROVIDER         'openai' (default). Anything else switches AI off.
//   AI_MODEL            small model for Ask / insights (default gpt-5.4-nano)
//   AI_PLAN_MODEL       standard model for workout/diet plans (default gpt-5.4-mini)
//   AI_REASONING_EFFORT optional ('minimal' | 'low' | 'medium' | 'high'); sent only if set
//   OPENAI_BASE_URL     optional, for tests or a proxy (default https://api.openai.com/v1)
//
// UNVERIFIED until a human runs it with a real key: exact model names and whether the
// chosen model accepts reasoning_effort. A failure here never breaks a feature: callers
// catch the error and fall back to rules or help articles.

const DEFAULT_SMALL = 'gpt-5.4-nano';
const DEFAULT_STANDARD = 'gpt-5.4-mini';

const provider = () => String(process.env.AI_PROVIDER || 'openai').toLowerCase();
const isEnabled = () => provider() === 'openai' && Boolean(process.env.OPENAI_API_KEY);
const smallModel = () => process.env.AI_MODEL || DEFAULT_SMALL;
const standardModel = () => process.env.AI_PLAN_MODEL || DEFAULT_STANDARD;
const baseUrl = () => (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');

// Builds the request body. Pure, so it is unit tested without any network.
const buildBody = ({ model, system, user, maxTokens }) => {
  const body = {
    model,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: user },
    ],
    max_completion_tokens: maxTokens,
  };
  if (process.env.AI_REASONING_EFFORT) body.reasoning_effort = process.env.AI_REASONING_EFFORT;
  return body;
};

// Reads a chat completion response. Pure, unit tested.
const parseResponse = (json) => {
  const choice = json && json.choices && json.choices[0];
  if (!choice) throw new Error('AI reply had no choices');
  if (choice.message && choice.message.refusal) throw new Error('model declined');
  const text = choice.message && typeof choice.message.content === 'string' ? choice.message.content.trim() : '';
  if (!text) throw new Error(choice.finish_reason === 'length' ? 'AI reply was cut off before any text' : 'empty model reply');
  const u = json.usage || {};
  return { text, usage: { inTokens: u.prompt_tokens || 0, outTokens: u.completion_tokens || 0 }, model: json.model };
};

// @returns { text, usage: { inTokens, outTokens }, model }  Throws on any problem.
const complete = async ({ system, user, maxTokens = 400, model, timeoutMs = 20000, retries = 1 }) => {
  if (!isEnabled()) throw new Error('AI is not configured');
  const useModel = model || smallModel();
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${baseUrl()}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify(buildBody({ model: useModel, system, user, maxTokens })),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        // Never put the response body in the error: it can echo request content.
        const err = new Error(`AI provider returned HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return parseResponse(await res.json());
    } catch (err) {
      lastErr = err;
      const retryable = err.name === 'AbortError' || err.status === 429 || (err.status >= 500 && err.status < 600);
      if (!retryable || attempt === retries) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
};

module.exports = { isEnabled, complete, smallModel, standardModel, buildBody, parseResponse, DEFAULT_SMALL, DEFAULT_STANDARD };
