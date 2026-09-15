import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, Receipt } from 'lucide-react';
import apiClient from '../../api/client';
import Badge from '../../components/ui/Badge';

const STATUS_TONE = { pending: 'gray', paid: 'green', failed: 'red', refunded: 'blue' };

const Billing = () => {
  const [invoices, setInvoices] = useState([]);
  const [failedQueue, setFailedQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [invoicesRes, queueRes] = await Promise.all([
        apiClient.get('/root-admin/billing/invoices'),
        apiClient.get('/root-admin/billing/failed-queue'),
      ]);
      setInvoices(invoicesRes.data.data);
      setFailedQueue(queueRes.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load billing');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const markPaid = async (invoice) => {
    try {
      await apiClient.patch(`/root-admin/billing/invoices/${invoice._id}/mark-paid`);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark paid');
    }
  };

  const retry = async (invoice) => {
    try {
      await apiClient.post(`/root-admin/billing/invoices/${invoice._id}/retry`);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send dunning notice');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Invoices</h1>
          <p className="mt-1 text-gray-500">Platform subscription invoices, auto-generated on each gym's billing cycle.</p>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {failedQueue.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/40">
            <div className="flex items-center gap-2 border-b border-amber-100 px-5 py-4"><AlertTriangle className="h-4 w-4 text-amber-600" /><h3 className="font-semibold text-amber-900">Failed-payment retry queue</h3></div>
            <div className="divide-y divide-amber-100">
              {failedQueue.map((inv) => (
                <div key={inv._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{inv.subscriberId?.gymName}</p>
                    <p className="text-xs text-gray-500">₹{inv.amount.toLocaleString()} · {inv.planId?.name} · {inv.retryCount} retr{inv.retryCount === 1 ? 'y' : 'ies'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => retry(inv)} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50"><Bell className="h-3.5 w-3.5" />Send dunning</button>
                    <button onClick={() => markPaid(inv)} className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700">Mark paid</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4"><h3 className="font-semibold text-gray-900">All invoices</h3></div>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Gym</th><th className="px-5 py-3">Plan</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Loading...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400"><Receipt className="mx-auto mb-2 h-6 w-6" />No invoices yet.</td></tr>
              ) : invoices.map((inv) => (
                <tr key={inv._id}>
                  <td className="px-5 py-4 font-mono text-xs text-gray-500">{inv.invoiceNumber}</td>
                  <td className="px-5 py-4 font-medium text-gray-900">{inv.subscriberId?.gymName || '—'}</td>
                  <td className="px-5 py-4 text-gray-600">{inv.planId?.name || '—'}</td>
                  <td className="px-5 py-4 text-gray-600">₹{inv.amount.toLocaleString()}</td>
                  <td className="px-5 py-4"><Badge tone={STATUS_TONE[inv.status]}>{inv.status}</Badge></td>
                  <td className="px-5 py-4">
                    {inv.status !== 'paid' && (
                      <button onClick={() => markPaid(inv)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Mark paid</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Billing;
