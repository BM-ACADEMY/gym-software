const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const RootAdmin = require('../models/RootAdmin');
const Subscriber = require('../models/Subscriber');
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

// @desc    Login Root Admin with Email & Password
// @route   POST /api/auth/login-root
const loginRootAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const rootAdmin = await RootAdmin.findOne({ email });
    if (!rootAdmin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
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
        email: rootAdmin.email,
        role: rootAdmin.role
      }
    });
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
  loginRootAdmin
};
