'use strict';
// Dine public pages (Phase 2, items 1 and 8). Pure: no database, no clock, no network.
// 1. The QR menu: a guest scans a code, opens a plain page with the menu. Token in the link; only items marked available.
// 2. The direct-order link: a wa.me link with the order text typed in. NOTHING is sent by us; the guest taps Send in their own WhatsApp.
// 3. Page shells for the table view and the kitchen screen. A shell holds NO venue data: it asks the signed-in API for it,
//    so a person who is not signed in, or whose role may not see it, gets nothing (the API refuses, see routes).
// Everything from the venue is escaped; no outside file is loaded; the only script is the small one inside the shell pages.
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const tokenOk = (t) => typeof t === 'string' && /^[a-f0-9]{48}$/.test(t);

// 10-digit Indian mobile -> wa.me link. Text is limited, so the link stays short enough to open everywhere.
function waOrderLink(number, lines, { table, name } = {}) {
  const n = String(number || '').replace(/\D/g, '');
  if (!/^[6-9]\d{9}$/.test(n)) return null;
  const items = (Array.isArray(lines) ? lines : []).slice(0, 30).map((l) => `${Math.max(1, Math.min(99, Math.floor(Number(l.qty) || 1)))} x ${String(l.name || '').slice(0, 60)}`).filter((x) => x.length > 4);
  const text = `Hello${name ? ' ' + String(name).slice(0, 60) : ''}, I would like to order${table ? ' for table ' + String(table).slice(0, 10) : ''}${items.length ? ':\n' + items.join('\n') : '.'}`;
  return 'https://wa.me/91' + n + '?text=' + encodeURIComponent(text.slice(0, 900));
}

// venue: { name, address?, phone?, fssai?, waNumber? }. items: [{ key, name, category, price, kind, variants, isActive }]
// Liquor items never appear on the public menu (alcohol listing and promotion are held for the lawyer, CA_LAWYER_ITEMS.md).
function menuPage(venue, items) {
  const shown = (items || []).filter((i) => i && i.isActive !== false && i.kind !== 'liquor');
  const cats = {};
  for (const i of shown) (cats[i.category || 'Menu'] = cats[i.category || 'Menu'] || []).push(i);
  const body = Object.keys(cats).sort().map((c) => `<h2>${esc(c)}</h2><ul>${cats[c].map((i) => {
    const vs = Array.isArray(i.variants) && i.variants.length ? `<br><small>${i.variants.map((v) => esc(v.name) + ' ' + inr(v.price)).join(' · ')}</small>` : '';
    return `<li><span>${esc(i.name)}${vs}</span><b>${inr(i.price)}</b></li>`;
  }).join('')}</ul>`).join('') || '<p>The menu is not ready yet.</p>';
  const order = venue && /^[6-9]\d{9}$/.test(String(venue.waNumber || '')) ? `<p class="n">To order, message us on WhatsApp: <a href="https://wa.me/91${esc(venue.waNumber)}">+91 ${esc(venue.waNumber)}</a></p>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(venue && venue.name)} menu</title><style>`
    + `body{font:16px/1.45 system-ui,"Noto Sans Tamil","Noto Sans Devanagari",sans-serif;margin:0 auto;max-width:560px;padding:16px;color:#222}h1{font-size:22px;margin:0}h2{font-size:15px;text-transform:uppercase;letter-spacing:.05em;color:#6b4a1f;border-bottom:1px solid #ddd;padding-bottom:4px;margin:20px 0 4px}`
    + `ul{list-style:none;margin:0;padding:0}li{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #eee}small{color:#666}.n{margin-top:24px;font-size:14px}.f{font-size:12px;color:#666;margin-top:16px}`
    + `</style></head><body><h1>${esc(venue && venue.name)}</h1>${venue && venue.address ? `<div><small>${esc(venue.address)}</small></div>` : ''}${body}${order}`
    + `<p class="f">${venue && venue.fssai ? 'FSSAI licence no. ' + esc(venue.fssai) + '. ' : ''}Prices in rupees. Ask us if you have any allergy.</p></body></html>`;
}

// Shells: static pages that poll the signed-in API. kind: 'tables' | 'kitchen'. No venue data is inside the page itself.
function shellPage(kind) {
  const k = kind === 'kitchen' ? 'kitchen' : 'tables';
  const api = k === 'kitchen' ? '/api/dine/kitchen?station=' : '/api/dine/orders';
  const title = k === 'kitchen' ? 'Kitchen screen' : 'Tables';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>`
    + `body{font:16px system-ui,sans-serif;margin:0;padding:12px;background:#f6f3ee;color:#222}h1{font-size:18px}#s{font-size:13px;color:#666}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}`
    + `.c{background:#fff;border:1px solid #ddd;border-radius:10px;padding:10px}.c b{display:block;margin-bottom:4px}.c ul{margin:0;padding-left:18px}.e{color:#a33}`
    + `</style></head><body><h1>${title}</h1><div id="s">Loading...</div><div class="g" id="g"></div><script>`
    + `var K=${JSON.stringify(k)},U=${JSON.stringify(api)};function t(x){var d=document.createElement('div');d.textContent=x==null?'':String(x);return d.innerHTML}`
    + `function load(station){fetch(U+(K==='kitchen'?station:''),{credentials:'same-origin',cache:'no-store'}).then(function(r){if(r.status===401){s('Please sign in to Dine first.');return null}if(r.status===403){s('Your role cannot see this screen.');return null}return r.json()}).then(function(j){if(!j||!j.data)return;`
    + `document.getElementById('g').innerHTML=j.data.map(function(o){var ls=(o.lines||[]).filter(function(l){return l.status!=='void'});return '<div class="c"><b>'+t(o.table||o.number)+' · '+t(o.number)+'</b><ul>'+ls.map(function(l){return '<li>'+t(l.qty)+' x '+t(l.name)+(l.note?' <i>('+t(l.note)+')</i>':'')+'</li>'}).join('')+'</ul></div>'}).join('')||'<p>Nothing right now.</p>';s('Updated '+new Date().toLocaleTimeString())}).catch(function(){s('Could not reach the server. Retrying...')})}`
    + `function s(m){document.getElementById('s').textContent=m}var st=new URLSearchParams(location.search).get('station')==='bar'?'bar':'kitchen';load(st);setInterval(function(){load(st)},8000);</script></body></html>`;
}
module.exports = { esc, inr, tokenOk, waOrderLink, menuPage, shellPage };
