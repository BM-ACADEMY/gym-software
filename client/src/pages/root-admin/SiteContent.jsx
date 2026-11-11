import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import apiClient from '../../api/client';

// D-28: change the public wording (pricing page, landing page, FAQ, help articles) without a deploy. Text only.
// Every change needs a reason and is kept in the history. Wording that promises something we have not built is refused by the server.
const TEXT_LABELS = {
  pricing: { headline: 'Main heading', subline: 'Line under the heading' },
  landing: { badge: 'Small badge above the heading', line1: 'Heading, line 1', line2: 'Heading, line 2 (coloured)', line3: 'Heading, line 3', subline: 'Paragraph under the heading' },
};
const TITLES = { pricing: 'Pricing page', landing: 'Home page top section', faq: 'FAQ (questions and answers)', help: 'Help centre articles' };
const HINTS = { pricing: 'Type {trialDays} where the free trial length should appear. It fills in the live number.', landing: 'Text only. No links.', faq: 'Order here is the order on the site.', help: 'Leave a blank line between paragraphs.' };
const TEXTAREA = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm';

const Box = ({ section, data, defaults, changed, onSaved }) => {
  const isList = section === 'faq' || section === 'help';
  const toForm = (v) => (isList ? v.map((x) => ({ id: x.id, q: x.q, a: Array.isArray(x.a) ? x.a.join('\n\n') : x.a })) : { ...v });
  const [f, setF] = useState(toForm(data)); const [reason, setReason] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { setF(toForm(data)); }, [JSON.stringify(data)]); // eslint-disable-line react-hooks/exhaustive-deps
  const body = () => (isList ? f.map((x) => ({ ...(x.id ? { id: x.id } : {}), q: x.q, a: section === 'help' ? x.a.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : x.a })) : f);
  const run = async (fn) => { setBusy(true); setMsg(''); try { await fn(); setReason(''); await onSaved(); } catch (err) { setMsg(err.response?.data?.message || 'Could not save.'); } finally { setBusy(false); } };
  const save = () => run(async () => { await apiClient.put(`/root-admin/site-content/${section}`, { value: body(), reason }); setMsg('Saved. The website shows it within a minute.'); });
  const reset = () => { if (!reason.trim()) { setMsg('Write a reason first (5 to 200 characters), then press the button again.'); return; } run(async () => { await apiClient.post(`/root-admin/site-content/${section}/reset`, { reason }); setMsg('Back to the standard wording.'); }); };
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= f.length) return; const n = [...f]; [n[i], n[j]] = [n[j], n[i]]; setF(n); };
  const edit = (i, k, v) => setF(f.map((x, n) => (n === i ? { ...x, [k]: v } : x)));
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2"><p className="font-semibold text-gray-800">{TITLES[section]}</p>{changed && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Changed from standard</span>}</div>
      <p className="text-sm text-gray-600">{HINTS[section]}</p>
      {!isList && Object.keys(TEXT_LABELS[section]).map((k) => (
        <label key={k} className="block text-sm text-gray-700">{TEXT_LABELS[section][k]}
          <textarea rows={k === 'subline' ? 3 : 1} value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={TEXTAREA} /></label>))}
      {isList && f.map((x, i) => (
        <div key={x.id || i} className="border border-gray-200 rounded-lg p-3 space-y-2">
          <label className="block text-sm text-gray-700">Question<input value={x.q} onChange={(e) => edit(i, 'q', e.target.value)} className={TEXTAREA} /></label>
          <label className="block text-sm text-gray-700">Answer<textarea rows={section === 'help' ? 5 : 3} value={x.a} onChange={(e) => edit(i, 'a', e.target.value)} className={TEXTAREA} /></label>
          <div className="flex gap-2 text-sm">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="px-2 py-1 border rounded disabled:opacity-40">Move up</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === f.length - 1} className="px-2 py-1 border rounded disabled:opacity-40">Move down</button>
            <button type="button" onClick={() => setF(f.filter((_, n) => n !== i))} className="px-2 py-1 border rounded text-red-700">Remove</button>
          </div>
        </div>))}
      {isList && <button type="button" onClick={() => setF([...f, { q: '', a: '' }])} className="px-3 py-1.5 border rounded-lg text-sm">Add a new one</button>}
      <label className="block text-sm text-gray-700">Reason for this change (5 to 200 characters)<input value={reason} onChange={(e) => setReason(e.target.value)} className={TEXTAREA} /></label>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={save} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium disabled:opacity-50">Save changes</button>
        <button type="button" disabled={busy || !changed} onClick={reset} className="px-4 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-40">Go back to standard</button>
      </div>
      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </div>
  );
};

const SiteContent = () => {
  const [data, setData] = useState(null); const [error, setError] = useState('');
  const load = async () => { try { setData((await apiClient.get('/root-admin/site-content')).data.data); } catch (err) { setError(err.response?.data?.message || 'Could not load the site content.'); } };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3"><FileText className="w-6 h-6 text-teal-600" /><h1 className="text-2xl font-bold text-gray-900">Site content</h1></div>
      <p className="text-sm text-gray-600">Change the wording on the public website here. It is live within a minute, no deploy needed. Text only: no links. The system refuses wording that promises something we have not built (for example "unlimited AI" or "No 1"). WhatsApp message text is not here: it must match what Meta approved.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && ['pricing', 'landing', 'faq', 'help'].map((s) => <Box key={s} section={s} data={data.content[s]} defaults={data.defaults[s]} changed={data.changed.includes(s)} onSaved={load} />)}
      {data && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="font-semibold text-gray-800 mb-2">History</p>
          {data.history.length === 0 ? <p className="text-sm text-gray-500">No changes yet.</p> : (
            <ul className="space-y-2 text-sm">{data.history.map((h, i) => (
              <li key={i} className="border-b border-gray-100 pb-2"><span className="text-gray-500">{new Date(h.at).toLocaleString('en-IN')}</span> · {h.by} · <b>{TITLES[h.section] || h.section}</b> {h.action === 'reset' ? 'went back to standard' : 'changed'}<br />
                <span className="text-gray-600">Reason: {h.reason}</span></li>))}</ul>)}
        </div>)}
    </div>
  );
};
export default SiteContent;
