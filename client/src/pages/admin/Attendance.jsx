import { useEffect, useState } from 'react';
import { Clock, LogIn, LogOut, Search, Users } from 'lucide-react';
import apiClient from '../../api/client';
import useSuspended from '../../hooks/useSuspended';

const METHODS = [
  { value: 'manual', label: 'Manual (staff-marked)' },
  { value: 'qr', label: 'QR scan' },
  { value: 'code', label: 'Check-in code' },
  { value: 'biometric', label: 'Biometric' },
];

const StatCard = ({ label, value, icon: Icon }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="mt-2 text-3xl font-bold text-gray-950">{value}</p>
      </div>
      <div className="rounded-xl bg-teal-50 p-3 text-teal-700"><Icon className="h-5 w-5" /></div>
    </div>
  </div>
);

const Attendance = () => {
  const suspended = useSuspended();
  const [summary, setSummary] = useState({ checkedInToday: 0, currentlyInside: 0 });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('manual');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [summaryRes, recordsRes] = await Promise.all([
        apiClient.get('/admin/attendance/today-summary'),
        apiClient.get('/admin/attendance'),
      ]);
      setSummary(summaryRes.data.data);
      setRecords(recordsRes.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await apiClient.get('/admin/members', { params: { search: search || undefined, limit: 10 } });
      setMembers(res.data.data.members);
    } catch {
      // Non-fatal — search box just stays empty.
    }
  };

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => {
    const timer = setTimeout(fetchMembers, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const checkIn = async (memberId) => {
    setBusyId(memberId);
    setError('');
    try {
      const res = await apiClient.post('/admin/attendance', { memberId, method, sessionType: 'general' });
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
      await apiClient.patch(`/admin/attendance/${attendanceId}/check-out`);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Check-out failed');
    } finally {
      setBusyId(null);
    }
  };

  const recordFor = (memberId) => records.find((r) => r.memberId?._id === memberId && !r.checkedOutAt);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="mt-1 text-gray-500">Check members in and monitor today's floor activity.</p>
        </div>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-xl border border-gray-200 bg-white py-2.5 px-3.5 text-sm outline-none">
          {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {error && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Checked in today" value={summary.checkedInToday} icon={Users} />
        <StatCard label="Currently inside" value={summary.currentlyInside} icon={Clock} />
      </div>

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-gray-900">Quick check-in</h3>
            <p className="mt-1 text-xs text-gray-500">Find a member and tap to check them in or out.</p>
          </div>
          <label className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find member..." className="w-56 rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
          </label>
        </div>
        <div className="divide-y divide-gray-100">
          {members.length === 0 && <p className="px-5 py-6 text-sm text-gray-400">No members found.</p>}
          {members.map((m) => {
            const open = recordFor(m._id);
            const busy = busyId === m._id || busyId === open?._id;
            return (
              <div key={m._id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-40 flex-1">
                  <p className="font-semibold text-gray-900">{m.name}</p>
                  <p className="text-xs text-gray-500">{open ? `Checked in · ${new Date(open.checkedInAt).toLocaleTimeString()}` : 'Not checked in today'}</p>
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${open ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{open ? 'In gym' : 'Away'}</span>
                <button
                  disabled={busy || suspended}
                  onClick={() => (open ? checkOut(open._id) : checkIn(m._id))}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 ${open ? 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50' : 'bg-teal-600 text-white hover:bg-teal-700'}`}
                >
                  {open ? <><LogOut className="h-4 w-4" />Check out</> : <><LogIn className="h-4 w-4" />Check in</>}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4"><h3 className="font-semibold text-gray-900">Today's check-ins</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-5 py-3">Member</th><th className="px-5 py-3">Method</th><th className="px-5 py-3">In</th><th className="px-5 py-3">Out</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">No check-ins yet today.</td></tr>
              ) : records.map((r) => (
                <tr key={r._id}>
                  <td className="px-5 py-3 font-medium text-gray-900">{r.memberId?.name || '—'}</td>
                  <td className="px-5 py-3 capitalize text-gray-600">{r.method}</td>
                  <td className="px-5 py-3 text-gray-600">{new Date(r.checkedInAt).toLocaleTimeString()}</td>
                  <td className="px-5 py-3 text-gray-600">{r.checkedOutAt ? new Date(r.checkedOutAt).toLocaleTimeString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
