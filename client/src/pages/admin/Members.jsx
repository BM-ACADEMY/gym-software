import { useEffect, useMemo, useState } from 'react';
import { Plus, QrCode, Search, X } from 'lucide-react';
import apiClient from '../../api/client';

const STATUS_TONES = {
  active: 'bg-emerald-50 text-emerald-700',
  expiring: 'bg-amber-50 text-amber-700',
  expired: 'bg-red-50 text-red-700',
  frozen: 'bg-blue-50 text-blue-700',
  trial: 'bg-violet-50 text-violet-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const StatusPill = ({ status }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_TONES[status] || 'bg-gray-100 text-gray-600'}`}>
    {status}
  </span>
);

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  gender: '',
  goal: '',
  medicalNotes: '',
  planId: '',
  assignedSubAdminId: '',
};

const Members = () => {
  const [members, setMembers] = useState([]);
  const [total, setTotal] = useState(0);
  const [plans, setPlans] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [qrMember, setQrMember] = useState(null);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiClient.get('/admin/members', { params: { search: search || undefined, status: status || undefined } });
      setMembers(res.data.data.members);
      setTotal(res.data.data.total);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const fetchMeta = async () => {
    try {
      const [plansRes, staffRes] = await Promise.all([
        apiClient.get('/admin/members/meta/plans'),
        apiClient.get('/admin/members/meta/staff'),
      ]);
      setPlans(plansRes.data.data);
      setStaff(staffRes.data.data);
    } catch {
      // Non-fatal — the member list itself still works without dropdown options.
    }
  };

  useEffect(() => { fetchMeta(); }, []);
  useEffect(() => {
    const timer = setTimeout(fetchMembers, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  const allSelected = members.length > 0 && selectedIds.length === members.length;
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : members.map((m) => m._id));
  const toggleSelect = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (member) => {
    setEditingId(member._id);
    setForm({
      name: member.name || '',
      phone: member.phone || '',
      email: member.email || '',
      gender: member.gender || '',
      goal: member.goal || '',
      medicalNotes: member.medicalNotes || '',
      planId: member.planId?._id || '',
      assignedSubAdminId: member.assignedSubAdminId?._id || '',
    });
    setFormOpen(true);
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await apiClient.put(`/admin/members/${editingId}`, form);
      } else {
        await apiClient.post('/admin/members', form);
      }
      setFormOpen(false);
      await fetchMembers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save member');
    } finally {
      setSaving(false);
    }
  };

  const applyBulkStatus = async (newStatus) => {
    if (!selectedIds.length) return;
    try {
      await apiClient.patch('/admin/members/bulk-status', { ids: selectedIds, status: newStatus });
      setSelectedIds([]);
      await fetchMembers();
    } catch (err) {
      setError(err.response?.data?.message || 'Bulk update failed');
    }
  };

  const openQr = async (member) => {
    try {
      const res = await apiClient.get(`/admin/members/${member._id}`);
      setQrMember(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load QR code');
    }
  };

  const planOptions = useMemo(() => plans.map((p) => ({ value: p._id, label: `${p.name} — ₹${p.price} / ${p.durationDays}d` })), [plans]);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="mt-1 text-gray-500">{total} member{total === 1 ? '' : 's'} in your gym.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700">
          <Plus className="h-4 w-4" /> Add member
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or phone..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-gray-200 bg-white py-2.5 px-3.5 text-sm outline-none">
          <option value="">All statuses</option>
          {['trial', 'active', 'expiring', 'expired', 'frozen', 'cancelled'].map((s) => (
            <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">{selectedIds.length} selected</span>
            <button onClick={() => applyBulkStatus('frozen')} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50">Freeze</button>
            <button onClick={() => applyBulkStatus('cancelled')} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          </div>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} /></th>
                <th className="px-5 py-3">Member</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Assigned staff</th>
                <th className="px-5 py-3">Expires</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">Loading...</td></tr>
              ) : members.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">No members found.</td></tr>
              ) : members.map((m) => (
                <tr key={m._id} className="hover:bg-gray-50">
                  <td className="px-5 py-4"><input type="checkbox" checked={selectedIds.includes(m._id)} onChange={() => toggleSelect(m._id)} /></td>
                  <td className="px-5 py-4">
                    <button onClick={() => openEdit(m)} className="font-semibold text-gray-900 hover:text-teal-700">{m.name}</button>
                    <p className="text-xs text-gray-500">{m.phone}</p>
                  </td>
                  <td className="px-5 py-4 text-gray-600">{m.planId?.name || '—'}</td>
                  <td className="px-5 py-4 text-gray-600">{m.assignedSubAdminId?.name || '—'}</td>
                  <td className="px-5 py-4 text-gray-600">{m.expiresAt ? new Date(m.expiresAt).toLocaleDateString() : '—'}</td>
                  <td className="px-5 py-4"><StatusPill status={m.effectiveStatus} /></td>
                  <td className="px-5 py-4">
                    <button onClick={() => openQr(m)} title="Show QR / ID card" className="rounded-lg p-2 hover:bg-gray-100"><QrCode className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4" onMouseDown={() => setFormOpen(false)}>
          <form onSubmit={submitForm} onMouseDown={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-lg font-bold">{editingId ? 'Edit member' : 'Add member'}</h3>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-5">
              <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">Name</span>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">Phone</span>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
                </label>
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">Email</span>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">Gender</span>
                  <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none">
                    <option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                  </select>
                </label>
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">Goal</span>
                  <input value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="e.g. Fat loss" className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
                </label>
              </div>
              <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">Medical notes</span>
                <textarea value={form.medicalNotes} onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })} rows={2} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">Plan</span>
                  <select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none">
                    <option value="">No plan</option>
                    {planOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </label>
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">Assigned staff</span>
                  <select value={form.assignedSubAdminId} onChange={(e) => setForm({ ...form, assignedSubAdminId: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none">
                    <option value="">Unassigned</option>
                    {staff.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}

      {qrMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4" onMouseDown={() => setQrMember(null)}>
          <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">{qrMember.name}</h3>
            <p className="text-xs text-gray-500">Scan at entrance to check in</p>
            <img src={qrMember.qrCode} alt="Member check-in QR code" className="mx-auto mt-4 h-48 w-48" />
            <button onClick={() => setQrMember(null)} className="mt-4 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Members;
