import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminShell, PosScreen } from '../../../../packages/core-ui/src/index.js';
import pure from '../../../../packages/core-pos/src/pure.js';
import AuthGate from './AuthGate.jsx';
import product from './product.js';
import manifest from '../../admin/manifest.json';
import { call, api } from './api.js';
import T from './strings.js';
import Bill from './screens/Bill.jsx';
import Alterations from './screens/Alterations.jsx';
import Stock from './screens/Stock.jsx';
import People from './screens/People.jsx';
const strings = null; // no Tamil or Hindi menu names for this product yet

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

// Tabs next to the owner panel. The shared item billing screen stays as "Other items" for things not sold by size and colour.
const TABS = [['panel', T.tabs.panel], ['bill', T.tabs.bill], ['alterations', T.tabs.alterations], ['stock', T.tabs.stock], ['people', T.tabs.people], ['items', T.tabs.items]];

function App({ me, signedOut }) {
  const [lang, setLang] = useState(() => store().getItem('cloth:lang') || 'en');
  const [view, setView] = useState('bill');
  const shown = useMemo(() => translate(manifest, lang), [lang]);
  const pick = (l) => { setLang(l); try { store().setItem('cloth:lang', l); } catch (e) { /* optional */ } };
  const logout = async () => { try { await call('POST', '/auth/logout', {}); } catch (e) { /* signing out anyway */ } signedOut(); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: product.accent, color: '#fff' }}>
        <strong style={{ flex: 1 }}>{me[product.meName] || product.title}</strong>
        {product.hasStrings && <select aria-label="Language" value={lang} onChange={(e) => pick(e.target.value)} style={btn}><option value="en">English</option><option value="ta">தமிழ்</option><option value="hi">हिन्दी</option></select>}
        <button type="button" onClick={logout} style={btn}>Sign out</button>
      </header>
      <nav aria-label="Screens" style={{ display: 'flex', gap: 6, padding: '6px 12px', overflowX: 'auto', background: '#f5f3ff', borderBottom: '1px solid #ddd' }}>
        {TABS.map(([k, label]) => <button key={k} type="button" onClick={() => setView(k)} aria-current={view === k ? 'page' : undefined} style={{ ...btn, padding: '10px 14px', whiteSpace: 'nowrap', background: view === k ? '#ede9fe' : '#fff', borderColor: view === k ? product.accent : '#ccc', fontWeight: view === k ? 600 : 400 }}>{label}</button>)}
      </nav>
      {lang !== 'en' && <p style={{ margin: 0, padding: '4px 12px', background: '#fff4e5', fontSize: 12 }}>Tamil and Hindi menu names are drafts and still need a native speaker's check.</p>}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {view === 'bill' && <Bill />}
        {view === 'alterations' && <Alterations />}
        {view === 'stock' && <Stock role={me.role} />}
        {view === 'people' && <People />}
        {view === 'items' && <PosScreen api={posApi} rules={posRules} basePath="/pos" />}
        {view === 'panel' && <AdminShell manifest={shown} api={api} role={me.role} />}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<AuthGate>{(me, signedOut) => <App me={me} signedOut={signedOut} />}</AuthGate>);

// Installable web app (same method as the gym, PWA-01). Production only. The service worker never stores /api calls.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* installing is optional */ }); });
}
