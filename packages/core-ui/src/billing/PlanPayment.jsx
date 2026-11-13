import { useCallback, useEffect, useState } from 'react';
import { saveDownload } from '../admin/DownloadButtons.jsx';

// "Plan and payment" screen shared by Salon, Mart, Dine, Cloth and Wash. Plain words, whole rupees, prices shown before GST.
// api: { get, post, put, download } returning the server's JSON body ({ success, data }). Only the owner (role 'admin') can pay.
// Written 13 Nov, not yet tested by a person. Needs one real Razorpay test payment.
export const INDIAN_STATES = ['Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];

const rs = (n) => `Rs ${Number(n || 0).toLocaleString('en-IN')}`;
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '-');
const errText = (e) => (e && e.response && e.response.data && e.response.data.message) || (e && e.message) || 'Something went wrong. Please try again.';
const STATUS_WORDS = { trial: 'Free trial', active: 'Active', grace: 'Ended, short grace period', expired: 'Ended (read-only)', suspended: 'Suspended' };

let scriptPromise = null;
const loadCheckout = () => {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = resolve; s.onerror = () => { scriptPromise = null; reject(new Error('Could not load the payment window. Check your internet and try again.')); }; document.body.appendChild(s); });
  return scriptPromise;
};

export default function PlanPayment({ api, role, productName = 'this app', accent = '#0d9488' }) {
  const [info, setInfo] = useState(null); const [pays, setPays] = useState([]); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(''); const [cycle, setCycle] = useState('monthly'); const [state, setState] = useState('');
  const owner = role === 'admin';
  const load = useCallback(async () => {
    try { const r = await api.get('/billing/plans'); setInfo(r.data); } catch (e) { setMsg(errText(e)); }
    if (owner) { try { const r = await api.get('/billing/payments'); setPays(r.data || []); } catch (e) { /* the list is optional */ } }
  }, [api, owner]);
  useEffect(() => { load(); }, [load]);
  if (!info) return <p style={{ padding: 16 }}>{msg || 'Loading...'}</p>;

  const saveState = async () => { setBusy('state'); setMsg(''); try { await api.put('/billing/state', { state }); await load(); } catch (e) { setMsg(errText(e)); } finally { setBusy(''); } };
  const pay = async (plan) => {
    setBusy(plan); setMsg('');
    try {
      const o = (await api.post('/billing/order', { plan, cycle })).data;
      await loadCheckout();
      const rzp = new window.Razorpay({
        key: o.keyId, amount: Math.round(o.amount * 100), currency: o.currency || 'INR', order_id: o.orderId, name: productName, description: `${plan} plan, ${cycle}`, theme: { color: accent },
        handler: async (resp) => {
          try { const c = (await api.post('/billing/confirm', { orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature })).data; setMsg(c && c.status === 'paid' ? 'Payment received. Your plan is active. Your invoice is below.' : 'Payment received. If your plan does not update in a minute, contact support.'); } catch (e) { setMsg(`${errText(e)} If money was taken, it will be added to your plan shortly. Contact support if not.`); }
          setBusy(''); load();
        },
        modal: { ondismiss: () => setBusy('') },
      });
      rzp.on('payment.failed', (f) => { setMsg((f && f.error && f.error.description) || 'The payment did not go through. You were not charged.'); setBusy(''); });
      rzp.open();
    } catch (e) { setMsg(errText(e)); setBusy(''); }
  };
  const invoice = async (p) => { try { await saveDownload(api, `/billing/invoice/${p._id}`, `${p.invoiceNo || 'invoice'}.pdf`); } catch (e) { setMsg(errText(e)); } };
  const s = info.status || {}; const box = { border: '1px solid #e1e8ec', borderRadius: 16, padding: 16, margin: '10px 0', background: '#fff', boxShadow: '0 1px 2px rgba(20,35,43,.06), 0 4px 14px rgba(20,35,43,.06)' }; const btn = { padding: '11px 18px', minHeight: 46, fontWeight: 700, border: 0, borderRadius: 12, background: accent, color: '#fff', cursor: 'pointer', fontSize: 15 };

  return (
    <div style={{ padding: 16, maxWidth: 760, margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>Plan and payment</h2>
      <div style={box}>
        <strong>{STATUS_WORDS[s.status] || s.status}</strong>{s.planKey ? ` (${s.planKey} plan)` : ''}{s.endsAt ? `, until ${day(s.endsAt)}` : ''}
        {info.suggestion && <p role="status" style={{ margin: '8px 0 0', color: info.suggestion.level === 'urgent' ? '#b91c1c' : '#92400e' }}>{info.suggestion.text}</p>}
      </div>
      {msg && <p role="status" style={{ ...box, background: '#f8fafc' }}>{msg}</p>}
      {!owner && <p>Only the owner can change the plan or pay. Please ask the owner.</p>}
      {owner && !info.paymentReady && <p style={box}>Online payment is not switched on yet. Please contact support to pay.</p>}
      {owner && info.stateRequired && (
        <div style={box}>
          <p style={{ marginTop: 0 }}>Choose your state first. It decides how GST is shown on your invoice.</p>
          <select aria-label="Your state" value={state} onChange={(e) => setState(e.target.value)} style={{ padding: 8, minHeight: 40 }}><option value="">Select state</option>{INDIAN_STATES.map((x) => <option key={x} value={x}>{x}</option>)}</select>{' '}
          <button type="button" style={btn} disabled={!state || busy === 'state'} onClick={saveState}>Save state</button>
        </div>
      )}
      {owner && !info.stateRequired && info.paymentReady && (
        <>
          <div role="group" aria-label="Billing period" style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
            {['monthly', 'yearly'].map((c) => <button key={c} type="button" aria-pressed={cycle === c} onClick={() => setCycle(c)} style={{ ...btn, background: cycle === c ? accent : '#e5e7eb', color: cycle === c ? '#fff' : '#111' }}>{c === 'monthly' ? 'Monthly' : 'Yearly'}</button>)}
          </div>
          {info.plans.map((p) => { const q = p[cycle]; return (
            <div key={p.key} style={{ ...box, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}><strong>{p.name}</strong><br />{rs(q.base)} + GST {rs(q.gst)} = <strong>{rs(q.total)}</strong> {cycle === 'monthly' ? 'a month' : 'a year'}</div>
              <button type="button" style={btn} disabled={Boolean(busy)} onClick={() => pay(p.key)}>{busy === p.key ? 'Opening...' : s.planKey === p.key && s.status === 'active' ? 'Renew' : 'Choose'}</button>
            </div>
          ); })}
          <p style={{ fontSize: 13, color: '#555' }}>Prices are before GST ({info.gstRate}% added at checkout). If you move to a bigger plan, the unused days of your current plan are taken off the price.</p>
        </>
      )}
      {owner && pays.length > 0 && (
        <>
          <h3>Your payments</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr style={{ textAlign: 'left' }}><th>Date</th><th>Plan</th><th>Paid</th><th>Status</th><th /></tr></thead>
            <tbody>{pays.map((p) => <tr key={p._id} style={{ borderTop: '1px solid #eee' }}><td>{day(p.paidAt || p.createdAt)}</td><td>{p.planKey} ({p.cycle})</td><td>{rs(p.total)}</td><td>{p.status}</td><td>{(p.status === 'paid' || p.status === 'refunded') && <button type="button" onClick={() => invoice(p)} style={{ padding: '6px 10px' }}>Invoice</button>}</td></tr>)}</tbody>
          </table>
        </>
      )}
    </div>
  );
}
