import { useEffect, useState } from 'react';
import { AlertTriangle, Plus, UserCheck } from 'lucide-react';
import apiClient from '../../api/client';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import useSuspended from '../../hooks/useSuspended';

const STATUS_TONE = { booked: 'blue', attended: 'amber', converted: 'green', lost: 'gray' };
const STATUSES = ['booked', 'attended', 'converted', 'lost'];
const emptyForm = { name: '', phone: '', preferredDate: '', assignedSubAdminId: '' };

const Trial = () => {
  const suspended = useSuspended();
  const [trials, setTrials] = useState([]);
  const [staff, setStaff] = useState([]);
  const [plans, setPlans] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [convertTarget, setConvertTarget] = useState(null);
  const [convertPlanId, setConvertPlanId] = useState('');

  const fetchTrials = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/trial', { params: statusFilter ? { status: statusFilter } : {} });
      setTrials(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load trial leads');
    } finally {
      setLoading(false);
    }
  };

  const fetchMeta = async () => {
    try {
      const [staffRes, plansRes] = await Promise.all([
        apiClient.get('/admin/members/meta/staff'),
        apiClient.get('/admin/members/meta/plans'),
      ]);
      setStaff(staffRes.data.data);
      setPlans(plansRes.data.data);
    } catch {
      // Dropdowns stay empty.
    }
  };

  useEffect(() => { fetchMeta(); }, []);
  useEffect(() => { fetchTrials(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitForm = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/admin/trial', { ...form, assignedSubAdminId: form.assignedSubAdminId || undefined, preferredDate: form.preferredDate || undefined });
      setForm(emptyForm); setFormOpen(false);
      await fetchTrials();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add lead');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (trial, status) => {
    try {
      await apiClient.put(`/admin/trial/${trial._id}`, { status });
      await fetchTrials();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update lead');
    }
  };

  const submitConvert = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiClient.patch(`/admin/trial/${convertTarget._id}/convert`, { planId: convertPlanId || undefined });
      setConvertTarget(null); setConvertPlanId('');
      await fetchTrials();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to convert lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trial</h1>
          <p className="mt-1 text-gray-500">Manage free-trial leads through to conversion.</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setFormOpen(true); }} disabled={suspended} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500">
          <Plus className="h-4 w-4" /> Add lead
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mt-6 flex gap-2">
        <button onClick={() => setStatusFilter('')} className={`rounded-full px-3 py-1.5 text-sm font-medium ${!statusFilter ? 'bg-teal-600 text-white' : 'border border-gray-200 text-gray-600'}`}>All</button>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize ${statusFilter === s ? 'bg-teal-600 text-white' : 'border border-gray-200 text-gray-600'}`}>{s}</button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Phone</th><th className="px-5 py-3">Preferred date</th><th className="px-5 py-3">Assigned to</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Loading...</td></tr>
            ) : trials.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No trial leads found.</td></tr>
            ) : trials.map((t) => (
              <tr key={t._id}>
                <td className="px-5 py-4 font-semibold text-gray-900">{t.name}</td>
                <td className="px-5 py-4 text-gray-600">{t.phone}</td>
                <td className="px-5 py-4 text-gray-600">{t.preferredDate ? new Date(t.preferredDate).toLocaleDateString() : '—'}</td>
                <td className="px-5 py-4 text-gray-600">{t.assignedSubAdminId?.name || '—'}</td>
                <td className="px-5 py-4">
                  <Badge tone={STATUS_TONE[t.status]}>
                    {t.lapsingSoon && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                    {t.status}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  {['booked', 'attended'].includes(t.status) && (
                    <div className="flex flex-wrap gap-1">
                      {t.status === 'booked' && <button onClick={() => setStatus(t, 'attended')} disabled={suspended} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">Mark attended</button>}
                      <button onClick={() => { setConvertTarget(t); setConvertPlanId(''); }} disabled={suspended} className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-40"><UserCheck className="h-3 w-3" />Convert</button>
                      <button onClick={() => setStatus(t, 'lost')} disabled={suspended} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">Mark lost</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add trial lead" footer={
        <>
          <button onClick={() => setFormOpen(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="submit" form="trial-form" disabled={saving || suspended} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">{saving ? 'Saving...' : 'Add lead'}</button>
        </>
      }>
        <form id="trial-form" onSubmit={submitForm} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
            <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Preferred date</label>
              <input type="date" value={form.preferredDate} onChange={(e) => setForm({ ...form, preferredDate: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Assign to staff</label>
              <select value={form.assignedSubAdminId} onChange={(e) => setForm({ ...form, assignedSubAdminId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm">
                <option value="">Unassigned</option>
                {staff.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </form>
      </Modal>

      <Modal open={!!convertTarget} onClose={() => setConvertTarget(null)} title={`Convert ${convertTarget?.name || ''} to a member`} footer={
        <>
          <button onClick={() => setConvertTarget(null)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="submit" form="convert-form" disabled={saving || suspended} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">{saving ? 'Converting...' : 'Convert'}</button>
        </>
      }>
        <form id="convert-form" onSubmit={submitConvert} className="space-y-4">
          <p className="text-sm text-gray-500">Optionally start them on a paid plan now, or leave unset to add them as a trial member without a plan yet.</p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Plan (optional)</label>
            <select value={convertPlanId} onChange={(e) => setConvertPlanId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm">
              <option value="">No plan yet</option>
              {plans.map((p) => <option key={p._id} value={p._id}>{p.name} — ₹{p.price}</option>)}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Trial;
