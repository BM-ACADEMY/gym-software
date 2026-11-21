// Renewal Copilot (AI-01): who to contact today, why, and a ready message.
// Ranking is rules (copilotRules.js), free and deterministic. AI is used only to reword a
// message TEMPLATE on request, never with member names or numbers, and is capped per plan.
const Member = require('../models/Member');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const CopilotAction = require('../models/CopilotAction');
const AiUsage = require('../models/AiUsage');
const aiProvider = require('./aiProvider');
const aiAssist = require('./aiAssist');
const C = require('./copilotRules');
const R = require('./automationRules');

const HIDE_DAYS = 3; // after "done", the same reason stays hidden for this long

const langOf = (sub, lang) => (['en', 'ta', 'hi'].includes(lang) ? lang : (['en', 'ta', 'hi'].includes(sub.language) ? sub.language : 'en'));

const getToday = async (sub, { lang, now = new Date(), limit = 15 } = {}) => {
  const subscriberId = sub._id;
  const useLang = langOf(sub, lang);
  const since30 = new Date(now.getTime() - 31 * C.DAY);
  const since90 = new Date(now.getTime() - 90 * C.DAY);
  const mid = new Date(now.getTime() - 14 * C.DAY);

  const [members, att, dues, acted] = await Promise.all([
    Member.find({ subscriberId, status: { $ne: 'cancelled' } })
      .select('name phone createdAt expiresAt status notificationPreferences').limit(3000).lean(),
    Attendance.aggregate([
      { $match: { subscriberId, checkedInAt: { $gte: since90 } } },
      { $group: {
        _id: '$memberId',
        last: { $max: '$checkedInAt' },
        att14: { $sum: { $cond: [{ $gte: ['$checkedInAt', mid] }, 1, 0] } },
        attPrior: { $sum: { $cond: [{ $and: [{ $lt: ['$checkedInAt', mid] }, { $gte: ['$checkedInAt', new Date(now.getTime() - 28 * C.DAY)] }] }, 1, 0] } },
      } },
    ]),
    Payment.aggregate([
      { $match: { subscriberId, status: { $in: ['pending', 'partial', 'overdue'] }, dueDate: { $lt: now } } },
      { $group: { _id: '$memberId', balance: { $sum: { $subtract: ['$amount', { $ifNull: ['$amountPaid', 0] }] } }, firstDue: { $min: '$dueDate' } } },
    ]),
    CopilotAction.find({ subscriberId, createdAt: { $gte: new Date(now.getTime() - HIDE_DAYS * C.DAY) } }).select('memberId kind').lean(),
  ]);

  const attBy = new Map(att.map((x) => [String(x._id), x]));
  const dueBy = new Map(dues.map((x) => [String(x._id), x]));
  const hidden = new Set(acted.map((a) => `${a.memberId}:${a.kind}`));

  const items = [];
  const counts = { renew: 0, lapsed: 0, dues: 0, absent: 0 };
  let totalDues = 0;

  for (const m of members) {
    const id = String(m._id);
    const a = attBy.get(id);
    const d = dueBy.get(id);
    const lapsedTooOld = m.expiresAt && new Date(m.expiresAt) < since30;
    const result = C.assess({
      expiresAt: m.expiresAt,
      balance: d ? d.balance : 0,
      overdueDays: d ? Math.floor((now - new Date(d.firstDue)) / C.DAY) : 0,
      // Absent only matters for members who are still paid up.
      absentDays: m.expiresAt && new Date(m.expiresAt) > now ? R.absenceDays(a?.last, m.createdAt, now) : null,
      att14: a ? a.att14 : 0,
      attPrior: a ? a.attPrior : 0,
    }, now);
    if (!result || (lapsedTooOld && result.kind !== 'dues')) continue;
    if (hidden.has(`${id}:${result.kind}`)) continue;
    counts[result.kind] += 1;
    if (result.kind === 'dues') totalDues += result.params.amount || 0;
    items.push({ member: m, result });
  }

  items.sort((x, y) => y.result.score - x.result.score);

  const number = (m) => C.waNumber(m.phone, sub.country || 'IN');
  const out = items.slice(0, limit).map(({ member: m, result }) => {
    const params = { name: String(m.name || '').split(/\s+/)[0] || 'there', gym: sub.gymName || 'our gym', ...result.params };
    const message = C.fill(C.template(useLang, result.kind), params);
    const num = number(m);
    const optedOut = m.notificationPreferences?.whatsapp === false;
    return {
      id: m._id, name: m.name, kind: result.kind, score: result.score, reasons: result.reasons,
      params, waNumber: optedOut ? null : num, message, waLink: optedOut ? null : C.waLink(num, message),
      canOpen: Boolean(num) && !optedOut,
    };
  });

  const u = await aiAssist.usage(sub, now);
  return {
    day: now.toISOString().slice(0, 10), lang: useLang,
    summary: { ...counts, totalDues, listed: out.length, notShown: Math.max(0, items.length - out.length) },
    templates: C.TEMPLATES[useLang], items: out,
    ai: { enabled: aiProvider.isEnabled(), remaining: u.remaining, cap: u.cap },
  };
};

