import { useEffect, useState } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore, Layers, Settings2 } from 'lucide-react';
import apiClient from '../../api/client';
import Modal from '../../components/ui/Modal';
import PlanCard, { planCardColor } from '../../components/ui/PlanCard';
import PlanFeaturesManager from '../../components/PlanFeaturesManager';

const emptyForm = { name: '', price: '', memberLimit: '', staffLimit: '', trialDays: '', features: {} };

const PlanCreation = () => {
  const [plans, setPlans] = useState([]);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [featuresModalOpen, setFeaturesModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [plansRes, featuresRes] = await Promise.all([
        apiClient.get('/root-admin/plan-creation'),
        apiClient.get('/root-admin/plan-features'),
      ]);
      setPlans(plansRes.data.data);
      setFeatures(featuresRes.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeatures = async () => {
    const res = await apiClient.get('/root-admin/plan-features');
    setFeatures(res.data.data);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (plan) => {
    const featureState = {};
    for (const f of plan.features || []) {
      if (!f.feature) continue;
      featureState[f.feature._id] = { enabled: f.enabled, value: f.value ?? '' };
    }
    setEditingId(plan._id);
    setForm({
      name: plan.name,
      price: plan.price,
      memberLimit: plan.memberLimit ?? '',
      staffLimit: plan.staffLimit ?? '',
      trialDays: plan.trialDays ?? '',
      features: featureState,
    });
    setModalOpen(true);
  };

  const toggleFormFeature = (featureId, checked) => {
    setForm((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [featureId]: { ...(prev.features[featureId] || {}), enabled: checked },
      },
    }));
  };

  const setFormFeatureValue = (featureId, value) => {
    setForm((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [featureId]: { ...(prev.features[featureId] || {}), value },
      },
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        price: Number(form.price),
        memberLimit: form.memberLimit === '' ? '' : Number(form.memberLimit),
        staffLimit: form.staffLimit === '' ? '' : Number(form.staffLimit),
        trialDays: form.trialDays === '' ? 0 : Number(form.trialDays),
        features: Object.entries(form.features)
          .filter(([, state]) => state.enabled)
          .map(([featureId, state]) => ({
            feature: featureId,
            enabled: true,
            value: state.value === '' || state.value === undefined ? undefined : Number(state.value),
          })),
      };

      if (editingId) {
        await apiClient.put(`/root-admin/plan-creation/${editingId}`, payload);
      } else {
        await apiClient.post('/root-admin/plan-creation', payload);
      }

      setModalOpen(false);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (plan) => {
    try {
      await apiClient.patch(`/root-admin/plan-creation/${plan._id}/toggle`);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update plan');
    }
  };

  const activeFeatures = features.filter((f) => f.isActive);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plan Creation (Platform)</h1>
          <p className="mt-1.5 text-gray-500 max-w-2xl">
            GymDesk's own SaaS pricing tiers — what gates member/staff limits and features for every subscriber gym.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setFeaturesModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            <Settings2 className="h-4 w-4" />
            Manage Features
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] text-white text-sm font-semibold hover:brightness-110 transition-all"
          >
            <Plus className="h-4 w-4" />
            New Plan
          </button>
        </div>
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
          <p className="text-sm">No platform plans yet. Create your first one to start gating features.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-1">
          {plans.map((plan, index) => {
            const enabledFeatures = (plan.features || []).filter((f) => f.enabled && f.feature);
            const lines = [
              `Members: ${plan.memberLimit ? plan.memberLimit : 'Unlimited'}`,
              `Sub-Admins: ${plan.staffLimit ? plan.staffLimit : 'Unlimited'}`,
              plan.trialDays ? `Trial: ${plan.trialDays} days` : null,
              ...enabledFeatures.map((f) =>
                f.feature.type === 'count'
                  ? `${f.feature.name}: ${f.value !== undefined && f.value !== null ? f.value : 'Unlimited'}${f.feature.unit ? ` ${f.feature.unit}` : ''}`
                  : f.feature.name
              ),
            ].filter(Boolean);

            return (
              <PlanCard
                key={plan._id}
                color={planCardColor(index)}
                title={plan.name}
                statusLabel={plan.isActive ? 'Active' : 'Archived'}
                statusActive={plan.isActive}
                dimmed={!plan.isActive}
                price={`₹${plan.price}`}
                priceSuffix=" /mo"
                lines={lines}
                actions={[
                  { label: 'Edit', icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(plan) },
                  {
                    label: plan.isActive ? 'Archive' : 'Restore',
                    icon: plan.isActive ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />,
                    onClick: () => handleToggle(plan),
                  },
                ]}
              />
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Plan' : 'New Platform Plan'}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              form="plan-form"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Plan'}
            </button>
          </>
        }
      >
        <form id="plan-form" onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Growth" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹/mo)</label>
              <input required type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trial Days</label>
              <input type="number" min="0" value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Member Limit</label>
              <input type="number" min="0" value={form.memberLimit} onChange={(e) => setForm({ ...form, memberLimit: e.target.value })} placeholder="Blank = unlimited" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sub-Admin Limit</label>
              <input type="number" min="0" value={form.staffLimit} onChange={(e) => setForm({ ...form, staffLimit: e.target.value })} placeholder="Blank = unlimited" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">Features</label>
              <button type="button" onClick={() => setFeaturesModalOpen(true)} className="text-xs font-semibold text-teal-600 hover:text-teal-700">
                + Add a new feature
              </button>
            </div>
            {activeFeatures.length === 0 ? (
              <p className="text-sm text-gray-400 py-3">No features in the catalog yet — add one first.</p>
            ) : (
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {activeFeatures.map((f) => {
                  const raw = form.features[f._id];
                  const state = { enabled: raw?.enabled ?? false, value: raw?.value ?? '' };
                  return (
                    <li key={f._id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <label className="flex items-center gap-2.5 text-sm text-gray-700 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(state.enabled)}
                          onChange={(e) => toggleFormFeature(f._id, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        {f.name}
                      </label>
                      {f.type === 'count' && state.enabled && (
                        <input
                          type="number"
                          min="0"
                          value={state.value}
                          onChange={(e) => setFormFeatureValue(f._id, e.target.value)}
                          placeholder={`Unlimited${f.unit ? ` (${f.unit})` : ''}`}
                          className="w-32 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </form>
      </Modal>

      <PlanFeaturesManager
        open={featuresModalOpen}
        onClose={() => setFeaturesModalOpen(false)}
        features={features}
        onChange={fetchFeatures}
      />
    </div>
  );
};

export default PlanCreation;
