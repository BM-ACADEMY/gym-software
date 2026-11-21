import { useEffect, useState } from 'react';
import { call } from '../api.js';
import T from '../strings.js';
import { S, Msg, rupees, msg } from '../ui.jsx';

const t = T.alter;
// Same flow as the server (apps/cloth/src/alterations.js). The server checks it again; this only decides which buttons to show.
const FLOW = { received: ['in_progress', 'ready', 'cancelled'], in_progress: ['ready', 'cancelled'], ready: ['delivered', 'cancelled'], delivered: [], cancelled: [] };
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const diff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
const blank = { what: '', customerName: '', customerPhone: '', readyOn: '', charge: '', advance: '', note: '' };

export default function Alterations() {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [link, setLink] = useState({});
  const [busy, setBusy] = useState(false);

  const load = async () => { setError(''); try { setRows((await call('GET', '/alterations')).data || []); } catch (e) { setError(msg(e, T.common.failed)); } };
  useEffect(() => { load(); }, []);
  const today = todayIST();
  const isOverdue = (j) => (j.status === 'received' || j.status === 'in_progress') && j.readyOn < today;
  const isUncollected = (j) => j.status === 'ready' && j.readyAt && diff(j.readyAt, today) >= 7;
  const shown = (rows || []).filter((j) => (filter === 'all' ? true : filter === 'overdue' ? isOverdue(j) : filter === 'uncollected' ? isUncollected(j) : j.status === filter));

  const create = async () => {
    setError(''); setOk(''); setBusy(true);
    try {
      await call('POST', '/alterations', { what: form.what, customerName: form.customerName, customerPhone: form.customerPhone.replace(/\D/g, ''), readyOn: form.readyOn, charge: Math.round(Number(form.charge) || 0), advance: Math.round(Number(form.advance) || 0), note: form.note });
      setForm(null); setOk(t.created); load();
    } catch (e) { setError(msg(e, T.common.failed)); } finally { setBusy(false); }
  };
  const move = async (j, to) => { setError(''); setOk(''); try { const r = await call('POST', `/alterations/${j._id}/status`, { status: to }); if (r.notify) setOk(r.notify); load(); } catch (e) { setError(msg(e, T.common.failed)); } };
  const makeLink = async (j, rotate) => {
    setError('');
    try { const r = await call('POST', `/alterations/${j._id}/pickup-link`, rotate ? { rotate: true } : {}); setLink((l) => ({ ...l, [j._id]: window.location.origin + r.data.path })); } catch (e) { setError(msg(e, T.common.failed)); }
  };

  const filters = [['all', t.all], ['overdue', t.overdue], ['uncollected', t.uncollected], ...Object.entries(t.status).map(([k, v]) => [k, v])];
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div style={S.page}>
      <div style={{ ...S.row, justifyContent: 'space-between' }}><h2 style={S.h}>{t.title}</h2>{!form && <button type="button" style={S.btn} onClick={() => setForm({ ...blank })}>{t.add}</button>}</div>
      <Msg error={error} ok={ok} />
      {form && (
        <div style={S.card}>
          <label style={S.label}>{t.what}</label><input style={S.input} maxLength={120} value={form.what} onChange={set('what')} />
          <label style={S.label}>{t.name}</label><input style={S.input} value={form.customerName} onChange={set('customerName')} />
          <label style={S.label}>{t.phone}</label><input style={S.input} inputMode="tel" value={form.customerPhone} onChange={set('customerPhone')} />
          <label style={S.label}>{t.ready}</label><input style={S.input} type="date" min={today} value={form.readyOn} onChange={set('readyOn')} />
          <label style={S.label}>{t.charge}</label><input style={S.input} inputMode="numeric" value={form.charge} onChange={set('charge')} />
          <label style={S.label}>{t.advance}</label><input style={S.input} inputMode="numeric" value={form.advance} onChange={set('advance')} />
          <label style={S.label}>{t.note}</label><input style={S.input} maxLength={200} value={form.note} onChange={set('note')} />
          <div style={{ ...S.row, marginTop: 10 }}><button type="button" disabled={busy} style={S.btn} onClick={create}>{T.common.save}</button><button type="button" style={S.ghost} onClick={() => setForm(null)}>{T.common.cancel}</button></div>
        </div>
      )}
      <div style={{ ...S.row, marginBottom: 10 }}>{filters.map(([k, label]) => <button key={k} type="button" style={S.chip(filter === k)} onClick={() => setFilter(k)}>{label}</button>)}</div>
      {!rows && !error && <p>{T.common.loading}</p>}
      {rows && !shown.length && <p style={S.muted}>{T.common.none}</p>}
      {shown.map((j) => (
        <div key={j._id} style={{ ...S.card, borderColor: isOverdue(j) ? '#b91c1c' : '#ddd' }}>
          <div style={{ ...S.row, justifyContent: 'space-between' }}><strong>{j.what}</strong><span>{t.status[j.status] || j.status}</span></div>
          <p style={S.muted}>{j.customerName || ''} {j.customerPhone || ''}</p>
          <p style={S.muted}>{t.ready}: {j.readyOn}{isOverdue(j) ? ` · ${t.overdue}` : ''} · {rupees(j.charge)} ({t.advance}: {rupees(j.advance)})</p>
          <div style={S.row}>{(FLOW[j.status] || []).map((to) => <button key={to} type="button" style={to === 'cancelled' ? S.ghost : S.btn} onClick={() => move(j, to)}>{t.move} {t.status[to]}</button>)}</div>
          {j.status !== 'cancelled' && j.status !== 'delivered' && (
            <div style={{ marginTop: 8 }}>
              <div style={S.row}><button type="button" style={S.ghost} onClick={() => makeLink(j, false)}>{t.link}</button>{link[j._id] && <button type="button" style={S.ghost} onClick={() => makeLink(j, true)}>{t.rotate}</button>}</div>
              {link[j._id] && <><p style={S.muted}>{t.linkNote}</p><input readOnly style={S.input} value={link[j._id]} onFocus={(e) => e.target.select()} /></>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
