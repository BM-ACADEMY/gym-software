import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { CalendarClock, CheckCircle2, Dumbbell, IndianRupee, Receipt, Users } from 'lucide-react';
import { selectCurrentUser } from '../../store/slices/authSlice';
import { Card, CardTitle, Page, PageHeader, Pill, Stat } from './ui';
import apiClient from '../../api/client';

const SESSION_STATUS_TONE = { scheduled: 'blue', completed: 'green', no_show: 'red' };
const SESSION_STATUS_LABEL = { scheduled: 'Upcoming', completed: 'Completed', no_show: 'No-show' };

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
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Stat label="Today's check-ins" value={data.todaysCheckIns} icon={CheckCircle2} />
            <Stat label="Active members" value={data.activeMembers} icon={Users} tone="blue" />
            <Stat label="Expiring this week" value={data.expiringThisWeek} icon={CalendarClock} tone="amber" />
            <Stat label="Revenue this month" value={`₹${data.revenueThisMonth.toLocaleString()}`} icon={IndianRupee} tone="violet" />
            <Stat label="Pending payments" value={`₹${data.pendingPayments.amount.toLocaleString()}`} helper={`${data.pendingPayments.count} invoice${data.pendingPayments.count === 1 ? '' : 's'}`} icon={Receipt} tone="amber" />
          </div>

          <Card>
            <CardTitle title="Today's PT sessions" description={`${data.todaysSessions.length} session${data.todaysSessions.length === 1 ? '' : 's'} scheduled today`} />
            <div className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
              {data.todaysSessions.length === 0 ? (
                <p className="p-5 text-sm text-gray-400">No PT sessions scheduled for today.</p>
              ) : data.todaysSessions.map((s) => (
                <div key={s._id} className="flex items-center gap-4 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600"><Dumbbell className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{s.memberName}</p>
                    <p className="text-xs text-gray-500">{new Date(s.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <Pill tone={SESSION_STATUS_TONE[s.status] || 'gray'}>{SESSION_STATUS_LABEL[s.status] || s.status}</Pill>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </Page>
  );
};
export default Dashboard;
