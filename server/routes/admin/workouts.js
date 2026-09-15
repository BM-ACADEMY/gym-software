const express = require('express');
const router = express.Router();
const { listTemplates, createTemplate, updateTemplate, getMemberWorkout, assignMemberWorkout } = require('../../controllers/admin/workouts');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/templates', listTemplates);
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);
router.get('/member/:memberId', getMemberWorkout);
router.put('/member/:memberId', assignMemberWorkout);

module.exports = router;
