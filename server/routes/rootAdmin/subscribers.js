const express = require('express');
const router = express.Router();
const {
  listSubscribers, getSubscriberDetail, overrideSubscriberPlan, suspendSubscriber, activateSubscriber, deleteSubscriber, restoreSubscriber, purgeSubscriber, impersonateSubscriber,
} = require('../../controllers/rootAdmin/subscribers');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('root_admin'));

router.get('/', listSubscribers);
router.get('/:id', getSubscriberDetail);
router.patch('/:id/plan', overrideSubscriberPlan);
router.patch('/:id/suspend', suspendSubscriber);
router.patch('/:id/activate', activateSubscriber);
router.delete('/:id', deleteSubscriber);
router.post('/:id/restore', restoreSubscriber);
router.delete('/:id/permanent', purgeSubscriber);
router.post('/:id/impersonate', impersonateSubscriber);

module.exports = router;
