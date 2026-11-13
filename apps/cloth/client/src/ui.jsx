// Small shared look for the Cloth screens: phone first, large tap targets.
export const S = {
  page: { padding: 12, maxWidth: 640, margin: '0 auto', fontSize: 16 },
  card: { border: '1px solid #e1e8ec', borderRadius: 16, padding: 14, marginBottom: 12, background: '#fff', boxShadow: '0 1px 2px rgba(20,35,43,.06), 0 4px 14px rgba(20,35,43,.06)' },
  h: { margin: '4px 0 10px', fontSize: 20 },
  label: { display: 'block', fontSize: 14, color: '#444', margin: '8px 0 4px' },
  input: { width: '100%', boxSizing: 'border-box', padding: '12px 12px', fontSize: 16, border: '1px solid #c5d0d6', borderRadius: 10 },
  btn: { padding: '12px 18px', fontSize: 16, fontWeight: 700, border: 0, background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', color: '#fff', borderRadius: 12, cursor: 'pointer', minHeight: 46, boxShadow: '0 3px 10px rgba(109,40,217,.28)' },
  ghost: { padding: '12px 18px', fontSize: 16, fontWeight: 600, border: '1px solid #c5d0d6', background: '#fff', color: '#14232b', borderRadius: 12, cursor: 'pointer', minHeight: 46 },
  chip: (on) => ({ padding: '10px 14px', fontSize: 15, borderRadius: 20, border: '1px solid ' + (on ? '#6d28d9' : '#c5d0d6'), background: on ? '#ede9fe' : '#fff', color: on ? '#5b21b6' : '#14232b', fontWeight: on ? 700 : 500, cursor: 'pointer', minHeight: 40 }),
  row: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  err: { color: '#a52a2a', background: '#f9dcdc', borderRadius: 10, padding: '8px 12px', margin: '6px 0' },
  ok: { color: '#166534', background: '#dcfce7', borderRadius: 10, padding: '8px 12px', margin: '6px 0' },
  muted: { color: '#666', fontSize: 14 },
};
export const Msg = ({ error, ok }) => (error ? <p role="alert" style={S.err}>{error}</p> : ok ? <p role="status" style={S.ok}>{ok}</p> : null);
export const rupees = (n) => 'Rs ' + (Number(n) || 0).toLocaleString('en-IN');
export const msg = (e, fallback) => (e && e.message) || fallback;
