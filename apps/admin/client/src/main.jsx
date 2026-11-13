import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminShell } from '../../../../packages/core-ui/src/index.js';
import manifest from '../../manifest.json';
import AuthGate from './AuthGate.jsx';

// Talks to the server on the same address. Cookies carry the sign-in; nothing secret is kept in the page.
const call = async (method, path, body, params) => {
  const qs = params && Object.keys(params).length ? '?' + new URLSearchParams(params) : '';
  const res = await fetch('/api/admin' + path + qs, { method, credentials: 'same-origin', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), 'X-Requested-With': 'afra-admin' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(json.message || 'Request failed'); e.response = { data: json }; throw e; }
  return json;
};
const api = { get: (p, params) => call('GET', p, null, params), post: (p, b) => call('POST', p, b || {}), patch: (p, b) => call('PATCH', p, b || {}), put: (p, b) => call('PUT', p, b || {}), del: (p) => call('DELETE', p) };

// Ask the server who is signed in; show the sign-in form until the answer is yes. A 401 here is normal for a visitor, not an error.
function App() {
  const [state, setState] = useState('checking');
  useEffect(() => { fetch('/api/auth/me', { credentials: 'same-origin' }).then((r) => setState(r.ok ? 'in' : 'out')).catch(() => setState('out')); }, []);
  if (state === 'checking') return null;
  if (state === 'out') return <AuthGate onDone={() => setState('in')} />;
  return <AdminShell manifest={manifest} api={api} />;
}
createRoot(document.getElementById('root')).render(<App />);

// Phone alerts: a small button turns them on for this phone or browser. Does nothing if the server has no alert keys.
(async () => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const k = await api.get('/push/key').catch(() => null); if (!k || !k.data) return;
    const reg = await navigator.serviceWorker.register('/sw.js');
    const existing = await reg.pushManager.getSubscription(); if (existing) return;
    const b = document.createElement('button'); b.textContent = 'Turn on phone alerts';
    b.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:50;padding:10px 14px;border-radius:10px;border:1px solid #999;background:#fff;font:14px system-ui';
    b.onclick = async () => {
      try {
        if ((await Notification.requestPermission()) !== 'granted') { b.textContent = 'Alerts blocked in this browser'; return; }
        const raw = atob(k.data.publicKey.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(k.data.publicKey.length / 4) * 4, '='));
        const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        await api.post('/push/subscribe', { subscription: sub.toJSON() }); b.remove();
      } catch (e) { b.textContent = 'Could not turn on alerts'; }
    };
    document.body.appendChild(b);
  } catch (e) { /* alerts are optional */ }
})();
