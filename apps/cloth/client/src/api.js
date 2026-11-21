import product from './product.js';

// One small client for this product's server (cookies carry the sign-in; the header blocks cross-site posts).
const run = async (base, method, path, body, params) => {
  const qs = params && Object.keys(params).length ? '?' + new URLSearchParams(params) : '';
  const res = await fetch(base + path + qs, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json', 'x-requested-with': product.header } : {}, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(json.message || 'Request failed'); e.status = res.status; e.response = { data: json, status: res.status }; throw e; }
  return json;
};
export const call = (m, p, b, q) => run(product.api, m, p, b, q);
export const pos = (m, p, b, q) => run('/api/pos', m, p, b, q); // the shared bill, customer and import routes
// Saves a file (CA export, my-data export) with the same signed-in cookie. The page, not a link, makes the request.
export const download = async (path) => {
  const res = await fetch(product.api + path, { method: 'GET', credentials: 'same-origin' });
  if (!res.ok) { const json = await res.json().catch(() => ({})); const e = new Error(json.message || 'Could not download.'); e.response = { data: json }; throw e; }
  return { blob: await res.blob(), contentDisposition: res.headers.get('Content-Disposition') || '' };
};
export const api = { get: (p, q) => call('GET', p, null, q), post: (p, b) => call('POST', p, b || {}), patch: (p, b) => call('PATCH', p, b || {}), put: (p, b) => call('PUT', p, b || {}), del: (p) => call('DELETE', p), download };
