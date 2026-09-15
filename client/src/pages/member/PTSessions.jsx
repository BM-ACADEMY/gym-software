import { useEffect, useState } from 'react';
import { CalendarPlus, Dumbbell, X } from 'lucide-react';
import { Button, Card, Field, Modal, Page, PageHeader, Pill } from '../subadmin/ui';
import apiClient from '../../api/client';
import useSuspended from '../../hooks/useSuspended';

const STATUS_TONE = { scheduled: 'blue', completed: 'green', no_show: 'red', cancelled: 'gray' };

const PTSessions = () => {
  const suspended = useSuspended();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: '', time: '' });
  const [saving, setSaving] = useState(false);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/member/pt-sessions');
      setSessions(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load PT sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSessions(); }, []);

  const request = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}`).toISOString();
      await apiClient.post('/member/pt-sessions', { scheduledAt });
      setOpen(false); setForm({ date: '', time: '' });
      await fetchSessions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to request session');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (session) => {
    setError('');
    try {
      await apiClient.patch(`/member/pt-sessions/${session._id}/cancel`);
      await fetchSessions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel session');
    }
  };

  return (
    <Page>
      <PageHeader eyebrow="Customer workspace" title="PT sessions" description="Request slots with your trainer, cancel or reschedule ahead of time." actions={<Button onClick={() => setOpen(true)} disabled={suspended}><CalendarPlus className="h-4 w-4" />Request session</Button>} />
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card className="overflow-hidden">
        <div className="divide-y divide-gray-100">
          {loading ? (
            <p className="p-5 text-sm text-gray-400">Loading...</p>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-gray-400"><Dumbbell className="h-6 w-6" /><p className="text-sm">No PT sessions yet.</p></div>
          ) : sessions.map((s) => (
            <div key={s._id} className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-gray-50">
                <span className="text-[10px] font-bold uppercase text-gray-400">{new Date(s.scheduledAt).toLocaleDateString(undefined, { month: 'short' })}</span>
                <span className="font-bold text-gray-900">{new Date(s.scheduledAt).getDate()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{new Date(s.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="mt-1 text-xs text-gray-500">with {s.subAdminId?.name || 'your trainer'}</p>
              </div>
              <Pill tone={STATUS_TONE[s.status]}>{s.status.replace('_', ' ')}</Pill>
              {s.status === 'scheduled' && (
                <button onClick={() => cancel(s)} disabled={suspended} title="Cancel" className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"><X className="h-4 w-4" /></button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Modal open={open} title="Request PT session" onClose={() => setOpen(false)} footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={request} disabled={saving || suspended}>{saving ? 'Requesting...' : 'Request'}</Button></>}>
        <form onSubmit={request} className="grid grid-cols-2 gap-3">
          <Field label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Field label="Time" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        </form>
      </Modal>
    </Page>
  );
};

export default PTSessions;
