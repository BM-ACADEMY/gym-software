'use strict';
// Phone alerts (SA-17). Pure rules plus an injected sender: no network here, no secrets here.
// Only "decision today" items are pushed (see marketing.pushPlan: quiet hours 21:00-08:00 IST, at most 3 a day).
// A message holds the item's one-line title only. Titles are rule-made from counts, never a person's name, phone or email.
const M = require('./marketing');
const IST = 5.5 * 3600000;
const istDay = (d) => new Date(new Date(d).getTime() + IST).toISOString().slice(0, 10);

function validateSubscription(s) {
  const bad = (m) => Object.assign(new Error(m), { code: 'PUSH_SUB' });
  if (!s || typeof s !== 'object') throw bad('Missing subscription.');
  const endpoint = typeof s.endpoint === 'string' ? s.endpoint.trim() : '';
  if (!/^https:\/\/[^\s]{8,480}$/.test(endpoint)) throw bad('Bad subscription address.');
  const k = s.keys || {};
  if (typeof k.p256dh !== 'string' || typeof k.auth !== 'string' || k.p256dh.length < 20 || k.p256dh.length > 200 || k.auth.length < 8 || k.auth.length > 100) throw bad('Bad subscription keys.');
  return { endpoint, keys: { p256dh: k.p256dh, auth: k.auth } };
}

const payloadFor = (item) => JSON.stringify({ title: 'Afra: needs your decision', body: String(item.title || '').slice(0, 120), url: '/' });

// items: marketing items. subs: [{endpoint,keys}]. send(sub, payload) resolves, or rejects with {statusCode}.
// dropSub(endpoint): called for subscriptions the push service says are gone (404 or 410).
// markPushed(id, when): called once per item that reached at least one phone.
async function runPush({ items, subs, send, dropSub = async () => {}, markPushed = async () => {}, now = new Date() }) {
  const today = istDay(now);
  const sentToday = (items || []).filter((i) => i.pushedAt && istDay(i.pushedAt) === today).length;
  const plan = M.pushPlan(M.wake(items || [], now), { sentToday, now });
  if (!plan.send.length) return { sent: 0, reason: plan.reason || 'nothing_to_send', devices: (subs || []).length };
  if (!(subs || []).length) return { sent: 0, reason: 'no_devices', devices: 0 };
  let sent = 0, dropped = 0, failed = 0;
  for (const item of plan.send) {
    let reached = 0; const body = payloadFor(item);
    for (const sub of subs) {
      try { await send(sub, body); reached += 1; }
      catch (e) { const code = e && e.statusCode; if (code === 404 || code === 410) { dropped += 1; await dropSub(sub.endpoint); } else failed += 1; }
    }
    if (reached) { sent += 1; await markPushed(item.id, now); }
  }
  return { sent, dropped, failed, reason: sent ? null : 'not_delivered', devices: subs.length };
}

// Wraps the web-push library so the rest of the code never sees keys. `lib` is require('web-push'), loaded only when configured.
function makeSender(lib, { subject, publicKey, privateKey }) {
  lib.setVapidDetails(subject, publicKey, privateKey);
  return (sub, payload) => lib.sendNotification(sub, payload, { TTL: 6 * 3600, urgency: 'high' });
}
module.exports = { validateSubscription, payloadFor, runPush, makeSender, istDay };
