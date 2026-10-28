import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';
import apiClient from '../../api/client';
import { useT } from '../../i18n';

const DISMISS_KEY = 'gymdesk_onboarding_dismissed';

// "Get started" card for new gym owners. Hides itself once everything required is done.
const OnboardingChecklist = () => {
  const { t } = useT();
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    if (dismissed) return;
    apiClient.get('/admin/onboarding').then((r) => setData(r.data.data)).catch(() => {});
  }, [dismissed]);

  if (dismissed || !data || data.allDone) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage unavailable */ }
    setDismissed(true);
  };

  return (
    <div className="mb-6 rounded-2xl border border-teal-200 bg-teal-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-teal-900">{t('Get your gym ready')} ({data.completed}/{data.total})</h2>
          <p className="text-sm text-teal-800">{t('A few quick steps and GymDesk runs on its own.')}</p>
        </div>
        <button onClick={dismiss} className="text-xs font-semibold text-teal-700 underline">{t('Hide')}</button>
      </div>
      <ul className="mt-4 space-y-2">
        {data.steps.map((s) => (
          <li key={s.key}>
            <Link to={s.path} className="flex items-start gap-3 rounded-xl bg-white/70 p-3 hover:bg-white">
              {s.done ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-teal-600" /> : <Circle className="mt-0.5 h-5 w-5 text-gray-400" />}
              <span>
                <span className={`block text-sm font-semibold ${s.done ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{t(s.title)}</span>
                <span className="block text-xs text-gray-500">{t(s.hint)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default OnboardingChecklist;
