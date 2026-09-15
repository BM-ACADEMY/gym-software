import { useEffect, useState } from 'react';
import { Bot, ClipboardList, RefreshCw, Sparkles, WandSparkles } from 'lucide-react';
import { Button, Card, CardTitle, Page, PageHeader, Pill } from './ui';
import apiClient from '../../api/client';
import useSuspended from '../../hooks/useSuspended';

const AIPlans = () => {
  const suspended = useSuspended();
  const [members, setMembers] = useState([]);
  const [memberId, setMemberId] = useState('');
  const [plan, setPlan] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/subadmin/members').then((res) => setMembers(res.data.data.members)).catch(() => {});
  }, []);

  const fetchPlan = async (id) => {
    if (!id) return;
    setError('');
    setNotFound(false);
    try {
      const res = await apiClient.get(`/subadmin/ai-plans/member/${id}`);
      setPlan(res.data.data);
      if (!res.data.data) setNotFound(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load plan');
    }
  };

  const selectMember = (id) => {
    setMemberId(id);
    setPlan(null);
    fetchPlan(id);
  };

  const generate = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await apiClient.post('/subadmin/ai-plans/generate', { memberId });
      setPlan(res.data.data);
      setNotFound(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate draft');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Page>
      <PageHeader title="AI plan generator" description="Create a coach-reviewed workout draft tailored to a member's goal and constraints." actions={<Pill tone="violet"><Sparkles className="mr-1 h-3 w-3" />AI assisted</Pill>} />
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[.5fr_1.5fr]">
        <Card>
          <CardTitle title="Select member" />
          <div className="space-y-4 p-5">
            <select value={memberId} onChange={(e) => selectMember(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-sm outline-none focus:border-teal-500">
              <option value="">Choose a member</option>
              {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
            <Button className="w-full" onClick={generate} disabled={!memberId || generating || suspended}>
              {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
              {generating ? 'Creating plan...' : 'Generate draft'}
            </Button>
            <p className="text-center text-xs text-gray-400">AI output must be reviewed by the gym owner before publishing.</p>
          </div>
        </Card>

        <Card className="min-h-[560px]">
          {!plan ? (
            <div className="flex h-full min-h-[560px] flex-col items-center justify-center p-8 text-center">
              <div className="rounded-2xl bg-violet-50 p-5 text-violet-600"><Bot className="h-10 w-10" /></div>
              <h3 className="mt-5 text-lg font-bold">{notFound ? 'No draft yet — generate one' : 'Your draft will appear here'}</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">Select a member, then generate a structured weekly plan from their goal and medical notes.</p>
            </div>
          ) : (
            <>
              <CardTitle title="Generated plan" description={`Goal: ${plan.workoutJson?.goal || '—'}`} action={<Pill tone={plan.status === 'published' ? 'green' : 'amber'}>{plan.status === 'published' ? 'Published' : 'Needs review'}</Pill>} />
              <div className="space-y-3 p-5">
                {plan.workoutJson?.cautions?.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Adjusted for: {plan.workoutJson.cautions.map((c) => c.concern).join(', ')}</div>
                )}
                {plan.workoutJson?.days?.map((day, i) => (
                  <div key={i} className="flex items-start gap-4 rounded-xl border border-gray-100 p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><ClipboardList className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{day.day}</p>
                      <p className="font-semibold">{day.focus}</p>
                      <p className="mt-1 text-xs text-gray-500">{day.exercises.map((e) => e.name).join(' · ')}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 p-5">
                <Button variant="secondary" onClick={generate} disabled={generating || suspended}><RefreshCw className="h-4 w-4" />Regenerate</Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </Page>
  );
};
export default AIPlans;
