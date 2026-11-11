import { useLoad } from './useLoad.js';
import { formatCell, getPath } from './schema.js';
import { useT } from './i18n.js';
import DownloadButtons from './DownloadButtons.jsx';

// Cards, tables and an attention list read from one API reply. The manifest says where each value lives.
export default function StatsScreen({ def, api, params, title }) {
  const t = useT();
  const { loading, error, data, reload } = useLoad(() => api.get(def.endpoint, params || {}).then((r) => r.data), [def.endpoint, JSON.stringify(params || {})], def.refreshMs);
  if (loading && !data) return <p className="adm-note">{t('loading')}</p>;
  return (
    <section className="adm-screen">
      <header className="adm-head"><h2>{title || def.label}</h2><button type="button" className="adm-btn" onClick={reload}>{t('refresh')}</button></header>
      <DownloadButtons list={def.downloads} api={api} />
      {error && <p role="alert" className="adm-error">{error}{data ? ' Showing the last good numbers.' : ''}</p>}
      {data && (
        <>
          {def.attention && (getPath(data, def.attention) || []).map((a, i) => <div key={i} className={`adm-alert ${a.level || ''}`}><span className="adm-pill">{a.level === 'error' ? 'error' : 'watch'}</span> {a.text}</div>)}
          {def.cards && <div className="adm-cards">{def.cards.map((c) => <div key={c.label}><small>{c.label}</small><b>{formatCell(c.type, getPath(data, c.path))}</b></div>)}</div>}
          {(def.tables || []).map((t) => (
            <div key={t.label} className="adm-table"><h3>{t.label}</h3>
              {!(getPath(data, t.rows) || []).length ? <p className="adm-note">{t.empty || 'Nothing to show.'}</p> : (
                <table><thead><tr>{t.columns.map((c) => <th key={c.key} className={c.type === 'money' || c.type === 'number' ? 'n' : ''}>{c.label || c.key}</th>)}</tr></thead>
                  <tbody>{getPath(data, t.rows).map((r, i) => <tr key={i}>{t.columns.map((c) => <td key={c.key} className={c.type === 'money' || c.type === 'number' ? 'n' : ''}>{c.type === 'pill' ? <span className="adm-pill">{String(getPath(r, c.key) ?? '-')}</span> : formatCell(c.type, getPath(r, c.key), r)}</td>)}</tr>)}</tbody></table>
              )}
            </div>
          ))}
        </>
      )}
    </section>
  );
}
