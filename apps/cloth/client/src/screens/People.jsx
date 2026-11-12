import { useEffect, useState } from 'react';
import { pos } from '../api.js';
import T from '../strings.js';
import { S, Msg, rupees, msg } from '../ui.jsx';

const t = T.people;
const CHUNK = 1000; // the server takes at most 1000 rows per request

// Split a CSV into pieces of CHUNK rows, repeating the header row. A line break inside a quoted cell stays inside its row.
const records = (text) => {
  const out = []; let cur = ''; let q = false;
  for (const ch of text.replace(/\r\n?/g, '\n')) {
    if (ch === '"') q = !q;
    if (ch === '\n' && !q) { if (cur.trim() !== '') out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim() !== '') out.push(cur);
  return out;
};
const pieces = (text) => {
  const lines = records(text);
  if (lines.length < 2) return [text];
  const head = lines[0]; const out = [];
  for (let i = 1; i < lines.length; i += CHUNK) out.push([head, ...lines.slice(i, i + CHUNK)].join('\n'));
  return out;
};

export default function People() {
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [sel, setSel] = useState(null);
  const [points, setPoints] = useState(null);
  const [error, setError] = useState('');
  const search = async () => { setError(''); try { setList((await pos('GET', '/customers', null, q.trim() ? { q: q.trim() } : {})).data || []); } catch (e) { setError(msg(e, T.common.failed)); } };
  useEffect(() => { search(); }, []);
  const open = async (c) => { setSel(c); setPoints(null); try { const r = await pos('GET', '/customers/' + c._id); setPoints(r.data.points); } catch (e) { setError(msg(e, T.common.failed)); } };

  return (
    <div style={S.page}>
      <h2 style={S.h}>{t.title}</h2>
      <Msg error={error} />
      <div style={S.card}>
        <div style={S.row}><input style={{ ...S.input, flex: 1 }} placeholder={t.find} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search(); }} /><button type="button" style={S.btn} onClick={search}>{T.common.search}</button></div>
        {!list.length && <p style={S.muted}>{T.common.none}</p>}
        {list.map((c) => (
          <div key={c._id} style={{ padding: '10px 0', borderTop: '1px solid #eee' }}>
            <button type="button" style={{ ...S.ghost, width: '100%', textAlign: 'left' }} onClick={() => open(c)}>{c.name} {c.phone ? '· ' + c.phone : ''}</button>
            {sel && sel._id === c._id && <p style={{ margin: '8px 0 0' }}>{t.points}: {points === null ? T.common.loading : points}{c.creditDue > 0 ? ` · ${rupees(c.creditDue)} due` : ''}</p>}
          </div>
        ))}
        {!sel && list.length > 0 && <p style={S.muted}>{t.noSelect}</p>}
      </div>
      <Import onDone={search} />
    </div>
  );
}

function Import({ onDone }) {
  const [text, setText] = useState('');
  const [prev, setPrev] = useState(null);
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const file = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; if (f.size > 600000) return setError('That file is too big (600 KB). Split it.'); const r = new FileReader(); r.onload = () => { setText(String(r.result || '')); setPrev(null); setRes(null); }; r.readAsText(f); };
  const check = async () => {
    setError(''); setRes(null); setBusy(true);
    try { const first = pieces(text)[0]; setPrev((await pos('POST', '/import/customers', { csv: first, commit: false })).data); } catch (e) { setError(msg(e, T.common.failed)); } finally { setBusy(false); }
  };
  const commit = async () => {
    setError(''); setBusy(true);
    try {
      const tot = { added: 0, skipped: [], errors: [] };
      for (const p of pieces(text)) { const r = (await pos('POST', '/import/customers', { csv: p, commit: true })).data; tot.added += r.added; tot.skipped.push(...r.skipped); tot.errors.push(...r.errors); }
      setRes(tot); setPrev(null); setText(''); onDone();
    } catch (e) { setError(msg(e, T.common.failed)); } finally { setBusy(false); }
  };
  return (
    <div style={S.card}>
      <h3 style={S.h}>{t.import}</h3>
      <Msg error={error} />
      <input type="file" accept=".csv,text/csv" onChange={file} aria-label={t.pickFile} />
      <label style={S.label}>{t.paste}</label>
      <textarea style={{ ...S.input, minHeight: 100 }} value={text} onChange={(e) => { setText(e.target.value); setPrev(null); setRes(null); }} />
      <button type="button" disabled={busy || !text.trim()} style={{ ...S.btn, marginTop: 8 }} onClick={check}>{t.preview}</button>
      {prev && (
        <div style={{ marginTop: 10 }}>
          <p>{t.willAdd}: <strong>{prev.willAdd}</strong></p>
          {prev.columnsRead && <p style={S.muted}>{t.columns}: {prev.columnsRead.join(', ')}</p>}
          {(prev.preview || []).map((r, i) => <p key={i} style={S.muted}>{r.name} {r.phone || ''}</p>)}
          {prev.skipped.length > 0 && <p style={S.muted}>{t.skipped}: {prev.skipped.length}</p>}
          {prev.errors.length > 0 && <div>{t.errors}: {prev.errors.slice(0, 5).map((e, i) => <p key={i} style={S.err}>Row {e.row}: {e.message}</p>)}</div>}
          {prev.willAdd > 0 && <button type="button" disabled={busy} style={S.btn} onClick={commit}>{t.commit}</button>}
        </div>
      )}
      {res && <p style={S.ok}>{t.added}: {res.added}{res.skipped.length ? ` · ${t.skipped}: ${res.skipped.length}` : ''}{res.errors.length ? ` · ${t.errors}: ${res.errors.length}` : ''}</p>}
    </div>
  );
}
