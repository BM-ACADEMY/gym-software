import { useEffect, useState } from 'react';
import { AlertTriangle, IndianRupee, Plus, Receipt } from 'lucide-react';
import apiClient from '../../api/client';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';

const STATUS_TONE = { pending: 'gray', partial: 'amber', paid: 'green', overdue: 'red', refunded: 'blue' };
const METHODS = ['cash', 'upi', 'card'];

const emptyForm = { memberId: '', amount: '', amountNow: '', method: 'cash', dueDate: '', note: '' };
const installmentForm = { amount: '', method: 'cash', note: '' };

const Payment = () => {
  const [summary, setSummary] = useState({ collectedToday: 0, collectedTodayCount: 0, pendingDues: 0, pendingDuesCount: 0 });
  const [payments, setPayments] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [installmentTarget, setInstallmentTarget] = useState(null);
  const [instForm, setInstForm] = useState(installmentForm);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [summaryRes, paymentsRes] = await Promise.all([
        apiClient.get('/admin/payment/today-summary'),
        apiClient.get('/admin/payment'),
      ]);
      setSummary(summaryRes.data.data);
      setPayments(paymentsRes.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openForm = async () => {
    setForm(emptyForm);
    setFormOpen(true);
    try {
      const res = await apiClient.get('/admin/members', { params: { limit: 100 } });
      setMembers(res.data.data.members);
    } catch {
      // Member dropdown just stays empty.
    }
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/admin/payment', {
        memberId: form.memberId,
        amount: Number(form.amount),
        amountNow: form.amountNow === '' ? Number(form.amount) : Number(form.amountNow),
        method: form.method,
        dueDate: form.dueDate || undefined,
        note: form.note || undefined,
      });
      setFormOpen(false);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const submitInstallment = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiClient.patch(`/admin/payment/${installmentTarget._id}/installment`, {
        amount: Number(instForm.amount), method: instForm.method, note: instForm.note || undefined,
      });
      setInstallmentTarget(null);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record installment');
    } finally {
      setSaving(false);
    }
  };

  const refund = async (payment) => {
    try {
      await apiClient.patch(`/admin/payment/${payment._id}/refund`);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to refund payment');
    }
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment</h1>
          <p className="mt-1 text-gray-500">Record collections and track dues.</p>
        </div>
        <button onClick={openForm} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700">
          <Plus className="h-4 w-4" /> Record payment
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><p className="text-sm font-medium text-gray-500">Collected today</p><IndianRupee className="h-5 w-5 text-teal-600" /></div>
          <p className="mt-2 text-3xl font-bold text-gray-950">₹{summary.collectedToday.toLocaleString()}</p>
          <p className="mt-1 text-xs text-gray-500">{summary.collectedTodayCount} transaction{summary.collectedTodayCount === 1 ? '' : 's'}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><p className="text-sm font-medium text-gray-500">Pending dues</p><Receipt className="h-5 w-5 text-amber-600" /></div>
          <p className="mt-2 text-3xl font-bold text-gray-950">₹{summary.pendingDues.toLocaleString()}</p>
          <p className="mt-1 text-xs text-gray-500">{summary.pendingDuesCount} invoice{summary.pendingDuesCount === 1 ? '' : 's'}</p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4"><h3 className="font-semibold text-gray-900">Recent payments</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-5 py-3">Member</th><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Paid</th><th className="px-5 py-3">Balance</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">Loading...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">No payments recorded yet.</td></tr>
              ) : payments.map((p) => (
                <tr key={p._id}>
                  <td className="px-5 py-4 font-medium text-gray-900">{p.memberId?.name || '—'}</td>
                  <td className="px-5 py-4 text-xs text-gray-500">{p.invoiceNumber}</td>
                  <td className="px-5 py-4 text-gray-600">₹{p.amount.toLocaleString()}</td>
                  <td className="px-5 py-4 text-gray-600">₹{p.amountPaid.toLocaleString()}</td>
                  <td className="px-5 py-4 text-gray-600">₹{p.balanceDue.toLocaleString()}</td>
                  <td className="px-5 py-4">
                    <Badge tone={STATUS_TONE[p.effectiveStatus] || 'gray'}>
                      {p.effectiveStatus === 'overdue' && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                      {p.effectiveStatus}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    {['pending', 'partial'].includes(p.status) && (
                      <button onClick={() => { setInstallmentTarget(p); setInstForm(installmentForm); }} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Add installment</button>
                    )}
                    {p.status === 'paid' && (
                      <button onClick={() => refund(p)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Refund</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Record payment" footer={
        <>
          <button onClick={() => setFormOpen(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="submit" form="payment-form" disabled={saving} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">{saving ? 'Saving...' : 'Confirm payment'}</button>
        </>
      }>
        <form id="payment-form" onSubmit={submitPayment} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Member</label>
            <select required value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm">
              <option value="">Select a member</option>
              {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Total amount due (₹)</label>
              <input required type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Paying now (₹)</label>
              <input type="number" min="0" value={form.amountNow} onChange={(e) => setForm({ ...form, amountNow: e.target.value })} placeholder="Same as total" className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Method</label>
              <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm capitalize">
                {METHODS.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Due date (optional)</label>
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Note</label>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Annual plan renewal" className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
          </div>
        </form>
      </Modal>

      <Modal open={!!installmentTarget} onClose={() => setInstallmentTarget(null)} title={`Add installment — ${installmentTarget?.memberId?.name || ''}`} footer={
        <>
          <button onClick={() => setInstallmentTarget(null)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="submit" form="installment-form" disabled={saving} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">{saving ? 'Saving...' : 'Record installment'}</button>
        </>
      }>
        <form id="installment-form" onSubmit={submitInstallment} className="space-y-4">
          <p className="text-sm text-gray-500">Remaining balance: ₹{installmentTarget?.balanceDue?.toLocaleString()}</p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Amount (₹)</label>
            <input required type="number" min="1" value={instForm.amount} onChange={(e) => setInstForm({ ...instForm, amount: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Method</label>
            <select value={instForm.method} onChange={(e) => setInstForm({ ...instForm, method: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm capitalize">
              {METHODS.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Payment;
