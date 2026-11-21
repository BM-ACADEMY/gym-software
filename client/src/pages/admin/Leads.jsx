import { useEffect, useState } from 'react';
import { Copy, Phone, Plus } from 'lucide-react';
import apiClient from '../../api/client';
import { useT } from '../../i18n';

// Simple CRM: people who asked about the gym. Numbers are hidden in the list; open one lead to see and call the number.
const STATUSES = ['new', 'contacted', 'trial', 'joined', 'lost'];
const LABEL = { new: 'New', contacted: 'Contacted', trial: 'Trial', joined: 'Joined', lost: 'Lost' };
const BADGE = { new: 'bg-blue-100 text-blue-700', contacted: 'bg-amber-100 text-amber-700', trial: 'bg-purple-100 text-purple-700', joined: 'bg-green-100 text-green-700', lost: 'bg-gray-100 text-gray-500' };

const Leads = () => {
  const { t } = useT();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(null); // lead with the whole number
  const [add, setAdd] = useState({ name: '', phone: '', source: 'walkin' });
  const [msg, setMsg] = useState('');

  const load = (f = filter) => apiClient.get('/admin/leads', { params: { status: f } }).then((r) => setData(r.data.data)).catch((e) => setMsg(e.response?.data?.message || t('Could not load')));
  useEffect(() => { load(filter); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { apiClient.get('/admin/leads/form-link').then((r) => setLink(`${r.data.data.base || window.location.origin}${r.data.data.path}`)).catch(() => {}); }, []);

  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the link is shown, the owner can copy it by hand */ } };
  const replaceLink = async () => {
    if (!window.confirm(t('Make a new link? The old link will stop working.'))) return;
    const r = await apiClient.post('/admin/leads/form-link/replace');
    setLink(`${r.data.data.base || window.location.origin}${r.data.data.path}`);
  };
  const addLead = async (e) => {
    e.preventDefault(); setMsg('');
    try { await apiClient.post('/admin/leads', add); setAdd({ name: '', phone: '', source: 'walkin' }); await load(); }
    catch (err) { setMsg(err.response?.data?.message || t('Could not add')); }
  };
  const show = async (id) => { const r = await apiClient.get(`/admin/leads/${id}`); setOpen(r.data.data); };
  const change = async (id, patch) => {
    setMsg('');
    try { const r = await apiClient.patch(`/admin/leads/${id}`, patch); if (open && open.id === id) setOpen({ ...open, ...r.data.data, phone: open.phone }); await load(); }
    catch (err) { setMsg(err.response?.data?.message || t('Could not save')); }
  };
  const remove = async (id) => {
    if (!window.confirm(t('Delete this lead? This cannot be undone.'))) return;
    await apiClient.delete(`/admin/leads/${id}`); setOpen(null); await load();
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-gray-900">{t('Leads')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('People who asked about your gym. Share your link on Instagram or WhatsApp, or add walk-ins here.')}</p>

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm font-medium text-gray-800">{t('Your enquiry link')}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="flex-1 truncate rounded bg-gray-50 px-2 py-1.5 text-xs text-gray-700">{link || '...'}</code>
          <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"><Copy className="h-3.5 w-3.5" /> {copied ? t('Copied') : t('Copy')}</button>
          <button type="button" onClick={replaceLink} className="text-xs text-gray-500 hover:underline">{t('Make a new link')}</button>
        </div>
      </div>

      <form onSubmit={addLead} className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-4">
        <label className="text-xs text-gray-600">{t('Name')}<input className="mt-1 block rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} /></label>
        <label className="text-xs text-gray-600">{t('Mobile number')}<input className="mt-1 block rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" inputMode="tel" value={add.phone} onChange={(e) => setAdd({ ...add, phone: e.target.value })} /></label>
        <label className="text-xs text-gray-600">{t('Came from')}
          <select className="mt-1 block rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" value={add.source} onChange={(e) => setAdd({ ...add, source: e.target.value })}>
            <option value="walkin">{t('Walk-in')}</option><option value="phone">{t('Phone call')}</option><option value="instagram">Instagram</option><option value="other">{t('Other')}</option>
          </select>
        </label>
        <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"><Plus className="h-3.5 w-3.5" /> {t('Add lead')}</button>
      </form>
      {msg ? <p className="mt-2 text-sm text-red-600" role="alert">{msg}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {['all', ...STATUSES].map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)} className={`rounded-full px-3 py-1 text-xs font-medium ${filter === s ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {s === 'all' ? t('All') : t(LABEL[s])}{data && s !== 'all' ? ` ${data.counts[s] || 0}` : ''}
          </button>
        ))}
      </div>

      <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {!data ? <li className="p-4 text-sm text-gray-500">{t('Loading...')}</li> : data.items.length === 0 ? <li className="p-4 text-sm text-gray-500">{t('No leads yet.')}</li> : data.items.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
            <button type="button" onClick={() => show(l.id)} className="flex-1 text-left">
              <span className="font-medium text-gray-900">{l.name}</span>{' '}
              <span className="text-gray-500">{l.phone}</span>
              {l.goal ? <span className="block text-xs text-gray-500">{l.goal}</span> : null}
            </button>
            {l.needsAttention ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">{t('Call now')}</span> : null}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[l.status]}`}>{t(LABEL[l.status])}</span>
          </li>
        ))}
      </ul>

      {open ? (
        <div className="mt-4 rounded-xl border border-teal-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">{open.name}</h3>
            <button type="button" onClick={() => setOpen(null)} className="text-xs text-gray-500">{t('Close')}</button>
          </div>
          <a href={`tel:+91${open.phone}`} className="mt-2 inline-flex items-center gap-1.5 text-teal-700"><Phone className="h-4 w-4" /> {open.phone}</a>
          {open.goal ? <p className="mt-1 text-sm text-gray-600">{open.goal}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {STATUSES.map((s) => <button key={s} type="button" onClick={() => change(open.id, { status: s })} className={`rounded-full px-3 py-1 text-xs font-medium ${open.status === s ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{t(LABEL[s])}</button>)}
          </div>
          <label className="mt-3 block text-xs text-gray-600">{t('Call back on')}
            <input type="date" className="mt-1 block rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" value={open.nextFollowUpAt ? String(open.nextFollowUpAt).slice(0, 10) : ''} onChange={(e) => change(open.id, { nextFollowUpAt: e.target.value || null })} />
          </label>
          <label className="mt-3 block text-xs text-gray-600">{t('Notes')}
            <textarea className="mt-1 block w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" rows={2} maxLength={500} value={open.note || ''} onChange={(e) => setOpen({ ...open, note: e.target.value })} onBlur={() => change(open.id, { note: open.note || '' })} />
          </label>
          <button type="button" onClick={() => remove(open.id)} className="mt-3 text-xs text-red-600 hover:underline">{t('Delete this lead')}</button>
        </div>
      ) : null}
    </div>
  );
};

export default Leads;
