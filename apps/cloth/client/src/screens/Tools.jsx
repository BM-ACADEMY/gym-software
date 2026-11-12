import { useEffect, useState } from 'react';
import { call } from '../api.js';
import { S, Msg, rupees, msg } from '../ui.jsx';

// Owner tools (CLO-13): item import with preview, godown transfer, catalogue link, UPI payment link, GST setting, shifts calendar.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export default function Tools({ role }) {
  const [part, setPart] = useState('import');
  const parts = [['import', 'Import items'], ['godown', 'Godown'], ['catalogue', 'Catalogue'], ['upi', 'UPI link'], ['shifts', 'Shifts'], ['gst', 'GST']];
  if (role !== 'admin') return <div style={S.page}><p style={S.muted}>Only the owner can use these tools.</p></div>;
  return (
    <div style={S.page}>
      <h2 style={S.h}>Shop tools</h2>
      <div style={{ ...S.row, marginBottom: 10 }}>{parts.map(([k, l]) => <button key={k} type="button" style={S.chip(part === k)} onClick={() => setPart(k)}>{l}</button>)}</div>
      {part === 'import' && <Import />}{part === 'godown' && <Godown />}{part === 'catalogue' && <Catalogue />}{part === 'upi' && <Upi />}{part === 'shifts' && <Shifts />}{part === 'gst' && <Gst />}
    </div>
  );
}

function Import() {
  const [text, setText] = useState(''); const [pv, setPv] = useState(null); const [error, setError] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);
  const file = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { setText(String(r.result || '')); setPv(null); setOk(''); }; r.readAsText(f); };
  const run = async (confirm) => { setError(''); setOk(''); setBusy(true); try { const r = await call('POST', '/items/import/' + (confirm ? 'confirm' : 'preview'), { csv: text }); if (confirm) { setOk(`${r.data.added} added, ${r.data.skipped} skipped.`); setPv(null); setText(''); } else setPv(r.data); } catch (e) { setError(msg(e, 'Failed')); } finally { setBusy(false); } };
  return (
    <div style={S.card}>
      <p style={S.muted}>CSV columns: style, size, colour, mrp (required); cost, qty, barcode, category, unit (optional). You see a preview first. Nothing is saved until you confirm.</p>
      <input type="file" accept=".csv,text/csv" onChange={file} aria-label="Pick CSV file" />
      <Msg error={error} ok={ok} />
      <button type="button" disabled={busy || !text} style={S.btn} onClick={() => run(false)}>Preview</button>
      {pv && <div><p>{pv.ok} of {pv.total} rows are good. {pv.errorCount} will be skipped.</p>
        {pv.errors.slice(0, 20).map((x) => <p key={x.line} style={S.err}>Line {x.line}: {x.message}</p>)}
        {pv.ok > 0 && <button type="button" disabled={busy} style={S.btn} onClick={() => run(true)}>Add {pv.ok} items</button>}</div>}
    </div>
  );
}

function Godown() {
  const [variants, setVariants] = useState([]); const [rows, setRows] = useState([]); const [error, setError] = useState(''); const [ok, setOk] = useState('');
  const [f, setF] = useState({ variantId: '', dir: 'out', godown: '', qty: '' });
  const load = async () => { try { const [v, g] = await Promise.all([call('GET', '/variants'), call('GET', '/godown')]); setVariants(v.data || []); setRows(g.data || []); } catch (e) { setError(msg(e, 'Failed')); } };
  useEffect(() => { load(); }, []);
  const go = async () => { setError(''); setOk(''); try { await call('POST', '/godown/transfer', { variantId: f.variantId, from: f.dir === 'out' ? 'shop' : f.godown, to: f.dir === 'out' ? f.godown : 'shop', qty: f.qty }); setOk('Moved.'); setF({ ...f, qty: '' }); load(); } catch (e) { setError(msg(e, 'Failed')); } };
  return (
    <div style={S.card}>
      <select style={S.input} value={f.variantId} onChange={(e) => setF({ ...f, variantId: e.target.value })}><option value="">Pick item</option>{variants.map((v) => <option key={v._id} value={v._id}>{v.style} {v.size} {v.colour}</option>)}</select>
      <select style={S.input} value={f.dir} onChange={(e) => setF({ ...f, dir: e.target.value })}><option value="out">Shop to godown</option><option value="in">Godown to shop</option></select>
      <input style={S.input} placeholder="Godown name" maxLength={40} value={f.godown} onChange={(e) => setF({ ...f, godown: e.target.value })} />
      <input style={S.input} placeholder="Quantity (metres for fabric)" inputMode="decimal" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
      <Msg error={error} ok={ok} /><button type="button" style={S.btn} onClick={go}>Move stock</button>
      <h3 style={S.h}>In godowns</h3>{rows.length === 0 && <p style={S.muted}>Nothing in a godown.</p>}
      {rows.map((r, i) => <p key={i}>{r.godown}: {r.style} {r.size} {r.colour} · {r.unit === 'metre' ? (r.qty / 100).toFixed(2) + ' m' : r.qty}</p>)}
    </div>
  );
}

