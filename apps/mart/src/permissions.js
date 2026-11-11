'use strict';
// Who may do what in Mart (area 2: roles and permissions). Four roles: admin (the owner), subadmin (a manager), cashier, stockkeeper.
// Server-side only: hiding a button is not access control. A route nobody listed is refused for everyone except the owner.
const ROLES = ['admin', 'subadmin', 'cashier', 'stockkeeper'];
const TEAM_ROLES = ['subadmin', 'cashier', 'stockkeeper']; // roles the owner can give to a new login
const GRANTS = {
  admin: null, // everything
  subadmin: ['settings', 'udhaar', 'stock', 'reports', 'dayclose', 'accounts', 'purchases', 'bill', 'items', 'itemsRead', 'returns', 'attendance'],
  cashier: ['bill', 'udhaar', 'dayclose', 'itemsRead'],
  stockkeeper: ['stock', 'purchases', 'items', 'itemsRead'],
};
const can = (role, perm) => (role === 'admin' ? true : Array.isArray(GRANTS[role]) && GRANTS[role].includes(perm));

// Mart's own routes: [method or '*', path pattern, permission]. First match wins.
const RULES = [
  ['*', /^\/settings$/, 'settings'], ['*', /^\/festivals(\/|$)/, 'settings'],
  ['*', /^\/udhaar(\/|$)/, 'udhaar'],
  ['*', /^\/reports\/(reorder|expiry|dead-stock|stock-check)$/, 'stock'],
  ['*', /^\/(day-close|day-closes)$/, 'dayclose'],
  ['*', /^\/(expenses|reports\/expenses)$/, 'accounts'], ['*', /^\/(suppliers\/[^/]+\/pay|supplier-payments)$/, 'accounts'],
  ['*', /^\/(suppliers|purchases)(\/|$)/, 'purchases'],
  ['*', /^\/(reports|summary|marketing)(\/|$)/, 'reports'],
  ['*', /^\/audit$/, 'audit'], ['*', /^\/privacy(\/|$)/, 'privacy'], ['*', /^\/team(\/|$)/, 'team'],
  ['*', /^\/(attendance)(\/|$)/, 'attendance'], ['*', /^\/(staff|advances|payroll)(\/|$)/, 'payroll'],
  ['*', /^\/upi(\/|$)/, 'bill'],
];
const permFor = (method, path) => { for (const [m, re, perm] of RULES) if ((m === '*' || m === method) && re.test(path)) return perm; return null; };

// The shared shop features mounted at /pos (core-pos routes).
const POS_RULES = [
  ['GET', /^\/items(\/|$)/, 'itemsRead'], ['*', /^\/(items|import\/items|reports)(\/|$)/, 'items'],
  ['*', /^\/bills\/[^/]+\/return/, 'returns'], ['*', /^\/(bills|customers|import\/customers)(\/|$)/, 'bill'],
];
const posPermFor = (method, path) => { for (const [m, re, perm] of POS_RULES) if ((m === '*' || m === method) && re.test(path)) return perm; return null; };

// Express middleware factory. Owner passes everything; a listed permission must be granted; an unlisted route is owner-only.
const gate = (lookup) => (req, res, next) => {
  const role = req.user && req.user.role; if (role === 'admin') return next();
  const perm = lookup(req.method, req.path);
  return perm && can(role, perm) ? next() : res.status(403).json({ success: false, message: 'Your role cannot do this. Ask the owner.' });
};
module.exports = { ROLES, TEAM_ROLES, GRANTS, can, permFor, posPermFor, gate };
