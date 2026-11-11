import { useEffect, useState } from 'react';
import { COLOR, S, msgOf, usePoll } from './ui.js';

const OPEN = ['open', 'sent', 'served', 'billed'];
const loadTables = () => { try { return JSON.parse(window.localStorage.getItem('dine:tables') || '[]'); } catch (e) { return []; } };
const saveTables = (l) => { try { window.localStorage.setItem('dine:tables', JSON.stringify(l)); } catch (e) { /* optional */ } };

// Table view: each table is a big coloured button. Colour = state of its order. Tap to open the order, or to start one on a free table.
export default function Tables({ api, t, pub, onOpenOrder }) {
  const { data, error, loading, reload } = usePoll(async () => (await api.get('/orders')).data, 10000, []);
  const [tables, setTables] = useState(loadTables); const [name, setName] = useState(''); const [type, setType] = useState('dine_in'); const [msg, setMsg] = useState('');
  useEffect(() => saveTables(tables), [tables]);
  const orders = (data || []).filter((o) => OPEN.includes(o.status));
  const byTable = {}; orders.forEach((o) => { if (o.table) byTable[o.table] = o; });
  const others = orders.filter((o) => !o.table || !tables.includes(o.table));
  const start = async (kind, table) => {
    setMsg('');
    try { const r = await api.post('/orders', { type: kind, ...(table ? { table } : {}) }); onOpenOrder(r.data.id); } catch (e) { setMsg(msgOf(e, t)); }
  };
  const addTable = () => { const n = name.trim().slice(0, 20); if (!n || tables.includes(n)) return; setTables([...tables, n]); setName(''); };
  const label = (o) => (o.type === 'dine_in' ? t('t_dine_in') : o.type === 'takeaway' ? t('t_takeaway') : t('t_bar')) + (o.table ? ' ' + o.table : '') + ' · ' + o.number;
  return (
    <div style={S.page}>
      <div style={S.row}><h2 style={{ flex: 1, margin: 0 }}>{t('tables_title')}</h2><button type="button" style={S.big} onClick={reload}>{t('refresh')}</button></div>
      {pub && <p style={{ fontSize: 13 }}>{t('pub_note')}</p>}
      {loading && !data && <p>{t('loading')}</p>}
      {error && <p style={S.err} role="alert">{error}</p>}
      {msg && <p style={S.err} role="alert">{msg}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, margin: '12px 0' }}>
        {tables.map((tb) => { const o = byTable[tb]; const st = o ? o.status : 'free'; return (
          <button key={tb} type="button" style={{ ...S.big, background: COLOR[st], minHeight: 84, fontWeight: 600 }} onClick={() => (o ? onOpenOrder(o.id) : start('dine_in', tb))}>
            {tb}<br /><small>{t(st)}</small>
          </button>); })}
      </div>
      <div style={S.card}>
        <label>{t('table_name')}<input style={S.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={20} /></label>
        <button type="button" style={S.big} onClick={addTable}>{t('add_table')}</button>
      </div>
      <div style={S.card}>
        <strong>{t('new_order')}</strong>
        <div style={S.row}>
          <button type="button" style={S.big} onClick={() => start('takeaway')}>{t('t_takeaway')}</button>
          {pub && <button type="button" style={S.big} onClick={() => start('bar')}>{t('t_bar')}</button>}
        </div>
      </div>
      {others.length === 0 && tables.length === 0 && <p>{t('no_orders')}</p>}
      {others.map((o) => <button key={o.id} type="button" style={{ ...S.big, display: 'block', width: '100%', margin: '6px 0', background: COLOR[o.status] }} onClick={() => onOpenOrder(o.id)}>{label(o)} · {t(o.status)}</button>)}
    </div>
  );
}
