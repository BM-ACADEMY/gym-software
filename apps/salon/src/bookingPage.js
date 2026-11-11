'use strict';
// The public booking page, served as plain HTML by the app. The business name is escaped here; the page script only uses textContent.
// The customer ticks a consent box before booking. Nothing is sent to the customer by this page.
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CONSENT_TEXT = 'I agree that this business may store my name and phone number to manage my booking.';
const AREAS = ['foot', 'knee', 'hip', 'spine', 'rehab', 'other'];
function page(businessName, { clinic = false } = {}) {
  const areas = clinic ? `<label>Area<select id="area">${AREAS.map((a) => `<option value="${a}">${a[0].toUpperCase() + a.slice(1)}</option>`).join('')}</select></label>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Book at ${esc(businessName)}</title>
<style>body{font:16px system-ui,sans-serif;margin:0;background:#faf7f5;color:#222}main{max-width:460px;margin:0 auto;padding:16px}label{display:block;margin:12px 0 4px;font-weight:600}input,select,button{width:100%;box-sizing:border-box;padding:12px;font-size:16px;border:1px solid #bbb;border-radius:8px}button{background:#222;color:#fff;border:0;margin-top:16px}.slot{display:inline-block;width:auto;margin:4px 4px 0 0;padding:8px 12px;background:#fff;color:#222;border:1px solid #888}.slot.on{background:#222;color:#fff}.c{font-weight:400;display:flex;gap:8px;align-items:flex-start}.c input{width:auto}#msg{margin-top:12px;font-weight:600}</style></head>
<body><main><h1 id="biz">${esc(businessName)}</h1><div id="app">Loading...</div><p id="msg" role="status"></p></main>
<script>
(function(){var base=location.pathname.replace(/\\/page\\/?$/,'');var app=document.getElementById('app'),msg=document.getElementById('msg'),sel={};
function say(t){msg.textContent=t}function el(t,x,p){var e=document.createElement(t);if(x)e.textContent=x;if(p)p.appendChild(e);return e}
function j(u,o){return fetch(base+u,o).then(function(r){return r.json().then(function(b){if(!r.ok||!b.success)throw new Error(b.message||'Something went wrong.');return b.data})})}
j('').then(function(d){app.textContent='';
var l1=el('label','Service',app),s=el('select','',app);d.services.forEach(function(x){var o=el('option',x.name+' ('+x.mins+' min'+(x.price?', Rs '+x.price:'')+')',s);o.value=x.key});
var l2=el('label','Date',app),dt=el('input','',app);dt.type='date';
var sl=el('div','',app);
function load(){sl.textContent='';sel.start=null;if(!dt.value)return;j('/slots?date='+encodeURIComponent(dt.value)+'&serviceKey='+encodeURIComponent(s.value)).then(function(r){var list=r.slots||[];if(!list.length)say('No times free that day.');else say('');list.forEach(function(x){var lab=('0'+Math.floor(x/60)).slice(-2)+':'+('0'+x%60).slice(-2);var st=x;var b=el('button',lab,sl);b.type='button';b.className='slot';b.onclick=function(){sel.start=st;sel.staffId='';[].forEach.call(sl.children,function(c){c.className='slot'});b.className='slot on'}})}).catch(function(e){say(e.message)})}
dt.onchange=load;s.onchange=load;
el('label','Your name',app);var nm=el('input','',app);nm.maxLength=80;el('label','Phone',app);var ph=el('input','',app);ph.type='tel';ph.maxLength=15;
${clinic ? "var al=el('label','Area',app);var ar=el('select','',app);" + JSON.stringify(AREAS) + ".forEach(function(a){var o=el('option',a,ar);o.value=a});" : ''}
var cl=el('label','',app);cl.className='c';var cb=el('input','',cl);cb.type='checkbox';el('span',${JSON.stringify(CONSENT_TEXT)},cl);
var go=el('button','Book',app);go.type='button';go.onclick=function(){say('');if(!sel.start){say('Pick a time first.');return}if(!cb.checked){say('Please tick the box to agree.');return}
var body={date:dt.value,start:sel.start,staffId:sel.staffId||'',serviceKey:s.value,name:nm.value,phone:ph.value,consent:true};${clinic ? 'body.bodyArea=ar.value;' : ''}
go.disabled=true;j('/book',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(function(r){app.textContent='';el('p','Booked: '+r.serviceName+' on '+r.date+'. '+(r.status==='pending'?'The business will confirm it.':''),app)}).catch(function(e){go.disabled=false;say(e.message)})}
}).catch(function(e){app.textContent='';say(e.message)})})();
</script></body></html>`;
}
// The text the owner turns into a QR code. No QR image is made here.
function bookingUrl(env, token) { const base = String(env.SALON_PUBLIC_URL || '').replace(/\/+$/, ''); return base && /^https?:\/\//.test(base) ? `${base}/api/salon-book/${token}/page` : null; }
module.exports = { page, esc, bookingUrl, AREAS, CONSENT_TEXT };
