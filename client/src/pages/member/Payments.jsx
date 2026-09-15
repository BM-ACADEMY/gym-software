import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Download, IndianRupee, Receipt, ShieldCheck } from 'lucide-react';
import { Button, Card, Modal, Page, PageHeader, Pill } from '../subadmin/ui';
import apiClient from '../../api/client';
import { downloadFile } from '../../utils/downloadFile';
import { openRazorpayCheckout } from '../../utils/razorpay';
import { selectCurrentUser } from '../../store/slices/authSlice';
import useSuspended from '../../hooks/useSuspended';

const STATUS_TONE = { pending: 'gray', partial: 'amber', paid: 'green', overdue: 'red', refunded: 'blue' };

const Payments = () => {
  const user = useSelector(selectCurrentUser);
  const suspended = useSuspended();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payTarget, setPayTarget] = useState(null);
  const [paying, setPaying] = useState(false);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/member/payments');
      setPayments(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayments(); }, []);

  const confirmPay = async () => {
    setPaying(true);
    setError('');
    try {
      const checkoutRes = await apiClient.post(`/member/payments/${payTarget._id}/checkout`, {});
      const order = checkoutRes.data.data;

      if (order.provider === 'razorpay') {
        await openRazorpayCheckout({
          order,
          description: `Invoice ${payTarget.invoiceNumber}`,
          prefill: { name: user?.name, contact: user?.phone, email: user?.email },
          onSuccess: async (response) => {
            try {
              await apiClient.post(`/member/payments/${payTarget._id}/verify-razorpay`, response);
              setPayTarget(null);
              await fetchPayments();
            } catch (err) {
              setError(err.response?.data?.message || 'Payment verification failed');
            } finally {
              setPaying(false);
            }
          },
          onDismiss: () => setPaying(false),
        });
        return;
      }

      // No real gateway configured yet — "simulate-payment" stands in for a
      // gateway's hosted checkout, running through the exact same
      // webhook/idempotency code a real integration uses.
      await apiClient.post(`/member/payments/${payTarget._id}/simulate-payment`, {});
      setPayTarget(null);
      await fetchPayments();
      setPaying(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed');
      setPaying(false);
    }
  };

  return (
    <Page>
      <PageHeader eyebrow="Customer workspace" title="Payments" description="Pay online for renewals and review your payment history." />
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Balance</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No invoices yet.</td></tr>
              ) : payments.map((p) => (
                <tr key={p._id}>
                  <td className="px-5 py-4 font-mono text-xs text-gray-500">{p.invoiceNumber}</td>
                  <td className="px-5 py-4 text-gray-600">₹{p.amount.toLocaleString()}</td>
                  <td className="px-5 py-4 font-semibold text-gray-900">₹{p.balanceDue.toLocaleString()}</td>
                  <td className="px-5 py-4"><Pill tone={STATUS_TONE[p.status]}>{p.status}</Pill></td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {['pending', 'partial'].includes(p.status) && (
                        <Button onClick={() => setPayTarget(p)} disabled={suspended} className="!px-3 !py-1.5 text-xs"><IndianRupee className="h-3.5 w-3.5" />Pay now</Button>
                      )}
                      <button onClick={() => downloadFile(apiClient, `/member/payments/${p._id}/invoice.pdf`, `${p.invoiceNumber || p._id}.pdf`)} title="Download invoice" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"><Download className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!payTarget} title="Pay online" onClose={() => setPayTarget(null)} footer={
        <><Button variant="secondary" onClick={() => setPayTarget(null)}>Cancel</Button><Button onClick={confirmPay} disabled={paying}>{paying ? 'Processing...' : `Pay ₹${payTarget?.balanceDue?.toLocaleString()}`}</Button></>
      }>
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm text-gray-500"><Receipt className="h-4 w-4" />Invoice {payTarget?.invoiceNumber}</p>
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            <ShieldCheck className="h-5 w-5 flex-shrink-0 text-teal-600" />
            You'll be taken to a secure checkout to complete this payment via UPI or card.
          </div>
        </div>
      </Modal>
    </Page>
  );
};

export default Payments;
