import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Lock, Mail, MessageCircle, MessageSquare, UserRound } from 'lucide-react';
import { selectCurrentUser } from '../../store/slices/authSlice';
import { Button, Card, CardTitle, Field, Page, PageHeader } from './ui';
import apiClient from '../../api/client';
import useSuspended from '../../hooks/useSuspended';

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-teal-600' : 'bg-gray-200'}`}
  >
    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-5' : 'left-0.5'}`} />
  </button>
);

const Settings = () => {
  const user = useSelector(selectCurrentUser);
  const suspended = useSuspended();
  const [profile, setProfile] = useState(null);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    apiClient.get('/subadmin/settings')
      .then((res) => setProfile(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load profile'));
  }, []);

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const saveProfile = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await apiClient.put('/subadmin/settings/profile', { name: profile.name, email: profile.email, phone: profile.phone, availability: profile.availability });
      setProfile((p) => ({ ...p, ...res.data.data }));
      flash('Profile saved');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const saveNotificationPreference = async (channel, value) => {
    const previous = profile.notificationPreferences;
    setProfile((p) => ({ ...p, notificationPreferences: { ...p.notificationPreferences, [channel]: value } }));
    try {
      const res = await apiClient.put('/subadmin/settings/profile', { notificationPreferences: { [channel]: value } });
      setProfile((p) => ({ ...p, ...res.data.data }));
      flash('Notification preferences saved');
    } catch (err) {
      setProfile((p) => ({ ...p, notificationPreferences: previous }));
      setError(err.response?.data?.message || 'Failed to update notification preferences');
    }
  };

  const changePassword = async () => {
    if (!passwords.currentPassword || !passwords.newPassword) return;
    setChangingPassword(true);
    setError('');
    try {
      await apiClient.put('/subadmin/settings/profile', passwords);
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
      <PageHeader title="My settings" description="Manage your contact info, availability and password." />
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      <Card>
        <CardTitle title="Profile information" description="Visible to your gym owner" />
        <div className="space-y-5 p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-100 text-xl font-bold text-teal-700">
              {(user?.name || 'S').split(' ').map((x) => x[0]).join('').slice(0, 2)}
            </div>
            <p className="text-sm text-gray-500">Template: <span className="font-medium capitalize text-gray-700">{profile.template}</span></p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" value={profile.name || ''} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            <Field label="Phone number" value={profile.phone || ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            <Field label="Email address" type="email" value={profile.email || ''} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            <Field label="Availability" value={profile.availability || ''} onChange={(e) => setProfile({ ...profile, availability: e.target.value })} placeholder="e.g. Mon-Sat 6am-9pm" />
          </div>
          <Button onClick={saveProfile} disabled={saving || suspended}><UserRound className="h-4 w-4" />{saving ? 'Saving...' : 'Save profile'}</Button>
        </div>
      </Card>

      <Card>
        <CardTitle title="Notification preferences" description="How you'd like to hear about assigned sessions and members." />
        <div className="divide-y divide-gray-100 p-5">
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="flex items-center gap-3 text-sm text-gray-700"><MessageSquare className="h-4 w-4 text-gray-400" />SMS notifications</span>
            <Toggle checked={profile.notificationPreferences?.sms !== false} onChange={(v) => saveNotificationPreference('sms', v)} disabled={suspended} />
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="flex items-center gap-3 text-sm text-gray-700"><Mail className="h-4 w-4 text-gray-400" />Email notifications</span>
            <Toggle checked={profile.notificationPreferences?.email !== false} onChange={(v) => saveNotificationPreference('email', v)} disabled={suspended} />
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="flex items-center gap-3 text-sm text-gray-700"><MessageCircle className="h-4 w-4 text-gray-400" />WhatsApp notifications</span>
            <Toggle checked={profile.notificationPreferences?.whatsapp === true} onChange={(v) => saveNotificationPreference('whatsapp', v)} disabled={suspended} />
          </div>
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
    </Page>
  );
};
export default Settings;
