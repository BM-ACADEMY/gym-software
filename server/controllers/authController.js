const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const RootAdmin = require('../models/RootAdmin');
const Subscriber = require('../models/Subscriber');
const SubAdmin = require('../models/SubAdmin');
const Member = require('../models/Member');
const OtpRecord = require('../models/OtpRecord');
const { generateToken } = require('../utils/jwt');
const { generateOtp, sendOtpSms, sendOtpEmail } = require('../utils/otp');

// @desc    Request OTP for Registration (Email or Phone)
// @route   POST /api/auth/register-otp-request
const registerOtpRequest = async (req, res) => {
  try {
    const { type, identifier, gymName, ownerName, password } = req.body;
    
    if (!type || !identifier || !gymName || !ownerName) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    if (type === 'email') {
      const existing = await Admin.findOne({ email: identifier });
      if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });
      if (!password) return res.status(400).json({ success: false, message: 'Password is required for Email registration' });
    } else if (type === 'phone') {
      const existing = await Admin.findOne({ phone: identifier });
      if (existing) return res.status(400).json({ success: false, message: 'Phone number already in use' });
    }

    const otp = generateOtp();
    const otpCodeHash = await bcrypt.hash(otp, 10);
    
    // Create temp record
    let passwordHash = undefined;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    await OtpRecord.findOneAndUpdate(
      { identifier },
      {
        identifier,
        type,
        otpCode: otpCodeHash,
        gymName,
        ownerName,
        passwordHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      },
      { upsert: true, new: true }
    );

    let sendResult;
    if (type === 'email') sendResult = await sendOtpEmail(identifier, otp);
    else sendResult = await sendOtpSms(identifier, otp);

    const responsePayload = { success: true, message: 'OTP sent successfully' };
    if (sendResult.demo) responsePayload.demoOtp = sendResult.otp;

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Verify OTP and Create Account
// @route   POST /api/auth/register-otp-verify
const registerOtpVerify = async (req, res) => {
  try {
    const { identifier, otp } = req.body;

    const record = await OtpRecord.findOne({ identifier });
    if (!record) return res.status(400).json({ success: false, message: 'Invalid or expired OTP request' });

    const isMatch = await bcrypt.compare(otp, record.otpCode);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Incorrect OTP' });

    // OTP matched, create account
    const subscriber = await Subscriber.create({ gymName: record.gymName });
    
    const adminData = {
      subscriberId: subscriber._id,
      name: record.ownerName,
      role: 'admin'
    };

    if (record.type === 'email') {
      adminData.email = record.identifier;
      adminData.passwordHash = record.passwordHash;
    } else {
      adminData.phone = record.identifier;
    }

    const admin = await Admin.create(adminData);
    
    // cleanup
    await OtpRecord.deleteOne({ _id: record._id });

    const token = generateToken({ id: admin._id, role: admin.role, subscriberId: subscriber._id });

    res.status(201).json({
      success: true,
      token,
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        subscriberId: subscriber._id
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Login Admin with Email & Password
// @route   POST /api/auth/login-email
const loginAdminWithEmail = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const admin = await Admin.findOne({ email });
    if (!admin || !admin.passwordHash) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const token = generateToken({ id: admin._id, role: admin.role, subscriberId: admin.subscriberId });

    res.status(200).json({
      success: true,
      token,
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        subscriberId: admin.subscriberId
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Request OTP for Admin Login (using Phone)
// @route   POST /api/auth/request-otp
const requestAdminOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Please provide phone number' });
    }

    let admin = await Admin.findOne({ phone });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'No account found with this phone number' });
    }

    const otp = generateOtp();
    admin.otpCode = await bcrypt.hash(otp, 10);
    // Expires in 10 minutes
    admin.otpExpiresAt = Date.now() + 10 * 60 * 1000;
    await admin.save();

    const sendResult = await sendOtpSms(phone, otp);

    const responsePayload = { success: true, message: 'OTP sent successfully' };
    if (sendResult.demo) responsePayload.demoOtp = sendResult.otp;

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Login Admin with OTP
// @route   POST /api/auth/login-otp
const loginAdminWithOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Please provide phone and OTP' });
    }

    const admin = await Admin.findOne({ phone });
    if (!admin || !admin.otpCode) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }

    if (admin.otpExpiresAt < Date.now()) {
      return res.status(401).json({ success: false, message: 'OTP has expired' });
    }

    const isMatch = await bcrypt.compare(otp, admin.otpCode);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid OTP' });
    }

    // Clear OTP after successful login
    admin.otpCode = undefined;
    admin.otpExpiresAt = undefined;
    admin.lastLoginAt = new Date();
    await admin.save();

    const token = generateToken({ id: admin._id, role: admin.role, subscriberId: admin.subscriberId });

    res.status(200).json({
      success: true,
      token,
      data: {
        id: admin._id,
        name: admin.name,
        phone: admin.phone,
        role: admin.role,
        subscriberId: admin.subscriberId
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Login Root Admin with Phone or Email + Password
// @route   POST /api/auth/login-root
// Root Admin has its own dedicated login page/flow — kept separate from the
// Admin/Sub-Admin/Member login below so platform staff never share a form
// with tenant accounts.
const loginRootAdmin = async (req, res) => {
  try {
    const { phone, email, password } = req.body;

    if ((!phone && !email) || !password) {
      return res.status(400).json({ success: false, message: 'Please provide phone or email, and password' });
    }

    const query = [];
    if (phone) query.push({ phone });
    if (email) query.push({ email });

    const rootAdmin = await RootAdmin.findOne({ $or: query });
    if (!rootAdmin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (rootAdmin.status !== 'approved') {
      return res.status(403).json({ success: false, message: 'This account is pending approval' });
    }

    const isMatch = await bcrypt.compare(password, rootAdmin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken({ id: rootAdmin._id, role: rootAdmin.role });

    res.status(200).json({
      success: true,
      token,
      data: {
        id: rootAdmin._id,
        name: rootAdmin.name,
        email: rootAdmin.email,
        phone: rootAdmin.phone,
        role: rootAdmin.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Login Admin (Gym Owner), Sub-Admin (Staff) or Member (Customer) with Phone + Password
// @route   POST /api/auth/login-phone
// One shared login form for every tenant-side role — tries Admin, then
// Sub-Admin, then Member, since phone numbers are only unique within each
// collection, not across all three.
const loginWithPhone = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Please provide phone and password' });
    }

    const admin = await Admin.findOne({ phone });
    if (admin && admin.passwordHash && (await bcrypt.compare(password, admin.passwordHash))) {
      admin.lastLoginAt = new Date();
      await admin.save();
      const token = generateToken({ id: admin._id, role: admin.role, subscriberId: admin.subscriberId });
      return res.status(200).json({
        success: true,
        token,
        data: {
          id: admin._id,
          name: admin.name,
          phone: admin.phone,
          role: admin.role,
          subscriberId: admin.subscriberId
        }
      });
    }

    const subAdmin = await SubAdmin.findOne({ phone });
    if (subAdmin && subAdmin.passwordHash && (await bcrypt.compare(password, subAdmin.passwordHash))) {
      if (!subAdmin.isActive) {
        return res.status(403).json({ success: false, message: 'This staff account has been deactivated' });
      }
      const token = generateToken({ id: subAdmin._id, role: subAdmin.role, subscriberId: subAdmin.subscriberId });
      return res.status(200).json({
        success: true,
        token,
        data: {
          id: subAdmin._id,
          name: subAdmin.name,
          phone: subAdmin.phone,
          role: subAdmin.role,
          subscriberId: subAdmin.subscriberId,
          template: subAdmin.template,
          permissions: Object.fromEntries(subAdmin.permissions || [])
        }
      });
    }

    const member = await Member.findOne({ phone });
    if (member && member.passwordHash && (await bcrypt.compare(password, member.passwordHash))) {
      const token = generateToken({ id: member._id, role: 'member', subscriberId: member.subscriberId });
      return res.status(200).json({
        success: true,
        token,
        data: {
          id: member._id,
          name: member.name,
          phone: member.phone,
          role: 'member',
          subscriberId: member.subscriberId
        }
      });
    }

    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Shared helper: find whichever tenant-side account (Admin, Sub-Admin, Member)
// owns this phone or email — same lookup order as loginWithPhone.
const findTenantAccountByIdentifier = async (identifier) => {
  const isEmail = identifier.includes('@');
  const query = isEmail ? { email: identifier } : { phone: identifier };

  const admin = await Admin.findOne(query);
  if (admin) return { account: admin, isEmail };

  const subAdmin = await SubAdmin.findOne(query);
  if (subAdmin) return { account: subAdmin, isEmail };

  const member = await Member.findOne(query);
  if (member) return { account: member, isEmail };

  return { account: null, isEmail };
};

// @desc    Request a password-reset OTP for Admin, Sub-Admin or Member
// @route   POST /api/auth/reset-password-request
const requestPasswordReset = async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Please provide your phone or email' });
    }

    const { account, isEmail } = await findTenantAccountByIdentifier(identifier);
    if (!account) {
      return res.status(404).json({ success: false, message: 'No account found with this phone/email' });
    }

    const otp = generateOtp();
    account.otpCode = await bcrypt.hash(otp, 10);
    account.otpExpiresAt = Date.now() + 10 * 60 * 1000;
    await account.save();

    const sendResult = isEmail ? await sendOtpEmail(identifier, otp) : await sendOtpSms(identifier, otp);

    const responsePayload = { success: true, message: 'OTP sent successfully' };
    if (sendResult.demo) responsePayload.demoOtp = sendResult.otp;

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Verify OTP and set a new password for Admin, Sub-Admin or Member
// @route   POST /api/auth/reset-password-verify
const resetPassword = async (req, res) => {
  try {
    const { identifier, otp, newPassword } = req.body;
    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide identifier, OTP and new password' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const { account } = await findTenantAccountByIdentifier(identifier);
    if (!account || !account.otpCode) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }
    if (account.otpExpiresAt < Date.now()) {
      return res.status(401).json({ success: false, message: 'OTP has expired' });
    }

    const isMatch = await bcrypt.compare(otp, account.otpCode);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid OTP' });
    }

    account.passwordHash = await bcrypt.hash(newPassword, 10);
    account.otpCode = undefined;
    account.otpExpiresAt = undefined;
    await account.save();

    res.status(200).json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Request a password-reset OTP for Root Admin
// @route   POST /api/auth/reset-root-password-request
const requestRootPasswordReset = async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Please provide your phone or email' });
    }

    const isEmail = identifier.includes('@');
    const rootAdmin = await RootAdmin.findOne(isEmail ? { email: identifier } : { phone: identifier });
    if (!rootAdmin) {
      return res.status(404).json({ success: false, message: 'No account found with this phone/email' });
    }

    const otp = generateOtp();
    rootAdmin.otpCode = await bcrypt.hash(otp, 10);
    rootAdmin.otpExpiresAt = Date.now() + 10 * 60 * 1000;
    await rootAdmin.save();

    const sendResult = isEmail ? await sendOtpEmail(identifier, otp) : await sendOtpSms(identifier, otp);

    const responsePayload = { success: true, message: 'OTP sent successfully' };
    if (sendResult.demo) responsePayload.demoOtp = sendResult.otp;

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Verify OTP and set a new password for Root Admin
// @route   POST /api/auth/reset-root-password-verify
const resetRootPassword = async (req, res) => {
  try {
    const { identifier, otp, newPassword } = req.body;
    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide identifier, OTP and new password' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const isEmail = identifier.includes('@');
    const rootAdmin = await RootAdmin.findOne(isEmail ? { email: identifier } : { phone: identifier });
    if (!rootAdmin || !rootAdmin.otpCode) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }
    if (rootAdmin.otpExpiresAt < Date.now()) {
      return res.status(401).json({ success: false, message: 'OTP has expired' });
    }

    const isMatch = await bcrypt.compare(otp, rootAdmin.otpCode);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid OTP' });
    }

    rootAdmin.passwordHash = await bcrypt.hash(newPassword, 10);
    rootAdmin.otpCode = undefined;
    rootAdmin.otpExpiresAt = undefined;
    await rootAdmin.save();

    res.status(200).json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Internal team member requests a Root Admin login — lands as
//          status: 'pending' until an existing Root Admin approves it.
// @route   POST /api/auth/request-root-access
const requestRootAccess = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !password || (!email && !phone)) {
      return res.status(400).json({ success: false, message: 'Name, password, and an email or phone are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const orConditions = [];
    if (email) orConditions.push({ email });
    if (phone) orConditions.push({ phone });
    const existing = await RootAdmin.findOne({ $or: orConditions });
    if (existing) {
      return res.status(400).json({ success: false, message: 'An account with that email or phone already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await RootAdmin.create({ name, email, phone, passwordHash, status: 'pending' });

    res.status(201).json({ success: true, message: 'Access request submitted — an existing Root Admin will review it' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  registerOtpRequest,
  registerOtpVerify,
  loginAdminWithEmail,
  requestAdminOtp,
  loginAdminWithOtp,
  loginRootAdmin,
  loginWithPhone,
  requestPasswordReset,
  resetPassword,
  requestRootPasswordReset,
  resetRootPassword,
  requestRootAccess
};
