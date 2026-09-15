import { useEffect, useState } from 'react';
import { Dumbbell, IndianRupee, PiggyBank, Wallet2 } from 'lucide-react';
import apiClient from '../../api/client';

const StatCard = ({ label, value, icon: Icon, tone = 'teal' }) => {
  const tones = { teal: 'bg-teal-50 text-teal-700', blue: 'bg-blue-50 text-blue-700', violet: 'bg-violet-50 text-violet-700', amber: 'bg-amber-50 text-amber-700' };
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div><p className="text-sm font-medium text-gray-500">{label}</p><p className="mt-2 text-3xl font-bold text-gray-950">{value}</p></div>
        <div className={`rounded-xl p-3 ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
};

const monthDefault = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) };
};

const Earnings = () => {
  const [range, setRange] = useState(monthDefault());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const fetchEarnings = async () => {
    try {
      const res = await apiClient.get('/admin/earnings', { params: range });
      setData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load earnings');
    }
  };

  useEffect(() => {
    fetchEarnings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
          <p className="mt-1 text-gray-500">Revenue breakdown and trainer commission payouts.</p>
        </div>
        <div className="flex gap-2">
          <input type="date" value={range.dateFrom} onChange={(e) => setRange({ ...range, dateFrom: e.target.value })} className="rounded-xl border border-gray-200 bg-white py-2.5 px-3.5 text-sm outline-none" />
          <input type="date" value={range.dateTo} onChange={(e) => setRange({ ...range, dateTo: e.target.value })} className="rounded-xl border border-gray-200 bg-white py-2.5 px-3.5 text-sm outline-none" />
        </div>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!data ? (
        <div className="mt-8 flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" /></div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total revenue" value={`₹${data.total.toLocaleString()}`} icon={IndianRupee} />
            <StatCard label="Membership" value={`₹${data.byCategory.membership.toLocaleString()}`} icon={Wallet2} tone="teal" />
            <StatCard label="PT Sessions" value={`₹${data.byCategory.pt_session.toLocaleString()}`} icon={Dumbbell} tone="blue" />
            <StatCard label="Other" value={`₹${data.byCategory.other.toLocaleString()}`} icon={PiggyBank} tone="violet" />
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4"><h3 className="font-semibold text-gray-900">By trainer</h3><p className="mt-0.5 text-xs text-gray-500">Commission payout is {`{PT session revenue from that trainer's members} × {their PT commission %}`}.</p></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr><th className="px-5 py-3">Trainer</th><th className="px-5 py-3">Total revenue</th><th className="px-5 py-3">PT revenue</th><th className="px-5 py-3">Commission %</th><th className="px-5 py-3">Payout</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.byTrainer.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No trainer-attributed revenue in this period.</td></tr>
                  ) : data.byTrainer.map((t) => (
                    <tr key={t.trainerId}>
                      <td className="px-5 py-4 font-semibold text-gray-900">{t.trainerName}</td>
                      <td className="px-5 py-4 text-gray-600">₹{t.revenue.toLocaleString()}</td>
                      <td className="px-5 py-4 text-gray-600">₹{t.ptRevenue.toLocaleString()}</td>
                      <td className="px-5 py-4 text-gray-600">{t.commissionPercent}%</td>
                      <td className="px-5 py-4 font-semibold text-teal-700">₹{t.commissionPayout.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Earnings;
