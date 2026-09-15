import { useEffect, useState } from 'react';
import { Line, LineChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Download, FileText, TrendingDown } from 'lucide-react';
import apiClient from '../../api/client';
import { downloadFile } from '../../utils/downloadFile';

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

const Analytics = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/root-admin/analytics')
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load analytics'));
  }, []);

  const exportCsv = async () => {
    const res = await apiClient.get('/root-admin/analytics/export', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'platform-analytics.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="mt-1 text-gray-500">Platform-wide revenue, growth, and churn — last 30 days.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button onClick={() => downloadFile(apiClient, '/root-admin/analytics/export.pdf', 'platform-analytics.pdf')} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <FileText className="h-4 w-4" /> Export PDF
            </button>
          </div>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {!data ? (
          <div className="mt-8 flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" /></div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <StatCard label="Active subscribers" value={data.churn.activeSubscribers} />
              <StatCard label="Churned (30d)" value={data.churn.churnedThisPeriod} />
              <StatCard label="Churn rate" value={`${Math.round(data.churn.churnRate * 100)}%`} />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <ChartCard title="Platform revenue trend">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.revenueTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={fmtDate} formatter={(v) => [`₹${v.toLocaleString()}`, 'Revenue']} />
                    <Line type="monotone" dataKey="total" stroke="#0d9488" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                {data.revenueTrend.length === 0 && <p className="mt-[-140px] text-center text-sm text-gray-400">No paid platform invoices yet.</p>}
              </ChartCard>

              <ChartCard title="Subscriber growth">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.growthChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip labelFormatter={fmtDate} />
                    <Bar dataKey="newSubscribers" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {data.growthChart.length === 0 && <p className="mt-[-140px] text-center text-sm text-gray-400">No new signups in this period.</p>}
              </ChartCard>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 font-semibold text-gray-900">Plan distribution</h3>
                <div className="space-y-2">
                  {data.planDistribution.map((p) => (
                    <div key={p.planId || 'none'} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                      <span className="text-gray-700">{p.planName}</span>
                      <span className="font-semibold text-gray-900">{p.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 font-semibold text-gray-900">Top-performing gyms</h3>
                {data.topGyms.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-gray-400"><TrendingDown className="h-4 w-4" />No gym revenue recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {data.topGyms.map((g, i) => (
                      <div key={g.subscriberId} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                        <span className="text-gray-700">#{i + 1} {g.gymName}</span>
                        <span className="font-semibold text-gray-900">₹{g.revenue.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Analytics;
