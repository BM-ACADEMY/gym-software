import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Banknote, CheckCircle2, CreditCard, IndianRupee, QrCode, Receipt } from 'lucide-react';
import { Button, Card, CardTitle, Field, Page, PageHeader, Pill, Stat } from './ui';
import apiClient from '../../api/client';
import { selectPermissions } from '../../store/slices/authSlice';

const METHODS = [['UPI', 'upi', QrCode], ['Card', 'card', CreditCard], ['Cash', 'cash', Banknote]];
const STATUS_PILL = { pending: 'gray', partial: 'amber', paid: 'green', overdue: 'red', refunded: 'blue' };

const Payment = () => {
  const permissions = useSelector(selectPermissions);
  const canEdit = Boolean(permissions?.payment?.edit);

  const [summary, setSummary] = useState({ collectedToday: 0, collectedTodayCount: 0, pendingDues: 0, pendingDuesCount: 0 });
  const [recent, setRecent] = useState([]);
  const [members, setMembers] = useState([]);
  const [method, setMethod] = useState('upi');
  const [memberId, setMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [paid, setPaid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = async () => {
    try {
      const [summaryRes, listRes, membersRes] = await Promise.all([
        apiClient.get('/subadmin/payment/today-summary'),
        apiClient.get('/subadmin/payment'),
        apiClient.get('/subadmin/members'),
      ]);
      setSummary(summaryRes.data.data);
      setRecent(listRes.data.data.slice(0, 3));
      setMembers(membersRes.data.data.members);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load payments');
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const confirmPayment = async () => {
    if (!memberId || !amount) { setError('Select a member and enter an amount'); return; }
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/subadmin/payment', { memberId, amount: Number(amount), amountNow: Number(amount), method, note: note || undefined });
      setPaid(true);
      setAmount(''); setNote('');
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <PageHeader title="Collect payment" description="Record a payment for one of your assigned members and issue an instant receipt." />
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="grid gap-6 xl:grid-cols-[1fr_.72fr]">
        <Card>
          <CardTitle title="New payment" description="Enter member and payment details" />
          <div className="space-y-5 p-5">
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">Member</span>
              <select value={memberId} onChange={(e) => setMemberId(e.target.value)} disabled={!canEdit} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none disabled:opacity-50">
                <option value="">Select a member</option>
                {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
              </select>
            </label>
            <Field label="Amount (₹)" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!canEdit} placeholder="0.00" />
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Payment method</p>
              <div className="grid grid-cols-3 gap-3">
                {METHODS.map(([label, value, Icon]) => (
                  <button key={value} type="button" disabled={!canEdit} onClick={() => setMethod(value)} className={`rounded-xl border p-4 text-center text-sm font-semibold disabled:opacity-50 ${method === value ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200'}`}>
                    <Icon className="mx-auto mb-2 h-5 w-5" />{label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} disabled={!canEdit} placeholder="e.g. Monthly renewal" />
            {canEdit ? (
              <Button className="w-full" disabled={saving} onClick={confirmPayment}><IndianRupee className="h-4 w-4" />{saving ? 'Recording...' : 'Confirm payment'}</Button>
            ) : (
              <p className="text-center text-xs text-gray-400">You have view-only access to Payment.</p>
            )}
            {paid && (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                <CheckCircle2 className="h-5 w-5" /><div><b>Payment recorded successfully</b><p>The invoice has been created.</p></div>
              </div>
            )}
          </div>
        </Card>
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <Stat label="Collected today" value={`₹${summary.collectedToday.toLocaleString()}`} helper={`${summary.collectedTodayCount} transactions`} icon={IndianRupee} />
            <Stat label="Pending dues" value={`₹${summary.pendingDues.toLocaleString()}`} helper={`${summary.pendingDuesCount} invoices`} icon={Receipt} tone="amber" />
          </div>
          <Card>
            <CardTitle title="Recent collections" />
            <div className="divide-y divide-gray-100">
              {recent.length === 0 && <p className="px-4 py-6 text-sm text-gray-400">No payments recorded yet.</p>}
              {recent.map((p) => (
                <div key={p._id} className="flex items-center gap-3 p-4">
                  <div className="rounded-xl bg-teal-50 p-2 text-teal-700"><Receipt className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.memberId?.name}</p><p className="text-xs text-gray-500 capitalize">{p.method} · {new Date(p.createdAt).toLocaleDateString()}</p></div>
                  <div className="text-right"><p className="font-semibold">₹{p.amountPaid.toLocaleString()}</p><Pill tone={STATUS_PILL[p.effectiveStatus] || 'gray'}>{p.effectiveStatus}</Pill></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
};
export default Payment;
