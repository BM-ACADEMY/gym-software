#!/usr/bin/env python3
"""Builds the seven pilot pages (marketing/site/<product>/index.html) from one table.
Only the pilot lines from docs/products/<x>/LANDING.md and MARKETING_CLAIMS.md are used (gym: written for this file from
docs/MARKETING_CLAIMS.md, which has no pilot lines): no prices, no feature claims, no numbers, no testimonials.
Run: python3 marketing/build_site.py   (writes the files; safe to run again)
Written 13 Nov 2026, not yet seen in a browser by a person."""
import html, os

COMPANY = {
    'name': 'Afra Ventures Private Limited',
    'gstin': '34ABGCA7083D1ZS', 'cin': 'U62011PY2026PTC009819',
    'address': '78, Lenin Street, Kosapalayam, Puducherry - 605013, India',
    'officer': 'Mohamed Kamarudeen B', 'email': 'privacy@afraventures.in',
}
# key = value sent to the waitlist API (fit, groom, mart, dine, cloth, wash, hire).
PRODUCTS = [
    dict(dir='gym', key='fit', name='GymDesk (Fit)', color='#0f766e',
         h_en='GymDesk for gyms is opening to a first group of gyms. Join the list.',
         l_en='A simple app for gym owners. We are inviting a few gyms to start first.',
         h_ta='ஜிம்களுக்கான GymDesk முதல் சில ஜிம்களுக்குத் திறக்கப்படுகிறது. பட்டியலில் சேருங்கள்.',
         l_ta='ஜிம் உரிமையாளர்களுக்கான எளிய செயலி. முதலில் சில ஜிம்களை அழைக்கிறோம்.',
         biz_en='Gym name', biz_ta='ஜிம் பெயர்'),
    dict(dir='salon', key='groom', name='Groom (Salon, Spa, Barber, Clinic)', color='#9d174d',
         h_en='Salon, Spa, Barber and Clinic (Groom) is coming. Join the invite-only pilot.',
         l_en='A simple booking and billing app for salons, spas, barbers and clinics. We are inviting a few businesses to try it first.',
         h_ta='சலூன், ஸ்பா, பார்பர், கிளினிக் (Groom) விரைவில் வருகிறது. அழைப்பு-மட்டும் பைலட்டில் சேருங்கள்.',
         l_ta='சலூன், ஸ்பா, பார்பர், கிளினிக்குகளுக்கான எளிய முன்பதிவு மற்றும் பில்லிங் செயலி. முதலில் சில நிறுவனங்களை அழைக்கிறோம்.',
         biz_en='Business name and type (Salon, Spa, Barber or Clinic)', biz_ta='நிறுவனப் பெயர் மற்றும் வகை (சலூன், ஸ்பா, பார்பர் அல்லது கிளினிக்)'),
    dict(dir='mart', key='mart', name='Mini Mart (kirana)', color='#b45309',
         h_en='Mini Mart (kirana) is coming. Join the invite-only pilot.',
         l_en='Billing, stock and udhaar for kirana and mini marts, in simple words. Invite-only pilot first.',
         h_ta='மினி மார்ட் (மளிகைக் கடை) விரைவில் வருகிறது. அழைப்பு-மட்டும் பைலட்டில் சேருங்கள்.',
         l_ta='மளிகைக் கடை மற்றும் மினி மார்ட்டுகளுக்கான பில்லிங், இருப்பு, உதார் - எளிய வார்த்தைகளில். முதலில் அழைப்பு-மட்டும் பைலட்.',
         biz_en='Shop name', biz_ta='கடை பெயர்'),
    dict(dir='dine', key='dine', name='Dine (restaurant, cafe, pub)', color='#b91c1c',
         h_en='Dine (restaurant, cafe, pub) is coming. Join the invite-only pilot.',
         l_en='Orders, kitchen tickets, bills and stock for restaurants and cafes. Invite-only pilot first.',
         h_ta='Dine (உணவகம், கஃபே, பப்) விரைவில் வருகிறது. அழைப்பு-மட்டும் பைலட்டில் சேருங்கள்.',
         l_ta='உணவகங்கள் மற்றும் கஃபேக்களுக்கான ஆர்டர்கள், சமையலறை டிக்கெட்டுகள், பில்கள், இருப்பு. முதலில் அழைப்பு-மட்டும் பைலட்.',
         biz_en='Restaurant or cafe name', biz_ta='உணவகம் அல்லது கஃபே பெயர்'),
    dict(dir='cloth', key='cloth', name='Cloth (textile and garment shops)', color='#6d28d9',
         h_en='Cloth (textile and garment shops) is coming. Join the invite-only pilot.',
         l_en='Stock by size and colour, billing and alteration orders for garment and textile shops. Invite-only pilot first.',
         h_ta='Cloth (ஜவுளி மற்றும் ஆடைக் கடைகள்) விரைவில் வருகிறது. அழைப்பு-மட்டும் பைலட்டில் சேருங்கள்.',
         l_ta='ஆடை மற்றும் ஜவுளிக் கடைகளுக்கான அளவு, நிறம் வாரியான இருப்பு, பில்லிங், மாற்றி தைக்கும் ஆர்டர்கள். முதலில் அழைப்பு-மட்டும் பைலட்.',
         biz_en='Shop name', biz_ta='கடை பெயர்'),
    dict(dir='wash', key='wash', name='Wash (car wash and detailing)', color='#0369a1',
         h_en='Wash (car wash and detailing) is coming. Join the invite-only pilot.',
         l_en='Jobs, monthly passes and cash closing for car wash and detailing centres. Invite-only pilot first.',
         h_ta='Wash (கார் வாஷ் மற்றும் டீடெய்லிங்) விரைவில் வருகிறது. அழைப்பு-மட்டும் பைலட்டில் சேருங்கள்.',
         l_ta='கார் வாஷ் மற்றும் டீடெய்லிங் மையங்களுக்கான வேலைகள், மாதாந்திர பாஸ், பணக் கணக்கு முடிப்பு. முதலில் அழைப்பு-மட்டும் பைலட்.',
         biz_en='Centre name', biz_ta='மையத்தின் பெயர்'),
    dict(dir='hire', key='hire', name='Hire (recruitment agencies)', color='#334155',
         h_en='Hire (recruitment agencies) is coming. Join the invite-only pilot.',
         l_en='A simple hiring tool for small recruitment agencies. Invite-only pilot first.',
         h_ta='Hire (ஆட்சேர்ப்பு நிறுவனங்கள்) விரைவில் வருகிறது. அழைப்பு-மட்டும் பைலட்டில் சேருங்கள்.',
         l_ta='சிறிய ஆட்சேர்ப்பு நிறுவனங்களுக்கான எளிய ஹையரிங் கருவி. முதலில் அழைப்பு-மட்டும் பைலட்.',
         biz_en='Agency name', biz_ta='நிறுவனத்தின் பெயர்'),
]
UI = {
    'en': dict(join='Ask to join', small='Pilot is for a small number of invited businesses. Prices are shown here only after we confirm them.',
               name='Your name', phone='Mobile number', email='Email (optional)', city='City or town', consent='I agree that Afra Ventures may contact me about this pilot. I can ask to be removed any time.',
               send='Ask to join the pilot', sending='Sending...', fail='Could not send. Please try again in a few minutes.', tick='Please tick the box so we may contact you.',
               need='Please give a name and a mobile number or an email.', note='Mobile number or email is needed.', lang='தமிழ்'),
    'ta': dict(join='சேரக் கேளுங்கள்', small='பைலட் அழைக்கப்பட்ட சில நிறுவனங்களுக்கு மட்டுமே. விலைகளை உறுதி செய்த பிறகே இங்கே காட்டுவோம்.',
               name='உங்கள் பெயர்', phone='மொபைல் எண்', email='மின்னஞ்சல் (விருப்பம்)', city='நகரம் அல்லது ஊர்', consent='இந்த பைலட் குறித்து அஃப்ரா வென்ச்சர்ஸ் என்னைத் தொடர்பு கொள்ள ஒப்புக்கொள்கிறேன். எப்போது வேண்டுமானாலும் நீக்கச் சொல்லலாம்.',
               send='பைலட்டில் சேரக் கேளுங்கள்', sending='அனுப்புகிறது...', fail='அனுப்ப முடியவில்லை. சில நிமிடங்களில் மீண்டும் முயற்சிக்கவும்.', tick='நாங்கள் தொடர்பு கொள்ள பெட்டியில் டிக் செய்யவும்.',
               need='பெயர் மற்றும் மொபைல் எண் அல்லது மின்னஞ்சல் தேவை.', note='மொபைல் எண் அல்லது மின்னஞ்சல் தேவை.', lang='English'),
}
E = html.escape

