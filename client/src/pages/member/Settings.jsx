import { useEffect, useState } from 'react';
import { Lock, UserRound } from 'lucide-react';
import { Button, Card, CardTitle, Field, Page, PageHeader } from '../subadmin/ui';
import apiClient from '../../api/client';
import useSuspended from '../../hooks/useSuspended';

const Settings = () => {
  const suspended = useSuspended();
  const [profile, setProfile] = useState(null);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    apiClient.get('/member/settings')
      .then((res) => setProfile(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load settings'));
  }, []);

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const saveProfile = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await apiClient.put('/member/settings', { name: profile.name, email: profile.email, phone: profile.phone });
      setProfile((p) => ({ ...p, ...res.data.data }));
      flash('Profile saved');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const togglePref = async (key) => {
    const next = { ...profile.notificationPreferences, [key]: !profile.notificationPreferences?.[key] };
    setProfile((p) => ({ ...p, notificationPreferences: next }));
    try {
      await apiClient.put('/member/settings', { notificationPreferences: next });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update preferences');
    }
  };

  const changePassword = async () => {
    if (!passwords.currentPassword || !passwords.newPassword) return;
    setChangingPassword(true);
    setError('');
    try {
      await apiClient.put('/member/settings', passwords);
      setPasswords({ currentPassword: '', newPassword: '' });
      flash('Password changed');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (!profile) {
    return <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" /></div>;
  }

  return (
    <Page>
      <PageHeader eyebrow="Customer workspace" title="Settings" description="Profile, notification preferences, and password." />
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      <Card>
        <CardTitle title="Profile" />
        <div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" value={profile.name || ''} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            <Field label="Phone" value={profile.phone || ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            <Field label="Email" type="email" value={profile.email || ''} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
          </div>
          <Button onClick={saveProfile} disabled={saving || suspended}><UserRound className="h-4 w-4" />{saving ? 'Saving...' : 'Save profile'}</Button>
        </div>
      </Card>

      <Card>
        <CardTitle title="Notification preferences" />
        <div className="divide-y divide-gray-100 px-5">
          {[['sms', 'SMS reminders', 'Plan expiry, payment, and session alerts by text'], ['email', 'Email reminders', 'Same alerts sent to your email']].map(([key, label, text]) => (
            <div key={key} className="flex items-center justify-between gap-4 py-3">
              <div><p className="text-sm font-semibold">{label}</p><p className="text-xs text-gray-500">{text}</p></div>
              <button onClick={() => togglePref(key)} disabled={suspended} className={`relative h-6 w-11 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${profile.notificationPreferences?.[key] !== false ? 'bg-teal-600' : 'bg-gray-200'}`}>
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${profile.notificationPreferences?.[key] !== false ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle title="Change password" />
        <div className="space-y-4 p-5">
          <Field label="Current password" type="password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} />
          <Field label="New password" type="password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} />
          <Button onClick={changePassword} disabled={changingPassword || suspended} variant="secondary"><Lock className="h-4 w-4" />{changingPassword ? 'Updating...' : 'Update password'}</Button>
        </div>
      </Card>

      <p className="text-xs text-gray-400">Linked payment methods will appear here once online payment gateway integration is built (a later task) — for now, use Pay Online on the Payments page.</p>
    </Page>
  );
};

export default Settings;
