// Owner autopilot reports (AUTO-REPORT), pure rules: no database, no network, no AI. Same numbers every time.
// A report covers the last completed IST week (Monday to Sunday) or calendar month, compared with the period before it.
// Money is whole rupees with a currency code. Reports hold counts and rupee totals only: no member names or phones.
const DAY = 86400000;
const IST = 5.5 * 3600000;
const PERIODS = ['weekly', 'monthly'];

const istDate = (now) => new Date(new Date(now).getTime() + IST).toISOString().slice(0, 10);
const atIstMidnight = (ymd) => new Date(new Date(ymd + 'T00:00:00Z').getTime() - IST);
const ymd = (d) => d.toISOString().slice(0, 10);
const pad = (n) => String(n).padStart(2, '0');

// Monday (IST) of the week containing `now`, as a UTC Date at IST midnight.
const weekStartOf = (now) => {
  const d = new Date(istDate(now) + 'T00:00:00Z');
  const back = (d.getUTCDay() + 6) % 7;
  return atIstMidnight(ymd(new Date(d.getTime() - back * DAY)));
};
const monthStartOf = (y, m) => atIstMidnight(`${y}-${pad(m + 1)}-01`); // m is 0 to 11 and may be -1 or 12
const monthParts = (now) => { const d = new Date(new Date(now).getTime() + IST); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; };
const shiftMonth = (y, m, by) => { const t = y * 12 + m + by; return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 }; };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (utcDate) => { const d = new Date(utcDate.getTime() + IST); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };

// Range for one report. partial=true is "so far this week or month" (a preview, never stored or sent).
function periodRange(period, now = new Date(), { partial = false } = {}) {
  if (!PERIODS.includes(period)) throw new Error('Unknown report period');
  if (period === 'weekly') {
    const thisWeek = weekStartOf(now);
    const from = partial ? thisWeek : new Date(thisWeek.getTime() - 7 * DAY);
    const to = partial ? new Date(now) : thisWeek;
    const prevFrom = new Date(from.getTime() - 7 * DAY);
    const prevTo = partial ? new Date(prevFrom.getTime() + (to - from)) : from;
    const last = new Date(to.getTime() - 1);
    return { period, key: ymd(new Date(from.getTime() + IST)), label: `${shortDate(from)} to ${shortDate(partial ? last : new Date(to.getTime() - DAY))}`, from, to, prevFrom, prevTo, partial };
  }
  const { y, m } = monthParts(now);
  const cur = partial ? { y, m } : shiftMonth(y, m, -1);
  const from = monthStartOf(cur.y, cur.m);
  const next = shiftMonth(cur.y, cur.m, 1);
  const to = partial ? new Date(now) : monthStartOf(next.y, next.m);
  const prev = shiftMonth(cur.y, cur.m, -1);
  const prevFrom = monthStartOf(prev.y, prev.m);
  const prevTo = partial ? new Date(Math.min(prevFrom.getTime() + (to - from), from.getTime())) : from;
  return { period, key: `${cur.y}-${pad(cur.m + 1)}`, label: `${MONTHS[cur.m]} ${cur.y}`, from, to, prevFrom, prevTo, partial };
}

// Whole-number percent change, or null when there is nothing to compare with (never a made-up number).
const pctChange = (cur, prev) => {
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
};

const inr = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const plural = (n, one, many) => (n === 1 ? one : many);

