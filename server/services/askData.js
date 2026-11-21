// Ask GymDesk on your own data (AI-02). Safe by design:
//  - the model never touches the database. It may only PICK one tool from a fixed list;
//  - every tool is read-only, takes only a number or a period, and filters by subscriberId;
//  - results are written by our code. Member names and phones never go to the model.
// Questions are first matched by keywords (free). Only if no keyword matches and AI is on, one
// small model call picks the tool (counted in the plan's monthly AI cap).
const Member = require('../models/Member');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const aiProvider = require('./aiProvider');
const R = require('./automationRules');

const MAX_ROWS = 15;
const DAY = R.DAY;

const TOOLS = {
  dues: { params: [] , help: 'who has unpaid or part-paid bills that are overdue' },
  expiring: { params: ['days'], help: 'memberships ending in the next N days (default 7)' },
  lapsed: { params: ['days'], help: 'memberships that ended in the last N days (default 30)' },
  absent: { params: ['days'], help: 'active members with no visit for N days or more (default 10)' },
  collections: { params: ['period'], help: 'money collected: period is today, week or month' },
  new_members: { params: ['period'], help: 'members who joined: period is today, week or month' },
  member_count: { params: [], help: 'how many active members there are' },
};

const PERIODS = ['today', 'week', 'month'];
const clampDays = (n, def, max = 90) => {
  const v = Number.parseInt(n, 10);
  return Number.isFinite(v) && v >= 1 ? Math.min(v, max) : def;
};

// ---------- pure: keyword router (English, Tamil, Hindi basics) ----------
const has = (q, words) => words.some((w) => q.includes(w));
const numberIn = (q) => { const m = q.match(/\b(\d{1,3})\b/); return m ? Number(m[1]) : undefined; };
const periodIn = (q) => {
  if (has(q, ['today', 'இன்று', 'आज'])) return 'today';
  if (has(q, ['week', 'வாரம்', 'हफ्ते', 'सप्ताह'])) return 'week';
  return 'month';
};

const route = (question) => {
  const q = String(question || '').toLowerCase();
  if (has(q, ['dues', 'due ', 'pending', 'unpaid', 'owe', 'outstanding', 'நிலுவை', 'बकाया', 'baaki', 'baki'])) return { tool: 'dues' };
  if (has(q, ['expir', 'renew', 'ending', 'end soon', 'about to end', 'முடிய', 'புதுப்பி', 'खत्म', 'रिन्यू'])) return { tool: 'expiring', days: numberIn(q) };
  if (has(q, ['lapsed', 'left', 'quit', 'dropped', 'ended', 'win back', 'winback'])) return { tool: 'lapsed', days: numberIn(q) };
  if (has(q, ['absent', 'not coming', "haven't come", 'not visited', "didn't come", 'missing', 'வரவில்லை', 'नहीं आ'])) return { tool: 'absent', days: numberIn(q) };
  if (has(q, ['collect', 'revenue', 'income', 'earn', 'received', 'sales', 'வசூல்', 'कमाई', 'वसूली'])) return { tool: 'collections', period: periodIn(q) };
  if (has(q, ['new member', 'joined', 'new joiner', 'signups', 'sign ups', 'புதிய உறுப்பினர்', 'नए मेंबर'])) return { tool: 'new_members', period: periodIn(q) };
  if (has(q, ['how many members', 'member count', 'total members', 'number of members', 'active members'])) return { tool: 'member_count' };
  return null;
};

// Validates whatever the model (or anyone) proposes. Unknown tools and odd parameters are dropped.
const sanitize = (pick) => {
  if (!pick || typeof pick !== 'object' || !Object.prototype.hasOwnProperty.call(TOOLS, pick.tool)) return null;
  const out = { tool: pick.tool };
  if (TOOLS[pick.tool].params.includes('days')) out.days = pick.days === undefined ? undefined : clampDays(pick.days, undefined);
  if (TOOLS[pick.tool].params.includes('period')) out.period = PERIODS.includes(pick.period) ? pick.period : 'month';
  return out;
};

// The model sees only the question and this list: no member or payment data.
const ROUTER_SYSTEM = () => 'You route questions from a gym owner to ONE read-only report. Reply with JSON only, like {"tool":"dues"} or {"tool":"absent","days":14} or {"tool":"collections","period":"week"}. '
  + 'If none fits, reply {"tool":"none"}. Tools: ' + Object.entries(TOOLS).map(([k, v]) => `${k} (${v.help})`).join('; ') + '.';

const parsePick = (text) => {
  try {
    const a = text.indexOf('{'); const b = text.lastIndexOf('}');
    if (a === -1 || b <= a) return null;
    return sanitize(JSON.parse(text.slice(a, b + 1)));
  } catch { return null; }
};

const istStart = (now, period) => {
  const dayStart = R.istDayStart(now);
  if (period === 'today') return dayStart;
  return new Date(dayStart.getTime() - (period === 'week' ? 6 : 29) * DAY);
};

const money = (n) => `Rs ${Math.round(n).toLocaleString('en-IN')}`;
const list = (rows, fmt, noun) => {
  if (!rows.length) return null;
  const shown = rows.slice(0, MAX_ROWS).map(fmt).join('\n');
  return rows.length > MAX_ROWS ? `${shown}\n…and ${rows.length - MAX_ROWS} more ${noun}.` : shown;
};

