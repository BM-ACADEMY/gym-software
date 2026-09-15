const express = require('express');
const router = express.Router();
const { getGymSettings, updateGymSettings, updateAdminProfile } = require('../../controllers/admin/settings');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/', getGymSettings);
router.put('/gym', updateGymSettings);
router.put('/profile', updateAdminProfile);

module.exports = router;
