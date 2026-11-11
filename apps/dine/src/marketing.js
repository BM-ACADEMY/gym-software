'use strict';
// Marketing SUGGESTIONS (area 7). Nothing is sent from here. Sending needs the owner's switch and an approved WhatsApp template (dine_*, D-12).
// Message text is English only for now: Tamil and Hindi need native review (M-06) before they are offered.
// Pub mode: alcohol marketing is regulated and Meta's alcohol policy is unchecked (DIN-R2, Assumption: restricted), so nothing that names liquor is suggested for WhatsApp.
const bad = (m) => { const e = new Error(m); e.code = 'MARKETING_INVALID'; throw e; };
const first = (n) => String(n || '').trim().split(/\s+/)[0] || 'there';

function winBackList(customers, today, venue, minDays = 45) {
  return customers.filter((c) => !c.doNotContact && c.lastVisit && (Date.parse(today) - Date.parse(c.lastVisit)) / 86400000 >= minDays)
    .map((c) => ({ id: c.id, name: c.name, daysAway: Math.round((Date.parse(today) - Date.parse(c.lastVisit)) / 86400000) }))
    .sort((a, b) => b.daysAway - a.daysAway)
    .map((c) => ({ ...c, template: 'dine_winback', message: 'Hi ' + first(c.name) + ', it has been a while since you visited ' + venue + '. We would love to see you again.', reason: c.name + ' has not visited for ' + c.daysAway + ' days.' }));
}
// The festival list belongs to the owner (edit it any time; dates are not hard-coded because many move every year).
// calendar: [{ name, date:'YYYY-MM-DD', offerIdea? }]
function upcomingFestivals(calendar, today, aheadDays = 14) {
  const t = Date.parse(today);
  return calendar.filter((f) => { const d = Date.parse(f.date); return d >= t && d <= t + aheadDays * 86400000; }).sort((a, b) => a.date.localeCompare(b.date))
    .map((f) => ({ name: f.name, date: f.date, daysAway: Math.round((Date.parse(f.date) - t) / 86400000), idea: f.offerIdea || 'A set menu or a family combo for ' + f.name + '.', reason: f.name + ' is in ' + Math.round((Date.parse(f.date) - t) / 86400000) + ' day(s) and you have not planned an offer for it yet.' }));
}
// Slow-hour offer: only items that are NOT liquor, and only in non-pub messages.
function slowHourOffer(slow, menu, venue) {
  if (!slow || !slow.length) return null;
  const items = menu.filter((m) => m.kind !== 'liquor').slice(0, 3).map((m) => m.name);
  const h = slow[0].hour;
  return { template: 'dine_slow_hour', window: h + ':00 to ' + (h + 1) + ':00', suggestion: 'Offer a small treat between ' + h + ':00 and ' + (h + 1) + ':00' + (items.length ? ' on ' + items.join(', ') : '') + '. The owner sets the offer.', message: 'Hi, ' + venue + ' has a small offer this ' + h + ':00 to ' + (h + 1) + ':00 slot. Ask for it at the counter.', reason: slow[0].reason };
}
function reviewRequest(order, venue, reviewLink) {
  if (!reviewLink || !/^https:\/\//.test(reviewLink)) bad('A review link must start with https://');
  return { template: 'dine_review', message: 'Thank you for visiting ' + venue + '. If you enjoyed it, a short review helps us: ' + reviewLink, reason: 'Sent only after a paid bill, one time per visit.', orderId: order && order.id };
}
const blockedForPub = (text) => /\b(beer|whisky|whiskey|rum|vodka|gin|brandy|wine|liquor|alcohol|cocktail|peg|bottle)\b/i.test(text || '');
module.exports = { winBackList, upcomingFestivals, slowHourOffer, reviewRequest, blockedForPub };
