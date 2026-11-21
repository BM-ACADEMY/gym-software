import { useCallback, useEffect, useMemo, useState } from 'react';
import { wordsFor } from './strings.js';

// Salon staff screens: day view, walk-ins, bill, customers. Phone first: big buttons, one column.
// Every price, discount limit and GST rule is decided by the server; this page only shows what the server says.
const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const msg = (e) => (e && e.response && e.response.data && e.response.data.message) || (e && e.message) || 'Something went wrong. Please try again.';
const S = {
  card: { border: '1px solid #e1e8ec', borderRadius: 16, padding: 14, margin: '10px 12px', background: '#fff', boxShadow: '0 1px 2px rgba(20,35,43,.06), 0 4px 14px rgba(20,35,43,.06)' },
  big: { padding: '12px 18px', fontSize: 16, fontWeight: 600, borderRadius: 12, border: '1px solid #c5d0d6', background: '#fff', minHeight: 46, cursor: 'pointer' },
  main: { padding: '12px 20px', fontSize: 16, fontWeight: 700, borderRadius: 12, border: 0, background: 'linear-gradient(135deg,#d6246f,#9d174d)', color: '#fff', minHeight: 46, cursor: 'pointer', boxShadow: '0 3px 10px rgba(190,24,93,.28)' },
  input: { display: 'block', width: '100%', padding: '11px 12px', margin: '4px 0 10px', fontSize: 16, boxSizing: 'border-box', minHeight: 46 },
  row: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  err: { color: '#a52a2a', background: '#f9dcdc', borderRadius: 10, padding: '8px 12px', margin: '8px 12px' },
  chip: (on) => ({ padding: '10px 12px', fontSize: 15, borderRadius: 20, border: '1px solid ' + (on ? '#be185d' : '#c5d0d6'), background: on ? '#fce7f3' : '#fff', color: on ? '#9d174d' : '#14232b', fontWeight: on ? 700 : 500, minHeight: 44, cursor: 'pointer' }),
};
function useLoad(fn, deps) {
  const [state, set] = useState({ loading: true, data: null, error: '' });
  const run = useCallback(async () => { set((s) => ({ ...s, loading: true, error: '' })); try { set({ loading: false, data: await fn(), error: '' }); } catch (e) { set({ loading: false, data: null, error: msg(e) }); } }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, [run]);
  return [state, run];
}
const Err = ({ text, t, retry }) => (text ? <p role="alert" style={S.err}>{text} {retry && <button type="button" style={S.big} onClick={retry}>{t.common.retry}</button>}</p> : null);

