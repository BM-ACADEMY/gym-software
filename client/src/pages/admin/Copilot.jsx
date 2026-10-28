import { useEffect, useMemo, useState } from 'react';
import apiClient from '../../api/client';
import { useT } from '../../i18n';

const KIND_LABEL = { renew: 'Renew', lapsed: 'Win back', dues: 'Dues', absent: 'Check in' };
const KIND_COLOR = { renew: 'bg-teal-50 text-teal-700', lapsed: 'bg-amber-50 text-amber-700', dues: 'bg-red-50 text-red-700', absent: 'bg-blue-50 text-blue-700' };

const fillText = (tpl, p) => String(tpl).replace(/\{(name|gym|days|amount)\}/g, (_, k) => (p[k] === undefined || p[k] === null ? '' : String(p[k])));

const Copilot = () => {
  const { t, lang } = useT();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [custom, setCustom] = useState({}); // kind -> rewritten template
  const [busy, setBusy] = useState({});
  const [note, setNote] = useState({});
  const [done, setDone] = useState({});

  const load = () => apiClient.get('/admin/copilot/today', { params: { lang } })
    .then((r) => { setData(r.data.data); setCustom({}); })
    .catch((e) => setError(e.response?.data?.message || 'Could not load'));
  useEffect(() => { load(); /* reload when the language changes */ }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => (data?.items || []).filter((i) => !done[`${i.id}:${i.kind}`]).map((i) => {
    const text = custom[i.kind] ? fillText(custom[i.kind], i.params) : i.message;
    const link = i.waNumber ? `https://wa.me/${i.waNumber}?text=${encodeURIComponent(text)}` : null;
    return { ...i, text, link };
  }), [data, custom, done]);

  const markDone = async (i) => {
    setDone((d) => ({ ...d, [`${i.id}:${i.kind}`]: true }));
    try { await apiClient.post('/admin/copilot/done', { memberId: i.id, kind: i.kind }); } catch { /* the list refreshes tomorrow anyway */ }
  };

  const rewrite = async (kind) => {
    setBusy((b) => ({ ...b, [kind]: true }));
    try {
      const r = await apiClient.post('/admin/copilot/polish', { kind, lang });
      const d = r.data.data;
      if (d.source === 'ai') setCustom((c) => ({ ...c, [kind]: d.text }));
      setNote((n) => ({ ...n, [kind]: d.source === 'ai' ? t('Rewritten with AI') : d.note }));
      if (d.source === 'ai') setData((x) => ({ ...x, ai: { ...x.ai, remaining: d.remaining } }));
    } catch (e) {
      setNote((n) => ({ ...n, [kind]: e.response?.data?.message || 'Could not rewrite' }));
    }
    setBusy((b) => ({ ...b, [kind]: false }));
  };

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">{t('Loading…')}</p>;
  const s = data.summary;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-800">{t('Who to contact today')}</h2>
        <p className="text-sm text-gray-500">{t('Ranked by how likely you are to lose them. Tap a button to open WhatsApp on this phone with the message ready. Nothing is sent until you press send.')}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full px-3 py-1 ${KIND_COLOR.renew}`}>{t('Renew')}: {s.renew}</span>
          <span className={`rounded-full px-3 py-1 ${KIND_COLOR.lapsed}`}>{t('Win back')}: {s.lapsed}</span>
          <span className={`rounded-full px-3 py-1 ${KIND_COLOR.dues}`}>{t('Dues')}: {s.dues}{s.totalDues ? ` (Rs ${s.totalDues})` : ''}</span>
          <span className={`rounded-full px-3 py-1 ${KIND_COLOR.absent}`}>{t('Check in')}: {s.absent}</span>
        </div>
        {data.ai.enabled && <p className="mt-2 text-xs text-gray-400">{t('AI rewrites left this month: {n}', { n: data.ai.remaining })}</p>}
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">{t('Nobody needs a message right now. Nice.')}</p>
      ) : items.map((i) => (
        <div key={`${i.id}:${i.kind}`} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-800">{i.name}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs ${KIND_COLOR[i.kind]}`}>{t(KIND_LABEL[i.kind])}</span>
            <span className="text-xs text-gray-500">{i.reasons.join(' · ')}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{i.text}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {i.link ? (
              <a href={i.link} target="_blank" rel="noopener noreferrer" onClick={() => markDone(i)}
                className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700">{t('Open WhatsApp')}</a>
            ) : (
              <span className="text-xs text-gray-400">{t('No valid phone number, or WhatsApp is switched off for this member')}</span>
            )}
            <button onClick={() => markDone(i)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">{t('Mark as contacted')}</button>
            {data.ai.enabled && (
              <button disabled={busy[i.kind]} onClick={() => rewrite(i.kind)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {busy[i.kind] ? t('Rewriting…') : t('Rewrite with AI')}
              </button>
            )}
            {note[i.kind] && <span className="text-xs text-gray-500">{note[i.kind]}</span>}
          </div>
        </div>
      ))}
      {s.notShown > 0 && <p className="text-xs text-gray-400">{t('{n} more members are not shown. Contact these first.', { n: s.notShown })}</p>}
    </div>
  );
};

export default Copilot;
