import { useEffect, useState } from 'react';
import { Line, LineChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Sparkles, TrendingUp } from 'lucide-react';
import apiClient from '../../api/client';

const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const StatCard = ({ label, value, helper }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <p className="text-sm font-medium text-gray-500">{label}</p>
    <p className="mt-2 text-3xl font-bold text-gray-950">{value}</p>
    {helper && <p className="mt-1 text-xs text-gray-500">{helper}</p>}
  </div>
);

const ChartCard = ({ title, children }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <h3 className="mb-4 font-semibold text-gray-900">{title}</h3>
    <div className="h-64">{children}</div>
  </div>
);

const ReportsAnalytics = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/admin/reports-analytics')
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load reports'));
  }, []);

  return (
    <div className="p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="mt-1 text-gray-500">Trends for the last 30 days.</p>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!data ? (
        <div className="mt-8 flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" /></div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Active members" value={data.retention.activeMembers} />
            <StatCard label="New members (30d)" value={data.retention.newMembersThisPeriod} />
            <StatCard label="Retention rate" value={`${Math.round(data.retention.retentionRate * 100)}%`} helper={`${data.retention.churnedThisPeriod} churned this period`} />
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-600" /><h3 className="font-semibold text-gray-900">Monthly narrative</h3></div>
            <p className="text-sm text-gray-700">{data.narrative.summary}</p>
            {data.narrative.suggestions?.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {data.narrative.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600"><span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-teal-500" />{s}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ChartCard title="Attendance trend">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.attendanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip labelFormatter={fmtDate} />
                  <Line type="monotone" dataKey="count" name="Check-ins" stroke="#0d9488" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              {data.attendanceTrend.length === 0 && <p className="mt-[-140px] text-center text-sm text-gray-400">No attendance data yet.</p>}
            </ChartCard>

            <ChartCard title="Revenue trend">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={fmtDate} formatter={(v) => [`₹${v.toLocaleString()}`, 'Revenue']} />
                  <Line type="monotone" dataKey="total" name="Revenue" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              {data.revenueTrend.length === 0 && <p className="mt-[-140px] text-center text-sm text-gray-400">No revenue data yet.</p>}
            </ChartCard>

            <ChartCard title="Member growth">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.memberGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip labelFormatter={fmtDate} />
                  <Bar dataKey="newMembers" name="New members" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {data.memberGrowth.length === 0 && <p className="mt-[-140px] text-center text-sm text-gray-400">No new members in this period.</p>}
            </ChartCard>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 font-semibold text-gray-900">Retention & churn</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Active members now</span><b>{data.retention.activeMembers}</b></div>
                <div className="flex justify-between"><span className="text-gray-500">New members this period</span><b>{data.retention.newMembersThisPeriod}</b></div>
                <div className="flex justify-between"><span className="text-gray-500">Churned this period</span><b>{data.retention.churnedThisPeriod}</b></div>
                <div className="flex justify-between border-t border-gray-100 pt-3"><span className="text-gray-500">Retention rate</span><b className="text-teal-700">{Math.round(data.retention.retentionRate * 100)}%</b></div>
              </div>
              <p className="mt-4 flex items-start gap-1.5 text-xs text-gray-400"><TrendingUp className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />Churn is estimated from members who lapsed during this period, based on when their record last changed status.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsAnalytics;
