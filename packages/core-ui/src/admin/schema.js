// Pure rules for the shared, data-driven admin panels. No React, no network: tested with plain node.
// A product describes its panel in a manifest (data); the screens read the manifest and the API. Nothing is hard-coded per product.
const TYPES = ['text', 'number', 'money', 'date', 'select', 'tags', 'bool', 'phone', 'email', 'textarea', 'pill'];
const err = (msg) => Object.assign(new Error(msg), { code: 'MANIFEST_INVALID' });

function validateManifest(m) {
  if (!m || typeof m !== 'object') throw err('manifest missing');
  if (!/^[a-z]{2,12}$/.test(m.product || '')) throw err('product must be 2-12 lowercase letters');
  if (!m.title) throw err('title missing');
  if (!Array.isArray(m.nav) || !m.nav.length) throw err('nav is empty');
  const keys = new Set();
  for (const n of m.nav) {
    if (!n.key || !n.label) throw err('every nav item needs key and label');
    if (keys.has(n.key)) throw err('duplicate nav key ' + n.key);
    keys.add(n.key);
    if (!['resource', 'stats', 'settings', 'custom'].includes(n.screen)) throw err(`nav ${n.key}: unknown screen`);
    if (n.screen === 'resource' && !(m.resources && m.resources[n.resource])) throw err(`nav ${n.key}: resource not defined`);
    if (n.screen === 'stats' && !(m.stats && m.stats[n.stats])) throw err(`nav ${n.key}: stats not defined`);
  }
  for (const [name, r] of Object.entries(m.resources || {})) {
    if (!r.endpoint || !String(r.endpoint).startsWith('/')) throw err(`resource ${name}: endpoint must start with /`);
    for (const f of [...(r.columns || []), ...(r.fields || [])]) {
      if (!f.key) throw err(`resource ${name}: field without key`);
      if (f.type && !TYPES.includes(f.type)) throw err(`resource ${name}.${f.key}: unknown type ${f.type}`);
      if (f.type === 'select' && !(f.options && f.options.length)) throw err(`resource ${name}.${f.key}: select needs options`);
    }
  }
  // Settings screens: a list of `fields` with dotted keys (for example discountRule.staff), see SettingsScreen.
  for (const [name, d] of Object.entries(m.settings || {})) {
    if (!d.endpoint || !String(d.endpoint).startsWith('/')) throw err(`settings ${name}: endpoint must start with /`);
    for (const f of d.fields || []) {
      if (!f.key || !f.label) throw err(`settings ${name}: every field needs key and label`);
      if (!['select', 'number', 'text', 'bool'].includes(f.type)) throw err(`settings ${name}.${f.key}: field type must be select, number, text or bool`);
      if (f.type === 'select' && !(f.options && f.options.length)) throw err(`settings ${name}.${f.key}: select needs options`);
      if (f.showWhen && !(f.showWhen.key && 'equals' in f.showWhen)) throw err(`settings ${name}.${f.key}: showWhen needs key and equals`);
    }
  }
  return m;
}

// Only the items this user's role may see. Items without roles are for everyone who can open the panel.
const visibleNav = (m, role) => m.nav.filter((n) => !n.roles || n.roles.includes(role));

const getPath = (obj, path) => (path === '' || path == null ? obj : String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj));

const inr = (n) => 'Rs ' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
function formatCell(type, v, row) {
  if (v == null || v === '') return '-';
  switch (type) {
    case 'money': return inr(v);
    case 'date': { const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }); }
    case 'tags': return Array.isArray(v) ? v.join(', ') : String(v);
    case 'bool': return v ? 'Yes' : 'No';
    case 'phone': { const s = String(v); return s.includes('*') ? s : s.slice(0, 3) + '*****' + s.slice(-2); } // lists never show a full phone number
    default: return String(v);
  }
}

// Same checks the server makes, so the form can tell the user before sending. The server still decides.
function validateRecord(fields, values) {
  const errors = {}; const out = {};
  for (const f of fields) {
    let v = values[f.key];
    const empty = v == null || v === '' || (Array.isArray(v) && !v.length);
    if (empty) { if (f.required) errors[f.key] = `${f.label || f.key} is needed`; continue; }
    switch (f.type) {
      case 'number': case 'money': {
        v = Number(v);
        if (!Number.isFinite(v)) { errors[f.key] = 'Enter a number'; break; }
        if (f.type === 'money' && !Number.isInteger(v)) errors[f.key] = 'Whole rupees only';
        else if (f.min != null && v < f.min) errors[f.key] = `At least ${f.min}`;
        else if (f.max != null && v > f.max) errors[f.key] = `At most ${f.max}`;
        break;
      }
      case 'email': if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) errors[f.key] = 'Not a valid email'; break;
      case 'phone': if (!/^(\+?91)?[\s-]?[6-9]\d{4}[\s-]?\d{5}$/.test(String(v).trim())) errors[f.key] = 'Not a valid Indian mobile number'; break;
      case 'select': if (!f.options.some((o) => String(o.value ?? o) === String(v))) errors[f.key] = 'Pick one of the options'; break;
      case 'tags': v = Array.isArray(v) ? v : String(v).split(',').map((s) => s.trim()).filter(Boolean); break;
      case 'bool': v = v === true || v === 'true'; break;
      default: if (f.max && String(v).length > f.max) errors[f.key] = `At most ${f.max} characters`; v = String(v).trim();
    }
    out[f.key] = v;
  }
  return { ok: !Object.keys(errors).length, errors, values: out };
}

// Dynamic nav: items that come from the API (for example one page per product in the all-products Super Admin).
function expandNav(m, data) {
  return m.nav.flatMap((n) => {
    if (!n.from) return [n];
    const rows = getPath(data && data[n.from.source], n.from.path) || [];
    return rows.map((r) => ({ ...n, key: `${n.key}-${r[n.from.idKey]}`, label: String(r[n.from.labelKey] ?? r[n.from.idKey]), params: { [n.from.idKey]: r[n.from.idKey] }, from: undefined }));
  });
}
// Dotted keys for settings forms: setPath({}, 'discountRule.staff', 'any') gives { discountRule: { staff: 'any' } }. Never touches the input.
const BAD = ['__proto__', 'constructor', 'prototype'];
function setPath(obj, path, value) {
  const keys = String(path).split('.'); if (keys.some((k) => !k || BAD.includes(k))) return obj;
  const root = { ...(obj || {}) }; let cur = root;
  keys.forEach((k, i) => { if (i === keys.length - 1) cur[k] = value; else { cur[k] = { ...((cur[k] && typeof cur[k] === 'object') ? cur[k] : {}) }; cur = cur[k]; } });
  return root;
}
// Only the top-level keys that the fields belong to, so saving the discount rule sends just { discountRule: {...} }.
function pickTop(values, fields) {
  const out = {};
  for (const f of fields) { const top = String(f.key).split('.')[0]; if (!BAD.includes(top) && values && top in values) out[top] = values[top]; }
  return out;
}
// Fields shown now: a field with showWhen appears only while another field has that value.
const visibleFields = (fields, values) => fields.filter((f) => !f.showWhen || getPath(values, f.showWhen.key) === f.showWhen.equals);

export { setPath, pickTop, visibleFields, TYPES, validateManifest, visibleNav, getPath, formatCell, validateRecord, expandNav, inr };
