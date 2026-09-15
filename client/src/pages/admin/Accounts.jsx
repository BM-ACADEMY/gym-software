import { useEffect, useState } from 'react';
import { IndianRupee, Plus, Trash2, TrendingDown, TrendingUp, Wallet2 } from 'lucide-react';
import apiClient from '../../api/client';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import useSuspended from '../../hooks/useSuspended';

const CATEGORIES = ['rent', 'equipment', 'salaries', 'utilities', 'other'];
const emptyForm = { category: 'rent', description: '', amount: '', date: new Date().toISOString().slice(0, 10) };

const monthDefault = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) };
};

const StatCard = ({ label, value, icon: Icon, tone = 'teal' }) => {
  const tones = { teal: 'bg-teal-50 text-teal-700', red: 'bg-red-50 text-red-700', green: 'bg-emerald-50 text-emerald-700' };
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div><p className="text-sm font-medium text-gray-500">{label}</p><p className="mt-2 text-3xl font-bold text-gray-950">{value}</p></div>
        <div className={`rounded-xl p-3 ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
};

const Accounts = () => {
  const suspended = useSuspended();
  const [range] = useState(monthDefault());
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [pl, setPl] = useState(null);
  const [gst, setGst] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [expensesRes, plRes, gstRes] = await Promise.all([
        apiClient.get('/admin/accounts/expenses', { params: range }),
        apiClient.get('/admin/accounts/profit-loss', { params: range }),
        apiClient.get('/admin/accounts/gst-summary', { params: range }),
      ]);
      setExpenses(expensesRes.data.data.expenses);
      setTotal(expensesRes.data.data.total);
      setPl(plRes.data.data);
      setGst(gstRes.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submitForm = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/admin/accounts/expenses', { ...form, amount: Number(form.amount) });
      setForm(emptyForm); setFormOpen(false);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record expense');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (expense) => {
    try {
      await apiClient.delete(`/admin/accounts/expenses/${expense._id}`);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete expense');
    }
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="mt-1 text-gray-500">Expense tracking and profit/loss for this month.</p>
        </div>
        <button disabled={suspended} onClick={() => { setForm(emptyForm); setFormOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500">
          <Plus className="h-4 w-4" /> Add expense
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {pl && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Revenue" value={`₹${pl.revenue.toLocaleString()}`} icon={TrendingUp} tone="green" />
          <StatCard label="Expenses" value={`₹${pl.totalExpenses.toLocaleString()}`} icon={TrendingDown} tone="red" />
          <StatCard label={pl.profit >= 0 ? 'Profit' : 'Loss'} value={`₹${Math.abs(pl.profit).toLocaleString()}`} icon={IndianRupee} tone={pl.profit >= 0 ? 'green' : 'red'} />
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="font-semibold text-gray-900">Expenses</h3>
          <span className="text-sm text-gray-500">Total: <b className="text-gray-900">₹{total.toLocaleString()}</b></span>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Description</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">Loading...</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">No expenses recorded this month.</td></tr>
            ) : expenses.map((e) => (
              <tr key={e._id}>
                <td className="px-5 py-3 text-gray-600">{new Date(e.date).toLocaleDateString()}</td>
                <td className="px-5 py-3"><Badge tone="blue">{e.category}</Badge></td>
                <td className="px-5 py-3 text-gray-600">{e.description || '—'}</td>
                <td className="px-5 py-3 font-semibold text-gray-900">₹{e.amount.toLocaleString()}</td>
                <td className="px-5 py-3"><button disabled={suspended} onClick={() => remove(e)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pl && (
        <div className="mt-6 flex flex-wrap gap-3">
          {Object.entries(pl.expensesByCategory).filter(([, v]) => v > 0).map(([cat, amount]) => (
            <div key={cat} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm">
              <span className="capitalize text-gray-500">{cat}</span> <b className="text-gray-900">₹{amount.toLocaleString()}</b>
            </div>
          ))}
          {Object.values(pl.expensesByCategory).every((v) => v === 0) && <Wallet2 className="h-5 w-5 text-gray-300" />}
        </div>
      )}

      {gst?.enabled && (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">GST summary</h3>
            <span className="text-xs text-gray-500">{gst.gstNumber || 'GSTIN not set'} · {gst.rate}%</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div><p className="text-xs text-gray-500">Output tax (on revenue)</p><p className="text-lg font-bold text-gray-900">₹{gst.outputTax.toLocaleString()}</p></div>
            <div><p className="text-xs text-gray-500">Input tax credit (on expenses)</p><p className="text-lg font-bold text-gray-900">₹{gst.inputTaxCredit.toLocaleString()}</p></div>
            <div><p className="text-xs text-gray-500">Net GST payable</p><p className="text-lg font-bold text-red-600">₹{gst.netPayable.toLocaleString()}</p></div>
            <div><p className="text-xs text-gray-500">Eligible expenses (base for ITC)</p><p className="text-lg font-bold text-gray-900">₹{gst.eligibleExpenseTotal.toLocaleString()}</p></div>
          </div>
          <p className="mt-3 text-xs text-gray-400">Revenue and eligible expenses are treated as GST-inclusive at your configured rate. Salaries are excluded from input tax credit.</p>
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add expense" footer={
        <>
          <button onClick={() => setFormOpen(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="submit" form="expense-form" disabled={saving || suspended} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
        </>
      }>
        <form id="expense-form" onSubmit={submitForm} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm capitalize">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. August rent" className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Amount (₹)</label>
              <input required type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Accounts;
