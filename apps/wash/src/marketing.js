'use strict';
// Marketing suggestions. Suggest only: nothing is sent. WhatsApp only through approved templates (names wash_*), none approved yet.
// Festival dates change every year, so the owner types the festival and date; we only prompt the week before.
const TEMPLATES = { review: 'wash_review_request', ready: 'wash_car_ready', due: 'wash_wash_due' }; // names to be submitted to Meta; NOT approved
function reviewRequests(jobs, limit = 20) {
  return (jobs || []).filter((j) => j.state === 'delivered' && j.ownerPhone && !j.doNotContact).slice(0, limit).map((j) => ({ plate: j.plate, template: TEMPLATES.review, approved: false, reason: 'Delivered today and the customer is not on do-not-contact' }));
}
// Off-peak offer idea tied to a real slow hour, if the prediction is available.
function offPeakOffer(busy, price) {
  if (!busy || !busy.enough || !busy.slowest.length) return null;
  const h = busy.slowest[0].hour; const pct = 15;
  return { text: `Offer ${pct} percent off wash between ${h}:00 and ${h + 1}:00`, reason: `That hour had only ${busy.slowest[0].jobs} jobs in ${busy.basedOn}`, example: price ? `A Rs ${price} wash becomes Rs ${Math.round(price * (100 - pct) / 100)}` : undefined, estimate: true };
}
// A festival prompt: owner has saved { name, date }. Show it from 10 days before until the day.
function festivalPrompts(festivals, today) {
  const DAY = 86400000; const t = Date.parse(today + 'T00:00:00Z');
  return (festivals || []).filter((f) => f && f.name && /^\d{4}-\d{2}-\d{2}$/.test(f.date || '')).map((f) => ({ f, left: Math.round((Date.parse(f.date + 'T00:00:00Z') - t) / DAY) })).filter((x) => x.left >= 0 && x.left <= 10)
    .map((x) => ({ text: `Plan a ${x.f.name} special wash offer`, reason: `${x.f.name} is in ${x.left} day${x.left === 1 ? '' : 's'}, you saved this date` }));
}
module.exports = { TEMPLATES, reviewRequests, offPeakOffer, festivalPrompts };
