// Pure rules for the shared, data-driven admin panels. No React, no network: tested with plain node.
// A product describes its panel in a manifest (data); the screens read the manifest and the API. Nothing is hard-coded per product.
const TYPES = ['text', 'number', 'money', 'date', 'select', 'tags', 'bool', 'phone', 'email', 'textarea', 'pill', 'password'];
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
  const checkDownloads = (where, list) => {
    if (list == null) return;
    if (!Array.isArray(list)) throw err(`${where}: downloads must be a list`);
    for (const d of list) {
      if (!d || !d.label) throw err(`${where}: every download needs a label`);
      if (!d.path || !String(d.path).startsWith('/') || /\.\.|[\s<>]/.test(String(d.path))) throw err(`${where}: download path must start with / and have no spaces or ..`);
      if (d.rangeDays != null && (!Number.isInteger(d.rangeDays) || d.rangeDays < 1 || d.rangeDays > 366)) throw err(`${where}: rangeDays must be a whole number from 1 to 366`);
      if (d.filename != null && !/^[A-Za-z0-9._-]{1,80}$/.test(String(d.filename))) throw err(`${where}: download filename may use letters, digits, dot, dash and underscore only`);
    }
  };
  for (const [name, d] of Object.entries(m.stats || {})) checkDownloads(`stats ${name}`, d.downloads);
  for (const [name, r] of Object.entries(m.resources || {})) {
    checkDownloads(`resource ${name}`, r.downloads);
    for (const f of r.fields || []) if (f.type === 'password' && f.min != null && (!Number.isInteger(f.min) || f.min < 1)) throw err(`resource ${name}.${f.key}: password min must be a whole number of 1 or more`);
    if (!r.endpoint || !String(r.endpoint).startsWith('/')) throw err(`resource ${name}: endpoint must start with /`);
    for (const f of r.columns || []) if (f.type === 'password') throw err(`resource ${name}.${f.key}: a password can never be shown in a list`);
    for (const f of [...(r.columns || []), ...(r.fields || [])]) {
      if (!f.key) throw err(`resource ${name}: field without key`);
      if (f.type && !TYPES.includes(f.type)) throw err(`resource ${name}.${f.key}: unknown type ${f.type}`);
      if (f.type === 'select' && !(f.options && f.options.length)) throw err(`resource ${name}.${f.key}: select needs options`);
    }
  }
  // Settings screens: a list of `fields` with dotted keys (for example discountRule.staff), see SettingsScreen.
  for (const [name, d] of Object.entries(m.settings || {})) {
    checkDownloads(`settings ${name}`, d.downloads);
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
      case 'password': { // never trimmed, never echoed; the server still decides
        const min = f.min || 8, max = f.max || 100; v = String(v);
        if (v.length < min) errors[f.key] = `At least ${min} characters`; else if (v.length > max) errors[f.key] = `At most ${max} characters`;
        break;
      }
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

// For exports that need dates: the last `days` days up to today, in Indian time, as YYYY-MM-DD.
function rangeQuery(days, now = new Date()) {
  const n = Number.isInteger(days) && days >= 1 && days <= 366 ? days : 30;
  const ist = new Date(now.getTime() + 330 * 60000); const day = (d) => d.toISOString().slice(0, 10);
  return { from: day(new Date(ist.getTime() - (n - 1) * 86400000)), to: day(ist) };
}
// Save-as names for downloads: letters, digits, dot, dash, underscore only. The server's Content-Disposition name is used when it is clean.
function downloadName(contentDisposition, fallback) {
  const clean = (n) => { const x = String(n || '').split(/[\\/]/).pop().replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 80); return x || null; };
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(contentDisposition || ''));
  return (m && clean(m[1])) || clean(fallback) || 'download';
}

// Words the shared panel itself shows. Tamil and Hindi are drafts by Claude: NEEDS NATIVE REVIEW (M-06) before customers see them.
const UI_WORDS = {
  en: { add: 'Add', edit: 'Edit', save: 'Save', cancel: 'Cancel', search: 'Search', loading: 'Loading...', refresh: 'Refresh', download: 'Download', choose: 'Choose', nothing: 'Nothing here yet.' },
  ta: { add: 'சேர்', edit: 'திருத்து', save: 'சேமி', cancel: 'ரத்து', search: 'தேடு', loading: 'ஏற்றுகிறது...', refresh: 'புதுப்பி', download: 'பதிவிறக்கு', choose: 'தேர்வு செய்', nothing: 'இங்கே இன்னும் எதுவும் இல்லை.' },
  hi: { add: 'जोड़ें', edit: 'बदलें', save: 'सहेजें', cancel: 'रद्द करें', search: 'खोजें', loading: 'लोड हो रहा है...', refresh: 'ताज़ा करें', download: 'डाउनलोड', choose: 'चुनें', nothing: 'यहाँ अभी कुछ नहीं है।' },
};
const uiText = (lang, key) => (UI_WORDS[lang] && UI_WORDS[lang][key]) || UI_WORDS.en[key] || key;
// A product's strings map { _meta, en:{navKey:'..'}, ta:{..}, hi:{..} } relabels the menu. Anything missing stays in English. Never changes the input.
function translateManifest(m, strings, lang) {
  if (!m || !strings || !lang || lang === 'en' || !strings[lang] || typeof strings[lang] !== 'object') return m;
  return { ...m, nav: m.nav.map((n) => (typeof strings[lang][n.key] === 'string' && strings[lang][n.key] ? { ...n, label: strings[lang][n.key] } : n)) };
}
const needsReview = (strings, lang) => !!(strings && lang && lang !== 'en' && strings[lang]);

export { rangeQuery, downloadName, UI_WORDS, uiText, translateManifest, needsReview, setPath, pickTop, visibleFields, TYPES, validateManifest, visibleNav, getPath, formatCell, validateRecord, expandNav, inr };
