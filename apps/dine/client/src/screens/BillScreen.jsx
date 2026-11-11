import { useEffect, useState } from 'react';
import { S, msgOf, openPage, rs } from './ui.js';

// Bill: make the bill (with an optional discount and reason), show the split, take payment, print. The server decides every amount and
// every limit (the owner's staff-discount rule, the pay-later limit). This screen only shows what the server says.
export default function BillScreen({ api, t, orderId, onBack, onDone }) {
  const [order, setOrder] = useState(null); const [msg, setMsg] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false); const [note, setNote] = useState('');
  const [dType, setDType] = useState('percent'); const [dValue, setDValue] = useState(''); const [dReason, setDReason] = useState(''); const [showD, setShowD] = useState(false);
  const [pays, setPays] = useState([{ method: 'cash', amount: '' }]); const [gName, setGName] = useState(''); const [gPhone, setGPhone] = useState(''); const [points, setPoints] = useState('');
  const [mode, setMode] = useState('equal'); const [guests, setGuests] = useState(2); const [assign, setAssign] = useState({}); const [parts, setParts] = useState(null); const [reopenReason, setReopenReason] = useState('');
  const load = async () => { try { setOrder((await api.get('/orders/' + orderId)).data); } catch (e) { setMsg(msgOf(e, t)); } };
  useEffect(() => { load(); }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (fn, okText) => { setBusy(true); setMsg(''); setOk(''); try { const r = await fn(); if (okText) setOk(okText); return r; } catch (e) { setMsg(msgOf(e, t)); return null; } finally { setBusy(false); } };
  if (!order) return <div style={S.page}>{msg ? <p style={S.err}>{msg}</p> : <p>{t('loading')}</p>}<button type="button" style={S.big} onClick={onBack}>{t('back')}</button></div>;
  const tl = (order.totals && order.totals.lines) || [];
  const makeBill = async () => {
    let discount;
    if (showD && dValue !== '') discount = { type: dType, value: Number(dValue), reason: dReason };
    const r = await run(() => api.post('/orders/' + orderId + '/bill', discount ? { discount } : {}));
    if (r) { setOrder(r.data); if (r.note) setNote(r.note); setPays([{ method: 'cash', amount: String(r.data.grandTotal) }]); }
  };
  const reopen = async () => { const r = await run(() => api.post('/orders/' + orderId + '/reopen', { reason: reopenReason })); if (r) { setOrder(r.data); setParts(null); } };
  const showSplit = async () => {
    const body = mode === 'equal' ? { mode: 'equal', guests: Number(guests) } : { mode: 'items', guests: Number(guests), assign: tl.map((_, i) => (assign[i] === undefined ? 0 : Number(assign[i]))) };
    const r = await run(() => api.post('/orders/' + orderId + '/split', body)); if (r) setParts(r.data.parts);
  };
  const setPay = (i, k, v) => setPays(pays.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const paidSum = pays.reduce((a, p) => a + (Number(p.amount) || 0), 0); const short = Math.max(0, (order.grandTotal || 0) - paidSum);
  const pay = async () => {
    const body = { payments: pays.filter((p) => Number(p.amount) > 0).map((p) => ({ method: p.method, amount: Number(p.amount) })), ...(gPhone ? { customerPhone: gPhone } : {}), ...(gName ? { customerName: gName } : {}), ...(Number(points) > 0 ? { redeemPoints: Number(points) } : {}) };
    const r = await run(() => api.post('/orders/' + orderId + '/pay', body), t('paid_ok'));
    if (r) { setOrder(r.data); if (r.change > 0) setOk(t('paid_ok') + ' ' + t('change_due') + ': ' + rs(r.change)); }
  };
  const status = order.status;
  return (
    <div style={S.page}>
      <div style={S.row}><button type="button" style={S.big} onClick={onBack}>{t('back')}</button><h2 style={{ margin: 0, flex: 1 }}>{t('bill_title')} {order.number}{order.table ? ' · ' + order.table : ''}</h2></div>
      {msg && <p style={S.err} role="alert">{msg}</p>}{ok && <p style={S.ok}>{ok}</p>}{note && <p style={{ fontSize: 13 }}>{note || t('gst_note')}</p>}
      {(status === 'open' || status === 'sent' || status === 'served') && (
        <div style={S.card}>
          {order.lines.filter((l) => l.status !== 'void').map((l) => <div key={l.id}>{l.qty} × {l.name} · {rs(l.qty * l.unitPrice)}</div>)}
          <label style={{ display: 'block', margin: '10px 0' }}><input type="checkbox" checked={showD} onChange={(e) => setShowD(e.target.checked)} /> {t('discount')}</label>
          {showD && (<div>
            <p style={{ fontSize: 13 }}>{t('d_limit_hint')}</p>
            <div style={S.row}><button type="button" style={{ ...S.big, background: dType === 'percent' ? '#fde68a' : '#fff' }} onClick={() => setDType('percent')}>{t('d_percent')}</button><button type="button" style={{ ...S.big, background: dType === 'amount' ? '#fde68a' : '#fff' }} onClick={() => setDType('amount')}>{t('d_amount')}</button></div>
            <label>{t('d_value')}<input style={S.input} inputMode="numeric" value={dValue} onChange={(e) => setDValue(e.target.value.replace(/[^\d]/g, ''))} /></label>
            <label>{t('d_reason')}<input style={S.input} value={dReason} onChange={(e) => setDReason(e.target.value)} maxLength={200} /></label>
          </div>)}
          <button type="button" style={S.primary} disabled={busy} onClick={makeBill}>{showD && dValue ? t('apply_discount') : t('make_bill')}</button>
        </div>)}
      {(status === 'billed' || status === 'paid') && order.totals && (
        <div style={S.card}>
          {tl.map((l, i) => <div key={i} style={S.row}><span style={{ flex: 1 }}>{l.qty} × {l.name}</span><span>{rs(l.total)}</span></div>)}
          <hr />
          <div style={S.row}><span style={{ flex: 1 }}>{t('subtotal')}</span><span>{rs(order.totals.subtotal)}</span></div>
          {order.totals.discount > 0 && <div style={S.row}><span style={{ flex: 1 }}>{t('discount')}{order.discountReason ? ' (' + order.discountReason + ')' : ''}</span><span>− {rs(order.totals.discount)}</span></div>}
          {order.totals.gst > 0 && <div style={S.row}><span style={{ flex: 1 }}>{t('gst')}</span><span>{rs(order.totals.gst)}</span></div>}
          {order.serviceCharge > 0 && <div style={S.row}><span style={{ flex: 1 }}>{t('service')}</span><span>{rs(order.serviceCharge)}</span></div>}
          <div style={{ ...S.row, fontSize: 20, fontWeight: 700 }}><span style={{ flex: 1 }}>{t('total')}</span><span>{rs(order.grandTotal)}</span></div>
          <div style={{ ...S.row, marginTop: 10 }}>
            <button type="button" style={S.big} onClick={() => openPage('/orders/' + orderId + '/print/bill?size=A5')}>{t('print_bill')}</button>
            <button type="button" style={S.big} onClick={() => openPage('/orders/' + orderId + '/print/bill?size=A4')}>{t('print_bill_a4')}</button>
          </div>
        </div>)}
      {status === 'billed' && (<>
        <div style={S.card}>
          <strong>{t('split')}</strong>
          <div style={S.row}><button type="button" style={{ ...S.big, background: mode === 'equal' ? '#fde68a' : '#fff' }} onClick={() => setMode('equal')}>{t('split_equal')}</button><button type="button" style={{ ...S.big, background: mode === 'items' ? '#fde68a' : '#fff' }} onClick={() => setMode('items')}>{t('split_items')}</button></div>
          <label>{t('guests')}<input style={S.input} inputMode="numeric" value={guests} onChange={(e) => setGuests(e.target.value.replace(/[^\d]/g, ''))} /></label>
          {mode === 'items' && tl.map((l, i) => (
            <div key={i} style={S.row}><span style={{ flex: 1 }}>{l.name} · {rs(l.total)} ({t('give_to')})</span>
              <select style={{ ...S.input, width: 120 }} value={assign[i] === undefined ? 0 : assign[i]} onChange={(e) => setAssign({ ...assign, [i]: Number(e.target.value) })}>
                {Array.from({ length: Math.max(1, Math.min(50, Number(guests) || 1)) }, (_, g) => <option key={g} value={g}>{t('guest')} {g + 1}</option>)}</select></div>))}
          <button type="button" style={S.big} disabled={busy} onClick={showSplit}>{t('show_split')}</button>
          {parts && parts.map((p, g) => <div key={g} style={S.row}><span style={{ flex: 1 }}>{t('guest')} {g + 1}</span><strong>{rs(p)}</strong></div>)}
        </div>
        <div style={S.card}>
          <strong>{t('pay')}</strong>
          {pays.map((p, i) => (
            <div key={i} style={S.row}>
              <select style={{ ...S.input, width: 140 }} value={p.method} onChange={(e) => setPay(i, 'method', e.target.value)}><option value="cash">{t('cash')}</option><option value="upi">{t('upi')}</option><option value="card">{t('card')}</option><option value="credit">{t('credit')}</option></select>
              <input style={{ ...S.input, flex: 1 }} inputMode="numeric" aria-label={t('amount')} placeholder={t('amount')} value={p.amount} onChange={(e) => setPay(i, 'amount', e.target.value.replace(/[^\d]/g, ''))} />
            </div>))}
          <button type="button" style={S.big} onClick={() => setPays([...pays, { method: 'upi', amount: '' }])}>{t('add_payment')}</button>
          <label>{t('guest_name')}<input style={S.input} value={gName} onChange={(e) => setGName(e.target.value)} maxLength={80} /></label>
          <label>{t('guest_phone')}<input style={S.input} inputMode="numeric" maxLength={10} value={gPhone} onChange={(e) => setGPhone(e.target.value.replace(/[^\d]/g, ''))} /></label>
          <label>{t('redeem')}<input style={S.input} inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value.replace(/[^\d]/g, ''))} /></label>
          {short > 0 && <p style={S.err}>{t('short_by')}: {rs(short)}</p>}
          <button type="button" style={S.primary} disabled={busy} onClick={pay}>{t('pay')}</button>
        </div>
        <div style={S.card}>
          <label>{t('reopen_reason')}<input style={S.input} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} maxLength={200} /></label>
          <button type="button" style={S.danger} disabled={busy} onClick={reopen}>{t('reopen')}</button>
        </div>
      </>)}
      {status === 'paid' && <div style={S.card}><p style={S.ok}>{t('paid_ok')}</p><button type="button" style={S.primary} onClick={onDone}>{t('tabs_tables')}</button></div>}
    </div>
  );
}
