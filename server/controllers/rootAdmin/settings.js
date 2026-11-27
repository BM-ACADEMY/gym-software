const bcrypt = require('bcryptjs');
const RootAdmin = require('../../models/RootAdmin');
const SystemSettings = require('../../models/SystemSettings');
const { modeOf, validateGatewayUpdate } = require('../../services/gatewayKeys');
const mongoose = require('mongoose');
const Subscriber = require('../../models/Subscriber');
const testCharge = require('../../services/testCharge');

const DEFAULT_BRANDING = { platformName: 'GymDesk', logoUrl: '', primaryColor: '#0d9488' };

const maskSecret = (value) => (value ? `••••${String(value).slice(-4)}` : '');

// @desc    Root Admin's own account + platform branding + notification templates + payment gateway (masked)
// @route   GET /api/root-admin/settings
const getSettings = async (req, res) => {
  try {
    const [profile, branding, notificationTemplates, paymentGateway] = await Promise.all([
      RootAdmin.findById(req.user.id).select('name email phone permissionLevel'),
      SystemSettings.getSetting('platform_branding', DEFAULT_BRANDING),
      SystemSettings.getSetting('notification_templates', {}),
      SystemSettings.getSetting('payment_gateway', { provider: '', keyId: '', keySecret: '' }),
    ]);

    res.status(200).json({
      success: true,
      message: 'Settings fetched successfully',
      data: {
        profile,
        branding,
        notificationTemplates,
        paymentGateway: {
          provider: paymentGateway.provider || '',
          keyId: paymentGateway.keyId || '',
          mode: modeOf(paymentGateway.keyId),
          hasSecret: Boolean(paymentGateway.keySecret),
          keySecretMasked: maskSecret(paymentGateway.keySecret),
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update own profile / password
// @route   PUT /api/root-admin/settings/profile
const updateProfile = async (req, res) => {
  try {
    const rootAdmin = await RootAdmin.findById(req.user.id);
    if (!rootAdmin) return res.status(404).json({ success: false, message: 'Account not found' });

    const { name, email, phone, currentPassword, newPassword } = req.body;
    if (name !== undefined) rootAdmin.name = name;
    if (email !== undefined) rootAdmin.email = email;
    if (phone !== undefined) rootAdmin.phone = phone;

    if (newPassword) {
      if (!currentPassword || !(await bcrypt.compare(currentPassword, rootAdmin.passwordHash))) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
      }
      if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
      rootAdmin.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await rootAdmin.save();
    res.status(200).json({ success: true, message: 'Profile updated successfully', data: { name: rootAdmin.name, email: rootAdmin.email, phone: rootAdmin.phone } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update platform branding (logo/colors shown across the SaaS)
// @route   PUT /api/root-admin/settings/branding
const updateBranding = async (req, res) => {
  try {
    const { platformName, logoUrl, primaryColor } = req.body;
    const current = await SystemSettings.getSetting('platform_branding', DEFAULT_BRANDING);
    const updated = {
      platformName: platformName !== undefined ? platformName : current.platformName,
      logoUrl: logoUrl !== undefined ? logoUrl : current.logoUrl,
      primaryColor: primaryColor !== undefined ? primaryColor : current.primaryColor,
    };
    await SystemSettings.setSetting('platform_branding', updated, 'Platform-wide branding shown across the SaaS');
    res.status(200).json({ success: true, message: 'Branding updated successfully', data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update the message templates the notification rules use (falls back
//          to the built-in default message for any type left blank)
// @route   PUT /api/root-admin/settings/notification-templates
const updateNotificationTemplates = async (req, res) => {
  try {
    const templates = req.body.templates || {};
    if (typeof templates !== 'object') {
      return res.status(400).json({ success: false, message: 'templates must be an object of type -> template string' });
    }
    await SystemSettings.setSetting('notification_templates', templates, 'Custom message templates for auto-notifications, keyed by type');
    res.status(200).json({ success: true, message: 'Notification templates updated successfully', data: templates });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Store payment gateway keys (write-only — the secret is never echoed back)
// @route   PUT /api/root-admin/settings/payment-gateway
const updatePaymentGateway = async (req, res) => {
  try {
    const current = await SystemSettings.getSetting('payment_gateway', { provider: '', keyId: '', keySecret: '' });
    const check = validateGatewayUpdate(req.body || {}, current);
    if (check.error) return res.status(400).json({ success: false, message: check.error });
    const updated = check.value;
    await SystemSettings.setSetting('payment_gateway', updated, 'Payment gateway credentials (secret stored, never returned by the API)');
    // RM-11: Razorpay keeps test and live webhooks apart, each with its own secret. After a switch the
    // RAZORPAY_WEBHOOK_SECRET on the server must be the new mode's one, or every webhook is refused.
    if (check.modeChanged) console.warn(`[payment] Razorpay keys switched to ${check.mode.toUpperCase()} mode by root admin ${req.user.id}`);
    res.status(200).json({
      success: true,
      message: check.modeChanged ? `Saved. Razorpay is now in ${check.mode.toUpperCase()} mode: change the webhook secret on the server too.` : 'Payment gateway settings updated successfully',
      data: { provider: updated.provider, keyId: updated.keyId, mode: check.mode, hasSecret: Boolean(updated.keySecret) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    RM-11: the one-time Rs 1 test price (one gym, Solo monthly, 30 minutes, used up by its first payment)
// @route   GET /api/root-admin/settings/test-charge
const getTestCharge = async (req, res) => {
  try {
    const charge = await testCharge.get();
    const active = charge && new Date(charge.expiresAt) > new Date() ? charge : null;
    res.status(200).json({ success: true, data: active });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   PUT /api/root-admin/settings/test-charge  { subscriberId }
const setTestCharge = async (req, res) => {
  try {
    const id = typeof req.body?.subscriberId === 'string' ? req.body.subscriberId : '';
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Choose the internal test gym' });
    const gym = await Subscriber.findById(id).select('gymName state deletedAt isActive');
    if (!gym || gym.deletedAt) return res.status(404).json({ success: false, message: 'Gym not found' });
    if (!gym.state) return res.status(400).json({ success: false, message: 'Set the state on this gym first (Plan & Billing). It decides the GST on the invoice.' });
    const value = await testCharge.set({ subscriberId: gym._id, gymName: gym.gymName, by: req.user.id });
    console.warn(`[payment] Rs ${value.amount} test price turned on for gym ${gym._id} by root admin ${req.user.id} until ${value.expiresAt}`);
    res.status(200).json({ success: true, message: `Rs ${value.amount} test price is on for ${gym.gymName} (Solo monthly) for ${testCharge.MINUTES} minutes.`, data: value });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route   DELETE /api/root-admin/settings/test-charge
const clearTestCharge = async (req, res) => {
  try {
    await testCharge.clear();
    res.status(200).json({ success: true, message: 'Test price turned off', data: null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getSettings, updateProfile, updateBranding, updateNotificationTemplates, updatePaymentGateway, getTestCharge, setTestCharge, clearTestCharge };
