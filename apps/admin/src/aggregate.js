'use strict';
// Pure: checks what each product returned and combines it. Product replies are untrusted: unknown fields are
// dropped, numbers are clamped, and a bad reply marks only that product as "problem", never the whole screen.
const num = (v, max = 1e12) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= max ? n : 0; };
const str = (v, max = 80) => (typeof v === 'string' ? v.slice(0, max) : '');

function cleanSummary(raw, expectProduct) {
  if (!raw || typeof raw !== 'object' || raw.schema !== 1 || raw.product !== expectProduct) throw new Error('unexpected summary shape');
  const b = raw.businesses || {}; const ai = raw.ai || {};
  const list = (a) => (Array.isArray(a) ? a.slice(0, 20).map((x) => ({ name: str(x && x.name), kind: str(x && x.kind, 20), daysLeft: Number.isInteger(x && x.daysLeft) ? x.daysLeft : null })) : []);
  return {
    product: expectProduct, at: str(raw.at, 40), currency: 'INR',
    businesses: { total: num(b.total), trial: num(b.trial), paying: num(b.paying), grace: num(b.grace), expired: num(b.expired), suspended: num(b.suspended), signups7d: num(b.signups7d) },
    mrr: num(raw.mrr), collectedThisMonth: num(raw.collectedThisMonth),
    endingSoon: list(raw.endingSoon), renewalsDue: list(raw.renewalsDue),
    ai: { callsToday: num(ai.callsToday), costTodayInr: num(ai.costTodayInr), budgetInr: num(ai.budgetInr), stopped: !!ai.stopped },
    whatsappSentToday: num(raw.whatsappSentToday), openTickets: num(raw.openTickets),
  };
}

// results: [{ product, ok, summary?, error?, fetchedAt }]. staleAfterMs: older than this is shown as stale.
function combine(results, now = new Date(), staleAfterMs = 15 * 60 * 1000) {
  const products = results.map((r) => {
    if (!r.ok) return { product: r.product, state: 'unreachable', error: str(r.error, 120) };
    let s; try { s = cleanSummary(r.summary, r.product); } catch (e) { return { product: r.product, state: 'bad_reply', error: e.message }; }
    const age = now - new Date(r.fetchedAt || 0);
    return { ...s, state: age > staleAfterMs ? 'stale' : 'ok' };
  });
  const live = products.filter((p) => p.businesses);
  const sum = (f) => live.reduce((a, p) => a + f(p), 0);
  const budgetInr = sum((p) => p.ai.budgetInr);
  return {
    currency: 'INR', at: new Date(now).toISOString(), products,
    totals: {
      businesses: sum((p) => p.businesses.total), paying: sum((p) => p.businesses.paying), trial: sum((p) => p.businesses.trial),
      mrr: sum((p) => p.mrr), openTickets: sum((p) => p.openTickets), aiCostTodayInr: Math.round(sum((p) => p.ai.costTodayInr) * 100) / 100,
      aiBudgetInr: budgetInr, whatsappSentToday: sum((p) => p.whatsappSentToday),
    },
    attention: [
      ...products.filter((p) => p.state !== 'ok').map((p) => ({ level: p.state === 'stale' ? 'warn' : 'error', product: p.product, text: `${p.product}: ${p.state.replace('_', ' ')}` })),
      ...live.filter((p) => p.ai.stopped).map((p) => ({ level: 'error', product: p.product, text: `${p.product}: AI switched off by the daily budget` })),
      ...live.flatMap((p) => p.endingSoon.filter((e) => e.daysLeft !== null && e.daysLeft <= 3).map((e) => ({ level: 'warn', product: p.product, text: `${e.name}: ${e.kind} ends in ${e.daysLeft} day(s)` }))),
    ],
  };
}
module.exports = { cleanSummary, combine };
