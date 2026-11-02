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

// Account-level facts for the sales list (owner contact + status). Each item is cut down to the agreed fields and sizes,
// so a product cannot send extra data by mistake. Failures are named by product only (no URL, no key, no body).
const STATUSES = ['trial', 'active', 'grace', 'expired', 'suspended'];
const txt = (v, n) => String(v == null ? '' : v).slice(0, n);
const cnt = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.min(Math.floor(Number(v)), 1e7) : 0);
function cleanAccount(a, product) {
  if (!a || typeof a !== 'object' || !a.status || !STATUSES.includes(a.status.status)) return null;
  const left = Number(a.status.daysLeft);
  return { product, businessName: txt(a.businessName, 120), ownerName: txt(a.ownerName, 80), ownerPhone: txt(a.ownerPhone, 25), ownerEmail: txt(a.ownerEmail, 120), contactConsent: a.contactConsent === true,
    createdAt: a.createdAt || null, lastActiveAt: a.lastActiveAt || null, usage: { members: cnt(a.usage && a.usage.members), checkins14: cnt(a.usage && a.usage.checkins14) }, status: { status: a.status.status, daysLeft: Number.isFinite(left) ? left : null, endsAt: a.status.endsAt || null } };
}
async function collectAccounts(configs, { fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  const accounts = []; const failed = [];
  await Promise.all(configs.map(async (cfg) => {
    if (!cfg.url || !cfg.key) { failed.push(cfg.product); return; }
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(cfg.url + '/api/internal/admin-accounts', { headers: { 'x-internal-key': cfg.key }, signal: ctrl.signal });
      if (!res.ok) { failed.push(cfg.product); return; }
      const body = await res.json(); const list = body && Array.isArray(body.data) ? body.data : null;
      if (!list) { failed.push(cfg.product); return; }
      for (const a of list.slice(0, 5000)) { const c = cleanAccount(a, cfg.product); if (c) accounts.push(c); }
    } catch (e) { failed.push(cfg.product); } finally { clearTimeout(t); }
  }));
  return { accounts, failed: failed.sort() };
}
module.exports = { readConfig, collectOne, collectAll, collectAccounts, cleanAccount };
