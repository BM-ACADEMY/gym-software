import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, CalendarPlus, Check, Dumbbell, Package, Plus, Sparkles, UserX, X } from 'lucide-react';
import apiClient from '../../api/client';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import useSuspended from '../../hooks/useSuspended';

const STATUS_TONE = { scheduled: 'blue', completed: 'green', no_show: 'red', cancelled: 'gray' };
const emptyForm = { memberId: '', subAdminId: '', date: '', time: '', packagePurchaseId: '' };
const emptyRescheduleForm = { date: '', time: '' };
const emptyPackageForm = { name: '', sessionCount: '', price: '' };
const emptySellForm = { memberId: '', packageId: '', method: 'cash' };

const groupByDate = (sessions) => {
  const groups = {};
  sessions.forEach((s) => {
    const key = new Date(s.scheduledAt).toDateString();
    (groups[key] ||= []).push(s);
  });
  return groups;
};

const PTSessions = () => {
  const suspended = useSuspended();
  const [sessions, setSessions] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [members, setMembers] = useState([]);
  const [trainerFilter, setTrainerFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [packages, setPackages] = useState([]);
  const [memberPackages, setMemberPackages] = useState([]);
  const [packagesOpen, setPackagesOpen] = useState(false);
  const [packageForm, setPackageForm] = useState(emptyPackageForm);
  const [sellOpen, setSellOpen] = useState(false);
  const [sellForm, setSellForm] = useState(emptySellForm);
  const [savingPackage, setSavingPackage] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState(emptyRescheduleForm);
  const [rescheduling, setRescheduling] = useState(false);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const params = trainerFilter ? { subAdminId: trainerFilter } : {};
      const res = await apiClient.get('/admin/pt-sessions', { params });
      setSessions(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load PT sessions');
    } finally {
      setLoading(false);
    }
  };

  const fetchMeta = async () => {
    try {
      const [trainersRes, membersRes, packagesRes] = await Promise.all([
        apiClient.get('/admin/trainers'),
        apiClient.get('/admin/members', { params: { limit: 100 } }),
        apiClient.get('/admin/pt-sessions/packages'),
      ]);
      setTrainers(trainersRes.data.data);
      setMembers(membersRes.data.data.members);
      setPackages(packagesRes.data.data);
    } catch {
      // Dropdowns just stay empty.
    }
  };

  const fetchAllPackages = async () => {
    try {
      const res = await apiClient.get('/admin/pt-packages');
      setPackages(res.data.data);
    } catch {
      // stays as-is
    }
  };

  useEffect(() => { fetchMeta(); }, []);
  useEffect(() => { fetchSessions(); }, [trainerFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const openForm = () => { setForm(emptyForm); setSuggestions([]); setMemberPackages([]); setFormOpen(true); };

  const onFormMemberChange = async (memberId) => {
    setForm((f) => ({ ...f, memberId, packagePurchaseId: '' }));
    if (!memberId) { setMemberPackages([]); return; }
    try {
      const res = await apiClient.get('/admin/pt-sessions/member-packages', { params: { memberId } });
      setMemberPackages(res.data.data.filter((p) => p.sessionsRemaining > 0));
    } catch {
      setMemberPackages([]);
    }
  };

  const submitPackage = async (e) => {
    e.preventDefault();
    setSavingPackage(true);
    setError('');
    try {
      await apiClient.post('/admin/pt-packages', { name: packageForm.name, sessionCount: Number(packageForm.sessionCount), price: Number(packageForm.price) });
      setPackageForm(emptyPackageForm);
      await fetchAllPackages();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create package');
    } finally {
      setSavingPackage(false);
    }
  };

  const togglePackage = async (pkg) => {
    try {
      await apiClient.patch(`/admin/pt-packages/${pkg._id}/toggle`);
      await fetchAllPackages();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update package');
    }
  };

  const submitSell = async (e) => {
    e.preventDefault();
    setSavingPackage(true);
    setError('');
    try {
      await apiClient.post('/admin/pt-sessions/sell-package', sellForm);
      setSellOpen(false);
      setSellForm(emptySellForm);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to sell package');
    } finally {
      setSavingPackage(false);
    }
  };

  const fetchSuggestions = async () => {
    if (!form.memberId || !form.subAdminId) return;
    setSuggesting(true);
    try {
      const res = await apiClient.get('/admin/pt-sessions/suggest-slots', { params: { memberId: form.memberId, subAdminId: form.subAdminId } });
      setSuggestions(res.data.data);
    } catch {
      setSuggestions([]);
    } finally {
      setSuggesting(false);
    }
  };

  const applySuggestion = (iso) => {
    const d = new Date(iso);
    setForm((f) => ({ ...f, date: d.toISOString().slice(0, 10), time: d.toTimeString().slice(0, 5) }));
  };

  const submitBooking = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}`).toISOString();
      await apiClient.post('/admin/pt-sessions', { memberId: form.memberId, subAdminId: form.subAdminId, scheduledAt, packagePurchaseId: form.packagePurchaseId || undefined });
      setFormOpen(false);
      await fetchSessions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to book session');
    } finally {
      setSaving(false);
    }
  };

  const act = async (session, action) => {
    try {
      if (action === 'cancel') await apiClient.patch(`/admin/pt-sessions/${session._id}/cancel`);
      if (action === 'complete') await apiClient.patch(`/admin/pt-sessions/${session._id}/complete`);
      if (action === 'no-show') await apiClient.patch(`/admin/pt-sessions/${session._id}/no-show`);
      await fetchSessions();
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
      await apiClient.put(`/admin/pt-sessions/${rescheduleTarget._id}/reschedule`, { scheduledAt });
      setRescheduleTarget(null);
      await fetchSessions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reschedule session');
    } finally {
      setRescheduling(false);
    }
  };

  const grouped = groupByDate(sessions);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PT Sessions</h1>
          <p className="mt-1 text-gray-500">Book, reschedule, and track personal-training sessions.</p>
        </div>
        <div className="flex gap-2">
          <select value={trainerFilter} onChange={(e) => setTrainerFilter(e.target.value)} className="rounded-xl border border-gray-200 bg-white py-2.5 px-3.5 text-sm outline-none">
            <option value="">All trainers</option>
            {trainers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
          <button onClick={() => setPackagesOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <Package className="h-4 w-4" /> Packages
          </button>
          <button disabled={suspended} onClick={() => { setSellForm(emptySellForm); setSellOpen(true); }} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
            <Plus className="h-4 w-4" /> Sell package
          </button>
          <button disabled={suspended} onClick={openForm} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500">
            <CalendarPlus className="h-4 w-4" /> Book session
          </button>
        </div>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mt-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" /></div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-gray-400">
            <Dumbbell className="h-6 w-6" /><p className="text-sm">No PT sessions booked.</p>
          </div>
        ) : Object.entries(grouped).map(([date, list]) => (
          <div key={date}>
            <p className="mb-2 text-sm font-semibold text-gray-700">{new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-gray-100">
                  {list.map((s) => (
                    <tr key={s._id}>
                      <td className="w-20 px-5 py-4 font-semibold text-gray-900">{new Date(s.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-5 py-4 text-gray-900">{s.memberId?.name}</td>
                      <td className="px-5 py-4 text-gray-600">{s.subAdminId?.name}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Badge tone={STATUS_TONE[s.status]}>{s.status.replace('_', ' ')}</Badge>
                          {s.status === 'scheduled' && s.noShowPredicted && (
                            <span title="AI: this member has a history of no-shows" className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"><AlertTriangle className="h-3 w-3" />No-show risk</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {s.status === 'scheduled' && (
                          <div className="flex gap-1">
                            <button disabled={suspended} onClick={() => openReschedule(s)} title="Reschedule" className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"><CalendarClock className="h-4 w-4" /></button>
                            <button disabled={suspended} onClick={() => act(s, 'complete')} title="Mark completed" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"><Check className="h-4 w-4" /></button>
                            <button disabled={suspended} onClick={() => act(s, 'no-show')} title="Mark no-show" className="rounded-lg p-2 text-amber-600 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"><UserX className="h-4 w-4" /></button>
                            <button disabled={suspended} onClick={() => act(s, 'cancel')} title="Cancel" className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"><X className="h-4 w-4" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Book PT session" footer={
        <>
          <button onClick={() => setFormOpen(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="submit" form="pt-form" disabled={saving || suspended} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">{saving ? 'Booking...' : 'Book session'}</button>
        </>
      }>
        <form id="pt-form" onSubmit={submitBooking} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Member</label>
            <select required value={form.memberId} onChange={(e) => onFormMemberChange(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm">
              <option value="">Select member</option>
              {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </div>
          {form.memberId && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Bill this session against</label>
              <select value={form.packagePurchaseId} onChange={(e) => setForm({ ...form, packagePurchaseId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm">
                <option value="">Pay individually (via Payment)</option>
                {memberPackages.map((p) => (
                  <option key={p._id} value={p._id}>{p.packageName} — {p.sessionsRemaining} of {p.sessionsTotal} left</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Trainer</label>
            <select required value={form.subAdminId} onChange={(e) => setForm({ ...form, subAdminId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm">
              <option value="">Select trainer</option>
              {trainers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
              <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Time</label>
              <input required type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
            </div>
          </div>
          {form.memberId && form.subAdminId && (
            <div>
              <button type="button" onClick={fetchSuggestions} disabled={suggesting} className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-50">
                <Sparkles className="h-4 w-4" /> {suggesting ? 'Finding slots...' : 'Suggest optimal slots'}
              </button>
              {suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestions.map((s, i) => (
                    <button key={i} type="button" onClick={() => applySuggestion(s.scheduledAt)} className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100">
                      {new Date(s.scheduledAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>
      </Modal>

      <Modal open={!!rescheduleTarget} onClose={() => setRescheduleTarget(null)} title="Reschedule session" footer={
        <>
          <button onClick={() => setRescheduleTarget(null)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="submit" form="reschedule-form" disabled={rescheduling || suspended} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">{rescheduling ? 'Saving...' : 'Save new time'}</button>
        </>
      }>
        {rescheduleTarget && (
          <form id="reschedule-form" onSubmit={submitReschedule} className="space-y-4">
            <p className="text-sm text-gray-500">{rescheduleTarget.memberId?.name} with {rescheduleTarget.subAdminId?.name}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
                <input required type="date" value={rescheduleForm.date} onChange={(e) => setRescheduleForm({ ...rescheduleForm, date: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Time</label>
                <input required type="time" value={rescheduleForm.time} onChange={(e) => setRescheduleForm({ ...rescheduleForm, time: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
              </div>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={packagesOpen} onClose={() => setPackagesOpen(false)} title="PT packages">
        <div className="space-y-4">
          <form onSubmit={submitPackage} className="grid grid-cols-3 gap-2">
            <input required value={packageForm.name} onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })} placeholder="e.g. 10-session pack" className="col-span-3 rounded-lg border border-gray-200 px-3 py-2 text-sm sm:col-span-1" />
            <input required type="number" min="1" value={packageForm.sessionCount} onChange={(e) => setPackageForm({ ...packageForm, sessionCount: e.target.value })} placeholder="Sessions" className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <input required type="number" min="1" value={packageForm.price} onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })} placeholder="Price (₹)" className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <button type="submit" disabled={savingPackage || suspended} className="col-span-3 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">{savingPackage ? 'Saving...' : 'Add package'}</button>
          </form>
          <div className="space-y-2">
            {packages.length === 0 && <p className="text-sm text-gray-400">No packages created yet.</p>}
            {packages.map((p) => (
              <div key={p._id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.sessionCount} sessions · ₹{p.price.toLocaleString()}</p>
                </div>
                <button disabled={suspended} onClick={() => togglePackage(p)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${p.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>{p.isActive ? 'Active' : 'Inactive'}</button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal open={sellOpen} onClose={() => setSellOpen(false)} title="Sell PT package" footer={
        <>
          <button onClick={() => setSellOpen(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="submit" form="sell-form" disabled={savingPackage || suspended} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">{savingPackage ? 'Selling...' : 'Sell package'}</button>
        </>
      }>
        <form id="sell-form" onSubmit={submitSell} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Member</label>
            <select required value={sellForm.memberId} onChange={(e) => setSellForm({ ...sellForm, memberId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm">
              <option value="">Select member</option>
              {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Package</label>
            <select required value={sellForm.packageId} onChange={(e) => setSellForm({ ...sellForm, packageId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm">
              <option value="">Select package</option>
              {packages.filter((p) => p.isActive).map((p) => <option key={p._id} value={p._id}>{p.name} — ₹{p.price.toLocaleString()}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Payment method</label>
            <select value={sellForm.method} onChange={(e) => setSellForm({ ...sellForm, method: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm capitalize">
              {['cash', 'upi', 'card'].map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PTSessions;
