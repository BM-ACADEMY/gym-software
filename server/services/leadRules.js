// Lead capture and simple CRM, pure rules: no database, no network.
// A lead is a person who asked about the gym (form, walk-in, phone). Phones are kept as 10 Indian mobile digits.
const STATUSES = ['new', 'contacted', 'trial', 'joined', 'lost'];
const SOURCES = ['form', 'walkin', 'phone', 'instagram', 'other'];
const MAX_NOTE = 500;

// 10-digit Indian mobile from common ways of writing it, or null.
const normalizePhone = (raw) => {
  let d = String(raw == null ? '' : raw).replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
};

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);

// Validates a new lead. `consentRequired` is true for the public form (the person must tick the box).
function checkNewLead(body, { consentRequired = false } = {}) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  for (const k of ['name', 'phone', 'note', 'goal', 'source']) {
    if (b[k] !== undefined && typeof b[k] !== 'string') return { ok: false, message: 'Please check the details you entered.' };
  }
  const name = clean(b.name, 80);
  if (name.length < 2) return { ok: false, message: 'Please enter your name.' };
  const phone = normalizePhone(b.phone);
  if (!phone) return { ok: false, message: 'Please enter a 10-digit mobile number.' };
  if (consentRequired && b.consent !== true) return { ok: false, message: 'Please tick the box to let the gym contact you.' };
  const source = SOURCES.includes(b.source) ? b.source : (consentRequired ? 'form' : 'other');
  return { ok: true, value: { name, phone, goal: clean(b.goal, 120), note: clean(b.note, MAX_NOTE), source } };
}

// Validates an owner's change to a lead. Only these fields can change.
function checkLeadUpdate(body) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const out = {};
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return { ok: false, message: 'Unknown status.' };
    out.status = b.status;
  }
  if (b.note !== undefined) {
    if (typeof b.note !== 'string') return { ok: false, message: 'Please check the note.' };
    out.note = clean(b.note, MAX_NOTE);
  }
  if (b.nextFollowUpAt !== undefined) {
    if (b.nextFollowUpAt === null || b.nextFollowUpAt === '') out.nextFollowUpAt = null;
    else {
      const d = new Date(b.nextFollowUpAt);
      if (Number.isNaN(d.getTime())) return { ok: false, message: 'That follow-up date does not look right.' };
      out.nextFollowUpAt = d;
    }
  }
  if (!Object.keys(out).length) return { ok: false, message: 'Nothing to change.' };
  return { ok: true, value: out };
}

// Leads that need a call: new for over a day, or follow-up date has passed, and not finished.
const needsAttention = (lead, now = new Date()) => {
  if (lead.status === 'joined' || lead.status === 'lost') return false;
  if (lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) <= now) return true;
  return lead.status === 'new' && now.getTime() - new Date(lead.createdAt).getTime() > 24 * 3600000;
};

// Masks all but the last 3 digits for lists; the owner can open one lead to see the whole number.
const maskPhone = (p) => (p ? 'XXXXXXX' + String(p).slice(-3) : '');

module.exports = { STATUSES, SOURCES, normalizePhone, checkNewLead, checkLeadUpdate, needsAttention, maskPhone };
