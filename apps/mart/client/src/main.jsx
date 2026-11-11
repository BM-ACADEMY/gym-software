import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminShell, PosScreen } from '../../../../packages/core-ui/src/index.js';
import pure from '../../../../packages/core-pos/src/pure.js';
import AuthGate from './AuthGate.jsx';
import product from './product.js';
import manifest from '../../admin/manifest.json';
import strings from '../../admin/strings.json';

// Talks to this product's server on the same address. Cookies carry the sign-in; nothing secret is kept in the page.
const call = async (method, path, body, params) => {
  const qs = params && Object.keys(params).length ? '?' + new URLSearchParams(params) : '';
  const res = await fetch(product.api + path + qs, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json', 'x-requested-with': product.header } : {}, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(json.message || 'Request failed'); e.response = { data: json }; throw e; }
  return json;
};
const api = { get: (p, params) => call('GET', p, null, params), post: (p, b) => call('POST', p, b || {}), patch: (p, b) => call('PATCH', p, b || {}), put: (p, b) => call('PUT', p, b || {}), del: (p) => call('DELETE', p) };

// The shared billing screen expects an axios-like client: get(path, { params }) and results as { data: body }.
const posCall = async (method, path, body, params) => {
  const qs = params && Object.keys(params).length ? '?' + new URLSearchParams(params) : '';
  const res = await fetch('/api' + path + qs, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json', 'x-requested-with': product.header } : {}, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(json.message || 'Request failed'); e.response = { data: json, status: res.status }; throw e; }
  return { data: json };
};
const posApi = { get: (p, cfg) => posCall('GET', p, null, cfg && cfg.params), post: (p, b) => posCall('POST', p, b || {}) };
const posRules = pure ? { compute: pure.bill.compute, settle: pure.bill.settle } : null;

const store = () => { try { return window.localStorage; } catch (e) { return { getItem: () => null, setItem: () => {} }; } };
// Menu names in another language come from admin/strings.json (draft, needs native review). Anything missing stays in English.
const translate = (m, lang) => (!strings || lang === 'en' || !strings[lang] ? m : { ...m, nav: m.nav.map((n) => ({ ...n, label: strings[lang][n.key] || n.label })) });
const btn = { padding: '6px 12px', border: '1px solid #ccc', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 14 };

function App({ me, signedOut }) {
  const [lang, setLang] = useState(() => store().getItem('mart:lang') || 'en');
  const [view, setView] = useState('panel');
  const shown = useMemo(() => translate(manifest, lang), [lang]);
  const pick = (l) => { setLang(l); try { store().setItem('mart:lang', l); } catch (e) { /* optional */ } };
  const logout = async () => { try { await call('POST', '/auth/logout', {}); } catch (e) { /* signing out anyway */ } signedOut(); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: product.accent, color: '#fff' }}>
        <strong style={{ flex: 1 }}>{me[product.meName] || product.title}</strong>
        {product.posBase && <button type="button" onClick={() => setView(view === 'billing' ? 'panel' : 'billing')} style={btn}>{view === 'billing' ? 'Back to the panel' : 'Billing'}</button>}
        {product.hasStrings && <select aria-label="Language" value={lang} onChange={(e) => pick(e.target.value)} style={btn}><option value="en">English</option><option value="ta">தமிழ்</option><option value="hi">हिन्दी</option></select>}
        <button type="button" onClick={logout} style={btn}>Sign out</button>
      </header>
      {lang !== 'en' && <p style={{ margin: 0, padding: '4px 12px', background: '#fff4e5', fontSize: 12 }}>Tamil and Hindi menu names are drafts and still need a native speaker's check.</p>}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {view === 'billing' ? <PosScreen api={posApi} rules={posRules} basePath="/mart/pos" /> : <AdminShell manifest={shown} api={api} role={me.role} />}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<AuthGate>{(me, signedOut) => <App me={me} signedOut={signedOut} />}</AuthGate>);

// Installable web app (same method as the gym, PWA-01). Production only. The service worker never stores /api calls.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* installing is optional */ }); });
}