// ---------- tools: read-only, scoped to ONE gym ----------
const run = async (subscriberId, call, now = new Date()) => {
  switch (call.tool) {
    case 'dues': {
      const rows = await Payment.aggregate([
        { $match: { subscriberId, status: { $in: ['pending', 'partial', 'overdue'] }, dueDate: { $lt: now } } },
        { $group: { _id: '$memberId', balance: { $sum: { $subtract: ['$amount', { $ifNull: ['$amountPaid', 0] }] } }, since: { $min: '$dueDate' } } },
        { $match: { balance: { $gt: 0 } } }, { $sort: { balance: -1 } }, { $limit: 200 },
      ]);
      const names = new Map((await Member.find({ subscriberId, _id: { $in: rows.map((r) => r._id) } }).select('name').lean()).map((m) => [String(m._id), m.name]));
      const total = rows.reduce((s, r) => s + r.balance, 0);
      const body = list(rows, (r) => `• ${names.get(String(r._id)) || 'Member'}: ${money(r.balance)} (${Math.floor((now - new Date(r.since)) / DAY)} days overdue)`, 'members');
      return body ? `${rows.length} members owe ${money(total)} in total:\n${body}` : 'No overdue dues right now.';
    }
    case 'expiring': {
      const days = call.days || 7;
      const rows = await Member.find({ subscriberId, status: { $ne: 'cancelled' }, expiresAt: { $gt: now, $lte: new Date(now.getTime() + days * DAY) } }).select('name expiresAt').sort({ expiresAt: 1 }).limit(200).lean();
      const body = list(rows, (m) => `• ${m.name}: ends in ${Math.max(1, Math.ceil((new Date(m.expiresAt) - now) / DAY))} day(s)`, 'members');
      return body ? `${rows.length} memberships end in the next ${days} days:\n${body}` : `No memberships end in the next ${days} days.`;
    }
    case 'lapsed': {
      const days = call.days || 30;
      const rows = await Member.find({ subscriberId, expiresAt: { $lte: now, $gt: new Date(now.getTime() - days * DAY) } }).select('name expiresAt').sort({ expiresAt: -1 }).limit(200).lean();
      const body = list(rows, (m) => `• ${m.name}: ended ${Math.floor((now - new Date(m.expiresAt)) / DAY)} day(s) ago`, 'members');
      return body ? `${rows.length} memberships ended in the last ${days} days:\n${body}` : `No memberships ended in the last ${days} days.`;
    }
    case 'absent': {
      const days = call.days || 10;
      const [active, last] = await Promise.all([
        Member.find({ subscriberId, status: { $ne: 'cancelled' }, expiresAt: { $gt: now } }).select('name createdAt').limit(3000).lean(),
        Attendance.aggregate([{ $match: { subscriberId } }, { $group: { _id: '$memberId', last: { $max: '$checkedInAt' } } }]),
      ]);
      const lastBy = new Map(last.map((x) => [String(x._id), x.last]));
      const rows = active.map((m) => ({ name: m.name, d: R.absenceDays(lastBy.get(String(m._id)), m.createdAt, now, days) })).filter((x) => x.d !== null).sort((a, b) => b.d - a.d);
      const body = list(rows, (x) => `• ${x.name}: ${x.d} days away`, 'members');
      return body ? `${rows.length} active members have not visited for ${days}+ days:\n${body}` : `Every active member has visited in the last ${days} days.`;
    }
    case 'collections': {
      const from = istStart(now, call.period);
      const agg = await Payment.aggregate([
        { $match: { subscriberId } },
        { $unwind: '$installments' },
        { $match: { 'installments.paidAt': { $gte: from, $lte: now } } },
        { $group: { _id: null, total: { $sum: '$installments.amount' }, n: { $sum: 1 } } },
      ]);
      const label = { today: 'today', week: 'in the last 7 days', month: 'in the last 30 days' }[call.period];
      return `Collected ${label}: ${money(agg[0]?.total || 0)} across ${agg[0]?.n || 0} payments.`;
    }
    case 'new_members': {
      const from = istStart(now, call.period);
      const n = await Member.countDocuments({ subscriberId, createdAt: { $gte: from } });
      const label = { today: 'today', week: 'in the last 7 days', month: 'in the last 30 days' }[call.period];
      return `${n} new members joined ${label}.`;
    }
    case 'member_count': {
      const n = await Member.countDocuments({ subscriberId, status: { $ne: 'cancelled' }, expiresAt: { $gt: now } });
      return `${n} members have an active membership right now.`;
    }
    default:
      return null;
  }
};

// Returns { answer, tool, usedAi, usage?, model? } or null when this is not a data question.
// canUseAi: the caller says whether the AI cap allows a routing call.
const tryAnswer = async (sub, question, { canUseAi = false, now = new Date() } = {}) => {
  let call = sanitize(route(question));
  let usedAi = false; let meta = {};
  if (!call && canUseAi && aiProvider.isEnabled()) {
    try {
      const reply = await aiProvider.complete({ system: ROUTER_SYSTEM(), user: String(question).slice(0, 300), maxTokens: 60, model: aiProvider.smallModel() });
      call = parsePick(reply.text);
      usedAi = true; meta = { usage: reply.usage, model: reply.model };
    } catch (err) {
      console.warn('Data question routing failed:', err.message);
    }
  }
  if (!call) return usedAi ? { answer: null, usedAi, ...meta } : null;
  const answer = await run(sub._id, call, now);
  return { answer, tool: call.tool, usedAi, ...meta };
};

module.exports = { TOOLS, route, sanitize, parsePick, ROUTER_SYSTEM, run, tryAnswer };
