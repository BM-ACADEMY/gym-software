import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CreditCard, LifeBuoy, MessageCircle, Plus, Save, Send, Trash2, UserCog } from 'lucide-react';
import apiClient from '../../api/client';
import { openRazorpayCheckout } from '../../utils/razorpay';
import { selectCurrentUser } from '../../store/slices/authSlice';
import useSuspended from '../../hooks/useSuspended';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TABS = [
  { key: 'general', label: 'General' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'billing', label: 'Billing' },
  { key: 'staff', label: 'Staff' },
  { key: 'support', label: 'Support' },
];

const SectionCard = ({ title, description, children, onSave, saving, disabled }) => (
  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
    <div className="border-b border-gray-100 px-5 py-4">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
    </div>
    <div className="space-y-4 p-5">{children}</div>
    {onSave && (
      <div className="flex justify-end border-t border-gray-100 px-5 py-4">
        <button onClick={onSave} disabled={saving || disabled} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
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

const Settings = () => {
  const user = useSelector(selectCurrentUser);
  const navigate = useNavigate();
  const suspended = useSuspended();
  const [tab, setTab] = useState('general');
  const [gym, setGym] = useState(null);
  const [profile, setProfile] = useState(null);
  const [newHoliday, setNewHoliday] = useState({ date: '', label: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingSection, setSavingSection] = useState('');
  const [tickets, setTickets] = useState([]);
  const [ticketForm, setTicketForm] = useState({ subject: '', description: '' });
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [payingInvoiceId, setPayingInvoiceId] = useState('');
  const [staff, setStaff] = useState([]);

  const fetchAll = async () => {
    try {
      const [settingsRes, ticketsRes, invoicesRes, staffRes] = await Promise.all([
        apiClient.get('/admin/settings'),
        apiClient.get('/admin/support'),
        apiClient.get('/admin/billing/invoices'),
        apiClient.get('/admin/subadmins'),
      ]);
      setGym(settingsRes.data.data.gym);
      setProfile(settingsRes.data.data.profile);
      setTickets(ticketsRes.data.data);
      setInvoices(invoicesRes.data.data);
      setStaff(staffRes.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load settings');
    }
  };

  const refreshInvoices = async () => {
    const res = await apiClient.get('/admin/billing/invoices');
    setInvoices(res.data.data);
  };

  const payInvoice = async (invoice) => {
    setPayingInvoiceId(invoice._id);
    setError('');
    try {
      const checkoutRes = await apiClient.post(`/admin/billing/invoices/${invoice._id}/checkout`, {});
      const order = checkoutRes.data.data;

      if (order.provider === 'razorpay') {
        await openRazorpayCheckout({
          order,
          description: `Platform invoice ${invoice.invoiceNumber}`,
          prefill: { name: user?.name, contact: user?.phone, email: user?.email },
          onSuccess: async (response) => {
            try {
              await apiClient.post(`/admin/billing/invoices/${invoice._id}/verify-razorpay`, response);
              await refreshInvoices();
              flash('Payment successful');
            } catch (err) {
              setError(err.response?.data?.message || 'Payment verification failed');
            } finally {
              setPayingInvoiceId('');
            }
          },
          onDismiss: () => setPayingInvoiceId(''),
        });
        return;
      }

      // No real gateway configured yet — "simulate-payment" stands in for a
      // gateway's hosted checkout, running through the exact same
      // webhook/idempotency code a real integration uses.
      await apiClient.post(`/admin/billing/invoices/${invoice._id}/simulate-payment`, {});
      await refreshInvoices();
      flash('Payment successful');
      setPayingInvoiceId('');
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed');
      setPayingInvoiceId('');
    }
  };

  const submitTicket = async (e) => {
    e.preventDefault();
    if (!ticketForm.subject.trim()) return;
    setSubmittingTicket(true);
    setError('');
    try {
      await apiClient.post('/admin/support', ticketForm);
      setTicketForm({ subject: '', description: '' });
      const res = await apiClient.get('/admin/support');
      setTickets(res.data.data);
      flash('Support ticket submitted');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit ticket');
    } finally {
      setSubmittingTicket(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const saveGym = async (fields, sectionKey, label) => {
    setSavingSection(sectionKey);
    setError('');
    try {
      const res = await apiClient.put('/admin/settings/gym', fields);
      setGym(res.data.data);
      flash(`${label} saved`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSavingSection('');
    }
  };

  const saveProfile = async () => {
    setSavingSection('profile');
    setError('');
    try {
      const res = await apiClient.put('/admin/settings/profile', profile);
      setProfile((p) => ({ ...p, ...res.data.data }));
      flash('Profile saved');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSavingSection('');
    }
  };

  const updateDay = (day, field, value) => {
    setGym((g) => ({ ...g, workingHours: { ...g.workingHours, [day]: { ...g.workingHours?.[day], [field]: value } } }));
  };

  const addHoliday = () => {
    if (!newHoliday.date) return;
    setGym((g) => ({ ...g, holidays: [...(g.holidays || []), newHoliday] }));
    setNewHoliday({ date: '', label: '' });
  };
  const removeHoliday = (idx) => setGym((g) => ({ ...g, holidays: g.holidays.filter((_, i) => i !== idx) }));

  if (!gym || !profile) {
    return <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" /></div>;
  }

  return (
    <div className="p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-gray-500">Gym profile, branding, hours, holidays, and ID formats.</p>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === t.key ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title="Gym profile & branding" description="Shown on the member-facing app" onSave={() => saveGym({ gymName: gym.gymName, logoUrl: gym.logoUrl, brandColor: gym.brandColor }, 'branding', 'Branding')} saving={savingSection === 'branding'} disabled={suspended}>
          <Input label="Gym name" value={gym.gymName || ''} onChange={(e) => setGym({ ...gym, gymName: e.target.value })} />
          <Input label="Logo URL" value={gym.logoUrl || ''} onChange={(e) => setGym({ ...gym, logoUrl: e.target.value })} placeholder="https://..." />
          <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Brand color</span>
            <div className="flex items-center gap-2">
              <input type="color" value={gym.brandColor || '#0d9488'} onChange={(e) => setGym({ ...gym, brandColor: e.target.value })} className="h-10 w-14 rounded-lg border border-gray-200" />
              <span className="text-sm text-gray-500">{gym.brandColor}</span>
            </div>
          </label>
        </SectionCard>

        <SectionCard title="Your profile" onSave={saveProfile} saving={savingSection === 'profile'} disabled={suspended}>
          <Input label="Name" value={profile.name || ''} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          <Input label="Email" type="email" value={profile.email || ''} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
          <Input label="Phone" value={profile.phone || ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
        </SectionCard>

        <SectionCard title="Working hours" onSave={() => saveGym({ workingHours: gym.workingHours }, 'hours', 'Working hours')} saving={savingSection === 'hours'} disabled={suspended}>
          {DAYS.map((day) => {
            const d = gym.workingHours?.[day] || {};
            return (
              <div key={day} className="flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 p-3">
                <span className="w-24 text-sm font-medium capitalize">{day}</span>
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                  <input type="checkbox" checked={!d.closed} onChange={(e) => updateDay(day, 'closed', !e.target.checked)} /> Open
                </label>
                {!d.closed && (
                  <>
                    <input type="time" value={d.open || ''} onChange={(e) => updateDay(day, 'open', e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs" />
                    <span className="text-xs text-gray-400">to</span>
                    <input type="time" value={d.close || ''} onChange={(e) => updateDay(day, 'close', e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs" />
                  </>
                )}
              </div>
            );
          })}
        </SectionCard>

        <SectionCard title="Holiday calendar" onSave={() => saveGym({ holidays: gym.holidays }, 'holidays', 'Holidays')} saving={savingSection === 'holidays'} disabled={suspended}>
          <div className="flex gap-2">
            <input type="date" value={newHoliday.date} onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <input value={newHoliday.label} onChange={(e) => setNewHoliday({ ...newHoliday, label: e.target.value })} placeholder="Label" className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <button onClick={addHoliday} className="rounded-lg bg-gray-100 p-2 text-gray-600 hover:bg-gray-200"><Plus className="h-4 w-4" /></button>
          </div>
          <div className="space-y-2">
            {(gym.holidays || []).length === 0 && <p className="text-xs text-gray-400">No holidays added.</p>}
            {(gym.holidays || []).map((h, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <span>{new Date(h.date).toLocaleDateString()} — {h.label || 'Holiday'}</span>
                <button onClick={() => removeHoliday(i)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="ID formats" description="Applied when generating new member/staff IDs" onSave={() => saveGym({ memberIdFormat: gym.memberIdFormat, staffIdFormat: gym.staffIdFormat }, 'idformats', 'ID formats')} saving={savingSection === 'idformats'} disabled={suspended}>
          <Input label="Member ID format" value={gym.memberIdFormat || ''} onChange={(e) => setGym({ ...gym, memberIdFormat: e.target.value })} placeholder="MEM-{seq}" />
          <Input label="Staff ID format" value={gym.staffIdFormat || ''} onChange={(e) => setGym({ ...gym, staffIdFormat: e.target.value })} placeholder="STF-{seq}" />
        </SectionCard>

        <SectionCard title="Attendance policy" description="What happens when a member with an expired/frozen plan tries to check in" onSave={() => saveGym({ attendanceGraceMode: gym.attendanceGraceMode }, 'attendance', 'Attendance policy')} saving={savingSection === 'attendance'} disabled={suspended}>
          <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Mode</span>
            <select value={gym.attendanceGraceMode} onChange={(e) => setGym({ ...gym, attendanceGraceMode: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm">
              <option value="block">Block check-in</option>
              <option value="warn">Warn but allow (grace period)</option>
            </select>
          </label>
        </SectionCard>

        <SectionCard title="AI Plans policy" description="Whether a sub-admin's AI-generated plan needs your review before it reaches the member" onSave={() => saveGym({ aiPlanReviewRequired: gym.aiPlanReviewRequired }, 'aiplans', 'AI Plans policy')} saving={savingSection === 'aiplans'} disabled={suspended}>
          <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Sub-admin generated plans</span>
            <select value={gym.aiPlanReviewRequired ? 'required' : 'auto'} onChange={(e) => setGym({ ...gym, aiPlanReviewRequired: e.target.value === 'required' })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm">
              <option value="required">Require my review before publishing</option>
              <option value="auto">Auto-publish immediately</option>
            </select>
          </label>
        </SectionCard>

        <SectionCard title="GST" description="Enable to see a GST summary in Accounts and show your GSTIN on invoices" onSave={() => saveGym({ gstEnabled: gym.gstEnabled, gstNumber: gym.gstNumber, gstRate: gym.gstRate }, 'gst', 'GST settings')} saving={savingSection === 'gst'} disabled={suspended}>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={!!gym.gstEnabled} onChange={(e) => setGym({ ...gym, gstEnabled: e.target.checked })} /> GST registered
          </label>
          {gym.gstEnabled && (
            <>
              <Input label="GSTIN" value={gym.gstNumber || ''} onChange={(e) => setGym({ ...gym, gstNumber: e.target.value })} placeholder="e.g. 33ABCDE1234F1Z5" />
              <Input label="GST rate (%)" type="number" min="0" max="28" value={gym.gstRate ?? 18} onChange={(e) => setGym({ ...gym, gstRate: Number(e.target.value) })} />
            </>
          )}
        </SectionCard>
      </div>
      )}

      {tab === 'whatsapp' && (
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="WhatsApp notifications"
          description="Send plan-expiry, overdue-payment and PT-session reminders over WhatsApp in addition to SMS/email"
          onSave={() => saveGym({ whatsappEnabled: gym.whatsappEnabled, whatsappNumber: gym.whatsappNumber }, 'whatsapp', 'WhatsApp settings')}
          saving={savingSection === 'whatsapp'}
          disabled={suspended}
        >
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={!!gym.whatsappEnabled} onChange={(e) => setGym({ ...gym, whatsappEnabled: e.target.checked })} /> Enable WhatsApp notifications
          </label>
          {gym.whatsappEnabled && (
            <Input label="WhatsApp Business number" value={gym.whatsappNumber || ''} onChange={(e) => setGym({ ...gym, whatsappNumber: e.target.value })} placeholder="+91XXXXXXXXXX" />
          )}
          <p className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
            <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Messages send through the WhatsApp Cloud API once your gym owner account has WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN configured on the server. Until then, enabling this only logs messages instead of sending them — the same demo-mode behavior SMS uses before a gateway is connected.
          </p>
        </SectionCard>
      </div>
      )}

      {tab === 'billing' && (
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title="Platform billing" description="Your GymDesk subscription invoices">
          {invoices.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-gray-400"><CreditCard className="h-4 w-4" />No invoices yet.</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div key={inv._id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{inv.planId?.name || 'Platform plan'} — ₹{inv.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{inv.invoiceNumber} · {new Date(inv.createdAt).toLocaleDateString()}</p>
                  </div>
                  {inv.status === 'paid' ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Paid</span>
                  ) : (
                    <button onClick={() => payInvoice(inv)} disabled={payingInvoiceId === inv._id || suspended} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
                      <CreditCard className="h-3.5 w-3.5" /> {payingInvoiceId === inv._id ? 'Processing...' : 'Pay now'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
      )}

      {tab === 'staff' && (
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title="Staff overview" description="Sub-admin and trainer logins for this gym">
          <div className="flex items-center gap-4 rounded-lg bg-gray-50 px-4 py-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><UserCog className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-semibold text-gray-900">{staff.filter((s) => s.isActive).length} active · {staff.filter((s) => !s.isActive).length} deactivated</p>
              <p className="text-xs text-gray-500">{staff.length} total staff login{staff.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {staff.slice(0, 5).map((s) => (
              <div key={s._id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-medium text-gray-900">{s.name}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{s.isActive ? 'Active' : 'Deactivated'}</span>
              </div>
            ))}
            {staff.length === 0 && <p className="py-3 text-sm text-gray-400">No staff logins yet.</p>}
          </div>
          <button onClick={() => navigate('/admin/staff')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800">
            Manage staff & permissions <ArrowRight className="h-4 w-4" />
          </button>
        </SectionCard>
      </div>
      )}

      {tab === 'support' && (
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title="Contact support" description="Raise an issue with the GymDesk team">
          <form onSubmit={submitTicket} className="space-y-3">
            <Input label="Subject" value={ticketForm.subject} onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })} placeholder="What's the issue?" />
            <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Description</span>
              <textarea rows={3} value={ticketForm.description} onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500" />
            </label>
            <button type="submit" disabled={submittingTicket} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
              <Send className="h-4 w-4" /> {submittingTicket ? 'Submitting...' : 'Submit ticket'}
            </button>
          </form>
          {tickets.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-gray-500"><LifeBuoy className="h-3.5 w-3.5" />Your tickets</p>
              <div className="space-y-2">
                {tickets.map((t) => (
                  <div key={t._id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <span className="truncate">{t.subject}</span>
                    <span className="ml-2 flex-shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-medium capitalize text-gray-600">{t.status.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
      )}
    </div>
  );
};

export default Settings;
