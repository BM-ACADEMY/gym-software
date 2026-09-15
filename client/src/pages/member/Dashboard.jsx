import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { CalendarClock, Flame, IdCard, TicketCheck } from 'lucide-react';
import { Card, CardTitle, Page, PageHeader, Stat } from '../subadmin/ui';
import { selectCurrentUser } from '../../store/slices/authSlice';
import apiClient from '../../api/client';

const Dashboard = () => {
  const user = useSelector(selectCurrentUser);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    apiClient.get('/member/dashboard')
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard'));
  }, []);

  return (
    <Page>
      <PageHeader eyebrow="Customer workspace" title={`Welcome back, ${user?.name?.split(' ')[0] || 'there'}!`} description="Your plan, next session, and streak at a glance." />
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!data ? (
        <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Plan status" value={data.planStatus.planName || 'No plan'} helper={data.planStatus.status} icon={TicketCheck} />
            <Stat label="Days remaining" value={data.planStatus.daysRemaining ?? '—'} icon={CalendarClock} tone="blue" />
            <Stat label="Current streak" value={`${data.streak} day${data.streak === 1 ? '' : 's'}`} icon={Flame} tone="amber" />
            <button onClick={() => setShowQr(true)} className="rounded-2xl border border-dashed border-teal-300 bg-teal-50 p-5 text-left transition hover:bg-teal-100">
              <div className="flex items-center gap-2 text-teal-700"><IdCard className="h-5 w-5" /><span className="text-sm font-semibold">Quick check-in QR</span></div>
              <p className="mt-2 text-xs text-teal-600">Tap to show your check-in code</p>
            </button>
          </div>

          <Card>
            <CardTitle title="Next PT session" />
            <div className="p-5">
              {data.nextSession ? (
                <div>
                  <p className="font-semibold text-gray-900">{new Date(data.nextSession.scheduledAt).toLocaleString()}</p>
                  <p className="mt-1 text-sm text-gray-500">with {data.nextSession.subAdminId?.name || 'your trainer'}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No upcoming PT sessions.</p>
              )}
            </div>
          </Card>
        </>
      )}

      {showQr && data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4" onMouseDown={() => setShowQr(false)}>
          <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Check-in QR</h3>
            <p className="text-xs text-gray-500">Show this at the entrance scanner</p>
            <img src={data.qrCode} alt="Check-in QR code" className="mx-auto mt-4 h-48 w-48" />
            <button onClick={() => setShowQr(false)} className="mt-4 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Close</button>
          </div>
        </div>
      )}
    </Page>
  );
};

export default Dashboard;
