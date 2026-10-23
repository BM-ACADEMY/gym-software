import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Dumbbell, ListChecks, Plus, Trash2, Users } from 'lucide-react';
import { Button, Card, Field, Modal, Page, PageHeader, Pill, SearchBox } from './ui';
import apiClient from '../../api/client';
import { selectPermissions } from '../../store/slices/authSlice';
import useSuspended from '../../hooks/useSuspended';

const emptyForm = { name: '', level: 'beginner', daysPerWeek: 3, focus: '' };
const emptyExercise = { name: '', sets: 3, reps: '8-12' };
const emptyDay = () => ({ day: '', focus: '', exercises: [{ ...emptyExercise }] });

const Workout = () => {
  const permissions = useSelector(selectPermissions);
  const canEdit = Boolean(permissions?.workout?.edit);
  const suspended = useSuspended();

  const [q, setQ] = useState('');
  const [templates, setTemplates] = useState([]);
  const [members, setMembers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [assignMemberId, setAssignMemberId] = useState('');
  const [assignTemplateId, setAssignTemplateId] = useState('');
  const [editorMemberId, setEditorMemberId] = useState('');
  const [editorDays, setEditorDays] = useState([]);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);

  const fetchAll = async () => {
    try {
      const [templatesRes, membersRes] = await Promise.all([
        apiClient.get('/subadmin/workouts/templates'),
        apiClient.get('/subadmin/members'),
      ]);
      setTemplates(templatesRes.data.data);
      setMembers(membersRes.data.data.members);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load workouts');
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const create = async () => {
    if (!form.name) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/subadmin/workouts/templates', form);
      setForm(emptyForm); setOpen(false);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  const assign = async () => {
    if (!assignMemberId || !assignTemplateId) return;
    setError('');
    try {
      await apiClient.put(`/subadmin/workouts/member/${assignMemberId}`, { templateId: assignTemplateId });
      setAssignMemberId(''); setAssignTemplateId('');
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign workout');
    }
  };

  const filtered = templates.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));

  const openEditor = async (memberId) => {
    setEditorMemberId(memberId);
    setEditorLoading(true);
    setError('');
    try {
      const res = await apiClient.get(`/subadmin/workouts/member/${memberId}`);
      const days = res.data.data?.planData?.days;
      setEditorDays(Array.isArray(days) && days.length > 0 ? days : [emptyDay()]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load member workout');
      setEditorDays([emptyDay()]);
    } finally {
      setEditorLoading(false);
    }
  };

  const updateDay = (dayIndex, patch) => {
    setEditorDays((days) => days.map((d, i) => (i === dayIndex ? { ...d, ...patch } : d)));
  };
  const updateExercise = (dayIndex, exIndex, patch) => {
    setEditorDays((days) => days.map((d, i) => (i !== dayIndex ? d : { ...d, exercises: d.exercises.map((ex, j) => (j === exIndex ? { ...ex, ...patch } : ex)) })));
  };
  const addExercise = (dayIndex) => updateDay(dayIndex, { exercises: [...editorDays[dayIndex].exercises, { ...emptyExercise }] });
  const removeExercise = (dayIndex, exIndex) => updateDay(dayIndex, { exercises: editorDays[dayIndex].exercises.filter((_, j) => j !== exIndex) });
  const addDay = () => setEditorDays((days) => [...days, { ...emptyDay(), day: `Day ${days.length + 1}` }]);
  const removeDay = (dayIndex) => setEditorDays((days) => days.filter((_, i) => i !== dayIndex));

  const saveEditorPlan = async () => {
    setEditorSaving(true);
    setError('');
    try {
      await apiClient.put(`/subadmin/workouts/member/${editorMemberId}`, { planData: { days: editorDays } });
      setEditorMemberId('');
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save member workout');
    } finally {
      setEditorSaving(false);
    }
  };

  return (
    <Page>
      <PageHeader title="Workout plans" description="Build reusable programs and assign them to your members." actions={canEdit ? <Button onClick={() => setOpen(true)} disabled={suspended}><Plus className="h-4 w-4" />Create workout</Button> : null} />
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {canEdit && (
        <Card className="flex flex-wrap items-end gap-3 p-4">
          <label className="min-w-40 flex-1"><span className="mb-1 block text-xs font-medium text-gray-600">Member</span>
            <select value={assignMemberId} onChange={(e) => setAssignMemberId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <option value="">Select member</option>
              {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </label>
          <label className="min-w-40 flex-1"><span className="mb-1 block text-xs font-medium text-gray-600">Template</span>
            <select value={assignTemplateId} onChange={(e) => setAssignTemplateId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <option value="">Select template</option>
              {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </label>
          <Button onClick={assign} disabled={suspended}>Assign</Button>
        </Card>
      )}

      {canEdit && (
        <Card>
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="font-semibold text-gray-900">Per-member plan editor</h3>
            <p className="mt-1 text-xs text-gray-500">Customize an individual member's exercises beyond a shared template.</p>
          </div>
          <div className="divide-y divide-gray-100">
            {members.length === 0 && <p className="px-5 py-6 text-sm text-gray-400">No assigned members yet.</p>}
            {members.map((m) => (
              <div key={m._id} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="text-sm font-medium text-gray-900">{m.name}</span>
                <Button variant="secondary" onClick={() => openEditor(m._id)} disabled={suspended}><ListChecks className="h-4 w-4" />Edit plan</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <SearchBox value={q} onChange={setQ} placeholder="Search workout plans..." />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((w) => (
          <Card key={w._id} className="overflow-hidden">
            <div className="bg-gradient-to-br from-gray-900 to-teal-900 p-5 text-white">
              <div className="rounded-xl bg-white/10 p-2 w-fit"><Dumbbell className="h-5 w-5" /></div>
              <h3 className="mt-6 text-lg font-bold">{w.name}</h3>
              <p className="mt-1 text-sm text-teal-100">{w.focus || 'General fitness'}</p>
            </div>
            <div className="p-5">
              <div className="flex gap-2"><Pill tone="blue">{w.level}</Pill><Pill>{w.daysPerWeek} days/week</Pill></div>
              <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
                <span className="flex items-center gap-2 text-sm text-gray-500"><Users className="h-4 w-4" />{w.assignedMemberCount} members</span>
              </div>
            </div>
          </Card>
        ))}
        {!filtered.length && <p className="col-span-full py-8 text-center text-sm text-gray-400">No workout templates found.</p>}
      </div>

      <Modal open={open} title="Create workout plan" onClose={() => setOpen(false)} footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} disabled={saving || suspended}>{saving ? 'Creating...' : 'Create plan'}</Button></>}>
        <div className="space-y-4">
          <Field label="Plan name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Beginner strength" />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">Level
              <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-200 p-2.5">
                <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
              </select>
            </label>
            <Field label="Days per week" type="number" value={form.daysPerWeek} onChange={(e) => setForm({ ...form, daysPerWeek: Number(e.target.value) })} />
          </div>
          <Field label="Primary focus" value={form.focus} onChange={(e) => setForm({ ...form, focus: e.target.value })} placeholder="Strength, mobility, fat loss..." />
        </div>
      </Modal>

      <Modal
        open={!!editorMemberId}
        title={`Edit workout — ${members.find((m) => m._id === editorMemberId)?.name || ''}`}
        onClose={() => setEditorMemberId('')}
        footer={<><Button variant="secondary" onClick={() => setEditorMemberId('')}>Cancel</Button><Button onClick={saveEditorPlan} disabled={editorSaving || editorLoading || suspended}>{editorSaving ? 'Saving...' : 'Save plan'}</Button></>}
      >
        {editorLoading ? (
          <p className="py-8 text-center text-sm text-gray-400">Loading...</p>
        ) : (
          <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
            {editorDays.map((day, dayIndex) => (
              <div key={dayIndex} className="rounded-xl border border-gray-200 p-3">
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <input value={day.day || ''} onChange={(e) => updateDay(dayIndex, { day: e.target.value })} placeholder={`Day ${dayIndex + 1}`} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold" />
                  <div className="flex gap-2">
                    <input value={day.focus || ''} onChange={(e) => updateDay(dayIndex, { focus: e.target.value })} placeholder="Focus (e.g. Legs)" className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
                    <button type="button" onClick={() => removeDay(dayIndex)} disabled={editorDays.length <= 1} className="shrink-0 rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="space-y-2">
                  {day.exercises.map((ex, exIndex) => (
                    <div key={exIndex} className="grid grid-cols-[1fr_70px_80px_auto] items-center gap-2">
                      <input value={ex.name} onChange={(e) => updateExercise(dayIndex, exIndex, { name: e.target.value })} placeholder="Exercise name" className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm" />
                      <input type="number" min="1" value={ex.sets} onChange={(e) => updateExercise(dayIndex, exIndex, { sets: Number(e.target.value) })} placeholder="Sets" className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm" />
                      <input value={ex.reps} onChange={(e) => updateExercise(dayIndex, exIndex, { reps: e.target.value })} placeholder="Reps" className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm" />
                      <button type="button" onClick={() => removeExercise(dayIndex, exIndex)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => addExercise(dayIndex)} className="mt-2 text-xs font-semibold text-teal-700 hover:text-teal-800">+ Add exercise</button>
              </div>
            ))}
            <button type="button" onClick={addDay} className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800"><Plus className="h-4 w-4" />Add day</button>
          </div>
        )}
      </Modal>
    </Page>
  );
};
export default Workout;