function Catalogue() {
  const [st, setSt] = useState(null); const [link, setLink] = useState(null); const [error, setError] = useState(''); const [vs, setVs] = useState([]);
  const load = async () => { try { setVs((await call('GET', '/variants')).data || []); setSt((await call('GET', '/settings')).data); setLink((await call('GET', '/catalogue/link')).data); } catch (e) { setError(msg(e, 'Failed')); } };
  useEffect(() => { load(); }, []);
  const act = async (fn) => { setError(''); try { await fn(); await load(); } catch (e) { setError(msg(e, 'Failed')); } };
  const url = (p) => window.location.origin + p;
  return (
    <div style={S.card}>
      <p style={S.muted}>A web page of the items you mark public and that are in stock. No stock counts. Prices show only if you turn them on. Making a new link stops the old one.</p>
      <Msg error={error} />
      {link && link.on && <p>Link: <a href={url(link.path)} target="_blank" rel="noreferrer">{url(link.path)}</a></p>}
      <div style={S.row}>
        <button type="button" style={S.btn} onClick={() => act(() => call('POST', '/catalogue/link', {}))}>{link && link.on ? 'Make a new link' : 'Turn on'}</button>
        {link && link.on && <button type="button" style={S.ghost} onClick={() => act(() => call('POST', '/catalogue/off', {}))}>Turn off</button>}
      </div>
      {st && <label style={S.label}><input type="checkbox" checked={!!st.catalogueShowPrice} onChange={(e) => act(() => call('PUT', '/settings', { catalogueShowPrice: e.target.checked }))} /> Show prices</label>}
      <h3 style={S.h}>Items on the page</h3>
      {vs.slice(0, 300).map((v) => <label key={v._id} style={{ display: 'block', padding: '6px 0' }}><input type="checkbox" checked={!!v.isPublic} onChange={(e) => act(() => call('PUT', '/variants/' + v._id + '/public', { isPublic: e.target.checked }))} /> {v.style} {v.size} {v.colour}</label>)}
    </div>
  );
}

function Upi() {
  const [st, setSt] = useState(null); const [id, setId] = useState(''); const [amount, setAmount] = useState(''); const [note, setNote] = useState(''); const [list, setList] = useState([]); const [made, setMade] = useState(null); const [error, setError] = useState('');
  const load = async () => { try { const s = (await call('GET', '/settings')).data; setSt(s); setId(s.upiId || ''); setList((await call('GET', '/upi-links')).data || []); } catch (e) { setError(msg(e, 'Failed')); } };
  useEffect(() => { load(); }, []);
  const act = async (fn) => { setError(''); try { await fn(); await load(); } catch (e) { setError(msg(e, 'Failed')); } };
  return (
    <div style={S.card}>
      <p style={S.muted}>We make the payment link from your UPI id. We cannot see the money: after you check your UPI app, mark the link paid.</p>
      <Msg error={error} />
      <input style={S.input} placeholder="Your UPI id, like shop@bank" value={id} onChange={(e) => setId(e.target.value.trim())} />
      <button type="button" style={S.ghost} onClick={() => act(() => call('PUT', '/settings', { upiId: id }))}>Save UPI id</button>
      <input style={S.input} placeholder="Amount (whole rupees)" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
      <input style={S.input} placeholder="Note (optional)" maxLength={40} value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="button" style={S.btn} disabled={!st || !st.upiId} onClick={() => act(async () => setMade((await call('POST', '/upi-links', { amount: Number(amount), note })).data))}>Make link</button>
      {made && <p>Link: <a href={made.url}>{made.url}</a></p>}
      {list.map((d) => <div key={d.id} style={S.row}><span>{rupees(d.amount)} · {d.note || '-'} · {d.status}</span>{d.status === 'pending' && <button type="button" style={S.ghost} onClick={() => act(() => call('POST', '/upi-links/' + d.id + '/paid', {}))}>Mark paid</button>}</div>)}
    </div>
  );
}

function Shifts() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); const [cal, setCal] = useState(null); const [error, setError] = useState('');
  useEffect(() => { (async () => { setError(''); try { setCal((await call('GET', '/shifts/calendar', null, { month })).data); } catch (e) { setError(msg(e, 'Failed')); } })(); }, [month]);
  return (
    <div style={S.card}>
      <input style={S.input} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      <Msg error={error} />
      {cal && cal.days.map((d) => (
        <div key={d.date} style={{ borderTop: '1px solid #eee', padding: '4px 0' }}><b>{d.date.slice(8)} {DAYS[d.weekday]}</b>
          {d.people.filter((p) => p.planned || p.marked).map((p) => <div key={p.staffId} style={{ fontSize: 14, color: p.gap ? '#b91c1c' : '#222' }}>{p.name}: {p.planned ? p.planned.start + ' to ' + p.planned.end : 'off'} · {p.marked || (p.gap ? 'not marked' : '-')}</div>)}
        </div>
      ))}
      <p style={S.muted}>Payslip print page: Customers and staff, or open /api/cloth/staff/ID/payslip?format=html.</p>
    </div>
  );
}

function Gst() {
  const [st, setSt] = useState(null); const [error, setError] = useState('');
  const load = async () => { try { setSt((await call('GET', '/settings')).data); } catch (e) { setError(msg(e, 'Failed')); } };
  useEffect(() => { load(); }, []);
  const set = async (gstMode) => { setError(''); try { setSt((await call('PUT', '/settings', { gstMode })).data); } catch (e) { setError(msg(e, 'Failed')); } };
  return (
    <div style={S.card}>
      <p style={S.muted}>Starting choice for GST on the bill. The bill screen can still change it. Ask your CA before you choose.</p>
      <Msg error={error} />
      {st && ['none', 'inclusive', 'exclusive'].map((m) => <button key={m} type="button" style={S.chip(st.gstMode === m)} onClick={() => set(m)}>{m === 'none' ? 'No GST' : m === 'inclusive' ? 'Price has GST' : 'GST on top'}</button>)}
      {st && <p style={S.muted}>{st.gstModeNote}</p>}
    </div>
  );
}
