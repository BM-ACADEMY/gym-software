import { useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';
import apiClient from '../../api/client';
import Badge from '../../components/ui/Badge';

const rupees = (n) => `Rs ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const ALERT = { at_cap: ['red', 'At cap'], near_cap: ['amber', 'Near cap'] };

const Usage = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');

  const load = async () => {
    try {
      const res = await apiClient.get('/root-admin/usage');
      setData(res.data.data);
      setBudget(String(res.data.data.budget.dailyInr));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load usage.');
    }
  };
  useEffect(() => { load(); }, []);

  const saveBudget = async (e) => {
    e.preventDefault();
    setSaving(true); setSaved(''); setError('');
    try {
      await apiClient.put('/root-admin/usage/budget', { dailyInr: Number(budget) });
      setSaved('Saved.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the budget.');
    } finally { setSaving(false); }
  };

  if (!data) return <p className="p-6 text-sm text-gray-500">{error || 'Loading...'}</p>;
  const { budget: b, totals, businesses } = data;
  const pctToday = b.dailyInr > 0 ? Math.min(100, Math.round((b.spentTodayInr / b.dailyInr) * 100)) : 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Gauge className="w-6 h-6 text-teal-600" />
        <h1 className="text-2xl font-bold text-gray-900">AI &amp; WhatsApp usage ({data.month})</h1>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-sm text-gray-500">AI cost this month</p><p className="text-2xl font-bold">{rupees(totals.aiCostInr)}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-sm text-gray-500">AI calls / WhatsApp sent</p><p className="text-2xl font-bold">{totals.aiCalls} / {totals.whatsappSent}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-sm text-gray-500">Businesses near or at cap</p><p className="text-2xl font-bold">{totals.atOrNearCap}</p></div>
      </div>

      <form onSubmit={saveBudget} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-800">Daily AI budget (all products)</p>
          {b.stopped ? <Badge tone="red">AI stopped for today</Badge> : <Badge tone="green">AI on</Badge>}
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-2 ${b.stopped ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${pctToday}%` }} /></div>
        <p className="text-sm text-gray-600">Spent today {rupees(b.spentTodayInr)} of {rupees(b.dailyInr)}. When the budget is reached, AI switches off everywhere until tomorrow and the built-in answers carry on. Set 0 to switch AI off.</p>
        <div className="flex gap-2 items-center">
          <input type="number" min="0" max="100000" value={budget} onChange={(e) => setBudget(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 w-40 text-sm" aria-label="Daily budget in rupees" />
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold disabled:opacity-50">{saving ? 'Saving...' : 'Save budget'}</button>
          {saved && <span className="text-sm text-green-700">{saved}</span>}
        </div>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b">
            <tr><th className="p-3">Business</th><th className="p-3">Product</th><th className="p-3">Plan</th><th className="p-3">AI used / cap</th><th className="p-3">Tokens in / out</th><th className="p-3">AI cost</th><th className="p-3">WhatsApp</th><th className="p-3">Alert</th></tr>
          </thead>
          <tbody>
            {businesses.length === 0 && <tr><td className="p-3 text-gray-500" colSpan={8}>No businesses yet.</td></tr>}
            {businesses.map((x) => (
              <tr key={x.id} className="border-b last:border-0">
                <td className="p-3 font-medium">{x.name}</td>
                <td className="p-3">{x.product}</td>
                <td className="p-3">{x.plan || '-'}</td>
                <td className="p-3">{x.aiCalls} / {x.aiCap} ({x.aiPercent}%)</td>
                <td className="p-3">{x.inTokens.toLocaleString('en-IN')} / {x.outTokens.toLocaleString('en-IN')}</td>
                <td className="p-3">{rupees(x.aiCostInr)}</td>
                <td className="p-3">{x.whatsappSent}</td>
                <td className="p-3">{x.alert ? <Badge tone={ALERT[x.alert][0]}>{ALERT[x.alert][1]}</Badge> : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">Cost is worked out from the tokens each call used, using the price table in the server. Plan generation is counted in cost but has its own monthly limit.</p>
    </div>
  );
};

export default Usage;
