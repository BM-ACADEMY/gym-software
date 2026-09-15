import { useEffect, useState } from 'react';
import { Download, Receipt } from 'lucide-react';
import apiClient from '../../api/client';
import Badge from '../../components/ui/Badge';
import { downloadFile } from '../../utils/downloadFile';

const STATUS_TONE = { pending: 'gray', partial: 'amber', paid: 'green', overdue: 'red', refunded: 'blue' };
const METHODS = ['cash', 'upi', 'card', 'gateway'];
const STATUSES = ['pending', 'partial', 'paid', 'refunded'];

const emptyFilters = { memberId: '', method: '', status: '', dateFrom: '', dateTo: '' };

const PaymentHistory = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(emptyFilters);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const res = await apiClient.get('/admin/payment-history', { params });
      setRows(res.data.data.rows);
      setTotal(res.data.data.total);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load payment history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchLedger, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const exportCsv = async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const res = await apiClient.get('/admin/payment-history/export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'payment-history.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to export CSV');
    }
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
          <p className="mt-1 text-gray-500">Full transaction ledger, filterable and exportable.</p>
        </div>
        <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mt-6 flex flex-wrap gap-3">
        <select value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })} className="rounded-xl border border-gray-200 bg-white py-2.5 px-3.5 text-sm outline-none">
          <option value="">All methods</option>
          {METHODS.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="rounded-xl border border-gray-200 bg-white py-2.5 px-3.5 text-sm outline-none">
          <option value="">All invoice statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
        <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="rounded-xl border border-gray-200 bg-white py-2.5 px-3.5 text-sm outline-none" />
        <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="rounded-xl border border-gray-200 bg-white py-2.5 px-3.5 text-sm outline-none" />
        {(filters.method || filters.status || filters.dateFrom || filters.dateTo) && (
          <button onClick={() => setFilters(emptyFilters)} className="rounded-xl px-3 py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-50">Clear filters</button>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Member</th><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Method</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Invoice status</th><th className="px-5 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">No transactions found.</td></tr>
              ) : rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-5 py-3 text-gray-600">{new Date(r.paidAt).toLocaleString()}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{r.memberName}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{r.invoiceNumber}</td>
                  <td className="px-5 py-3 uppercase text-gray-600">{r.method}</td>
                  <td className="px-5 py-3 font-semibold text-gray-900">₹{r.amount.toLocaleString()}</td>
                  <td className="px-5 py-3"><Badge tone={STATUS_TONE[r.invoiceStatus] || 'gray'}>{r.invoiceStatus}</Badge></td>
                  <td className="px-5 py-3">
                    <button onClick={() => downloadFile(apiClient, `/admin/payment/${r.paymentId}/invoice.pdf`, `${r.invoiceNumber || r.paymentId}.pdf`)} title="Download invoice" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"><Download className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <span>Showing {rows.length} transaction{rows.length === 1 ? '' : 's'}</span>
        <span className="flex items-center gap-2"><Receipt className="h-4 w-4" />Total: <b className="text-gray-900">₹{total.toLocaleString()}</b></span>
      </div>
    </div>
  );
};

export default PaymentHistory;
