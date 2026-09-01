import React, { useState, useEffect } from 'react';
import { Ticket, Plus, Trash2, Edit2, Activity, RefreshCw } from 'lucide-react';
import apiClient from '../../api/client';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';

const Coupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [analytics, setAnalytics] = useState({ totalCoupons: 0, activeCoupons: 0, totalRedemptions: 0 });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: '',
    expiresAt: '',
    usageLimit: '',
    isActive: true,
  });
  const [editingId, setEditingId] = useState(null);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/root-admin/coupons');
      setCoupons(res.data.data.coupons);
      setAnalytics(res.data.data.analytics);
    } catch (error) {
      console.error('Error fetching coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const openModal = (coupon = null) => {
    if (coupon) {
      setFormData({
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().split('T')[0] : '',
        usageLimit: coupon.usageLimit || '',
        isActive: coupon.isActive,
      });
      setEditingId(coupon._id);
    } else {
      setFormData({
        code: '',
        discountType: 'percentage',
        discountValue: '',
        expiresAt: '',
        usageLimit: '',
        isActive: true,
      });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
      };

      if (editingId) {
        await apiClient.put(`/root-admin/coupons/${editingId}`, payload);
      } else {
        await apiClient.post('/root-admin/coupons', payload);
      }
      setIsModalOpen(false);
      fetchCoupons();
    } catch (error) {
      console.error('Error saving coupon:', error);
      alert(error.response?.data?.message || 'Error saving coupon');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this coupon?')) {
      try {
        await apiClient.delete(`/root-admin/coupons/${id}`);
        fetchCoupons();
      } catch (error) {
        console.error('Error deleting coupon:', error);
      }
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await apiClient.patch(`/root-admin/coupons/${id}/toggle`);
      fetchCoupons();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coupons & Analytics</h1>
          <p className="text-sm text-gray-500">Manage discount codes and view usage analytics.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-dark transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Coupon
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-blue-50 p-3">
              <Ticket className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Coupons</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.totalCoupons}</p>
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-green-50 p-3">
              <Activity className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Active Coupons</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.activeCoupons}</p>
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-purple-50 p-3">
              <RefreshCw className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Redemptions</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.totalRedemptions}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="bg-gray-50 text-xs uppercase text-gray-700">
              <tr>
                <th className="px-6 py-4 font-medium">Code</th>
                <th className="px-6 py-4 font-medium">Discount</th>
                <th className="px-6 py-4 font-medium">Usage</th>
                <th className="px-6 py-4 font-medium">Expires</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    No coupons found. Create one to get started.
                  </td>
                </tr>
              ) : (
                coupons.map((coupon) => (
                  <tr key={coupon._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {coupon.code}
                    </td>
                    <td className="px-6 py-4">
                      {coupon.discountType === 'percentage'
                        ? `${coupon.discountValue}%`
                        : `$${coupon.discountValue}`}
                    </td>
                    <td className="px-6 py-4">
                      {coupon.usedCount} {coupon.usageLimit ? `/ ${coupon.usageLimit}` : ''}
                    </td>
                    <td className="px-6 py-4">
                      {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleStatus(coupon._id)}
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                          coupon.isActive
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {coupon.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openModal(coupon)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(coupon._id)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Coupon' : 'Create Coupon'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Coupon Code</label>
            <input
              type="text"
              name="code"
              required
              value={formData.code}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary uppercase"
              placeholder="e.g. SUMMER2024"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
              <select
                name="discountType"
                value={formData.discountType}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat Amount ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount Value</label>
              <input
                type="number"
                name="discountValue"
                required
                min="0"
                step="0.01"
                value={formData.discountValue}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={formData.discountType === 'percentage' ? 'e.g. 20' : 'e.g. 50'}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date (Optional)</label>
              <input
                type="date"
                name="expiresAt"
                value={formData.expiresAt}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usage Limit (Optional)</label>
              <input
                type="number"
                name="usageLimit"
                min="1"
                value={formData.usageLimit}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="e.g. 100"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              checked={formData.isActive}
              onChange={handleInputChange}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">
              Active immediately
            </label>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors"
            >
              {editingId ? 'Update Coupon' : 'Create Coupon'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Coupons;
