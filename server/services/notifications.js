const Notification = require('../models/Notification');
const SystemSettings = require('../models/SystemSettings');
const Admin = require('../models/Admin');
const Member = require('../models/Member');
const Payment = require('../models/Payment');
const PTSession = require('../models/PTSession');
const { sendSms } = require('../utils/sms');
const { sendEmail } = require('../utils/email');
const { suggestBestSendHour } = require('./ai');

// Same global demo/live switch Root Admin already controls for OTP delivery
// (client/src/pages/root-admin/Settings.jsx) — reused here rather than adding
// a second, redundant toggle for "can this deployment send real messages".
const getMode = async () => {
  try {
    return await SystemSettings.getSetting('otp_mode', process.env.OTP_MODE || 'demo');
  } catch {
    return process.env.OTP_MODE || 'demo';
  }
};

// Root Admin Settings can override any rule's message text with a template
// like "Hi {{name}}, your plan expires in {{days}} day(s)." — falls back to
// the built-in default (still built from the same vars) when none is set.
const renderMessage = async (type, vars, fallback) => {
  const templates = await SystemSettings.getSetting('notification_templates', {});
  const template = templates[type];
  if (!template) return fallback;
  return template.replace(/{{\s*(\w+)\s*}}/g, (match, key) => (key in vars ? vars[key] : match));
};

// Sends through one channel and always logs the attempt as a Notification —
// even in demo mode, so read-state and the admin's notification log behave
// identically regardless of whether real messages are actually going out.
const dispatchOne = async ({ subscriberId, recipientType, recipientId, type, channel, message, to }) => {
  const mode = await getMode();
  try {
    if (to && mode === 'live') {
      if (channel === 'sms') await sendSms(to, message);
      if (channel === 'email') await sendEmail(to, 'GymDesk notification', message);
    } else if (to) {
      console.log(`[DEMO ${channel.toUpperCase()}] To: ${to} | ${message}`);
    }
  } catch (error) {
    console.error(`Failed to send ${channel} notification:`, error.message);
  }
  return Notification.create({ subscriberId, recipientType, recipientId, type, channel, message, sentAt: new Date() });
};

const notifyMember = async (member, type, message) => {
  const prefs = member.notificationPreferences || { sms: true, email: true };
  const channels = [{ channel: 'in_app', to: null }];
  if (member.phone && prefs.sms !== false) channels.push({ channel: 'sms', to: member.phone });
  if (member.email && prefs.email !== false) channels.push({ channel: 'email', to: member.email });
  return Promise.all(channels.map((c) => dispatchOne({
    subscriberId: member.subscriberId, recipientType: 'member', recipientId: member._id, type, message, channel: c.channel, to: c.to,
  })));
};

const notifyStaff = async (subAdmin, type, message) => {
  const channels = [{ channel: 'in_app', to: null }];
  if (subAdmin.phone) channels.push({ channel: 'sms', to: subAdmin.phone });
  if (subAdmin.email) channels.push({ channel: 'email', to: subAdmin.email });
  return Promise.all(channels.map((c) => dispatchOne({
    subscriberId: subAdmin.subscriberId, recipientType: 'subadmin', recipientId: subAdmin._id, type, message, channel: c.channel, to: c.to,
  })));
};

const notifyAdmin = async (admin, type, message) => {
  const channels = [{ channel: 'in_app', to: null }];
  if (admin.email) channels.push({ channel: 'email', to: admin.email });
  return Promise.all(channels.map((c) => dispatchOne({
    subscriberId: admin.subscriberId, recipientType: 'admin', recipientId: admin._id, type, message, channel: c.channel, to: c.to,
  })));
};

// Guards a rule from re-firing the same reminder every time the scheduler
// ticks — approximate (keyed on recipient+type, not the specific plan/invoice/
// session), which can under-notify if the same person has two distinct events
// of the same type within the window, but that's a rare edge case in practice.
const alreadyNotifiedRecently = async (recipientId, type, sinceHours = 20) => {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const existing = await Notification.findOne({ recipientId, type, createdAt: { $gte: since } });
  return !!existing;
};

// AI: smart send-time — for a member with enough read-response history, only
// send a (non time-critical) reminder in the hour it's historically read
// fastest. Not applied to PT session reminders, which are time-critical
// regardless of a member's usual reading habits. Skipping here doesn't mark
// the notification sent, so the hourly scheduler simply reconsiders it next
// tick — it naturally fires the first time the clock reaches their best hour.
const shouldSendNow = async (recipientId) => {
  const readHistory = await Notification.find({ recipientId, sentAt: { $ne: null }, readAt: { $ne: null } })
    .select('sentAt readAt')
    .sort({ createdAt: -1 })
    .limit(20);

  const history = readHistory.map((n) => ({ sentHour: n.sentAt.getHours(), responseMinutes: (n.readAt - n.sentAt) / 60000 }));
  const { hour, confidence } = suggestBestSendHour(history);
  if (hour === null || confidence === 'low') return true; // not enough data — send immediately, same as before
  return new Date().getHours() === hour;
};

