const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const Subscriber = require('../../models/Subscriber');
const Lead = require('../../models/Lead');
const L = require('../../services/leadRules');

router.use(protect, authorize('admin'));

const isId = (id) => mongoose.isValidObjectId(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
const row = (l, full) => ({
  id: String(l._id), name: l.name, phone: full ? l.phone : L.maskPhone(l.phone), goal: l.goal || '', note: l.note || '', source: l.source, status: l.status,
  nextFollowUpAt: l.nextFollowUpAt || null, enquiries: l.enquiries, createdAt: l.createdAt, needsAttention: L.needsAttention(l),
});
const fail = (res, error) => { console.error(error); res.status(500).json({ success: false, message: 'Server error' }); };

// GET /api/admin/leads?status=new&page=1 : the gym's own leads, numbers masked
router.get('/', async (req, res) => {
  try {
    const q = { subscriberId: req.user.subscriberId };
    if (typeof req.query.status === 'string' && req.query.status !== 'all') {
      if (!L.STATUSES.includes(req.query.status)) return res.status(400).json({ success: false, message: 'Unknown status.' });
      q.status = req.query.status;
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const [items, total, counts] = await Promise.all([
      Lead.find(q).sort({ createdAt: -1 }).skip((page - 1) * 50).limit(50).lean(),
      Lead.countDocuments(q),
      Lead.aggregate([{ $match: { subscriberId: new mongoose.Types.ObjectId(req.user.subscriberId) } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: { items: items.map((l) => row(l, false)), total, page, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) } });
  } catch (error) { fail(res, error); }
});

// GET /api/admin/leads/form-link : the gym's public enquiry link (made on first ask)
router.get('/form-link', async (req, res) => {
  try {
    let sub = await Subscriber.findById(req.user.subscriberId).select('leadFormKey');
    if (!sub) return res.status(404).json({ success: false, message: 'Gym not found' });
    if (!sub.leadFormKey) { sub.leadFormKey = crypto.randomBytes(18).toString('base64url'); await sub.save(); }
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: { key: sub.leadFormKey, path: `/join/${sub.leadFormKey}`, base: process.env.CLIENT_URL || '' } });
  } catch (error) { fail(res, error); }
});

// POST /api/admin/leads/form-link/replace : a new link; the old one stops working at once
router.post('/form-link/replace', async (req, res) => {
  try {
    const sub = await Subscriber.findById(req.user.subscriberId).select('leadFormKey');
    if (!sub) return res.status(404).json({ success: false, message: 'Gym not found' });
    sub.leadFormKey = crypto.randomBytes(18).toString('base64url'); await sub.save();
    res.json({ success: true, data: { key: sub.leadFormKey, path: `/join/${sub.leadFormKey}`, base: process.env.CLIENT_URL || '' } });
  } catch (error) { fail(res, error); }
});

// POST /api/admin/leads : the owner adds a walk-in or phone enquiry by hand
router.post('/', async (req, res) => {
  try {
    const c = L.checkNewLead(req.body);
    if (!c.ok) return res.status(400).json({ success: false, message: c.message });
    const dup = await Lead.findOne({ subscriberId: req.user.subscriberId, phone: c.value.phone }).select('_id');
    if (dup) return res.status(409).json({ success: false, message: 'This number is already in your leads.' });
    const lead = await Lead.create({ subscriberId: req.user.subscriberId, ...c.value, source: ['walkin', 'phone', 'instagram', 'other'].includes(req.body.source) ? req.body.source : 'walkin' });
    res.status(201).json({ success: true, data: row(lead, false) });
  } catch (error) { if (error.code === 11000) return res.status(409).json({ success: false, message: 'This number is already in your leads.' }); fail(res, error); }
});

// GET /api/admin/leads/:id : one lead with the whole number (to call or message)
router.get('/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Lead not found' });
    const lead = await Lead.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId }).lean();
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: row(lead, true) });
  } catch (error) { fail(res, error); }
});

// PATCH /api/admin/leads/:id : status, note, follow-up date only
router.patch('/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Lead not found' });
    const c = L.checkLeadUpdate(req.body);
    if (!c.ok) return res.status(400).json({ success: false, message: c.message });
    const lead = await Lead.findOneAndUpdate({ _id: req.params.id, subscriberId: req.user.subscriberId }, { $set: c.value }, { new: true });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({ success: true, data: row(lead, false) });
  } catch (error) { fail(res, error); }
});

// DELETE /api/admin/leads/:id : remove a lead (for example a person who asked to be forgotten)
router.delete('/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Lead not found' });
    const r = await Lead.deleteOne({ _id: req.params.id, subscriberId: req.user.subscriberId });
    if (!r.deletedCount) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({ success: true });
  } catch (error) { fail(res, error); }
});

module.exports = router;
