import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import apiClient from '../../api/client';

// Owner dashboard: a short read of the week with suggested actions. Only totals
// are sent to the AI, never member names or phone numbers. Falls back to plain
// rules when AI is off or the monthly allowance is used up.
const AiInsightsCard = () => {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient.get('/admin/assistant/insights').then((r) => setData(r.data.data)).catch(() => setFailed(true));
  }, []);

  if (failed || !data) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-teal-600" />
        <h3 className="text-sm font-semibold text-gray-800">This week at your gym</h3>
        <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
          {data.source === 'ai' ? 'Written by AI' : 'Auto summary'}
        </span>
      </div>
      <p className="mt-2 text-sm text-gray-700">{data.summary}</p>
      <ul className="mt-3 space-y-1.5">
        {data.actions.map((a, i) => (
          <li key={i} className="flex gap-2 text-sm text-gray-600"><span className="text-teal-600">→</span>{a}</li>
        ))}
      </ul>
    </div>
  );
};

export default AiInsightsCard;
