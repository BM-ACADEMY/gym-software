import { useEffect, useState } from 'react';
import { call, pos } from '../api.js';
import T from '../strings.js';
import { S, Msg, rupees, msg } from '../ui.jsx';

const t = T.stock;
const isFabric = (v) => v.unit === 'metre';
const show = (v, n) => (isFabric(v) ? (n / 100).toFixed(2) + ' m' : String(n));

export default function Stock({ role }) {
  const [part, setPart] = useState('count');
  return (
    <div style={S.page}>
      <h2 style={S.h}>{t.title}</h2>
      <div style={{ ...S.row, marginBottom: 10 }}>
        <button type="button" style={S.chip(part === 'count')} onClick={() => setPart('count')}>{t.count}</button>
        <button type="button" style={S.chip(part === 'returns')} onClick={() => setPart('returns')}>{t.returns}</button>
      </div>
      {part === 'count' ? <Count role={role} /> : <Returns />}
    </div>
  );
}

function Count({ role }) {
  const [variants, setVariants] = useState(null);
  const [mismatch, setMismatch] = useState([]);
  const [find, setFind] = useState('');
  const [open, setOpen] = useState(null);
  const [counted, setCounted] = useState('');
  const [adjust, setAdjust] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const load = async () => {
    setError('');
    try { const [v, m] = await Promise.all([call('GET', '/variants'), call('GET', '/reports/stock-mismatch')]); setVariants(v.data || []); setMismatch((m.data && m.data.items) || []); } catch (e) { setError(msg(e, T.common.failed)); }
  };
  useEffect(() => { load(); }, []);
  const q = find.trim().toLowerCase();
  const list = (variants || []).filter((v) => !q || `${v.style} ${v.size} ${v.colour} ${v.barcode || ''}`.toLowerCase().includes(q)).slice(0, 40);
  const save = async () => {
    setError(''); setResult(null);
    const fabric = isFabric(open);
    const n = fabric ? counted : Number(counted);
    if (counted === '' || (!fabric && !Number.isInteger(n))) return setError(fabric ? 'Counted metres: up to 2 decimals.' : 'Counted pieces must be a whole number.');
    try { const r = await call('POST', `/variants/${open._id}/count`, { counted: fabric ? Number(counted) : n, adjust: adjust && role === 'admin', reason }); setResult(r.data); setOpen(null); setCounted(''); setAdjust(false); setReason(''); load(); } catch (e) { setError(msg(e, T.common.failed)); }
  };
  return (
    <>
      <Msg error={error} />
      {result && <div style={S.card}><p>{t.expected}: {result.unit === 'centimetres' ? (result.expected / 100).toFixed(2) : result.expected} · {t.counted}: {result.unit === 'centimetres' ? (result.counted / 100).toFixed(2) : result.counted}</p><p><strong>{t.difference}: {result.unit === 'centimetres' ? (result.difference / 100).toFixed(2) : result.difference}</strong></p></div>}
      {open ? (
        <div style={S.card}>
          <strong>{open.style} {open.size} {open.colour}</strong>
          <p style={S.muted}>{t.expected}: {show(open, open.qty)}</p>
          <label style={S.label}>{t.counted} ({isFabric(open) ? t.metre : t.piece})</label>
          <input style={S.input} inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} />
          <label style={S.label}>{t.reason}</label><input style={S.input} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
          {role === 'admin' && <label style={{ ...S.label, display: 'flex', gap: 8 }}><input type="checkbox" checked={adjust} onChange={(e) => setAdjust(e.target.checked)} />{t.adjust}</label>}
          <div style={{ ...S.row, marginTop: 10 }}><button type="button" style={S.btn} onClick={save}>{t.saveCount}</button><button type="button" style={S.ghost} onClick={() => { setOpen(null); setError(''); }}>{T.common.cancel}</button></div>
        </div>
      ) : (
        <>
          <input style={S.input} placeholder={T.common.search} value={find} onChange={(e) => setFind(e.target.value)} />
          {!variants && !error && <p>{T.common.loading}</p>}
          {list.map((v) => <div key={v._id} style={{ ...S.card, marginTop: 8 }}><div style={{ ...S.row, justifyContent: 'space-between' }}><span>{v.style} {v.size} {v.colour}</span><span>{show(v, v.qty)}</span></div><button type="button" style={{ ...S.ghost, marginTop: 6 }} onClick={() => { setOpen(v); setResult(null); }}>{t.count}</button></div>)}
          {mismatch.length > 0 && <div style={S.card}><strong>{t.mismatch}</strong>{mismatch.map((m, i) => <p key={i} style={S.muted}>{m.reason || m.name}</p>)}</div>}
        </>
      )}
    </>
  );
}

