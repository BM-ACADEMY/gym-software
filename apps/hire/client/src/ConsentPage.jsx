import { useEffect, useState } from 'react';

// Public page a candidate opens from the one-time link: /consent/<token>. Shows the agency name and the notice only.
export default function ConsentPage({ token }) {
  const [st, setSt] = useState({ loading: true });
  const [agree, setAgree] = useState(false);
  const [ai, setAi] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    fetch('/api/hire-consent/' + encodeURIComponent(token)).then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }))
      .then(({ ok, j }) => setSt(ok ? { data: j.data } : { error: j.message || 'This link is not valid.' })).catch(() => setSt({ error: 'Could not load. Please try again.' }));
  }, [token]);
  const submit = async () => {
    setErr('');
    const r = await fetch('/api/hire-consent/' + encodeURIComponent(token), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agree, purposeAi: ai }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setDone(true); else setErr(j.message || 'Could not save. Please try again.');
  };
  const box = { maxWidth: 560, margin: '24px auto', padding: 16, font: '16px/1.5 system-ui' };
  if (st.loading) return <div style={box}>Loading...</div>;
  if (st.error) return <div style={box}><h2>Consent form</h2><p>{st.error}</p></div>;
  if (done) return <div style={box}><h2>Thank you</h2><p>Your answer is saved. You can ask {st.data.agency} to delete your details at any time.</p></div>;
  return (
    <div style={box}>
      <h2>{st.data.agency}</h2>
      <div style={{ whiteSpace: 'pre-wrap' }}>{st.data.notice}</div>
      <label style={{ display: 'block', margin: '16px 0 8px' }}><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I have read this and I agree to {st.data.agency} keeping my details.</label>
      <label style={{ display: 'block', marginBottom: 16 }}><input type="checkbox" checked={ai} onChange={(e) => setAi(e.target.checked)} /> Optional: a computer program may read my resume text to match me to jobs.</label>
      {err && <p style={{ color: '#b00020' }}>{err}</p>}
      <button disabled={!agree} onClick={submit} style={{ padding: '10px 18px', fontSize: 16 }}>Submit</button>
    </div>
  );
}
