import { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import { useT } from '../../i18n';

// Renewal Copilot page: members who may leave (with the reasons) and the next gentle win-back message for lapsed members.
// Everything is a suggestion: a tap opens WhatsApp on this phone with the message ready. Nothing is sent from the server.
const LEVEL = { high: 'bg-red-50 text-red-700', medium: 'bg-amber-50 text-amber-700' };

const Row = ({ title, badge, badgeClass, reasons, text, link, onDone, t }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4">
    <div className="flex items-center gap-2">
      <span className="font-medium text-gray-800">{title}</span>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}>{badge}</span>
    </div>
    {reasons && <ul className="mt-1 list-disc pl-5 text-xs text-gray-500">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{text}</p>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {link ? <a href={link} target="_blank" rel="noopener noreferrer" onClick={onDone} className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700">{t('Open WhatsApp')}</a>
        : <span className="text-xs text-gray-400">{t('No valid phone number, or WhatsApp is switched off for this member')}</span>}
      <button onClick={onDone} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">{t('Mark as contacted')}</button>
    </div>
  </div>
);

const ChurnRiskPanel = () => {
  const { t, lang } = useT();
  const [data, setData] = useState(null);
  const [gone, setGone] = useState({});
  useEffect(() => { apiClient.get('/admin/copilot/risk', { params: { lang } }).then((r) => setData(r.data.data)).catch(() => {}); }, [lang]);
  if (!data || (!data.atRisk.length && !data.winBack.length)) return null;
  const mark = (key, body) => { setGone((g) => ({ ...g, [key]: true })); apiClient.post('/admin/copilot/done', body).catch(() => {}); };
  return (
    <div className="space-y-3">
      {data.atRisk.filter((m) => !gone[`r${m.id}`]).length > 0 && <h3 className="pt-2 text-sm font-semibold text-gray-800">{t('May leave soon')}</h3>}
      {data.atRisk.filter((m) => !gone[`r${m.id}`]).map((m) => (
        <Row key={`r${m.id}`} t={t} title={m.name} badge={t(m.level === 'high' ? 'High risk' : 'Medium risk')} badgeClass={LEVEL[m.level]} reasons={m.reasons} text={m.message} link={m.waLink}
          onDone={() => mark(`r${m.id}`, { memberId: m.id, kind: 'absent' })} />
      ))}
      {data.winBack.filter((m) => !gone[`w${m.id}`]).length > 0 && <h3 className="pt-2 text-sm font-semibold text-gray-800">{t('Win-back messages due')}</h3>}
      {data.winBack.filter((m) => !gone[`w${m.id}`]).map((m) => (
        <Row key={`w${m.id}`} t={t} title={m.name} badge={`${t('Step')} ${m.step} / 3`} badgeClass="bg-amber-50 text-amber-700" text={m.message} link={m.waLink}
          onDone={() => mark(`w${m.id}`, { memberId: m.id, kind: 'lapsed', step: m.step })} />
      ))}
    </div>
  );
};
export default ChurnRiskPanel;
