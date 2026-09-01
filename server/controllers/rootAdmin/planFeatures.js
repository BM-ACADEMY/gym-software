const PlanFeature = require('../../models/PlanFeature');

// @desc    List the feature catalog (active + archived)
// @route   GET /api/root-admin/plan-features
const listFeatures = async (req, res) => {
  try {
    const features = await PlanFeature.find().sort({ createdAt: 1 });
    res.status(200).json({ success: true, data: features });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Add a feature to the catalog
// @route   POST /api/root-admin/plan-features
const createFeature = async (req, res) => {
  try {
    const { name, type, unit } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    const feature = await PlanFeature.create({
      name,
      type: type === 'count' ? 'count' : 'toggle',
      unit: type === 'count' ? unit : undefined,
    });

    res.status(201).json({ success: true, data: feature });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A feature with that name already exists' });
    }
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update a catalog feature
// @route   PUT /api/root-admin/plan-features/:id
const updateFeature = async (req, res) => {
  try {
    const { name, type, unit } = req.body;

    const feature = await PlanFeature.findByIdAndUpdate(
      req.params.id,
      {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        unit: type === 'count' ? unit : undefined,
      },
      { new: true, runValidators: true }
    );

    if (!feature) {
      return res.status(404).json({ success: false, message: 'Feature not found' });
    }

    res.status(200).json({ success: true, data: feature });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Archive/restore a catalog feature — plans already referencing it keep their data.
// @route   PATCH /api/root-admin/plan-features/:id/toggle
const toggleFeature = async (req, res) => {
  try {
    const feature = await PlanFeature.findById(req.params.id);
    if (!feature) {
      return res.status(404).json({ success: false, message: 'Feature not found' });
    }

    feature.isActive = !feature.isActive;
    await feature.save();

    res.status(200).json({ success: true, data: feature });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listFeatures, createFeature, updateFeature, toggleFeature };
