import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Send } from 'lucide-react';
import apiClient from '../../api/client';
import { useT } from '../../i18n';

// Owner autopilot reports. Suggest mode: the weekly and monthly reports are made for you; one tap sends one to your own WhatsApp.
// Numbers come from the server (counts and rupee totals only). The same numbers every time: no AI writes them.
const inr = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const BADGE = { ready: 'bg-amber-100 text-amber-700', sent: 'bg-green-100 text-green-700', dismissed: 'bg-gray-100 text-gray-500' };
const STATUS_LABEL = { ready: 'Ready to send', sent: 'Sent', dismissed: 'Hidden' };

const Change = ({ pct }) => {
  const { t } = useT();
  if (pct === null || pct === undefined) return <span className="text-xs text-gray-400">{t('no earlier data')}</span>;
  if (pct === 0) return <span className="text-xs text-gray-500">{t('same')}</span>;
  return <span className={`text-xs font-medium ${pct > 0 ? 'text-green-600' : 'text-red-600'}`}>{pct > 0 ? '▲' : '▼'} {Math.abs(pct)}%</span>;
};

const ReportCard = ({ title, report, onSend, onDismiss, busy, message }) => {
  const { t } = useT();
  if (!report) return null;
  const metrics = report.data.metrics;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="h-4 w-4 text-teal-600" />
        <h3 className="text-sm font-semibold text-gray-800">{t(title)}</h3>
        <span className="text-xs text-gray-500">{report.label}</span>
        {report.status ? <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[report.status]}`}>{t(STATUS_LABEL[report.status])}</span> : null}
      </div>
      <p className="mt-3 text-sm text-gray-700">{report.headline}</p>
      <dl className="mt-3 divide-y divide-gray-100 text-sm">
        {metrics.map((m) => (
          <div key={m.key} className="flex items-center justify-between py-1.5">
            <dt className="text-gray-600">{t(m.label)}</dt>
            <dd className="flex items-center gap-3"><span className="font-medium text-gray-900">{m.kind === 'money' ? inr(m.value) : m.value}</span><Change pct={m.changePct} /></dd>
          </div>
        ))}
        <div className="flex items-center justify-between py-1.5">
          <dt className="text-gray-600">{t('Pending dues now')}</dt>
          <dd className="font-medium text-gray-900">{inr(report.data.snapshot.duesTotal)}</dd>
        </div>
      </dl>
      <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800"><span className="font-medium">{t('Next step')}:</span> {report.step.text}</p>
      {report.id && report.status !== 'dismissed' ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {report.status === 'ready' ? (
            <button type="button" disabled={busy} onClick={() => onSend(report.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
              <Send className="h-3.5 w-3.5" /> {t('Send to my WhatsApp')}
            </button>
          ) : null}
          {report.status === 'ready' ? <button type="button" disabled={busy} onClick={() => onDismiss(report.id)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">{t('Hide')}</button> : null}
          {message ? <span className="text-xs text-gray-500">{message}</span> : null}
        </div>
      ) : null}
    </div>
  );
};

const OwnerReports = () => {
  const { t } = useT();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState({});

  const load = () => apiClient.get('/admin/owner-reports').then((r) => setData(r.data.data)).catch((e) => setError(e.response?.data?.message || 'Could not load the reports'));
  useEffect(() => { load(); }, []);

  const act = async (id, kind) => {
    setBusy(true);
    try {
      await apiClient.post(`/admin/owner-reports/${id}/${kind}`);
      setNotes((n) => ({ ...n, [id]: kind === 'send' ? t('Sent to your WhatsApp.') : '' }));
      await load();
    } catch (e) {
      setNotes((n) => ({ ...n, [id]: e.response?.data?.message || t('Something went wrong.') }));
    } finally { setBusy(false); }
  };

  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>;
  if (!data) return <div className="p-6 text-sm text-gray-500">{t('Loading...')}</div>;
  const { weekly, monthly, thisWeekSoFar, settings } = data;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-gray-900">{t('Owner reports')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('Your weekly and monthly numbers, made for you. Collected money, expenses, new members and check-ins, with the one thing to do next. No member names or phone numbers.')}</p>
      <p className="mt-2 text-xs text-gray-500">
        {settings.reportsAutoSend ? t('Reports are sent to your WhatsApp by themselves.') : t('Reports wait here until you tap Send.')}{' '}
        <Link to="/admin/settings" className="font-medium text-teal-700 hover:underline">{t('Change this in Settings')}</Link>
        {!settings.whatsappEnabled ? <span> {t('WhatsApp is off, so you can read reports here but not send them.')}</span> : null}
      </p>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <ReportCard title="Last week" report={weekly} busy={busy} message={notes[weekly.id]} onSend={(id) => act(id, 'send')} onDismiss={(id) => act(id, 'dismiss')} />
        <ReportCard title="Last month" report={monthly} busy={busy} message={notes[monthly.id]} onSend={(id) => act(id, 'send')} onDismiss={(id) => act(id, 'dismiss')} />
        <ReportCard title="This week so far" report={thisWeekSoFar} busy={busy} />
      </div>
    </div>
  );
};

export default OwnerReports;
