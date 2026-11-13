// Small shared pieces for the Dine screens: big-button styles, money format, and a poller. Nothing here talks to the server by itself.
import { useCallback, useEffect, useRef, useState } from 'react';
export const COLOR = { free: '#e5e7eb', open: '#fde68a', sent: '#fdba74', served: '#bbf7d0', billed: '#bfdbfe', paid: '#d1d5db' };
export const S = {
  page: { padding: 12, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, sans-serif' },
  big: { padding: '14px 18px', fontSize: 17, fontWeight: 600, border: '1px solid #c5d0d6', borderRadius: 12, background: '#fff', cursor: 'pointer', minHeight: 48 },
  primary: { padding: '14px 20px', fontSize: 17, fontWeight: 700, border: 0, borderRadius: 12, background: 'linear-gradient(135deg,#ea580c,#c2410c)', color: '#fff', cursor: 'pointer', minHeight: 48, boxShadow: '0 3px 10px rgba(194,65,12,.3)' },
  danger: { padding: '10px 14px', fontSize: 15, border: '1px solid #b91c1c', borderRadius: 10, background: '#fff', color: '#b91c1c', cursor: 'pointer', minHeight: 44 },
  input: { padding: 12, fontSize: 17, border: '1px solid #c5d0d6', borderRadius: 10, width: '100%', boxSizing: 'border-box', margin: '4px 0 12px' },
  card: { border: '1px solid #e1e8ec', borderRadius: 16, padding: 14, margin: '8px 0', background: '#fff', boxShadow: '0 1px 2px rgba(20,35,43,.06), 0 4px 14px rgba(20,35,43,.06)' },
  row: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  err: { color: '#a52a2a', background: '#f9dcdc', borderRadius: 10, padding: '8px 12px', margin: '8px 0' }, ok: { color: '#166534', background: '#dcfce7', borderRadius: 10, padding: '8px 12px', margin: '8px 0' },
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
