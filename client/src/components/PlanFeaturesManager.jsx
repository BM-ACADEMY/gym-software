import { useState } from 'react';
import { Plus, Archive, ArchiveRestore, ToggleLeft, Hash } from 'lucide-react';
import apiClient from '../api/client';
import Modal from './ui/Modal';
import Badge from './ui/Badge';

const emptyForm = { name: '', type: 'toggle', unit: '' };

// The catalog Root Admin manages so plan features aren't free text — each one
// is either a plain on/off toggle or a numeric allowance (with a unit label).
// Plan Creation reads this catalog to render the toggle/count rows per plan.
const PlanFeaturesManager = ({ open, onClose, features, onChange }) => {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await apiClient.post('/root-admin/plan-features', {
        name: form.name,
        type: form.type,
        unit: form.type === 'count' ? form.unit : undefined,
      });
      setForm(emptyForm);
      await onChange();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add feature');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleArchive = async (feature) => {
    try {
      await apiClient.patch(`/root-admin/plan-features/${feature._id}/toggle`);
      await onChange();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update feature');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Manage Plan Features" maxWidth="max-w-xl">
      <div className="space-y-6">
        {error && (
          <div className="px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">{error}</div>
        )}

        <form onSubmit={handleAdd} className="space-y-3 border border-gray-100 rounded-xl p-4 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add a feature</p>
          <div className="flex gap-3">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. AI Plan Generations"
              className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            />
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            >
              <option value="toggle">Toggle (on/off)</option>
              <option value="count">Count (numeric)</option>
            </select>
          </div>
          {form.type === 'count' && (
            <input
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="Unit label, e.g. /month or sessions"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            />
          )}
          <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-60">
            <Plus className="h-4 w-4" />
            {saving ? 'Adding...' : 'Add Feature'}
          </button>
        </form>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Catalog</p>
          {features.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No features yet — add one above.</p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
              {features.map((f) => (
                <li key={f._id} className={`flex items-center justify-between px-4 py-3 ${!f.isActive ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    {f.type === 'count' ? <Hash className="h-4 w-4 text-teal-500" /> : <ToggleLeft className="h-4 w-4 text-teal-500" />}
                    <div>
                      <p className="text-sm font-medium text-gray-800">{f.name}</p>
                      <p className="text-xs text-gray-400">{f.type === 'count' ? `Count${f.unit ? ` · ${f.unit}` : ''}` : 'Toggle'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={f.isActive ? 'green' : 'gray'}>{f.isActive ? 'Active' : 'Archived'}</Badge>
                    <button
                      onClick={() => handleToggleArchive(f)}
                      title={f.isActive ? 'Archive' : 'Restore'}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                    >
                      {f.isActive ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default PlanFeaturesManager;