// ---------- Day view ----------
function Day({ api, role, t, w, clinic }) {
  const [date, setDate] = useState(istToday()); const [staffId, setStaffId] = useState('');
  const [refs] = useLoad(async () => ({ staff: (await api.get('/staff')).data.filter((s) => s.isActive !== false), services: (await api.get('/services')).data.filter((s) => s.isActive !== false) }), []);
  const [list, reload] = useLoad(async () => (await api.get('/appointments', { date })).data, [date]);
  const [form, setForm] = useState(null); const [moving, setMoving] = useState(null); const [error, setError] = useState(''); const [view, setView] = useState('list');
  const staff = refs.data ? refs.data.staff : []; const services = refs.data ? refs.data.services : [];
  const nameOf = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s.name])), [staff]);
  const svcOf = useMemo(() => Object.fromEntries(services.map((s) => [s.key, s])), [services]);
  const act = async (id, what, body) => { setError(''); try { await api.post(`/appointments/${id}/${what}`, body); setMoving(null); await reload(); } catch (e) { setError(msg(e)); } };
  const shown = (list.data || []).filter((a) => !staffId || String(a.staffId) === staffId);
  return (
    <div>
      <div style={S.card}>
        <label>{t.day.date}<input type="date" style={S.input} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <div style={S.row}>
          <button type="button" style={S.chip(!staffId)} onClick={() => setStaffId('')}>{t.day.all}</button>
          {staff.map((s) => <button key={s.id} type="button" style={S.chip(staffId === s.id)} onClick={() => setStaffId(s.id)}>{s.name}</button>)}
        </div>
        <div style={S.row}><button type="button" style={S.chip(view === 'list')} onClick={() => setView('list')}>{t.day.list}</button><button type="button" style={S.chip(view === 'grid')} onClick={() => setView('grid')}>{t.day.grid}</button></div>
        <p><button type="button" style={S.main} onClick={() => setForm({ date, serviceKey: '', staffId: staffId || '', start: null, name: '', phone: '', consent: false, bodyArea: 'other' })}>{t.day.book}</button></p>
      </div>
      <Err text={error || list.error || refs.error} t={t} retry={reload} />
      {list.loading && <p style={S.err}>{t.common.loading}</p>}
      {!list.loading && !shown.length && <p style={{ margin: '10px 16px' }}>{t.common.none}</p>}
      {view === 'grid' && <Grid t={t} staff={staffId ? staff.filter((s) => s.id === staffId) : staff} appts={shown} svcOf={svcOf} onEmpty={(sid) => setForm({ date, serviceKey: '', staffId: sid, start: null, name: '', phone: '', consent: false, bodyArea: 'other' })} />}
      {view === 'list' && shown.map((a) => (
        <div key={a.id} style={S.card}>
          <strong>{hhmm(a.start)}–{hhmm(a.start + a.mins)}</strong> · {(svcOf[a.serviceKey] || {}).name || a.serviceKey} · {nameOf[a.staffId] || w.staff}
          <div>{a.customer ? a.customer.name + ' · ' + a.customer.phone : ''}{clinic && a.bodyArea ? ' · ' + (t.day.areas[a.bodyArea] || a.bodyArea) : ''}</div>
          <div style={{ color: '#666' }}>{t.day.status[a.status] || a.status}</div>
          <div style={S.row}>
            {a.status === 'pending' && role === 'admin' && <button type="button" style={S.main} onClick={() => act(a.id, 'accept')}>{t.day.accept}</button>}
            {a.status === 'booked' && <button type="button" style={S.main} onClick={() => act(a.id, 'done')}>{t.day.done}</button>}
            {a.status === 'booked' && <button type="button" style={S.big} onClick={() => act(a.id, 'noshow')}>{t.day.noshow}</button>}
            {['booked', 'pending'].includes(a.status) && <button type="button" style={S.big} onClick={() => setMoving({ a, date: a.date, start: null })}>{t.day.move}</button>}
            {['booked', 'pending'].includes(a.status) && <button type="button" style={S.big} onClick={() => act(a.id, 'cancel')}>{t.day.cancelVisit}</button>}
          </div>
          {moving && moving.a.id === a.id && <Mover api={api} t={t} moving={moving} setMoving={setMoving} onSave={() => act(a.id, 'reschedule', { date: moving.date, start: moving.start, staffId: a.staffId })} />}
        </div>
      ))}
      {form && <BookForm api={api} t={t} w={w} clinic={clinic} form={form} setForm={setForm} staff={staff} services={services} onDone={() => { setForm(null); reload(); }} />}
    </div>
  );
}
// A simple time grid: one column per person, one row per half hour. Booked boxes show the customer; empty boxes open the booking form.
function Grid({ t, staff, appts, svcOf, onEmpty }) {
  const live = appts.filter((a) => a.status !== 'cancelled');
  const from = Math.min(540, ...live.map((a) => Math.floor(a.start / 30) * 30)); const to = Math.max(1260, ...live.map((a) => Math.ceil((a.start + a.mins) / 30) * 30));
  const rows = []; for (let m = from; m < to; m += 30) rows.push(m);
  if (!staff.length) return <p style={{ margin: '10px 16px' }}>{t.common.none}</p>;
  const cell = { border: '1px solid #e5e5e5', padding: 4, fontSize: 13, verticalAlign: 'top', minWidth: 90, height: 34 };
  return (
    <div style={{ margin: '10px 12px', overflowX: 'auto' }}>
      <small>{t.day.gridHint}</small>
      <table style={{ borderCollapse: 'collapse', width: '100%', background: '#fff' }}>
        <thead><tr><th style={cell} />{staff.map((s) => <th key={s.id} style={cell}>{s.name}</th>)}</tr></thead>
        <tbody>{rows.map((m) => (
          <tr key={m}><td style={{ ...cell, minWidth: 48, color: '#666' }}>{hhmm(m)}</td>
            {staff.map((s) => {
              const a = live.find((x) => String(x.staffId) === s.id && x.start >= m && x.start < m + 30);
              const busy = !a && live.some((x) => String(x.staffId) === s.id && x.start < m && x.start + x.mins > m);
              if (a) return <td key={s.id} style={{ ...cell, background: a.status === 'pending' ? '#fef3c7' : a.status === 'done' ? '#dcfce7' : '#fce7f3' }}><strong>{a.customer ? a.customer.name : ''}</strong><br />{(svcOf[a.serviceKey] || {}).name || a.serviceKey}</td>;
              if (busy) return <td key={s.id} style={{ ...cell, background: '#f5f5f5' }} />;
              return <td key={s.id} style={cell}><button type="button" aria-label={hhmm(m) + ' ' + s.name} style={{ width: '100%', height: 28, border: 0, background: 'transparent', cursor: 'pointer' }} onClick={() => onEmpty(s.id)} /></td>;
            })}
          </tr>))}</tbody>
      </table>
    </div>
  );
}
function SlotPicker({ api, t, date, staffId, serviceKey, value, onPick }) {
  const [s] = useLoad(async () => (staffId && serviceKey && date ? (await api.get('/slots', { date, staffId, serviceKey })).data : { slots: [] }), [date, staffId, serviceKey]);
  if (!staffId || !serviceKey) return null;
  return (
    <div>
      <Err text={s.error} t={t} />
      {s.loading ? <p>{t.common.loading}</p> : !(s.data.slots || []).length ? <p>{t.day.noSlots}</p> : (
        <div style={S.row}>{s.data.slots.map((m) => <button key={m} type="button" style={S.chip(value === m)} onClick={() => onPick(m)}>{hhmm(m)}</button>)}</div>)}
    </div>
  );
}
function Mover({ api, t, moving, setMoving, onSave }) {
  const a = moving.a;
  return (
    <div style={{ marginTop: 8, borderTop: '1px solid #eee', paddingTop: 8 }}>
      <label>{t.day.moveTo}<input type="date" style={S.input} value={moving.date} onChange={(e) => setMoving({ ...moving, date: e.target.value, start: null })} /></label>
      <SlotPicker api={api} t={t} date={moving.date} staffId={String(a.staffId)} serviceKey={a.serviceKey} value={moving.start} onPick={(m) => setMoving({ ...moving, start: m })} />
      <div style={S.row}><button type="button" style={S.main} disabled={moving.start === null} onClick={onSave}>{t.common.save}</button><button type="button" style={S.big} onClick={() => setMoving(null)}>{t.common.cancel}</button></div>
    </div>
  );
}
function BookForm({ api, t, w, clinic, form, setForm, staff, services, onDone }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm({ ...form, [k]: v, ...(k === 'date' || k === 'staffId' || k === 'serviceKey' ? { start: null } : {}) });
  const ok = form.serviceKey && form.staffId && form.start !== null && form.name.trim().length >= 2 && /^\d{10}$/.test(form.phone) && form.consent;
  const submit = async () => {
    setBusy(true); setError('');
    try { await api.post('/appointments', { date: form.date, start: form.start, staffId: form.staffId, serviceKey: form.serviceKey, name: form.name.trim(), phone: form.phone, consentGiven: true, ...(clinic ? { bodyArea: form.bodyArea } : {}) }); onDone(); }
    catch (e) { setError(msg(e)); } finally { setBusy(false); }
  };
  return (
    <div style={{ ...S.card, borderColor: '#be185d' }}>
      <label>{t.day.date}<input type="date" style={S.input} value={form.date} onChange={(e) => set('date', e.target.value)} /></label>
      <label>{t.day.pickService}<select style={S.input} value={form.serviceKey} onChange={(e) => set('serviceKey', e.target.value)}><option value="">—</option>{services.map((s) => <option key={s.key} value={s.key}>{s.name} · {s.mins} min</option>)}</select></label>
      <label>{t.day.pickStaff} ({w.staff})<select style={S.input} value={form.staffId} onChange={(e) => set('staffId', e.target.value)}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <p style={{ margin: '4px 0' }}>{t.day.pickTime}</p>
      <SlotPicker api={api} t={t} date={form.date} staffId={form.staffId} serviceKey={form.serviceKey} value={form.start} onPick={(m) => setForm({ ...form, start: m })} />
      {clinic && <label>{t.day.area}<select style={S.input} value={form.bodyArea} onChange={(e) => set('bodyArea', e.target.value)}>{Object.keys(t.day.areas).map((k) => <option key={k} value={k}>{t.day.areas[k]}</option>)}</select></label>}
      <label>{t.day.name} ({w.customer})<input style={S.input} value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" /></label>
      <label>{t.day.phone}<input style={S.input} value={form.phone} inputMode="numeric" maxLength={10} onChange={(e) => set('phone', e.target.value.replace(/\D/g, ''))} /></label>
      <label style={{ display: 'block', marginBottom: 10 }}><input type="checkbox" checked={form.consent} onChange={(e) => set('consent', e.target.checked)} /> {t.day.consent}</label>
      <Err text={error} t={t} />
      <div style={S.row}><button type="button" style={S.main} disabled={!ok || busy} onClick={submit}>{t.day.book}</button><button type="button" style={S.big} onClick={() => setForm(null)}>{t.common.cancel}</button></div>
    </div>
  );
}