// --- Auto-notification rules (doc: plan expiring, payment overdue, PT reminder) ---
// Each accepts an optional subscriberId to scope a single gym's manual "run now",
// or runs platform-wide when called by the background scheduler.

const runPlanExpiryReminders = async (subscriberId) => {
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const since3Days = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const base = { status: 'active', ...(subscriberId && { subscriberId }) };

  const expiringSoon = await Member.find({ ...base, expiresAt: { $gt: now, $lte: in3Days } });
  const justExpired = await Member.find({ ...base, expiresAt: { $gt: since3Days, $lte: now } });

  let sent = 0;
  for (const member of expiringSoon) {
    if (await alreadyNotifiedRecently(member._id, 'plan_expiring')) continue;
    if (!(await shouldSendNow(member._id))) continue;
    const days = Math.ceil((member.expiresAt - now) / (24 * 60 * 60 * 1000));
    const message = await renderMessage(
      'plan_expiring',
      { name: member.name, days },
      `Hi ${member.name}, your gym plan expires in ${days} day${days === 1 ? '' : 's'}. Renew to keep your access.`
    );
    await notifyMember(member, 'plan_expiring', message);
    sent++;
  }
  for (const member of justExpired) {
    if (await alreadyNotifiedRecently(member._id, 'plan_expired')) continue;
    if (!(await shouldSendNow(member._id))) continue;
    const message = await renderMessage('plan_expired', { name: member.name }, `Hi ${member.name}, your gym plan has expired. Renew now to continue your access.`);
    await notifyMember(member, 'plan_expired', message);
    sent++;
  }
  return sent;
};

const runPaymentOverdueReminders = async (subscriberId) => {
  const query = { status: { $in: ['pending', 'partial'] }, dueDate: { $lt: new Date() }, ...(subscriberId && { subscriberId }) };
  const overdue = await Payment.find(query).populate('memberId');

  const bySubscriber = new Map();
  let sent = 0;
  for (const payment of overdue) {
    if (!payment.memberId) continue;
    if (!(await alreadyNotifiedRecently(payment.memberId._id, 'payment_overdue')) && (await shouldSendNow(payment.memberId._id))) {
      const balance = payment.amount - payment.amountPaid;
      const message = await renderMessage(
        'payment_overdue',
        { name: payment.memberId.name, balance },
        `Hi ${payment.memberId.name}, you have an overdue payment of ₹${balance}. Please clear it soon.`
      );
      await notifyMember(payment.memberId, 'payment_overdue', message);
      sent++;
    }
    const key = String(payment.subscriberId);
    const entry = bySubscriber.get(key) || { subscriberId: payment.subscriberId, count: 0, total: 0 };
    entry.count++;
    entry.total += payment.amount - payment.amountPaid;
    bySubscriber.set(key, entry);
  }

  // Doc: overdue payment notifies the Customer AND the Gym Owner.
  for (const { subscriberId: subId, count, total } of bySubscriber.values()) {
    const admin = await Admin.findOne({ subscriberId: subId });
    if (!admin) continue;
    if (await alreadyNotifiedRecently(admin._id, 'payment_overdue_summary')) continue;
    const message = await renderMessage(
      'payment_overdue_summary',
      { count, total },
      `You have ${count} overdue payment${count === 1 ? '' : 's'} totaling ₹${total}.`
    );
    await notifyAdmin(admin, 'payment_overdue_summary', message);
  }

  return sent;
};

const runPTSessionReminders = async (subscriberId) => {
  const now = new Date();
  const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);
  const query = { status: 'scheduled', scheduledAt: { $gt: now, $lte: in1Hour }, ...(subscriberId && { subscriberId }) };
  const sessions = await PTSession.find(query).populate('memberId').populate('subAdminId');

  let sent = 0;
  for (const session of sessions) {
    if (!session.memberId) continue;
    const time = session.scheduledAt.toLocaleTimeString();
    if (!(await alreadyNotifiedRecently(session.memberId._id, 'pt_session_reminder', 2))) {
      const memberMessage = await renderMessage('pt_session_reminder', { name: session.memberId.name, time }, `Reminder: your PT session is at ${time} today.`);
      await notifyMember(session.memberId, 'pt_session_reminder', memberMessage);
      sent++;
    }
    if (session.subAdminId && !(await alreadyNotifiedRecently(session.subAdminId._id, 'pt_session_reminder', 2))) {
      const staffMessage = await renderMessage(
        'pt_session_reminder_staff',
        { memberName: session.memberId.name, time },
        `Reminder: PT session with ${session.memberId.name} at ${time} today.`
      );
      await notifyStaff(session.subAdminId, 'pt_session_reminder', staffMessage);
    }
  }
  return sent;
};

const runAllRules = async (subscriberId) => {
  const [expiry, overdue, pt] = await Promise.all([
    runPlanExpiryReminders(subscriberId),
    runPaymentOverdueReminders(subscriberId),
    runPTSessionReminders(subscriberId),
  ]);
  return { expiry, overdue, pt };
};

module.exports = { notifyMember, notifyStaff, notifyAdmin, runPlanExpiryReminders, runPaymentOverdueReminders, runPTSessionReminders, runAllRules };
