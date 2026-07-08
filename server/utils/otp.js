const generateOtp = () => {
  // Generate a 6-digit random number
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOtpSms = async (phone, otp) => {
  // MOCK: In production, integrate with Twilio, AWS SNS, Msg91, etc.
  console.log(`\n========================================`);
  console.log(`[MOCK SMS SENDER] To: ${phone}`);
  console.log(`[MOCK SMS SENDER] Message: Your GymDesk OTP is ${otp}. It is valid for 10 minutes.`);
  console.log(`========================================\n`);
  return true;
};

module.exports = {
  generateOtp,
  sendOtpSms
};
