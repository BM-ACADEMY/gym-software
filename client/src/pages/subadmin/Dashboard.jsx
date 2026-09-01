import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { CalendarClock, CheckCircle2, IndianRupee, Receipt, Users } from 'lucide-react';
import { selectCurrentUser } from '../../store/slices/authSlice';
import { Page, PageHeader, Stat } from './ui';
import apiClient from '../../api/client';

const Dashboard = () => {
  const user = useSelector(selectCurrentUser);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/subadmin/dashboard')
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard'));
  }, []);

  return (
    <Page>
      <PageHeader title={`Good day, ${user?.name?.split(' ')[0] || 'there'}!`} description="Today's snapshot for your assigned members." />
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!data ? (
        <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Stat label="Today's check-ins" value={data.todaysCheckIns} icon={CheckCircle2} />
          <Stat label="Active members" value={data.activeMembers} icon={Users} tone="blue" />
          <Stat label="Expiring this week" value={data.expiringThisWeek} icon={CalendarClock} tone="amber" />
          <Stat label="Revenue this month" value={`₹${data.revenueThisMonth.toLocaleString()}`} icon={IndianRupee} tone="violet" />
          <Stat label="Pending payments" value={`₹${data.pendingPayments.amount.toLocaleString()}`} helper={`${data.pendingPayments.count} invoice${data.pendingPayments.count === 1 ? '' : 's'}`} icon={Receipt} tone="amber" />
        </div>
      )}
      <p className="text-xs text-gray-400">Today's PT session schedule and commission-earned appear here once PT Sessions and Earnings are built.</p>
    </Page>
  );
};
export default Dashboard;
