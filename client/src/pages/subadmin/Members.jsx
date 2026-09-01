import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { SlidersHorizontal } from 'lucide-react';
import { Button, Card, Empty, Field, Modal, Page, PageHeader, Pill, SearchBox } from './ui';
import apiClient from '../../api/client';
import { selectPermissions } from '../../store/slices/authSlice';

const STATUS_TONE = { active: 'green', expiring: 'amber', expired: 'red', frozen: 'blue', trial: 'violet', cancelled: 'gray' };

const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

const emptyForm = { name: '', phone: '', goal: '', medicalNotes: '' };

const Members = () => {
  const permissions = useSelector(selectPermissions);
  const canEdit = Boolean(permissions?.members?.edit);

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/subadmin/members', { params: { search: query || undefined, status: status === 'All' ? undefined : status } });
      setMembers(res.data.data.members);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchMembers, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status]);

  const filtered = useMemo(() => members, [members]);

  const openMember = (m) => {
    setSelected(m);
    setEditing(false);
    setForm({ name: m.name || '', phone: m.phone || '', goal: m.goal || '', medicalNotes: m.medicalNotes || '' });
  };

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiClient.put(`/subadmin/members/${selected._id}`, form);
      setSelected(null);
      await fetchMembers();
    } catch {
      // Surfaced via the members list simply not updating; keep the modal open so they can retry.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <PageHeader
        title="My members"
        description="Members assigned to you — view their goals and medical notes, and update their progress details."
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchBox value={query} onChange={setQuery} placeholder="Search member name or phone..." />
        <label className="relative">
          <SlidersHorizontal className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-9 text-sm outline-none">
            <option>All</option>
            {['trial', 'active', 'expiring', 'expired', 'frozen', 'cancelled'].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
        </label>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-5 py-3">Member</th><th className="px-5 py-3">Goal & plan</th><th className="px-5 py-3">Expires</th><th className="px-5 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!loading && filtered.map((m) => (
                <tr key={m._id} className="hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">{initials(m.name)}</div>
                      <div>
                        <button onClick={() => openMember(m)} className="font-semibold text-gray-900 hover:text-teal-700">{m.name}</button>
                        <p className="text-xs text-gray-500">{m.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4"><p className="font-medium">{m.goal || '—'}</p><p className="text-xs text-gray-500">{m.planId?.name || 'No plan'}</p></td>
                  <td className="px-5 py-4 text-gray-600">{m.expiresAt ? new Date(m.expiresAt).toLocaleDateString() : '—'}</td>
                  <td className="px-5 py-4"><Pill tone={STATUS_TONE[m.effectiveStatus] || 'gray'}>{m.effectiveStatus}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="px-5 py-12 text-center text-sm text-gray-400">Loading...</div>}
          {!loading && !filtered.length && <Empty title="No members found" text="Try changing your search or status filter." />}
        </div>
      </Card>

      <Modal
        open={!!selected}
        title={selected?.name || ''}
        onClose={() => setSelected(null)}
        footer={canEdit ? (
          editing ? (
            <>
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={saveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button>
            </>
          ) : (
            <Button onClick={() => setEditing(true)}>Edit notes</Button>
          )
        ) : null}
      >
        {!editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-4 text-sm">
              <div><span className="text-gray-500">Goal</span><p className="font-semibold">{selected?.goal || '—'}</p></div>
              <div><span className="text-gray-500">Plan</span><p className="font-semibold">{selected?.planId?.name || 'No plan'}</p></div>
            </div>
            <div><span className="text-sm text-gray-500">Medical notes</span><p className="mt-1 text-sm text-gray-800">{selected?.medicalNotes || 'None on file'}</p></div>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Goal" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} />
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">Medical notes</span>
              <textarea value={form.medicalNotes} onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })} rows={3} className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
            </label>
          </div>
        )}
      </Modal>
    </Page>
  );
};
export default Members;