function Returns() {
  const [bills, setBills] = useState(null);
  const [bill, setBill] = useState(null);
  const [variants, setVariants] = useState([]);
  const [kind, setKind] = useState('return');
  const [qty, setQty] = useState({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  useEffect(() => { (async () => { try { const [b, v] = await Promise.all([pos('GET', '/bills'), call('GET', '/variants')]); setBills(b.data || []); setVariants(v.data || []); } catch (e) { setError(msg(e, T.common.failed)); } })(); }, []);
  // Lines on a saved bill have no variant id, so the shop picks the items coming back from its own list.
  const submit = async () => {
    setError(''); setOk('');
    const picked = Object.entries(qty).filter(([, n]) => Number(n) > 0).map(([variantId, n]) => ({ variantId, qty: Number(n) }));
    if (!bill) return setError('Choose the bill.');
    if (!picked.length) return setError(T.stock.items);
    if (reason.trim().length < 3) return setError(t.reasonReturn);
    try { await call('POST', '/returns', { billId: bill._id, items: picked, reason: reason.trim(), kind }); setOk(`${t.returnDone}. ${t.moneyNote}`); setQty({}); setReason(''); setBill(null); } catch (e) { setError(msg(e, T.common.failed)); }
  };
  const [find, setFind] = useState('');
  const q = find.trim().toLowerCase();
  const pickList = variants.filter((v) => !q || `${v.style} ${v.size} ${v.colour}`.toLowerCase().includes(q)).slice(0, 20);
  return (
    <>
      <Msg error={error} ok={ok} />
      <div style={S.card}>
        <p style={S.label}>{t.recentBills}</p>
        {!bills && !error && <p>{T.common.loading}</p>}
        {bills && !bills.length && <p style={S.muted}>{T.common.none}</p>}
        <div style={S.row}>{(bills || []).slice(0, 15).map((b) => <button key={b._id} type="button" style={S.chip(bill && bill._id === b._id)} onClick={() => setBill(b)}>{b.number} · {rupees(b.total)}</button>)}</div>
        <p style={S.label}>{t.kind}</p>
        <div style={S.row}><button type="button" style={S.chip(kind === 'return')} onClick={() => setKind('return')}>{t.ret}</button><button type="button" style={S.chip(kind === 'exchange')} onClick={() => setKind('exchange')}>{t.exch}</button></div>
        <p style={S.label}>{t.items}</p>
        <input style={S.input} placeholder={T.common.search} value={find} onChange={(e) => setFind(e.target.value)} />
        {pickList.map((v) => (
          <div key={v._id} style={{ ...S.row, marginTop: 6 }}>
            <span style={{ flex: 1 }}>{v.style} {v.size} {v.colour}{isFabric(v) ? ` (${t.metre})` : ''}</span>
            <input style={{ ...S.input, width: 90 }} inputMode="decimal" value={qty[v._id] === undefined ? '' : qty[v._id]} placeholder="0" onChange={(e) => setQty({ ...qty, [v._id]: e.target.value })} />
          </div>
        ))}
        <label style={S.label}>{t.reasonReturn}</label><input style={S.input} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
        <button type="button" style={{ ...S.btn, marginTop: 10, width: '100%' }} onClick={submit}>{t.doReturn}</button>
      </div>
    </>
  );
}
