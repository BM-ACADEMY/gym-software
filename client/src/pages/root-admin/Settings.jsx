import { useState, useEffect } from 'react';
import { CreditCard, Palette, Save, ScrollText, User } from 'lucide-react';
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

      <button
        onClick={onToggle}
        disabled={loading}
        className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${isLive ? 'bg-green-500' : 'bg-gray-300'} ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
        role="switch"
        aria-checked={isLive}
      >
        <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isLive ? 'translate-x-7' : 'translate-x-0'}`} />
      </button>
    </div>
  );
};

const SectionCard = ({ icon: Icon, title, description, children, onSave, saving }) => (
  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
    <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-6 py-4">
      <Icon className="h-4 w-4 text-teal-600" />
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">{title}</h2>
        {description && <p className="text-xs text-gray-400">{description}</p>}
      </div>
    </div>
    <div className="space-y-4 p-6">{children}</div>
    {onSave && (
      <div className="flex justify-end border-t border-gray-100 px-6 py-4">
        <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    )}
  </div>
);

const Input = ({ label, ...props }) => (
  <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
    <input {...props} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500" />
  </label>
);

const NOTIFICATION_TYPES = [
  ['plan_expiring', 'Plan expiring soon', '{{name}}, {{days}}'],
  ['plan_expired', 'Plan expired', '{{name}}'],
  ['payment_overdue', 'Payment overdue (member)', '{{name}}, {{balance}}'],
  ['payment_overdue_summary', 'Payment overdue (gym owner)', '{{count}}, {{total}}'],
  ['pt_session_reminder', 'PT session reminder (member)', '{{name}}, {{time}}'],
  ['pt_session_reminder_staff', 'PT session reminder (trainer)', '{{memberName}}, {{time}}'],
];

const RootAdminSettings = () => {
  const [otpMode, setOtpMode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [toast, setToast] = useState(null);

  const [profile, setProfile] = useState(null);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [branding, setBranding] = useState(null);
  const [templates, setTemplates] = useState({});
  const [paymentGateway, setPaymentGateway] = useState(null);
  const [newSecret, setNewSecret] = useState('');
  const [savingSection, setSavingSection] = useState('');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const [otpRes, rootRes] = await Promise.all([
        apiClient.get('/settings'),
        apiClient.get('/root-admin/settings'),
      ]);
      setOtpMode(otpRes.data.data.otpMode);
      setProfile(rootRes.data.data.profile);
      setBranding(rootRes.data.data.branding);
      setTemplates(rootRes.data.data.notificationTemplates || {});
      setPaymentGateway(rootRes.data.data.paymentGateway);
    } catch {
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

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

  const saveProfile = async () => {
    setSavingSection('profile');
    try {
      const payload = { name: profile.name, email: profile.email, phone: profile.phone, ...passwords };
      const res = await apiClient.put('/root-admin/settings/profile', payload);
      setProfile((p) => ({ ...p, ...res.data.data }));
      setPasswords({ currentPassword: '', newPassword: '' });
      showToast('Profile saved');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save profile', 'error');
    } finally {
      setSavingSection('');
    }
  };

  const saveBranding = async () => {
    setSavingSection('branding');
    try {
      const res = await apiClient.put('/root-admin/settings/branding', branding);
      setBranding(res.data.data);
      showToast('Branding saved');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save branding', 'error');
    } finally {
      setSavingSection('');
    }
  };

  const saveTemplates = async () => {
    setSavingSection('templates');
    try {
      await apiClient.put('/root-admin/settings/notification-templates', { templates });
      showToast('Notification templates saved');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save templates', 'error');
    } finally {
      setSavingSection('');
    }
  };

  const savePaymentGateway = async () => {
    setSavingSection('gateway');
    try {
      const payload = { provider: paymentGateway.provider, keyId: paymentGateway.keyId };
      if (newSecret) payload.keySecret = newSecret;
      const res = await apiClient.put('/root-admin/settings/payment-gateway', payload);
      setPaymentGateway((pg) => ({ ...pg, ...res.data.data }));
      setNewSecret('');
      showToast('Payment gateway settings saved');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save payment gateway', 'error');
    } finally {
      setSavingSection('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="mt-1 text-gray-500">Your account, platform branding, notification templates, and payment gateway.</p>
        </div>

        {toast && (
          <div className={`px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {toast.msg}
          </div>
        )}

        {loading || !profile ? (
          <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" /></div>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">OTP Configuration</h2>
              </div>
              <div className="space-y-4 p-6">
                <OtpModeToggle currentMode={otpMode} onToggle={handleToggleMode} loading={toggling} />
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-xs leading-relaxed text-blue-700">
                  <strong>Demo Mode:</strong> OTP codes are returned in the API response and displayed as a browser alert — perfect for testing without spending SMS credits.<br /><br />
                  <strong>Live Mode:</strong> OTP codes are sent via the BulkSMS API to the real phone number. Make sure your <code className="rounded bg-blue-100 px-1 font-mono">BULKSMS_API_URL</code> is configured in the server <code className="rounded bg-blue-100 px-1 font-mono">.env</code> file.
                </div>
              </div>
            </div>

            <SectionCard icon={User} title="Your account" onSave={saveProfile} saving={savingSection === 'profile'}>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Name" value={profile.name || ''} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                <Input label="Email" type="email" value={profile.email || ''} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
              </div>
              <Input label="Phone" value={profile.phone || ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
              <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                <Input label="Current password" type="password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} placeholder="To change password" />
                <Input label="New password" type="password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} />
              </div>
            </SectionCard>

            <SectionCard icon={Palette} title="Platform branding" description="Shown across the SaaS site" onSave={saveBranding} saving={savingSection === 'branding'}>
              <Input label="Platform name" value={branding.platformName || ''} onChange={(e) => setBranding({ ...branding, platformName: e.target.value })} />
              <Input label="Logo URL" value={branding.logoUrl || ''} onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })} placeholder="https://..." />
              <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Primary color</span>
                <div className="flex items-center gap-2">
                  <input type="color" value={branding.primaryColor || '#0d9488'} onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })} className="h-10 w-14 rounded-lg border border-gray-200" />
                  <span className="text-sm text-gray-500">{branding.primaryColor}</span>
                </div>
              </label>
            </SectionCard>

            <SectionCard icon={ScrollText} title="Notification templates" description="Overrides the built-in message for each auto-notification type — leave blank to use the default" onSave={saveTemplates} saving={savingSection === 'templates'}>
              {NOTIFICATION_TYPES.map(([type, label, vars]) => (
                <label key={type} className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
                  <textarea rows={2} value={templates[type] || ''} onChange={(e) => setTemplates({ ...templates, [type]: e.target.value })} placeholder={`Use ${vars} — default used if blank`} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500" />
                </label>
              ))}
            </SectionCard>

            <SectionCard icon={CreditCard} title="Payment gateway" description="Keys are stored, never displayed again — only whether one is set" onSave={savePaymentGateway} saving={savingSection === 'gateway'}>
              <div className="grid grid-cols-2 gap-4">
                <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Provider</span>
                  <select value={paymentGateway.provider || ''} onChange={(e) => setPaymentGateway({ ...paymentGateway, provider: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm">
                    <option value="">Not configured</option>
                    <option value="razorpay">Razorpay</option>
                    <option value="stripe">Stripe</option>
                  </select>
                </label>
                <Input label="Key ID" value={paymentGateway.keyId || ''} onChange={(e) => setPaymentGateway({ ...paymentGateway, keyId: e.target.value })} />
              </div>
              <Input label={`Key secret ${paymentGateway.hasSecret ? `(currently ${paymentGateway.keySecretMasked})` : ''}`} type="password" value={newSecret} onChange={(e) => setNewSecret(e.target.value)} placeholder={paymentGateway.hasSecret ? 'Leave blank to keep current secret' : 'Enter secret key'} />
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
};

export default RootAdminSettings;
