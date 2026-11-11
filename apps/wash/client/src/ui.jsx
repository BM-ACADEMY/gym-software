import { useState } from 'react';
// Small shared bits for the Wash screens: big phone-friendly buttons, a card, an error line. Inline styles only (no extra packages).
export const colors = { main: '#0369a1', soft: '#e0f2fe', line: '#d4d4d8', bad: '#b91c1c', ok: '#15803d', warn: '#b45309' };
export const btn = (primary, small) => ({ minHeight: small ? 40 : 48, padding: small ? '6px 12px' : '10px 16px', fontSize: 16, borderRadius: 8, border: '1px solid ' + (primary ? colors.main : colors.line), background: primary ? colors.main : '#fff', color: primary ? '#fff' : '#111', cursor: 'pointer' });
export const input = { width: '100%', minHeight: 44, padding: '8px 10px', fontSize: 16, border: '1px solid ' + colors.line, borderRadius: 8, boxSizing: 'border-box' };
export const Card = ({ children, style }) => <div style={{ border: '1px solid ' + colors.line, borderRadius: 10, padding: 12, margin: '8px 0', background: '#fff', ...style }}>{children}</div>;
export const Err = ({ text }) => (text ? <p role="alert" style={{ color: colors.bad, margin: '6px 0' }}>{text}</p> : null);
export const Note = ({ children }) => <p style={{ color: '#52525b', fontSize: 13, margin: '4px 0' }}>{children}</p>;
export const Field = ({ label, children }) => <label style={{ display: 'block', margin: '8px 0' }}><span style={{ display: 'block', fontSize: 14, marginBottom: 2 }}>{label}</span>{children}</label>;
export const Tabs = ({ items, value, onChange }) => (
  <div role="tablist" style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 8px 0' }}>
    {items.map(([k, label]) => <button key={k} role="tab" aria-selected={value === k} type="button" onClick={() => onChange(k)} style={{ ...btn(value === k, true), whiteSpace: 'nowrap' }}>{label}</button>)}
  </div>
);
// Runs an async action, keeps a busy flag and the error text. Usage: const [run, busy, err] = useAction();
export function useAction() {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const run = async (fn) => { setBusy(true); setErr(''); try { return await fn(); } catch (e) { setErr(e.message || 'Something went wrong'); return undefined; } finally { setBusy(false); } };
  return [run, busy, err, setErr];
}
// Today in India as YYYY-MM-DD (the server counts days the same way).
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
export const minsSince = (iso) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : 0);
