const PTPackage = require('../../models/PTPackage');

// @desc    List PT packages for this gym
// @route   GET /api/admin/pt-packages
const listPackages = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const query = { subscriberId: req.user.subscriberId };
    if (activeOnly) query.isActive = true;
    const packages = await PTPackage.find(query).sort({ price: 1 });
    res.status(200).json({ success: true, message: 'PT packages fetched successfully', data: packages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create a PT package
// @route   POST /api/admin/pt-packages
const createPackage = async (req, res) => {
  try {
    const { name, sessionCount, price } = req.body;
    if (!name || !sessionCount || sessionCount < 1 || !price || price <= 0) {
      return res.status(400).json({ success: false, message: 'name, a positive sessionCount, and a positive price are required' });
    }
    const pkg = await PTPackage.create({ subscriberId: req.user.subscriberId, name, sessionCount, price });
    res.status(201).json({ success: true, message: 'PT package created successfully', data: pkg });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Toggle a package active/inactive (doesn't affect existing purchases)
// @route   PATCH /api/admin/pt-packages/:id/toggle
const togglePackage = async (req, res) => {
  try {
    const pkg = await PTPackage.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId });
    if (!pkg) return res.status(404).json({ success: false, message: 'PT package not found' });
    pkg.isActive = !pkg.isActive;
    await pkg.save();
    res.status(200).json({ success: true, message: `Package ${pkg.isActive ? 'activated' : 'deactivated'}`, data: pkg });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listPackages, createPackage, togglePackage };
