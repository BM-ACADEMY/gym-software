const express = require('express');
const router = express.Router();
const { listPackages, createPackage, togglePackage } = require('../../controllers/admin/ptPackages');
const { protect, authorize } = require('../../middleware/auth');
const { codeFeatureGuard } = require('../../middleware/planFeatureGuard');

router.use(protect, authorize('admin'), codeFeatureGuard('pt-sessions'));

router.get('/', listPackages);
router.post('/', createPackage);
router.patch('/:id/toggle', togglePackage);

module.exports = router;
