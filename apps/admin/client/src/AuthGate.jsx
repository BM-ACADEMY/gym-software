import { useState } from 'react';

// Sign-in for the Super Admin: email and password first, then the 6-digit code from the phone app
// (or one recovery code). The server does the checking; this page only collects the answers.
const post = async (path, body) => {
  const res = await fetch('/api/auth' + path, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'afra-admin' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.message || 'Could not sign in.');
  return json;
};


export default function AuthGate({ onDone }) {
  const [ticket, setTicket] = useState('');
  const [f, setF] = useState({ email: '', password: '', code: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (!ticket) {
        const r = await post('/login', { email: f.email.trim(), password: f.password });
        setTicket(r.ticket); setF({ ...f, password: '', code: '' });
      } else {
        await post('/code', { ticket, code: f.code.trim() });
        onDone();
      }
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="adm-auth" style={{ '--adm-brand': '#334155' }}><form onSubmit={submit} aria-label="Super Admin sign in">
      <h1>Afra Super Admin</h1>
      {!ticket ? (
        <>
          <label>Email<input type="email" value={f.email} onChange={set('email')} autoComplete="username" required autoFocus /></label>
          <label>Password<input type="password" value={f.password} onChange={set('password')} autoComplete="current-password" required /></label>
        </>
      ) : (
        <label>6-digit code from your phone app (or one recovery code)
          <input value={f.code} onChange={set('code')} autoComplete="one-time-code" inputMode="text" required autoFocus />
        </label>
      )}
      {error && <p role="alert" style={{ color: '#b00020' }}>{error}</p>}
      <button type="submit" className="adm-go" disabled={busy}>{busy ? 'Please wait…' : ticket ? 'Verify' : 'Continue'}</button>
    </form></div>
  );
}
