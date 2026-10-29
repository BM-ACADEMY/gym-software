'use strict';
// Super Admin marketing autopilot, pure rules (SA-13/14/15): no database, no network, no AI.
// Suggestions are only ever SUGGESTED. Kamarudeen approves; the DM team does the work; nothing is posted or sent from here.
// Inputs hold counts and product-level facts only: never a customer, member or candidate.
const STATUSES = ['suggested', 'approved', 'done', 'skipped', 'snoozed'];
const NEXT = { suggested: ['approved', 'skipped', 'snoozed'], approved: ['done', 'skipped'], snoozed: ['suggested', 'skipped'], done: [], skipped: ['suggested'] };
const CHANNELS = ['instagram', 'youtube', 'whatsapp_channel', 'website', 'email', 'call', 'other'];
const PRIORITY = { decision_today: 0, this_week: 1, later: 2 };
const DAY = 86400000;
const err = (code, message) => Object.assign(new Error(message), { code });

function validateItem(i) {
  const title = String((i && i.title) || '').trim();
  if (title.length < 5 || title.length > 140) throw err('ITEM_TITLE', 'Title must be 5 to 140 characters.');
  const reason = String(i.reason || '').trim(); if (!reason) throw err('ITEM_REASON', 'Every suggestion needs a reason.');
  const priority = i.priority in PRIORITY ? i.priority : 'this_week';
  const channel = i.channel == null ? 'other' : i.channel; if (!CHANNELS.includes(channel)) throw err('ITEM_CHANNEL', 'Unknown channel.');
  const due = i.due ? new Date(i.due) : null; if (due && isNaN(due)) throw err('ITEM_DUE', 'Bad due date.');
  return { key: i.key ? String(i.key) : null, title, reason: reason.slice(0, 300), product: i.product ? String(i.product).toLowerCase() : null, channel, priority, due, owner: i.owner || 'dm_team', source: i.source || 'manual', status: 'suggested' };
}

function move(item, to, { now = new Date(), snoozeDays = 3, by } = {}) {
  if (!STATUSES.includes(to)) throw err('ITEM_STATUS', 'Unknown status.');
  if (!(NEXT[item.status] || []).includes(to)) throw err('ITEM_TRANSITION', `Cannot go from ${item.status} to ${to}.`);
  const out = { ...item, status: to, changedAt: now, changedBy: by || null };
  if (to === 'snoozed') out.snoozeUntil = new Date(now.getTime() + Math.max(1, Math.min(snoozeDays, 30)) * DAY);
  else out.snoozeUntil = null;
  return out;
}
// A snoozed item returns to the list when its time is up.
const wake = (items, now = new Date()) => items.map((i) => (i.status === 'snoozed' && i.snoozeUntil && new Date(i.snoozeUntil) <= now ? { ...i, status: 'suggested', snoozeUntil: null } : i));

const daysUntil = (d, now) => Math.ceil((new Date(d).getTime() - now.getTime()) / DAY);
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

