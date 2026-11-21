const { shapeAccount } = require('../services/adminAccountsShape');
const { computeStatus } = require('../services/subscription');
const now = new Date('2026-11-10T06:00:00Z'); const sub = { gymName: 'Iron House', createdAt: new Date('2026-10-01'), trialEndsAt: new Date('2026-11-12T06:00:00Z') };
describe('gym account facts', () => {
  test('shape: owner contact, status, no money or members', () => {
    const a = shapeAccount({ subscriber: sub, owner: { name: 'Ravi', phone: '9876543210', email: 'r@x.com', lastLoginAt: new Date('2026-11-09'), salesContactOk: true }, status: computeStatus(sub, now) });
    expect(a.product).toBe('fit'); expect(a.contactConsent).toBe(true); expect(a.status.status).toBe('trial'); expect(a.status.daysLeft).toBe(2);
    expect(Object.keys(a).join()).toBe('product,businessName,ownerName,ownerPhone,ownerEmail,contactConsent,createdAt,lastActiveAt,status,usage');
    expect(a.usage).toEqual({ members: 0, checkins14: 0 });
    expect(shapeAccount({ subscriber: sub, owner: null, status: computeStatus(sub, now), usage: { members: 40, checkins14: -3 } }).usage).toEqual({ members: 40, checkins14: 0 });
  });
  test('consent is false unless explicitly true; missing owner is safe', () => {
    expect(shapeAccount({ subscriber: sub, owner: { name: 'R', salesContactOk: 'yes' }, status: computeStatus(sub, now) }).contactConsent).toBe(false);
    const n = shapeAccount({ subscriber: sub, owner: null, status: computeStatus(sub, now) }); expect(n.contactConsent).toBe(false); expect(n.ownerPhone).toBe('');
  });
});
