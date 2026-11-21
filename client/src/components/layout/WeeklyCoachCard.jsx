import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Target } from 'lucide-react';
import apiClient from '../../api/client';
import { useT } from '../../i18n';

// Owner dashboard: this week's top 3 actions with the rupees at stake (an upper bound, not a promise)
// and whether the owner has started them. Progress comes from the "contacted" taps on the Renewal Copilot.
const BADGE = { done: 'bg-green-100 text-green-700', started: 'bg-amber-100 text-amber-700', open: 'bg-gray-100 text-gray-600', info: 'bg-gray-100 text-gray-500' };
const LABEL = { done: 'Done', started: 'Started', open: 'To do', info: '' };

const WeeklyCoachCard = () => {
  const { t } = useT();
  const [data, setData] = useState(null);
  useEffect(() => { apiClient.get('/admin/coach').then((r) => setData(r.data.data)).catch(() => {}); }, []);
  if (!data || !data.actions || !data.actions.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-teal-600" />
        <h3 className="text-sm font-semibold text-gray-800">{t('Your 3 actions this week')}</h3>
      </div>
      <ul className="mt-3 space-y-2">
        {data.actions.map((a) => (
          <li key={a.id} className="flex items-start gap-2 text-sm text-gray-700">
            <span className="text-teal-600">→</span>
            <span className="flex-1">{a.text}</span>
            {LABEL[a.status] ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[a.status]}`}>{t(LABEL[a.status])}{a.target ? ` ${a.contacted}/${a.target}` : ''}</span> : null}
          </li>
        ))}
      </ul>
      <Link to="/admin/copilot" className="mt-3 inline-block text-sm font-medium text-teal-700 hover:underline">{t('Open the Renewal list')}</Link>
    </div>
  );
};

export default WeeklyCoachCard;
