const { buildMemberQrPayload, verifyMemberQr } = require('../utils/qrcode');

describe('signed member QR', () => {
  test('a genuine payload verifies', () => {
    const p = JSON.parse(buildMemberQrPayload('6501a', '6502b'));
    expect(verifyMemberQr(p)).toEqual({ sid: '6501a', mid: '6502b' });
  });
  test('a made-up or edited payload is refused', () => {
    expect(verifyMemberQr({ sid: '6501a', mid: '6502b' })).toBeNull();
    expect(verifyMemberQr({ sid: '6501a', mid: '6502b', sig: 'abc' })).toBeNull();
    const p = JSON.parse(buildMemberQrPayload('6501a', '6502b'));
    expect(verifyMemberQr({ ...p, mid: '9999z' })).toBeNull();
    expect(verifyMemberQr({ ...p, sid: 'other' })).toBeNull();
    expect(verifyMemberQr(null)).toBeNull();
    expect(verifyMemberQr({ sid: 1, mid: 2, sig: 3 })).toBeNull();
  });
});
