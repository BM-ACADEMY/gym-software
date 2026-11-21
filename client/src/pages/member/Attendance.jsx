import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight, Flame, LogIn } from 'lucide-react';
import { Button, Card, CardTitle, Page, PageHeader, Pill, Stat } from '../subadmin/ui';
import apiClient from '../../api/client';
import useSuspended from '../../hooks/useSuspended';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const toKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const AttendanceCalendar = ({ records, month, onPrev, onNext }) => {
  const attendedDays = useMemo(() => {
    const map = new Map();
    records.forEach((r) => {
      const d = new Date(r.checkedInAt);
      const key = toKey(d);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [records]);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstOfMonth = new Date(year, monthIndex, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const today = new Date();

  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

  return (
    <Card>
      <CardTitle
        title="Attendance calendar"
        action={
          <div className="flex items-center gap-1">
            <button onClick={onPrev} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
            <span className="w-32 text-center text-sm font-semibold text-gray-900">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
            <button onClick={onNext} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
          </div>
        }
      />
      <div className="p-5">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-gray-400">
          {WEEKDAYS.map((w, i) => <div key={i} className="py-1">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={`blank-${i}`} />;
            const cellDate = new Date(year, monthIndex, day);
            const visits = attendedDays.get(toKey(cellDate)) || 0;
            const isToday = toKey(cellDate) === toKey(today);
            return (
              <div
                key={day}
                className={[
                  'flex aspect-square flex-col items-center justify-center rounded-lg text-sm',
                  visits > 0 ? 'bg-teal-600 font-semibold text-white' : 'bg-gray-50 text-gray-600',
                  isToday && visits === 0 ? 'ring-2 ring-teal-300' : '',
                  isToday && visits > 0 ? 'ring-2 ring-teal-800' : '',
                ].join(' ')}
                title={visits > 0 ? `${visits} visit${visits > 1 ? 's' : ''}` : undefined}
              >
                {day}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
          <span className="h-3 w-3 rounded bg-teal-600" /> Checked in
          <span className="ml-3 h-3 w-3 rounded ring-2 ring-teal-300" /> Today
        </div>
      </div>
    </Card>
  );
};

const Attendance = () => {
  const suspended = useSuspended();
  const [records, setRecords] = useState([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

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

      <AttendanceCalendar
        records={records}
        month={calendarMonth}
        onPrev={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
        onNext={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
      />

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
