import { useEffect, useState, useCallback } from 'react';
import apiClient from '../../api/client';

const when = (d) => new Date(d).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const Classes = () => {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    apiClient.get('/member/classes').then((r) => setList(r.data.data)).catch((e) => setError(e.response?.data?.message || 'Could not load classes'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (id, fn) => {
    setBusy(id); setError('');
    try { await fn(); load(); } catch (e) { setError(e.response?.data?.message || 'That did not work'); }
    setBusy('');
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
        <p className="mt-1 text-gray-500">Book a seat. If a class is full, join the waitlist and we move you up if someone cancels.</p>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!list ? <p className="text-sm text-gray-500">Loading…</p> : list.length === 0 ? <p className="text-sm text-gray-400">No upcoming classes.</p> : (
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-500">{when(c.startsAt)} · {c.durationMin} min{c.trainerName ? ` · ${c.trainerName}` : ''}</p>
                <p className="mt-1 text-xs text-gray-600">{c.seatsLeft > 0 ? `${c.seatsLeft} seats left` : 'Full'}</p>
              </div>
              {c.myBooking ? (
                <>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${c.myBooking.status === 'booked' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{c.myBooking.status === 'booked' ? 'Booked' : 'On waitlist'}</span>
                  <button disabled={busy === c._id} onClick={() => run(c._id, () => apiClient.delete(`/member/classes/bookings/${c.myBooking._id}`))} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50">Cancel</button>
                </>
              ) : (
                <button disabled={busy === c._id} onClick={() => run(c._id, () => apiClient.post(`/member/classes/${c._id}/book`))} className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{c.seatsLeft > 0 ? 'Book' : 'Join waitlist'}</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Classes;
