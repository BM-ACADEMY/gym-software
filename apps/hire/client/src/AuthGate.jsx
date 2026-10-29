import { useEffect, useState } from 'react';

const STATES = ['Andhra Pradesh','Assam','Bihar','Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Odisha','Puducherry','Punjab','Rajasthan','Tamil Nadu','Telangana','Uttar Pradesh','Uttarakhand','West Bengal','Other'];
const post = async (path, body) => {
  const res = await fetch('/api/hire/auth' + path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'x-requested-with': 'afra-hire' }, body: JSON.stringify(body || {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || 'Something went wrong. Please try again.');
  return json;
};
const box = { maxWidth: 420, margin: '8vh auto', padding: 24, fontFamily: 'system-ui, sans-serif' };
const field = { display: 'block', width: '100%', padding: 10, margin: '4px 0 14px', fontSize: 16, boxSizing: 'border-box' };

// Shows sign-in or sign-up until the server says we are signed in, then shows the app.
export default function AuthGate({ children }) {
  const [state, setState] = useState('loading'); // loading | out | in
  const [me, setMe] = useState(null);
  const check = () => fetch('/api/hire/auth/me', { credentials: 'same-origin' })
    .then(async (r) => { if (!r.ok) return setState('out'); setMe(await r.json()); setState('in'); }).catch(() => setState('out'));
  useEffect(() => { check(); }, []);

  if (state === 'loading') return <div style={box}>Loading…</div>;
  if (state === 'in') return (
    <>
      {me && me.subscription && me.subscription.readOnly && <div role="alert" style={{ background: '#fff4e5', padding: 10, textAlign: 'center' }}>Your plan has ended, so this account is read-only. Renew to make changes.</div>}
      {children}
    </>
  );
  return <Form onDone={check} />;
}

function Form({ onDone }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ agencyName: '', ownerName: '', email: '', state: '', password: '', phone: '', salesContactOk: false, acceptTerms: false });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try { await post(mode === 'login' ? '/login' : '/signup', f); onDone(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const signup = mode === 'signup';
  return (
    <form onSubmit={submit} style={box} aria-label={signup ? 'Create your agency account' : 'Sign in'}>
      <h1 style={{ fontSize: 24 }}>{signup ? 'Start your 14-day free trial' : 'Sign in to Hire'}</h1>
      {signup && <><label>Agency name<input style={field} value={f.agencyName} onChange={set('agencyName')} autoComplete="organization" required /></label>
        <label>Your name<input style={field} value={f.ownerName} onChange={set('ownerName')} autoComplete="name" required /></label></>}
      <label>Email<input style={field} type="email" value={f.email} onChange={set('email')} autoComplete="email" required /></label>
      {signup && <label>Mobile number (optional)<input style={field} type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" inputMode="tel" /></label>}
      {signup && <label>State (decides how GST shows on your invoice)
        <select style={field} value={f.state} onChange={set('state')} required><option value="">Select…</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select></label>}
      <label>Password{signup ? ' (10 or more characters)' : ''}<input style={field} type="password" value={f.password} onChange={set('password')} autoComplete={signup ? 'new-password' : 'current-password'} required /></label>
      {signup && <label style={{ display: 'block', marginBottom: 14 }}><input type="checkbox" checked={f.salesContactOk} onChange={set('salesContactOk')} /> It is OK for the Afra team to call or message me about my trial and plan (you can say stop any time)</label>}
      {signup && <label style={{ display: 'block', marginBottom: 14 }}><input type="checkbox" checked={f.acceptTerms} onChange={set('acceptTerms')} /> I accept the <a href="https://afraventures.in/terms" target="_blank" rel="noreferrer">terms</a> and <a href="https://afraventures.in/privacy" target="_blank" rel="noreferrer">privacy policy</a></label>}
      {error && <p role="alert" style={{ color: '#b00020' }}>{error}</p>}
      <button type="submit" disabled={busy} style={{ padding: '10px 18px', fontSize: 16 }}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}</button>
      <p><button type="button" onClick={() => { setMode(signup ? 'login' : 'signup'); setError(''); }} style={{ background: 'none', border: 0, color: '#0b57d0', cursor: 'pointer', padding: 0 }}>{signup ? 'I already have an account' : 'New agency? Start a free trial'}</button></p>
    </form>
  );
}
