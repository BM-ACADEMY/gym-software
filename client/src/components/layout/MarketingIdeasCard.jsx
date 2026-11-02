import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import apiClient from '../../api/client';
import { useT } from '../../i18n';

// Owner dashboard: up to 3 marketing ideas with a draft to copy. Nothing is sent from here.
const MarketingIdeasCard = () => {
  const { t } = useT();
  const [ideas, setIdeas] = useState([]);
  const [copied, setCopied] = useState('');
  useEffect(() => { apiClient.get('/admin/marketing-ideas').then((r) => setIdeas((r.data.data && r.data.data.ideas) || [])).catch(() => {}); }, []);
  if (!ideas.length) return null;
  const copy = async (i) => { try { await navigator.clipboard.writeText(i.draft); setCopied(i.kind); } catch { setCopied(''); } };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-teal-600" /><h3 className="text-sm font-semibold text-gray-800">{t('Ideas to bring in members')}</h3></div>
      <ul className="mt-3 space-y-3">
        {ideas.map((i) => (
          <li key={i.kind} className="text-sm text-gray-700">
            <p className="font-medium">{i.title}</p>
            <p className="text-xs text-gray-500">{i.why}</p>
            <p className="mt-1 rounded-lg bg-gray-50 p-2 text-xs">{i.draft}</p>
            <button type="button" onClick={() => copy(i)} className="mt-1 text-xs font-medium text-teal-700 hover:underline">{copied === i.kind ? t('Copied') : t('Copy the message')}</button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-gray-400">{t('These are drafts. Nothing is sent for you.')}</p>
    </div>
  );
};
export default MarketingIdeasCard;
