const express = require('express');
const router = express.Router();
const { listPackages, createPackage, togglePackage } = require('../../controllers/admin/ptPackages');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/', listPackages);
router.post('/', createPackage);
router.patch('/:id/toggle', togglePackage);

module.exports = router;
