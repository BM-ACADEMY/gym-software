const express = require('express');
const router = express.Router();
const { bookSession, listSessions, rescheduleSession, cancelSession, completeSession, noShowSession, suggestSlots, listActivePackages, sellPackage, listMemberPackages } = require('../../controllers/admin/ptSessions');
const { protect, authorize } = require('../../middleware/auth');
const permissionGuard = require('../../middleware/permissionGuard');

router.use(protect, authorize('subadmin'));

router.get('/suggest-slots', permissionGuard('pt-sessions', 'view'), suggestSlots);
router.get('/packages', permissionGuard('pt-sessions', 'view'), listActivePackages);
router.get('/member-packages', permissionGuard('pt-sessions', 'view'), listMemberPackages);
router.post('/sell-package', permissionGuard('pt-sessions', 'edit'), sellPackage);
router.get('/', permissionGuard('pt-sessions', 'view'), listSessions);
router.post('/', permissionGuard('pt-sessions', 'edit'), bookSession);
router.put('/:id/reschedule', permissionGuard('pt-sessions', 'edit'), rescheduleSession);
router.patch('/:id/cancel', permissionGuard('pt-sessions', 'edit'), cancelSession);
router.patch('/:id/complete', permissionGuard('pt-sessions', 'edit'), completeSession);
router.patch('/:id/no-show', permissionGuard('pt-sessions', 'edit'), noShowSession);

module.exports = router;
