const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const RootAdmin = require('../models/RootAdmin');
const Subscriber = require('../models/Subscriber');
const { generateToken } = require('../utils/jwt');
const { generateOtp, sendOtpSms } = require('../utils/otp');

// @desc    Register Admin (Gym Owner) with Email & Password
// @route   POST /api/auth/register-email
const registerAdminWithEmail = async (req, res) => {
  try {
    const { gymName, name, email, password } = req.body;

    if (!gymName || !name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const adminExists = await Admin.findOne({ email });
    if (adminExists) {
      return res.status(400).json({ success: false, message: 'Admin already exists with this email' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create Subscriber (Gym)
    const subscriber = await Subscriber.create({ gymName });

    // Create Admin linked to subscriber
    const admin = await Admin.create({
      subscriberId: subscriber._id,
      name,
      email,
      passwordHash
    });

    const token = generateToken({ id: admin._id, role: admin.role, subscriberId: subscriber._id });

    res.status(201).json({
      success: true,
      token,
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
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

// @desc    Request OTP for Admin (using Phone)
// @route   POST /api/auth/request-otp
const requestAdminOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Please provide phone number' });
    }

    let admin = await Admin.findOne({ phone });
    // Note: In a full flow, you might also create a Subscriber here if it's a new registration via OTP, 
    // but typically you'd have a separate 'register-otp' flow that takes gymName. 
    // We will assume this is for login/verification.
    if (!admin) {
      return res.status(404).json({ success: false, message: 'No account found with this phone number' });
    }

    const otp = generateOtp();
    admin.otpCode = await bcrypt.hash(otp, 10);
    // Expires in 10 minutes
    admin.otpExpiresAt = Date.now() + 10 * 60 * 1000;
    await admin.save();

    await sendOtpSms(phone, otp);

    res.status(200).json({ success: true, message: 'OTP sent successfully' });
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
  registerAdminWithEmail,
  loginAdminWithEmail,
  requestAdminOtp,
  loginAdminWithOtp,
  loginRootAdmin
};
