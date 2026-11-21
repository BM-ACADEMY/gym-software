import { useEffect, useState, useCallback } from 'react';
import apiClient from '../../api/client';

const rs = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const errText = (e, f) => e.response?.data?.message || f;
const thisMonth = () => new Date().toISOString().slice(0, 7);

const Payroll = () => {
  const [staff, setStaff] = useState([]);
  const [runs, setRuns] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [run, setRun] = useState(null);
  const [month, setMonth] = useState(thisMonth());
  const [error, setError] = useState('');
  const [adv, setAdv] = useState({ staffId: '', amount: '' });
  const [edits, setEdits] = useState({}); // staffId -> { baseSalary, ptCommissionPercent }

  const load = useCallback(async () => {
    try {
      const [s, r, a] = await Promise.all([apiClient.get('/admin/payroll/staff'), apiClient.get('/admin/payroll/runs'), apiClient.get('/admin/payroll/advances')]);
      setStaff(s.data.data); setRuns(r.data.data); setAdvances(a.data.data);
    } catch (e) { setError(errText(e, 'Could not load payroll')); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn) => { setError(''); try { await fn(); await load(); } catch (e) { setError(errText(e, 'That did not work')); } };

  const saveStaff = (s) => act(async () => {
    const e = edits[s._id] || {};
    const body = {};
    if (e.baseSalary !== undefined && e.baseSalary !== '') body.baseSalary = Number(e.baseSalary);
    if (e.ptCommissionPercent !== undefined && e.ptCommissionPercent !== '') body.ptCommissionPercent = Number(e.ptCommissionPercent);
    await apiClient.patch(`/admin/payroll/staff/${s._id}`, body);
    setEdits((x) => ({ ...x, [s._id]: undefined }));
  });

  const open = (id) => act(async () => { const r = await apiClient.get(`/admin/payroll/runs/${id}`); setRun(r.data.data); });
  const create = () => act(async () => { const r = await apiClient.post('/admin/payroll/runs', { month }); setRun(r.data.data); });
  const patchItem = (it, body) => act(async () => { const r = await apiClient.patch(`/admin/payroll/runs/${run._id}/items/${it.staffId}`, body); setRun(r.data.data); });
  const lock = () => window.confirm('Lock this month? Payslips cannot be changed after this.') && act(async () => { const r = await apiClient.post(`/admin/payroll/runs/${run._id}/lock`); setRun(r.data.data); });
  const remove = () => window.confirm('Delete this draft?') && act(async () => { await apiClient.delete(`/admin/payroll/runs/${run._id}`); setRun(null); });

  const slip = async (it) => {
    try {
      const res = await apiClient.get(`/admin/payroll/runs/${run._id}/payslip/${it.staffId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `payslip-${run.month}-${it.name.replace(/[^\w-]/g, '_')}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { setError('Could not download the payslip.'); }
  };

  const input = 'rounded-lg border border-gray-300 px-3 py-2 text-sm';

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Staff Payroll</h1>
        <p className="mt-1 text-gray-500">Salary, loss of pay from the staff attendance sheet, PT commission and advances. You can change every number before you lock the month. This calculates pay; it does not file taxes.</p>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {run ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => { setRun(null); load(); }} className="text-sm font-semibold text-teal-700">← Back</button>
            <h2 className="text-lg font-semibold">{run.month} <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${run.status === 'locked' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{run.status === 'locked' ? 'Locked' : 'Draft'}</span></h2>
            <span className="ml-auto text-sm text-gray-700">Total to pay: <b>{rs(run.totals?.net)}</b></span>
            {run.status === 'draft' && <><button onClick={lock} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white">Lock month</button><button onClick={remove} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">Delete</button></>}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b text-xs text-gray-500"><th className="py-2">Name</th><th>Salary</th><th>Present</th><th>Loss of pay days</th><th>Advance cut</th><th>Extras</th><th>Net pay</th><th /></tr></thead>
              <tbody>
                {run.items.map((it) => (
                  <tr key={it.staffId} className="border-b border-gray-100 align-top">
                    <td className="py-2 font-medium">{it.name}</td>
                    <td>{rs(it.payslip.gross)}</td>
                    <td>{it.daysPresent ?? '-'}</td>
                    <td>{run.status === 'draft' ? <input type="number" min="0" max="26" step="0.5" defaultValue={it.lopDays} onBlur={(e) => Number(e.target.value) !== it.lopDays && patchItem(it, { lopDays: Number(e.target.value) })} className="w-20 rounded border border-gray-300 px-2 py-1" /> : it.lopDays}</td>
                    <td>{run.status === 'draft' ? <input type="number" min="0" step="1" defaultValue={it.advanceDue} onBlur={(e) => Number(e.target.value) !== it.advanceDue && patchItem(it, { advanceDue: Number(e.target.value) })} className="w-24 rounded border border-gray-300 px-2 py-1" /> : rs(it.payslip.advanceApplied)}</td>
                    <td className="text-xs text-gray-600">{(it.adjustments || []).map((a) => `${a.kind === 'add' ? '+' : '−'}${rs(a.amount)} ${a.label}`).join('; ') || '-'}</td>
                    <td className="font-semibold">{rs(it.payslip.net)}</td>
                    <td><button onClick={() => slip(it)} className="text-xs font-semibold text-teal-700">Payslip PDF</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {run.status === 'draft' && <p className="mt-3 text-xs text-gray-500">Loss of pay starts from 26 working days minus days present or on leave in the staff attendance sheet. If you did not mark attendance for someone, no pay is cut. Change it here if needed.</p>}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Run payroll</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={input} />
              <button onClick={create} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white">Create draft</button>
            </div>
            <ul className="mt-4 divide-y divide-gray-100 text-sm">
              {runs.length === 0 && <li className="py-2 text-gray-400">No payroll runs yet.</li>}
              {runs.map((r) => (
                <li key={r._id} className="flex items-center gap-3 py-2">
                  <button onClick={() => open(r._id)} className="font-semibold text-teal-700">{r.month}</button>
                  <span className="text-xs text-gray-500">{r.status === 'locked' ? 'Locked' : 'Draft'}</span>
                  <span className="ml-auto">{rs(r.totals?.net)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Staff salaries</h2>
            <p className="text-sm text-gray-500">Only people with a monthly salary are included in payroll. PT commission is a percent of the PT money collected from members assigned to that trainer.</p>
            <ul className="mt-3 divide-y divide-gray-100 text-sm">
              {staff.length === 0 && <li className="py-2 text-gray-400">Add staff first in Sub-Admin / Staff.</li>}
              {staff.map((s) => (
                <li key={s._id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-[8rem] flex-1 font-medium">{s.name}</span>
                  <input type="number" min="0" placeholder="Salary ₹" defaultValue={s.baseSalary ?? ''} onChange={(e) => setEdits((x) => ({ ...x, [s._id]: { ...x[s._id], baseSalary: e.target.value } }))} className={`${input} w-32`} />
                  <input type="number" min="0" max="100" placeholder="PT %" defaultValue={s.ptCommissionPercent ?? ''} onChange={(e) => setEdits((x) => ({ ...x, [s._id]: { ...x[s._id], ptCommissionPercent: e.target.value } }))} className={`${input} w-24`} />
                  <button disabled={!edits[s._id]} onClick={() => saveStaff(s)} className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Save</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Advances</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <select value={adv.staffId} onChange={(e) => setAdv({ ...adv, staffId: e.target.value })} className={input}>
                <option value="">Staff…</option>
                {staff.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
              <input type="number" min="1" placeholder="Amount ₹" value={adv.amount} onChange={(e) => setAdv({ ...adv, amount: e.target.value })} className={`${input} w-32`} />
              <button disabled={!adv.staffId || !adv.amount} onClick={() => act(async () => { await apiClient.post('/admin/payroll/advances', { staffId: adv.staffId, amount: Number(adv.amount) }); setAdv({ staffId: '', amount: '' }); })} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Record advance</button>
            </div>
            <ul className="mt-3 divide-y divide-gray-100 text-sm">
              {advances.length === 0 && <li className="py-2 text-gray-400">No advances.</li>}
              {advances.map((a) => <li key={a._id} className="flex gap-3 py-2"><span className="font-medium">{a.staffId?.name || 'Staff'}</span><span>{rs(a.amount)}</span><span className="ml-auto text-gray-600">{a.owed > 0 ? `${rs(a.owed)} still owed` : 'Fully recovered'}</span></li>)}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default Payroll;
