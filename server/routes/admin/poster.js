const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const { protect, authorize } = require('../../middleware/auth');
const Subscriber = require('../../models/Subscriber');

router.use(protect, authorize('admin'));

const appUrl = () => {
  const direct = (process.env.CLIENT_URL || '').trim();
  const first = (process.env.CORS_ORIGINS || '').split(',')[0].trim();
  return (direct || first).replace(/\/$/, '');
};

// GET /api/admin/poster: data for the printable entrance poster. The QR opens the
// member sign-in page (the web app), where a member taps "Check in". It holds no secrets.
router.get('/', async (req, res) => {
  try {
    const base = appUrl();
    if (!base) return res.status(503).json({ success: false, message: 'The app address is not set on the server yet (CLIENT_URL). Ask your developer.' });
    const sub = await Subscriber.findById(req.user.subscriberId).select('gymName logoUrl brandColor');
    if (!sub) return res.status(404).json({ success: false, message: 'Gym not found' });
    const url = `${base}/login`;
    const qr = await QRCode.toDataURL(url, { margin: 2, width: 640, errorCorrectionLevel: 'M' });
    res.json({ success: true, data: { gymName: sub.gymName, url, qr } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
