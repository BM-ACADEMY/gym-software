import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { CalendarDays, Clock, LogIn, LogOut, Users } from 'lucide-react';
import { Button, Card, CardTitle, Page, PageHeader, Pill, SearchBox, Stat } from './ui';
import apiClient from '../../api/client';
import { selectPermissions } from '../../store/slices/authSlice';

const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

const Attendance = () => {
  const permissions = useSelector(selectPermissions);
  const canEdit = Boolean(permissions?.attendance?.edit);

  const [query, setQuery] = useState('');
  const [summary, setSummary] = useState({ checkedInToday: 0, currentlyInside: 0 });
  const [records, setRecords] = useState([]);
  const [members, setMembers] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const fetchAll = async () => {
    try {
      const [summaryRes, recordsRes, membersRes] = await Promise.all([
        apiClient.get('/subadmin/attendance/today-summary'),
        apiClient.get('/subadmin/attendance'),
        apiClient.get('/subadmin/members'),
      ]);
      setSummary(summaryRes.data.data);
      setRecords(recordsRes.data.data);
      setMembers(membersRes.data.data.members);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attendance');
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const recordFor = (memberId) => records.find((r) => r.memberId?._id === memberId && !r.checkedOutAt);

  const checkIn = async (memberId) => {
    setBusyId(memberId);
    setError('');
    try {
      const res = await apiClient.post('/subadmin/attendance', { memberId, method: 'manual', sessionType: 'general' });
      if (res.data.warning) setError(res.data.warning);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Check-in failed');
    } finally {
      setBusyId(null);
    }
  };

  const checkOut = async (attendanceId) => {
    setBusyId(attendanceId);
    try {
      await apiClient.patch(`/subadmin/attendance/${attendanceId}/check-out`);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Check-out failed');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = members.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <Page>
      <PageHeader title="Attendance" description="Check your assigned members in and monitor today's floor activity." />
      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Checked in today" value={summary.checkedInToday} icon={Users} />
        <Stat label="Currently inside" value={summary.currentlyInside} icon={Clock} tone="blue" />
      </div>
      <Card>
        <CardTitle title="Quick check-in" description="Tap a member to update their attendance" action={<SearchBox value={query} onChange={setQuery} placeholder="Find member..." />} />
        <div className="divide-y divide-gray-100">
          {filtered.length === 0 && <p className="px-5 py-6 text-sm text-gray-400">No members found.</p>}
          {filtered.map((m) => {
            const open = recordFor(m._id);
            const busy = busyId === m._id || busyId === open?._id;
            return (
              <div key={m._id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xs font-bold">{initials(m.name)}</div>
                <div className="min-w-40 flex-1">
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-xs text-gray-500">{open ? `Checked in · ${new Date(open.checkedInAt).toLocaleTimeString()}` : 'Not checked in today'}</p>
                </div>
                <Pill tone={open ? 'green' : 'gray'}>{open ? 'In gym' : 'Away'}</Pill>
                {canEdit && (
                  <Button disabled={busy} onClick={() => (open ? checkOut(open._id) : checkIn(m._id))} variant={open ? 'secondary' : 'primary'}>
                    {open ? <><LogOut className="h-4 w-4" />Check out</> : <><LogIn className="h-4 w-4" />Check in</>}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <CardTitle title="Today's check-ins" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-5 py-3">Member</th><th className="px-5 py-3">In</th><th className="px-5 py-3">Out</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.length === 0 ? (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-400"><CalendarDays className="mx-auto mb-2 h-5 w-5" />No check-ins yet today.</td></tr>
              ) : records.map((r) => (
                <tr key={r._id}>
                  <td className="px-5 py-3 font-medium text-gray-900">{r.memberId?.name || '—'}</td>
                  <td className="px-5 py-3 text-gray-600">{new Date(r.checkedInAt).toLocaleTimeString()}</td>
                  <td className="px-5 py-3 text-gray-600">{r.checkedOutAt ? new Date(r.checkedOutAt).toLocaleTimeString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Page>
  );
};
export default Attendance;
