const express = require('express');
const router = express.Router();
const { handleRequest } = require('../../controllers/rootAdmin/dashboard');
const { protect, authorize } = require('../../middleware/auth');

router.get('/', protect, authorize('root_admin'), handleRequest);

module.exports = router;
