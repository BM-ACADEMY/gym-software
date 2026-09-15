const bcrypt = require('bcryptjs');
const RootAdmin = require('../../models/RootAdmin');
const SystemSettings = require('../../models/SystemSettings');

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
    const { provider, keyId, keySecret } = req.body;
    const current = await SystemSettings.getSetting('payment_gateway', { provider: '', keyId: '', keySecret: '' });
    const updated = {
      provider: provider !== undefined ? provider : current.provider,
      keyId: keyId !== undefined ? keyId : current.keyId,
      keySecret: keySecret ? keySecret : current.keySecret,
    };
    await SystemSettings.setSetting('payment_gateway', updated, 'Payment gateway credentials (secret stored, never returned by the API)');
    res.status(200).json({
      success: true,
      message: 'Payment gateway settings updated successfully',
      data: { provider: updated.provider, keyId: updated.keyId, hasSecret: Boolean(updated.keySecret) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getSettings, updateProfile, updateBranding, updateNotificationTemplates, updatePaymentGateway };
