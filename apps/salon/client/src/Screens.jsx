import { useCallback, useEffect, useMemo, useState } from 'react';
import { wordsFor } from './strings.js';

// Salon staff screens: day view, walk-ins, bill, customers. Phone first: big buttons, one column.
// Every price, discount limit and GST rule is decided by the server; this page only shows what the server says.
const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const msg = (e) => (e && e.response && e.response.data && e.response.data.message) || (e && e.message) || 'Something went wrong. Please try again.';
const S = {
  card: { border: '1px solid #e5e5e5', borderRadius: 10, padding: 12, margin: '10px 12px', background: '#fff' },
  big: { padding: '12px 16px', fontSize: 16, borderRadius: 8, border: '1px solid #bbb', background: '#fff', minHeight: 44, cursor: 'pointer' },
  main: { padding: '12px 16px', fontSize: 16, borderRadius: 8, border: 0, background: '#be185d', color: '#fff', minHeight: 44, cursor: 'pointer' },
  input: { display: 'block', width: '100%', padding: 10, margin: '4px 0 10px', fontSize: 16, boxSizing: 'border-box' },
  row: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  err: { color: '#b00020', margin: '8px 12px' },
  chip: (on) => ({ padding: '10px 12px', fontSize: 15, borderRadius: 20, border: '1px solid ' + (on ? '#be185d' : '#bbb'), background: on ? '#fce7f3' : '#fff', minHeight: 44, cursor: 'pointer' }),
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
  const [form, setForm] = useState(null); const [moving, setMoving] = useState(null); const [error, setError] = useState('');
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
        <p><button type="button" style={S.main} onClick={() => setForm({ date, serviceKey: '', staffId: staffId || '', start: null, name: '', phone: '', consent: false, bodyArea: 'other' })}>{t.day.book}</button></p>
      </div>
      <Err text={error || list.error || refs.error} t={t} retry={reload} />
      {list.loading && <p style={S.err}>{t.common.loading}</p>}
      {!list.loading && !shown.length && <p style={{ margin: '10px 16px' }}>{t.common.none}</p>}
      {shown.map((a) => (
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
const newLine = () => ({ serviceKey: '', staffId: '', qty: 1 });
function Bill({ api, t }) {
  const [refs] = useLoad(async () => ({ staff: (await api.get('/staff')).data.filter((s) => s.isActive !== false), services: (await api.get('/services')).data.filter((s) => s.isActive !== false) }), []);
  const [lines, setLines] = useState([newLine()]); const [disc, setDisc] = useState({ on: false, type: 'percent', value: '', reason: '' });
  const [pays, setPays] = useState([{ method: 'cash', amount: '' }]); const [result, setResult] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState(() => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  const services = refs.data ? refs.data.services : []; const staff = refs.data ? refs.data.staff : [];
  const price = useMemo(() => Object.fromEntries(services.map((s) => [s.key, s.price])), [services]);
  // A rough total for the cashier. The server works out the real one (GST, rounding, limits) and shows it after saving.
  const rough = lines.reduce((a, l) => a + (price[l.serviceKey] || 0) * (Number(l.qty) || 1), 0);
  const setLine = (i, k, v) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const setPay = (i, k, v) => setPays(pays.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const submit = async () => {
    setError('');
    if (!lines.some((l) => l.serviceKey)) return setError(t.bill.needLine);
    if (lines.some((l) => l.serviceKey && !l.staffId)) return setError(t.bill.needStaff);
    const body = { clientId, lines: lines.filter((l) => l.serviceKey).map((l) => ({ serviceKey: l.serviceKey, staffId: l.staffId, qty: Number(l.qty) || 1 })), payments: pays.filter((p) => Number(p.amount) > 0).map((p) => ({ method: p.method, amount: Math.round(Number(p.amount)) })) };
    if (disc.on && Number(disc.value) > 0) { body.billDiscount = { type: disc.type, value: Number(disc.value) }; body.discountReason = disc.reason.trim(); }
    setBusy(true);
    try { setResult((await api.post('/bills', body)).data); } catch (e) { setError(msg(e)); } finally { setBusy(false); }
  };
  const reset = () => { setLines([newLine()]); setDisc({ on: false, type: 'percent', value: '', reason: '' }); setPays([{ method: 'cash', amount: '' }]); setResult(null); setError(''); setClientId('c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)); };
  if (result) return (
    <div style={S.card}>
      <h3>{t.bill.saved}</h3>
      <p>{t.bill.number}: <strong>{result.number}</strong></p>
      <p>{t.bill.total}: <strong>Rs {result.total}</strong></p>
      <p>{t.bill.received}: Rs {result.received}</p>
      {result.change > 0 && <p>{t.bill.change}: <strong>Rs {result.change}</strong></p>}
      {result.due > 0 && <p>{t.bill.due}: <strong>Rs {result.due}</strong></p>}
      <button type="button" style={S.main} onClick={reset}>{t.bill.newBill}</button>
    </div>
  );
  return (
    <div>
      <Err text={refs.error} t={t} />
      {lines.map((l, i) => (
        <div key={i} style={S.card}>
          <label>{t.bill.service}<select style={S.input} value={l.serviceKey} onChange={(e) => setLine(i, 'serviceKey', e.target.value)}><option value="">—</option>{services.map((s) => <option key={s.key} value={s.key}>{s.name} · Rs {s.price}</option>)}</select></label>
          <label>{t.bill.staff}<select style={S.input} value={l.staffId} onChange={(e) => setLine(i, 'staffId', e.target.value)}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>{t.bill.qty}<input style={S.input} type="number" min="1" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} /></label>
          {lines.length > 1 && <button type="button" style={S.big} onClick={() => setLines(lines.filter((_, j) => j !== i))}>{t.bill.remove}</button>}
        </div>
      ))}
      <p style={{ margin: '0 12px' }}><button type="button" style={S.big} onClick={() => setLines([...lines, newLine()])}>{t.bill.addLine}</button></p>
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
