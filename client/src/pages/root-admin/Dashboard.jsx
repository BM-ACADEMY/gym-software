import { useEffect, useState } from 'react';
import { AlertTriangle, Building2, IndianRupee, Sparkles, TrendingDown, TrendingUp, UserPlus, Users } from 'lucide-react';
import apiClient from '../../api/client';

const StatCard = ({ label, value, helper, icon: Icon, tone = 'teal' }) => {
  const tones = { teal: 'bg-teal-50 text-teal-700', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', violet: 'bg-violet-50 text-violet-700' };
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-gray-950">{value}</p>
          {helper && <p className="mt-1 text-xs text-gray-500">{helper}</p>}
        </div>
        <div className={`rounded-xl p-3 ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/root-admin/dashboard')
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard'));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Dashboard</h1>
          <p className="mt-1 text-gray-500">GymDesk's own SaaS metrics, across every subscriber gym.</p>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {!data ? (
          <div className="mt-8 flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" /></div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="MRR" value={`₹${data.mrr.toLocaleString()}`} helper="Active subscribers on a paid plan" icon={IndianRupee} />
              <StatCard label="ARR" value={`₹${data.arr.toLocaleString()}`} helper="MRR × 12" icon={TrendingUp} tone="blue" />
              <StatCard label="Total subscribers" value={data.totalSubscribers} helper={`${data.activeCount} active · ${data.inactiveCount} inactive`} icon={Building2} tone="violet" />
              <StatCard label="Trials in progress" value={data.trialsInProgress} icon={Users} tone="amber" />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <StatCard label="Churned this month" value={data.churnedThisMonth} icon={TrendingDown} tone="red" />
              <StatCard label="New signups (7d)" value={data.newSignups7Day} icon={UserPlus} />
              <StatCard label="New signups (30d)" value={data.newSignups30Day} icon={UserPlus} tone="blue" />
            </div>

            {data.planLessActiveCount > 0 && (
              <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {data.planLessActiveCount} active subscriber{data.planLessActiveCount === 1 ? ' has' : 's have'} no platform plan assigned yet — not counted toward MRR.
              </p>
            )}

            <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <h3 className="font-semibold text-gray-900">Gyms at risk of churning</h3>
              </div>
              {data.churnRiskSubscribers.length === 0 ? (
                <p className="px-5 py-6 text-sm text-gray-400">No gyms currently flagged as at-risk.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {data.churnRiskSubscribers.map((s) => (
                    <div key={s.subscriberId} className="flex items-start gap-3 px-5 py-4">
                      <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${s.level === 'high' ? 'bg-red-50 text-red-700' : s.level === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{s.level}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900">{s.gymName}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500"><AlertTriangle className="h-3 w-3" />{s.reasons.join(' · ')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
