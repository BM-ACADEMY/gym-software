const RootAdmin = require('../../models/RootAdmin');

const PERMISSION_LEVELS = ['full', 'support', 'billing'];

// @desc    List access requests (pending by default, or any status)
// @route   GET /api/root-admin/request-access
const listRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : { status: 'pending' };
    const requests = await RootAdmin.find(query).select('-passwordHash -otpCode -otpExpiresAt').sort({ createdAt: -1 });
    res.status(200).json({ success: true, message: 'Requests fetched successfully', data: requests });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Approve a pending Root Admin request, setting their permission level
// @route   PATCH /api/root-admin/request-access/:id/approve
const approveRequest = async (req, res) => {
  try {
    const { permissionLevel } = req.body;
    if (permissionLevel && !PERMISSION_LEVELS.includes(permissionLevel)) {
      return res.status(400).json({ success: false, message: `permissionLevel must be one of ${PERMISSION_LEVELS.join(', ')}` });
    }

    const requestDoc = await RootAdmin.findById(req.params.id);
    if (!requestDoc) return res.status(404).json({ success: false, message: 'Request not found' });
    if (requestDoc.status !== 'pending') return res.status(400).json({ success: false, message: `Already ${requestDoc.status}` });

    requestDoc.status = 'approved';
    requestDoc.permissionLevel = permissionLevel || 'full';
    await requestDoc.save();

    res.status(200).json({ success: true, message: `${requestDoc.name} approved`, data: { id: requestDoc._id, status: requestDoc.status, permissionLevel: requestDoc.permissionLevel } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Reject a pending Root Admin request
// @route   PATCH /api/root-admin/request-access/:id/reject
const rejectRequest = async (req, res) => {
  try {
    const requestDoc = await RootAdmin.findById(req.params.id);
    if (!requestDoc) return res.status(404).json({ success: false, message: 'Request not found' });
    if (requestDoc.status !== 'pending') return res.status(400).json({ success: false, message: `Already ${requestDoc.status}` });

    requestDoc.status = 'rejected';
    await requestDoc.save();

    res.status(200).json({ success: true, message: `${requestDoc.name} rejected`, data: { id: requestDoc._id, status: requestDoc.status } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listRequests, approveRequest, rejectRequest };
