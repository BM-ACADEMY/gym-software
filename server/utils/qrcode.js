const crypto = require('crypto');
const QRCode = require('qrcode');

// The member's check-in QR carries gym id, member id and a signature, so a QR
// cannot be made up by someone who only knows the ids. The key is QR_SECRET
// (falls back to JWT_SECRET). Rotating the key invalidates every printed QR.
const secret = () => process.env.QR_SECRET || process.env.JWT_SECRET || 'dev-only-qr-secret';

const sign = (sid, mid) => crypto.createHmac('sha256', secret()).update(`${sid}.${mid}`).digest('hex').slice(0, 32);

const buildMemberQrPayload = (subscriberId, memberId) => {
  const sid = String(subscriberId);
  const mid = String(memberId);
  return JSON.stringify({ sid, mid, sig: sign(sid, mid) });
};

// Returns { sid, mid } for a genuine payload object, or null.
const verifyMemberQr = (parsed) => {
  if (!parsed || typeof parsed.sid !== 'string' || typeof parsed.mid !== 'string' || typeof parsed.sig !== 'string') return null;
  const expected = Buffer.from(sign(parsed.sid, parsed.mid));
  const given = Buffer.from(parsed.sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  return { sid: parsed.sid, mid: parsed.mid };
};

const generateMemberQrDataUrl = async (subscriberId, memberId) => {
  const payload = buildMemberQrPayload(subscriberId, memberId);
  return QRCode.toDataURL(payload, { margin: 1, width: 240 });
};

module.exports = { buildMemberQrPayload, verifyMemberQr, generateMemberQrDataUrl };
