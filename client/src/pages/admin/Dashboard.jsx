import { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, IndianRupee, Receipt, Users } from 'lucide-react';
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
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Today's check-ins" value={data.todaysCheckIns} icon={CheckCircle2} />
          <StatCard label="Active members" value={data.activeMembers} icon={Users} tone="blue" />
          <StatCard label="Expiring this week" value={data.expiringThisWeek} icon={CalendarClock} tone="amber" />
          <StatCard label="Revenue this month" value={`₹${data.revenueThisMonth.toLocaleString()}`} icon={IndianRupee} tone="violet" />
          <StatCard label="Pending payments" value={`₹${data.pendingPayments.amount.toLocaleString()}`} helper={`${data.pendingPayments.count} invoice${data.pendingPayments.count === 1 ? '' : 's'}`} icon={Receipt} tone="amber" />
        </div>
      )}

      <p className="mt-8 text-xs text-gray-400">Predicted no-shows and retention-risk insights will appear here once the AI layer is built (later in the roadmap).</p>
    </div>
  );
};

export default Dashboard;
