const express = require('express');
const router = express.Router();
const { getUsage, setBudget } = require('../../controllers/rootAdmin/usage');
const { protect, authorize } = require('../../middleware/auth');

router.get('/', protect, authorize('root_admin'), getUsage);
router.put('/budget', protect, authorize('root_admin'), setBudget);

module.exports = router;
