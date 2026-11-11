'use strict';
// Public booking link for a wash business: a customer asks for a slot or a pickup, the business confirms by phone.
// The secret token in the link is the only key. Nothing here confirms a booking; it is a REQUEST the owner accepts or declines.
// Pure rules (token, checks, rate limit, page text). The page is plain HTML, no framework, no third-party scripts.
const crypto = require('crypto');
const V = require('./vehicles');
const TOKEN = /^[0-9a-f]{48}$/;
const newToken = () => crypto.randomBytes(24).toString('hex');
const SLOTS = []; for (let m = 8 * 60; m <= 19 * 60 + 30; m += 30) SLOTS.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
const DAYRE = /^\d{4}-\d{2}-\d{2}$/;
const days = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

// today: 'YYYY-MM-DD' (IST). Returns { value } or { error }. Phone digits only; plate optional.
function checkRequest(b, today) {
  if (!b || typeof b !== 'object') return { error: 'Fill in the form' };
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 80) : '';
  if (name.length < 2) return { error: 'Enter your name' };
  const phone = String(b.phone || '').replace(/\D/g, '');
  if (!/^[6-9]\d{9}$/.test(phone)) return { error: 'Enter a 10-digit mobile number' };
  if (b.consent !== true) return { error: 'Please tick the box so the business may use your details to answer you' };
  if (!DAYRE.test(b.day || '') || days(today, b.day) < 0 || days(today, b.day) > 14) return { error: 'Choose a day from today up to 14 days ahead' };
  if (!SLOTS.includes(b.slot)) return { error: 'Choose a time between 8 AM and 7:30 PM' };
  let plate; if (b.plate) { plate = V.normalizePlate(b.plate); if (!V.validPlate(plate)) return { error: 'That number plate does not look right' }; }
  const klass = b.klass === undefined || b.klass === '' ? undefined : b.klass;
  if (klass !== undefined && !V.CLASSES.includes(klass)) return { error: 'Choose a vehicle class' };
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 120) : '';
  if (/[<>]/.test(note) || /[<>]/.test(name)) return { error: 'Please use plain words' };
  return { value: { name, phone, plate, klass, day: b.day, slot: b.slot, pickup: b.pickup === true, note } };
}
// A small in-memory limiter: at most `max` calls per `windowMs` per key. Good enough for one server; Dev B tries to beat it.
function makeLimiter(max = 5, windowMs = 10 * 60 * 1000, now = () => Date.now()) {
  const hits = new Map();
  return (key) => {
    const t = now(); const arr = (hits.get(key) || []).filter((x) => t - x < windowMs);
    if (arr.length >= max) { hits.set(key, arr); return false; }
    arr.push(t); hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((x) => t - x < windowMs)) hits.delete(k);
    return true;
  };
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// The page. businessName is escaped. The script is allowed by a per-request nonce in the page's security header.
function renderPage({ businessName, token, today, nonce }) {
  const slots = SLOTS.map((s) => `<option value="${s}">${s}</option>`).join('');
  const classes = V.CLASSES.map((c) => `<option value="${c}">${c}</option>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Book a wash · ${esc(businessName)}</title>
<style>body{font:16px system-ui,sans-serif;margin:0;padding:16px;background:#f4f7f9;color:#12303d}main{max-width:440px;margin:0 auto}h1{font-size:20px}label{display:block;margin-top:12px;font-weight:600;font-size:14px}input,select{width:100%;box-sizing:border-box;padding:11px;border:1px solid #b8c8d0;border-radius:8px;font:inherit}button{margin-top:16px;width:100%;padding:13px;border:0;border-radius:10px;background:#0b6e8a;color:#fff;font:inherit;font-weight:700}.c{display:flex;gap:8px;align-items:flex-start;font-weight:400;font-size:13px}.c input{width:auto;margin-top:3px}#m{margin-top:12px;font-weight:600}small{color:#4a6572}</style></head><body><main>
<h1>Ask for a wash slot at ${esc(businessName)}</h1><p><small>This sends a request. The business will call you to confirm. Nothing is booked until they do.</small></p>
<form id="f"><label>Your name<input name="name" maxlength="80" required></label><label>Mobile number<input name="phone" inputmode="numeric" maxlength="10" required></label>
<label>Vehicle number (optional)<input name="plate" maxlength="15" placeholder="TN09AB1234"></label><label>Vehicle type (optional)<select name="klass"><option value="">Not sure</option>${classes}</select></label>
<label>Day<input type="date" name="day" min="${esc(today)}" value="${esc(today)}" required></label><label>Time<select name="slot">${slots}</select></label>
<label class="c"><input type="checkbox" name="pickup"> I would like pickup from my place (the business will tell you if it is possible)</label>
<label>Note (optional)<input name="note" maxlength="120"></label>
<label class="c"><input type="checkbox" name="consent" required> I agree that ${esc(businessName)} stores my name, phone and vehicle number to answer this request. (Wording pending lawyer review.)</label>
<button type="submit">Send request</button></form><p id="m" role="status"></p></main>
<script nonce="${esc(nonce)}">var f=document.getElementById('f'),m=document.getElementById('m');f.addEventListener('submit',function(e){e.preventDefault();var d=new FormData(f);var b={name:d.get('name'),phone:d.get('phone'),plate:d.get('plate'),klass:d.get('klass'),day:d.get('day'),slot:d.get('slot'),pickup:d.get('pickup')==='on',note:d.get('note'),consent:d.get('consent')==='on'};fetch('/api/wash-book/${esc(token)}/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json()}).then(function(j){m.textContent=j.message||'Done';if(j.success)f.reset()}).catch(function(){m.textContent='Could not send. Please call the business.'})});</script></body></html>`;
}
const securityHeaders = (nonce) => ({ 'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' });
module.exports = { TOKEN, SLOTS, newToken, checkRequest, makeLimiter, renderPage, securityHeaders, esc };
