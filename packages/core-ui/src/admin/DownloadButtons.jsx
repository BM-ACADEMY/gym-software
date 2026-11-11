import { useState } from 'react';
import { useT } from './i18n.js';
import { downloadName, rangeQuery } from './schema.js';

// Buttons that save a file (for example the CA export). The request is a normal signed-in GET made by the page itself,
// so the cookie goes with it and nothing secret is put in a link. api.download(path) must return { blob, contentDisposition }.
export async function saveDownload(api, path, fallbackName) {
  if (!api || typeof api.download !== 'function') throw new Error('Download is not available in this app yet.');
  const { blob, contentDisposition } = await api.download(path);
  const name = downloadName(contentDisposition, fallbackName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return name;
}

export default function DownloadButtons({ list, api }) {
  const t = useT(); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState('');
  if (!Array.isArray(list) || !list.length) return null;
  const run = async (d) => {
    setBusy(d.label); setMsg('');
    try { const q = d.rangeDays ? rangeQuery(d.rangeDays) : null; const n = await saveDownload(api, q ? `${d.path}?from=${q.from}&to=${q.to}` : d.path, d.filename); setMsg(`${d.done || t('download')}: ${n}`); }
    catch (err) { setMsg((err && err.response && err.response.data && err.response.data.message) || (err && err.message) || 'Could not download.'); }
    finally { setBusy(''); }
  };
  return (
    <div className="adm-row" style={{ flexWrap: 'wrap', gap: 8 }}>
      {list.map((d) => <button key={d.path} type="button" className="adm-btn" disabled={busy === d.label} onClick={() => run(d)}>{d.label}</button>)}
      {msg && <span role="status" className="adm-note">{msg}</span>}
    </div>
  );
}
