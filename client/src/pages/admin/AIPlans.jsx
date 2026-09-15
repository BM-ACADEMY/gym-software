import { useEffect, useState } from 'react';
import { Bot, RefreshCw, Send, Sparkles } from 'lucide-react';
import apiClient from '../../api/client';
import Badge from '../../components/ui/Badge';
import useSuspended from '../../hooks/useSuspended';

const AIPlans = () => {
  const suspended = useSuspended();
  const [members, setMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    apiClient.get('/admin/members', { params: { limit: 100 } }).then((res) => setMembers(res.data.data.members)).catch(() => {});
  }, []);

  const fetchPlan = async (memberId) => {
    if (!memberId) return;
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const res = await apiClient.get(`/admin/ai-plans/member/${memberId}`);
      setPlan(res.data.data);
      if (!res.data.data) setNotFound(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load AI plan');
    } finally {
      setLoading(false);
    }
  };

  const selectMember = (id) => {
    setSelectedMemberId(id);
    setPlan(null);
    fetchPlan(id);
  };

  const generate = async () => {
    if (!selectedMemberId) return;
    setGenerating(true);
    setError('');
    try {
      const res = await apiClient.post('/admin/ai-plans/generate', { memberId: selectedMemberId });
      setPlan(res.data.data);
      setNotFound(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate plan');
    } finally {
      setGenerating(false);
    }
  };

  const publish = async () => {
    try {
      const res = await apiClient.patch(`/admin/ai-plans/member/${selectedMemberId}/publish`);
      setPlan(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to publish');
    }
  };

  const updateExerciseSets = (dayIdx, exIdx, field, value) => {
    setPlan((p) => {
      const next = { ...p, workoutJson: { ...p.workoutJson, days: p.workoutJson.days.map((d, i) => i !== dayIdx ? d : { ...d, exercises: d.exercises.map((e, j) => j !== exIdx ? e : { ...e, [field]: value }) }) } };
      return next;
    });
  };

  const saveEdits = async () => {
    try {
      const res = await apiClient.put(`/admin/ai-plans/member/${selectedMemberId}`, { workoutJson: plan.workoutJson, dietJson: plan.dietJson });
      setPlan(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save edits');
    }
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Plans</h1>
          <p className="mt-1 text-gray-500">Generate a personalized workout + diet plan, review it, then publish to the member.</p>
        </div>
        <select value={selectedMemberId} onChange={(e) => selectMember(e.target.value)} className="rounded-xl border border-gray-200 bg-white py-2.5 px-3.5 text-sm outline-none">
          <option value="">Select member</option>
          {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
        </select>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!selectedMemberId ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-gray-400">
          <Bot className="h-6 w-6" /><p className="text-sm">Select a member to view or generate their AI plan.</p>
        </div>
      ) : loading ? (
        <div className="mt-8 flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" /></div>
      ) : notFound ? (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-gray-400">
          <Sparkles className="h-6 w-6" />
          <p className="text-sm">No AI plan yet for this member.</p>
          <button onClick={generate} disabled={generating || suspended} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
            <Sparkles className="h-4 w-4" /> {generating ? 'Generating...' : 'Generate plan'}
          </button>
        </div>
      ) : plan ? (
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="font-semibold text-gray-900">Workout plan</h3>
              <Badge tone={plan.status === 'published' ? 'green' : 'amber'}>{plan.status === 'published' ? 'Published' : 'Draft — needs review'}</Badge>
            </div>
            <div className="space-y-3 p-5">
              {plan.workoutJson.cautions?.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Adjusted for: {plan.workoutJson.cautions.map((c) => c.concern).join(', ')} — some exercises were excluded.
                </div>
              )}
              {plan.workoutJson.days?.map((day, dayIdx) => (
                <div key={dayIdx} className="rounded-xl border border-gray-100 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{day.day} · {day.focus}</p>
                  <div className="mt-2 space-y-1.5">
                    {day.exercises.map((ex, exIdx) => (
                      <div key={exIdx} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-gray-700">{ex.name}</span>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <input type="number" value={ex.sets} onChange={(e) => updateExerciseSets(dayIdx, exIdx, 'sets', Number(e.target.value))} className="w-12 rounded border border-gray-200 px-1.5 py-1 text-center" /> sets ×
                          <input value={ex.reps} onChange={(e) => updateExerciseSets(dayIdx, exIdx, 'reps', e.target.value)} className="w-14 rounded border border-gray-200 px-1.5 py-1 text-center" /> reps
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4"><h3 className="font-semibold text-gray-900">Diet plan</h3></div>
            <div className="space-y-3 p-5">
              <div className="grid grid-cols-4 gap-3 text-center text-sm">
                <div className="rounded-lg bg-gray-50 p-2"><p className="text-xs text-gray-500">Calories</p><p className="font-bold">{plan.dietJson.targetCalories}</p></div>
                <div className="rounded-lg bg-gray-50 p-2"><p className="text-xs text-gray-500">Protein</p><p className="font-bold">{plan.dietJson.macros.proteinGrams}g</p></div>
                <div className="rounded-lg bg-gray-50 p-2"><p className="text-xs text-gray-500">Carbs</p><p className="font-bold">{plan.dietJson.macros.carbsGrams}g</p></div>
                <div className="rounded-lg bg-gray-50 p-2"><p className="text-xs text-gray-500">Fat</p><p className="font-bold">{plan.dietJson.macros.fatGrams}g</p></div>
              </div>
              {plan.dietJson.meals?.map((m, i) => (
                <div key={i} className="flex justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <span className="font-medium text-gray-900">{m.meal}</span>
                  <span className="text-gray-500">{m.suggestion}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={saveEdits} disabled={suspended} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">Save edits</button>
            <button onClick={generate} disabled={generating || suspended} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw className="h-4 w-4" /> {generating ? 'Regenerating...' : 'Regenerate'}
            </button>
            {plan.status !== 'published' && (
              <button onClick={publish} disabled={suspended} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500">
                <Send className="h-4 w-4" /> Publish to member
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AIPlans;
