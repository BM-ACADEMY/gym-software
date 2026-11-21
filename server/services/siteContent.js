'use strict';
// D-28: site wording the owner can change without a deploy. Pure functions (no database); see siteContentStore.js.
// Text only: no links, no tags. Only known sections and keys. Wording that promises something we have not built is refused
// (list from docs/MARKETING_CLAIMS.md "do NOT say"). WhatsApp template text is NOT in here and can never be added.
const DEFAULTS = require('../config/siteContentDefaults');

const SECTIONS = ['pricing', 'landing', 'faq', 'help'];
const TEXT_FIELDS = {
  pricing: { headline: 120, subline: 240 },
  landing: { badge: 60, line1: 60, line2: 60, line3: 60, subline: 300 },
};
const LIST_LIMITS = { faq: { items: 30, q: 150, a: 800 }, help: { items: 40, q: 150, para: 600, paras: 6 } };
const PLACEHOLDERS = ['{trialDays}'];
const BAD_MARKUP = /https?:|www\.|<|>|javascript:|data:|@\w+\.\w|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/i;
const BANNED = [
  [/unlimited\s+ai/i, 'Unlimited AI is not true: every plan has a monthly allowance.'],
  [/ai\s+(predicts|knows who will)/i, 'The churn score is a simple rule, not an AI prediction.'],
  [/(no\.?\s?1|number\s*(one|1)|#\s?1|best in india)/i, 'No "number one" claims: we cannot prove them.'],
  [/guarantee/i, 'No guarantees: we cannot promise results.'],
  [/ai\s+(chatbot|replies|writes your whatsapp)/i, 'Messages use fixed approved wording; the AI does not reply to or write your WhatsApp messages.'],
  [/(sends?|send)\s+messages?\s+(by itself|on its own|automatically for you)/i, 'Do not say messages send by themselves until Meta approval and tests are done.'],
  [/renewal\s+copilot/i, 'Renewal Copilot is not tested by a person yet, so it stays off the public pages.'],
];

function checkText(v, max, label) {
  if (typeof v !== 'string') return `${label}: text needed`;
  const t = v.replace(/[ \t]+/g, ' ').trim();
  if (!t) return `${label}: cannot be empty`;
  if (t.length > max) return `${label}: at most ${max} characters`;
  if (BAD_MARKUP.test(t)) return `${label}: no links, tags or email addresses (text only)`;
  const braces = t.match(/\{[^}]*\}/g) || [];
  if (braces.some((b) => !PLACEHOLDERS.includes(b))) return `${label}: only ${PLACEHOLDERS.join(', ')} may be used inside { }`;
  for (const [re, msg] of BANNED) if (re.test(t)) return `${label}: ${msg}`;
  if (/\bauto-?\s?renew(s|al|ing)?\b/i.test(t) && !/\b(no|not|never|without|doesn'?t|does not)\b[^.]*auto-?\s?renew/i.test(t)) return `${label}: plans do not renew automatically, so do not say they do`;
  return null;
}
const trim = (v) => String(v).replace(/[ \t]+/g, ' ').trim();

// Returns { value } (clean copy) or { error }.
function validateSection(section, value) {
  if (!SECTIONS.includes(section)) return { error: 'Unknown section' };
  if (TEXT_FIELDS[section]) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'Nothing to change' };
    const keys = Object.keys(TEXT_FIELDS[section]);
    const bad = Object.keys(value).filter((k) => !keys.includes(k));
    if (bad.length) return { error: `Cannot change: ${bad.join(', ')}` };
    const out = {};
    for (const k of keys) {
      if (!(k in value)) return { error: `${k}: missing` };
      const e = checkText(value[k], TEXT_FIELDS[section][k], k); if (e) return { error: e };
      out[k] = trim(value[k]);
    }
    return { value: out };
  }
  if (!Array.isArray(value)) return { error: 'A list is needed' };
  const L = LIST_LIMITS[section];
  if (value.length < 1 || value.length > L.items) return { error: `Between 1 and ${L.items} items`, };
  const seen = new Set(); const out = [];
  for (let i = 0; i < value.length; i++) {
    const it = value[i];
    if (!it || typeof it !== 'object') return { error: `Item ${i + 1}: not valid` };
    const extra = Object.keys(it).filter((k) => !['id', 'q', 'a'].includes(k));
    if (extra.length) return { error: `Item ${i + 1}: cannot have ${extra.join(', ')}` };
    let e = checkText(it.q, L.q, `Item ${i + 1} question`); if (e) return { error: e };
    let a;
    if (section === 'faq') { e = checkText(it.a, L.a, `Item ${i + 1} answer`); if (e) return { error: e }; a = trim(it.a); }
    else {
      if (!Array.isArray(it.a) || it.a.length < 1 || it.a.length > L.paras) return { error: `Item ${i + 1}: 1 to ${L.paras} paragraphs` };
      for (const p of it.a) { e = checkText(p, L.para, `Item ${i + 1} paragraph`); if (e) return { error: e }; }
      a = it.a.map(trim);
    }
    out.push({ id: it.id, q: trim(it.q), a });
  }
  for (const it of out) { if (it.id !== undefined && !(typeof it.id === 'string' && /^[a-z0-9-]{1,40}$/.test(it.id))) return { error: 'Item id not valid' }; if (it.id) { if (seen.has(it.id)) return { error: 'Two items share one id' }; seen.add(it.id); } }
  let n = 1; for (const it of out) if (!it.id) { while (seen.has('c' + n)) n++; it.id = 'c' + n; seen.add(it.id); }
  return { value: out };
}

const copy = (x) => JSON.parse(JSON.stringify(x));
// Live content: code defaults with saved sections laid over. A saved section that no longer validates is ignored (fail safe).
function merge(overrides) {
  const out = copy(DEFAULTS);
  for (const s of SECTIONS) { const o = overrides && overrides[s]; if (o === undefined) continue; const v = validateSection(s, o); if (v.value) out[s] = v.value; }
  return out;
}
const fill = (t, vars) => (typeof t === 'string' ? t.replace(/\{trialDays\}/g, String(vars.trialDays)) : t);
// What the public pages may see: placeholders replaced, nothing else.
function forPublic(content, vars) {
  const c = copy(content);
  for (const k of Object.keys(c.pricing)) c.pricing[k] = fill(c.pricing[k], vars);
  for (const k of Object.keys(c.landing)) c.landing[k] = fill(c.landing[k], vars);
  c.faq = c.faq.map((i) => ({ id: i.id, q: fill(i.q, vars), a: fill(i.a, vars) }));
  c.help = c.help.map((i) => ({ id: i.id, q: fill(i.q, vars), a: i.a.map((p) => fill(p, vars)) }));
  return c;
}
module.exports = { SECTIONS, TEXT_FIELDS, LIST_LIMITS, DEFAULTS, validateSection, merge, forPublic };
