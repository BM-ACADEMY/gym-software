'use strict';
// Owner daily summary: what happened, and THREE things to do today, each with its reason. Pure; suggestions only.
// Nothing is sent from here. Money in whole rupees. jobs: today's jobs. vehicles: all vehicles. passes: all passes.
const { lapsed, dueForWash } = require('./winback');
const { status } = require('./pass');
const { pickupDelayed } = require('./jobs');
const { dayTotals, ranking } = require('./incentive');
const { idleMinutes } = require('./bays');
const { staffDiscounts, voids } = require('./leaks');

function summarize({ today, nowIso, jobs = [], vehicles = [], passes = [], closing = null, rules, open = 540, close = 1260, bayCount = 1, bayJobs = [] }) {
  const delivered = jobs.filter((j) => j.state === 'delivered');
  const revenue = delivered.reduce((s, j) => s + (j.total || 0), 0);
  const pay = { cash: 0, upi: 0, card: 0, pass: 0 };
  for (const j of delivered) { if (j.passId) pay.pass += j.passCovered !== undefined ? j.passCovered : ((j.payments || []).length ? 0 : j.total || 0); for (const p of j.payments || []) if (pay[p.method] !== undefined) pay[p.method] += p.amount || 0; }
  // bayJobs: one list of {start,end} (minutes) per bay. No list given: every bay counts as empty.
  const perBay = bayJobs.length ? bayJobs : Array.from({ length: Math.max(1, bayCount) }, () => []);
  const idle = perBay.reduce((s, b) => s + idleMinutes(open, close, b), 0);
  const totals = dayTotals(jobs, rules);
  const leaks = { staffDiscounts: staffDiscounts(jobs), voids: voids(jobs) };
  const facts = { leaks, jobsDelivered: delivered.length, jobsOpen: jobs.filter((j) => ['waiting', 'washing', 'ready'].includes(j.state)).length, revenue, currency: 'INR', pay, idleMinutes: idle, ranking: ranking(totals).slice(0, 3) };

  // Candidate actions. Each has an amount at stake (rupees, or null), a reason, and never sends anything.
  const acts = [];
  const delayed = jobs.filter((j) => pickupDelayed(j, nowIso));
  if (delayed.length) acts.push({ key: 'pickup', weight: 3, text: `Phone ${delayed.length} owner${delayed.length > 1 ? 's' : ''} to collect the car`, reason: `Ready for over 2 hours: ${delayed.map((j) => j.plate).join(', ')}`, rupees: delayed.reduce((s, j) => s + (j.total || 0), 0) });
  const owed = (j) => (j.total || 0) - (j.passId ? (j.passCovered !== undefined ? j.passCovered : j.total || 0) : 0);
  const paidOn = (j) => (j.payments || []).reduce((s, p) => s + p.amount, 0);
  const unpaid = delivered.filter((j) => paidOn(j) < owed(j));
  if (unpaid.length) acts.push({ key: 'unpaid', weight: 3, text: `Collect payment on ${unpaid.length} delivered job${unpaid.length > 1 ? 's' : ''}`, reason: 'Delivered but the payments entered are less than the job total', rupees: unpaid.reduce((s, j) => s + (owed(j) - paidOn(j)), 0) });
  if (closing && closing.flag) acts.push({ key: 'cash', weight: 3, text: 'Check yesterday\'s cash count with the staff', reason: `Cash counted was Rs ${Math.abs(closing.diff)} ${closing.diff < 0 ? 'short' : 'over'} of what the bills say`, rupees: Math.abs(closing.diff) });
  const sd = leaks.staffDiscounts[0]; if (sd) acts.push({ key: 'staffDiscounts', weight: 2, text: `Look at ${sd.count} staff discount${sd.count > 1 ? 's' : ''} given today`, reason: `Staff gave discounts worth Rs ${sd.total}; each has a reason on the job`, rupees: sd.total });
  const vd = leaks.voids[0]; if (vd) acts.push({ key: 'voids', weight: 2, text: `Ask why ${vd.count} started job${vd.count > 1 ? 's were' : ' was'} cancelled`, reason: `Cancelled after washing began, worth Rs ${vd.total}`, rupees: vd.total });
  const expiring = passes.map((p) => ({ p, s: status(p, today) })).filter((x) => x.s.remind && !x.s.expired);
  if (expiring.length) acts.push({ key: 'passes', weight: 2, text: `Offer renewal to ${expiring.length} monthly pass customer${expiring.length > 1 ? 's' : ''}`, reason: 'Pass ends within 5 days or has one wash left', rupees: expiring.reduce((s, x) => s + (x.p.price || 0), 0) });
  const due = dueForWash(vehicles, today);
  if (due.length) acts.push({ key: 'due', weight: 2, text: `Send a wash reminder to ${Math.min(due.length, 10)} regular customer${due.length > 1 ? 's' : ''}`, reason: `Past their usual gap, for example ${due[0].plate} by ${due[0].overdueDays} days`, rupees: null });
  const gone = lapsed(vehicles, today);
  if (gone.length) acts.push({ key: 'lapsed', weight: 1, text: `Win back ${gone.length} vehicle${gone.length > 1 ? 's' : ''} not seen in 60 days`, reason: `Longest away: ${gone[0].plate}, ${gone[0].daysAway} days`, rupees: null });
  if (idle >= 180) acts.push({ key: 'idle', weight: 1, text: 'Run an off-peak offer for the empty hours', reason: `${Math.round(idle / 60)} hours of bay time were empty yesterday`, rupees: null });
  acts.sort((a, b) => b.weight - a.weight || (b.rupees || 0) - (a.rupees || 0));
  return { today, facts, actions: acts.slice(0, 3).map(({ weight, ...a }) => a), autoSend: false };
}
module.exports = { summarize };
