import { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import Badge from '../../components/ui/Badge';

const TONE = { open: 'amber', in_progress: 'blue', resolved: 'green' };
const LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' };

const Assistant = () => {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');

  const ask = async (e) => {
    e.preventDefault();
    setErr(''); setRes(null); setBusy(true);
    try {
      const r = await apiClient.post('/admin/assistant/ask', { question: q });
      setRes(r.data.data);
    } catch (ex) {
      setErr(ex.response?.data?.message || 'Could not get an answer. Please try again.');
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-gray-800">Ask GymDesk</h2>
      <p className="mt-1 text-sm text-gray-500">Ask how to do something. Answers come from our help articles.</p>
      <form onSubmit={ask} className="mt-3 flex gap-2">
        <input id="ask-gymdesk" required minLength={3} maxLength={500} value={q} onChange={(e) => setQ(e.target.value)} placeholder="For example: how do I import my old members?" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        <button disabled={busy} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">{busy ? 'Thinking…' : 'Ask'}</button>
      </form>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      {res && (
        <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          <p className="whitespace-pre-line">{res.answer}</p>
          <p className="mt-2 text-xs text-gray-400">
            {res.source === 'data' ? 'Worked out from your gym\'s own records.' : res.source === 'ai' ? `Written by AI from our help articles. ${res.remaining} AI answers left this month.` : 'Matching help articles.'}
            {res.note ? ` ${res.note}` : ''}
          </p>
        </div>
      )}
    </div>
  );
};

const Support = () => {
  const [tickets, setTickets] = useState([]);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = () => apiClient.get('/admin/support').then((r) => setTickets(r.data.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setMsg(''); setSaving(true);
    try {
      const res = await apiClient.post('/admin/support', { subject, description });
      setMsg(res.data.message);
      setSubject(''); setDescription('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Assistant />
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-800">Need help?</h2>
        <p className="mt-1 text-sm text-gray-500">
          Try the <a className="text-teal-600 underline" href="/help" target="_blank" rel="noreferrer">Help centre</a> first. If it does not answer your question, tell us below and we will reply by email.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What do you need help with?" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <textarea rows={4} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell us more (what you did, what you expected, what happened)" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {msg && <p className="text-sm text-green-700">{msg}</p>}
          <button disabled={saving} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">{saving ? 'Sending…' : 'Send to support'}</button>
        </form>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-800">Your requests</h2>
        {tickets.length === 0 ? <p className="mt-2 text-sm text-gray-500">Nothing yet.</p> : (
          <ul className="mt-3 divide-y divide-gray-100">
            {tickets.map((t) => (
              <li key={t._id} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{t.subject}</p>
                  <p className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
                <Badge tone={TONE[t.status] || 'gray'}>{LABEL[t.status] || t.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Support;
