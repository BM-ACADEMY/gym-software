'use strict';
// CLO-13 pure rules: GST mode, godown transfers, shifts calendar, catalogue page, UPI payment link record. No database. Written, not yet tested by a person.
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const crypto = require('crypto');
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));

// ---- GST mode. The owner and the CA decide; the default is "none" (no GST on the bill) and it is flagged until they do. ----
const GST_MODES = ['none', 'inclusive', 'exclusive'];
const gstModeOf = (s) => (s && GST_MODES.includes(s.gstMode) ? s.gstMode : 'none');
const gstModeNote = (mode) => (mode === 'none' ? 'No GST is added to bills. Ask your CA before you change this.' : mode === 'inclusive' ? 'Prices already include GST (the bill shows the split). Confirm with your CA.' : 'GST is added on top of the price. Confirm with your CA.');

// ---- Godown transfer: stock moves between the shop floor (the variant stock) and a named godown, never created or lost. ----
const GODOWN_OK = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,39}$/;
const SHOP = 'shop';
// from/to: 'shop' or a godown name (exactly one side is the shop). qty: whole pieces, or metres up to 2 decimals for fabric (stored as centimetres).
function transferPlan({ from, to, qty, unit = 'piece', shopQty, godownQty }) {
  const f = String(from || '').trim(), t = String(to || '').trim();
  if (!f || !t || f.toLowerCase() === t.toLowerCase()) return { error: 'Choose two different places.' };
  if ((f === SHOP) === (t === SHOP)) return { error: 'One side must be "shop" and the other a godown.' };
  const g = f === SHOP ? t : f; if (!GODOWN_OK.test(g)) return { error: 'Godown name: letters, numbers, space, dot, dash, up to 40.' };
  let n;
  if (unit === 'metre') { const m = Number(qty); n = Math.round(m * 100); if (!Number.isFinite(m) || m <= 0 || m > 500 || Math.abs(m * 100 - n) > 1e-6) return { error: 'Enter metres with up to 2 decimals.' }; }
  else { n = Number(qty); if (!Number.isInteger(n) || n < 1 || n > 100000) return { error: 'Quantity must be a whole number.' }; }
  if (f === SHOP && n > shopQty) return { error: 'That is more than the shop has.' };
  if (t === SHOP && n > godownQty) return { error: 'That is more than the godown has.' };
  return { godown: g, qty: n, shopDelta: f === SHOP ? -n : n, godownDelta: f === SHOP ? n : -n };
}

// ---- Shifts calendar: for one month, each day, each staff member: planned shift (from their weekly pattern) and what was marked. ----
const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
function shiftCalendar({ staff, marks, month }) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) return { error: 'Month must look like 2026-11.' };
  const last = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5), 0)).getUTCDate();
  const byKey = {}; for (const m of marks || []) if (m && m.date) byKey[String(m.staffId) + '|' + m.date] = m.status;
  const days = [];
  for (let d = 1; d <= last; d++) {
    const date = month + '-' + String(d).padStart(2, '0'); const dow = new Date(Date.parse(date + 'T00:00:00Z')).getUTCDay();
    days.push({ date, weekday: dow, people: (staff || []).map((s) => {
      const sh = s.shift && Array.isArray(s.shift.days) && s.shift.days.includes(dow) ? { start: hhmm(s.shift.start), end: hhmm(s.shift.end) } : null;
      return { staffId: String(s.id), name: s.name, planned: sh, marked: byKey[String(s.id) + '|' + date] || null, gap: !!sh && !byKey[String(s.id) + '|' + date] };
    }) });
  }
  return { month, days, people: (staff || []).map((s) => ({ id: String(s.id), name: s.name })) };
}

// ---- Catalogue: a public page of the items the owner marks public. No prices unless the owner turns them on. ----
const newToken = () => crypto.randomBytes(24).toString('hex');
const tokenOk = (t) => typeof t === 'string' && /^[0-9a-f]{48}$/.test(t);
// variants: [{style,size,colour,mrp,qty,unit,isPublic,category}], showPrice: boolean. Grouped by style; sizes and colours listed; "in stock" only, no counts.
function catalogueView(shop, variants, { showPrice = false } = {}) {
  const by = new Map();
  for (const v of variants || []) {
    if (!v || v.isPublic !== true || v.isActive === false || !(v.qty > 0)) continue;
    const g = by.get(v.style) || { style: v.style, category: v.category || '', sizes: new Set(), colours: new Set(), price: null }; g.sizes.add(v.size); g.colours.add(v.colour);
    if (showPrice && Number.isInteger(v.mrp)) g.price = g.price == null ? v.mrp : Math.min(g.price, v.mrp); by.set(v.style, g);
  }
  return { shop: shop || '', showPrice: !!showPrice, items: [...by.values()].sort((a, b) => a.style.localeCompare(b.style)).slice(0, 300).map((g) => ({ style: g.style, category: g.category, sizes: [...g.sizes], colours: [...g.colours], price: g.price, currency: 'INR' })) };
}
function catalogueHtml(v) {
  const cards = v.items.map((i) => `<div class="c"><b>${esc(i.style)}</b>${i.category ? `<br><small>${esc(i.category)}</small>` : ''}<br>Sizes: ${esc(i.sizes.join(', '))}<br>Colours: ${esc(i.colours.join(', '))}${v.showPrice && i.price != null ? `<br><b>From Rs ${esc(i.price)}</b>` : ''}</div>`).join('') || '<p>Nothing to show right now. Please visit the shop.</p>';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(v.shop)}</title><style>body{font:15px sans-serif;margin:0;padding:12px;max-width:640px;margin:auto}h1{font-size:20px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}.c{border:1px solid #ddd;border-radius:10px;padding:10px}small{color:#666}</style></head><body><h1>${esc(v.shop)}</h1><p><small>Items in stock today. Visit the shop to try and buy.</small></p><div class="g">${cards}</div></body></html>`;
}

// ---- UPI payment link record. We build the link from the owner's UPI id; we cannot see the money, so the owner marks it paid after checking the UPI app. ----
const UPI_ID = /^[A-Za-z0-9._-]{2,50}@[A-Za-z][A-Za-z0-9]{1,30}$/;
function upiLink({ upiId, name, amount, note }) {
  if (!UPI_ID.test(String(upiId || ''))) return { error: 'Add your UPI id in settings first, like shop@bank.' };
  if (!Number.isInteger(amount) || amount < 1 || amount > 500000) return { error: 'Amount must be whole rupees, 1 to 5,00,000.' };
  const q = new URLSearchParams({ pa: upiId, pn: String(name || 'Shop').slice(0, 40), am: String(amount), cu: 'INR', tn: String(note || '').slice(0, 40) });
  return { value: { url: 'upi://pay?' + q.toString(), amount, currency: 'INR' } };
}
module.exports = { esc, isDate, GST_MODES, gstModeOf, gstModeNote, SHOP, GODOWN_OK, transferPlan, hhmm, shiftCalendar, newToken, tokenOk, catalogueView, catalogueHtml, UPI_ID, upiLink };
