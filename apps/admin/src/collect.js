'use strict';
// Fetches each product's summary. Config comes from the admin server's environment only:
//   ADMIN_PRODUCTS=gym,hire   and per product   ADMIN_URL_GYM=https://fit.afraventures.in   ADMIN_KEY_GYM=<that product's INTERNAL_API_KEY>
// Keys are never logged, never returned, and https is required (http only for localhost in development).
const NAMES = /^[a-z]{2,12}$/;
function readConfig(env = process.env) {
  return String(env.ADMIN_PRODUCTS || '').split(',').map((s) => s.trim().toLowerCase()).filter((n) => NAMES.test(n)).map((n) => {
    const url = env['ADMIN_URL_' + n.toUpperCase()]; const key = env['ADMIN_KEY_' + n.toUpperCase()];
    const okUrl = typeof url === 'string' && (/^https:\/\/[a-z0-9.-]+$/i.test(url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url));
    return { product: n, url: okUrl ? url : null, key: key && key.length >= 24 ? key : null };
  });
}
async function collectOne(cfg, { fetchImpl = fetch, timeoutMs = 8000, now = () => new Date() } = {}) {
  if (!cfg.url || !cfg.key) return { product: cfg.product, ok: false, error: 'not configured' };
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(cfg.url + '/api/internal/admin-summary', { headers: { 'x-internal-key': cfg.key }, signal: ctrl.signal });
    if (!res.ok) return { product: cfg.product, ok: false, error: 'HTTP ' + res.status };
    const body = await res.json();
    return { product: cfg.product, ok: true, summary: body && body.data, fetchedAt: now().toISOString() };
  } catch (e) { return { product: cfg.product, ok: false, error: e.name === 'AbortError' ? 'timed out' : 'network error' }; } // never include e.message: it can echo the URL
  finally { clearTimeout(t); }
}
const collectAll = (configs, opts) => Promise.all(configs.map((c) => collectOne(c, opts)));
module.exports = { readConfig, collectOne, collectAll };
