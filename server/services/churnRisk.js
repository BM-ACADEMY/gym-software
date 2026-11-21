// Churn risk list and win-back steps for one gym (AI-04). Rules are in churnRules.js; every query filters by subscriberId.
const Member = require('../models/Member');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const CopilotAction = require('../models/CopilotAction');
const C = require('./copilotRules');
const K = require('./churnRules');
const R = require('./automationRules');

const HIDE_DAYS = 7; // after "contacted", the same member leaves the risk list for a week
const langOf = (sub, lang) => (['en', 'ta', 'hi'].includes(lang) ? lang : (['en', 'ta', 'hi'].includes(sub.language) ? sub.language : 'en'));

const getRisk = async (sub, { lang, now = new Date(), limit = 20 } = {}) => {
  const subscriberId = sub._id; const useLang = langOf(sub, lang);
  const since30 = new Date(now.getTime() - 31 * K.DAY); const since90 = new Date(now.getTime() - 90 * K.DAY); const mid = new Date(now.getTime() - 14 * K.DAY);
  const [members, att, dues, acted, winDone] = await Promise.all([
    Member.find({ subscriberId, status: { $ne: 'cancelled' }, expiresAt: { $gte: since30 } }).select('name phone createdAt expiresAt notificationPreferences').limit(3000).lean(),
    Attendance.aggregate([{ $match: { subscriberId, checkedInAt: { $gte: since90 } } }, { $group: { _id: '$memberId', last: { $max: '$checkedInAt' },
      att14: { $sum: { $cond: [{ $gte: ['$checkedInAt', mid] }, 1, 0] } },
      attPrior: { $sum: { $cond: [{ $and: [{ $lt: ['$checkedInAt', mid] }, { $gte: ['$checkedInAt', new Date(now.getTime() - 28 * K.DAY)] }] }, 1, 0] } } } }]),
    Payment.aggregate([{ $match: { subscriberId, status: { $in: ['pending', 'partial', 'overdue'] }, dueDate: { $lt: now } } }, { $group: { _id: '$memberId', balance: { $sum: { $subtract: ['$amount', { $ifNull: ['$amountPaid', 0] }] } }, firstDue: { $min: '$dueDate' } } }]),
    CopilotAction.find({ subscriberId, kind: 'absent', createdAt: { $gte: new Date(now.getTime() - HIDE_DAYS * K.DAY) } }).select('memberId').lean(),
    CopilotAction.find({ subscriberId, kind: 'lapsed', step: { $gte: 1 }, createdAt: { $gte: since30 } }).select('memberId step').lean(),
  ]);
  const attBy = new Map(att.map((x) => [String(x._id), x])); const dueBy = new Map(dues.map((x) => [String(x._id), x]));
  const hidden = new Set(acted.map((a) => String(a.memberId)));
  const doneBy = new Map(); winDone.forEach((w) => { const k = String(w.memberId); doneBy.set(k, [...(doneBy.get(k) || []), w.step]); });
  const first = (m) => String(m.name || '').split(/\s+/)[0] || 'there';
  const base = (m) => { const optedOut = m.notificationPreferences?.whatsapp === false; const num = optedOut ? null : C.waNumber(m.phone, sub.country || 'IN'); return { num, canOpen: Boolean(num) }; };
  const atRisk = []; const winBack = [];
  for (const m of members) {
    const id = String(m._id); const a = attBy.get(id); const d = dueBy.get(id);
    if (new Date(m.expiresAt) <= now) {
      const days = Math.floor((now - new Date(m.expiresAt)) / K.DAY);
      const due = K.winBackDue(days, doneBy.get(id) || []); if (!due) continue;
      const { num, canOpen } = base(m);
      const message = C.fill(K.winBackTemplate(due.step, useLang, C.template(useLang, 'lapsed')), { name: first(m), gym: sub.gymName || 'our gym', days });
      winBack.push({ id: m._id, name: m.name, step: due.step, days, message, waLink: canOpen ? C.waLink(num, message) : null, canOpen });
      continue;
    }
    if (hidden.has(id)) continue;
    const r = K.risk({ expiresAt: m.expiresAt, createdAt: m.createdAt, absentDays: R.absenceDays(a?.last, m.createdAt, now), att14: a ? a.att14 : 0, attPrior: a ? a.attPrior : 0, balance: d ? d.balance : 0, overdueDays: d ? Math.floor((now - new Date(d.firstDue)) / K.DAY) : 0 }, now);
    if (!r) continue;
    const { num, canOpen } = base(m);
    const message = C.fill(C.template(useLang, 'absent'), { name: first(m), gym: sub.gymName || 'our gym', days: R.absenceDays(a?.last, m.createdAt, now) || 0 });
    atRisk.push({ id: m._id, name: m.name, level: r.level, score: r.score, reasons: r.reasons, message, waLink: canOpen ? C.waLink(num, message) : null, canOpen });
  }
  atRisk.sort((x, y) => y.score - x.score); winBack.sort((x, y) => x.days - y.days);
  return { lang: useLang, summary: { high: atRisk.filter((x) => x.level === 'high').length, medium: atRisk.filter((x) => x.level === 'medium').length, winBackDue: winBack.length }, atRisk: atRisk.slice(0, limit), winBack: winBack.slice(0, limit) };
};
module.exports = { getRisk };
