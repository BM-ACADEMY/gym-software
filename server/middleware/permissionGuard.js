const SubAdmin = require('../models/SubAdmin');

// Gates a route by the logged-in sub-admin's permissions map for a given module.
// Must run after `protect` (needs req.user.id/role). Root Admin and Admin (Gym Owner)
// bypass this entirely — they always have full access to their own routes.
//
// Usage: router.get('/', protect, authorize('admin', 'subadmin'), permissionGuard('members', 'view'), handler)
const permissionGuard = (moduleKey, requiredLevel = 'view') => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    // Only sub-admins are actually gated by the permission matrix.
    if (req.user.role !== 'subadmin') {
      return next();
    }

    try {
      const subAdmin = await SubAdmin.findById(req.user.id);

      if (!subAdmin || !subAdmin.isActive) {
        return res.status(403).json({ success: false, message: 'Sub-admin account is inactive' });
      }

      const modulePermission = subAdmin.permissions?.get?.(moduleKey) || subAdmin.permissions?.[moduleKey];
      const hasAccess = requiredLevel === 'edit' ? Boolean(modulePermission?.edit) : Boolean(modulePermission?.view);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `You do not have ${requiredLevel} access to the "${moduleKey}" module`,
        });
      }

      req.subAdmin = subAdmin;
      next();
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
};

module.exports = permissionGuard;
