const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const PromoCode = require('../../models/PromoCode');

const str = (v) => (typeof v === 'string' ? v : '');
const PLAN_KEYS = ['solo', 'starter', 'growth', 'pro'];

const clean = (b) => {
  const out = {};
  if (b.code !== undefined) out.code = str(b.code).trim().toUpperCase();
  if (b.kind !== undefined) out.kind = str(b.kind);
  if (b.ownerLabel !== undefined) out.ownerLabel = str(b.ownerLabel).trim().slice(0, 80);
  if (b.percentOff !== undefined) out.percentOff = Number(b.percentOff);
  if (b.firstPaymentOnly !== undefined) out.firstPaymentOnly = b.firstPaymentOnly === true;
  if (b.planKeys !== undefined) out.planKeys = Array.isArray(b.planKeys) ? b.planKeys.filter((k) => PLAN_KEYS.includes(k)) : [];
  if (b.maxRedemptions !== undefined) out.maxRedemptions = b.maxRedemptions ? Number(b.maxRedemptions) : undefined;
  if (b.expiresAt !== undefined) out.expiresAt = b.expiresAt ? new Date(b.expiresAt) : undefined;
  if (b.isActive !== undefined) out.isActive = b.isActive === true;
  if (b.note !== undefined) out.note = str(b.note).slice(0, 200);
  return out;
};

const guard = [protect, authorize('root_admin')];

router.get('/', guard, async (req, res) => {
  const list = await PromoCode.find().sort({ createdAt: -1 }).limit(500);
  res.json({ success: true, data: list });
});

router.post('/', guard, async (req, res) => {
  try {
    const promo = await PromoCode.create(clean(req.body));
    res.status(201).json({ success: true, data: promo });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ success: false, message: 'That code already exists' });
    if (e.name === 'ValidationError') return res.status(400).json({ success: false, message: 'Check the code (3-24 letters, numbers, - or _) and a discount of 1 to 50%' });
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// The code itself cannot change after it is made; use a new code instead.
router.patch('/:id', guard, async (req, res) => {
  try {
    const body = clean(req.body);
    delete body.code;
    const promo = await PromoCode.findByIdAndUpdate(req.params.id, { $set: body }, { new: true, runValidators: true });
    if (!promo) return res.status(404).json({ success: false, message: 'Code not found' });
    res.json({ success: true, data: promo });
  } catch (e) {
    if (e.name === 'ValidationError' || e.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid values' });
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
