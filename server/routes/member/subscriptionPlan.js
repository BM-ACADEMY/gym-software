const express = require('express');
const router = express.Router();
const {
  getSubscription,
  renewSubscription,
  freezeSubscription,
  unfreezeSubscription,
} = require('../../controllers/member/subscriptionPlan');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('member'));

router.get('/', getSubscription);
router.post('/renew', renewSubscription);
router.post('/freeze', freezeSubscription);
router.post('/unfreeze', unfreezeSubscription);

module.exports = router;
