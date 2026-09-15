const express = require('express');
const router = express.Router();
const { listTrials, createTrial, updateTrial, convertTrial } = require('../../controllers/admin/trial');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/', listTrials);
router.post('/', createTrial);
router.put('/:id', updateTrial);
router.patch('/:id/convert', convertTrial);

module.exports = router;
