// Weekly owner coach (AI-05), pure rules: no database, no network, no AI. Free and the same answer every time.
// It turns this week's gym numbers into at most 3 actions, each with the rupees at stake (an upper bound, not a promise),
// then reports whether the owner has started or finished each one from the Renewal Copilot "contacted" taps.
// Money is whole rupees with a currency code. No member names or phones are ever held here.
const DAY = 86400000;
const IST = 5.5 * 3600000;

const istDate = (now) => new Date(new Date(now).getTime() + IST).toISOString().slice(0, 10);
// Monday of the IST week, as YYYY-MM-DD.
const weekKey = (now) => { const d = new Date(istDate(now) + 'T00:00:00Z'); const back = (d.getUTCDay() + 6) % 7; return new Date(d.getTime() - back * DAY).toISOString().slice(0, 10); };
const weekStart = (key) => new Date(key + 'T00:00:00+05:30');

// The gym's typical monthly fee from its own plans (price per 30 days, median). null when it has no usable plan.
function monthlyFee(plans) {
  const v = (plans || []).filter((p) => Number(p.price) > 0 && Number(p.durationDays) >= 7 && Number(p.durationDays) <= 800).map((p) => (p.price / p.durationDays) * 30).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = v.length >> 1;
  return Math.round(v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2);
}

const plural = (n, one, many) => (n === 1 ? one : many);
const inr = (n) => 'Rs ' + Number(n).toLocaleString('en-IN');

// s = the stats from aiAssist.gatherStats. fee = monthlyFee(...) or null. Returns up to 3 actions, biggest rupees first.
function buildActions(s, fee, currency = 'INR') {
  const c = [];
  const money = (n) => (fee && n > 0 ? Math.round(n * fee) : null);
  if (s.expiring7 > 0) c.push({ kind: 'renew', target: s.expiring7, rupees: money(s.expiring7), text: `${s.expiring7} ${plural(s.expiring7, 'membership ends', 'memberships end')} in the next 7 days. Call or message them before they lapse.${fee ? ` Up to ${inr(money(s.expiring7))} a month is at stake.` : ''}` });
  if (s.lapsed7 > 0) c.push({ kind: 'lapsed', target: s.lapsed7, rupees: money(s.lapsed7), text: `${s.lapsed7} ${plural(s.lapsed7, 'member', 'members')} lapsed in the last 7 days. A short win-back message works best in the first week.${fee ? ` That is ${inr(money(s.lapsed7))} a month stopped.` : ''}` });
  if (s.duesCount > 0 && s.duesTotal > 0) c.push({ kind: 'dues', target: s.duesCount, rupees: Math.round(s.duesTotal), text: `${inr(Math.round(s.duesTotal))} is pending across ${s.duesCount} ${plural(s.duesCount, 'payment', 'payments')}. Follow up on the oldest first.` });
  if (s.checkinsLastWeek >= 10 && s.checkinsThisWeek < s.checkinsLastWeek * 0.8) c.push({ kind: 'absent', target: null, rupees: null, text: 'Check-ins fell more than 20% from last week. Look at who stopped coming and send an absence check-in.' });
  c.sort((a, b) => (b.rupees == null ? -1 : b.rupees) - (a.rupees == null ? -1 : a.rupees));
  const out = c.slice(0, 3).map((a, i) => ({ ...a, id: `a${i + 1}`, currency }));
  if (!out.length) out.push({ id: 'a1', kind: 'info', target: null, rupees: null, currency, text: 'Nothing urgent this week. A good time to ask happy members for a referral.' });
  return out;
}

// taps = { renew: n, lapsed: n, dues: n, absent: n } counted since the week began. Done = at least half the target contacted.
function progress(actions, taps) {
  return (actions || []).map((a) => {
    const n = (taps && taps[a.kind]) || 0;
    if (!['renew', 'lapsed', 'dues', 'absent'].includes(a.kind)) return { ...a, status: 'info', contacted: 0 };
    const need = a.target ? Math.ceil(a.target * 0.5) : 1;
    return { ...a, contacted: n, status: n >= need ? 'done' : n >= 1 ? 'started' : 'open' };
  });
}
module.exports = { DAY, istDate, weekKey, weekStart, monthlyFee, buildActions, progress };
