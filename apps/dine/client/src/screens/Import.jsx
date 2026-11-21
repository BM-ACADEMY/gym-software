import { useState } from 'react';
import { S, msgOf } from './ui.js';

// Bring in a spreadsheet saved as CSV: ingredients, recipes or guests. Always "Check first" (saves nothing), then "Save". The server re-reads the same text on save.
const KINDS = [['ingredients', 'imp_ingredients'], ['recipes', 'imp_recipes'], ['guests', 'imp_guests']];
export default function Import({ api, t }) {
  const [kind, setKind] = useState('ingredients'); const [csv, setCsv] = useState(''); const [check, setCheck] = useState(null); const [done, setDone] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const pick = (file) => { if (!file) return; if (file.size > 140000) { setErr(t('imp_big')); return; } const r = new FileReader(); r.onload = () => { setCsv(String(r.result || '')); setCheck(null); setDone(null); setErr(''); }; r.readAsText(file); };
  const run = async (what) => {
    setBusy(true); setErr(''); setDone(null);
    try { const r = (await api.post(`/import/${kind}/${what}`, { csv })).data; if (what === 'preview') setCheck(r); else { setDone(r); setCheck(null); } }
    catch (e) { setErr(msgOf(e, t)); } finally { setBusy(false); }
  };
  const errors = (check && check.errors) || (done && done.errors) || [];
  return (
    <div style={S.page}>
      <h2 style={{ marginTop: 0 }}>{t('imp_title')}</h2>
      <p>{t('imp_help')}</p>
      <div style={S.row}>{KINDS.map(([k, label]) => <button key={k} type="button" style={{ ...S.big, background: kind === k ? '#fde68a' : '#fff' }} onClick={() => { setKind(k); setCheck(null); setDone(null); setErr(''); }}>{t(label)}</button>)}</div>
      <div style={S.card}>
        <label>{t('imp_file')}<input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => pick(e.target.files && e.target.files[0])} style={S.input} /></label>
        <label>{t('imp_paste')}<textarea style={{ ...S.input, minHeight: 120 }} value={csv} maxLength={150000} onChange={(e) => { setCsv(e.target.value); setCheck(null); setDone(null); }} /></label>
        <div style={S.row}>
          <button type="button" style={S.big} disabled={busy || !csv.trim()} onClick={() => run('preview')}>{t('imp_check')}</button>
          <button type="button" style={S.primary} disabled={busy || !check || check.good === 0} onClick={() => run('commit')}>{t('imp_save')}</button>
        </div>
      </div>
      {err && <p style={S.err} role="alert">{err}</p>}
      {check && <div style={S.card}><strong>{t('imp_good')}: {check.good}</strong> · {t('imp_problems')}: {check.problems}{check.alreadyThere ? ` · ${t('imp_there')}: ${check.alreadyThere}` : ''}{check.note ? <p>{check.note}</p> : null}</div>}
      {done && <div style={S.card}><strong>{t('imp_saved')}</strong> {Object.entries(done).filter(([k, v]) => typeof v === 'number').map(([k, v]) => `${k}: ${v}`).join(' · ')}</div>}
      {errors.length > 0 && <ul>{errors.map((e, i) => <li key={i} style={S.err}>{typeof e === 'string' ? e : (e.row ? `${t('imp_row')} ${e.row}: ` : '') + (e.message || e.error || JSON.stringify(e))}</li>)}</ul>}
    </div>
  );
}
