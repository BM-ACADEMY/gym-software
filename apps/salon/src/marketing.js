'use strict';
// Marketing suggestions. SUGGEST ONLY: nothing is sent. Only customers who agreed to be contacted are listed.
// Festival dates and offer wording are the OWNER'S own list (we do not invent dates). Pure.
const days = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
// festivals: [{ name, date:'YYYY-MM-DD', offer }] typed by the owner. Suggest 3 to 10 days before.
function festivalIdeas(festivals, today) {
  return (festivals || []).filter((f) => f && f.date && days(today, f.date) >= 0 && days(today, f.date) <= 10)
    .map((f) => ({ kind: 'festival', title: `${f.name} is in ${days(today, f.date)} day(s): announce your offer`, reason: f.offer ? `Your offer: ${f.offer}` : 'Add the offer you want to announce.', suggestOnly: true }));
}
// Review requests: visits finished yesterday, customer agreed to be contacted, not asked yet.
const reviewRequests = (visits) => visits.filter((v) => v.status === 'done' && v.consent && !v.doNotContact && !v.reviewAsked)
  .map((v) => ({ kind: 'review', customerId: v.customerId, title: 'Ask for a review after a good visit', reason: 'A short review request the day after a visit is when customers are happiest.', suggestOnly: true }));
module.exports = { festivalIdeas, reviewRequests };
