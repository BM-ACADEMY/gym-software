import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, IndianRupee, Receipt, Sparkles, Users } from 'lucide-react';
import apiClient from '../../api/client';

const StatCard = ({ label, value, helper, icon: Icon, tone = 'teal' }) => {
  const tones = { teal: 'bg-teal-50 text-teal-700', amber: 'bg-amber-50 text-amber-700', blue: 'bg-blue-50 text-blue-700', violet: 'bg-violet-50 text-violet-700' };
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

const LEVEL_TONE = { high: 'bg-red-50 text-red-700', medium: 'bg-amber-50 text-amber-700', low: 'bg-gray-100 text-gray-600' };

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/admin/dashboard')
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard'));
  }, []);

  return (
    <div className="p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-gray-500">Today's snapshot of your gym.</p>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!data ? (
        <div className="mt-8 flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" /></div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Today's check-ins" value={data.todaysCheckIns} icon={CheckCircle2} />
            <StatCard label="Active members" value={data.activeMembers} icon={Users} tone="blue" />
            <StatCard label="Expiring this week" value={data.expiringThisWeek} icon={CalendarClock} tone="amber" />
            <StatCard label="Revenue this month" value={`₹${data.revenueThisMonth.toLocaleString()}`} icon={IndianRupee} tone="violet" />
            <StatCard label="Pending payments" value={`₹${data.pendingPayments.amount.toLocaleString()}`} helper={`${data.pendingPayments.count} invoice${data.pendingPayments.count === 1 ? '' : 's'}`} icon={Receipt} tone="amber" />
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
              <Sparkles className="h-4 w-4 text-violet-600" />
              <h3 className="font-semibold text-gray-900">Members needing attention</h3>
            </div>
            {data.retentionRiskMembers.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400">No members currently flagged as at-risk.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.retentionRiskMembers.map((m) => (
                  <div key={m.memberId} className="flex items-start gap-3 px-5 py-4">
                    <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${LEVEL_TONE[m.level]}`}>{m.level}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900">{m.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{m.reasons.join(' · ')}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-teal-700"><AlertTriangle className="h-3 w-3" />{m.suggestedAction}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
