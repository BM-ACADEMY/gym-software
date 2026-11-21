import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { CalendarClock, CalendarPlus, Check, Dumbbell, Plus, UserX, X } from 'lucide-react';
import { Button, Card, Field, Modal, Page, PageHeader, Pill } from './ui';
import apiClient from '../../api/client';
import { selectCurrentUser, selectPermissions } from '../../store/slices/authSlice';
import useSuspended from '../../hooks/useSuspended';

const STATUS_TONE = { scheduled: 'blue', completed: 'green', no_show: 'red', cancelled: 'gray' };
const emptyForm = { memberId: '', date: '', time: '', packagePurchaseId: '' };
const emptySellForm = { memberId: '', packageId: '', method: 'cash' };
const emptyRescheduleForm = { date: '', time: '' };

const groupByDate = (sessions) => {
  const groups = {};
  sessions.forEach((s) => {
    const key = new Date(s.scheduledAt).toDateString();
    (groups[key] ||= []).push(s);
  });
  return groups;
};

const PTSessions = () => {
  const permissions = useSelector(selectPermissions);
  const user = useSelector(selectCurrentUser);
  const canEdit = Boolean(permissions?.['pt-sessions']?.edit);
  const suspended = useSuspended();

  const [sessions, setSessions] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState([]);
  const [memberPackages, setMemberPackages] = useState([]);
  const [sellOpen, setSellOpen] = useState(false);
  const [sellForm, setSellForm] = useState(emptySellForm);
  const [selling, setSelling] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState(emptyRescheduleForm);
  const [rescheduling, setRescheduling] = useState(false);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [sessionsRes, membersRes, packagesRes] = await Promise.all([
        apiClient.get('/subadmin/pt-sessions'),
        apiClient.get('/subadmin/members'),
        apiClient.get('/subadmin/pt-sessions/packages'),
      ]);
      setSessions(sessionsRes.data.data);
      setMembers(membersRes.data.data.members);
      setPackages(packagesRes.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load PT sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const onMemberChange = async (memberId) => {
    setForm((f) => ({ ...f, memberId, packagePurchaseId: '' }));
    if (!memberId) { setMemberPackages([]); return; }
    try {
      const res = await apiClient.get('/subadmin/pt-sessions/member-packages', { params: { memberId } });
      setMemberPackages(res.data.data.filter((p) => p.sessionsRemaining > 0));
    } catch {
      setMemberPackages([]);
    }
  };

  const book = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}`).toISOString();
      await apiClient.post('/subadmin/pt-sessions', { memberId: form.memberId, subAdminId: user.id, scheduledAt, packagePurchaseId: form.packagePurchaseId || undefined });
      setOpen(false); setForm(emptyForm);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to book session');
    } finally {
      setSaving(false);
    }
  };

  const sellPackage = async (e) => {
    e.preventDefault();
    setSelling(true);
    setError('');
    try {
      await apiClient.post('/subadmin/pt-sessions/sell-package', sellForm);
      setSellOpen(false); setSellForm(emptySellForm);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to sell package');
    } finally {
      setSelling(false);
    }
  };

  const act = async (session, action) => {
    try {
      if (action === 'cancel') await apiClient.patch(`/subadmin/pt-sessions/${session._id}/cancel`);
      if (action === 'complete') await apiClient.patch(`/subadmin/pt-sessions/${session._id}/complete`);
      if (action === 'no-show') await apiClient.patch(`/subadmin/pt-sessions/${session._id}/no-show`);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed');
    }
  };

  const openReschedule = (session) => {
    const d = new Date(session.scheduledAt);
    setRescheduleTarget(session);
    setRescheduleForm({ date: d.toISOString().slice(0, 10), time: d.toTimeString().slice(0, 5) });
  };

  const submitReschedule = async (e) => {
    e.preventDefault();
    setRescheduling(true);
    setError('');
    try {
      const scheduledAt = new Date(`${rescheduleForm.date}T${rescheduleForm.time}`).toISOString();
      await apiClient.put(`/subadmin/pt-sessions/${rescheduleTarget._id}/reschedule`, { scheduledAt });
      setRescheduleTarget(null);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reschedule session');
    } finally {
      setRescheduling(false);
    }
  };

  const grouped = groupByDate(sessions);

  return (
    <Page>
      <PageHeader title="PT sessions" description="Your own personal-training calendar." actions={canEdit ? (
        <div className="flex gap-2">
          <Button variant="secondary" disabled={suspended} onClick={() => { setSellForm(emptySellForm); setSellOpen(true); }}><Plus className="h-4 w-4" />Sell package</Button>
          <Button disabled={suspended} onClick={() => { setForm(emptyForm); setMemberPackages([]); setOpen(true); }}><CalendarPlus className="h-4 w-4" />Book session</Button>
        </div>
      ) : null} />
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-gray-400"><Dumbbell className="h-6 w-6" /><p className="text-sm">No sessions on your calendar.</p></Card>
      ) : Object.entries(grouped).map(([date, list]) => (
        <div key={date}>
          <p className="mb-2 text-sm font-semibold text-gray-700">{new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          <Card className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-gray-100">
                {list.map((s) => (
                  <tr key={s._id}>
                    <td className="w-20 px-5 py-4 font-semibold text-gray-900">{new Date(s.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-5 py-4 text-gray-900">{s.memberId?.name}</td>
                    <td className="px-5 py-4"><Pill tone={STATUS_TONE[s.status]}>{s.status.replace('_', ' ')}</Pill></td>
                    <td className="px-5 py-4">
                      {canEdit && s.status === 'scheduled' && (
                        <div className="flex gap-1">
                          <button onClick={() => openReschedule(s)} disabled={suspended} title="Reschedule" className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"><CalendarClock className="h-4 w-4" /></button>
                          <button onClick={() => act(s, 'complete')} disabled={suspended} title="Mark completed" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"><Check className="h-4 w-4" /></button>
                          <button onClick={() => act(s, 'no-show')} disabled={suspended} title="Mark no-show" className="rounded-lg p-2 text-amber-600 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"><UserX className="h-4 w-4" /></button>
                          <button onClick={() => act(s, 'cancel')} disabled={suspended} title="Cancel" className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"><X className="h-4 w-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      ))}

      <Modal open={open} title="Book PT session" onClose={() => setOpen(false)} footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={book} disabled={saving || suspended}>{saving ? 'Booking...' : 'Schedule'}</Button></>}>
        <form onSubmit={book} className="space-y-4">
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">Member</span>
            <select required value={form.memberId} onChange={(e) => onMemberChange(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none">
              <option value="">Select member</option>
              {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </label>
          {form.memberId && (
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">Bill this session against</span>
              <select value={form.packagePurchaseId} onChange={(e) => setForm({ ...form, packagePurchaseId: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none">
                <option value="">Pay individually (via Payment)</option>
                {memberPackages.map((p) => (
                  <option key={p._id} value={p._id}>{p.packageName} — {p.sessionsRemaining} of {p.sessionsTotal} left</option>
                ))}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Field label="Time" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </div>
        </form>
      </Modal>

      <Modal open={!!rescheduleTarget} title="Reschedule session" onClose={() => setRescheduleTarget(null)} footer={<><Button variant="secondary" onClick={() => setRescheduleTarget(null)}>Cancel</Button><Button onClick={submitReschedule} disabled={rescheduling || suspended}>{rescheduling ? 'Saving...' : 'Save new time'}</Button></>}>
        {rescheduleTarget && (
          <form onSubmit={submitReschedule} className="space-y-4">
            <p className="text-sm text-gray-500">{rescheduleTarget.memberId?.name}</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" type="date" value={rescheduleForm.date} onChange={(e) => setRescheduleForm({ ...rescheduleForm, date: e.target.value })} />
              <Field label="Time" type="time" value={rescheduleForm.time} onChange={(e) => setRescheduleForm({ ...rescheduleForm, time: e.target.value })} />
            </div>
          </form>
        )}
      </Modal>

      <Modal open={sellOpen} title="Sell PT package" onClose={() => setSellOpen(false)} footer={<><Button variant="secondary" onClick={() => setSellOpen(false)}>Cancel</Button><Button onClick={sellPackage} disabled={selling || suspended}>{selling ? 'Selling...' : 'Sell'}</Button></>}>
        <form onSubmit={sellPackage} className="space-y-4">
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">Member</span>
            <select required value={sellForm.memberId} onChange={(e) => setSellForm({ ...sellForm, memberId: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none">
              <option value="">Select member</option>
              {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">Package</span>
            <select required value={sellForm.packageId} onChange={(e) => setSellForm({ ...sellForm, packageId: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none">
              <option value="">Select package</option>
              {packages.map((p) => <option key={p._id} value={p._id}>{p.name} — ₹{p.price.toLocaleString()}</option>)}
            </select>
          </label>
        </form>
      </Modal>
    </Page>
  );
};
export default PTSessions;
