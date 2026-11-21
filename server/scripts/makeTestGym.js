// Makes ONE fake test gym owner on Fit, even while public sign-up is closed.
// Run on the server, as root (the server folder is the current release):
//   cd /srv/afraprod/current/server && node --env-file=/etc/afraprod/gym.env scripts/makeTestGym.js
// The random password is written ONLY to /root/afra-test-logins.txt (mode 600). It is never printed.
// Safe to run twice: if the test email exists it does nothing.
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const OUT = process.env.TEST_LOGINS_FILE || '/root/afra-test-logins.txt';
const EMAIL = 'test.fit@afraventures.in';
const PHONE = '9000000001'; // fake, not a real person

(async () => {
  if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is not set. Use --env-file.'); process.exit(1); }
  await mongoose.connect(process.env.MONGODB_URI);
  const Admin = require('../models/Admin');
  const Subscriber = require('../models/Subscriber');
  const { trialDates } = require('../services/subscription');

  if (await Admin.findOne({ $or: [{ email: EMAIL }, { phone: PHONE }] }).select('_id')) {
    console.log('fit: test gym owner already exists, nothing changed');
    return mongoose.disconnect();
  }
  const password = crypto.randomBytes(14).toString('base64').replace(/[/+=]/g, '').slice(0, 16) + 'Aa1';
  const subscriber = await Subscriber.create({ gymName: 'Test Gym (fake data)', state: 'Puducherry', ...trialDates() });
  try {
    await Admin.create({ subscriberId: subscriber._id, name: 'Test Owner', email: EMAIL, phone: PHONE, passwordHash: await bcrypt.hash(password, 10) });
  } catch (e) { await Subscriber.deleteOne({ _id: subscriber._id }); throw e; }

  fs.writeFileSync(OUT, `https://fit.afraventures.in   email: ${EMAIL}   password: ${password}\n`, { flag: 'a', mode: 0o600 });
  try { fs.chmodSync(OUT, 0o600); } catch (_) {}
  console.log(`fit: test gym owner created (${EMAIL}). Login saved in ${OUT} (read it with: cat ${OUT}). Do not paste it into chat or git.`);
  await mongoose.disconnect();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
