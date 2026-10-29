#!/usr/bin/env node
'use strict';
// Run on the server by the owner: node apps/admin/scripts/create-admin.js --email you@afraventures.in [--role marketing]
// Asks for the password twice at a hidden prompt (never an argument, never printed). Prints the two-step secret and
// recovery codes ONCE. Needs ADMIN_MFA_KEY and ADMIN_USERS_FILE in the environment.
const crypto = require('crypto');
const readline = require('readline');
const C = require('../src/auth/crypto');
const { fileStore } = require('../src/auth/store');

const arg = (n) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
function hidden(q) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(s); }; // hide typing
    rl.question(q, (a) => { rl.close(); process.stdout.write('\n'); resolve(a); });
  });
}
(async () => {
  const email = String(arg('email') || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Give --email you@example.com');
  if (!process.env.ADMIN_USERS_FILE || !process.env.ADMIN_MFA_KEY) throw new Error('Set ADMIN_USERS_FILE and ADMIN_MFA_KEY first');
  const role = arg('role') || 'root_admin';
  if (!['root_admin', 'marketing'].includes(role)) throw new Error('--role must be root_admin or marketing');
  const p1 = await hidden('Password (12+ characters): '); const p2 = await hidden('Again: ');
  if (p1 !== p2) throw new Error('Passwords did not match');
  const secret = C.newTotpSecret();
  const recovery = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex'));
  await fileStore(process.env.ADMIN_USERS_FILE).save({ email, role, passwordHash: C.hashPassword(p1), totpSecretEnc: C.encrypt(secret, process.env.ADMIN_MFA_KEY), recoveryHashes: recovery.map(C.sha256), lastTotpStep: 0, createdAt: new Date().toISOString() });
  console.log('\nUser saved.\nAdd this to your authenticator app (shown once):\n  ' + C.otpauthUri(email, secret) + '\n  Secret: ' + secret + '\nRecovery codes (store in the password manager, each works once):\n  ' + recovery.join('\n  '));
})().catch((e) => { console.error('Stopped: ' + e.message); process.exit(1); });
