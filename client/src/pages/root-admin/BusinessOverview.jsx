import { useEffect, useState } from 'react';
import apiClient from '../../api/client';

const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const date = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '-');
const TONE = { trial: 'bg-blue-50 text-blue-700', active: 'bg-green-50 text-green-700', grace: 'bg-amber-50 text-amber-700', expired: 'bg-red-50 text-red-700', suspended: 'bg-gray-100 text-gray-600' };

const Stat = ({ label, value, helper }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4">
    <p className="text-xs font-medium text-gray-500">{label}</p>
    <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    {helper && <p className="text-xs text-gray-400">{helper}</p>}
  </div>
);

const GymList = ({ title, rows, empty, onExtend }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4">
    <h3 className="text-sm font-semibold text-gray-800">{title} <span className="text-gray-400">({rows.length})</span></h3>
    {rows.length === 0 ? <p className="mt-2 text-sm text-gray-400">{empty}</p> : (
      <ul className="mt-2 divide-y divide-gray-100">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <span className="font-medium text-gray-800">{r.gymName}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[r.status] || ''}`}>{r.status}</span>
            <span className="text-xs text-gray-500">{r.planKey || 'no plan'} · ends {date(r.endsAt)}</span>
            <button onClick={() => onExtend(r)} className="ml-auto rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">Give days</button>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const BusinessOverview = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [target, setTarget] = useState(null);
  const [days, setDays] = useState('7');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => apiClient.get('/root-admin/subscriptions/overview').then((r) => setData(r.data.data)).catch((e) => setError(e.response?.data?.message || 'Failed to load'));
  useEffect(() => { load(); }, []);

  const give = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      await apiClient.post(`/root-admin/subscriptions/${target.id}/extend`, { days: Number(days), reason });
      setMsg(`Added ${days} days to ${target.gymName}.`);
      setTarget(null); setReason('');
      load();
    } catch (ex) {
      setMsg(ex.response?.data?.message || 'Could not add days');
    } finally { setSaving(false); }
  };

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;
  const c = data.counts;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Monthly recurring revenue" value={rupees(data.mrr)} helper="excluding GST" />
        <Stat label="Yearly run rate" value={rupees(data.arr)} />
        <Stat label="Paying gyms" value={data.payingGyms} helper={`${data.totalGyms} gyms in total`} />
        <Stat label="Collected this month" value={rupees(data.collectedThisMonth.withGst)} helper={`${data.collectedThisMonth.payments} payments, ${rupees(data.collectedThisMonth.taxable)} before GST`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {['trial', 'active', 'grace', 'expired', 'suspended'].map((k) => <Stat key={k} label={k[0].toUpperCase() + k.slice(1)} value={c[k] || 0} />)}
        <Stat label="New in 7 days" value={data.newSignups7d} />
      </div>
      <p className="text-xs text-gray-500">AI calls this month: assistant {data.aiCallsThisMonth?.assistant || 0}, insights {data.aiCallsThisMonth?.insight || 0}. Compare with the Anthropic bill to check the plan allowances.</p>
      {msg && <p className="text-sm text-teal-700">{msg}</p>}

      {target && (
        <form onSubmit={give} className="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-800">Give days to {target.gymName}</p>
          <div className="flex flex-wrap gap-2">
            <input id="give-days" type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <input id="give-reason" required minLength={5} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (saved in the log)" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <button disabled={saving} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Add days</button>
            <button type="button" onClick={() => setTarget(null)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <GymList title="Trials ending in 3 days" rows={data.trialsEndingSoon} empty="None" onExtend={setTarget} />
        <GymList title="Renewals due in 7 days" rows={data.renewalsDue} empty="None" onExtend={setTarget} />
        <GymList title="Lapsed (grace or expired)" rows={data.lapsed} empty="None" onExtend={setTarget} />
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-800">Latest payments</h3>
          {data.recentPayments.length === 0 ? <p className="mt-2 text-sm text-gray-400">No payments yet</p> : (
            <ul className="mt-2 divide-y divide-gray-100">
              {data.recentPayments.map((p) => (
                <li key={p._id} className="flex flex-wrap gap-2 py-2 text-sm">
                  <span className="font-medium text-gray-800">{p.buyerName}</span>
                  <span className="text-xs text-gray-500">{p.planKey} {p.cycle} · {p.invoiceNo}</span>
                  <span className="ml-auto font-semibold">{rupees(p.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400">To suspend or reactivate a gym, use Subscriber Management.</p>
    </div>
  );
};

export default BusinessOverview;
