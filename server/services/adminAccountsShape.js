// CRM-03 (gym side), pure part: one business account in the shape Super Admin's sales list expects.
// Owner contact only (the buyer). No member data, no amounts. Contract version 1.
const shapeAccount = ({ subscriber, owner, status }) => ({
  product: 'fit',
  businessName: subscriber.gymName,
  ownerName: owner ? owner.name : '',
  ownerPhone: owner ? owner.phone || '' : '',
  ownerEmail: owner ? owner.email || '' : '',
  contactConsent: Boolean(owner && owner.salesContactOk === true),
  createdAt: subscriber.createdAt || null,
  lastActiveAt: owner ? owner.lastLoginAt || null : null,
  status: { status: status.status, daysLeft: status.daysLeft == null ? null : status.daysLeft, endsAt: status.endsAt || null },
});
module.exports = { shapeAccount };
