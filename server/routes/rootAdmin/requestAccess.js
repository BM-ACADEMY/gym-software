const express = require('express');
const router = express.Router();
const { listRequests, approveRequest, rejectRequest } = require('../../controllers/rootAdmin/requestAccess');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('root_admin'));

router.get('/', listRequests);
router.patch('/:id/approve', approveRequest);
router.patch('/:id/reject', rejectRequest);

module.exports = router;
