const L = require('../services/leadRules');

describe('lead rules', () => {
  test('phone numbers: common Indian ways of writing a mobile become 10 digits; anything else is refused', () => {
    expect(L.normalizePhone('98765 43210')).toBe('9876543210');
    expect(L.normalizePhone('+91 98765-43210')).toBe('9876543210');
    expect(L.normalizePhone('09876543210')).toBe('9876543210');
    expect(L.normalizePhone('919876543210')).toBe('9876543210');
    expect(L.normalizePhone('1234567890')).toBeNull(); // does not start 6 to 9
    expect(L.normalizePhone('98765')).toBeNull(); expect(L.normalizePhone('')).toBeNull(); expect(L.normalizePhone(null)).toBeNull();
  });
  test('a new lead needs a name and a mobile; the public form also needs the tick box', () => {
    const ok = L.checkNewLead({ name: ' Ravi ', phone: '9876543210', consent: true, goal: 'lose weight' }, { consentRequired: true });
    expect(ok.ok).toBe(true); expect(ok.value.name).toBe('Ravi'); expect(ok.value.source).toBe('form');
    expect(L.checkNewLead({ name: 'Ravi', phone: '9876543210' }, { consentRequired: true }).ok).toBe(false); // no consent
    expect(L.checkNewLead({ name: 'Ravi', phone: '9876543210', consent: 'yes' }, { consentRequired: true }).ok).toBe(false); // only a real true counts
    expect(L.checkNewLead({ name: 'R', phone: '9876543210' }).ok).toBe(false);
    expect(L.checkNewLead({ name: 'Ravi', phone: '12' }).ok).toBe(false);
    expect(L.checkNewLead({ name: 'Ravi', phone: '9876543210' }).ok).toBe(true); // owner adds by hand: no tick needed
  });
  test('rejects objects and arrays where text is expected (no injection through the body)', () => {
    expect(L.checkNewLead({ name: { $ne: '' }, phone: '9876543210' }).ok).toBe(false);
    expect(L.checkNewLead({ name: 'Ravi', phone: ['9876543210'] }).ok).toBe(false);
    expect(L.checkNewLead(null).ok).toBe(false); expect(L.checkNewLead([]).ok).toBe(false);
  });
  test('text is trimmed, stripped of control characters and cut to length', () => {
    const v = L.checkNewLead({ name: 'Ravi\n\tKumar', phone: '9876543210', note: 'x'.repeat(900) }).value;
    expect(v.name).toBe('Ravi Kumar'); expect(v.note.length).toBe(500);
  });
  test('an update can change only status, note and follow-up date', () => {
    expect(L.checkLeadUpdate({ status: 'contacted' }).value).toEqual({ status: 'contacted' });
    expect(L.checkLeadUpdate({ status: 'hacked' }).ok).toBe(false);
    expect(L.checkLeadUpdate({ phone: '9999999999' }).ok).toBe(false); // nothing changeable
    expect(L.checkLeadUpdate({ subscriberId: 'x', status: 'trial' }).value).toEqual({ status: 'trial' }); // unknown fields are dropped
    expect(L.checkLeadUpdate({ nextFollowUpAt: 'not a date' }).ok).toBe(false);
    expect(L.checkLeadUpdate({ nextFollowUpAt: null }).value).toEqual({ nextFollowUpAt: null });
  });
  test('who needs a call: new for over a day, or follow-up date passed; never joined or lost', () => {
    const now = new Date('2026-11-18T10:00:00Z'); const day = 86400000;
    expect(L.needsAttention({ status: 'new', createdAt: new Date(now - 2 * day) }, now)).toBe(true);
    expect(L.needsAttention({ status: 'new', createdAt: new Date(now - 3600000) }, now)).toBe(false);
    expect(L.needsAttention({ status: 'contacted', createdAt: new Date(now - 9 * day), nextFollowUpAt: new Date(now - 1000) }, now)).toBe(true);
    expect(L.needsAttention({ status: 'contacted', createdAt: new Date(now - 9 * day), nextFollowUpAt: new Date(+now + day) }, now)).toBe(false);
    expect(L.needsAttention({ status: 'joined', createdAt: new Date(now - 9 * day), nextFollowUpAt: new Date(now - 1000) }, now)).toBe(false);
    expect(L.needsAttention({ status: 'lost', createdAt: new Date(now - 9 * day) }, now)).toBe(false);
  });
  test('lists mask the phone down to the last 3 digits', () => { expect(L.maskPhone('9876543210')).toBe('XXXXXXX210'); expect(L.maskPhone('')).toBe(''); });
});
