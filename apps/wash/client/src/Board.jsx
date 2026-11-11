import { useCallback, useEffect, useState } from 'react';
import S from './strings.js';
import { Card, Err, Field, Note, Tabs, btn, input, minsSince, today, useAction } from './ui.jsx';

const T = S.board;
const money = (n) => S.common.rupee + ' ' + (Number(n) || 0);

// One job card: move it forward, choose who is washing, cancel (with a reason once washing began), pay at delivery,
// record photo references, and (owner only) refund. Every rule is checked again on the server; these buttons only guide.
function JobCard({ job, api, role, attendants, onChanged }) {
  const [run, busy, err] = useAction();
  const [att, setAtt] = useState(job.attendantId || (attendants.length === 1 ? attendants[0].id : ''));
  const [mode, setMode] = useState(''); // '', cancel, deliver, photos, refund
  const [method, setMethod] = useState('cash'); const [later, setLater] = useState(false); const [dueNote, setDueNote] = useState('');
  const [photo, setPhoto] = useState({ kind: 'before', ref: '', kb: '' }); const [photos, setPhotos] = useState(null);
  const [refund, setRefund] = useState({ amount: '', method: 'cash', reason: '' });
  const attName = (attendants.find((a) => a.id === job.attendantId) || {}).name;
  const post = (body) => run(async () => { await api.post('/jobs/' + job.id + '/move', body); setMode(''); await onChanged(); });
  const owe = (job.total || 0) - (job.passId ? job.passCovered || 0 : 0);
  const loadPhotos = () => run(async () => { setPhotos((await api.get('/jobs/' + job.id + '/photos')).data || []); });
  const openPhotos = () => { setMode(mode === 'photos' ? '' : 'photos'); if (!photos) loadPhotos(); };
  const savePhoto = () => run(async () => {
    await api.post('/jobs/' + job.id + '/photos', { kind: photo.kind, ref: photo.ref.trim(), bytes: Math.round(Number(photo.kb) * 1024), mime: /\.webp$/i.test(photo.ref) ? 'image/webp' : /\.png$/i.test(photo.ref) ? 'image/png' : 'image/jpeg' });
    setPhoto({ kind: photo.kind, ref: '', kb: '' }); await loadPhotos();
  });
  const doRefund = () => run(async () => { await api.post('/jobs/' + job.id + '/refund', { amount: Math.round(Number(refund.amount)), method: refund.method, reason: refund.reason }); setRefund({ amount: '', method: 'cash', reason: '' }); setMode(''); await onChanged(); });
  const queueNote = job.state === 'waiting' ? minsSince(job.createdAt) + ' ' + T.mins + ' ' + T.queue
    : job.state === 'washing' ? minsSince(job.startedAt) + ' ' + T.mins + ' ' + T.wash
      : job.state === 'ready' ? T.since + ' ' + minsSince(job.readyAt) + ' ' + T.mins : '';
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 18 }}>{job.plate}</strong><span>#{job.number}</span>
      </div>
      <Note>{(job.lines || []).map((l) => l.key).join(', ')} · {money(job.total)}{job.discount ? ' · ' + T.discount + ' ' + money(job.discount) : ''}{job.passId ? ' · ' + T.passCovered : ''}</Note>
      {queueNote && <Note>{queueNote}{attName ? ' · ' + attName : ''}</Note>}
      <Err text={err} />
      {job.state === 'waiting' && (
        <>
          <Field label={T.attendant}>
            <select value={att} onChange={(e) => setAtt(e.target.value)} style={input}><option value="">{T.choose}</option>{attendants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          </Field>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" disabled={busy} style={btn(true)} onClick={() => post({ to: 'washing', attendantId: att || undefined })}>{T.start}</button>
            <button type="button" disabled={busy} style={btn(false)} onClick={() => post({ to: 'cancelled' })}>{T.cancel}</button>
          </div>
        </>
      )}
      {job.state === 'washing' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" disabled={busy} style={btn(true)} onClick={() => post({ to: 'ready' })}>{T.ready}</button>
          <button type="button" style={btn(false)} onClick={() => setMode(mode === 'cancel' ? '' : 'cancel')}>{T.cancel}</button>
        </div>
      )}
      {mode === 'cancel' && (
        <div style={{ marginTop: 8 }}>
          <Note>{T.cancelWhy} {T.ownerTold}</Note>
          {S.cancelReasons.map((r) => <button key={r} type="button" disabled={busy} style={{ ...btn(false), display: 'block', width: '100%', margin: '6px 0', textAlign: 'left' }} onClick={() => post({ to: 'cancelled', reason: r })}>{T.cancelDo}: {r}</button>)}
          <button type="button" style={btn(false, true)} onClick={() => setMode('')}>{T.keep}</button>
        </div>
      )}
      {job.state === 'ready' && mode !== 'deliver' && <button type="button" style={btn(true)} onClick={() => setMode('deliver')}>{T.deliver}</button>}
      {job.state === 'ready' && mode === 'deliver' && (
        <div style={{ marginTop: 8 }}>
          <p style={{ margin: '4px 0' }}><strong>{T.toPay}: {money(owe)}</strong></p>
          {owe > 0 && !later && (
            <>
              <Field label={T.payHow}>
                <select value={method} onChange={(e) => setMethod(e.target.value)} style={input}><option value="cash">{T.cash}</option><option value="upi">{T.upi}</option><option value="card">{T.card}</option></select>
              </Field>
              <button type="button" disabled={busy} style={btn(true)} onClick={() => post({ to: 'delivered', payAllWith: method })}>{T.payNow}</button>
            </>
          )}
          {owe > 0 && <button type="button" style={{ ...btn(false), marginLeft: later ? 0 : 8 }} onClick={() => setLater(!later)}>{T.payLater}</button>}
          {later && (
            <>
              <Note>{T.payLaterHelp}</Note>
              <Field label={S.dues.note}><input value={dueNote} onChange={(e) => setDueNote(e.target.value)} style={input} maxLength={120} /></Field>
              <button type="button" disabled={busy} style={btn(true)} onClick={() => post({ to: 'delivered', payLater: true, dueNote })}>{T.deliver}</button>
            </>
          )}
          {owe <= 0 && <button type="button" disabled={busy} style={btn(true)} onClick={() => post({ to: 'delivered' })}>{T.deliver}</button>}
        </div>
      )}
      {(job.state === 'delivered' || job.state === 'washing' || job.state === 'ready') && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button type="button" style={btn(false, true)} onClick={openPhotos}>{T.photos}</button>
          {job.state === 'delivered' && <button type="button" style={btn(false, true)} onClick={() => setMode(mode === 'refund' ? '' : 'refund')}>{T.refund}</button>}
        </div>
      )}
      {mode === 'photos' && (
        <div style={{ marginTop: 8 }}>
          <Note>{T.photoHelp}</Note>
          {photos && !photos.length && <Note>{T.noPhotos}</Note>}
          {photos && photos.map((p) => <Note key={p.id}>{p.kind === 'before' ? T.before : T.after}: {p.ref} ({Math.round(p.bytes / 1024)} KB)</Note>)}
          <Field label=" ">
            <select value={photo.kind} onChange={(e) => setPhoto({ ...photo, kind: e.target.value })} style={input}><option value="before">{T.before}</option><option value="after">{T.after}</option></select>
          </Field>
          <Field label={T.ref}><input value={photo.ref} onChange={(e) => setPhoto({ ...photo, ref: e.target.value })} style={input} /></Field>
          <Field label={T.bytes}><input inputMode="numeric" value={photo.kb} onChange={(e) => setPhoto({ ...photo, kb: e.target.value.replace(/[^0-9.]/g, '') })} style={input} /></Field>
          <button type="button" disabled={busy || !photo.ref || !photo.kb} style={btn(true)} onClick={savePhoto}>{T.addPhoto}</button>
        </div>
      )}
      {mode === 'refund' && (
        <div style={{ marginTop: 8 }}>
          {role !== 'admin' ? <Note>{T.ownerOnly}</Note> : (
            <>
              <Note>{T.refundHelp}</Note>
              <Field label={T.amount}><input inputMode="numeric" value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value.replace(/\D/g, '') })} style={input} /></Field>
              <Field label={T.payHow}>
                <select value={refund.method} onChange={(e) => setRefund({ ...refund, method: e.target.value })} style={input}><option value="cash">{T.cash}</option><option value="upi">{T.upi}</option><option value="card">{T.card}</option></select>
              </Field>
              <Field label={T.reason}><input value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} style={input} maxLength={120} /></Field>
              <button type="button" disabled={busy || !refund.amount || refund.reason.trim().length < 3} style={btn(true)} onClick={doRefund}>{T.doRefund}</button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

