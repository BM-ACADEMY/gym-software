const express = require('express');
const router = express.Router();
const { listPlans, createPlan, updatePlan, togglePlan } = require('../../controllers/admin/planCreation');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/', listPlans);
router.post('/', createPlan);
router.put('/:id', updatePlan);
router.patch('/:id/toggle', togglePlan);

module.exports = router;
