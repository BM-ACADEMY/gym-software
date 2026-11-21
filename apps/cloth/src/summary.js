'use strict';
// Owner's daily summary: yesterday's numbers and THREE things to do today, each with its reason. Suggestions only; nothing is sent.
// Money in whole rupees (INR). Pure: the caller gathers the inputs.
const rs = (n) => 'Rs ' + Math.round(n).toLocaleString('en-IN');
function build({ today, salesYesterday = 0, billsYesterday = 0, alterations, followups, slow = [], gaps = [], supplierDue = 0, staffDiscounts = [] }) {
  const acts = [];
  const a = alterations || { overdue: [], dueToday: [], notCollected: [] }; const f = followups || { lapsed: [], creditOverdue: [], occasions: [] };
  if (a.overdue.length) acts.push({ weight: 100 + a.overdue.length, key: 'alt_overdue', text: `Call ${a.overdue.length} customer(s) whose alteration is late`, reason: `Oldest is ${a.overdue[0].lateDays} day(s) late: "${a.overdue[0].what}".` });
  const credit = f.creditOverdue.reduce((s, c) => s + c.due, 0);
  if (credit > 0) acts.push({ weight: 90 + Math.min(9, f.creditOverdue.length), key: 'credit', text: `Ask ${f.creditOverdue.length} regular(s) for pending udhaar, ${rs(credit)} in all`, reason: `Each has owed money for 30+ days.` });
  const tied = slow.reduce((s, x) => s + x.tiedUp, 0);
  if (slow.length) acts.push({ weight: 80, key: 'slow', text: `Mark down ${slow.length} slow style(s) before the season ends`, reason: `${rs(tied)} of stock at cost has not sold for 60+ days.` });
  if (f.occasions.length) acts.push({ weight: 70, key: 'occasion', text: `Send an offer to ${f.occasions.length} customer(s) with an occasion this week`, reason: `Birthdays or anniversaries within 7 days (you wrote these down).` });
  if (f.lapsed.length) acts.push({ weight: 60, key: 'lapsed', text: `Bring back ${f.lapsed.length} customer(s) not seen in 90+ days`, reason: `Longest away: ${f.lapsed[0].daysAway} days.` });
  if (gaps.length) acts.push({ weight: 50, key: 'gap', text: `Reorder size ${gaps[0].size} of ${gaps[0].style}`, reason: `Sold ${gaps[0].sold} recently, now zero, while ${gaps[0].stockElsewhere} pieces of other sizes sit on the shelf.` });
  if (a.notCollected.length) acts.push({ weight: 45, key: 'uncollected', text: `Remind ${a.notCollected.length} customer(s) to collect finished alterations`, reason: `Ready for 7+ days.` });
  if (supplierDue > 0) acts.push({ weight: 40, key: 'supplier', text: `Plan to pay suppliers: ${rs(supplierDue)} due`, reason: 'Total of unpaid supplier bills.' });
  acts.sort((x, y) => y.weight - x.weight);
  return { date: today, salesYesterday, billsYesterday, currency: 'INR', headline: `Yesterday: ${rs(salesYesterday)} from ${billsYesterday} bill(s).`, actions: acts.slice(0, 3).map(({ key, text, reason }) => ({ key, text, reason })), mode: 'suggest', notes: staffDiscounts.slice(0, 1).map((d) => d.reason + ' Each is saved on its bill.') };
}
module.exports = { build };
