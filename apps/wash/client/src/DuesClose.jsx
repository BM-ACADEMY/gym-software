import { useCallback, useEffect, useState } from 'react';
import S from './strings.js';
import { Card, Err, Field, Note, btn, colors, input, today, useAction } from './ui.jsx';

const money = (n) => S.common.rupee + ' ' + (Number(n) || 0);

// Customers who still owe, with a Collect button (cash, UPI or card, up to the amount due).
export function Dues({ api }) {
  const [run, busy, err] = useAction();
  const [data, setData] = useState(null); const [open, setOpen] = useState(''); const [f, setF] = useState({ amount: '', method: 'cash' }); const [msg, setMsg] = useState('');
  const load = useCallback(() => run(async () => { setData((await api.get('/dues/customers')).data); }), [api]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  const collect = (row) => run(async () => {
    await api.post('/jobs/' + row.id + '/collect', { payments: [{ method: f.method, amount: Math.round(Number(f.amount)) }] });
    setOpen(''); setMsg(S.dues.collected); setF({ amount: '', method: 'cash' }); await load();
  });
  return (
    <div style={{ padding: 12 }}>
      <h2 style={{ fontSize: 18 }}>{S.dues.title}</h2>
      <Err text={err} />
      {msg && <p style={{ color: colors.ok }}>{msg}</p>}
      {data && !data.rows.length && <Note>{S.dues.none}</Note>}
      {data && data.rows.length > 0 && <p><strong>{S.dues.total}: {money(data.total)}</strong></p>}
      {data && data.rows.map((r) => (
        <Card key={r.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{r.plate}</strong><strong>{money(r.due)}</strong></div>
          <Note>#{r.number} · {r.day}{r.ownerName ? ' · ' + r.ownerName : ''}{r.note ? ' · ' + r.note : ''}</Note>
          {r.ownerPhone && <a href={'tel:' + r.ownerPhone} style={{ ...btn(false, true), display: 'inline-block', textDecoration: 'none', marginRight: 8 }}>{r.ownerPhone}</a>}
          <button type="button" style={btn(true, true)} onClick={() => { setOpen(open === r.id ? '' : r.id); setF({ amount: String(r.due), method: 'cash' }); setMsg(''); }}>{S.dues.collect}</button>
          {open === r.id && (
            <div style={{ marginTop: 8 }}>
              <Field label={S.dues.how}>
                <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} style={input}><option value="cash">{S.board.cash}</option><option value="upi">{S.board.upi}</option><option value="card">{S.board.card}</option></select>
              </Field>
              <Field label={S.dues.amount}><input inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/\D/g, '') })} style={input} /></Field>
              <button type="button" disabled={busy || !f.amount} style={btn(true)} onClick={() => collect(r)}>{S.dues.collect}</button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// Day close: opening cash and the cash counted. The server works out the expected cash (cash sales, collected dues, refunds); a difference is kept and shown to the owner.
export function DayClose({ api }) {
  const [run, busy, err] = useAction();
  const [f, setF] = useState({ opening: '0', declared: '' }); const [result, setResult] = useState(null); const [hist, setHist] = useState([]);
  const load = useCallback(() => run(async () => { setHist((await api.get('/cash-closing')).data || []); }), [api]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  const close = () => run(async () => {
    const d = (await api.post('/cash-closing', { day: today(), openingFloat: Math.round(Number(f.opening) || 0), declared: Math.round(Number(f.declared)) })).data;
    setResult(d); await load();
  });
  const closedToday = hist.some((h) => h.day === today());
  return (
    <div style={{ padding: 12 }}>
      <h2 style={{ fontSize: 18 }}>{S.close.title}</h2>
      <Note>{S.close.help}</Note>
      <Err text={err} />
      {!closedToday && !result && (
        <>
          <Field label={S.close.opening}><input inputMode="numeric" value={f.opening} onChange={(e) => setF({ ...f, opening: e.target.value.replace(/\D/g, '') })} style={input} /></Field>
          <Field label={S.close.declared}><input inputMode="numeric" value={f.declared} onChange={(e) => setF({ ...f, declared: e.target.value.replace(/\D/g, '') })} style={input} /></Field>
          <button type="button" disabled={busy || f.declared === ''} style={btn(true)} onClick={close}>{S.close.closeBtn}</button>
        </>
      )}
      {result && (
        <Card>
          <strong>{S.close.done}</strong>
          <p style={{ margin: '6px 0' }}>{S.close.expected}: {money(result.expected)}<br />{S.close.counted}: {money(result.declared)}<br />{S.close.diff}: {money(result.diff)}{result.flag ? ' · ' + S.close.flag : ''}</p>
        </Card>
      )}
      <h3 style={{ fontSize: 16 }}>{S.close.history}</h3>
      {!hist.length && <Note>{S.close.none}</Note>}
      {hist.slice(0, 7).map((h) => <Note key={h.id}>{h.day}: {S.close.expected} {money(h.expected)}, {S.close.counted} {money(h.declared)}, {S.close.diff} {money(h.diff)}{h.flag ? ' · ' + S.close.flag : ''}</Note>)}
    </div>
  );
}