export default function Board({ api, role }) {
  const [state, setState] = useState('waiting'); const [jobs, setJobs] = useState([]); const [attendants, setAttendants] = useState([]);
  const [loading, setLoading] = useState(true); const [err, setErr] = useState('');
  const load = useCallback(async () => {
    setErr('');
    try {
      const [active, all, att] = await Promise.all([api.get('/jobs'), api.get('/jobs', { day: today() }), api.get('/attendants')]);
      const byId = {}; for (const j of [...(active.data || []), ...(all.data || [])]) byId[j.id] = j; // active jobs from earlier days stay visible
      setJobs(Object.values(byId)); setAttendants(att.data || []);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [api]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  const shown = jobs.filter((j) => j.state === state);
  const count = (s) => jobs.filter((j) => j.state === s).length;
  return (
    <div>
      <Tabs items={['waiting', 'washing', 'ready', 'delivered'].map((s) => [s, S.states[s] + ' (' + count(s) + ')'])} value={state} onChange={setState} />
      <div style={{ padding: '0 12px 24px' }}>
        <button type="button" style={{ ...btn(false, true), margin: '8px 0' }} onClick={load}>{T.refresh}</button>
        <Err text={err} />
        {loading && <Note>{S.common.loading}</Note>}
        {!loading && !shown.length && <Note>{T.empty}</Note>}
        {shown.map((j) => <JobCard key={j.id} job={j} api={api} role={role} attendants={attendants} onChanged={load} />)}
      </div>
    </div>
  );
}
