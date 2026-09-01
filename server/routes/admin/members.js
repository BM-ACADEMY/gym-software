const express = require('express');
const router = express.Router();
const {
  listMembers,
  listPlansLookup,
  listStaffLookup,
  getMember,
  createMember,
  updateMember,
  bulkUpdateStatus,
} = require('../../controllers/admin/members');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/meta/plans', listPlansLookup);
router.get('/meta/staff', listStaffLookup);
router.patch('/bulk-status', bulkUpdateStatus);

router.get('/', listMembers);
router.post('/', createMember);
router.get('/:id', getMember);
router.put('/:id', updateMember);

module.exports = router;
