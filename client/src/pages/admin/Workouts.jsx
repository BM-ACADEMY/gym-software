import { useEffect, useState } from 'react';
import { Dumbbell, Pencil, Plus, Users } from 'lucide-react';
import apiClient from '../../api/client';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import useSuspended from '../../hooks/useSuspended';

const LEVELS = ['beginner', 'intermediate', 'advanced'];
const emptyTemplateForm = { name: '', level: 'beginner', daysPerWeek: 3, focus: '', notes: '' };

const Workouts = () => {
  const suspended = useSuspended();
  const [templates, setTemplates] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [saving, setSaving] = useState(false);

  const [assignMemberId, setAssignMemberId] = useState('');
  const [assignTemplateId, setAssignTemplateId] = useState('');
  const [currentWorkout, setCurrentWorkout] = useState(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [templatesRes, membersRes] = await Promise.all([
        apiClient.get('/admin/workouts/templates'),
        apiClient.get('/admin/members', { params: { limit: 100 } }),
      ]);
      setTemplates(templatesRes.data.data);
      setMembers(membersRes.data.data.members);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load workouts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreateTemplate = () => { setEditingTemplate(null); setTemplateForm(emptyTemplateForm); setTemplateModalOpen(true); };
  const openEditTemplate = (t) => {
    setEditingTemplate(t);
    setTemplateForm({ name: t.name, level: t.level, daysPerWeek: t.daysPerWeek, focus: t.focus || '', notes: t.planData?.notes || '' });
    setTemplateModalOpen(true);
  };

  const saveTemplate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { name: templateForm.name, level: templateForm.level, daysPerWeek: Number(templateForm.daysPerWeek), focus: templateForm.focus, planData: { notes: templateForm.notes } };
      if (editingTemplate) {
        await apiClient.put(`/admin/workouts/templates/${editingTemplate._id}`, payload);
      } else {
        await apiClient.post('/admin/workouts/templates', payload);
      }
      setTemplateModalOpen(false);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const assign = async (e) => {
    e.preventDefault();
    if (!assignMemberId || !assignTemplateId) return;
    setError('');
    try {
      const res = await apiClient.put(`/admin/workouts/member/${assignMemberId}`, { templateId: assignTemplateId });
      setCurrentWorkout(res.data.data);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign workout');
    }
  };

  const viewMemberWorkout = async (memberId) => {
    if (!memberId) { setCurrentWorkout(null); return; }
    try {
      const res = await apiClient.get(`/admin/workouts/member/${memberId}`);
      setCurrentWorkout(res.data.data);
    } catch {
      setCurrentWorkout(null);
    }
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workouts</h1>
          <p className="mt-1 text-gray-500">Build reusable workout templates and assign them to members.</p>
        </div>
        <button onClick={openCreateTemplate} disabled={suspended} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500">
          <Plus className="h-4 w-4" /> Create template
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={assign} className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="min-w-48 flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-600">Member</label>
          <select value={assignMemberId} onChange={(e) => { setAssignMemberId(e.target.value); viewMemberWorkout(e.target.value); }} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="">Select member</option>
            {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-600">Assign template</label>
          <select value={assignTemplateId} onChange={(e) => setAssignTemplateId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="">Select template</option>
            {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </div>
        <button type="submit" disabled={suspended} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40">Assign</button>
        {currentWorkout && (
          <p className="w-full text-xs text-gray-500">Currently assigned: <b>{currentWorkout.templateId?.name || 'Custom plan'}</b></p>
        )}
        {assignMemberId && !currentWorkout && <p className="w-full text-xs text-gray-400">No workout assigned yet.</p>}
      </form>

      {loading ? (
        <div className="mt-8 flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" /></div>
      ) : templates.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-gray-400">
          <Dumbbell className="h-6 w-6" /><p className="text-sm">No workout templates yet.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <div key={t._id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="bg-gradient-to-br from-gray-900 to-teal-900 p-5 text-white">
                <div className="flex items-start justify-between">
                  <div className="rounded-xl bg-white/10 p-2"><Dumbbell className="h-5 w-5" /></div>
                  <button onClick={() => openEditTemplate(t)} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"><Pencil className="h-4 w-4" /></button>
                </div>
                <h3 className="mt-6 text-lg font-bold">{t.name}</h3>
                <p className="mt-1 text-sm text-teal-100">{t.focus || 'General fitness'}</p>
              </div>
              <div className="p-5">
                <div className="flex gap-2"><Badge tone="blue">{t.level}</Badge><Badge>{t.daysPerWeek} days/week</Badge></div>
                <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
                  <span className="flex items-center gap-2 text-sm text-gray-500"><Users className="h-4 w-4" />{t.assignedMemberCount} members</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} title={editingTemplate ? 'Edit template' : 'Create workout template'} footer={
        <>
          <button onClick={() => setTemplateModalOpen(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="submit" form="template-form" disabled={saving || suspended} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
        </>
      }>
        <form id="template-form" onSubmit={saveTemplate} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Plan name</label>
            <input required value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="e.g. 12-week transformation" className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Level</label>
              <select value={templateForm.level} onChange={(e) => setTemplateForm({ ...templateForm, level: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm capitalize">
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Days per week</label>
              <input type="number" min="1" max="7" value={templateForm.daysPerWeek} onChange={(e) => setTemplateForm({ ...templateForm, daysPerWeek: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Primary focus</label>
            <input value={templateForm.focus} onChange={(e) => setTemplateForm({ ...templateForm, focus: e.target.value })} placeholder="Strength, mobility, fat loss..." className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Routine notes</label>
            <textarea rows={4} value={templateForm.notes} onChange={(e) => setTemplateForm({ ...templateForm, notes: e.target.value })} placeholder="Day-by-day exercises..." className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Workouts;
