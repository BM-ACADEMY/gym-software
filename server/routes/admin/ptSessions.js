const express = require('express');
const router = express.Router();
const { bookSession, listSessions, rescheduleSession, cancelSession, completeSession, noShowSession, suggestSlots, listActivePackages, sellPackage, listMemberPackages } = require('../../controllers/admin/ptSessions');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/suggest-slots', suggestSlots);
router.get('/packages', listActivePackages);
router.get('/member-packages', listMemberPackages);
router.post('/sell-package', sellPackage);
router.get('/', listSessions);
router.post('/', bookSession);
router.put('/:id/reschedule', rescheduleSession);
router.patch('/:id/cancel', cancelSession);
router.patch('/:id/complete', completeSession);
router.patch('/:id/no-show', noShowSession);

module.exports = router;
