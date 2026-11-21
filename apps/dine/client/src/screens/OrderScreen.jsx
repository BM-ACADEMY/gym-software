import { useEffect, useMemo, useState } from 'react';
import { S, msgOf, openPage, rs } from './ui.js';

// One order: pick dishes (with sizes and extras), send to kitchen or bar, remove items, mark served, then go to the bill.
export default function OrderScreen({ api, t, orderId, onBack, onBill }) {
  const [order, setOrder] = useState(null); const [menu, setMenu] = useState([]); const [q, setQ] = useState(''); const [cat, setCat] = useState('');
  const [pick, setPick] = useState(null); const [msg, setMsg] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false); const [voidFor, setVoidFor] = useState(null); const [reason, setReason] = useState('');
  const load = async () => { try { setOrder((await api.get('/orders/' + orderId)).data); } catch (e) { setMsg(msgOf(e, t)); } };
  useEffect(() => { load(); api.get('/menu').then((r) => setMenu(r.data || [])).catch((e) => setMsg(msgOf(e, t))); }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (fn, okText) => { setBusy(true); setMsg(''); setOk(''); try { const r = await fn(); if (r && r.data && r.data.lines) setOrder(r.data); if (okText) setOk(okText); } catch (e) { setMsg(msgOf(e, t)); await load(); } finally { setBusy(false); } };
  const cats = useMemo(() => [...new Set(menu.map((m) => m.category).filter(Boolean))], [menu]);
  const shown = menu.filter((m) => (!cat || m.category === cat) && (!q || m.name.toLowerCase().includes(q.toLowerCase())));
  const locked = order && (order.status === 'billed' || order.status === 'paid');
  const lines = order ? order.lines.filter((l) => l.status !== 'void') : [];
  const hasNew = lines.some((l) => l.status === 'new'); const sentIds = lines.filter((l) => l.status === 'sent').map((l) => l.id);
  const total = lines.reduce((a, l) => a + l.qty * l.unitPrice, 0);
  const addPlain = (item) => act(() => api.post('/orders/' + orderId + '/lines', { itemKey: item.key, qty: 1 }));
  const choose = (item) => ((item.variants || []).length || (item.groups || []).length ? setPick({ item, variantKey: (item.variants || [])[0] ? item.variants[0].key : undefined, optionKeys: [], qty: 1 }) : addPlain(item));
  const confirmPick = async () => { const p = pick; setPick(null); await act(() => api.post('/orders/' + orderId + '/lines', { itemKey: p.item.key, variantKey: p.variantKey, optionKeys: p.optionKeys, qty: p.qty })); };
  const toggleOpt = (k) => setPick((p) => ({ ...p, optionKeys: p.optionKeys.includes(k) ? p.optionKeys.filter((x) => x !== k) : [...p.optionKeys, k] }));
  const doVoid = async (l) => { if (l.status === 'new') return act(() => api.post('/orders/' + orderId + '/lines/' + l.id + '/void', {})); setVoidFor(l.id); setReason(''); return null; };
  const confirmVoid = async () => { const id = voidFor; setVoidFor(null); await act(() => api.post('/orders/' + orderId + '/lines/' + id + '/void', { reason })); };
  if (!order) return <div style={S.page}>{msg ? <p style={S.err}>{msg}</p> : <p>{t('loading')}</p>}<button type="button" style={S.big} onClick={onBack}>{t('back')}</button></div>;
  return (
    <div style={S.page}>
      <div style={S.row}><button type="button" style={S.big} onClick={onBack}>{t('back')}</button><h2 style={{ margin: 0, flex: 1 }}>{t('order')} {order.number}{order.table ? ' · ' + order.table : ''}</h2></div>
      {msg && <p style={S.err} role="alert">{msg}</p>}{ok && <p style={S.ok}>{ok}</p>}
      <div style={S.card}>
        <strong>{t('items')} · {rs(total)}</strong>
        {lines.length === 0 && <p>{t('no_items')}</p>}
        {lines.map((l) => (
          <div key={l.id} style={{ ...S.row, padding: '8px 0', borderTop: '1px solid #eee' }}>
            <span style={{ flex: 1 }}>{l.qty} × {l.name}{l.note ? ' (' + l.note + ')' : ''} · {rs(l.qty * l.unitPrice)} <small>({t('line_' + l.status)})</small></span>
            {!locked && <button type="button" style={S.danger} disabled={busy} onClick={() => doVoid(l)}>{t('void')}</button>}
          </div>))}
        {voidFor && <div style={S.card}><label>{t('void_reason')}<input style={S.input} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></label>
          <div style={S.row}><button type="button" style={S.danger} onClick={confirmVoid}>{t('void_confirm')}</button><button type="button" style={S.big} onClick={() => setVoidFor(null)}>{t('cancel')}</button></div></div>}
      </div>
      {!locked && (
        <div style={S.card}>
          <input style={S.input} placeholder={t('menu_search')} value={q} onChange={(e) => setQ(e.target.value)} />
          <div style={{ ...S.row, marginBottom: 8 }}>
            <button type="button" style={{ ...S.big, background: cat ? '#fff' : '#fde68a' }} onClick={() => setCat('')}>All</button>
            {cats.map((c) => <button key={c} type="button" style={{ ...S.big, background: cat === c ? '#fde68a' : '#fff' }} onClick={() => setCat(c)}>{c}</button>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {shown.map((m) => <button key={m.key} type="button" disabled={busy} style={{ ...S.big, textAlign: 'left' }} onClick={() => choose(m)}>{m.name}<br /><small>{rs(m.price)}{(m.variants || []).length ? '+' : ''}</small></button>)}
          </div>
        </div>)}
      {pick && (
        <div style={{ ...S.card, border: '2px solid #c2410c' }} role="dialog" aria-label={pick.item.name}>
          <strong>{pick.item.name}</strong>
          {(pick.item.variants || []).length > 0 && <div><p>{t('variant')}</p><div style={S.row}>{pick.item.variants.map((v) => <button key={v.key} type="button" style={{ ...S.big, background: pick.variantKey === v.key ? '#fde68a' : '#fff' }} onClick={() => setPick({ ...pick, variantKey: v.key })}>{v.name} · {rs(v.price)}</button>)}</div></div>}
          {(pick.item.groups || []).map((g) => <div key={g.key}><p>{g.name}{g.min ? ' *' : ''}</p><div style={S.row}>{g.options.map((o) => <button key={o.key} type="button" style={{ ...S.big, background: pick.optionKeys.includes(o.key) ? '#fde68a' : '#fff' }} onClick={() => toggleOpt(o.key)}>{o.name}{o.price ? ' +' + rs(o.price) : ''}</button>)}</div></div>)}
          <div style={{ ...S.row, margin: '10px 0' }}><button type="button" style={S.big} onClick={() => setPick({ ...pick, qty: Math.max(1, pick.qty - 1) })}>−</button><strong>{pick.qty}</strong><button type="button" style={S.big} onClick={() => setPick({ ...pick, qty: pick.qty + 1 })}>+</button></div>
          <div style={S.row}><button type="button" style={S.primary} onClick={confirmPick}>{t('add_item')}</button><button type="button" style={S.big} onClick={() => setPick(null)}>{t('cancel')}</button></div>
        </div>)}
      <div style={{ ...S.row, margin: '12px 0' }}>
        {!locked && <button type="button" style={S.primary} disabled={busy || !hasNew} onClick={() => act(() => api.post('/orders/' + orderId + '/kot', {}), t('sent_ok'))}>{t('send_kot')}</button>}
        {!locked && <button type="button" style={S.big} disabled={busy || !sentIds.length} onClick={() => act(() => api.post('/orders/' + orderId + '/served', { lineIds: sentIds }))}>{t('served_all')}</button>}
        <button type="button" style={S.big} onClick={() => openPage('/orders/' + orderId + '/print/kot?station=kitchen')}>{t('print_kot')}</button>
        <button type="button" style={S.big} onClick={() => openPage('/orders/' + orderId + '/print/kot?station=bar')}>{t('print_kot_bar')}</button>
        <button type="button" style={S.primary} disabled={!lines.length} onClick={() => onBill(orderId)}>{t('go_bill')}</button>
      </div>
    </div>
  );
}
