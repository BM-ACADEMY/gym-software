import { createRoot } from 'react-dom/client';
import { AdminShell } from '../../../../packages/core-ui/src/index.js';
import AuthGate from './AuthGate.jsx';
import manifest from '../../admin/manifest.json';

// Talks to the server on the same address. Cookies carry the sign-in; nothing secret is kept in the page.
const call = async (method, path, body, params) => {
  const qs = params && Object.keys(params).length ? '?' + new URLSearchParams(params) : '';
  const res = await fetch('/api/hire' + path + qs, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json', 'x-requested-with': 'afra-hire' } : {}, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(json.message || 'Request failed'); e.response = { data: json }; throw e; }
  return json;
};
const api = { get: (p, params) => call('GET', p, null, params), post: (p, b) => call('POST', p, b || {}), patch: (p, b) => call('PATCH', p, b || {}), put: (p, b) => call('PUT', p, b || {}), del: (p) => call('DELETE', p) };

createRoot(document.getElementById('root')).render(<AuthGate><AdminShell manifest={manifest} api={api} /></AuthGate>);
