import { useEffect, useState } from 'react';
import { CalendarCheck, Flame, LogIn } from 'lucide-react';
import { Button, Card, CardTitle, Page, PageHeader, Pill, Stat } from '../subadmin/ui';
import apiClient from '../../api/client';
import useSuspended from '../../hooks/useSuspended';

const Attendance = () => {
  const suspended = useSuspended();
  const [records, setRecords] = useState([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/member/attendance');
      setRecords(res.data.data.records);
      setStreak(res.data.data.streak);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAttendance(); }, []);

  const checkIn = async () => {
    setCheckingIn(true);
    setError('');
    try {
      const res = await apiClient.post('/member/attendance/check-in');
      if (res.data.warning) setError(res.data.warning);
      await fetchAttendance();
    } catch (err) {
      setError(err.response?.data?.message || 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  const openToday = records.find((r) => !r.checkedOutAt && new Date(r.checkedInAt).toDateString() === new Date().toDateString());

  return (
    <Page>
      <PageHeader eyebrow="Customer workspace" title="Session attendance" description="Track your gym visits in one place." actions={
        <Button onClick={checkIn} disabled={checkingIn || !!openToday || suspended}>
          <LogIn className="h-4 w-4" /> {openToday ? 'Already checked in' : checkingIn ? 'Checking in...' : 'Check in now'}
        </Button>
      } />

      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Current streak" value={`${streak} day${streak === 1 ? '' : 's'}`} icon={Flame} tone="amber" />
        <Stat label="Total visits recorded" value={records.length} icon={CalendarCheck} />
      </div>

      <Card>
        <CardTitle title="Recent check-ins" />
        <div className="max-h-[430px] divide-y divide-gray-100 overflow-y-auto">
          {loading ? (
            <p className="p-5 text-sm text-gray-400">Loading...</p>
          ) : records.length === 0 ? (
            <p className="p-5 text-sm text-gray-400">No visits recorded yet.</p>
          ) : records.map((r) => (
            <div key={r._id} className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-gray-50">
                <span className="text-[10px] font-bold uppercase text-gray-400">{new Date(r.checkedInAt).toLocaleDateString(undefined, { month: 'short' })}</span>
                <span className="font-bold text-gray-900">{new Date(r.checkedInAt).getDate()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{new Date(r.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="mt-1 text-xs text-gray-500 capitalize">{r.method} check-in{r.checkedOutAt ? ` · out ${new Date(r.checkedOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
              </div>
              <Pill tone={r.checkedOutAt ? 'gray' : 'green'}>{r.checkedOutAt ? 'Complete' : 'In gym'}</Pill>
            </div>
          ))}
        </div>
      </Card>
    </Page>
  );
};

export default Attendance;
