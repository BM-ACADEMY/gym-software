import { useEffect, useState, useCallback } from 'react';
import apiClient from '../../api/client';

const when = (d) => new Date(d).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const errText = (e, fallback) => e.response?.data?.message || fallback;

const Classes = () => {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', trainerName: '', startsAt: '', durationMin: 60, capacity: 20 });
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(null); // class id whose bookings are shown
  const [detail, setDetail] = useState(null);
  const [memberId, setMemberId] = useState('');
  const [members, setMembers] = useState([]);

  const load = useCallback(() => {
    apiClient.get('/admin/classes').then((r) => setList(r.data.data)).catch((e) => setError(errText(e, 'Could not load classes')));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiClient.get('/admin/members', { params: { limit: 100 } }).then((r) => {
      const d = r.data.data;
      setMembers(Array.isArray(d) ? d : d?.members || []);
    }).catch(() => setMembers([]));
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await apiClient.post('/admin/classes', { ...form, startsAt: new Date(form.startsAt).toISOString(), capacity: Number(form.capacity), durationMin: Number(form.durationMin) });
      setForm({ name: '', trainerName: '', startsAt: '', durationMin: 60, capacity: 20 });
      load();
    } catch (err) { setError(errText(err, 'Could not save the class')); }
    setSaving(false);
  };

  const show = async (id) => {
    if (open === id) { setOpen(null); return; }
    try {
      const r = await apiClient.get(`/admin/classes/${id}/bookings`);
      setDetail(r.data.data); setOpen(id);
    } catch (err) { setError(errText(err, 'Could not load bookings')); }
  };

  const act = async (fn, id) => {
    setError('');
    try { await fn(); load(); if (id) { const r = await apiClient.get(`/admin/classes/${id}/bookings`); setDetail(r.data.data); } }
    catch (err) { setError(errText(err, 'That did not work')); }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
        <p className="mt-1 text-gray-500">Members book a seat from their app. When a class is full they join a waitlist and are moved up automatically if someone cancels.</p>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={create} className="grid gap-3 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-2">
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Class name (e.g. Zumba)" maxLength={80} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <input value={form.trainerName} onChange={(e) => setForm({ ...form, trainerName: e.target.value })} placeholder="Trainer (optional)" maxLength={80} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <input required type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <label className="flex-1 text-xs text-gray-500">Seats
            <input required type="number" min="1" max="500" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex-1 text-xs text-gray-500">Minutes
            <input type="number" min="5" max="480" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="sm:col-span-2"><button disabled={saving} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Add class'}</button></div>
      </form>

      {!list ? <p className="text-sm text-gray-500">Loading…</p> : list.length === 0 ? <p className="text-sm text-gray-400">No upcoming classes yet.</p> : (
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c._id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{c.name} {c.status === 'cancelled' && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Cancelled</span>}</p>
                  <p className="text-xs text-gray-500">{when(c.startsAt)} · {c.durationMin} min{c.trainerName ? ` · ${c.trainerName}` : ''}</p>
                </div>
                <span className="text-sm text-gray-700">{c.bookedCount}/{c.capacity} booked{c.waitlistCount ? ` · ${c.waitlistCount} waiting` : ''}</span>
                <button onClick={() => show(c._id)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700">{open === c._id ? 'Hide' : 'Bookings'}</button>
                {c.status === 'scheduled' && (
                  <button onClick={() => window.confirm('Cancel this class and tell everyone booked?') && act(() => apiClient.patch(`/admin/classes/${c._id}/cancel`))} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">Cancel class</button>
                )}
              </div>
              {open === c._id && detail && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <ul className="divide-y divide-gray-100 text-sm">
                    {detail.bookings.length === 0 && <li className="py-2 text-gray-400">No bookings yet.</li>}
                    {detail.bookings.map((b) => (
                      <li key={b._id} className="flex items-center gap-2 py-2">
                        <span className="font-medium text-gray-800">{b.memberId?.name || 'Member'}</span>
                        <span className="text-xs text-gray-500">{b.memberId?.phone}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${b.status === 'booked' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{b.status === 'booked' ? 'Booked' : 'Waitlist'}</span>
                        <button onClick={() => act(() => apiClient.delete(`/admin/classes/${c._id}/bookings/${b._id}`), c._id)} className="ml-auto text-xs font-semibold text-red-600">Remove</button>
                      </li>
                    ))}
                  </ul>
                  {c.status === 'scheduled' && (
                    <div className="mt-3 flex gap-2">
                      <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm">
                        <option value="">Book a member…</option>
                        {members.map((m) => <option key={m._id} value={m._id}>{m.name} {m.phone ? `(${m.phone})` : ''}</option>)}
                      </select>
                      <button disabled={!memberId} onClick={() => act(() => apiClient.post(`/admin/classes/${c._id}/bookings`, { memberId }), c._id)} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Book</button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Classes;