// ---------- Walk-in queue ----------
function Queue({ api, t, w }) {
  const [q, reload] = useLoad(async () => (await api.get('/queue')).data, []);
  const [refs] = useLoad(async () => (await api.get('/services')).data, []);
  const [f, setF] = useState({ name: '', phone: '', serviceKey: '' }); const [error, setError] = useState('');
  const add = async () => { setError(''); try { await api.post('/queue', { name: f.name.trim(), phone: f.phone || undefined, serviceKey: f.serviceKey || undefined }); setF({ name: '', phone: '', serviceKey: '' }); await reload(); } catch (e) { setError(msg(e)); } };
  const move = async (id, status) => { setError(''); try { await api.post(`/queue/${id}/status`, { status }); await reload(); } catch (e) { setError(msg(e)); } };
  return (
    <div>
      <div style={S.card}>
        <strong>{t.queue.add}</strong>
        <input style={S.input} placeholder={t.queue.name} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input style={S.input} placeholder={t.queue.phone} inputMode="numeric" maxLength={10} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '') })} />
        <select style={S.input} value={f.serviceKey} onChange={(e) => setF({ ...f, serviceKey: e.target.value })}><option value="">{t.queue.service}</option>{(refs.data || []).map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</select>
        <button type="button" style={S.main} disabled={f.name.trim().length < 2} onClick={add}>{t.queue.add}</button>
      </div>
      <Err text={error || q.error} t={t} retry={reload} />
      <h3 style={{ margin: '10px 16px' }}>{t.queue.title}</h3>
      {!q.loading && !(q.data || []).length && <p style={{ margin: '10px 16px' }}>{t.common.none}</p>}
      {(q.data || []).map((x) => (
        <div key={x.id} style={S.card}>
          <strong>{x.name}</strong> {x.phone ? '· ' + x.phone : ''} · {x.status === 'serving' ? t.queue.serving : t.queue.waiting}
          <div style={S.row}>
            {x.status === 'waiting' && <button type="button" style={S.main} onClick={() => move(x.id, 'serving')}>{t.queue.start}</button>}
            <button type="button" style={S.big} onClick={() => move(x.id, 'done')}>{t.queue.finish}</button>
            <button type="button" style={S.big} onClick={() => move(x.id, 'left')}>{t.queue.left}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Bill ----------
function CustomerPicker({ api, t, cust, setCust }) {
  const [q, setQ] = useState(''); const [mode, setMode] = useState('find'); const [f, setF] = useState({ name: '', phone: '', consent: false }); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [list] = useLoad(async () => (q.trim().length >= 2 ? (await api.get('/customers', { q: q.trim() })).data.slice(0, 6) : []), [q]);
  const create = async () => {
    setBusy(true); setError('');
    try { const d = (await api.post('/customers', { name: f.name.trim(), phone: f.phone, consentGiven: true })).data; setCust({ id: d.id, name: d.name, phone: d.phone }); setF({ name: '', phone: '', consent: false }); setMode('find'); }
    catch (e) { setError(msg(e)); } finally { setBusy(false); }
  };
  if (cust) return <div style={S.card}>{t.bill.chosen}: <strong>{cust.name}</strong> <button type="button" style={S.big} onClick={() => setCust(null)}>{t.bill.change}</button></div>;
  return (
    <div style={S.card}>
      <strong>{t.bill.customer}</strong> <small>({t.bill.noCustomer})</small>
      <div style={S.row}><button type="button" style={S.chip(mode === 'find')} onClick={() => setMode('find')}>{t.bill.findCustomer}</button><button type="button" style={S.chip(mode === 'new')} onClick={() => setMode('new')}>{t.bill.newCustomer}</button></div>
      {mode === 'find' && <>
        <input style={S.input} placeholder={t.bill.findCustomer} value={q} onChange={(e) => setQ(e.target.value)} />
        <Err text={list.error} t={t} />
        {(list.data || []).map((c) => <button key={c.id} type="button" style={{ ...S.big, width: '100%', textAlign: 'left', marginBottom: 6 }} onClick={() => setCust({ id: c.id, name: c.name, phone: c.phone })}><strong>{c.name}</strong> · {c.phone}</button>)}
      </>}
      {mode === 'new' && <>
        <input style={S.input} placeholder={t.bill.customerName} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="off" />
        <input style={S.input} placeholder={t.bill.customerPhone} inputMode="numeric" maxLength={10} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '') })} />
        <label style={{ display: 'block', marginBottom: 10 }}><input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} /> {t.bill.customerConsent}</label>
        <Err text={error} t={t} />
        <button type="button" style={S.main} disabled={busy || f.name.trim().length < 2 || !/^\d{10}$/.test(f.phone) || !f.consent} onClick={create}>{t.bill.saveCustomer}</button>
      </>}
    </div>
  );
}
const newLine = () => ({ serviceKey: '', staffId: '', qty: 1 });
function Bill({ api, t }) {
  const [refs] = useLoad(async () => ({ staff: (await api.get('/staff')).data.filter((s) => s.isActive !== false), services: (await api.get('/services')).data.filter((s) => s.isActive !== false) }), []);
  const [lines, setLines] = useState([newLine()]); const [disc, setDisc] = useState({ on: false, type: 'percent', value: '', reason: '' });
  const [pays, setPays] = useState([{ method: 'cash', amount: '' }]); const [result, setResult] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState(() => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  const [cust, setCust] = useState(null); const [prods, setProds] = useState([]); const [products] = useLoad(async () => (await api.get('/products')).data.filter((p) => p.isActive !== false), []);
  const services = refs.data ? refs.data.services : []; const staff = refs.data ? refs.data.staff : [];
  const price = useMemo(() => Object.fromEntries(services.map((s) => [s.key, s.price])), [services]);
  // A rough total for the cashier. The server works out the real one (GST, rounding, limits) and shows it after saving.
  const pprice = useMemo(() => Object.fromEntries((products.data || []).map((p) => [p.id, p.price])), [products.data]);
  const rough = lines.reduce((a, l) => a + (price[l.serviceKey] || 0) * (Number(l.qty) || 1), 0) + prods.reduce((a, l) => a + (pprice[l.productId] || 0) * (Number(l.qty) || 1), 0);
  const setProd = (i, k, v) => setProds(prods.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const setLine = (i, k, v) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const setPay = (i, k, v) => setPays(pays.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const submit = async () => {
    setError('');
    if (!lines.some((l) => l.serviceKey) && !prods.some((l) => l.productId)) return setError(t.bill.needLine);
    if (lines.some((l) => l.serviceKey && !l.staffId)) return setError(t.bill.needStaff);
    const body = { clientId, lines: lines.filter((l) => l.serviceKey).map((l) => ({ serviceKey: l.serviceKey, staffId: l.staffId, qty: Number(l.qty) || 1 })), payments: pays.filter((p) => Number(p.amount) > 0).map((p) => ({ method: p.method, amount: Math.round(Number(p.amount)) })) };
    body.lines = body.lines.concat(prods.filter((l) => l.productId).map((l) => ({ productId: l.productId, qty: Number(l.qty) || 1, ...(l.staffId ? { staffId: l.staffId } : {}) })));
    if (cust) body.customerId = cust.id;
    if (disc.on && Number(disc.value) > 0) { body.billDiscount = { type: disc.type, value: Number(disc.value) }; body.discountReason = disc.reason.trim(); }
    setBusy(true);
    try { setResult((await api.post('/bills', body)).data); } catch (e) { setError(msg(e)); } finally { setBusy(false); }
  };
  const reset = () => { setCust(null); setProds([]); setLines([newLine()]); setDisc({ on: false, type: 'percent', value: '', reason: '' }); setPays([{ method: 'cash', amount: '' }]); setResult(null); setError(''); setClientId('c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)); };
  const [note, setNote] = useState('');
  // The bill page is fetched with the sign-in and opened in a new tab, ready to print. Nothing is sent to anyone.
  const printBill = async (size) => {
    setError(''); setNote('');
    try { const r = await api.download(`/bills/${result.id}/print?size=${size}`); const url = URL.createObjectURL(new Blob([r.blob], { type: 'text/html' })); const win = window.open(url, '_blank'); if (!win) setError(t.bill.printFail); setTimeout(() => URL.revokeObjectURL(url), 60000); }
    catch (e) { setError(msg(e) || t.bill.printFail); }
  };
  const copyText = async () => {
    const text = `${t.bill.number} ${result.number}\n` + (result.lines || []).map((l) => `${l.name} x ${l.qty}: Rs ${l.total}`).join('\n') + `\n${t.bill.total}: Rs ${result.total}` + (result.due > 0 ? `\n${t.bill.due}: Rs ${result.due}` : '');
    try { await navigator.clipboard.writeText(text); setNote(t.bill.copied); } catch (e) { setError(t.bill.printFail); }
  };
  if (result) return (
    <div style={S.card}>
      <h3>{t.bill.saved}</h3>
      <p>{t.bill.number}: <strong>{result.number}</strong></p>
      <p>{t.bill.total}: <strong>Rs {result.total}</strong></p>
      <p>{t.bill.received}: Rs {result.received}</p>
      {result.change > 0 && <p>{t.bill.change}: <strong>Rs {result.change}</strong></p>}
      {result.due > 0 && <p>{t.bill.due}: <strong>Rs {result.due}</strong></p>}
      <div style={S.row}>
        <button type="button" style={S.main} onClick={() => printBill('A5')}>{t.bill.print}</button>
        <button type="button" style={S.big} onClick={() => printBill('A4')}>{t.bill.printA4}</button>
        <button type="button" style={S.big} onClick={copyText}>{t.bill.copyText}</button>
      </div>
      <Err text={error} t={t} />
      {note && <p role="status">{note}</p>}
      <p><button type="button" style={S.main} onClick={reset}>{t.bill.newBill}</button></p>
    </div>
  );
  return (
    <div>
      <Err text={refs.error || products.error} t={t} />
      <CustomerPicker api={api} t={t} cust={cust} setCust={setCust} />
      {lines.map((l, i) => (
        <div key={i} style={S.card}>
          <label>{t.bill.service}<select style={S.input} value={l.serviceKey} onChange={(e) => setLine(i, 'serviceKey', e.target.value)}><option value="">—</option>{services.map((s) => <option key={s.key} value={s.key}>{s.name} · Rs {s.price}</option>)}</select></label>
          <label>{t.bill.staff}<select style={S.input} value={l.staffId} onChange={(e) => setLine(i, 'staffId', e.target.value)}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>{t.bill.qty}<input style={S.input} type="number" min="1" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} /></label>
          {lines.length > 1 && <button type="button" style={S.big} onClick={() => setLines(lines.filter((_, j) => j !== i))}>{t.bill.remove}</button>}
        </div>
      ))}
      <p style={{ margin: '0 12px' }}><button type="button" style={S.big} onClick={() => setLines([...lines, newLine()])}>{t.bill.addLine}</button></p>
      {(products.data || []).length > 0 && prods.map((l, i) => (
        <div key={'p' + i} style={S.card}>
          <label>{t.bill.product}<select style={S.input} value={l.productId} onChange={(e) => setProd(i, 'productId', e.target.value)}><option value="">—</option>{products.data.map((p) => <option key={p.id} value={p.id}>{p.name} · Rs {p.price}{typeof p.stock === 'number' ? ` · ${p.stock} ${t.bill.inStock}` : ''}</option>)}</select></label>
          <label>{t.bill.qty}<input style={S.input} type="number" min="1" value={l.qty} onChange={(e) => setProd(i, 'qty', e.target.value)} /></label>
          <button type="button" style={S.big} onClick={() => setProds(prods.filter((_, j) => j !== i))}>{t.bill.remove}</button>
        </div>
      ))}
      {(products.data || []).length > 0 && <p style={{ margin: '0 12px' }}><button type="button" style={S.big} onClick={() => setProds([...prods, { productId: '', qty: 1 }])}>{t.bill.addProduct}</button></p>}
      <div style={S.card}>
        <label><input type="checkbox" checked={disc.on} onChange={(e) => setDisc({ ...disc, on: e.target.checked })} /> {t.bill.discount}</label>
        {disc.on && <>
          <div style={S.row}><button type="button" style={S.chip(disc.type === 'percent')} onClick={() => setDisc({ ...disc, type: 'percent' })}>{t.bill.percent}</button><button type="button" style={S.chip(disc.type === 'amount')} onClick={() => setDisc({ ...disc, type: 'amount' })}>{t.bill.rupees}</button></div>
          <input style={S.input} type="number" min="0" value={disc.value} onChange={(e) => setDisc({ ...disc, value: e.target.value })} />
          <input style={S.input} placeholder={t.bill.reason} value={disc.reason} onChange={(e) => setDisc({ ...disc, reason: e.target.value })} />
          <small>{t.bill.reasonHint}</small>
        </>}
      </div>
      <div style={S.card}>
        <strong>{t.bill.payments}</strong>
        {pays.map((p, i) => (
          <div key={i} style={S.row}>
            <select style={{ ...S.input, width: 'auto' }} value={p.method} onChange={(e) => setPay(i, 'method', e.target.value)}><option value="cash">{t.bill.cash}</option><option value="upi">{t.bill.upi}</option><option value="card">{t.bill.card}</option></select>
            <input style={{ ...S.input, width: 120 }} type="number" min="0" placeholder={t.bill.amount} value={p.amount} onChange={(e) => setPay(i, 'amount', e.target.value)} />
          </div>
        ))}
        <button type="button" style={S.big} onClick={() => setPays([...pays, { method: 'upi', amount: '' }])}>{t.bill.addPayment}</button>
        <p style={{ color: '#666' }}>~ Rs {rough} · {t.bill.gstNote}</p>
      </div>
      <Err text={error} t={t} />
      <p style={{ margin: '0 12px 24px' }}><button type="button" style={S.main} disabled={busy} onClick={submit}>{t.bill.save}</button></p>
    </div>
  );
}

// ---------- Customers ----------
function People({ api, role, t, w }) {
  const [q, setQ] = useState(''); const [open, setOpen] = useState(null); const [error, setError] = useState('');
  const [list, reload] = useLoad(async () => (await api.get('/customers', q.trim().length >= 2 ? { q: q.trim() } : {})).data, [q]);
  const view = async (id) => { setError(''); try { setOpen((await api.get(`/customers/${id}`)).data); } catch (e) { setError(msg(e)); } };
  return (
    <div>
      <h3 style={{ margin: '10px 16px' }}>{w.customers}</h3>
      <div style={S.card}><input style={S.input} placeholder={t.people.search} value={q} onChange={(e) => setQ(e.target.value)} />{role !== 'admin' && <small>{t.people.masked}</small>}</div>
      <Err text={error || list.error} t={t} retry={reload} />
      {!list.loading && !(list.data || []).length && <p style={{ margin: '10px 16px' }}>{t.people.empty}</p>}
      {(list.data || []).map((c) => (
        <div key={c.id} style={S.card}>
          <button type="button" style={{ ...S.big, width: '100%', textAlign: 'left' }} onClick={() => view(c.id)}><strong>{c.name}</strong> · {c.phone}</button>
          {open && open.id === c.id && (
            <div style={{ marginTop: 8 }}>
              {c.lastVisit && <p>{t.people.lastVisit}: {c.lastVisit}</p>}
              {c.birthday && <p>{t.people.birthday}: {c.birthday}</p>}
              {open.note && <p>{t.people.note}: {open.note}</p>}
              <strong>{t.people.visits}</strong>
              {(open.visits || []).length ? <ul>{open.visits.map((v) => <li key={v.id}>{v.date} · {hhmm(v.start)} · {v.serviceKey} · {t.day.status[v.status] || v.status}</li>)}</ul> : <p>{t.common.none}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- Tabs ----------
export default function SalonScreens({ api, me, t, tab }) {
  const w = wordsFor(me.preset, t); const clinic = me.preset === 'clinic';
  if (tab === 'queue') return <Queue api={api} t={t} w={w} />;
  if (tab === 'bill') return <Bill api={api} t={t} />;
  if (tab === 'people') return <People api={api} role={me.role} t={t} w={w} />;
  return <Day api={api} role={me.role} t={t} w={w} clinic={clinic} />;
}
