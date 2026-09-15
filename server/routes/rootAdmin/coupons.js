const express = require('express');
const router = express.Router();
const {
  createCoupon,
  getCoupons,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  previewCoupon,
} = require('../../controllers/rootAdmin/coupons');
const { protect, authorize } = require('../../middleware/auth');

router.post('/', protect, authorize('root_admin'), createCoupon);
router.get('/', protect, authorize('root_admin'), getCoupons);
router.put('/:id', protect, authorize('root_admin'), updateCoupon);
router.delete('/:id', protect, authorize('root_admin'), deleteCoupon);
router.patch('/:id/toggle', protect, authorize('root_admin'), toggleCouponStatus);
router.post('/:code/preview', protect, authorize('root_admin'), previewCoupon);

module.exports = router;
