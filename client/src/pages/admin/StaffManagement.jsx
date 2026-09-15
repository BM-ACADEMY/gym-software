import { useEffect, useState } from 'react';
import { Plus, Power, ScrollText, UserCog } from 'lucide-react';
import apiClient from '../../api/client';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import PermissionMatrix from '../../components/PermissionMatrix';
import { SUBADMIN_TEMPLATES } from '../../config/navigation';
import useSuspended from '../../hooks/useSuspended';

const emptyForm = { name: '', phone: '', email: '', password: '', template: 'custom', permissions: {} };

const StaffManagement = () => {
  const suspended = useSuspended();
  const [staff, setStaff] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [staffRes, auditRes] = await Promise.all([
        apiClient.get('/admin/subadmins'),
        apiClient.get('/admin/subadmins/audit-log'),
      ]);
      setStaff(staffRes.data.data);
      setAuditLog(auditRes.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (member) => {
    setEditingId(member._id);
    setForm({ name: member.name, phone: member.phone || '', email: member.email || '', password: '', template: member.template, permissions: member.permissions || {} });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { name: form.name, phone: form.phone || undefined, email: form.email || undefined, template: form.template, permissions: form.permissions };
      if (form.password) payload.password = form.password;

      if (editingId) {
        await apiClient.put(`/admin/subadmins/${editingId}`, payload);
      } else {
        if (!form.password) {
          setError('Set an initial password for this staff login');
          setSaving(false);
          return;
        }
        await apiClient.post('/admin/subadmins', payload);
      }
      setModalOpen(false);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save staff member');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (member) => {
    try {
      await apiClient.patch(`/admin/subadmins/${member._id}/toggle`);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update staff member');
    }
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sub-Admin / Staff Management</h1>
          <p className="mt-1.5 max-w-2xl text-gray-500">Create staff logins and control exactly which modules each one can see or edit.</p>
        </div>
        <button onClick={openCreate} disabled={suspended} className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
          <Plus className="h-4 w-4" /> Add staff
        </button>
      </div>

      {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" /></div>
      ) : staff.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-gray-400">
          <UserCog className="h-6 w-6" /><p className="text-sm">No staff logins yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Contact</th><th className="px-5 py-3">Template</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.map((s) => (
                <tr key={s._id} className={!s.isActive ? 'opacity-60' : ''}>
                  <td className="px-5 py-4"><button onClick={() => openEdit(s)} className="font-semibold text-gray-900 hover:text-teal-700">{s.name}</button></td>
                  <td className="px-5 py-4 text-gray-600">{s.phone || s.email || '—'}</td>
                  <td className="px-5 py-4"><Badge tone="blue">{SUBADMIN_TEMPLATES[s.template]?.label || s.template}</Badge></td>
                  <td className="px-5 py-4"><Badge tone={s.isActive ? 'green' : 'gray'}>{s.isActive ? 'Active' : 'Deactivated'}</Badge></td>
                  <td className="px-5 py-4">
                    <button onClick={() => handleToggle(s)} disabled={suspended} title={s.isActive ? 'Deactivate' : 'Reactivate'} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40">
                      <Power className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700"><ScrollText className="h-4 w-4" />Audit log</div>
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr><th className="px-5 py-3">When</th><th className="px-5 py-3">Who</th><th className="px-5 py-3">Module</th><th className="px-5 py-3">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditLog.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">No activity recorded yet.</td></tr>
                ) : auditLog.map((entry) => (
                  <tr key={entry._id}>
                    <td className="px-5 py-3 text-gray-600">{new Date(entry.timestamp).toLocaleString()}</td>
                    <td className="px-5 py-3 text-gray-900">{entry.actingUserName} <span className="text-xs text-gray-400">({entry.actingRole})</span></td>
                    <td className="px-5 py-3 capitalize text-gray-600">{entry.module}</td>
                    <td className="px-5 py-3 capitalize text-gray-600">{entry.action.replace(/_/g, ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit staff member' : 'Add staff member'}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" form="staff-form" disabled={saving || suspended} className="rounded-xl bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <form id="staff-form" onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{editingId ? 'Reset password (optional)' : 'Set initial password'}</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editingId ? 'Leave blank to keep current password' : ''} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            {!editingId && <p className="mt-1 text-xs text-gray-400">Share this with them directly for now — invite emails are on the roadmap.</p>}
          </div>
          <PermissionMatrix
            template={form.template}
            permissions={form.permissions}
            onTemplateChange={(template) => setForm((f) => ({ ...f, template }))}
            onPermissionsChange={(permissions) => setForm((f) => ({ ...f, permissions }))}
          />
        </form>
      </Modal>
    </div>
  );
};

export default StaffManagement;
