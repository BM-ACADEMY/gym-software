const QRCode = require('qrcode');

// Encodes the pair the Attendance module needs to identify a member on scan.
// Kept as plain JSON (not signed/encrypted) since the QR is only ever read
// back by a staff-operated scanner inside the same tenant's app.
const buildMemberQrPayload = (subscriberId, memberId) =>
  JSON.stringify({ sid: String(subscriberId), mid: String(memberId) });

const generateMemberQrDataUrl = async (subscriberId, memberId) => {
  const payload = buildMemberQrPayload(subscriberId, memberId);
  return QRCode.toDataURL(payload, { margin: 1, width: 240 });
};

module.exports = { buildMemberQrPayload, generateMemberQrDataUrl };
