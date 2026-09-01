const AuditLog = require('../models/AuditLog');

// Fire-and-forget audit write — an audit failure must never break the
// business operation it's describing, so errors are logged, not thrown.
const logAudit = async ({ subscriberId, actingRole, actingUserId, module, action, targetId }) => {
  try {
    await AuditLog.create({ subscriberId, actingRole, actingUserId, module, action, targetId });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};

module.exports = { logAudit };
