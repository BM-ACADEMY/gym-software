import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import apiClient from '../../api/client';

// SET-01: change plan prices and limits without a deploy. Every change needs a reason and is kept in the history.
const NUM = [['monthly', 'Monthly price (Rs, before GST)'], ['yearly', 'Yearly price (Rs, before GST)'], ['memberLimit', 'Members (empty = unlimited)'], ['staffLimit', 'Staff logins (empty = unlimited)'],
  ['whatsappPerMonth', 'WhatsApp messages a month'], ['aiCallsPerMonth', 'AI answers a month'], ['aiPlansPerMonth', 'AI workout and diet plans a month']];
const FEATURES = [['ai-plans', 'AI workout and diet plans'], ['pt-sessions', 'PT sessions'], ['accounts', 'Accounts and expenses'], ['branding', 'Own logo and colours']];
const toForm = (p) => ({ ...Object.fromEntries(NUM.map(([k]) => [k, p[k] === null ? '' : String(p[k])])), features: { ...p.features }, reason: '' });

const PlanBox = ({ plan, floor, onSaved }) => {
  const [f, setF] = useState(toForm(plan));
  const [msg, setMsg] = useState(''); const [ask, setAsk] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { setF(toForm(plan)); }, [plan]);
  const body = (confirm) => {
    const out = { reason: f.reason, features: f.features };
    for (const [k] of NUM) { const v = f[k].trim(); out[k] = v === '' ? (k === 'memberLimit' || k === 'staffLimit' ? null : NaN) : Number(v); }
    if (confirm) out.confirmBelowFloor = true; return out;
  };
  const save = async (confirm) => {
    setBusy(true); setMsg('');
    try { await apiClient.put(`/root-admin/plan-settings/${plan.key}`, body(confirm)); setAsk(null); setMsg('Saved. New prices and limits are live.'); await onSaved(); }
    catch (err) { const d = err.response?.data; if (err.response?.status === 409 && d?.needsConfirm) setAsk(d.message); else setMsg(d?.message || 'Could not save.'); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    const reason = window.prompt('Reason for going back to the standard values?'); if (!reason) return;
    try { await apiClient.post(`/root-admin/plan-settings/${plan.key}/reset`, { reason }); setMsg('Back to the standard values.'); await onSaved(); }
    catch (err) { setMsg(err.response?.data?.message || 'Could not reset.'); }
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between"><p className="font-semibold text-gray-900">{plan.name}{plan.changed.length > 0 && <span className="ml-2 text-xs rounded bg-amber-100 text-amber-800 px-2 py-0.5">changed</span>}</p>
        {floor ? <span className="text-xs text-gray-500">Full-use floor: Rs {floor} a month</span> : null}</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
        {NUM.map(([k, label]) => (
          <label key={k} className="space-y-1"><span className="text-gray-600">{label}</span>
            <input inputMode="numeric" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></label>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        {FEATURES.map(([k, label]) => (<label key={k} className="flex items-center gap-2"><input type="checkbox" checked={!!f.features[k]} onChange={(e) => setF({ ...f, features: { ...f.features, [k]: e.target.checked } })} />{label}</label>))}
      </div>
      <label className="block text-sm space-y-1"><span className="text-gray-600">Reason for this change (required, 5 to 200 characters)</span>
        <input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></label>
      {ask && <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">{ask}
        <div className="mt-2"><button type="button" disabled={busy} onClick={() => save(true)} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm">Save anyway</button></div></div>}
      {msg && <p className="text-sm text-gray-700">{msg}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => save(false)} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium disabled:opacity-50">Save changes</button>
        {plan.changed.length > 0 && <button type="button" onClick={reset} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">Back to standard values</button>}
      </div>
    </div>
  );
};

const TrialBox = ({ trial, onSaved }) => {
  const [days, setDays] = useState(String(trial.days)); const [reason, setReason] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setMsg('');
    try { await apiClient.put('/root-admin/plan-settings/trial', { days: Number(days), reason }); setMsg('Saved. New sign-ups get this trial.'); setReason(''); await onSaved(); }
    catch (err) { setMsg(err.response?.data?.message || 'Could not save.'); } finally { setBusy(false); }
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <p className="font-semibold text-gray-800">Free trial length</p>
      <p className="text-sm text-gray-600">Standard is {trial.default} days. A change applies to gyms that sign up after it; gyms already on a trial keep their end date. 0 to {trial.max} days.</p>
      <label className="block text-sm text-gray-700">Days<input type="number" min="0" max={trial.max} value={days} onChange={(e) => setDays(e.target.value)} className="block w-32 border border-gray-300 rounded-lg px-3 py-2" /></label>
      <label className="block text-sm text-gray-700">Reason (5 to 200 characters)<input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></label>
      <button type="button" disabled={busy} onClick={save} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium disabled:opacity-50">Save trial length</button>
      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </div>
  );
};

const PlanSettings = () => {
  const [data, setData] = useState(null); const [error, setError] = useState('');
  const load = async () => { try { setData((await apiClient.get('/root-admin/plan-settings')).data.data); } catch (err) { setError(err.response?.data?.message || 'Could not load the plans.'); } };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3"><SlidersHorizontal className="w-6 h-6 text-teal-600" /><h1 className="text-2xl font-bold text-gray-900">Plan settings</h1></div>
      <p className="text-sm text-gray-600">Change a price or limit here and it is live for the pricing page and for checkout within a minute. No deploy needed. Gyms that already paid keep what they paid for. Prices are whole rupees before 18% GST.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && data.trial && <TrialBox key={data.trial.days} trial={data.trial} onSaved={load} />}
      {data && data.plans.map((p) => <PlanBox key={p.key} plan={p} floor={data.floors[p.key]} onSaved={load} />)}
      {data && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="font-semibold text-gray-800 mb-2">History</p>
          {data.history.length === 0 ? <p className="text-sm text-gray-500">No changes yet.</p> : (
            <ul className="space-y-2 text-sm">{data.history.map((h, i) => (
              <li key={i} className="border-b border-gray-100 pb-2"><span className="text-gray-500">{new Date(h.at).toLocaleString('en-IN')}</span> · {h.by} · <b>{h.plan}</b> {h.action === 'reset' ? 'reset to standard' : 'changed'}<br />
                <span className="text-gray-600">Reason: {h.reason}</span></li>))}</ul>)}
        </div>)}
    </div>
  );
};
export default PlanSettings;
