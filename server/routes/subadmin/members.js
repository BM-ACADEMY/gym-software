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
const permissionGuard = require('../../middleware/permissionGuard');

router.use(protect, authorize('subadmin'));

router.get('/meta/plans', permissionGuard('members', 'view'), listPlansLookup);
router.get('/meta/staff', permissionGuard('members', 'view'), listStaffLookup);
router.patch('/bulk-status', permissionGuard('members', 'edit'), bulkUpdateStatus);

router.get('/', permissionGuard('members', 'view'), listMembers);
router.post('/', permissionGuard('members', 'edit'), createMember);
router.get('/:id', permissionGuard('members', 'view'), getMember);
router.put('/:id', permissionGuard('members', 'edit'), updateMember);

module.exports = router;
