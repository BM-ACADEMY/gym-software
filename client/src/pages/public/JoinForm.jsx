import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../../api/client';

// The gym's public enquiry page (/join/<secret key>). A person leaves a name and a mobile number; the gym calls back.
// The secret key is in the link only. Nothing here shows any other person's data.
const JoinForm = () => {
  const { key } = useParams();
  const [gym, setGym] = useState(null);
  const [missing, setMissing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', goal: '', consent: false, website: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { apiClient.get(`/public/leads/${key}`).then((r) => setGym(r.data.data)).catch(() => setMissing(true)); }, [key]);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try { await apiClient.post(`/public/leads/${key}`, form); setDone(true); }
    catch (err) { setError(err.response?.data?.message || 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  };

  const color = gym?.brandColor || '#0d9488';
  const input = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2';
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm">
        {missing ? (
          <p className="text-center text-gray-600">This link is not active. Please ask the gym for a new one.</p>
        ) : !gym ? (
          <p className="text-center text-gray-500">Loading...</p>
        ) : done ? (
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900">Thank you</h1>
            <p className="mt-2 text-gray-600">{gym.gymName} will call you soon.</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            {gym.logoUrl ? <img src={gym.logoUrl} alt="" className="mx-auto mb-3 h-14 w-14 rounded-full object-cover" /> : null}
            <h1 className="text-center text-xl font-semibold text-gray-900">{gym.gymName}</h1>
            <p className="mt-1 text-center text-sm text-gray-500">Leave your number and we will call you back.</p>
            <label className="mt-5 block text-sm font-medium text-gray-700">Your name
              <input className={input} value={form.name} maxLength={80} autoComplete="name" onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="mt-4 block text-sm font-medium text-gray-700">Mobile number
              <input className={input} value={form.phone} inputMode="tel" autoComplete="tel" placeholder="98765 43210" onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="mt-4 block text-sm font-medium text-gray-700">What do you want from the gym? (optional)
              <input className={input} value={form.goal} maxLength={120} placeholder="Lose weight, build muscle..." onChange={(e) => setForm({ ...form, goal: e.target.value })} />
            </label>
            {/* Hidden field for bots. People never see or fill it. */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
              <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label>
            </div>
            <label className="mt-4 flex items-start gap-2 text-sm text-gray-600">
              <input className="mt-1" type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
              <span>I agree that {gym.gymName} may call or message me about joining. My number is used only for this.</span>
            </label>
            {error ? <p className="mt-3 text-sm text-red-600" role="alert">{error}</p> : null}
            <button type="submit" disabled={busy} style={{ backgroundColor: color }} className="mt-5 w-full rounded-lg px-4 py-3 text-base font-semibold text-white disabled:opacity-60">{busy ? 'Sending...' : 'Call me back'}</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default JoinForm;
