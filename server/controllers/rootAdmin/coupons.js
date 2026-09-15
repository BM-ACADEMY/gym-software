const Coupon = require('../../models/Coupon');
const { validateCoupon } = require('../../utils/coupon');

// Create a new coupon
const createCoupon = async (req, res) => {
  try {
    const { code, discountType, discountValue, applicablePlanIds, expiresAt, usageLimit, isActive } = req.body;

    // Check if code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists' });
    }

    const coupon = new Coupon({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      applicablePlanIds: applicablePlanIds || [],
      expiresAt: expiresAt || null,
      usageLimit: usageLimit || null,
      isActive: isActive !== undefined ? isActive : true,
    });

    await coupon.save();

    res.status(201).json({ success: true, message: 'Coupon created successfully', data: coupon });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error while creating coupon' });
  }
};

// Get all coupons and compute analytics
const getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).populate('redemptions.subscriberId', 'gymName');

    // Calculate analytics
    const totalCoupons = coupons.length;
    const activeCoupons = coupons.filter((c) => c.isActive).length;
    const totalRedemptions = coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        coupons,
        analytics: {
          totalCoupons,
          activeCoupons,
          totalRedemptions,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error while fetching coupons' });
  }
};

// Update an existing coupon
const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, discountType, discountValue, applicablePlanIds, expiresAt, usageLimit, isActive } = req.body;

    // Check if new code exists and is not the current coupon
    if (code) {
      const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
      if (existingCoupon && existingCoupon._id.toString() !== id) {
        return res.status(400).json({ success: false, message: 'Coupon code already exists' });
      }
    }

    const updatedData = {
      ...(code && { code: code.toUpperCase() }),
      ...(discountType && { discountType }),
      ...(discountValue !== undefined && { discountValue }),
      ...(applicablePlanIds && { applicablePlanIds }),
      ...(expiresAt !== undefined && { expiresAt }),
      ...(usageLimit !== undefined && { usageLimit }),
      ...(isActive !== undefined && { isActive }),
    };

    const coupon = await Coupon.findByIdAndUpdate(id, updatedData, { new: true });

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    res.status(200).json({ success: true, message: 'Coupon updated successfully', data: coupon });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error while updating coupon' });
  }
};

// Delete a coupon
const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndDelete(id);

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error while deleting coupon' });
  }
};

// Toggle coupon status (active/inactive)
const toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.status(200).json({ success: true, message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'}`, data: coupon });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error while toggling coupon status' });
  }
};

// Preview eligibility/discount without redeeming — for testing and for a
// future checkout UI to check a code before charging.
const previewCoupon = async (req, res) => {
  try {
    const { planId, amount } = req.body;
    const result = await validateCoupon(req.params.code, { planId, amount });
    res.status(200).json({ success: true, message: result.valid ? 'Coupon is valid' : result.message, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error while validating coupon' });
  }
};

module.exports = {
  createCoupon,
  getCoupons,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  previewCoupon,
};
