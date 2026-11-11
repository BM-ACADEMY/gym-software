import { useEffect, useState } from 'react';
import { useLoad } from './useLoad.js';
import { getPath, setPath, pickTop, visibleFields } from './schema.js';
import { useT } from './i18n.js';
import DownloadButtons from './DownloadButtons.jsx';

// A settings page built from a list of switches (levels per job) plus plain number fields. Saves with PUT.
export default function SettingsScreen({ def, api, title }) {
  const t = useT();
  const { loading, error, data } = useLoad(() => api.get(def.endpoint).then((r) => r.data), [def.endpoint]);
  const [v, setV] = useState({ jobs: {} });
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!data) return;
    // Fields the server has not stored yet start at their default, so saving without a change still sends the rule that is in force.
    let next = { ...data, jobs: { ...(data.jobs || {}) } };
    for (const f of def.fields || []) if (f.default !== undefined && getPath(next, f.key) === undefined) next = setPath(next, f.key, f.default);
    setV(next);
  }, [data]);
  const save = async (e) => {
    e.preventDefault();
    const body = (def.fields && !def.numbers && !def.jobs) ? pickTop(v, def.fields) : v; // a fields-only screen sends just its own settings
    try { await api.put(def.endpoint, body); setMsg('Saved.'); } catch (err) { setMsg((err.response && err.response.data && err.response.data.message) || 'Could not save.'); }
  };
  if (loading && !data) return <p className="adm-note">{t('loading')}</p>;
  return (
    <section className="adm-screen">
      <header className="adm-head"><h2>{title || def.label}</h2></header>
      {error && <p role="alert" className="adm-error">{error}</p>}
      {def.intro && <p className="adm-note">{def.intro}</p>}
      <DownloadButtons list={def.downloads} api={api} />
      <form className="adm-form" onSubmit={save}>
        <label className="adm-check"><input type="checkbox" checked={!!v.paused} onChange={(e) => setV({ ...v, paused: e.target.checked })} /> <span>Pause everything</span></label>
        {(def.jobs || []).map((j) => (
          <label key={j.key}><span>{j.label}</span>
            <select value={(v.jobs && v.jobs[j.key]) || 'suggest'} onChange={(e) => setV({ ...v, jobs: { ...v.jobs, [j.key]: e.target.value } })}>
              {(def.levels || []).map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </label>
        ))}
        {(def.numbers || []).map((n) => (
          <label key={n.key}><span>{n.label}</span>
            <input type="number" min={n.min} max={n.max} value={v[n.key] ?? n.default ?? ''} onChange={(e) => setV({ ...v, [n.key]: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </label>
        ))}
        {visibleFields(def.fields || [], v).map((f) => {
          const cur = getPath(v, f.key);
          const set = (x) => setV(setPath(v, f.key, x));
          return (
            <label key={f.key}><span>{f.label}</span>
              {f.type === 'select' ? <select value={cur ?? f.default ?? ''} onChange={(e) => set(e.target.value)}>{f.options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}</select>
                : f.type === 'bool' ? <input type="checkbox" checked={!!cur} onChange={(e) => set(e.target.checked)} />
                : f.type === 'number' ? <input type="number" min={f.min} max={f.max} value={cur ?? f.default ?? ''} onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))} />
                : <input type="text" maxLength={f.max} value={cur ?? ''} onChange={(e) => set(e.target.value)} />}
            </label>
          );
        })}
        <div className="adm-row"><button type="submit" className="adm-btn main">{t('save')}</button></div>
      </form>
      {msg && <p role="status" className="adm-note">{msg}</p>}
    </section>
  );
}
