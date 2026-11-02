// CRM-03 (gym side), pure part: one business account in the shape Super Admin's sales list expects.
// Owner contact only (the buyer). No member data, no amounts. Contract version 1.
// usage = plain counts for this gym (members, check-ins in 14 days): numbers only, for the Super Admin health score (SA-01).
const count = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.min(Math.floor(Number(v)), 1e7) : 0);
const shapeAccount = ({ subscriber, owner, status, usage }) => ({
  product: 'fit',
  businessName: subscriber.gymName,
  ownerName: owner ? owner.name : '',
  ownerPhone: owner ? owner.phone || '' : '',
  ownerEmail: owner ? owner.email || '' : '',
  contactConsent: Boolean(owner && owner.salesContactOk === true),
  createdAt: subscriber.createdAt || null,
  lastActiveAt: owner ? owner.lastLoginAt || null : null,
  status: { status: status.status, daysLeft: status.daysLeft == null ? null : status.daysLeft, endsAt: status.endsAt || null },
  usage: { members: count(usage && usage.members), checkins14: count(usage && usage.checkins14) },
});
module.exports = { shapeAccount, count };
