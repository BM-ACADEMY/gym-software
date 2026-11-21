// Turns spreadsheet rows (any common header names) into member records.
// Pure: no database. The controller adds plan lookup and duplicate checks.

const ALIASES = {
  name: ['name', 'member name', 'full name', 'member', 'customer name', 'customer'],
  phone: ['phone', 'mobile', 'mobile number', 'mobile no', 'phone number', 'contact', 'contact number', 'whatsapp', 'whatsapp number'],
  email: ['email', 'email id', 'e-mail', 'mail'],
  gender: ['gender', 'sex'],
  plan: ['plan', 'plan name', 'membership', 'membership plan', 'package'],
  startDate: ['start date', 'joining date', 'joined', 'join date', 'date of joining', 'doj', 'start'],
  expiresAt: ['expiry', 'expiry date', 'expires', 'expires on', 'end date', 'valid till', 'valid until', 'due date', 'renewal date'],
  deviceUserId: ['device id', 'device user id', 'biometric id', 'user id', 'card no', 'card number', 'finger id'],
  goal: ['goal', 'fitness goal'],
  notes: ['notes', 'remarks', 'medical notes', 'medical'],
};

const MAX_ROWS = 2000;

const clean = (h) => String(h || '').toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();

// header -> canonical field
const mapHeaders = (headers) => {
  const out = {};
  for (const h of headers) {
    const c = clean(h);
    for (const [field, names] of Object.entries(ALIASES)) {
      if (names.includes(c) && !Object.values(out).includes(field)) out[h] = field;
    }
  }
  return out;
};

// Indian mobile numbers become plain 10 digits; anything else keeps its digits.
const normalizePhone = (v) => {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
};

const validPhone = (d) => /^[6-9]\d{9}$/.test(d) || (d.length >= 11 && d.length <= 15);

// Accepts Date, ISO text, dd/mm/yyyy, dd-mm-yyyy, or an Excel serial number.
const parseDate = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : v;
  if (typeof v === 'number') {
    if (v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000); // Excel serial
    return undefined;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return mk(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (m) return mk(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]); // day first
  return undefined;
};
const mk = (y, mo, d) => {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt : undefined;
};

const GENDERS = { m: 'male', male: 'male', f: 'female', female: 'female', o: 'other', other: 'other' };

// rows: array of plain objects (header -> cell). Returns { records, errors, headerMap, unknownHeaders }.
const parseRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return { fatal: 'The file has no rows' };
  if (rows.length > MAX_ROWS) return { fatal: `Please import at most ${MAX_ROWS} members at a time` };
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r || {})))];
  const headerMap = mapHeaders(headers);
  const fields = Object.values(headerMap);
  if (!fields.includes('name')) return { fatal: 'We could not find a "Name" column' };
  if (!fields.includes('phone')) return { fatal: 'We could not find a "Phone" column' };

  const records = [];
  const errors = [];
  const seen = new Set();
  rows.forEach((raw, i) => {
    const rowNo = i + 2; // spreadsheet row (row 1 is the header)
    const d = {};
    for (const [h, f] of Object.entries(headerMap)) d[f] = raw[h];
    const isBlank = Object.values(d).every((v) => v === undefined || v === null || String(v).trim() === '');
    if (isBlank) return;

    const name = String(d.name ?? '').trim();
    if (!name) return errors.push({ row: rowNo, message: 'Name is missing' });
    if (name.length > 100) return errors.push({ row: rowNo, message: 'Name is too long' });
    const phone = normalizePhone(d.phone);
    if (!validPhone(phone)) return errors.push({ row: rowNo, name, message: 'Phone number is not valid' });
    if (seen.has(phone)) return errors.push({ row: rowNo, name, message: 'Same phone number appears earlier in this file' });
    seen.add(phone);

    const email = String(d.email ?? '').trim().toLowerCase();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return errors.push({ row: rowNo, name, message: 'Email is not valid' });

    const startDate = parseDate(d.startDate);
    const expiresAt = parseDate(d.expiresAt);
    if (startDate === undefined) return errors.push({ row: rowNo, name, message: 'Start date is not valid (use dd/mm/yyyy)' });
    if (expiresAt === undefined) return errors.push({ row: rowNo, name, message: 'Expiry date is not valid (use dd/mm/yyyy)' });

    const genderKey = String(d.gender ?? '').trim().toLowerCase();
    records.push({
      row: rowNo, name, phone, email: email || undefined,
      gender: GENDERS[genderKey], planName: String(d.plan ?? '').trim() || undefined,
      startDate, expiresAt, deviceUserId: String(d.deviceUserId ?? '').trim().slice(0, 40) || undefined,
      goal: String(d.goal ?? '').trim().slice(0, 200) || undefined, medicalNotes: String(d.notes ?? '').trim().slice(0, 500) || undefined,
    });
  });
  const unknownHeaders = headers.filter((h) => !headerMap[h]);
  return { records, errors, headerMap, unknownHeaders };
};

// Given a record and the gym's plan (or undefined), the expiry date to store.
const resolveExpiry = (rec, plan) => {
  if (rec.expiresAt) return rec.expiresAt;
  if (plan && rec.startDate) return new Date(rec.startDate.getTime() + plan.durationDays * 86400000);
  return undefined;
};

module.exports = { parseRows, parseDate, normalizePhone, validPhone, resolveExpiry, mapHeaders, MAX_ROWS };
