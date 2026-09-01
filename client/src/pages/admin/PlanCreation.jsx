import { useEffect, useState } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore, Layers } from 'lucide-react';
import apiClient from '../../api/client';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import PlanCard, { planCardColor } from '../../components/ui/PlanCard';

const emptyForm = {
  name: '',
  durationDays: '',
  price: '',
  includedServices: '',
  trialEligible: false,
  autoRenew: false,
  allowFreeze: false,
  maxFreezeDays: '',
};

const PlanCreation = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/plan-creation');
      setPlans(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (plan) => {
    setEditingId(plan._id);
    setForm({
      name: plan.name,
      durationDays: plan.durationDays,
      price: plan.price,
      includedServices: (plan.includedServices || []).join(', '),
      trialEligible: plan.trialEligible,
      autoRenew: plan.autoRenew,
      allowFreeze: plan.allowFreeze,
      maxFreezeDays: plan.maxFreezeDays ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        durationDays: Number(form.durationDays),
        price: Number(form.price),
        includedServices: form.includedServices
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        trialEligible: form.trialEligible,
        autoRenew: form.autoRenew,
        allowFreeze: form.allowFreeze,
        maxFreezeDays: form.maxFreezeDays === '' ? 0 : Number(form.maxFreezeDays),
      };

      if (editingId) {
        await apiClient.put(`/admin/plan-creation/${editingId}`, payload);
      } else {
        await apiClient.post('/admin/plan-creation', payload);
      }

      setModalOpen(false);
      await fetchPlans();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (plan) => {
    try {
      await apiClient.patch(`/admin/plan-creation/${plan._id}/toggle`);
      await fetchPlans();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update plan');
    }
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plan Creation</h1>
          <p className="mt-1.5 text-gray-500 max-w-2xl">
            The membership plans you sell to your own members — Monthly, Quarterly, Annual, PT add-ons, and so on.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] text-white text-sm font-semibold hover:brightness-110 transition-all flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
          New Plan
        </button>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-gray-400">
          <Layers className="h-6 w-6" />
          <p className="text-sm">No membership plans yet. Create one so members can subscribe.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-1">
          {plans.map((plan, index) => (
            <PlanCard
              key={plan._id}
              color={planCardColor(index)}
              title={plan.name}
              statusLabel={plan.isActive ? 'Active' : 'Inactive'}
              statusActive={plan.isActive}
              dimmed={!plan.isActive}
              price={`₹${plan.price}`}
              priceSuffix={` / ${plan.durationDays}d`}
              metaBadges={[
                plan.trialEligible && <Badge key="trial" tone="violet">Trial eligible</Badge>,
                plan.autoRenew && <Badge key="renew" tone="blue">Auto-renew</Badge>,
                plan.allowFreeze && <Badge key="freeze" tone="amber">Freeze up to {plan.maxFreezeDays}d</Badge>,
              ].filter(Boolean)}
              lines={plan.includedServices || []}
              actions={[
                { label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(plan) },
                {
                  label: plan.isActive ? 'Deactivate' : 'Activate',
                  icon: plan.isActive ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />,
                  onClick: () => handleToggle(plan),
                },
              ]}
            />
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Plan' : 'New Membership Plan'}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              form="gym-plan-form"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Plan'}
            </button>
          </>
        }
      >
        <form id="gym-plan-form" onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Quarterly Gold" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days)</label>
              <input required type="number" min="1" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
              <input required type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Included Services (comma separated)</label>
            <textarea rows={2} value={form.includedServices} onChange={(e) => setForm({ ...form, includedServices: e.target.value })} placeholder="Gym Access, Personal Training, Diet Plan" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>

          <div className="flex flex-wrap gap-5 pt-1">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.trialEligible} onChange={(e) => setForm({ ...form, trialEligible: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
              Trial eligible
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.autoRenew} onChange={(e) => setForm({ ...form, autoRenew: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
              Auto-renew
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.allowFreeze} onChange={(e) => setForm({ ...form, allowFreeze: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
              Allow freeze
            </label>
          </div>

          {form.allowFreeze && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Freeze Days</label>
              <input type="number" min="0" value={form.maxFreezeDays} onChange={(e) => setForm({ ...form, maxFreezeDays: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
};

export default PlanCreation;