def page(p):
    en, ta = UI['en'], UI['ta']
    js_ui = {'en': {k: en[k] for k in ('sending', 'fail', 'tick', 'need', 'send')}, 'ta': {k: ta[k] for k in ('sending', 'fail', 'tick', 'need', 'send')}}
    import json
    return f"""<!doctype html>
<!--
  {p['name']}: pilot page. Built by marketing/build_site.py from the pilot lines in the product's LANDING.md and MARKETING_CLAIMS.md.
  Rules: no prices, no feature claims, no numbers, no testimonials. Written 13 Nov 2026, not yet seen in a browser by a person.
  TAMIL LINES ARE FIRST DRAFTS and need a native speaker's review (M-06) before this page goes public.
  To go live: set WAITLIST_API below to the Super Admin address, e.g. https://admin.afraventures.in/api/waitlist, and add this
  page's address to WAITLIST_ORIGINS in the Super Admin server settings (never in git).
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{E(p['name'])} - invite-only pilot</title>
<meta name="description" content="{E(p['l_en'])}">
<style>
:root{{--c:{p['color']};--ink:#1f2937;--muted:#4b5563;--line:#d1d5db;--bg:#f8fafc}}
*{{box-sizing:border-box}}
body{{margin:0;font:16px/1.55 system-ui,-apple-system,'Segoe UI','Noto Sans Tamil','Nirmala UI',sans-serif;color:var(--ink);background:var(--bg)}}
main{{max-width:560px;margin:0 auto;padding:20px 16px 40px}}
.top{{display:flex;justify-content:space-between;align-items:center;gap:12px}}
.brand{{font-weight:700;color:var(--c)}}
.lang{{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 14px;font:inherit;cursor:pointer}}
h1{{font-size:26px;line-height:1.25;margin:22px 0 8px}}
.lead{{color:var(--muted);margin:0 0 18px}}
form{{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;display:grid;gap:12px}}
label{{display:grid;gap:4px;font-weight:600;font-size:14px}}
input[type=text],input[type=tel],input[type=email]{{font:inherit;padding:11px 12px;border:1px solid var(--line);border-radius:10px;width:100%}}
input:focus-visible,button:focus-visible{{outline:3px solid var(--c);outline-offset:2px}}
.consent{{display:flex;gap:10px;align-items:flex-start;font-weight:400}}
.consent input{{width:20px;height:20px;margin-top:3px;accent-color:var(--c)}}
.go{{background:var(--c);color:#fff;border:0;border-radius:12px;padding:14px;font:inherit;font-weight:700;cursor:pointer}}
.go[disabled]{{opacity:.6}}
.msg{{min-height:1.4em;margin:0;font-weight:600}}
.msg.err{{color:#b91c1c}}.msg.ok{{color:#166534}}
.small{{font-size:13px;color:var(--muted)}}
.hp{{position:absolute;left:-9999px;height:0;overflow:hidden}}
footer{{max-width:560px;margin:0 auto;padding:16px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}}
footer a{{color:inherit}}
</style>
</head>
<body>
<main>
  <div class="top"><span class="brand">{E(p['name'])}</span><button class="lang" id="lang" type="button" aria-label="Language">{E(en['lang'])}</button></div>
  <h1 id="h"></h1>
  <p class="lead" id="l"></p>
  <form id="f" novalidate>
    <label><span data-k="name"></span><input type="text" id="name" autocomplete="name" maxlength="80" required></label>
    <label><span data-k="phone"></span><input type="tel" id="phone" inputmode="numeric" autocomplete="tel" maxlength="16"></label>
    <label><span data-k="email"></span><input type="email" id="email" autocomplete="email" maxlength="120"></label>
    <label><span id="biz"></span><input type="text" id="biz-in" maxlength="60"></label>
    <label><span data-k="city"></span><input type="text" id="city" autocomplete="address-level2" maxlength="60"></label>
    <div class="hp" aria-hidden="true"><label>Website<input type="text" id="website" tabindex="-1" autocomplete="off"></label></div>
    <label class="consent"><input type="checkbox" id="consent"><span data-k="consent"></span></label>
    <p class="small" data-k="note"></p>
    <button class="go" id="go" type="submit"></button>
    <p class="msg" id="msg" role="status" aria-live="polite"></p>
    <p class="small" data-k="small"></p>
  </form>
</main>
<footer>
  <p><strong>{E(COMPANY['name'])}</strong><br>{E(COMPANY['address'])}<br>GSTIN {E(COMPANY['gstin'])} &middot; CIN {E(COMPANY['cin'])}</p>
  <p><a href="/terms">Terms</a> &middot; <a href="/privacy">Privacy</a> &middot; <a href="/refund">Refund policy</a> &middot; <a href="/grievance">Grievance officer</a>: {E(COMPANY['officer'])}, <a href="mailto:{E(COMPANY['email'])}">{E(COMPANY['email'])}</a></p>
</footer>
<script>
// Set this to the Super Admin address before the page goes public (see the note at the top of the file).
var WAITLIST_API = '/api/waitlist';
var PRODUCT = '{p['key']}';
var T = {{
  en: {{h:{json.dumps(p['h_en'])}, l:{json.dumps(p['l_en'])}, biz:{json.dumps(p['biz_en'])}, ui:{json.dumps(en, ensure_ascii=False)}}},
  ta: {{h:{json.dumps(p['h_ta'], ensure_ascii=False)}, l:{json.dumps(p['l_ta'], ensure_ascii=False)}, biz:{json.dumps(p['biz_ta'], ensure_ascii=False)}, ui:{json.dumps(ta, ensure_ascii=False)}}}
}};
var lang = 'en';
var $ = function (id) {{ return document.getElementById(id); }};
function paint() {{
  var t = T[lang]; document.documentElement.lang = lang;
  $('h').textContent = t.h; $('l').textContent = t.l; $('biz').textContent = t.biz; $('go').textContent = t.ui.send; $('lang').textContent = t.ui.lang;
  document.title = t.h;
  Array.prototype.forEach.call(document.querySelectorAll('[data-k]'), function (el) {{ el.textContent = t.ui[el.getAttribute('data-k')]; }});
}}
$('lang').addEventListener('click', function () {{ lang = lang === 'en' ? 'ta' : 'en'; paint(); }});
var src = (new URLSearchParams(location.search).get('src') || 'site').toLowerCase();
$('f').addEventListener('submit', function (ev) {{
  ev.preventDefault(); var t = T[lang].ui, m = $('msg'); m.className = 'msg'; m.textContent = '';
  var name = $('name').value.trim(), phone = $('phone').value.trim(), email = $('email').value.trim();
  if (name.length < 2 || (!phone && !email)) {{ m.className = 'msg err'; m.textContent = t.need; return; }}
  if (!$('consent').checked) {{ m.className = 'msg err'; m.textContent = t.tick; return; }}
  $('go').disabled = true; m.textContent = t.sending;
  fetch(WAITLIST_API, {{ method: 'POST', headers: {{ 'Content-Type': 'application/json' }}, body: JSON.stringify({{
    name: name, phone: phone, email: email, product: PRODUCT, businessType: $('biz-in').value, city: $('city').value, source: src, website: $('website').value, consent: true }}) }})
  .then(function (r) {{ return r.json().then(function (j) {{ return {{ ok: r.ok, j: j }}; }}); }})
  .then(function (x) {{ m.className = 'msg ' + (x.ok && x.j.success ? 'ok' : 'err'); m.textContent = (x.ok && x.j.success) ? x.j.message : (x.j.message || t.fail); if (x.ok && x.j.success) $('f').reset(); }})
  .catch(function () {{ m.className = 'msg err'; m.textContent = t.fail; }})
  .then(function () {{ $('go').disabled = false; }});
}});
paint();
</script>
</body>
</html>
"""

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'site')
for p in PRODUCTS:
    d = os.path.join(root, p['dir']); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(page(p))
    print('wrote', os.path.join('marketing/site', p['dir'], 'index.html'))
