import { useEffect, useMemo, useState } from 'react';
import { Download, Receipt } from 'lucide-react';
import { Button, Card, Empty, Page, PageHeader, Pill, SearchBox } from './ui';
import apiClient from '../../api/client';

const STATUS_PILL = { pending: 'gray', partial: 'amber', paid: 'green', overdue: 'red', refunded: 'blue' };

const PaymentHistory = () => {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const params = status === 'All' ? {} : { status: status.toLowerCase() };
      const res = await apiClient.get('/subadmin/payment-history', { params });
      setRows(res.data.data.rows);
      setTotal(res.data.data.total);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLedger(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(
    () => rows.filter((r) => `${r.memberName} ${r.invoiceNumber}`.toLowerCase().includes(q.toLowerCase())),
    [rows, q]
  );

  const exportCsv = async () => {
    const params = status === 'All' ? {} : { status: status.toLowerCase() };
    const res = await apiClient.get('/subadmin/payment-history/export', { params, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'payment-history.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Page>
      <PageHeader title="Payment history" description="Review payments for your assigned members. Records are read-only." actions={<Button variant="secondary" onClick={exportCsv}><Download className="h-4 w-4" />Export CSV</Button>} />
      <div className="flex gap-3">
        <SearchBox value={q} onChange={setQ} placeholder="Search member or invoice..." />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-4 text-sm">
          <option>All</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="pending">Pending</option><option value="refunded">Refunded</option>
        </select>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>{['Invoice', 'Member', 'Date', 'Method', 'Amount', 'Status'].map((x) => <th key={x} className="px-5 py-3">{x}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!loading && filtered.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-5 py-4 font-mono text-xs text-gray-500">{r.invoiceNumber}</td>
                  <td className="px-5 py-4 font-semibold">{r.memberName}</td>
                  <td className="px-5 py-4 text-gray-600">{new Date(r.paidAt).toLocaleDateString()}</td>
                  <td className="px-5 py-4 uppercase">{r.method}</td>
                  <td className="px-5 py-4 font-bold">₹{r.amount.toLocaleString()}</td>
                  <td className="px-5 py-4"><Pill tone={STATUS_PILL[r.invoiceStatus] || 'gray'}>{r.invoiceStatus}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="px-5 py-12 text-center text-sm text-gray-400">Loading...</div>}
          {!loading && !filtered.length && <Empty title="No transactions found" text="Try a different search or status." />}
        </div>
      </Card>
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Showing {filtered.length} transactions</span>
        <span className="flex items-center gap-2"><Receipt className="h-4 w-4" />Total: <b className="text-gray-900">₹{total.toLocaleString()}</b></span>
      </div>
    </Page>
  );
};
export default PaymentHistory;
