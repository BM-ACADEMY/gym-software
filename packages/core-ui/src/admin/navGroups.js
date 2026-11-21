// Puts a long panel menu under a few plain headings. Order of the headings is fixed; inside a heading the manifest order is kept.
// A manifest item can set its own `group`; otherwise the key decides. Anything unknown goes under "More".
export const GROUP_ORDER = ['Daily', 'People', 'Catalogue', 'Money', 'Reports', 'Grow', 'Team', 'More'];
const BY_KEY = {
  Daily: ['start', 'setup', 'today', 'appointments', 'reminders', 'orders', 'jobs', 'bookings', 'bookinglink', 'pipeline', 'interviews', 'alterations', 'dayclose', 'closing', 'photos', 'autopilot'],
  People: ['customers', 'candidates', 'clients', 'vehicles', 'vehicleimport', 'udhaar'],
  Catalogue: ['services', 'menu', 'stock', 'products', 'packages', 'passes', 'suppliers', 'purchases', 'reorder', 'expiry'],
  Money: ['bills', 'cash', 'dues', 'credit', 'returns', 'refunds', 'supplierpay', 'upi', 'money', 'fees', 'expenses', 'accounts', 'estimates'],
  Reports: ['sales7', 'sales30', 'sales90', 'sales_item', 'sales_staff', 'sales_hour', 'pnl', 'pnl30', 'pnl90', 'profit', 'gst', 'gst30', 'report', 'forecast', 'leaks', 'alerts', 'predictions', 'audit'],
  Grow: ['marketing', 'winback', 'festivals', 'loyalty', 'discount', 'ideas'],
  Team: ['staff', 'attendants', 'attendance', 'payslips', 'payslipsPrev', 'payroll', 'leave', 'shifts', 'advances', 'team', 'teampass', 'staffdisc', 'limits', 'mypassword', 'mydata'],
};
const LOOKUP = Object.fromEntries(Object.entries(BY_KEY).flatMap(([g, ks]) => ks.map((k) => [k, g])));
export const groupOf = (n) => (n.group && GROUP_ORDER.includes(n.group) ? n.group : LOOKUP[n.key] || 'More');
// Returns [{ group, items }] in heading order, or null when the menu is short enough to show as it is.
export function groupNav(nav, minItems = 9) {
  if (!Array.isArray(nav) || nav.length < minItems) return null;
  const out = GROUP_ORDER.map((group) => ({ group, items: nav.filter((n) => groupOf(n) === group) })).filter((g) => g.items.length);
  return out.length > 1 ? out : null;
}
