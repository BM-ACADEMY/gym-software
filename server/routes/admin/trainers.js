const express = require('express');
const router = express.Router();
const { listTrainers, getTrainerMembers, updateTrainer, assignMember } = require('../../controllers/admin/trainers');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('admin'));

router.patch('/assign', assignMember);
router.get('/', listTrainers);
router.get('/:id/members', getTrainerMembers);
router.put('/:id', updateTrainer);

module.exports = router;
