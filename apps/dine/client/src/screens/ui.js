// Small shared pieces for the Dine screens: big-button styles, money format, and a poller. Nothing here talks to the server by itself.
import { useCallback, useEffect, useRef, useState } from 'react';
export const COLOR = { free: '#e5e7eb', open: '#fde68a', sent: '#fdba74', served: '#bbf7d0', billed: '#bfdbfe', paid: '#d1d5db' };
export const S = {
  page: { padding: 12, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, sans-serif' },
  big: { padding: '14px 18px', fontSize: 17, border: '1px solid #9ca3af', borderRadius: 10, background: '#fff', cursor: 'pointer', minHeight: 48 },
  primary: { padding: '14px 18px', fontSize: 17, border: '1px solid #c2410c', borderRadius: 10, background: '#c2410c', color: '#fff', cursor: 'pointer', minHeight: 48 },
  danger: { padding: '10px 14px', fontSize: 15, border: '1px solid #b91c1c', borderRadius: 10, background: '#fff', color: '#b91c1c', cursor: 'pointer', minHeight: 44 },
  input: { padding: 12, fontSize: 17, border: '1px solid #9ca3af', borderRadius: 8, width: '100%', boxSizing: 'border-box', margin: '4px 0 12px' },
  card: { border: '1px solid #d1d5db', borderRadius: 12, padding: 12, margin: '8px 0', background: '#fff' },
  row: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  err: { color: '#b91c1c', margin: '8px 0' }, ok: { color: '#166534', margin: '8px 0' },
};
export const rs = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
export const msgOf = (e, t) => { const m = (e && e.response && e.response.data && e.response.data.message) || (e && e.message) || 'Something went wrong.'; return m === 'Not allowed for your role.' ? t('not_allowed') : m; };
export const openPage = (path) => window.open('/api/dine' + path, '_blank', 'noopener'); // print pages are plain GET pages; the sign-in cookie goes along
// Runs load() now and every `every` ms while the screen is on. Returns { data, error, reload, loading }.
export function usePoll(load, every, deps) {
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const ref = useRef(load); ref.current = load;
  const reload = useCallback(async () => { try { setData(await ref.current()); setError(''); } catch (e) { setError((e && e.message) || 'Could not load.'); } finally { setLoading(false); } }, []);
  useEffect(() => { setLoading(true); reload(); if (!every) return undefined; const id = setInterval(reload, every); return () => clearInterval(id); }, [reload, every, ...(deps || [])]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, loading, reload };
}
