import { useEffect, useState, useCallback } from 'react';
import apiClient from '../../api/client';

const today = () => new Date().toLocaleDateString('en-CA');
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');

const COLORS = { present: 'bg-green-100 text-green-800', leave: 'bg-amber-100 text-amber-800', absent: 'bg-red-100 text-red-800' };

const StaffAttendance = () => {
  const [date, setDate] = useState(today());
  const [day, setDay] = useState(null);
  const [month, setMonth] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [d, m] = await Promise.all([
        apiClient.get('/admin/staff-attendance', { params: { date } }),
        apiClient.get('/admin/staff-attendance/month', { params: { month: date.slice(0, 7) } }),
      ]);
      setDay(d.data.data);
      setMonth(m.data.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load staff attendance.');
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const mark = async (staffId, status) => {
    try {
      await apiClient.put('/admin/staff-attendance', { staffId, date, status });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff attendance</h1>
          <p className="mt-1 text-sm text-gray-600">Mark your trainers and staff, or import your biometric device log to fill this in automatically.</p>
        </div>
        <input type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600"><tr><th className="p-3">Staff</th><th className="p-3">Status</th><th className="p-3">In / Out</th><th className="p-3">Mark</th></tr></thead>
          <tbody>
            {day?.staff.length === 0 && <tr><td colSpan={4} className="p-4 text-gray-500">No staff yet. Add staff under Sub-Admin / Staff.</td></tr>}
            {day?.staff.map((s) => (
              <tr key={s.id} className="border-t border-gray-100">
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3">{s.record ? <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${COLORS[s.record.status]}`}>{s.record.status}</span> : <span className="text-gray-400">Not marked</span>}</td>
                <td className="p-3 text-gray-600">{s.record?.inAt ? `${fmtTime(s.record.inAt)}${s.record.outAt ? ` to ${fmtTime(s.record.outAt)}` : ''}` : '-'}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    {['present', 'leave', 'absent'].map((st) => (
                      <button key={st} onClick={() => mark(s.id, st)} className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold capitalize hover:bg-gray-50">{st}</button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold">This month ({month?.month})</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600"><tr><th className="p-3">Staff</th><th className="p-3">Present</th><th className="p-3">Leave</th><th className="p-3">Absent</th></tr></thead>
            <tbody>
              {month?.rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100"><td className="p-3 font-medium">{r.name}</td><td className="p-3">{r.present}</td><td className="p-3">{r.leave}</td><td className="p-3">{r.absent}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StaffAttendance;
