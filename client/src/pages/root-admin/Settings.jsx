import { useState, useEffect } from 'react';
import apiClient from '../../api/client';

const OtpModeToggle = ({ currentMode, onToggle, loading }) => {
  const isLive = currentMode === 'live';
  return (
    <div className="flex items-center justify-between p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-start gap-4">
        <div className={`mt-1 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isLive ? 'bg-green-100' : 'bg-amber-100'}`}>
          {isLive ? (
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
            </svg>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-800">OTP Delivery Mode</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isLive ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {isLive ? 'LIVE' : 'DEMO'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {isLive
              ? 'OTPs are sent via real SMS & Email. BulkSMS API is active.'
              : 'OTPs are shown in the UI popup. No real SMS or Email is sent.'}
          </p>
        </div>
      </div>

      {/* Toggle Switch */}
      <button
        onClick={onToggle}
        disabled={loading}
        className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:ring-offset-2 ${isLive ? 'bg-green-500' : 'bg-gray-300'} ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
        role="switch"
        aria-checked={isLive}
      >
        <span
          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isLive ? 'translate-x-7' : 'translate-x-0'}`}
        />
      </button>
    </div>
  );
};

const RootAdminSettings = () => {
  const [otpMode, setOtpMode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/settings');
      setOtpMode(res.data.data.otpMode);
    } catch {
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMode = async () => {
    const newMode = otpMode === 'demo' ? 'live' : 'demo';
    setToggling(true);
    try {
      const res = await apiClient.put('/settings/otp-mode', { mode: newMode });
      if (res.data.success) {
        setOtpMode(newMode);
        showToast(`OTP mode switched to "${newMode.toUpperCase()}"`, 'success');
      }
    } catch {
      showToast('Failed to update OTP mode', 'error');
    } finally {
      setToggling(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-500 mt-1">Manage platform-wide configuration for GymDesk.</p>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {toast.type === 'success' ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            )}
            {toast.msg}
          </div>
        )}

        {/* Settings Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">OTP Configuration</h2>
          </div>
          <div className="p-6 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fuchsia-600"></div>
              </div>
            ) : (
              <>
                <OtpModeToggle
                  currentMode={otpMode}
                  onToggle={handleToggleMode}
                  loading={toggling}
                />
                <div className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700 leading-relaxed">
                  <strong>Demo Mode:</strong> OTP codes are returned in the API response and displayed as a browser alert — perfect for testing without spending SMS credits.<br /><br />
                  <strong>Live Mode:</strong> OTP codes are sent via the BulkSMS API to the real phone number. Make sure your <code className="font-mono bg-blue-100 px-1 rounded">BULKSMS_API_URL</code> is configured in the server <code className="font-mono bg-blue-100 px-1 rounded">.env</code> file.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RootAdminSettings;
