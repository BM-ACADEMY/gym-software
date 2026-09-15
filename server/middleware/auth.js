const jwt = require('jsonwebtoken');
const Subscriber = require('../models/Subscriber');

const SUSPENDABLE_ROLES = ['admin', 'subadmin', 'member'];

// The one write a suspended gym's owner must still be able to make — asking
// to be reactivated. Matched on the request path so it isn't tied to a
// specific role's router mount depth.
const isSupportTicketWrite = (req) =>
  req.method === 'POST' && /\/support\/?$/.test(req.originalUrl.split('?')[0]);

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Contains { id, role, subscriberId }

    // A suspended gym (Root Admin → Subscriber Management → Suspend) locks
    // every one of its users — owner, staff, and members — into read-only
    // access: GETs still work so they can see their data, but every write
    // is blocked here, before it ever reaches a controller. Two exceptions:
    // Root Admin's own impersonation session (support/troubleshooting), and
    // submitting a support ticket — the one way to ask for reactivation.
    if (SUSPENDABLE_ROLES.includes(decoded.role) && decoded.subscriberId) {
      const subscriber = await Subscriber.findById(decoded.subscriberId).select('isActive');
      const suspended = Boolean(subscriber && subscriber.isActive === false);
      res.setHeader('X-Gym-Suspended', String(suspended));

      if (suspended && req.method !== 'GET' && !decoded.impersonatedBy && !isSupportTicketWrite(req)) {
        return res.status(403).json({
          success: false,
          suspended: true,
          message: 'This gym has been suspended. You can still view existing data, but changes are disabled until it is reactivated.',
        });
      }
    }

    next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user ? req.user.role : 'unknown'} is not authorized to access this route`
      });
    }
    next();
  };
};

module.exports = {
  protect,
  authorize
};
