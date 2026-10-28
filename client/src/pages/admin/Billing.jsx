import { useEffect, useState, useCallback } from 'react';
import { Check, Download, Loader2 } from 'lucide-react';
import apiClient from '../../api/client';
import { INDIAN_STATES } from '../../utils/indianStates';
import { useT } from '../../i18n';

const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '-');

const loadRazorpay = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load the payment window. Check your internet and try again.'));
    document.body.appendChild(s);
  });

const FEATURE_LABELS = {
  'pt-sessions': 'PT sessions and packages',
  accounts: 'Accounts and expenses',
  'ai-plans': 'AI workout and diet plans',
  branding: 'Your own logo and colours',
};

const ExportData = () => {
  const { t } = useT();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const get = async (name) => {
    setBusy(name); setErr('');
    try {
      const res = await apiClient.get(`/admin/export/${name}.csv`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `${name}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch { setErr(t('Could not download. Please try again.')); } finally { setBusy(''); }
  };
  return (
    <div className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-gray-800">{t('Download your data')}</h2>
      <p className="mt-1 text-sm text-gray-500">{t('Your data is yours. These files open in Excel and work even after your plan ends.')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {['members', 'payments', 'attendance'].map((n) => (
          <button key={n} disabled={Boolean(busy)} onClick={() => get(n)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            {busy === n ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{t(n[0].toUpperCase() + n.slice(1))}
          </button>
        ))}
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
};

const Billing = () => {
  const { t } = useT();
  const [info, setInfo] = useState(null);
  const [payments, setPayments] = useState([]);
  const [cycle, setCycle] = useState('yearly');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [stateChoice, setStateChoice] = useState('');
  const [gstChoice, setGstChoice] = useState('');
  const [promoCode, setPromoCode] = useState('');

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([apiClient.get('/admin/subscription'), apiClient.get('/admin/subscription/payments')]);
      setInfo(a.data.data);
      setPayments(b.data.data);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Could not load billing.' });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveDetails = async () => {
    setMessage({ type: '', text: '' });
    try {
      await apiClient.patch('/admin/subscription/billing-details', { state: stateChoice, gstNumber: gstChoice });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Could not save.' });
    }
  };

  const pay = async (planKey) => {
    setMessage({ type: '', text: '' });
    setBusy(planKey);
    try {
      const { data } = await apiClient.post('/admin/subscription/checkout', { plan: planKey, cycle, promoCode: promoCode.trim() || undefined });
      const order = data.data;

      if (order.provider === 'dummy') {
        // Test mode (no Razorpay keys saved yet): completes the order directly.
        await apiClient.post('/admin/subscription/simulate', { orderId: order.orderId });
        setMessage({ type: 'success', text: 'Test payment completed.' });
        await load();
        return;
      }

      await loadRazorpay();
      const rz = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount * 100,
        currency: 'INR',
        name: 'GymDesk',
        description: `${planKey} plan, ${cycle}`,
        handler: async (resp) => {
          try {
            await apiClient.post('/admin/subscription/confirm', {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            setMessage({ type: 'success', text: 'Payment received. Your plan is active. Thank you!' });
          } catch {
            setMessage({ type: 'success', text: 'Payment received. Your plan will be active in a minute; refresh if it does not change.' });
          }
          await load();
        },
        modal: { ondismiss: () => setBusy('') },
        theme: { color: '#0d9488' },
      });
      rz.open();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.message || 'Payment could not be started.' });
    } finally {
      setBusy('');
    }
  };

  const downloadInvoice = async (p) => {
    try {
      const res = await apiClient.get(`/admin/subscription/payments/${p._id}/invoice`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(p.invoiceNo || 'invoice').replace(/[^\w-]/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage({ type: 'error', text: 'Could not download the invoice.' });
    }
  };

  if (!info) {
    return <div className="p-8 text-gray-500">{message.text || 'Loading billing...'}</div>;
  }

  const statusText = {
    trial: info.daysLeft === 1 ? t('Free trial: 1 day left') : t('Free trial: {n} days left', { n: info.daysLeft }),
    active: info.currentPlan ? t('{plan} plan active until {date}', { plan: info.currentPlan.name, date: fmtDate(info.endsAt) }) : t('Active'),
    grace: info.daysLeft === 1 ? t('Payment overdue. Pay within 1 day to avoid read-only mode') : t('Payment overdue. Pay within {n} days to avoid read-only mode', { n: info.daysLeft }),
    expired: t('Your plan has ended. Your data is safe, but changes are switched off until you pay.'),
    suspended: t('This gym is suspended. Please contact support.'),
  }[info.status];

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('Plan & billing')}</h1>
        <p className="mt-1 text-gray-600">{statusText}</p>
        <p className="mt-1 text-sm text-gray-500">
          {t('Using {m} of {ml} members and {s} of {sl} staff logins.', { m: info.usage.members, ml: info.currentPlan?.memberLimit ?? t('unlimited'), s: info.usage.staff, sl: info.currentPlan?.staffLimit ?? t('unlimited') })}
        </p>
      </div>

      {message.text && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{message.text}</div>
      )}

      {!info.state && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-3 text-sm font-medium text-amber-900">{t('Before you pay, tell us your state. It decides how GST appears on your invoice. Add your GST number if you have one, to claim input credit.')}</p>
          <div className="flex flex-wrap gap-3">
            <select value={stateChoice} onChange={(e) => setStateChoice(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">{t('Select state')}</option>
              {INDIAN_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
            <input value={gstChoice} onChange={(e) => setGstChoice(e.target.value)} placeholder={t('GST number (optional)')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <button disabled={!stateChoice} onClick={saveDetails} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t('Save')}</button>
          </div>
        </div>
      )}

      <div className="inline-flex rounded-xl bg-gray-100 p-1">
        {['monthly', 'yearly'].map((c) => (
          <button key={c} onClick={() => setCycle(c)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${cycle === c ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            {c === 'monthly' ? t('Monthly') : t('Yearly (2 months free)')}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} maxLength={24} placeholder={t('Have a code?')} className="w-44 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <span className="text-xs text-gray-500">{t('Enter it before you click Pay. The discount shows on your invoice.')}</span>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {info.plans.map((p) => {
          const price = p[cycle];
          const isCurrent = info.currentPlan?.key === p.key && info.status === 'active' && info.billingCycle === cycle;
          return (
            <div key={p.key} className={`flex flex-col rounded-2xl border p-6 ${p.key === 'growth' ? 'border-teal-400 shadow-lg shadow-teal-100' : 'border-gray-200'}`}>
              <h3 className="text-lg font-bold">{p.name}</h3>
              <p className="mt-3 text-3xl font-extrabold">{rupees(price.base)}<span className="text-sm font-medium text-gray-500"> / {cycle === 'monthly' ? t('month') : t('year')}</span></p>
              <p className="text-xs text-gray-500">{t('+ {gst} GST = {total} to pay', { gst: rupees(price.gst), total: rupees(price.total) })}</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-gray-700">
                <li className="flex gap-2"><Check className="h-4 w-4 text-teal-600" />{p.memberLimit ? t('Up to {n} members', { n: p.memberLimit }) : t('Unlimited members')}</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-teal-600" />{p.staffLimit ? t('{n} staff logins', { n: p.staffLimit }) : t('Unlimited staff logins')}</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-teal-600" />{p.whatsappPerMonth ? t('{n} WhatsApp messages / month', { n: p.whatsappPerMonth }) : t('No WhatsApp messages')}</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-teal-600" />{t('{n} AI answers / month', { n: p.aiCallsPerMonth })}</li>
                {Object.entries(FEATURE_LABELS).filter(([k]) => p.features[k]).map(([k, label]) => (
                  <li key={k} className="flex gap-2"><Check className="h-4 w-4 text-teal-600" />{t(label)}</li>
                ))}
              </ul>
              <button
                disabled={Boolean(busy) || info.status === 'suspended' || !info.state}
                onClick={() => pay(p.key)}
                className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {busy === p.key && <Loader2 className="h-4 w-4 animate-spin" />}
                {isCurrent ? t('Renew now') : info.status === 'trial' || info.status === 'expired' ? t('Choose plan') : t('Switch / renew')}
              </button>
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold">{t('Invoices')}</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-500">{t('No payments yet.')}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600"><tr><th className="p-3">{t('Invoice')}</th><th className="p-3">{t('Date')}</th><th className="p-3">{t('Plan')}</th><th className="p-3">{t('Amount')}</th><th className="p-3" /></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id} className="border-t border-gray-100">
                    <td className="p-3 font-medium">{p.invoiceNo || '-'}</td>
                    <td className="p-3">{fmtDate(p.paidAt)}</td>
                    <td className="p-3 capitalize">{p.planKey} ({p.cycle})</td>
                    <td className="p-3">{rupees(p.total)}</td>
                    <td className="p-3"><button onClick={() => downloadInvoice(p)} className="inline-flex items-center gap-1 text-teal-700 hover:underline"><Download className="h-4 w-4" />PDF</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ExportData />
    </div>
  );
};

export default Billing;
