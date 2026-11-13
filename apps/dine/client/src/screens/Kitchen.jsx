import { useEffect, useRef, useState } from 'react';
import { S, msgOf, usePoll } from './ui.js';

// Kitchen or bar board. Tickets sit oldest first. Each has a waiting clock from the time the ticket was sent:
// green under 8 minutes, amber to 15, red after that. New tickets flash and can beep (the beep is off until someone taps Sound,
// because browsers only allow sound after a tap). Whether this login may see the board is decided by the server.
const AMBER = 8; const RED = 15;
const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const tone = (mins) => (mins >= RED ? { bar: '#dc2626', bg: '#fef2f2', ink: '#991b1b' } : mins >= AMBER ? { bar: '#f59e0b', bg: '#fffbeb', ink: '#92400e' } : { bar: '#16a34a', bg: '#f0fdf4', ink: '#166534' });
function beep() { try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; const c = new C(); const o = c.createOscillator(); const g = c.createGain(); o.type = 'sine'; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.25, c.currentTime + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.5); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.55); setTimeout(() => c.close && c.close(), 900); } catch (e) { /* a missing beep is not an error */ } }

export default function Kitchen({ api, t }) {
  const [station, setStation] = useState('kitchen'); const [msg, setMsg] = useState('');
  const [sound, setSound] = useState(false); const [full, setFull] = useState(false); const [now, setNow] = useState(Date.now());
  const seen = useRef(null); const [fresh, setFresh] = useState({}); const box = useRef(null);
  const { data, error, reload } = usePoll(async () => (await api.get('/kitchen', { station })).data, 5000, [station]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { seen.current = null; }, [station]);
  // Which tickets are new since the last look? The first load only fills the list, so opening the screen never beeps.
  useEffect(() => {
    if (!data) return;
    const ids = new Map(data.map((o) => [o.id, o.sentAt || '']));
    if (seen.current) {
      const added = data.filter((o) => !seen.current.has(o.id) || seen.current.get(o.id) !== (o.sentAt || '')).map((o) => o.id);
      if (added.length) { setFresh((f) => { const n = { ...f }; added.forEach((i) => { n[i] = true; }); return n; }); if (sound) beep(); setTimeout(() => setFresh((f) => { const n = { ...f }; added.forEach((i) => delete n[i]); return n; }), 4000); }
    }
    seen.current = ids;
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const h = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h); }, []);
  const toggleFull = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else if (box.current && box.current.requestFullscreen) box.current.requestFullscreen(); } catch (e) { /* not every browser allows it */ } };
  const served = async (o) => { setMsg(''); try { await api.post('/orders/' + o.id + '/served', { lineIds: o.lines.map((l) => l.id) }); reload(); } catch (e) { setMsg(msgOf(e, t)); } };
  const list = data || [];
  const late = list.filter((o) => o.sentAt && (now - new Date(o.sentAt).getTime()) / 60000 >= RED).length;
  const chip = (on) => ({ ...S.big, minHeight: 44, padding: '8px 16px', background: on ? '#fde68a' : 'rgba(255,255,255,.1)', color: on ? '#111827' : '#f9fafb', border: '1px solid rgba(255,255,255,.25)' });
  return (
    <div ref={box} style={{ ...S.page, maxWidth: 'none', background: 'linear-gradient(160deg,#0b1220,#1f2937)', color: '#f9fafb', minHeight: full ? '100vh' : '78vh', overflow: 'auto' }}>
      <style>{'@keyframes kb-flash{0%{transform:scale(.94);box-shadow:0 0 0 0 rgba(250,204,21,.9)}60%{transform:scale(1.02);box-shadow:0 0 0 14px rgba(250,204,21,0)}100%{transform:none;box-shadow:0 0 0 0 rgba(250,204,21,0)}}@keyframes kb-late{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.55)}50%{box-shadow:0 0 0 8px rgba(220,38,38,0)}}@media (prefers-reduced-motion:reduce){.kb-new,.kb-late{animation:none!important}}'}</style>
      <div style={{ ...S.row, marginBottom: 6 }}>
        <h2 style={{ margin: 0, flex: 1, fontSize: 28, color: '#fff' }}>{station === 'bar' ? t('bar_title') : t('kitchen_title')} <span style={{ fontSize: 18, fontWeight: 600, opacity: .8 }}>· {list.length} {t('kb_waiting')}{late ? ' · ' + late + ' ' + t('kb_late').toLowerCase() : ''}</span></h2>
        <button type="button" style={chip(station === 'kitchen')} onClick={() => setStation('kitchen')}>{t('station_kitchen')}</button>
        <button type="button" style={chip(station === 'bar')} onClick={() => setStation('bar')}>{t('station_bar')}</button>
        <button type="button" style={chip(sound)} aria-pressed={sound} onClick={() => { setSound(!sound); if (!sound) beep(); }}>{sound ? '🔔 ' + t('kb_sound_on') : '🔕 ' + t('kb_sound_off')}</button>
        <button type="button" style={chip(full)} onClick={toggleFull}>{full ? t('kb_exit_full') : t('kb_full')}</button>
      </div>
      <small style={{ opacity: .7 }}>{t('auto_refresh').replace('10', '5')}{!sound ? ' · ' + t('kb_sound_help') : ''}</small>
      {(error || msg) && <p style={{ ...S.err, color: '#fecaca', background: 'rgba(220,38,38,.2)' }} role="alert">{msg || error}</p>}
      {data && list.length === 0 && <p style={{ fontSize: 26, marginTop: 40, textAlign: 'center', opacity: .85 }}>✓ {t('kb_clear')}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginTop: 14 }}>
        {list.map((o) => {
          const ms = o.sentAt ? now - new Date(o.sentAt).getTime() : 0; const mins = ms / 60000; const c = tone(mins);
          return (
            <div key={o.id} className={(fresh[o.id] ? 'kb-new ' : '') + (mins >= RED ? 'kb-late' : '')} style={{ background: c.bg, color: '#111827', borderRadius: 18, overflow: 'hidden', borderTop: '8px solid ' + c.bar, boxShadow: '0 6px 20px rgba(0,0,0,.35)', animation: fresh[o.id] ? 'kb-flash .9s ease-out' : mins >= RED ? 'kb-late 1.6s ease-in-out infinite' : 'none' }}>
              <div style={{ padding: '12px 14px 4px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <strong style={{ fontSize: 26 }}>{o.table ? o.table : o.number}</strong>
                <small style={{ color: '#4b5563' }}>{o.number}{o.type === 'takeaway' ? ' · ' + t('kb_take') : ''}</small>
                <span style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: c.ink }}>{o.sentAt ? mmss(ms) : '--:--'}</span>
              </div>
              <div style={{ padding: '0 14px 6px' }}>
                {o.lines.map((l) => <div key={l.id} style={{ fontSize: 22, padding: '5px 0', borderBottom: '1px dashed rgba(0,0,0,.12)' }}><strong>{l.qty} ×</strong> {l.name}{l.note ? <div style={{ fontSize: 15, color: '#b45309', fontWeight: 600 }}>✎ {l.note}</div> : null}</div>)}
              </div>
              <div style={{ padding: '6px 14px 14px' }}><button type="button" style={{ ...S.primary, width: '100%', minHeight: 54, fontSize: 19 }} onClick={() => served(o)}>{t('mark_served')}</button></div>
            </div>);
        })}
      </div>
    </div>
  );
}
