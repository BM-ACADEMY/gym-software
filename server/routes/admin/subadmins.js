const express = require('express');
const router = express.Router();
const { listSubAdmins, createSubAdmin, updateSubAdmin, toggleSubAdmin, getAuditLog } = require('../../controllers/admin/subadmins');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/audit-log', getAuditLog);
router.get('/', listSubAdmins);
router.post('/', createSubAdmin);
router.put('/:id', updateSubAdmin);
router.patch('/:id/toggle', toggleSubAdmin);

module.exports = router;