// cur and prev: { collected, expenses, checkins, newMembers }. snap: { duesTotal, duesCount, expiringNext7, absent10, activeMembers, leadsWaiting }.
function buildData(cur, prev, snap, currency = 'INR') {
  const whole = (x) => Math.max(0, Math.round(Number(x) || 0));
  const c = { collected: whole(cur.collected), expenses: whole(cur.expenses), checkins: whole(cur.checkins), newMembers: whole(cur.newMembers) };
  const p = { collected: whole(prev.collected), expenses: whole(prev.expenses), checkins: whole(prev.checkins), newMembers: whole(prev.newMembers) };
  const s = { duesTotal: whole(snap.duesTotal), duesCount: whole(snap.duesCount), expiringNext7: whole(snap.expiringNext7), absent10: whole(snap.absent10), activeMembers: whole(snap.activeMembers), leadsWaiting: whole(snap.leadsWaiting) };
  const net = c.collected - c.expenses;
  const prevNet = p.collected - p.expenses;
  return {
    currency,
    metrics: [
      { key: 'collected', label: 'Collected', value: c.collected, prev: p.collected, changePct: pctChange(c.collected, p.collected), kind: 'money' },
      { key: 'expenses', label: 'Expenses', value: c.expenses, prev: p.expenses, changePct: pctChange(c.expenses, p.expenses), kind: 'money' },
      { key: 'net', label: 'Left after expenses', value: net, prev: prevNet, changePct: prevNet > 0 ? pctChange(net, prevNet) : null, kind: 'money' },
      { key: 'newMembers', label: 'New members', value: c.newMembers, prev: p.newMembers, changePct: pctChange(c.newMembers, p.newMembers), kind: 'count' },
      { key: 'checkins', label: 'Check-ins', value: c.checkins, prev: p.checkins, changePct: pctChange(c.checkins, p.checkins), kind: 'count' },
    ],
    snapshot: s,
  };
}

// The one thing to do next: money first (dues), then people (renewals, enquiries, absent). Never names a member.
function nextStep(data) {
  const s = data.snapshot;
  if (s.duesTotal > 0 && s.duesCount > 0) return { kind: 'dues', text: `Collect the ${inr(s.duesTotal)} pending across ${s.duesCount} ${plural(s.duesCount, 'payment', 'payments')}, oldest first.` };
  if (s.expiringNext7 > 0) return { kind: 'renew', text: `${s.expiringNext7} ${plural(s.expiringNext7, 'membership ends', 'memberships end')} in the next 7 days. Open Renewal Copilot and message them today.` };
  if (s.leadsWaiting > 0) return { kind: 'leads', text: `${s.leadsWaiting} ${plural(s.leadsWaiting, 'enquiry is', 'enquiries are')} waiting for a call. Open Leads and call them today.` };
  if (s.absent10 > 0) return { kind: 'absent', text: `${s.absent10} active ${plural(s.absent10, 'member has', 'members have')} not come in for 10 days. Send a check-in from Win Back Members.` };
  return { kind: 'none', text: 'Nothing urgent. A good week to ask happy members for a referral.' };
}

const trend = (m, unit) => {
  if (m.changePct === null) return '';
  if (m.changePct === 0) return ` (same as ${unit})`;
  return ` (${m.changePct > 0 ? 'up' : 'down'} ${Math.abs(m.changePct)}% on ${unit})`;
};

function headline(data, period) {
  const unit = period === 'weekly' ? 'last week' : 'last month';
  const col = data.metrics.find((m) => m.key === 'collected');
  const net = data.metrics.find((m) => m.key === 'net');
  const base = col.value > 0 ? `${inr(col.value)} collected${trend(col, unit)}` : 'No payments recorded';
  return net.value < 0 ? `${base}; expenses were ${inr(-net.value)} higher than collections.` : `${base}.`;
}

// Plain text for the screen and for copying. The WhatsApp message uses the approved template instead (templateParams).
function toText(report, gymName) {
  const d = report.data;
  const line = (m) => `${m.label}: ${m.kind === 'money' ? inr(m.value) : m.value}${trend(m, report.period === 'weekly' ? 'last week' : 'last month')}`;
  return [`${report.period === 'weekly' ? 'Weekly' : 'Monthly'} report for ${gymName} (${report.label})`, headline(d, report.period), ...d.metrics.map(line), `Pending dues: ${inr(d.snapshot.duesTotal)}`, `Next step: ${nextStep(d).text}`].join('\n');
}

const templateName = (period) => (period === 'weekly' ? 'gymdesk_owner_weekly_report' : 'gymdesk_owner_monthly_report');
function templateParams(report, gymName) {
  const m = Object.fromEntries(report.data.metrics.map((x) => [x.key, x.value]));
  return { gym: gymName, label: report.label, collected: m.collected, newMembers: m.newMembers, checkins: m.checkins, dues: report.data.snapshot.duesTotal, step: nextStep(report.data).text };
}

module.exports = { DAY, PERIODS, periodRange, pctChange, buildData, nextStep, headline, toText, templateName, templateParams, weekStartOf };
