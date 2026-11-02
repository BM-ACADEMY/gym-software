import { useState } from 'react';
import { useLoad } from './useLoad.js';
import { formatCell, getPath, validateRecord } from './schema.js';

// A list with search, add/edit form and row actions, all described by the product's manifest.
// api: { get(path, params), post(path, body), patch(path, body), put(path, body), del(path) } returning the JSON body.
export default function ResourceScreen({ def, api, title }) {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // null | {} (new) | row
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState('');
  const { loading, error, data, reload } = useLoad(() => api.get(def.endpoint, q ? { q } : {}).then((r) => r.data), [def.endpoint, q]);
  const rows = Array.isArray(data) ? data : [];
  const idOf = (r) => r.id || r._id;

  const open = (row) => { setEditing(row); setForm(row && idOf(row) ? { ...row, skills: row.skills } : {}); setErrors({}); setMsg(''); };
  const save = async (e) => {
    e.preventDefault();
    const v = validateRecord(def.fields || [], form);
    setErrors(v.errors); if (!v.ok) return;
    try {
      if (editing && idOf(editing)) await api.patch(`${def.endpoint}/${idOf(editing)}`, v.values); else await api.post(def.endpoint, v.values);
      setEditing(null); setMsg('Saved.'); reload();
    } catch (err) { setMsg((err.response && err.response.data && err.response.data.message) || 'Could not save.'); }
  };
  // Buttons above the list that act on the whole list (for example "Find new suggestions"), described by def.toolbar.
  const runToolbar = async (a) => {
    try { const r = await api[(a.method || 'POST').toLowerCase()](a.path, a.body || {}); setMsg(typeof r.message === 'string' && r.message && r.success ? r.message : typeof r.added === 'number' ? `${a.done || 'Done.'} ${r.added} new.` : (a.done || 'Done.')); reload(); }
    catch (err) { setMsg((err.response && err.response.data && err.response.data.message) || 'That did not work.'); }
  };
  const runAction = async (a, row) => {
    const key = a.label + idOf(row);
    if (a.confirm && confirm !== key) { setConfirm(key); return; } // second tap confirms, inside the page (no pop-up)
    setConfirm('');
    try {
      const path = a.path.replace(':id', idOf(row));
      await (a.method === 'DELETE' ? api.del(path) : api[(a.method || 'POST').toLowerCase()](path, a.body || {}));
      setMsg(a.done || 'Done.'); reload();
    } catch (err) { setMsg((err.response && err.response.data && err.response.data.message) || 'That did not work.'); }
  };

  return (
    <section className="adm-screen">
      <header className="adm-head">
        <h2>{title || def.label}</h2>
        <div className="adm-tools">
          {def.searchable !== false && <input aria-label="Search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />}
          {(def.toolbar || []).map((a) => <button key={a.label} type="button" className="adm-btn" onClick={() => runToolbar(a)}>{a.label}</button>)}
          {def.fields && (!def.readOnly || def.canAdd) && <button type="button" className="adm-btn main" onClick={() => open({})}>Add</button>}
        </div>
      </header>
      {msg && <p role="status" className="adm-note">{msg}</p>}
      {error && <p role="alert" className="adm-error">{error}</p>}
      {editing && (
        <form className="adm-form" onSubmit={save} noValidate>
          {def.fields.map((f) => (
            <label key={f.key}>
              <span>{f.label || f.key}{f.required ? ' *' : ''}</span>
              {f.type === 'select' ? (
                <select id={`f-${f.key}`} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                  <option value="">Choose</option>
                  {f.options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
                </select>
              ) : f.type === 'bool' ? (
                <input id={`f-${f.key}`} type="checkbox" checked={!!form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} />
              ) : f.type === 'textarea' ? (
                <textarea id={`f-${f.key}`} rows={3} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              ) : (
                <input id={`f-${f.key}`} type={f.type === 'number' || f.type === 'money' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                  value={Array.isArray(form[f.key]) ? form[f.key].join(', ') : (form[f.key] ?? '')} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              )}
              {errors[f.key] && <em role="alert">{errors[f.key]}</em>}
            </label>
          ))}
          <div className="adm-row"><button type="submit" className="adm-btn main">Save</button><button type="button" className="adm-btn" onClick={() => setEditing(null)}>Cancel</button></div>
        </form>
      )}
      {loading && !data ? <p className="adm-note">Loading...</p> : !rows.length ? <p className="adm-note">{def.empty || 'Nothing here yet.'}</p> : (
        <div className="adm-table">
          <table>
            <thead><tr>{def.columns.map((c) => <th key={c.key} className={c.type === 'money' || c.type === 'number' ? 'n' : ''}>{c.label || c.key}</th>)}<th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={idOf(r)}>
                  {def.columns.map((c) => <td key={c.key} className={c.type === 'money' || c.type === 'number' ? 'n' : ''}>{c.type === 'pill' ? <span className="adm-pill">{String(getPath(r, c.key) ?? '-')}</span> : formatCell(c.type, getPath(r, c.key), r)}</td>)}
                  <td className="adm-actions">
                    {def.fields && !def.readOnly && <button type="button" className="adm-btn" onClick={() => open(r)}>Edit</button>}
                    {(def.actions || []).filter((a) => !a.when || getPath(r, a.when.key) === a.when.equals).map((a) => (
                      <button key={a.label} type="button" className="adm-btn" onClick={() => runAction(a, r)}>{confirm === a.label + idOf(r) ? (a.confirm || 'Tap again to confirm') : a.label}</button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
