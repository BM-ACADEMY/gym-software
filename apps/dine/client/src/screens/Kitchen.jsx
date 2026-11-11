import { useState } from 'react';
import { S, msgOf, usePoll } from './ui.js';

// Kitchen or bar display: big tickets, newest at the bottom, refreshes by itself. Whether this login may see it is decided by the server.
export default function Kitchen({ api, t }) {
  const [station, setStation] = useState('kitchen'); const [msg, setMsg] = useState('');
  const { data, error, reload } = usePoll(async () => (await api.get('/kitchen', { station })).data, 10000, [station]);
  const served = async (o) => { setMsg(''); try { await api.post('/orders/' + o.id + '/served', { lineIds: o.lines.map((l) => l.id) }); reload(); } catch (e) { setMsg(msgOf(e, t)); } };
  return (
    <div style={{ ...S.page, background: '#111827', color: '#f9fafb', minHeight: '70vh', borderRadius: 12 }}>
      <div style={S.row}>
        <h2 style={{ margin: 0, flex: 1 }}>{station === 'bar' ? t('bar_title') : t('kitchen_title')}</h2>
        <button type="button" style={{ ...S.big, background: station === 'kitchen' ? '#fde68a' : '#fff' }} onClick={() => setStation('kitchen')}>{t('station_kitchen')}</button>
        <button type="button" style={{ ...S.big, background: station === 'bar' ? '#fde68a' : '#fff' }} onClick={() => setStation('bar')}>{t('station_bar')}</button>
      </div>
      <small>{t('auto_refresh')}</small>
      {(error || msg) && <p style={{ ...S.err, color: '#fecaca' }} role="alert">{msg || error}</p>}
      {data && data.length === 0 && <p style={{ fontSize: 22 }}>{t('kitchen_empty')}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginTop: 12 }}>
        {(data || []).map((o) => (
          <div key={o.id} style={{ background: '#fff', color: '#111827', borderRadius: 12, padding: 12 }}>
            <strong style={{ fontSize: 20 }}>{o.table ? o.table : o.number}</strong> <small>{o.number}</small>
            {o.lines.map((l) => <div key={l.id} style={{ fontSize: 20, padding: '4px 0' }}>{l.qty} × {l.name}{l.note ? <small> ({l.note})</small> : null}</div>)}
            <button type="button" style={{ ...S.primary, width: '100%', marginTop: 8 }} onClick={() => served(o)}>{t('mark_served')}</button>
          </div>))}
      </div>
    </div>
  );
}
