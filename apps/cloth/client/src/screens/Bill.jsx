import { useEffect, useMemo, useRef, useState } from 'react';
import pure from '../../../../../packages/core-pos/src/pure.js';
import { call, pos } from '../api.js';
import T from '../strings.js';
import { S, Msg, rupees, msg } from '../ui.jsx';

const t = T.bill;
const newId = () => { try { return window.crypto.randomUUID(); } catch (e) { return 'b' + Date.now() + Math.random().toString(36).slice(2, 8); } };
const disc = (type, value) => { const v = Number(value); return type && v > 0 ? { type, value: v } : undefined; };
const isFabric = (v) => v && v.unit === 'metre';
// Fabric stock is kept in whole centimetres; show metres.
const stockText = (v) => (isFabric(v) ? (v.qty / 100).toFixed(2) + ' m' : String(v.qty));

export default function Bill() {
  const [variants, setVariants] = useState(null);
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [lines, setLines] = useState([]);
  const [style, setStyle] = useState('');
  const [size, setSize] = useState('');
  const [find, setFind] = useState('');
  const [code, setCode] = useState('');
  const [billDisc, setBillDisc] = useState({ type: 'percent', value: '' });
  const [reason, setReason] = useState('');
  const [tax, setTax] = useState('none');
  const [pay, setPay] = useState({ cash: '', upi: '', card: '', credit: '' });
  const [phone, setPhone] = useState('');
  const [customer, setCustomer] = useState(null);
  const [busy, setBusy] = useState(false);
  const draftId = useRef(newId());

  const load = async () => {
    setError('');
    try {
      const [v, s] = await Promise.all([call('GET', '/variants'), call('GET', '/staff')]);
      setVariants(v.data || []); setStaff(s.data || []);
    } catch (e) { setError(msg(e, T.common.failed)); }
  };
  useEffect(() => { load(); }, []);

  const styles = useMemo(() => {
    const q = find.trim().toLowerCase();
    return [...new Set((variants || []).map((v) => v.style))].filter((s) => !q || s.toLowerCase().includes(q)).slice(0, 30);
  }, [variants, find]);
  const ofStyle = (variants || []).filter((v) => v.style === style);
  const sizes = [...new Set(ofStyle.map((v) => v.size))];
  const colours = ofStyle.filter((v) => v.size === size);

  const add = (v, qty, metres) => {
    setError('');
    setLines((ls) => [...ls, { key: newId(), v, qty: qty || 1, metres: metres || '', staffId: ls.length ? ls[ls.length - 1].staffId : '', dType: 'percent', dValue: '' }]);
  };
  const scan = async () => {
    setError('');
    const c = code.trim(); if (!c) return;
    try {
      const r = await call('GET', '/variants/by-barcode/' + encodeURIComponent(c));
      const v = r.data.variant; const full = (variants || []).find((x) => String(x._id) === String(v.id)) || { _id: v.id, style: v.style, size: v.size, colour: v.colour, mrp: v.mrp, unit: v.unit, qty: v.qty, gstRate: 0 };
      add(full, 1, ''); setCode('');
    } catch (e) { setError(msg(e, T.common.failed)); }
  };
  const setLine = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const drop = (key) => setLines((ls) => ls.filter((l) => l.key !== key));

  const looked = async () => {
    setError(''); setCustomer(null);
    const p = phone.replace(/\D/g, ''); if (p.length < 6) return;
    try { const r = await pos('GET', '/customers', null, { q: p }); setCustomer((r.data || [])[0] || false); } catch (e) { setError(msg(e, T.common.failed)); }
  };

  const anyDiscount = !!disc(billDisc.type, billDisc.value) || lines.some((l) => disc(l.dType, l.dValue));
  const previewLines = lines.map((l) => ({ name: `${l.v.style} ${l.v.size} ${l.v.colour}`, unitPrice: l.v.mrp, qty: isFabric(l.v) ? Number(l.metres) || 0 : Number(l.qty) || 0, gstRate: l.v.gstRate || 0, discount: disc(l.dType, l.dValue) }));
  let calc = null; let calcErr = '';
  if (lines.length && pure && pure.bill) { try { calc = pure.bill.compute({ lines: previewLines, billDiscount: disc(billDisc.type, billDisc.value), taxMode: tax }); } catch (e) { calcErr = e.message; } }
  const paid = Object.values(pay).reduce((a, x) => a + (Math.round(Number(x)) || 0), 0);
  const total = calc ? calc.total : 0;

  const save = async () => {
    setError('');
    if (!lines.length) return setError(t.noLines);
    if (lines.some((l) => !l.staffId)) return setError(t.needStaff);
    if (anyDiscount && reason.trim().length < 3) return setError(t.needReason);
    const body = {
      clientId: draftId.current, taxMode: tax,
      lines: lines.map((l) => ({ variantId: String(l.v._id), ...(isFabric(l.v) ? { metres: Number(l.metres) } : { qty: Number(l.qty) }), staffId: l.staffId, discount: disc(l.dType, l.dValue) })),
      billDiscount: disc(billDisc.type, billDisc.value), discountReason: anyDiscount ? reason.trim() : undefined,
      payments: Object.entries(pay).filter(([, a]) => Number(a) > 0).map(([method, amount]) => ({ method, amount: Math.round(Number(amount)) })),
      customerId: customer && customer._id ? customer._id : undefined,
    };
    setBusy(true);
    try { const r = await pos('POST', '/bills', body); setDone(r.data); load(); }
    catch (e) { setError(msg(e, T.common.failed)); } // the server's own words are shown, for example the staff discount limit
    finally { setBusy(false); }
  };
  const fresh = () => { setDone(null); setLines([]); setPay({ cash: '', upi: '', card: '', credit: '' }); setBillDisc({ type: 'percent', value: '' }); setReason(''); setPhone(''); setCustomer(null); setStyle(''); setSize(''); draftId.current = newId(); };

  if (done) {
    return (
      <div style={S.page}><div style={S.card}>
        <h2 style={S.h}>{t.saved}</h2>
        <p>{done.number || ''} {done.total != null ? '· ' + rupees(done.total) : ''}</p>
        {done.change > 0 && <p>{t.change}: {rupees(done.change)}</p>}
        <button type="button" style={S.btn} onClick={fresh}>{t.newBill}</button>
      </div></div>
    );
  }
  if (!variants) return <div style={S.page}><Msg error={error} />{!error && <p>{T.common.loading}</p>}{error && <button type="button" style={S.ghost} onClick={load}>{T.common.retry}</button>}</div>;

  return (
    <div style={S.page}>
      <h2 style={S.h}>{t.title}</h2>
      <Msg error={error} />
      <div style={S.card}>
        <label style={S.label} htmlFor="cl-code">{t.scan}</label>
        <div style={S.row}>
          <input id="cl-code" style={{ ...S.input, flex: 1 }} value={code} placeholder={t.scanHint} inputMode="text" autoComplete="off" onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') scan(); }} />
          <button type="button" style={S.btn} onClick={scan}>{t.scanGo}</button>
        </div>
        <label style={S.label} htmlFor="cl-find">{t.find}</label>
        <input id="cl-find" style={S.input} value={find} onChange={(e) => setFind(e.target.value)} />
        <div style={{ ...S.row, marginTop: 8 }}>{styles.map((s) => <button key={s} type="button" style={S.chip(s === style)} onClick={() => { setStyle(s); setSize(''); }}>{s}</button>)}</div>
        {style && <><p style={S.label}>{t.pickSize}</p><div style={S.row}>{sizes.map((z) => <button key={z} type="button" style={S.chip(z === size)} onClick={() => setSize(z)}>{z}</button>)}</div></>}
        {size && <><p style={S.label}>{t.pickColour}</p><div style={S.row}>{colours.map((v) => <button key={v._id} type="button" disabled={v.qty <= 0} style={{ ...S.chip(false), opacity: v.qty <= 0 ? 0.5 : 1 }} onClick={() => add(v)}>{v.colour} · {v.qty <= 0 ? t.outOfStock : rupees(v.mrp)}</button>)}</div></>}
      </div>

      {lines.map((l) => (
        <div key={l.key} style={S.card}>
          <div style={{ ...S.row, justifyContent: 'space-between' }}><strong>{l.v.style} {l.v.size} {l.v.colour}</strong><button type="button" style={S.ghost} onClick={() => drop(l.key)}>{t.remove}</button></div>
          <p style={S.muted}>{rupees(l.v.mrp)} · {t.stockLeft}: {stockText(l.v)}</p>
          {isFabric(l.v)
            ? <><label style={S.label}>{t.metres}</label><input style={S.input} inputMode="decimal" value={l.metres} onChange={(e) => setLine(l.key, { metres: e.target.value })} /></>
            : <><label style={S.label}>{t.qty}</label><input style={S.input} inputMode="numeric" value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value.replace(/\D/g, '') })} /></>}
          <label style={S.label}>{t.staff}</label>
          <select style={S.input} value={l.staffId} onChange={(e) => setLine(l.key, { staffId: e.target.value })}>
            <option value="">{t.pickStaff}</option>{staff.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
          <label style={S.label}>{t.discount}</label>
          <div style={S.row}>
            <select style={{ ...S.input, width: 120 }} value={l.dType} onChange={(e) => setLine(l.key, { dType: e.target.value })}><option value="percent">{t.discPercent}</option><option value="amount">{t.discAmount}</option></select>
            <input style={{ ...S.input, flex: 1 }} inputMode="numeric" value={l.dValue} onChange={(e) => setLine(l.key, { dValue: e.target.value.replace(/\D/g, '') })} />
          </div>
        </div>
      ))}

      {lines.length > 0 && (
        <div style={S.card}>
          <label style={S.label}>{t.billDiscount}</label>
          <div style={S.row}>
            <select style={{ ...S.input, width: 120 }} value={billDisc.type} onChange={(e) => setBillDisc({ ...billDisc, type: e.target.value })}><option value="percent">{t.discPercent}</option><option value="amount">{t.discAmount}</option></select>
            <input style={{ ...S.input, flex: 1 }} inputMode="numeric" value={billDisc.value} onChange={(e) => setBillDisc({ ...billDisc, value: e.target.value.replace(/\D/g, '') })} />
          </div>
          {anyDiscount && <><label style={S.label}>{t.discReason}</label><input style={S.input} maxLength={120} value={reason} onChange={(e) => setReason(e.target.value)} /></>}
          <label style={S.label}>{t.customer}</label>
          <div style={S.row}><input style={{ ...S.input, flex: 1 }} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={looked} />
            {customer === false && <span style={S.muted}>{T.common.none}</span>}{customer && customer.name && <span>{t.customerFound}: {customer.name}</span>}</div>
          <label style={S.label}>{t.tax}</label>
          <select style={S.input} value={tax} onChange={(e) => setTax(e.target.value)}><option value="none">{t.taxNone}</option><option value="gst_exclusive">{t.taxExcl}</option><option value="gst_inclusive">{t.taxIncl}</option></select>
        </div>
      )}

      {lines.length > 0 && (
        <div style={S.card}>
          <h3 style={S.h}>{t.total}: {rupees(total)}</h3>
          {calcErr && <p style={S.err}>{calcErr}</p>}
          <p style={S.label}>{t.pay}</p>
          {[['cash', t.cash], ['upi', t.upi], ['card', t.card], ['credit', t.credit]].map(([k, label]) => (
            <div key={k} style={{ ...S.row, marginBottom: 6 }}>
              <span style={{ width: 90 }}>{label}</span>
              <input style={{ ...S.input, flex: 1 }} inputMode="numeric" value={pay[k]} onChange={(e) => setPay({ ...pay, [k]: e.target.value.replace(/\D/g, '') })} />
              <button type="button" style={S.ghost} onClick={() => setPay({ cash: '', upi: '', card: '', credit: '', [k]: String(Math.max(total - (paid - (Math.round(Number(pay[k])) || 0)), 0)) })}>{rupees(total)}</button>
            </div>
          ))}
          <p style={S.muted}>{t.remaining}: {rupees(Math.max(total - paid, 0))}{paid > total ? ` · ${t.change}: ${rupees(paid - total)}` : ''}</p>
          <button type="button" disabled={busy} style={{ ...S.btn, width: '100%' }} onClick={save}>{busy ? T.common.loading : t.save}</button>
        </div>
      )}
    </div>
  );
}
