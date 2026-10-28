// Parses punch logs exported from a biometric/card device (any brand that can
// export CSV/Excel) into check-ins. Pure: no database.

const ALIASES = {
  id: ['user id', 'userid', 'id', 'emp id', 'empid', 'employee id', 'enrollid', 'enroll id', 'person id', 'card no', 'card number', 'ac no', 'ac-no', 'device id', 'no'],
  datetime: ['date/time', 'datetime', 'date time', 'timestamp', 'punch time', 'check time', 'checktime', 'check in', 'checkin', 'time stamp'],
  date: ['date', 'punch date', 'att date'],
  time: ['time', 'punch', 'in time', 'check in time'],
};
const MAX_ROWS = 8000;
const DEDUPE_MS = 30 * 60 * 1000; // repeated punches within 30 minutes count once

const clean = (h) => String(h || '').toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();

const mapHeaders = (headers) => {
  const out = {};
  const used = new Set();
  // exact priority: datetime before date/time so "Date/Time" is not read as "date"
  for (const field of ['id', 'datetime', 'date', 'time']) {
    for (const h of headers) {
      if (out[h] || used.has(field)) continue;
      if (ALIASES[field].includes(clean(h))) { out[h] = field; used.add(field); }
    }
  }
  return out;
};

// Offset (minutes east of UTC) of a time zone at a given instant.
const tzOffsetMinutes = (tz, instant) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - instant.getTime()) / 60000);
};

// Wall-clock fields in the gym's time zone -> the real instant.
const localToUtc = (y, mo, d, h, mi, s, tz) => {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let off = tzOffsetMinutes(tz, new Date(guess));
  let t = guess - off * 60000;
  off = tzOffsetMinutes(tz, new Date(t));
  t = guess - off * 60000;
  return new Date(t);
};

// Accepts "2026-12-01 06:15:32", "2026-12-01T06:15", "01/12/2026 6:15 AM", "01-12-2026 18:05".
const parseDateTime = (text, tz = 'Asia/Kolkata') => {
  const s = String(text ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/);
  let y, mo, d, h, mi, sec, ap;
  if (m) { [, y, mo, d, h, mi, sec, ap] = m; }
  else {
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/);
    if (!m) return null;
    [, d, mo, y, h, mi, sec, ap] = m; // day first
    if (y.length === 2) y = `20${y}`;
  }
  y = +y; mo = +mo; d = +d; h = +h; mi = +mi; sec = +(sec || 0);
  if (ap) { const pm = ap.toLowerCase() === 'pm'; if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || sec > 59) return null;
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCMonth() !== mo - 1) return null;
  return localToUtc(y, mo, d, h, mi, sec, tz);
};

const parseRows = (rows, tz = 'Asia/Kolkata') => {
  if (!Array.isArray(rows) || !rows.length) return { fatal: 'The file has no rows' };
  if (rows.length > MAX_ROWS) return { fatal: `Please import at most ${MAX_ROWS} punches at a time. Split the file by month.` };
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r || {})))];
  const map = mapHeaders(headers);
  const fields = Object.values(map);
  if (!fields.includes('id')) return { fatal: 'We could not find a "User ID" column' };
  if (!fields.includes('datetime') && !(fields.includes('date') && fields.includes('time'))) {
    return { fatal: 'We could not find a "Date/Time" column (or separate Date and Time columns)' };
  }
  const punches = [];
  const errors = [];
  rows.forEach((raw, i) => {
    const d = {};
    for (const [h, f] of Object.entries(map)) d[f] = raw[h];
    const id = String(d.id ?? '').trim();
    if (!id && !String(d.datetime ?? d.date ?? '').trim()) return; // blank row
    const text = d.datetime !== undefined && String(d.datetime).trim() ? d.datetime : `${String(d.date ?? '').trim()} ${String(d.time ?? '').trim()}`;
    const at = parseDateTime(text, tz);
    if (!id) return errors.push({ row: i + 2, message: 'User ID is missing' });
    if (!at) return errors.push({ row: i + 2, userId: id, message: 'Date/time not understood' });
    punches.push({ row: i + 2, userId: id, at });
  });
  return { punches, errors };
};

// Keeps the first punch of each burst per user (repeats within 30 minutes are dropped).
const collapse = (punches) => {
  const byUser = new Map();
  for (const p of punches) { if (!byUser.has(p.userId)) byUser.set(p.userId, []); byUser.get(p.userId).push(p); }
  const kept = [];
  let duplicates = 0;
  for (const list of byUser.values()) {
    list.sort((a, b) => a.at - b.at);
    let last = null;
    for (const p of list) {
      if (last && p.at - last.at < DEDUPE_MS) { duplicates++; continue; }
      kept.push(p); last = p;
    }
  }
  return { kept, duplicates };
};

module.exports = { parseRows, parseDateTime, collapse, tzOffsetMinutes, DEDUPE_MS, MAX_ROWS };
