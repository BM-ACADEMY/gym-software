import { useEffect, useState } from 'react';
import { Inbox, Send } from 'lucide-react';
import apiClient from '../../api/client';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';

const STATUS_TONE = { open: 'red', in_progress: 'amber', resolved: 'green' };
const STATUSES = ['open', 'in_progress', 'resolved'];

const Support = () => {
  const [tickets, setTickets] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/root-admin/support', { params: statusFilter ? { status: statusFilter } : {} });
      setTickets(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTickets(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const setStatus = async (ticket, status) => {
    try {
      await apiClient.patch(`/root-admin/support/${ticket._id}/status`, { status });
      const updated = await apiClient.get('/root-admin/support', { params: statusFilter ? { status: statusFilter } : {} });
      setTickets(updated.data.data);
      if (active?._id === ticket._id) setActive({ ...ticket, status });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    }
  };

  const addNote = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    try {
      const res = await apiClient.post(`/root-admin/support/${active._id}/notes`, { note });
      setActive(res.data.data);
      setNote('');
      await fetchTickets();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support / Tickets</h1>
          <p className="mt-1 text-gray-500">Issues raised by gym owners.</p>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mt-6 flex gap-2">
          <button onClick={() => setStatusFilter('')} className={`rounded-full px-3 py-1.5 text-sm font-medium ${!statusFilter ? 'bg-teal-600 text-white' : 'border border-gray-200 text-gray-600'}`}>All</button>
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize ${statusFilter === s ? 'bg-teal-600 text-white' : 'border border-gray-200 text-gray-600'}`}>{s.replace('_', ' ')}</button>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="divide-y divide-gray-100">
            {loading ? (
              <p className="p-8 text-center text-sm text-gray-400">Loading...</p>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-16 text-gray-400"><Inbox className="h-6 w-6" /><p className="text-sm">No tickets.</p></div>
            ) : tickets.map((t) => (
              <button key={t._id} onClick={() => setActive(t)} className="flex w-full items-center gap-4 p-5 text-left hover:bg-gray-50">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{t.subject}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{t.subscriberId?.gymName} · {t.raisedByAdminId?.name} · {new Date(t.createdAt).toLocaleDateString()}</p>
                </div>
                <Badge tone={STATUS_TONE[t.status]}>{t.status.replace('_', ' ')}</Badge>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Modal open={!!active} onClose={() => setActive(null)} title={active?.subject || ''} maxWidth="max-w-2xl">
        {active && (
          <div className="space-y-5">
            <div>
              <p className="text-xs text-gray-500">{active.subscriberId?.gymName} · raised by {active.raisedByAdminId?.name}</p>
              <p className="mt-2 text-sm text-gray-700">{active.description || 'No description provided.'}</p>
            </div>
            <div className="flex gap-2">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => setStatus(active, s)} className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${active.status === s ? 'bg-teal-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{s.replace('_', ' ')}</button>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Internal notes</p>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {active.internalNotes?.length ? active.internalNotes.map((n, i) => (
                  <div key={i} className="rounded-lg bg-gray-50 p-3 text-sm">
                    <p className="text-gray-700">{n.note}</p>
                    <p className="mt-1 text-xs text-gray-400">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                )) : <p className="text-sm text-gray-400">No notes yet.</p>}
              </div>
              <form onSubmit={addNote} className="mt-3 flex gap-2">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note..." className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"><Send className="h-3.5 w-3.5" />Add</button>
              </form>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Support;
