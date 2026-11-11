import { useState } from 'react';
import { S, msgOf, rs, usePoll } from './ui.js';

// Pay later: who owes, and collecting a payment (oldest dues are cleared first, by the server).
export function Credit({ api, t }) {
  const { data, error, loading, reload } = usePoll(async () => (await api.get('/credit/dues')).data, 0, []);
  const [pick, setPick] = useState(null); const [amount, setAmount] = useState(''); const [method, setMethod] = useState('cash'); const [msg, setMsg] = useState(''); const [ok, setOk] = useState('');
  const collect = async () => { setMsg(''); setOk(''); try { await api.post('/credit/payments', { phone: pick.phone, amount: Number(amount), method }); setOk(t('collect_ok')); setPick(null); setAmount(''); reload(); } catch (e) { setMsg(msgOf(e, t)); } };
  return (
    <div style={S.page}>
      <div style={S.row}><h2 style={{ margin: 0, flex: 1 }}>{t('credit_title')}</h2><button type="button" style={S.big} onClick={reload}>{t('refresh')}</button></div>
      {loading && !data && <p>{t('loading')}</p>}{(error || msg) && <p style={S.err} role="alert">{msg || error}</p>}{ok && <p style={S.ok}>{ok}</p>}
      {data && data.length === 0 && <p>{t('credit_empty')}</p>}
      {(data || []).map((d) => (
        <div key={d.phone} style={S.card}>
          <div style={S.row}><strong style={{ flex: 1 }}>{d.name || d.phone}</strong><strong>{rs(d.owing)}</strong></div>
          <small>{d.phone.slice(0, 2) + '******' + d.phone.slice(-2)} · {d.days} {t('days')}</small>
          <div><button type="button" style={S.big} onClick={() => { setPick(d); setAmount(String(d.owing)); }}>{t('collect')}</button></div>
        </div>))}
      {pick && (
        <div style={{ ...S.card, border: '2px solid #c2410c' }} role="dialog" aria-label={t('collect')}>
          <strong>{t('collect')}: {pick.name || pick.phone}</strong>
          <label>{t('collect_amount')}<input style={S.input} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} /></label>
          <select style={S.input} value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">{t('cash')}</option><option value="upi">{t('upi')}</option><option value="card">{t('card')}</option></select>
          <div style={S.row}><button type="button" style={S.primary} onClick={collect}>{t('collect')}</button><button type="button" style={S.big} onClick={() => setPick(null)}>{t('cancel')}</button></div>
        </div>)}
    </div>
  );
}

// Returns: pick a paid order, choose how many of each line come back, give a reason. The server works out the refund.
export function Returns({ api, t }) {
  const { data, error, loading, reload } = usePoll(async () => (await api.get('/orders', { status: 'paid' })).data, 0, []);
  const [order, setOrder] = useState(null); const [qty, setQty] = useState({}); const [reason, setReason] = useState(''); const [msg, setMsg] = useState(''); const [ok, setOk] = useState('');
  const lines = (order && order.totals && order.totals.lines) || [];
  const go = async () => {
    setMsg(''); setOk('');
    const items = lines.map((_, i) => ({ lineIndex: i, qty: Number(qty[i] || 0) })).filter((x) => x.qty > 0);
    try { const r = await api.post('/orders/' + order.id + '/returns', { items, reason }); setOk(t('return_ok') + ' ' + t('refund') + ': ' + rs(r.data.refund)); setOrder(null); setQty({}); setReason(''); reload(); } catch (e) { setMsg(msgOf(e, t)); }
  };
  return (
    <div style={S.page}>
      <div style={S.row}><h2 style={{ margin: 0, flex: 1 }}>{t('returns_title')}</h2><button type="button" style={S.big} onClick={reload}>{t('refresh')}</button></div>
      <p style={{ fontSize: 13 }}>{t('returns_note')}</p>
      {loading && !data && <p>{t('loading')}</p>}{(error || msg) && <p style={S.err} role="alert">{msg || error}</p>}{ok && <p style={S.ok}>{ok}</p>}
      {!order && <p>{t('returns_pick')}</p>}
      {!order && (data || []).map((o) => <button key={o.id} type="button" style={{ ...S.big, display: 'block', width: '100%', margin: '6px 0' }} onClick={() => { setOrder(o); setQty({}); }}>{o.number}{o.table ? ' · ' + o.table : ''} · {rs(o.grandTotal)}</button>)}
      {order && (
        <div style={S.card}>
          <strong>{order.number}</strong>
          {lines.map((l, i) => (
            <div key={i} style={S.row}>
              <span style={{ flex: 1 }}>{l.qty} × {l.name} · {rs(l.total)}</span>
              <input style={{ ...S.input, width: 90 }} inputMode="decimal" aria-label={t('return_qty') + ' ' + l.name} placeholder="0" value={qty[i] || ''} onChange={(e) => setQty({ ...qty, [i]: e.target.value.replace(/[^\d.]/g, '') })} />
            </div>))}
          <label>{t('return_reason')}<input style={S.input} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></label>
          <div style={S.row}><button type="button" style={S.primary} onClick={go}>{t('return_go')}</button><button type="button" style={S.big} onClick={() => setOrder(null)}>{t('cancel')}</button></div>
        </div>)}
    </div>
  );
}