// facts = the combined summary from aggregate.combine: { products:[{product,state:'ok'|...,targetDate?,businesses:{total,paying,trial,grace,expired,signups7d},endingSoon:[{kind,daysLeft}]}], totals:{aiCostTodayInr,aiBudgetInr} }
// calendar: [{id,name,date,products?:[...]}] edited by Kamarudeen (dates are never hard-coded here).
function suggest(facts, calendar, now = new Date()) {
  const out = []; const add = (o) => out.push(validateItem({ source: 'rule', ...o }));
  for (const p of (facts && facts.products) || []) {
    const name = p.product;
    const ending = (p.endingSoon || []).filter((e) => e.kind === 'trial' && e.daysLeft <= 3).length;
    if (ending) add({ key: `trial_ending:${name}:${dayKey(now)}`, title: `${ending} ${name} trial${ending > 1 ? "s" : ""} ending within 3 days: send the contact list to the sales team`, reason: `${ending} businesses on a ${name} trial have 3 days or less left (count from the product, no names here).`, product: name, channel: 'call', priority: 'decision_today', owner: 'sales', due: now });
    const expired = p.businesses && p.businesses.expired;
    if (expired > 0) add({ key: `winback:${name}:${dayKey(now).slice(0, 7)}`, title: `Win-back push for ${expired} expired ${name} account${expired > 1 ? 's' : ''}`, reason: `${expired} accounts have expired. A short win-back message or call this month can bring some back.`, product: name, channel: 'whatsapp_channel', priority: 'this_week', due: new Date(now.getTime() + 3 * DAY) });
    if (p.state === 'ok' && p.businesses && p.businesses.signups7d === 0) add({ key: `no_signups:${name}:${dayKey(now)}`, title: `No ${name} sign-ups in 7 days: plan one post and one outreach`, reason: `The product is live and 0 businesses signed up in the last 7 days.`, product: name, channel: 'instagram', priority: 'this_week', due: new Date(now.getTime() + 2 * DAY) });
    if (p.targetDate) { const d = daysUntil(p.targetDate, now); if (d >= 0 && d <= 14) add({ key: `launch:${name}:${dayKey(p.targetDate)}`, title: `Prepare launch posts for ${name} (launch target in ${d} day${d === 1 ? '' : 's'})`, reason: `Launch target is ${dayKey(p.targetDate)}. Only claim what a person has seen working.`, product: name, channel: 'instagram', priority: d <= 3 ? 'decision_today' : 'this_week', due: new Date(new Date(p.targetDate).getTime() - 3 * DAY) }); }
  }
  for (const e of calendar || []) {
    const d = daysUntil(e.date, now);
    if (d >= 0 && d <= 14) add({ key: `event:${e.id}:${dayKey(e.date)}`, title: `Plan ${e.name} posts and offers (${d} day${d === 1 ? '' : 's'} away)`, reason: `${e.name} is on ${dayKey(e.date)}. Posts need design and approval time.`, product: (e.products && e.products.length === 1) ? e.products[0] : null, channel: 'instagram', priority: d <= 5 ? 'decision_today' : 'this_week', due: new Date(new Date(e.date).getTime() - 5 * DAY) });
  }
  const t = facts && facts.totals;
  if (t && t.aiBudgetInr > 0 && t.aiCostTodayInr >= 0.8 * t.aiBudgetInr) add({ key: `ai_budget:${dayKey(now)}`, title: `AI spend is at ${Math.round(100 * t.aiCostTodayInr / t.aiBudgetInr)}% of today's budget`, reason: 'AI features stop when the budget is reached. Decide whether to raise it or wait.', channel: 'other', priority: 'decision_today', owner: 'owner', due: now });
  return out;
}
// Add only suggestions whose key is not already stored (reruns do not duplicate).
const newOnly = (suggestions, existingKeys) => { const seen = new Set(existingKeys); return suggestions.filter((s) => s.key && !seen.has(s.key)); };

// Today brief: at most 5 open items, most urgent first.
function todayBrief(items, now = new Date(), max = 5) {
  return wake(items, now).filter((i) => i.status === 'suggested' || i.status === 'approved')
    .sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority] || (a.due ? new Date(a.due).getTime() : Infinity) - (b.due ? new Date(b.due).getTime() : Infinity)).slice(0, max);
}
// Push plan: only "decision today" items, never in quiet hours (IST 21:00-08:00), at most 3 a day.
function pushPlan(items, { sentToday = 0, now = new Date(), maxPerDay = 3, quietFrom = 21, quietTo = 8 } = {}) {
  const h = new Date(now.getTime() + 5.5 * 3600000).getUTCHours();
  const quiet = quietFrom > quietTo ? (h >= quietFrom || h < quietTo) : (h >= quietFrom && h < quietTo);
  if (quiet) return { send: [], reason: 'quiet_hours' };
  const room = Math.max(0, maxPerDay - sentToday);
  return { send: items.filter((i) => i.status === 'suggested' && i.priority === 'decision_today' && !i.pushedAt).slice(0, room), reason: room ? null : 'daily_limit' };
}
module.exports = { validateItem, move, wake, suggest, newOnly, todayBrief, pushPlan, STATUSES, CHANNELS, PRIORITY };
