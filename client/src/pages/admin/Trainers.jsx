import { useEffect, useState } from 'react';
import { Dumbbell, Pencil, Users } from 'lucide-react';
import apiClient from '../../api/client';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import useSuspended from '../../hooks/useSuspended';

const editEmptyForm = { specialization: '', baseSalary: '', ptCommissionPercent: '' };

const Trainers = () => {
  const suspended = useSuspended();
  const [trainers, setTrainers] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(editEmptyForm);
  const [saving, setSaving] = useState(false);
  const [assignMemberId, setAssignMemberId] = useState('');
  const [assignTrainerId, setAssignTrainerId] = useState('');

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [trainersRes, membersRes] = await Promise.all([
        apiClient.get('/admin/trainers'),
        apiClient.get('/admin/members', { params: { limit: 100 } }),
      ]);
      setTrainers(trainersRes.data.data);
      setMembers(membersRes.data.data.members);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load trainers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openEdit = (trainer) => {
    setEditing(trainer);
    setEditForm({
      specialization: trainer.specialization || '',
      baseSalary: trainer.baseSalary ?? '',
      ptCommissionPercent: trainer.ptCommissionPercent ?? '',
    });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiClient.put(`/admin/trainers/${editing._id}`, editForm);
      setEditing(null);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update trainer');
    } finally {
      setSaving(false);
    }
  };

  const assignMember = async (e) => {
    e.preventDefault();
    if (!assignMemberId || !assignTrainerId) return;
    setError('');
    try {
      await apiClient.patch('/admin/trainers/assign', { memberId: assignMemberId, trainerId: assignTrainerId });
      setAssignMemberId(''); setAssignTrainerId('');
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign member');
    }
  };

  return (
    <div className="p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trainers</h1>
        <p className="mt-1 text-gray-500">Trainer directory — a subset of your staff tagged trainer-type in Staff Management.</p>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {trainers.length > 0 && (
        <form onSubmit={assignMember} className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex-1 min-w-48">
            <label className="mb-1 block text-xs font-medium text-gray-600">Member</label>
            <select value={assignMemberId} onChange={(e) => setAssignMemberId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <option value="">Select member</option>
              {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label className="mb-1 block text-xs font-medium text-gray-600">Assign to trainer</label>
            <select value={assignTrainerId} onChange={(e) => setAssignTrainerId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <option value="">Select trainer</option>
              {trainers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </div>
          <button type="submit" disabled={suspended} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40">Assign</button>
        </form>
      )}

      {loading ? (
        <div className="mt-8 flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" /></div>
      ) : trainers.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-gray-400">
          <Dumbbell className="h-6 w-6" />
          <p className="text-sm">No trainers yet — create a staff login with the "Trainer" template in Staff Management.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Specialization</th><th className="px-5 py-3">Base salary</th><th className="px-5 py-3">PT commission</th><th className="px-5 py-3">Members</th><th className="px-5 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trainers.map((t) => (
                <tr key={t._id}>
                  <td className="px-5 py-4 font-semibold text-gray-900">{t.name}</td>
                  <td className="px-5 py-4 text-gray-600">{t.specialization || '—'}</td>
                  <td className="px-5 py-4 text-gray-600">{t.baseSalary != null ? `₹${t.baseSalary.toLocaleString()}` : '—'}</td>
                  <td className="px-5 py-4 text-gray-600">{t.ptCommissionPercent != null ? `${t.ptCommissionPercent}%` : '—'}</td>
                  <td className="px-5 py-4"><Badge tone="blue"><Users className="mr-1 inline h-3 w-3" />{t.assignedMemberCount}</Badge></td>
                  <td className="px-5 py-4"><button onClick={() => openEdit(t)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Pencil className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit trainer — ${editing?.name || ''}`} footer={
        <>
          <button onClick={() => setEditing(null)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="submit" form="trainer-form" disabled={saving || suspended} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
        </>
      }>
        <form id="trainer-form" onSubmit={saveEdit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Specialization</label>
            <input value={editForm.specialization} onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })} placeholder="e.g. Strength & Conditioning" className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Base salary (₹)</label>
              <input type="number" min="0" value={editForm.baseSalary} onChange={(e) => setEditForm({ ...editForm, baseSalary: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">PT commission (%)</label>
              <input type="number" min="0" max="100" value={editForm.ptCommissionPercent} onChange={(e) => setEditForm({ ...editForm, ptCommissionPercent: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Trainers;
