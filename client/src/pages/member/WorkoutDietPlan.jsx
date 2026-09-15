import { useEffect, useState } from 'react';
import { CheckCircle2, Dumbbell, Sparkles } from 'lucide-react';
import { Button, Card, CardTitle, Field, Page, PageHeader } from '../subadmin/ui';
import apiClient from '../../api/client';
import useSuspended from '../../hooks/useSuspended';

const WorkoutDietPlan = () => {
  const suspended = useSuspended();
  const [workout, setWorkout] = useState(null);
  const [aiPlan, setAiPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marking, setMarking] = useState(false);
  const [progress, setProgress] = useState({ weight: '', measurements: '' });
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);

  const fetchWorkout = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/member/workout-diet-plan');
      setWorkout(res.data.data.workout);
      setAiPlan(res.data.data.aiPlan);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your workout');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWorkout(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const doneToday = workout?.completedDates?.includes(today);

  const markDone = async () => {
    setMarking(true);
    try {
      const res = await apiClient.post('/member/workout-diet-plan/mark-done');
      setWorkout(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark done');
    } finally {
      setMarking(false);
    }
  };

  const logProgress = async (e) => {
    e.preventDefault();
    setLogging(true);
    setError('');
    try {
      await apiClient.post('/member/workout-diet-plan/progress', {
        weight: progress.weight ? Number(progress.weight) : undefined,
        measurements: progress.measurements || undefined,
      });
      setProgress({ weight: '', measurements: '' });
      setLogged(true);
      setTimeout(() => setLogged(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to log progress');
    } finally {
      setLogging(false);
    }
  };

  return (
    <Page>
      <PageHeader eyebrow="Customer workspace" title="Workout & Diet Plan" description="Your assigned routine, AI plan, and progress tracking." />
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" /></div>
      ) : !workout ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-gray-400"><Dumbbell className="h-6 w-6" /><p className="text-sm">No workout assigned yet — ask your trainer.</p></Card>
      ) : (
        <Card>
          <CardTitle title={workout.templateId?.name || 'Your workout routine'} description={workout.templateId?.focus} />
          <div className="space-y-4 p-5">
            {Array.isArray(workout.planData?.days) ? (
              <div className="space-y-2">
                {workout.planData.days.map((d, i) => (
                  <div key={i} className="rounded-xl bg-gray-50 p-3">
                    <p className="text-sm font-semibold text-gray-900">{d.day}</p>
                    <p className="text-xs text-gray-500">{Array.isArray(d.exercises) ? d.exercises.join(', ') : ''}</p>
                  </div>
                ))}
              </div>
            ) : workout.planData?.notes ? (
              <p className="whitespace-pre-line text-sm text-gray-600">{workout.planData.notes}</p>
            ) : (
              <p className="text-sm text-gray-400">No routine details recorded.</p>
            )}
            <Button onClick={markDone} disabled={marking || doneToday || suspended} variant={doneToday ? 'secondary' : 'primary'}>
              <CheckCircle2 className="h-4 w-4" /> {doneToday ? "Done for today" : marking ? 'Saving...' : 'Mark today done'}
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <CardTitle title="AI workout & diet plan" description={aiPlan ? `Goal: ${aiPlan.dietJson?.goal || aiPlan.workoutJson?.goal}` : undefined} />
        {!aiPlan ? (
          <div className="flex items-center gap-3 p-5 text-sm text-gray-400"><Sparkles className="h-5 w-5" />Your trainer hasn't published an AI plan yet.</div>
        ) : (
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-4 gap-3 text-center text-sm">
              <div className="rounded-lg bg-gray-50 p-2"><p className="text-xs text-gray-500">Calories</p><p className="font-bold">{aiPlan.dietJson.targetCalories}</p></div>
              <div className="rounded-lg bg-gray-50 p-2"><p className="text-xs text-gray-500">Protein</p><p className="font-bold">{aiPlan.dietJson.macros.proteinGrams}g</p></div>
              <div className="rounded-lg bg-gray-50 p-2"><p className="text-xs text-gray-500">Carbs</p><p className="font-bold">{aiPlan.dietJson.macros.carbsGrams}g</p></div>
              <div className="rounded-lg bg-gray-50 p-2"><p className="text-xs text-gray-500">Fat</p><p className="font-bold">{aiPlan.dietJson.macros.fatGrams}g</p></div>
            </div>
            <div className="space-y-1.5">
              {aiPlan.dietJson.meals?.map((m, i) => (
                <div key={i} className="flex justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <span className="font-medium text-gray-900">{m.meal}</span>
                  <span className="text-gray-500">{m.suggestion}</span>
                </div>
              ))}
            </div>
            {aiPlan.workoutJson?.days?.length > 0 && (
              <div className="space-y-1.5 border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold uppercase text-gray-500">Suggested split</p>
                {aiPlan.workoutJson.days.map((d, i) => (
                  <div key={i} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <span className="font-medium text-gray-900">{d.day} · {d.focus}</span>
                    <p className="mt-0.5 text-xs text-gray-500">{d.exercises.map((e) => e.name).join(', ')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle title="Log progress" description="Weight and measurements — your trainer uses this to refresh your AI plan" />
        <form onSubmit={logProgress} className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weight (kg)" type="number" step="0.1" value={progress.weight} onChange={(e) => setProgress({ ...progress, weight: e.target.value })} />
            <Field label="Measurements" value={progress.measurements} onChange={(e) => setProgress({ ...progress, measurements: e.target.value })} placeholder="e.g. waist 82cm" />
          </div>
          <Button type="submit" disabled={logging || suspended}>{logging ? 'Logging...' : 'Log progress'}</Button>
          {logged && <span className="ml-3 text-sm font-medium text-emerald-600">Logged!</span>}
        </form>
      </Card>
    </Page>
  );
};

export default WorkoutDietPlan;
