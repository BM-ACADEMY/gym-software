const express = require('express');
const router = express.Router();
const { getMySettings, updateMySettings } = require('../../controllers/member/settings');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('member'));

router.get('/', getMySettings);
router.put('/', updateMySettings);

module.exports = router;
