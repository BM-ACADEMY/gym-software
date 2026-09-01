const express = require('express');
const router = express.Router();
const { listFeatures, createFeature, updateFeature, toggleFeature } = require('../../controllers/rootAdmin/planFeatures');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('root_admin'));

router.get('/', listFeatures);
router.post('/', createFeature);
router.put('/:id', updateFeature);
router.patch('/:id/toggle', toggleFeature);

module.exports = router;