const markDone = async (sub, memberId, kind, userId, step) => {
  if (!C.KINDS.includes(kind)) return { status: 400, message: 'Choose a valid reason.' };
  const stepNum = kind === 'lapsed' && [1, 2, 3].includes(Number(step)) ? Number(step) : undefined; // win-back step (AI-04)
  const member = await Member.findOne({ _id: memberId, subscriberId: sub._id }).select('_id').lean().catch(() => null);
  if (!member) return { status: 404, message: 'Member not found' };
  await CopilotAction.create({ subscriberId: sub._id, memberId: member._id, kind, actedBy: userId, ...(stepNum ? { step: stepNum } : {}) });
  return { status: 200 };
};

const TONES = { friendly: 'warm and friendly', short: 'very short and direct', formal: 'polite and formal' };

// Rewrites one message template (placeholders kept). No member data is sent to the model.
const polish = async (sub, { kind, lang, tone }, now = new Date()) => {
  if (!C.KINDS.includes(kind)) return { status: 400, message: 'Choose a valid reason.' };
  const useLang = langOf(sub, lang);
  const original = C.template(useLang, kind);
  const u = await aiAssist.usage(sub, now);
  if (!aiProvider.isEnabled()) return { status: 200, data: { source: 'template', text: original, note: 'AI is not switched on, so the standard message is used.' } };
  if (u.remaining <= 0) return { status: 200, data: { source: 'template', text: original, note: 'You have used this month\'s AI rewrites, so the standard message is used.' } };
  try {
    const system = 'You help a gym owner in India write short WhatsApp messages to members. Rewrite the message below in the SAME language, ' +
      `${TONES[tone] || TONES.friendly}. Keep every placeholder such as {name}, {gym}, {days}, {amount} exactly as written, add no links and no new facts, and keep it under 60 words. Reply with the message only.`;
    const reply = await aiProvider.complete({ system, user: original, maxTokens: 300, model: aiProvider.smallModel() });
    const text = reply.text.replace(/^["'\s]+|["'\s]+$/g, '');
    if (!C.polishValid(original, text)) return { status: 200, data: { source: 'template', text: original, note: 'The AI rewrite was not usable, so the standard message is used.' } };
    await AiUsage.create({ subscriberId: sub._id, kind: 'copilot', model: reply.model, ...reply.usage });
    return { status: 200, data: { source: 'ai', text, remaining: u.remaining - 1 } };
  } catch (err) {
    console.warn('Copilot rewrite failed, using the standard message:', err.message);
    return { status: 200, data: { source: 'template', text: original, note: 'AI is busy, so the standard message is used.' } };
  }
};

module.exports = { getToday, markDone, polish };
