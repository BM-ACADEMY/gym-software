import { useEffect, useState } from 'react';
import { Percent } from 'lucide-react';
import apiClient from '../../api/client';
import Badge from '../../components/ui/Badge';

// Monthly prices (D-10) and full-use floors from docs/AI_COST_MODEL.md (25% margin, AI caps from D-16).
const PLANS = [
  { key: 'solo', name: 'Solo', price: 249, floor: 380 },
  { key: 'starter', name: 'Starter', price: 599, floor: 489 },
  { key: 'growth', name: 'Growth', price: 999, floor: 804 },
  { key: 'pro', name: 'Pro', price: 1999, floor: 1599 },
];
const EMPTY = { code: '', kind: 'offer', ownerLabel: '', percentOff: 10, firstPaymentOnly: true, maxRedemptions: '', expiresAt: '', note: '' };
const KIND_TONE = { offer: 'blue', partner: 'amber', referral: 'green' };

const PromoCodes = () => {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setList((await apiClient.get('/root-admin/promo-codes')).data.data); }
    catch (err) { setError(err.response?.data?.message || 'Could not load codes.'); }
  };
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const pct = Number(form.percentOff) || 0;
  const risky = PLANS.filter((p) => p.key !== 'solo' && Math.round(p.price * (1 - pct / 100)) < p.floor);

  const create = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await apiClient.post('/root-admin/promo-codes', { ...form, percentOff: pct, maxRedemptions: form.maxRedemptions || undefined, expiresAt: form.expiresAt || undefined });
      setForm(EMPTY); await load();
    } catch (err) { setError(err.response?.data?.message || 'Could not create the code.'); }
    finally { setBusy(false); }
  };

  const toggle = async (p) => {
    setError('');
    try { await apiClient.patch(`/root-admin/promo-codes/${p._id}`, { isActive: !p.isActive }); await load(); }
    catch (err) { setError(err.response?.data?.message || 'Could not update the code.'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3"><Percent className="w-6 h-6 text-teal-600" /><h1 className="text-2xl font-bold text-gray-900">Promo &amp; referral codes</h1></div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={create} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <p className="font-semibold text-gray-800">New code</p>
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <label className="space-y-1"><span className="text-gray-600">Code (3 to 24 letters or numbers)</span>
            <input required value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></label>
          <label className="space-y-1"><span className="text-gray-600">Type</span>
            <select value={form.kind} onChange={(e) => set('kind', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="offer">Offer</option><option value="partner">Partner</option><option value="referral">Referral</option></select></label>
          <label className="space-y-1"><span className="text-gray-600">Belongs to (partner or referrer)</span>
            <input value={form.ownerLabel} onChange={(e) => set('ownerLabel', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></label>
          <label className="space-y-1"><span className="text-gray-600">Discount % (1 to 50)</span>
            <input type="number" min="1" max="50" required value={form.percentOff} onChange={(e) => set('percentOff', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></label>
          <label className="space-y-1"><span className="text-gray-600">Maximum uses (blank = unlimited)</span>
            <input type="number" min="1" value={form.maxRedemptions} onChange={(e) => set('maxRedemptions', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></label>
          <label className="space-y-1"><span className="text-gray-600">Ends on (blank = never)</span>
            <input type="date" value={form.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.firstPaymentOnly} onChange={(e) => set('firstPaymentOnly', e.target.checked)} /> First payment only</label>

        <div className="text-sm bg-gray-50 rounded-lg p-3">
          <p className="font-medium text-gray-700 mb-1">Monthly price with {pct}% off</p>
          <div className="flex flex-wrap gap-4">
            {PLANS.map((p) => <span key={p.key}>{p.name}: Rs {Math.round(p.price * (1 - pct / 100))}</span>)}
          </div>
          {risky.length > 0 && <p className="text-amber-700 mt-2">Below the full-use floor for {risky.map((p) => p.name).join(', ')}. At typical use it is still safe, but a gym that uses all its AI every month would cost more than it pays. Check with the founder before sharing this code.</p>}
          <p className="text-xs text-gray-500 mt-1">Floors from docs/AI_COST_MODEL.md (25% margin, full AI use). Solo is already below its floor by design.</p>
        </div>
        <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold disabled:opacity-50">{busy ? 'Saving...' : 'Create code'}</button>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b"><tr><th className="p-3">Code</th><th className="p-3">Type</th><th className="p-3">Belongs to</th><th className="p-3">Off</th><th className="p-3">Used</th><th className="p-3">Ends</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td className="p-3 text-gray-500" colSpan={8}>No codes yet.</td></tr>}
            {list.map((p) => (
              <tr key={p._id} className="border-b last:border-0">
                <td className="p-3 font-mono font-semibold">{p.code}</td>
                <td className="p-3"><Badge tone={KIND_TONE[p.kind] || 'gray'}>{p.kind}</Badge></td>
                <td className="p-3">{p.ownerLabel || '-'}</td>
                <td className="p-3">{p.percentOff}%</td>
                <td className="p-3">{p.redeemedCount}{p.maxRedemptions ? ` / ${p.maxRedemptions}` : ''}</td>
                <td className="p-3">{p.expiresAt ? new Date(p.expiresAt).toLocaleDateString('en-IN') : 'never'}</td>
                <td className="p-3">{p.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Off</Badge>}</td>
                <td className="p-3"><button type="button" onClick={() => toggle(p)} className="text-teal-700 font-medium">{p.isActive ? 'Switch off' : 'Switch on'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PromoCodes;
