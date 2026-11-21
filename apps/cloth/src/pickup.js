'use strict';
// CLO-09: a secret link for one alteration job, so the customer can see "ready or not" without calling. Pure. Written, not yet tested by a person.
// The link shows only the item, the status, the ready date and the balance. Never a phone number or another customer's data.
const crypto = require('crypto');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const newToken = () => crypto.randomBytes(24).toString('hex'); // 48 hex characters
const tokenOk = (t) => typeof t === 'string' && /^[0-9a-f]{48}$/.test(t);
const WORDS = { received: 'We have received it', in_progress: 'Work is going on', ready: 'Ready for pickup', delivered: 'Already picked up', cancelled: 'Cancelled' };
const balance = (j) => Math.max(0, (Number(j.charge) || 0) - (Number(j.advance) || 0));
function view(job, shop) {
  if (!job) return null;
  return { shop: shop || '', item: job.what, status: job.status, statusText: WORDS[job.status] || job.status, readyOn: job.readyOn, readyAt: job.readyAt || null, balance: balance(job), currency: job.currency || 'INR' };
}
function html(v) {
  if (!v) return '<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Link not valid</title></head><body style="font:16px sans-serif;max-width:480px;margin:30px auto"><p>This link is not valid. Please ask the shop for a new one.</p></body></html>';
  const bal = v.status === 'ready' && v.balance > 0 ? `<p>Balance to pay at pickup: <b>Rs ${esc(v.balance)}</b></p>` : '';
  const when = v.status === 'ready' || v.status === 'delivered' || v.status === 'cancelled' ? '' : `<p>Expected ready on: <b>${esc(v.readyOn)}</b></p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(v.shop)} pickup</title></head><body style="font:16px sans-serif;max-width:480px;margin:30px auto;padding:0 16px"><h1 style="font-size:20px">${esc(v.shop)}</h1><p>${esc(v.item)}</p><p style="font-size:20px"><b>${esc(v.statusText)}</b></p>${when}${bal}<p style="color:#666;font-size:12px">This page shows only this job.</p></body></html>`;
}
// A tiny in-memory limiter: N tries per key per window. Keeps a guessing script slow (48 hex characters is already hard to guess).
function limiter({ max = 30, windowMs = 60000, now = () => Date.now() } = {}) {
  const hits = new Map();
  return (key) => { const t = now(); const h = (hits.get(key) || []).filter((x) => t - x < windowMs); if (h.length >= max) { hits.set(key, h); return false; } h.push(t); hits.set(key, h); if (hits.size > 5000) hits.clear(); return true; };
}
module.exports = { newToken, tokenOk, WORDS, balance, view, html, limiter };
