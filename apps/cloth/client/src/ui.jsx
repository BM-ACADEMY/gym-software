// Small shared look for the Cloth screens: phone first, large tap targets.
export const S = {
  page: { padding: 12, maxWidth: 640, margin: '0 auto', fontSize: 16 },
  card: { border: '1px solid #ddd', borderRadius: 10, padding: 12, marginBottom: 12, background: '#fff' },
  h: { margin: '4px 0 10px', fontSize: 20 },
  label: { display: 'block', fontSize: 14, color: '#444', margin: '8px 0 4px' },
  input: { width: '100%', boxSizing: 'border-box', padding: '12px 10px', fontSize: 16, border: '1px solid #bbb', borderRadius: 8 },
  btn: { padding: '12px 16px', fontSize: 16, border: '1px solid #6d28d9', background: '#6d28d9', color: '#fff', borderRadius: 8, cursor: 'pointer', minHeight: 44 },
  ghost: { padding: '12px 16px', fontSize: 16, border: '1px solid #bbb', background: '#fff', color: '#222', borderRadius: 8, cursor: 'pointer', minHeight: 44 },
  chip: (on) => ({ padding: '10px 14px', fontSize: 15, borderRadius: 20, border: '1px solid ' + (on ? '#6d28d9' : '#bbb'), background: on ? '#ede9fe' : '#fff', cursor: 'pointer', minHeight: 40 }),
  row: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  err: { color: '#b91c1c', margin: '6px 0' },
  ok: { color: '#166534', margin: '6px 0' },
  muted: { color: '#666', fontSize: 14 },
};
export const Msg = ({ error, ok }) => (error ? <p role="alert" style={S.err}>{error}</p> : ok ? <p role="status" style={S.ok}>{ok}</p> : null);
export const rupees = (n) => 'Rs ' + (Number(n) || 0).toLocaleString('en-IN');
export const msg = (e, fallback) => (e && e.message) || fallback;
