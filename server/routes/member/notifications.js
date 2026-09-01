const express = require('express');
const router = express.Router();
const { handleRequest } = require('../../controllers/member/notifications');
const { protect, authorize } = require('../../middleware/auth');

router.get('/', protect, authorize('member'), handleRequest);

module.exports = router;
