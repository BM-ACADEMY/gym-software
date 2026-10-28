import { useEffect, useState } from 'react';
import apiClient from '../../api/client';

const Row = ({ m, label, onSend, state }) => (
  <li className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
    <span className="font-medium text-gray-800">{m.name}</span>
    <span className="text-xs text-gray-500">{m.phone}</span>
    <span className="text-xs text-gray-500">{label}</span>
    <span className="ml-auto flex items-center gap-2">
      {state?.msg && <span className={`text-xs ${state.ok ? 'text-green-700' : 'text-red-600'}`}>{state.msg}</span>}
      <button
        disabled={!m.canMessage || state?.busy || state?.ok}
        onClick={() => onSend(m)}
        className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        title={m.canMessage ? '' : 'No phone number, or WhatsApp is switched off for this member'}
      >
        {state?.ok ? 'Sent' : state?.busy ? 'Sending…' : 'Send WhatsApp'}
      </button>
    </span>
  </li>
);

const AtRisk = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [state, setState] = useState({});

  useEffect(() => {
    apiClient.get('/admin/retention/at-risk').then((r) => setData(r.data.data)).catch((e) => setError(e.response?.data?.message || 'Could not load'));
  }, []);

  const send = async (m, kind) => {
    setState((s) => ({ ...s, [m.id]: { busy: true } }));
    try {
      await apiClient.post('/admin/retention/message', { memberId: m.id, kind });
      setState((s) => ({ ...s, [m.id]: { ok: true, msg: 'Message sent' } }));
    } catch (e) {
      setState((s) => ({ ...s, [m.id]: { msg: e.response?.data?.message || 'Could not send' } }));
    }
  };

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-800">Not coming lately <span className="text-gray-400">({data.absent.length})</span></h2>
        <p className="text-sm text-gray-500">Active members with no check-in for 10 days or more. One tap sends a friendly check-in on WhatsApp (counts toward your monthly messages).</p>
        {data.absent.length === 0 ? <p className="mt-3 text-sm text-gray-400">Everyone is coming. Nice.</p> : (
          <ul className="mt-2 divide-y divide-gray-100">
            {data.absent.map((m) => <Row key={m.id} m={m} label={`${m.days} days away`} state={state[m.id]} onSend={(x) => send(x, 'absent')} />)}
          </ul>
        )}
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-800">Recently lapsed <span className="text-gray-400">({data.lapsed.length})</span></h2>
        <p className="text-sm text-gray-500">Memberships that ended in the last 30 days. A win-back message works best in the first week.</p>
        {data.lapsed.length === 0 ? <p className="mt-3 text-sm text-gray-400">None right now.</p> : (
          <ul className="mt-2 divide-y divide-gray-100">
            {data.lapsed.map((m) => <Row key={m.id} m={m} label={`ended ${m.daysSinceEnd} days ago`} state={state[m.id]} onSend={(x) => send(x, 'lapsed')} />)}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AtRisk;
