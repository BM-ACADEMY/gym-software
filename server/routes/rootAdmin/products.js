const express = require('express');
const router = express.Router();
const { getProducts } = require('../../controllers/rootAdmin/products');
const { protect, authorize } = require('../../middleware/auth');

router.get('/', protect, authorize('root_admin'), getProducts);

module.exports = router;
