import { useEffect, useState } from 'react';
import Landing from '../../../../packages/core-ui/src/landing/Landing.jsx';
import landing from './landing.js';

const STATES = ['Andhra Pradesh','Assam','Bihar','Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Odisha','Puducherry','Punjab','Rajasthan','Tamil Nadu','Telangana','Uttar Pradesh','Uttarakhand','West Bengal','Other'];
const post = async (path, body) => {
  const res = await fetch('/api/hire/auth' + path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'x-requested-with': 'afra-hire' }, body: JSON.stringify(body || {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || 'Something went wrong. Please try again.');
  return json;
};

// Shows sign-in or sign-up until the server says we are signed in, then shows the app.
export default function AuthGate({ children }) {
  const [state, setState] = useState('loading'); // loading | out | in
  const [me, setMe] = useState(null);
  const check = () => fetch('/api/hire/auth/me', { credentials: 'same-origin' })
    .then(async (r) => { if (!r.ok) return setState('out'); setMe(await r.json()); setState('in'); }).catch(() => setState('out'));
  useEffect(() => { check(); }, []);

  if (state === 'loading') return <div className="adm-auth" style={{ '--adm-brand': '#0f766e' }}><p>Loading…</p></div>;
  if (state === 'in') return (
    <>
      {me && me.subscription && me.subscription.readOnly && <div role="alert" style={{ background: '#fff4e5', padding: 10, textAlign: 'center' }}>Your plan has ended, so this account is read-only. Renew to make changes.</div>}
      {children}
    </>
  );
  return <Front onDone={check} />;
}

// Logged-out visitors see the front page first; "Sign in" and "Ask to join" open the form (the address #signin or #join goes straight to it).
function Front({ onDone }) {
  const start = typeof location !== 'undefined' ? location.hash.slice(1) : '';
  const [view, setView] = useState(start === 'signin' || start === 'join' ? start : 'home');
  if (view === 'home') return <Landing name={'Hire'} brand={'#0f766e'} {...landing} onSignIn={() => setView('signin')} onJoin={() => setView('join')} />;
  return <Form onDone={onDone} startMode={view === 'join' ? 'signup' : 'login'} onBack={() => setView('home')} />;
}

function Form({ onDone, startMode = 'login', onBack }) {
  const [mode, setMode] = useState(startMode);
  const [f, setF] = useState({ agencyName: '', ownerName: '', email: '', state: '', password: '', phone: '', salesContactOk: false, acceptTerms: false });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try { await post(mode === 'login' ? '/login' : '/signup', f); onDone(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const signup = mode === 'signup';
  return (
    <div className="adm-auth" style={{ '--adm-brand': '#0f766e' }}><form onSubmit={submit} aria-label={signup ? 'Create your agency account' : 'Sign in'}>
      <h1>{signup ? 'Start your 14-day free trial' : 'Sign in to Hire'}</h1>
      {signup && <><label>Agency name<input value={f.agencyName} onChange={set('agencyName')} autoComplete="organization" required /></label>
        <label>Your name<input value={f.ownerName} onChange={set('ownerName')} autoComplete="name" required /></label></>}
      <label>Email<input type="email" value={f.email} onChange={set('email')} autoComplete="email" required /></label>
      {signup && <label>Mobile number (optional)<input type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" inputMode="tel" /></label>}
      {signup && <label>State (decides how GST shows on your invoice)
        <select value={f.state} onChange={set('state')} required><option value="">Select…</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select></label>}
      <label>Password{signup ? ' (10 or more characters)' : ''}<input type="password" value={f.password} onChange={set('password')} autoComplete={signup ? 'new-password' : 'current-password'} required /></label>
      {signup && <label style={{ display: 'block', marginBottom: 14 }}><input type="checkbox" checked={f.salesContactOk} onChange={set('salesContactOk')} /> It is OK for the Afra team to call or message me about my trial and plan (you can say stop any time)</label>}
      {signup && <label style={{ display: 'block', marginBottom: 14 }}><input type="checkbox" checked={f.acceptTerms} onChange={set('acceptTerms')} /> I accept the <a href="https://afraventures.in/terms" target="_blank" rel="noreferrer">terms</a> and <a href="https://afraventures.in/privacy" target="_blank" rel="noreferrer">privacy policy</a></label>}
      {error && <p role="alert" style={{ color: '#b00020' }}>{error}</p>}
      <button type="submit" className="adm-go" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}</button>
      <p><button type="button" onClick={() => { setMode(signup ? 'login' : 'signup'); setError(''); }} className="adm-link">{signup ? 'I already have an account' : 'New agency? Start a free trial'}</button></p>
      {onBack && <p><button type="button" onClick={onBack} className="adm-link">Back to the front page</button></p>}
    </form></div>
  );
}
